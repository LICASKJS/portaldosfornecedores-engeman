import express from 'express';
import { z } from 'zod';
import * as argon2 from 'argon2';
import { prisma } from '../services/prisma.js';
import { issueTokens, requireAuth } from '../middlewares/auth.js';
import { sendMail } from '../utils/mailer.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const router = express.Router();

const RegisterSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  supplier: z.object({
    fantasyName: z.string().min(2),
    legalName: z.string().min(2),
    documentId: z.string().min(5),
    email: z.string().email(),
    phone: z.string().optional(),
    address: z.string().optional()
  }).optional()
});

router.post('/register', async (req, res) => {
  try {
    const data = RegisterSchema.parse(req.body);
    const passwordHash = await argon2.hash(data.password);
    let supplierId = undefined;
    if (data.supplier) {
      const supplier = await prisma.supplier.create({ data: {
        fantasyName: data.supplier.fantasyName,
        legalName: data.supplier.legalName,
        documentId: data.supplier.documentId,
        email: data.supplier.email,
        phone: data.supplier.phone,
        address: data.supplier.address,
      }});
      supplierId = supplier.id;
    }
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: 'SUPPLIER',
        supplierId
      }
    });
    const tokens = await issueTokens(user, req);
    res.json(tokens);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
router.post('/login', async (req, res) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const tokens = await issueTokens(user, req);
    res.json(tokens);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// refresh token
const RefreshSchema = z.object({ refreshToken: z.string().min(10) });
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = RefreshSchema.parse(req.body);
    const session = await prisma.session.findUnique({ where: { refreshToken } });
    if (!session || session.revokedAt) return res.status(401).json({ error: 'Invalid refresh' });
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) return res.status(401).json({ error: 'Invalid refresh' });
    // optional expiry by days
    const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS || '15');
    const ageMs = Date.now() - new Date(session.createdAt).getTime();
    if (ageMs > days * 24 * 60 * 60 * 1000) {
      await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      return res.status(401).json({ error: 'Refresh expired' });
    }
    const payload = { sub: user.id, role: user.role };
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.ACCESS_TOKEN_TTL || '15m' });
    res.json({ accessToken });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  const { refreshToken } = req.body || {};
  if (refreshToken) {
    await prisma.session.updateMany({
      where: { refreshToken, userId: req.user.sub, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  } else {
    await prisma.session.updateMany({
      where: { userId: req.user.sub, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }
  res.json({ ok: true });
});

// forgot/reset password
const ForgotSchema = z.object({ email: z.string().email() });
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = ForgotSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.json({ ok: true }); // não expor
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = await argon2.hash(token);
    const expiresAt = new Date(Date.now() + 60*60*1000); // 1h
    await prisma.passwordReset.create({
      data: { userId: user.id, tokenHash, expiresAt }
    });
    const link = `${process.env.APP_URL}/reset?token=${token}&email=${encodeURIComponent(email)}`;
    await sendMail({
      to: email,
      subject: "Recuperação de senha",
      html: `<p>Olá, ${user.name}</p><p>Clique para redefinir sua senha: <a href="${link}">${link}</a></p>`
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

const ResetSchema = z.object({ email: z.string().email(), token: z.string(), newPassword: z.string().min(8) });
router.post('/reset-password', async (req, res) => {
  try {
    const { email, token, newPassword } = ResetSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: 'Invalid token' });
    const pr = await prisma.passwordReset.findFirst({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' }
    });
    if (!pr) return res.status(400).json({ error: 'Invalid token' });
    const valid = await argon2.verify(pr.tokenHash, token);
    if (!valid) return res.status(400).json({ error: 'Invalid token' });
    const passwordHash = await argon2.hash(newPassword);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.passwordReset.update({ where: { id: pr.id }, data: { usedAt: new Date() } }),
      prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;

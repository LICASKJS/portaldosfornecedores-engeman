import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../services/prisma.js';
import { requireAuth } from '../middlewares/auth.js';
import { sendMail } from '../utils/mailer.js';

const router = express.Router();

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const supplierId = req.user.supplierId || 'common';
    const dir = path.join(uploadDir, 'suppliers', supplierId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random()*1e9);
    cb(null, unique + '-' + file.originalname);
  }
});
const maxMb = Number(process.env.MAX_UPLOAD_MB || '25');
const upload = multer({ storage, limits: { fileSize: maxMb * 1024 * 1024 } });

router.get('/my', requireAuth, async (req, res) => {
  if (!req.user.sub) return res.status(401).json({ error: 'Unauthorized' });
  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!user?.supplierId) return res.status(404).json({ error: 'Supplier not found' });
  const docs = await prisma.document.findMany({ where: { supplierId: user.supplierId }, orderBy: { uploadedAt: 'desc' } });
  res.json(docs);
});

router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { type } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Missing file' });
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user?.supplierId) return res.status(404).json({ error: 'Supplier not found' });

    const doc = await prisma.document.create({
      data: {
        supplierId: user.supplierId,
        type: type || 'OUTROS',
        fileKey: file.path,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedById: user.id
      }
    });

    // notify by email
    const to = process.env.SUPPLIES_EMAIL || 'suprimentos@empresa.com';
    await sendMail({
      to,
      subject: `Novo documento (${doc.type}) - Fornecedor ${user.supplierId}`,
      html: `<p>Novo documento enviado.</p><ul>
        <li>Fornecedor: ${user.supplierId}</li>
        <li>Arquivo: ${doc.originalName}</li>
        <li>Tamanho: ${(doc.sizeBytes/1024/1024).toFixed(2)} MB</li>
      </ul>`
    });

    res.json(doc);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
});

export default router;

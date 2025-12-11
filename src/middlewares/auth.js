import jwt from 'jsonwebtoken';
import { prisma } from '../services/prisma.js';

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// Helper to issue tokens & manage sessions
export async function issueTokens(user, req) {
  const payload = { sub: user.id, role: user.role };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.ACCESS_TOKEN_TTL || '15m' });
  const refreshToken = cryptoRandom(64);
  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken,
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
    }
  });
  return { accessToken, refreshToken };
}

import crypto from 'crypto';
function cryptoRandom(len) {
  return crypto.randomBytes(len).toString('hex');
}

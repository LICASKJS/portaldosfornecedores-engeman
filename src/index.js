import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { prisma } from './services/prisma.js';
import authRoutes from './routes/auth.js';
import supplierRoutes from './routes/suppliers.js';
import documentRoutes from './routes/documents.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.APP_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());

// bootstrap admin user if not exists
async function bootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const argon2 = await import('argon2');
    const hash = await argon2.hash(password);
    await prisma.user.create({ data: { name: 'Administrator', email, passwordHash: hash, role: 'ADMIN' } });
    console.log('Admin user created:', email);
  }
}
bootstrapAdmin().catch(console.error);

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/suppliers', supplierRoutes);
app.use('/documents', documentRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));

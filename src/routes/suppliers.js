import express from 'express';
import { prisma } from '../services/prisma.js';
import { requireAuth, requireRoles } from '../middlewares/auth.js';
import { z } from 'zod';

const router = express.Router();

router.get('/my', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.sub }, include: { supplier: true } });
  if (!user || !user.supplierId) return res.status(404).json({ error: 'Supplier not found' });
  const supplier = await prisma.supplier.findUnique({
    where: { id: user.supplierId },
    include: { documents: true, iqfHistory: true }
  });
  res.json({ user: { id: user.id, name: user.name, email: user.email }, supplier });
});

// Admin search by name/document
router.get('/', requireAuth, requireRoles('ADMIN','ANALYST'), async (req, res) => {
  const q = String(req.query.q || '');
  const data = await prisma.supplier.findMany({
    where: {
      OR: [
        { fantasyName: { contains: q, mode: 'insensitive' } },
        { legalName: { contains: q, mode: 'insensitive' } },
        { documentId: { contains: q } },
      ]
    },
    take: 50,
    orderBy: { createdAt: 'desc' }
  });
  res.json(data);
});

const IQFSchema = z.object({
  monthRef: z.string(), // YYYY-MM-01
  iqfScore: z.number().min(0).max(100),
  approvalScore: z.number().min(0).max(100).nullable().optional(),
  notes: z.string().optional()
});

router.post('/:id/iqf', requireAuth, requireRoles('ADMIN','ANALYST'), async (req, res) => {
  try {
    const dto = IQFSchema.parse(req.body);
    const created = await prisma.iqfHistory.create({
      data: {
        supplierId: req.params.id,
        monthRef: new Date(dto.monthRef),
        iqfScore: dto.iqfScore,
        approvalScore: dto.approvalScore ?? null,
        notes: dto.notes
      }
    });
    // update current scores on supplier
    await prisma.supplier.update({
      where: { id: req.params.id },
      data: { iqfScore: dto.iqfScore, approvalScore: dto.approvalScore ?? undefined }
    });
    res.json(created);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;

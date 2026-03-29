import { Request, Response } from 'express';
import { prisma } from '../prisma';

const db = prisma as any;

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class ExpensesController {
  static async list(req: Request, res: Response) {
    try {
      const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : null;
      const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : null;

      const where: any = {};
      if (startDate && endDate) {
        where.timestamp = {
          gte: startDate,
          lte: endDate
        };
      }

      const rows = await db.expense.findMany({
        where,
        orderBy: { timestamp: 'desc' }
      });
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error listing expenses' });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const body = req.body || {};
      const amount = toNumber(body.amount, -1);
      const category = String(body.category || '').trim();
      const concept = String(body.concept || body.description || '').trim();
      if (!concept || amount <= 0 || !category) {
        return res.status(400).json({ error: 'concept, category and amount>0 are required' });
      }

      const max = await db.expense.aggregate({ _max: { id: true } });
      const created = await db.expense.create({
        data: {
          id: Number(max?._max?.id || 0) + 1,
          concept,
          description: concept,
          amount,
          category,
          timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
          userId: body.userId == null ? null : toNumber(body.userId, 0),
          userName: body.userName == null ? null : String(body.userName),
          notes: body.notes == null ? null : String(body.notes),
          cashRegisterId: body.cashRegisterId == null ? null : toNumber(body.cashRegisterId, 0)
        }
      });

      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error creating expense' });
    }
  }
}

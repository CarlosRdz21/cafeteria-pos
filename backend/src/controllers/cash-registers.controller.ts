import { Request, Response } from 'express';
import { prisma } from '../prisma';

const db = prisma as any;

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class CashRegistersController {
  static async current(_req: Request, res: Response) {
    try {
      const row = await db.cashRegister.findFirst({
        where: { status: 'open' },
        orderBy: { openedAt: 'desc' }
      });
      res.json(row || null);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error fetching current cash register' });
    }
  }

  static async history(req: Request, res: Response) {
    try {
      const limit = Math.max(1, toNumber(req.query.limit, 20));
      const rows = await db.cashRegister.findMany({
        orderBy: { openedAt: 'desc' },
        take: limit
      });
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error fetching cash register history' });
    }
  }

  static async open(req: Request, res: Response) {
    try {
      const openingAmount = toNumber(req.body?.openingAmount, -1);
      const userRef = String(req.body?.userId || req.body?.userRef || '').trim();
      if (openingAmount < 0) {
        return res.status(400).json({ error: 'openingAmount is required' });
      }
      if (!userRef) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const existing = await db.cashRegister.findFirst({ where: { status: 'open' } });
      if (existing) {
        return res.status(409).json({ error: 'Ya existe una caja abierta' });
      }

      const max = await db.cashRegister.aggregate({ _max: { id: true } });
      const created = await db.cashRegister.create({
        data: {
          id: toNumber(max?._max?.id, 0) + 1,
          openingAmount,
          cashSales: 0,
          cardSales: 0,
          expenses: 0,
          totalTransactions: 0,
          openedAt: new Date(),
          status: 'open',
          userRef
        }
      });

      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error opening cash register' });
    }
  }

  static async closeCurrent(req: Request, res: Response) {
    try {
      const closingAmount = toNumber(req.body?.closingAmount, -1);
      if (closingAmount < 0) {
        return res.status(400).json({ error: 'closingAmount is required' });
      }

      const open = await db.cashRegister.findFirst({
        where: { status: 'open' },
        orderBy: { openedAt: 'desc' }
      });
      if (!open) {
        return res.status(404).json({ error: 'No hay caja abierta' });
      }

      const expectedAmount = toNumber(open.openingAmount) + toNumber(open.cashSales) - toNumber(open.expenses);
      const difference = closingAmount - expectedAmount;
      const updated = await db.cashRegister.update({
        where: { id: open.id },
        data: {
          closingAmount,
          expectedAmount,
          difference,
          closedAt: new Date(),
          status: 'closed'
        }
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error closing cash register' });
    }
  }

  static async recordSaleCurrent(req: Request, res: Response) {
    try {
      const amount = toNumber(req.body?.amount, -1);
      const paymentMethod = String(req.body?.paymentMethod || '').trim() as 'cash' | 'card';
      if (amount < 0) {
        return res.status(400).json({ error: 'amount is required' });
      }
      if (paymentMethod !== 'cash' && paymentMethod !== 'card') {
        return res.status(400).json({ error: 'paymentMethod must be cash or card' });
      }

      const updated = await CashRegistersController.applySaleToOpenRegister(paymentMethod, amount);
      if (!updated) {
        return res.status(404).json({ error: 'No hay caja abierta' });
      }

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error recording sale' });
    }
  }

  static async recordExpenseCurrent(req: Request, res: Response) {
    try {
      const amount = toNumber(req.body?.amount, -1);
      if (amount < 0) {
        return res.status(400).json({ error: 'amount is required' });
      }

      const open = await db.cashRegister.findFirst({
        where: { status: 'open' },
        orderBy: { openedAt: 'desc' }
      });
      if (!open) {
        return res.status(404).json({ error: 'No hay caja abierta' });
      }

      const updated = await db.cashRegister.update({
        where: { id: open.id },
        data: {
          expenses: toNumber(open.expenses) + amount
        }
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error recording expense' });
    }
  }

  static async applySaleToOpenRegister(paymentMethod: 'cash' | 'card', amount: number) {
    const open = await db.cashRegister.findFirst({
      where: { status: 'open' },
      orderBy: { openedAt: 'desc' }
    });
    if (!open) return null;

    return db.cashRegister.update({
      where: { id: open.id },
      data: {
        totalTransactions: toNumber(open.totalTransactions) + 1,
        cashSales: paymentMethod === 'cash' ? toNumber(open.cashSales) + amount : toNumber(open.cashSales),
        cardSales: paymentMethod === 'card' ? toNumber(open.cardSales) + amount : toNumber(open.cardSales)
      }
    });
  }
}


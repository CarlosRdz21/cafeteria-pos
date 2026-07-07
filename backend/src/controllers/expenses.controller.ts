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
      const paidFromCashRegister = body.paidFromCashRegister === true;
      if (!concept || amount <= 0 || !category) {
        return res.status(400).json({ error: 'concept, category and amount>0 are required' });
      }

      let cashRegisterId = body.cashRegisterId == null ? null : toNumber(body.cashRegisterId, 0);
      if (paidFromCashRegister) {
        const openRegister = await db.cashRegister.findFirst({
          where: { status: 'open' },
          orderBy: { openedAt: 'desc' }
        });

        if (!openRegister) {
          return res.status(400).json({ error: 'No hay caja abierta para descontar este gasto' });
        }

        cashRegisterId = toNumber(openRegister.id, 0);
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
          cashRegisterId,
          paidFromCashRegister
        }
      });

      if (paidFromCashRegister && cashRegisterId) {
        const currentRegister = await db.cashRegister.findUnique({ where: { id: cashRegisterId } });
        if (currentRegister) {
          await db.cashRegister.update({
            where: { id: cashRegisterId },
            data: {
              expenses: toNumber(currentRegister.expenses) + amount
            }
          });
        }
      }

      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error creating expense' });
    }
  }

  static async remove(req: Request, res: Response) {
    try {
      const id = toNumber(req.params.id, 0);
      if (!id) {
        return res.status(400).json({ error: 'Invalid expense id' });
      }

      const deleted = await db.$transaction(async (tx: any) => {
        const expense = await tx.expense.findUnique({ where: { id } });
        if (!expense) {
          return null;
        }

        await tx.expense.delete({ where: { id } });

        if (expense.paidFromCashRegister && expense.cashRegisterId) {
          const register = await tx.cashRegister.findUnique({
            where: { id: expense.cashRegisterId }
          });

          if (register) {
            await tx.cashRegister.update({
              where: { id: expense.cashRegisterId },
              data: {
                expenses: Math.max(0, toNumber(register.expenses) - toNumber(expense.amount))
              }
            });
          }
        }

        return expense;
      });

      if (!deleted) {
        return res.status(404).json({ error: 'Gasto no encontrado' });
      }

      res.json(deleted);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error deleting expense' });
    }
  }
}

import { NextFunction, Request, Response } from 'express';
import { prisma } from '../../config/prisma';

const db = prisma as any;

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isPositiveInteger(value: unknown): boolean {
  const parsed = toNumber(value, 0);
  return Number.isInteger(parsed) && parsed > 0;
}

export class ExpensesController {
  static async list(req: Request, res: Response, next?: NextFunction) {
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
    } catch (error: unknown) {
      if (next) next(error);
      else throw error;
    }
  }

  static async create(req: Request, res: Response, next?: NextFunction) {
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

      const created = await db.expense.create({
        data: {
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
    } catch (error: unknown) {
      if (next) next(error);
      else throw error;
    }
  }

  static async remove(req: Request, res: Response, next?: NextFunction) {
    try {
      const id = toNumber(req.params.id, 0);
      if (!isPositiveInteger(req.params.id)) {
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
    } catch (error: unknown) {
      if (next) next(error);
      else throw error;
    }
  }
}

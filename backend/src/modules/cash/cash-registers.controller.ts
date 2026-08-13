import { NextFunction, Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

const db = prisma as any;
const MAXIMOS_REINTENTOS_CONCURRENCIA = 5;

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseInputNumber(value: unknown): number | undefined {
  if (
    typeof value !== 'number'
    && (typeof value !== 'string' || value.trim().length === 0)
  ) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export class CashRegistersController {
  static async current(_req: Request, res: Response, next?: NextFunction) {
    try {
      const row = await db.cashRegister.findFirst({
        where: { status: 'open' },
        orderBy: { openedAt: 'desc' }
      });
      res.json(row || null);
    } catch (error: unknown) {
      if (next) next(error);
      else throw error;
    }
  }

  static async history(req: Request, res: Response, next?: NextFunction) {
    try {
      const limit = Math.max(1, toNumber(req.query.limit, 20));
      const rows = await db.cashRegister.findMany({
        orderBy: { openedAt: 'desc' },
        take: limit
      });
      res.json(rows);
    } catch (error: unknown) {
      if (next) next(error);
      else throw error;
    }
  }

  static async open(req: Request, res: Response, next?: NextFunction) {
    try {
      const openingAmount = parseInputNumber(req.body?.openingAmount);
      const userRef = String(req.body?.userId || req.body?.userRef || '').trim();
      if (openingAmount === undefined || openingAmount < 0) {
        return res.status(400).json({ error: 'openingAmount is required' });
      }
      if (!userRef) {
        return res.status(400).json({ error: 'userId is required' });
      }

      let created = null;
      for (let intento = 0; intento < MAXIMOS_REINTENTOS_CONCURRENCIA; intento += 1) {
        try {
          created = await db.$transaction(async (tx: Prisma.TransactionClient) => {
            const existing = await tx.cashRegister.findFirst({
              where: { status: 'open' }
            });
            if (existing) return null;

            return tx.cashRegister.create({
              data: {
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
          }, { isolationLevel: 'Serializable' });
          break;
        } catch (error: unknown) {
          const codigo = typeof error === 'object' && error !== null && 'code' in error
            ? String(error.code)
            : '';
          if (codigo !== 'P2034' || intento === MAXIMOS_REINTENTOS_CONCURRENCIA - 1) {
            throw error;
          }
        }
      }

      if (!created) {
        return res.status(409).json({ error: 'Ya existe una caja abierta' });
      }

      res.status(201).json(created);
    } catch (error: unknown) {
      if (next) next(error);
      else throw error;
    }
  }

  static async closeCurrent(req: Request, res: Response, next?: NextFunction) {
    try {
      const closingAmount = parseInputNumber(req.body?.closingAmount);
      if (closingAmount === undefined || closingAmount < 0) {
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
    } catch (error: unknown) {
      if (next) next(error);
      else throw error;
    }
  }

  static async recordSaleCurrent(req: Request, res: Response, next?: NextFunction) {
    try {
      const amount = parseInputNumber(req.body?.amount);
      const paymentMethod = String(req.body?.paymentMethod || '').trim() as 'cash' | 'card';
      if (amount === undefined || amount <= 0) {
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
    } catch (error: unknown) {
      if (next) next(error);
      else throw error;
    }
  }

  static async recordExpenseCurrent(req: Request, res: Response, next?: NextFunction) {
    try {
      const amount = parseInputNumber(req.body?.amount);
      if (amount === undefined || amount <= 0) {
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
    } catch (error: unknown) {
      if (next) next(error);
      else throw error;
    }
  }

  static async applySaleToOpenRegister(paymentMethod: 'cash' | 'card', amount: number, client?: any) {
    const database = client ?? db;
    const open = await database.cashRegister.findFirst({
      where: { status: 'open' },
      orderBy: { openedAt: 'desc' }
    });
    if (!open) return null;

    return database.cashRegister.update({
      where: { id: open.id },
      data: {
        totalTransactions: { increment: 1 },
        ...(paymentMethod === 'cash'
          ? { cashSales: { increment: amount } }
          : { cardSales: { increment: amount } })
      }
    });
  }
}

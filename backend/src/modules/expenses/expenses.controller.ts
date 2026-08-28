import type { Expense } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { ApplicationError } from '../../middlewares/error.middleware';

const db = prisma as any;
const MONTO_MAXIMO_SEGURO = Number.MAX_SAFE_INTEGER;

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isPositiveInteger(value: unknown): boolean {
  const parsed = toNumber(value, 0);
  return Number.isInteger(parsed) && parsed > 0;
}

function obtenerCodigoPrisma(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : '';
}

function obtenerClaveIdempotencia(req: Request, body: Record<string, unknown>): unknown {
  const encabezado = req.headers?.['idempotency-key'];
  return Array.isArray(encabezado)
    ? encabezado[0]
    : encabezado ?? body.idempotencyKey;
}

function coincideConIntencion(
  gasto: Expense,
  intencion: {
    concept: string;
    amount: number;
    category: string;
    notes: string | null;
    paidFromCashRegister: boolean;
    timestampSolicitado: Date | null;
  },
): boolean {
  return (
    (gasto.concept ?? gasto.description ?? '') === intencion.concept &&
    gasto.amount === intencion.amount &&
    gasto.category === intencion.category &&
    (gasto.notes ?? null) === intencion.notes &&
    gasto.paidFromCashRegister === intencion.paidFromCashRegister &&
    (!intencion.timestampSolicitado ||
      gasto.timestamp.getTime() === intencion.timestampSolicitado.getTime())
  );
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
    const body = (req.body || {}) as Record<string, unknown>;
    const amount = toNumber(body.amount, Number.NaN);
    const category = String(body.category || '').trim();
    const concept = String(body.concept || body.description || '').trim();
    const notes = body.notes == null ? null : String(body.notes);
    const paidFromCashRegister = body.paidFromCashRegister === true;
    const valorClave = obtenerClaveIdempotencia(req, body);
    const idempotencyKey = typeof valorClave === 'string' ? valorClave.trim() : null;
    const timestampSolicitado = body.timestamp == null
      ? null
      : new Date(String(body.timestamp));

    if (
      !concept ||
      !category ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > MONTO_MAXIMO_SEGURO
    ) {
      return res.status(400).json({ error: 'concept, category and amount>0 are required' });
    }
    if (valorClave != null && (!idempotencyKey || idempotencyKey.length > 191)) {
      return res.status(400).json({ error: 'Invalid idempotency key' });
    }
    if (timestampSolicitado && Number.isNaN(timestampSolicitado.getTime())) {
      return res.status(400).json({ error: 'Invalid expense timestamp' });
    }

    const intencion = {
      concept,
      amount,
      category,
      notes,
      paidFromCashRegister,
      timestampSolicitado,
    };

    try {
      const resultado = await db.$transaction(async (tx: any) => {
        if (idempotencyKey) {
          const existente = await tx.expense.findUnique({
            where: { idempotencyKey },
          });
          if (existente) {
            if (!coincideConIntencion(existente, intencion)) {
              throw new ApplicationError(
                409,
                'Idempotency key reused with different expense data',
                'La clave de operación ya pertenece a otro gasto',
              );
            }
            return { gasto: existente, reutilizado: true };
          }
        }

        let cashRegisterId: number | null = null;
        if (paidFromCashRegister) {
          const openRegister = await tx.cashRegister.findFirst({
            where: { status: 'open' },
            orderBy: { openedAt: 'desc' }
          });
          if (!openRegister) {
            throw new ApplicationError(
              400,
              'No open cash register for expense',
              'No hay caja abierta para descontar este gasto',
            );
          }
          cashRegisterId = toNumber(openRegister.id, 0);
        }

        if (paidFromCashRegister && cashRegisterId) {
          const cajaActualizada = await tx.cashRegister.updateMany({
            where: { id: cashRegisterId, status: 'open' },
            data: { expenses: { increment: amount } },
          });
          if (cajaActualizada.count !== 1) {
            throw new ApplicationError(
              409,
              'Cash register closed while recording expense',
              'La caja se cerró antes de registrar el gasto',
            );
          }
        }

        const gasto = await tx.expense.create({
          data: {
            idempotencyKey,
            concept,
            description: concept,
            amount,
            category,
            timestamp: timestampSolicitado ?? new Date(),
            userId: body.userId == null ? null : toNumber(body.userId, 0),
            userName: body.userName == null ? null : String(body.userName),
            notes,
            cashRegisterId,
            paidFromCashRegister
          }
        });

        return { gasto, reutilizado: false };
      });

      return res.status(resultado.reutilizado ? 200 : 201).json(resultado.gasto);
    } catch (error: unknown) {
      if (idempotencyKey && obtenerCodigoPrisma(error) === 'P2002') {
        const existente = await db.expense.findUnique({
          where: { idempotencyKey },
        });
        if (existente && coincideConIntencion(existente, intencion)) {
          return res.status(200).json(existente);
        }
        return res.status(409).json({
          error: 'La clave de operación ya pertenece a otro gasto',
        });
      }
      if (error instanceof ApplicationError) {
        return res.status(error.statusCode).json({ error: error.publicMessage });
      }
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
        if (!expense) return null;

        const eliminacion = await tx.expense.deleteMany({ where: { id } });
        if (eliminacion.count !== 1) return null;

        if (expense.paidFromCashRegister && expense.cashRegisterId) {
          const amount = toNumber(expense.amount);
          await tx.$executeRaw`
            UPDATE \`CashRegister\`
            SET
              \`expectedAmount\` = IF(
                \`status\` = 'closed',
                \`openingAmount\` + \`cashSales\` - GREATEST(0, \`expenses\` - ${amount}),
                \`expectedAmount\`
              ),
              \`difference\` = IF(
                \`status\` = 'closed' AND \`closingAmount\` IS NOT NULL,
                \`closingAmount\` - (\`openingAmount\` + \`cashSales\` - GREATEST(0, \`expenses\` - ${amount})),
                \`difference\`
              ),
              \`expenses\` = GREATEST(0, \`expenses\` - ${amount})
            WHERE \`id\` = ${expense.cashRegisterId}
          `;
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

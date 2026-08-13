import { NextFunction, Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { ApplicationError } from '../../middlewares/error.middleware';

const db = prisma as any;

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isPositiveInteger(value: unknown): boolean {
  if (
    typeof value !== 'number'
    && (typeof value !== 'string' || value.trim().length === 0)
  ) {
    return false;
  }
  const parsed = toNumber(value, 0);
  return Number.isInteger(parsed) && parsed > 0;
}

function isFiniteInputNumber(value: unknown, minimum: number): boolean {
  if (
    typeof value !== 'number'
    && (typeof value !== 'string' || value.trim().length === 0)
  ) {
    return false;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum;
}

export class SupplyMovementsController {
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

      const rows = await db.supplyMovement.findMany({
        where,
        orderBy: { timestamp: 'desc' }
      });
      res.json(rows);
    } catch (error: unknown) {
      if (next) next(error);
      else throw error;
    }
  }

  static async entry(req: Request, res: Response, next?: NextFunction) {
    try {
      const body = req.body || {};
      const supplyId = toNumber(body.supplyId, 0);
      const quantity = toNumber(body.quantity, 0);
      if (!isPositiveInteger(body.supplyId) || !isFiniteInputNumber(body.quantity, Number.EPSILON)) {
        return res.status(400).json({ error: 'supplyId and quantity>0 are required' });
      }
      if (body.unitCost !== null && body.unitCost !== undefined) {
        if (!isFiniteInputNumber(body.unitCost, 0)) {
          return res.status(400).json({ error: 'unitCost must be greater than or equal to 0' });
        }
      }

      const result = await db.$transaction(async (tx: any) => {
        const supply = await tx.productSupply.findUnique({ where: { id: supplyId } });
        if (!supply) throw new ApplicationError(400, 'Insumo no encontrado');

        const unitCost = body.unitCost == null ? null : toNumber(body.unitCost, 0);
        await tx.productSupply.update({
          where: { id: supplyId },
          data: {
            currentStock: { increment: quantity }
          }
        });

        const movement = await tx.supplyMovement.create({
          data: {
            supplyId,
            type: 'in',
            quantity,
            unitCost,
            totalCost: unitCost == null ? null : quantity * unitCost,
            reason: body.reason == null ? null : String(body.reason),
            reference: body.reference == null ? null : String(body.reference),
            userId: body.userId == null ? null : toNumber(body.userId, 0),
            userName: body.userName == null ? null : String(body.userName),
            timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
            notes: body.notes == null ? null : String(body.notes)
          }
        });

        return movement;
      });

      res.status(201).json(result);
    } catch (error: unknown) {
      if (next) next(error);
      else if (error instanceof ApplicationError) {
        res.status(error.statusCode).json({ error: error.publicMessage });
      } else {
        throw error;
      }
    }
  }

  static async exit(req: Request, res: Response, next?: NextFunction) {
    try {
      const body = req.body || {};
      const supplyId = toNumber(body.supplyId, 0);
      const quantity = toNumber(body.quantity, 0);
      if (!isPositiveInteger(body.supplyId) || !isFiniteInputNumber(body.quantity, Number.EPSILON)) {
        return res.status(400).json({ error: 'supplyId and quantity>0 are required' });
      }

      const result = await db.$transaction(async (tx: any) => {
        const supply = await tx.productSupply.findUnique({ where: { id: supplyId } });
        if (!supply) throw new ApplicationError(400, 'Insumo no encontrado');
        const unitCost = supply.unitCost == null ? null : toNumber(supply.unitCost, 0);
        const actualizacion = await tx.productSupply.updateMany({
          where: {
            id: supplyId,
            currentStock: { gte: quantity }
          },
          data: {
            currentStock: { decrement: quantity }
          }
        });
        if (actualizacion.count !== 1) {
          throw new ApplicationError(400, 'Stock insuficiente');
        }

        const movement = await tx.supplyMovement.create({
          data: {
            supplyId,
            type: 'out',
            quantity,
            unitCost,
            totalCost: unitCost == null ? null : quantity * unitCost,
            reason: body.reason == null ? null : String(body.reason),
            reference: body.reference == null ? null : String(body.reference),
            userId: body.userId == null ? null : toNumber(body.userId, 0),
            userName: body.userName == null ? null : String(body.userName),
            timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
            notes: body.notes == null ? null : String(body.notes)
          }
        });

        return movement;
      });

      res.status(201).json(result);
    } catch (error: unknown) {
      if (next) next(error);
      else if (error instanceof ApplicationError) {
        res.status(error.statusCode).json({ error: error.publicMessage });
      } else {
        throw error;
      }
    }
  }
}

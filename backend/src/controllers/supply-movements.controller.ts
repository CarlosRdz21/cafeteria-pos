import { Request, Response } from 'express';
import { prisma } from '../prisma';

const db = prisma as any;

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class SupplyMovementsController {
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

      const rows = await db.supplyMovement.findMany({
        where,
        orderBy: { timestamp: 'desc' }
      });
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error listing supply movements' });
    }
  }

  static async entry(req: Request, res: Response) {
    try {
      const body = req.body || {};
      const supplyId = toNumber(body.supplyId, 0);
      const quantity = toNumber(body.quantity, 0);
      if (!supplyId || quantity <= 0) {
        return res.status(400).json({ error: 'supplyId and quantity>0 are required' });
      }

      const result = await db.$transaction(async (tx: any) => {
        const supply = await tx.productSupply.findUnique({ where: { id: supplyId } });
        if (!supply) throw new Error('Insumo no encontrado');

        const unitCost = body.unitCost == null ? null : toNumber(body.unitCost, 0);
        const movementMax = await tx.supplyMovement.aggregate({ _max: { id: true } });
        const movement = await tx.supplyMovement.create({
          data: {
            id: Number(movementMax?._max?.id || 0) + 1,
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

        await tx.productSupply.update({
          where: { id: supplyId },
          data: {
            currentStock: toNumber(supply.currentStock, 0) + quantity
          }
        });
        return movement;
      });

      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Error recording entry movement' });
    }
  }

  static async exit(req: Request, res: Response) {
    try {
      const body = req.body || {};
      const supplyId = toNumber(body.supplyId, 0);
      const quantity = toNumber(body.quantity, 0);
      if (!supplyId || quantity <= 0) {
        return res.status(400).json({ error: 'supplyId and quantity>0 are required' });
      }

      const result = await db.$transaction(async (tx: any) => {
        const supply = await tx.productSupply.findUnique({ where: { id: supplyId } });
        if (!supply) throw new Error('Insumo no encontrado');
        if (toNumber(supply.currentStock, 0) < quantity) throw new Error('Stock insuficiente');

        const unitCost = supply.unitCost == null ? null : toNumber(supply.unitCost, 0);
        const movementMax = await tx.supplyMovement.aggregate({ _max: { id: true } });
        const movement = await tx.supplyMovement.create({
          data: {
            id: Number(movementMax?._max?.id || 0) + 1,
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

        await tx.productSupply.update({
          where: { id: supplyId },
          data: {
            currentStock: toNumber(supply.currentStock, 0) - quantity
          }
        });
        return movement;
      });

      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Error recording exit movement' });
    }
  }
}


import { Request, Response } from 'express';
import { prisma } from '../prisma';

const db = prisma as any;

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class SuppliesController {
  static async list(_req: Request, res: Response) {
    try {
      const rows = await db.productSupply.findMany({
        orderBy: { name: 'asc' }
      });
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error listing supplies' });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const body = req.body || {};
      const name = String(body.name || '').trim();
      const unit = String(body.unit || '').trim();
      const categoryId = toNumber(body.categoryId, 0);
      if (!name || !unit || !categoryId) {
        return res.status(400).json({ error: 'name, unit and categoryId are required' });
      }

      const category = await db.supplyCategory.findUnique({ where: { id: categoryId } });
      if (!category) return res.status(400).json({ error: 'Invalid categoryId' });

      const max = await db.productSupply.aggregate({ _max: { id: true } });
      const created = await db.productSupply.create({
        data: {
          id: Number(max?._max?.id || 0) + 1,
          name,
          unit,
          categoryId,
          categoryName: category.name,
          currentStock: toNumber(body.currentStock, 0),
          unitCost: body.unitCost == null ? null : toNumber(body.unitCost, 0),
          minStock: body.minStock == null ? null : toNumber(body.minStock, 0),
          notes: body.notes == null ? null : String(body.notes),
          active: body.active !== false,
          createdAt: new Date()
        }
      });

      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error creating supply' });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const id = toNumber(req.params.id, 0);
      if (!id) return res.status(400).json({ error: 'Invalid supply id' });

      const existing = await db.productSupply.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Supply not found' });

      const body = req.body || {};
      const data: Record<string, unknown> = {};

      if (body.name !== undefined) data.name = String(body.name).trim();
      if (body.unit !== undefined) data.unit = String(body.unit).trim();
      if (body.currentStock !== undefined) data.currentStock = toNumber(body.currentStock, existing.currentStock);
      if (body.unitCost !== undefined) data.unitCost = body.unitCost == null ? null : toNumber(body.unitCost, 0);
      if (body.minStock !== undefined) data.minStock = body.minStock == null ? null : toNumber(body.minStock, 0);
      if (body.notes !== undefined) data.notes = body.notes == null ? null : String(body.notes);
      if (body.active !== undefined) data.active = !!body.active;

      if (body.categoryId !== undefined) {
        const categoryId = toNumber(body.categoryId, 0);
        if (!categoryId) return res.status(400).json({ error: 'Invalid categoryId' });
        const category = await db.supplyCategory.findUnique({ where: { id: categoryId } });
        if (!category) return res.status(400).json({ error: 'Invalid categoryId' });
        data.categoryId = categoryId;
        data.categoryName = category.name;
      }

      const updated = await db.productSupply.update({
        where: { id },
        data
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error updating supply' });
    }
  }
}


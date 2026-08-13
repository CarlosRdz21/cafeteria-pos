import { NextFunction, Request, Response } from 'express';
import { prisma } from '../../config/prisma';

const db = prisma as any;

export class SupplyCategoriesController {
  static async list(_req: Request, res: Response, next?: NextFunction) {
    try {
      const rows = await db.supplyCategory.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
      });
      res.json(rows);
    } catch (error: unknown) {
      if (next) next(error);
      else throw error;
    }
  }

  static async create(req: Request, res: Response, next?: NextFunction) {
    try {
      const name = String(req.body?.name || '').trim();
      if (!name) return res.status(400).json({ error: 'name is required' });

      const existing = await db.supplyCategory.findFirst({
        where: { name }
      });
      if (existing) {
        if (!existing.active) {
          const reactivated = await db.supplyCategory.update({
            where: { id: existing.id },
            data: { active: true }
          });
          return res.json(reactivated);
        }
        return res.status(409).json({ error: 'Category already exists' });
      }

      const max = await db.supplyCategory.aggregate({ _max: { sortOrder: true } });
      const created = await db.supplyCategory.create({
        data: {
          name,
          active: true,
          sortOrder: Number(max?._max?.sortOrder || 0) + 1
        }
      });

      res.status(201).json(created);
    } catch (error: unknown) {
      if (next) next(error);
      else throw error;
    }
  }
}

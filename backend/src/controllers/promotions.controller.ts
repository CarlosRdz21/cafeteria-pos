import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';

const db = prisma as any;

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  return (value ?? undefined) as Prisma.InputJsonValue | undefined;
}

function normalizeNumberList(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  const out: number[] = [];
  for (const value of values) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) continue;
    if (!out.includes(parsed)) out.push(parsed);
  }
  return out;
}

function normalizeStringList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const clean = value.trim();
    if (!clean) continue;
    if (!out.includes(clean)) out.push(clean);
  }
  return out;
}

function normalizePromotionPayload(body: any) {
  return {
    id: typeof body?.id === 'string' && body.id.trim() ? body.id.trim() : '',
    name: typeof body?.name === 'string' ? body.name.trim() : '',
    active: body?.active !== false,
    type: body?.type === 'bundle_price' ? 'bundle_price' : 'percentage_discount',
    scope: body?.scope === 'category' || body?.scope === 'product' ? body.scope : 'all',
    productIds: normalizeNumberList(body?.productIds),
    categoryIds: normalizeNumberList(body?.categoryIds),
    categoryNames: normalizeStringList(body?.categoryNames),
    percentageOff: body?.percentageOff == null ? null : Number(body.percentageOff),
    bundleQuantity: body?.bundleQuantity == null ? null : Math.round(Number(body.bundleQuantity)),
    bundlePrice: body?.bundlePrice == null ? null : Number(body.bundlePrice),
    dayOfWeek: normalizeNumberList(body?.dayOfWeek).filter(day => day >= 0 && day <= 6),
    startDate: typeof body?.startDate === 'string' ? body.startDate : '',
    endDate: typeof body?.endDate === 'string' ? body.endDate : ''
  };
}

export class PromotionsController {
  static async list(_req: Request, res: Response) {
    try {
      const rows = await db.promotion.findMany({
        orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }]
      });

      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error listing promotions' });
    }
  }

  static async upsert(req: Request, res: Response) {
    try {
      const payload = normalizePromotionPayload(req.body || {});
      if (!payload.id || !payload.name) {
        return res.status(400).json({ error: 'id and name are required' });
      }

      const saved = await db.promotion.upsert({
        where: { id: payload.id },
        update: {
          name: payload.name,
          active: payload.active,
          type: payload.type,
          scope: payload.scope,
          productIds: toJson(payload.productIds),
          categoryIds: toJson(payload.categoryIds),
          categoryNames: toJson(payload.categoryNames),
          percentageOff: payload.percentageOff,
          bundleQuantity: payload.bundleQuantity,
          bundlePrice: payload.bundlePrice,
          dayOfWeek: toJson(payload.dayOfWeek),
          startDate: payload.startDate || null,
          endDate: payload.endDate || null
        },
        create: {
          id: payload.id,
          name: payload.name,
          active: payload.active,
          type: payload.type,
          scope: payload.scope,
          productIds: toJson(payload.productIds),
          categoryIds: toJson(payload.categoryIds),
          categoryNames: toJson(payload.categoryNames),
          percentageOff: payload.percentageOff,
          bundleQuantity: payload.bundleQuantity,
          bundlePrice: payload.bundlePrice,
          dayOfWeek: toJson(payload.dayOfWeek),
          startDate: payload.startDate || null,
          endDate: payload.endDate || null
        }
      });

      res.json(saved);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error saving promotion' });
    }
  }

  static async remove(req: Request, res: Response) {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: 'Invalid promotion id' });

      await db.promotion.delete({ where: { id } });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error deleting promotion' });
    }
  }
}

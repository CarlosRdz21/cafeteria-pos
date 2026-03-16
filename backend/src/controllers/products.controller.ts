import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';

const db = prisma as any;

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  return (value ?? undefined) as Prisma.InputJsonValue | undefined;
}

export class ProductsController {
  static async list(_req: Request, res: Response) {
    try {
      const rows = await db.product.findMany({
        orderBy: [{ categoryName: 'asc' }, { name: 'asc' }]
      });
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error listing products' });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const body = req.body || {};
      if (!body.name || !body.categoryId) {
        return res.status(400).json({ error: 'name and categoryId are required' });
      }

      const created = await db.product.create({
        data: {
          name: String(body.name).trim(),
          description: String(body.description || ''),
          price: Number(body.price || 0),
          image: String(body.image || ''),
          categoryId: Number(body.categoryId),
          categoryName: String(body.categoryName || ''),
          available: body.available !== false,
          stock: body.stock == null ? null : Number(body.stock),
          variantPricing: toJson(body.variantPricing),
          drinkBaseType: body.drinkBaseType ?? null,
          milkOptions: toJson(body.milkOptions),
          waterOptions: toJson(body.waterOptions),
          milkOptionExtras: toJson(body.milkOptionExtras),
          waterOptionExtras: toJson(body.waterOptionExtras),
          allowFlavorSelection: body.allowFlavorSelection === true,
          flavorOptions: toJson(body.flavorOptions),
          flavorOptionExtras: toJson(body.flavorOptionExtras),
          serviceTemperature: body.serviceTemperature ?? null,
          removableIngredients: toJson(body.removableIngredients),
          extraIngredients: toJson(body.extraIngredients),
          extraIngredientPrices: toJson(body.extraIngredientPrices)
        }
      });

      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error creating product' });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid product id' });

      const body = req.body || {};
      const updated = await db.product.update({
        where: { id },
        data: {
          name: body.name == null ? undefined : String(body.name).trim(),
          description: body.description == null ? undefined : String(body.description),
          price: body.price == null ? undefined : Number(body.price),
          image: body.image == null ? undefined : String(body.image),
          categoryId: body.categoryId == null ? undefined : Number(body.categoryId),
          categoryName: body.categoryName == null ? undefined : String(body.categoryName),
          available: body.available == null ? undefined : !!body.available,
          stock: body.stock === undefined ? undefined : (body.stock == null ? null : Number(body.stock)),
          variantPricing: body.variantPricing === undefined ? undefined : toJson(body.variantPricing),
          drinkBaseType: body.drinkBaseType === undefined ? undefined : (body.drinkBaseType ?? null),
          milkOptions: body.milkOptions === undefined ? undefined : toJson(body.milkOptions),
          waterOptions: body.waterOptions === undefined ? undefined : toJson(body.waterOptions),
          milkOptionExtras: body.milkOptionExtras === undefined ? undefined : toJson(body.milkOptionExtras),
          waterOptionExtras: body.waterOptionExtras === undefined ? undefined : toJson(body.waterOptionExtras),
          allowFlavorSelection: body.allowFlavorSelection === undefined ? undefined : body.allowFlavorSelection === true,
          flavorOptions: body.flavorOptions === undefined ? undefined : toJson(body.flavorOptions),
          flavorOptionExtras: body.flavorOptionExtras === undefined ? undefined : toJson(body.flavorOptionExtras),
          serviceTemperature: body.serviceTemperature === undefined ? undefined : (body.serviceTemperature ?? null),
          removableIngredients: body.removableIngredients === undefined ? undefined : toJson(body.removableIngredients),
          extraIngredients: body.extraIngredients === undefined ? undefined : toJson(body.extraIngredients),
          extraIngredientPrices: body.extraIngredientPrices === undefined ? undefined : toJson(body.extraIngredientPrices)
        }
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error updating product' });
    }
  }

  static async remove(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid product id' });
      await db.product.delete({ where: { id } });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error deleting product' });
    }
  }
}

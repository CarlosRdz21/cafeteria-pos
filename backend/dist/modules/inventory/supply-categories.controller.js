"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplyCategoriesController = void 0;
const prisma_1 = require("../../config/prisma");
const db = prisma_1.prisma;
class SupplyCategoriesController {
    static async list(_req, res, next) {
        try {
            const rows = await db.supplyCategory.findMany({
                where: { active: true },
                orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
            });
            res.json(rows);
        }
        catch (error) {
            if (next)
                next(error);
            else
                throw error;
        }
    }
    static async create(req, res, next) {
        try {
            const name = String(req.body?.name || '').trim();
            if (!name)
                return res.status(400).json({ error: 'name is required' });
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
        }
        catch (error) {
            if (next)
                next(error);
            else
                throw error;
        }
    }
}
exports.SupplyCategoriesController = SupplyCategoriesController;

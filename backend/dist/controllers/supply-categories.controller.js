"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplyCategoriesController = void 0;
const prisma_1 = require("../prisma");
const db = prisma_1.prisma;
class SupplyCategoriesController {
    static async list(_req, res) {
        try {
            const rows = await db.supplyCategory.findMany({
                where: { active: true },
                orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
            });
            res.json(rows);
        }
        catch (error) {
            res.status(500).json({ error: error?.message || 'Error listing supply categories' });
        }
    }
    static async create(req, res) {
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
            const max = await db.supplyCategory.aggregate({ _max: { id: true, sortOrder: true } });
            const created = await db.supplyCategory.create({
                data: {
                    id: Number(max?._max?.id || 0) + 1,
                    name,
                    active: true,
                    sortOrder: Number(max?._max?.sortOrder || 0) + 1
                }
            });
            res.status(201).json(created);
        }
        catch (error) {
            res.status(500).json({ error: error?.message || 'Error creating supply category' });
        }
    }
}
exports.SupplyCategoriesController = SupplyCategoriesController;

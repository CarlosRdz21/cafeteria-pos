"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductCategoriesController = void 0;
const prisma_1 = require("../prisma");
const db = prisma_1.prisma;
class ProductCategoriesController {
    static async list(_req, res) {
        try {
            const rows = await db.productCategory.findMany({
                orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
            });
            res.json(rows);
        }
        catch (error) {
            res.status(500).json({ error: error?.message || 'Error listing categories' });
        }
    }
    static async create(req, res) {
        try {
            const name = String(req.body?.name || '').trim();
            if (!name)
                return res.status(400).json({ error: 'name is required' });
            const existing = await db.productCategory.findFirst({
                where: { name }
            });
            if (existing) {
                return res.status(409).json({ error: 'Category already exists' });
            }
            const max = await db.productCategory.aggregate({ _max: { sortOrder: true } });
            const created = await db.productCategory.create({
                data: {
                    name,
                    active: req.body?.active !== false,
                    sortOrder: Number(max?._max?.sortOrder || 0) + 1
                }
            });
            res.status(201).json(created);
        }
        catch (error) {
            res.status(500).json({ error: error?.message || 'Error creating category' });
        }
    }
    static async update(req, res) {
        try {
            const id = Number(req.params.id);
            if (!id)
                return res.status(400).json({ error: 'Invalid category id' });
            const body = req.body || {};
            const updated = await db.productCategory.update({
                where: { id },
                data: {
                    name: body.name == null ? undefined : String(body.name).trim(),
                    active: body.active == null ? undefined : !!body.active,
                    sortOrder: body.sortOrder == null ? undefined : Number(body.sortOrder)
                }
            });
            if (body.name) {
                await db.product.updateMany({
                    where: { categoryId: id },
                    data: { categoryName: String(body.name).trim() }
                });
            }
            res.json(updated);
        }
        catch (error) {
            res.status(500).json({ error: error?.message || 'Error updating category' });
        }
    }
    static async remove(req, res) {
        try {
            const id = Number(req.params.id);
            if (!id)
                return res.status(400).json({ error: 'Invalid category id' });
            const replacementCategoryIdRaw = req.query.replacementCategoryId ?? req.body?.replacementCategoryId;
            const replacementCategoryId = replacementCategoryIdRaw == null ? null : Number(replacementCategoryIdRaw);
            if (replacementCategoryId && replacementCategoryId !== id) {
                const replacement = await db.productCategory.findUnique({ where: { id: replacementCategoryId } });
                if (!replacement) {
                    return res.status(400).json({ error: 'replacementCategoryId not found' });
                }
                await db.product.updateMany({
                    where: { categoryId: id },
                    data: {
                        categoryId: replacement.id,
                        categoryName: replacement.name
                    }
                });
            }
            await db.productCategory.delete({ where: { id } });
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error?.message || 'Error deleting category' });
        }
    }
}
exports.ProductCategoriesController = ProductCategoriesController;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromotionsController = void 0;
const prisma_1 = require("../../config/prisma");
const db = prisma_1.prisma;
function toJson(value) {
    return (value ?? undefined);
}
function normalizeNumberList(values) {
    if (!Array.isArray(values))
        return [];
    const out = [];
    for (const value of values) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0)
            continue;
        if (!out.includes(parsed))
            out.push(parsed);
    }
    return out;
}
function normalizeDayList(values) {
    if (!Array.isArray(values))
        return [];
    const out = [];
    for (const value of values) {
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed < 0 || parsed > 6)
            continue;
        if (!out.includes(parsed))
            out.push(parsed);
    }
    return out;
}
function normalizeStringList(values) {
    if (!Array.isArray(values))
        return [];
    const out = [];
    for (const value of values) {
        if (typeof value !== 'string')
            continue;
        const clean = value.trim();
        if (!clean)
            continue;
        if (!out.includes(clean))
            out.push(clean);
    }
    return out;
}
function convertirNumeroFinito(value) {
    if (value === null || value === undefined || value === '')
        return null;
    const numero = Number(value);
    return Number.isFinite(numero) ? numero : null;
}
function esFechaIsoValida(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const [anio, mes, dia] = value.split('-').map(Number);
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));
    return fecha.getUTCFullYear() === anio
        && fecha.getUTCMonth() === mes - 1
        && fecha.getUTCDate() === dia;
}
function normalizePromotionPayload(body) {
    return {
        id: typeof body?.id === 'string' && body.id.trim() ? body.id.trim() : '',
        name: typeof body?.name === 'string' ? body.name.trim() : '',
        active: body?.active !== false,
        type: body?.type === 'bundle_price' ? 'bundle_price' : 'percentage_discount',
        scope: body?.scope === 'category' || body?.scope === 'product' ? body.scope : 'all',
        productIds: normalizeNumberList(body?.productIds),
        categoryIds: normalizeNumberList(body?.categoryIds),
        categoryNames: normalizeStringList(body?.categoryNames),
        percentageOff: convertirNumeroFinito(body?.percentageOff),
        bundleQuantity: convertirNumeroFinito(body?.bundleQuantity),
        bundlePrice: convertirNumeroFinito(body?.bundlePrice),
        dayOfWeek: normalizeDayList(body?.dayOfWeek),
        startDate: typeof body?.startDate === 'string' ? body.startDate.trim() : '',
        endDate: typeof body?.endDate === 'string' ? body.endDate.trim() : ''
    };
}
class PromotionsController {
    static async list(_req, res, next) {
        try {
            const rows = await db.promotion.findMany({
                orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }]
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
    static async upsert(req, res, next) {
        try {
            const payload = normalizePromotionPayload(req.body || {});
            if (!payload.id || !payload.name) {
                return res.status(400).json({ error: 'id and name are required' });
            }
            if (req.body?.type !== undefined
                && req.body.type !== 'percentage_discount'
                && req.body.type !== 'bundle_price') {
                return res.status(400).json({ error: 'Invalid promotion type' });
            }
            if (req.body?.scope !== undefined
                && req.body.scope !== 'all'
                && req.body.scope !== 'category'
                && req.body.scope !== 'product') {
                return res.status(400).json({ error: 'Invalid promotion scope' });
            }
            if (req.body?.active !== undefined && typeof req.body.active !== 'boolean') {
                return res.status(400).json({ error: 'Invalid active value' });
            }
            if (payload.type === 'percentage_discount'
                && (payload.percentageOff === null || payload.percentageOff <= 0 || payload.percentageOff > 100)) {
                return res.status(400).json({ error: 'Invalid percentageOff' });
            }
            if (payload.type === 'bundle_price'
                && (payload.bundleQuantity === null
                    || !Number.isInteger(payload.bundleQuantity)
                    || payload.bundleQuantity < 2)) {
                return res.status(400).json({ error: 'Invalid bundleQuantity' });
            }
            if (payload.type === 'bundle_price'
                && (payload.bundlePrice === null || payload.bundlePrice <= 0)) {
                return res.status(400).json({ error: 'Invalid bundlePrice' });
            }
            if ((payload.startDate && !esFechaIsoValida(payload.startDate))
                || (payload.endDate && !esFechaIsoValida(payload.endDate))
                || (payload.startDate && payload.endDate && payload.startDate > payload.endDate)) {
                return res.status(400).json({ error: 'Invalid promotion date range' });
            }
            if (payload.scope === 'product') {
                if (payload.productIds.length === 0) {
                    return res.status(400).json({ error: 'productIds are required for product scope' });
                }
                const products = await db.product.findMany({
                    where: { id: { in: payload.productIds } },
                    select: { id: true }
                });
                if (products.length !== payload.productIds.length) {
                    return res.status(400).json({ error: 'Invalid productIds' });
                }
            }
            if (payload.scope === 'category') {
                if (payload.categoryIds.length === 0) {
                    return res.status(400).json({ error: 'categoryIds are required for category scope' });
                }
                const categories = await db.productCategory.findMany({
                    where: { id: { in: payload.categoryIds } },
                    select: { id: true }
                });
                if (categories.length !== payload.categoryIds.length) {
                    return res.status(400).json({ error: 'Invalid categoryIds' });
                }
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
        }
        catch (error) {
            if (next)
                next(error);
            else
                throw error;
        }
    }
    static async remove(req, res, next) {
        try {
            const id = String(req.params.id || '').trim();
            if (!id)
                return res.status(400).json({ error: 'Invalid promotion id' });
            await db.promotion.delete({ where: { id } });
            res.json({ success: true });
        }
        catch (error) {
            if (next)
                next(error);
            else
                throw error;
        }
    }
}
exports.PromotionsController = PromotionsController;

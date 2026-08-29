"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsController = void 0;
const prisma_1 = require("../../config/prisma");
const db = prisma_1.prisma;
function toJson(value) {
    return (value ?? undefined);
}
function convertirNumeroFinito(value) {
    if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) {
        return undefined;
    }
    const numero = Number(value);
    return Number.isFinite(numero) ? numero : undefined;
}
function convertirEnteroPositivo(value) {
    const numero = convertirNumeroFinito(value);
    return numero !== undefined && Number.isInteger(numero) && numero > 0 ? numero : undefined;
}
function convertirStock(value) {
    if (value === null)
        return null;
    const numero = convertirNumeroFinito(value);
    return numero !== undefined && Number.isInteger(numero) && numero >= 0 ? numero : undefined;
}
class ProductsController {
    static async list(_req, res, next) {
        try {
            const rows = await db.product.findMany({
                orderBy: [{ categoryName: 'asc' }, { name: 'asc' }]
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
            const body = req.body || {};
            const name = typeof body.name === 'string' ? body.name.trim() : '';
            const categoryId = convertirEnteroPositivo(body.categoryId);
            const price = body.price === null || body.price === undefined
                ? 0
                : convertirNumeroFinito(body.price);
            const stock = body.stock === null || body.stock === undefined
                ? null
                : convertirStock(body.stock);
            if (!name || categoryId === undefined) {
                return res.status(400).json({ error: 'name and categoryId are required' });
            }
            if (price === undefined || price < 0) {
                return res.status(400).json({ error: 'Invalid price' });
            }
            if (body.stock !== null && body.stock !== undefined && stock === undefined) {
                return res.status(400).json({ error: 'Invalid stock' });
            }
            if (body.available !== undefined && typeof body.available !== 'boolean') {
                return res.status(400).json({ error: 'Invalid available value' });
            }
            const category = await db.productCategory.findUnique({
                where: { id: categoryId },
                select: { id: true }
            });
            if (!category) {
                return res.status(400).json({ error: 'Invalid categoryId' });
            }
            const created = await db.product.create({
                data: {
                    name,
                    description: String(body.description || ''),
                    price,
                    image: String(body.image || ''),
                    categoryId,
                    categoryName: String(body.categoryName || ''),
                    available: body.available !== false,
                    stock,
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
        }
        catch (error) {
            if (next)
                next(error);
            else
                throw error;
        }
    }
    static async update(req, res, next) {
        try {
            const id = convertirEnteroPositivo(req.params.id);
            if (id === undefined)
                return res.status(400).json({ error: 'Invalid product id' });
            const body = req.body || {};
            const product = await db.product.findUnique({
                where: { id },
                select: { id: true }
            });
            if (!product) {
                return res.status(404).json({ error: 'Resource not found' });
            }
            const name = body.name === null || body.name === undefined
                ? undefined
                : (typeof body.name === 'string' ? body.name.trim() : '');
            const price = body.price === null || body.price === undefined
                ? undefined
                : convertirNumeroFinito(body.price);
            const categoryId = body.categoryId === null || body.categoryId === undefined
                ? undefined
                : convertirEnteroPositivo(body.categoryId);
            const stock = body.stock === undefined ? undefined : convertirStock(body.stock);
            if (name === '') {
                return res.status(400).json({ error: 'Invalid name' });
            }
            if (body.price !== null &&
                body.price !== undefined &&
                (price === undefined || price < 0)) {
                return res.status(400).json({ error: 'Invalid price' });
            }
            if (body.categoryId !== null &&
                body.categoryId !== undefined &&
                categoryId === undefined) {
                return res.status(400).json({ error: 'Invalid categoryId' });
            }
            if (body.stock !== undefined && stock === undefined) {
                return res.status(400).json({ error: 'Invalid stock' });
            }
            if (body.available !== undefined && typeof body.available !== 'boolean') {
                return res.status(400).json({ error: 'Invalid available value' });
            }
            if (categoryId !== undefined) {
                const category = await db.productCategory.findUnique({
                    where: { id: categoryId },
                    select: { id: true }
                });
                if (!category) {
                    return res.status(400).json({ error: 'Invalid categoryId' });
                }
            }
            const updated = await db.product.update({
                where: { id },
                data: {
                    name,
                    description: body.description == null ? undefined : String(body.description),
                    price,
                    image: body.image == null ? undefined : String(body.image),
                    categoryId,
                    categoryName: body.categoryName == null ? undefined : String(body.categoryName),
                    available: body.available,
                    stock,
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
            const id = convertirEnteroPositivo(req.params.id);
            if (id === undefined)
                return res.status(400).json({ error: 'Invalid product id' });
            await db.product.delete({ where: { id } });
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
exports.ProductsController = ProductsController;

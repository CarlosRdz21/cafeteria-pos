"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CashRegistersController = void 0;
const prisma_1 = require("../../config/prisma");
const db = prisma_1.prisma;
const MAXIMOS_REINTENTOS_CONCURRENCIA = 5;
function toNumber(value, fallback = 0) {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function parseInputNumber(value) {
    if (typeof value !== 'number'
        && (typeof value !== 'string' || value.trim().length === 0)) {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
class CashRegistersController {
    static async current(_req, res, next) {
        try {
            const row = await db.cashRegister.findFirst({
                where: { status: 'open' },
                orderBy: { openedAt: 'desc' }
            });
            res.json(row || null);
        }
        catch (error) {
            if (next)
                next(error);
            else
                throw error;
        }
    }
    static async history(req, res, next) {
        try {
            const limit = Math.max(1, toNumber(req.query.limit, 20));
            const rows = await db.cashRegister.findMany({
                orderBy: { openedAt: 'desc' },
                take: limit
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
    static async open(req, res, next) {
        try {
            const openingAmount = parseInputNumber(req.body?.openingAmount);
            const userRef = String(req.body?.userId || req.body?.userRef || '').trim();
            if (openingAmount === undefined || openingAmount < 0) {
                return res.status(400).json({ error: 'openingAmount is required' });
            }
            if (!userRef) {
                return res.status(400).json({ error: 'userId is required' });
            }
            let created = null;
            for (let intento = 0; intento < MAXIMOS_REINTENTOS_CONCURRENCIA; intento += 1) {
                try {
                    created = await db.$transaction(async (tx) => {
                        const existing = await tx.cashRegister.findFirst({
                            where: { status: 'open' }
                        });
                        if (existing)
                            return null;
                        return tx.cashRegister.create({
                            data: {
                                openingAmount,
                                cashSales: 0,
                                cardSales: 0,
                                expenses: 0,
                                totalTransactions: 0,
                                openedAt: new Date(),
                                status: 'open',
                                userRef
                            }
                        });
                    }, { isolationLevel: 'Serializable' });
                    break;
                }
                catch (error) {
                    const codigo = typeof error === 'object' && error !== null && 'code' in error
                        ? String(error.code)
                        : '';
                    if (codigo !== 'P2034' || intento === MAXIMOS_REINTENTOS_CONCURRENCIA - 1) {
                        throw error;
                    }
                }
            }
            if (!created) {
                return res.status(409).json({ error: 'Ya existe una caja abierta' });
            }
            res.status(201).json(created);
        }
        catch (error) {
            if (next)
                next(error);
            else
                throw error;
        }
    }
    static async closeCurrent(req, res, next) {
        try {
            const closingAmount = parseInputNumber(req.body?.closingAmount);
            if (closingAmount === undefined || closingAmount < 0) {
                return res.status(400).json({ error: 'closingAmount is required' });
            }
            const updated = await db.$transaction(async (tx) => {
                const open = await tx.cashRegister.findFirst({
                    where: { status: 'open' },
                    orderBy: { openedAt: 'desc' }
                });
                if (!open)
                    return null;
                const closedAt = new Date();
                const affectedRows = await tx.$executeRaw `
          UPDATE \`CashRegister\`
          SET
            \`closingAmount\` = ${closingAmount},
            \`expectedAmount\` = \`openingAmount\` + \`cashSales\` - \`expenses\`,
            \`difference\` = ${closingAmount} - (\`openingAmount\` + \`cashSales\` - \`expenses\`),
            \`closedAt\` = ${closedAt},
            \`status\` = 'closed'
          WHERE \`id\` = ${open.id}
            AND \`status\` = 'open'
        `;
                if (affectedRows !== 1)
                    return null;
                return tx.cashRegister.findUnique({ where: { id: open.id } });
            });
            if (!updated) {
                return res.status(404).json({ error: 'No hay caja abierta' });
            }
            res.json(updated);
        }
        catch (error) {
            if (next)
                next(error);
            else
                throw error;
        }
    }
    static async recordSaleCurrent(req, res, next) {
        try {
            const amount = parseInputNumber(req.body?.amount);
            const paymentMethod = String(req.body?.paymentMethod || '').trim();
            if (amount === undefined || amount <= 0) {
                return res.status(400).json({ error: 'amount is required' });
            }
            if (paymentMethod !== 'cash' && paymentMethod !== 'card') {
                return res.status(400).json({ error: 'paymentMethod must be cash or card' });
            }
            const updated = await CashRegistersController.applySaleToOpenRegister(paymentMethod, amount);
            if (!updated) {
                return res.status(404).json({ error: 'No hay caja abierta' });
            }
            res.json(updated);
        }
        catch (error) {
            if (next)
                next(error);
            else
                throw error;
        }
    }
    static async recordExpenseCurrent(req, res, next) {
        try {
            const amount = parseInputNumber(req.body?.amount);
            if (amount === undefined || amount <= 0) {
                return res.status(400).json({ error: 'amount is required' });
            }
            const open = await db.cashRegister.findFirst({
                where: { status: 'open' },
                orderBy: { openedAt: 'desc' }
            });
            if (!open) {
                return res.status(404).json({ error: 'No hay caja abierta' });
            }
            const updated = await db.cashRegister.update({
                where: { id: open.id },
                data: {
                    expenses: toNumber(open.expenses) + amount
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
    static async applySaleToOpenRegister(paymentMethod, amount, client) {
        const database = client ?? db;
        const open = await database.cashRegister.findFirst({
            where: { status: 'open' },
            orderBy: { openedAt: 'desc' }
        });
        if (!open)
            return null;
        const result = await database.cashRegister.updateMany({
            where: { id: open.id, status: 'open' },
            data: {
                totalTransactions: { increment: 1 },
                ...(paymentMethod === 'cash'
                    ? { cashSales: { increment: amount } }
                    : { cardSales: { increment: amount } })
            }
        });
        if (result.count !== 1)
            return null;
        return database.cashRegister.findUnique({ where: { id: open.id } });
    }
}
exports.CashRegistersController = CashRegistersController;

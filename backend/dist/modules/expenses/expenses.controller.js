"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpensesController = void 0;
const prisma_1 = require("../../config/prisma");
const error_middleware_1 = require("../../middlewares/error.middleware");
const db = prisma_1.prisma;
const MONTO_MAXIMO_SEGURO = Number.MAX_SAFE_INTEGER;
function toNumber(value, fallback = 0) {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function isPositiveInteger(value) {
    const parsed = toNumber(value, 0);
    return Number.isInteger(parsed) && parsed > 0;
}
function obtenerCodigoPrisma(error) {
    return typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : '';
}
function obtenerClaveIdempotencia(req, body) {
    const encabezado = req.headers?.['idempotency-key'];
    return Array.isArray(encabezado)
        ? encabezado[0]
        : encabezado ?? body.idempotencyKey;
}
function coincideConIntencion(gasto, intencion) {
    return ((gasto.concept ?? gasto.description ?? '') === intencion.concept &&
        gasto.amount === intencion.amount &&
        gasto.category === intencion.category &&
        (gasto.notes ?? null) === intencion.notes &&
        gasto.paidFromCashRegister === intencion.paidFromCashRegister &&
        (!intencion.timestampSolicitado ||
            gasto.timestamp.getTime() === intencion.timestampSolicitado.getTime()));
}
class ExpensesController {
    static async list(req, res, next) {
        try {
            const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : null;
            const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : null;
            const where = {};
            if (startDate && endDate) {
                where.timestamp = {
                    gte: startDate,
                    lte: endDate
                };
            }
            const rows = await db.expense.findMany({
                where,
                orderBy: { timestamp: 'desc' }
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
        const body = (req.body || {});
        const amount = toNumber(body.amount, Number.NaN);
        const category = String(body.category || '').trim();
        const concept = String(body.concept || body.description || '').trim();
        const notes = body.notes == null ? null : String(body.notes);
        const paidFromCashRegister = body.paidFromCashRegister === true;
        const valorClave = obtenerClaveIdempotencia(req, body);
        const idempotencyKey = typeof valorClave === 'string' ? valorClave.trim() : null;
        const timestampSolicitado = body.timestamp == null
            ? null
            : new Date(String(body.timestamp));
        if (!concept ||
            !category ||
            !Number.isFinite(amount) ||
            amount <= 0 ||
            amount > MONTO_MAXIMO_SEGURO) {
            return res.status(400).json({ error: 'concept, category and amount>0 are required' });
        }
        if (valorClave != null && (!idempotencyKey || idempotencyKey.length > 191)) {
            return res.status(400).json({ error: 'Invalid idempotency key' });
        }
        if (timestampSolicitado && Number.isNaN(timestampSolicitado.getTime())) {
            return res.status(400).json({ error: 'Invalid expense timestamp' });
        }
        const intencion = {
            concept,
            amount,
            category,
            notes,
            paidFromCashRegister,
            timestampSolicitado,
        };
        try {
            const resultado = await db.$transaction(async (tx) => {
                if (idempotencyKey) {
                    const existente = await tx.expense.findUnique({
                        where: { idempotencyKey },
                    });
                    if (existente) {
                        if (!coincideConIntencion(existente, intencion)) {
                            throw new error_middleware_1.ApplicationError(409, 'Idempotency key reused with different expense data', 'La clave de operación ya pertenece a otro gasto');
                        }
                        return { gasto: existente, reutilizado: true };
                    }
                }
                let cashRegisterId = null;
                if (paidFromCashRegister) {
                    const openRegister = await tx.cashRegister.findFirst({
                        where: { status: 'open' },
                        orderBy: { openedAt: 'desc' }
                    });
                    if (!openRegister) {
                        throw new error_middleware_1.ApplicationError(400, 'No open cash register for expense', 'No hay caja abierta para descontar este gasto');
                    }
                    cashRegisterId = toNumber(openRegister.id, 0);
                }
                if (paidFromCashRegister && cashRegisterId) {
                    const cajaActualizada = await tx.cashRegister.updateMany({
                        where: { id: cashRegisterId, status: 'open' },
                        data: { expenses: { increment: amount } },
                    });
                    if (cajaActualizada.count !== 1) {
                        throw new error_middleware_1.ApplicationError(409, 'Cash register closed while recording expense', 'La caja se cerró antes de registrar el gasto');
                    }
                }
                const gasto = await tx.expense.create({
                    data: {
                        idempotencyKey,
                        concept,
                        description: concept,
                        amount,
                        category,
                        timestamp: timestampSolicitado ?? new Date(),
                        userId: body.userId == null ? null : toNumber(body.userId, 0),
                        userName: body.userName == null ? null : String(body.userName),
                        notes,
                        cashRegisterId,
                        paidFromCashRegister
                    }
                });
                return { gasto, reutilizado: false };
            });
            return res.status(resultado.reutilizado ? 200 : 201).json(resultado.gasto);
        }
        catch (error) {
            if (idempotencyKey && obtenerCodigoPrisma(error) === 'P2002') {
                const existente = await db.expense.findUnique({
                    where: { idempotencyKey },
                });
                if (existente && coincideConIntencion(existente, intencion)) {
                    return res.status(200).json(existente);
                }
                return res.status(409).json({
                    error: 'La clave de operación ya pertenece a otro gasto',
                });
            }
            if (error instanceof error_middleware_1.ApplicationError) {
                return res.status(error.statusCode).json({ error: error.publicMessage });
            }
            if (next)
                next(error);
            else
                throw error;
        }
    }
    static async remove(req, res, next) {
        try {
            const id = toNumber(req.params.id, 0);
            if (!isPositiveInteger(req.params.id)) {
                return res.status(400).json({ error: 'Invalid expense id' });
            }
            const deleted = await db.$transaction(async (tx) => {
                const expense = await tx.expense.findUnique({ where: { id } });
                if (!expense)
                    return null;
                const eliminacion = await tx.expense.deleteMany({ where: { id } });
                if (eliminacion.count !== 1)
                    return null;
                if (expense.paidFromCashRegister && expense.cashRegisterId) {
                    const amount = toNumber(expense.amount);
                    await tx.$executeRaw `
            UPDATE \`CashRegister\`
            SET
              \`expectedAmount\` = IF(
                \`status\` = 'closed',
                \`openingAmount\` + \`cashSales\` - GREATEST(0, \`expenses\` - ${amount}),
                \`expectedAmount\`
              ),
              \`difference\` = IF(
                \`status\` = 'closed' AND \`closingAmount\` IS NOT NULL,
                \`closingAmount\` - (\`openingAmount\` + \`cashSales\` - GREATEST(0, \`expenses\` - ${amount})),
                \`difference\`
              ),
              \`expenses\` = GREATEST(0, \`expenses\` - ${amount})
            WHERE \`id\` = ${expense.cashRegisterId}
          `;
                }
                return expense;
            });
            if (!deleted) {
                return res.status(404).json({ error: 'Gasto no encontrado' });
            }
            res.json(deleted);
        }
        catch (error) {
            if (next)
                next(error);
            else
                throw error;
        }
    }
}
exports.ExpensesController = ExpensesController;

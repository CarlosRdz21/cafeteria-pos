"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpensesController = void 0;
const prisma_1 = require("../prisma");
const db = prisma_1.prisma;
function toNumber(value, fallback = 0) {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
class ExpensesController {
    static async list(req, res) {
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
            res.status(500).json({ error: error?.message || 'Error listing expenses' });
        }
    }
    static async create(req, res) {
        try {
            const body = req.body || {};
            const amount = toNumber(body.amount, -1);
            const category = String(body.category || '').trim();
            const concept = String(body.concept || body.description || '').trim();
            if (!concept || amount <= 0 || !category) {
                return res.status(400).json({ error: 'concept, category and amount>0 are required' });
            }
            const max = await db.expense.aggregate({ _max: { id: true } });
            const created = await db.expense.create({
                data: {
                    id: Number(max?._max?.id || 0) + 1,
                    concept,
                    description: concept,
                    amount,
                    category,
                    timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
                    userId: body.userId == null ? null : toNumber(body.userId, 0),
                    userName: body.userName == null ? null : String(body.userName),
                    notes: body.notes == null ? null : String(body.notes),
                    cashRegisterId: body.cashRegisterId == null ? null : toNumber(body.cashRegisterId, 0)
                }
            });
            if (created.cashRegisterId) {
                const register = await db.cashRegister.findUnique({ where: { id: created.cashRegisterId } });
                if (register) {
                    await db.cashRegister.update({
                        where: { id: register.id },
                        data: {
                            expenses: toNumber(register.expenses, 0) + created.amount
                        }
                    });
                }
            }
            res.status(201).json(created);
        }
        catch (error) {
            res.status(500).json({ error: error?.message || 'Error creating expense' });
        }
    }
}
exports.ExpensesController = ExpensesController;

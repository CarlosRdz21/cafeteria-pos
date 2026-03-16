"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const prisma_1 = require("../prisma");
class PaymentService {
    static async registerPayment(orderId, method, amountPaid, details) {
        // 🔎 Obtener la orden para conocer el total
        const db = prisma_1.prisma;
        const order = await db.order.findUnique({
            where: { id: orderId }
        });
        if (!order) {
            throw new Error('Orden no encontrada');
        }
        const payment = await db.payment.create({
            data: {
                orderId,
                method,
                // 💡 SI es tarjeta → usar el total de la orden
                amount: order.total,
                provider: details?.provider || null,
                reference: details?.reference || null,
                metadata: details?.metadata ?? null
            }
        });
        // 🔄 Marcar orden como completada
        await db.order.update({
            where: { id: orderId },
            data: {
                status: 'completed'
            }
        });
        return payment;
    }
    static async getPaymentsByDateRange(start, end) {
        const db = prisma_1.prisma;
        return db.payment.findMany({
            where: {
                paidAt: {
                    gte: start,
                    lte: end
                }
            },
            include: {
                order: {
                    include: { items: true }
                }
            },
            orderBy: { paidAt: 'desc' }
        });
    }
}
exports.PaymentService = PaymentService;

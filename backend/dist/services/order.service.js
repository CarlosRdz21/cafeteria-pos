"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderService = void 0;
const prisma_1 = require("../prisma");
class OrderService {
    static async createOrder(data) {
        console.log('📦 BODY ORDER:', data);
        return prisma_1.prisma.order.create({
            data: {
                status: data.status ?? 'pending',
                subtotal: data.subtotal,
                tax: data.tax,
                total: data.total,
                tableNumber: data.tableNumber,
                customerName: data.customerName,
                notes: data.notes,
                items: {
                    create: data.items.map((item) => ({
                        productId: item.productId,
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity,
                        subtotal: item.price * item.quantity
                    }))
                }
            },
            include: { items: true }
        });
    }
    // 🔹 Obtener órdenes por estado
    static async getOrdersByStatus(status) {
        return prisma_1.prisma.order.findMany({
            where: { status },
            include: { items: true },
            orderBy: { createdAt: 'desc' }
        });
    }
    // 🔹 Actualizar estado de una orden
    static async updateOrderStatus(orderId, status) {
        const allowedStatuses = [
            'pending',
            'preparing',
            'ready',
            'delivered',
            'cancelled'
        ];
        if (!allowedStatuses.includes(status)) {
            throw new Error('Invalid order status');
        }
        return prisma_1.prisma.order.update({
            where: { id: orderId },
            data: { status },
            include: { items: true }
        });
    }
    // 🔹 Obtener una orden por ID (opcional pero recomendable)
    static async getOrderById(orderId) {
        return prisma_1.prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true }
        });
    }
}
exports.OrderService = OrderService;

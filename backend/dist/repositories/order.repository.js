"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderRepository = void 0;
const prisma_1 = require("../prisma");
class OrderRepository {
    static async create(data) {
        return prisma_1.prisma.order.create({
            data: {
                status: data.status,
                subtotal: data.subtotal,
                tax: data.tax,
                total: data.total,
                tableNumber: data.tableNumber,
                customerName: data.customerName,
                notes: data.notes,
                items: {
                    create: data.items.map((item) => ({
                        productId: item.productId,
                        name: item.productName,
                        price: item.price,
                        quantity: item.quantity,
                        subtotal: item.price * item.quantity
                    }))
                }
            },
            include: { items: true }
        });
    }
    static async getOrdersByStatus(status) {
        return prisma_1.prisma.order.findMany({
            where: { status },
            include: { items: true },
            orderBy: { createdAt: 'asc' }
        });
    }
    static async updateStatus(orderId, status) {
        return prisma_1.prisma.order.update({
            where: { id: orderId },
            data: { status }
        });
    }
    static async getOrderById(orderId) {
        return prisma_1.prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true }
        });
    }
}
exports.OrderRepository = OrderRepository;

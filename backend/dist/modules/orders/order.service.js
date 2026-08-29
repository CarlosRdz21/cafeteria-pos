"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderService = void 0;
const prisma_1 = require("../../config/prisma");
class OrderService {
    static async crearPedido(datosPedido) {
        return prisma_1.prisma.order.create({
            data: {
                status: datosPedido.status ?? 'pending',
                subtotal: datosPedido.subtotal,
                tax: datosPedido.tax,
                total: datosPedido.total,
                tableNumber: datosPedido.tableNumber,
                customerName: datosPedido.customerName,
                notes: datosPedido.notes,
                items: {
                    create: datosPedido.items.map(producto => ({
                        productId: producto.productId,
                        name: producto.name,
                        price: producto.price,
                        quantity: producto.quantity,
                        subtotal: producto.price * producto.quantity
                    }))
                }
            },
            include: { items: true }
        });
    }
    static async obtenerPedidosPorEstado(estado) {
        return prisma_1.prisma.order.findMany({
            where: { status: estado },
            include: { items: true },
            orderBy: { createdAt: 'desc' }
        });
    }
    static async actualizarEstadoPedido(idPedido, estado) {
        const estadosPermitidos = [
            'pending',
            'preparing',
            'ready',
            'delivered',
            'cancelled'
        ];
        if (!estadosPermitidos.includes(estado)) {
            throw new Error('Invalid order status');
        }
        return prisma_1.prisma.order.update({
            where: { id: idPedido },
            data: { status: estado },
            include: { items: true }
        });
    }
    static async obtenerPedidoPorId(idPedido) {
        return prisma_1.prisma.order.findUnique({
            where: { id: idPedido },
            include: { items: true }
        });
    }
}
exports.OrderService = OrderService;

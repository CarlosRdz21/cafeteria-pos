"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderController = void 0;
const order_service_1 = require("../services/order.service");
const socket_1 = require("../socket");
const prisma_1 = require("../prisma");
const payment_service_1 = require("../services/payment.service");
const cash_registers_controller_1 = require("./cash-registers.controller");
class OrderController {
    static async create(req, res) {
        try {
            const { items, status, paymentMethod, amountPaid, paymentDetails, discountTotal, appliedPromotions, tableNumber, customerName, notes } = req.body;
            if (!items || items.length === 0) {
                return res.status(400).json({ error: 'La orden está vacía' });
            }
            const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const tax = 0;
            const total = subtotal + tax;
            const order = await prisma_1.prisma.order.create({
                data: {
                    subtotal,
                    tax,
                    total,
                    discountTotal: Number(discountTotal || 0),
                    appliedPromotions: appliedPromotions ?? null,
                    status: status ?? 'pending',
                    tableNumber,
                    customerName,
                    notes,
                    items: {
                        create: items.map((item) => ({
                            productId: item.productId,
                            name: item.name,
                            quantity: item.quantity,
                            price: item.price,
                            subtotal: item.subtotal
                        }))
                    }
                },
                include: {
                    items: true
                }
            });
            // Si la orden ya estÃ¡ completada, registrar el pago para que aparezca en reportes
            if ((status ?? 'pending') === 'completed') {
                if (!paymentMethod) {
                    return res.status(400).json({ error: 'Payment method required' });
                }
                if (paymentMethod === 'cash' && (amountPaid === undefined || amountPaid === null)) {
                    return res.status(400).json({ error: 'amountPaid required for cash payments' });
                }
                await payment_service_1.PaymentService.registerPayment(order.id, paymentMethod, paymentMethod === 'cash' ? amountPaid : undefined, paymentDetails);
                await cash_registers_controller_1.CashRegistersController.applySaleToOpenRegister(paymentMethod, total);
            }
            res.status(201).json(order);
        }
        catch (error) {
            console.error('❌ Error creating order:', error);
            res.status(500).json({ error: error.message });
        }
    }
    static async list(req, res) {
        try {
            const status = req.query.status;
            if (!status) {
                return res.status(400).json({ error: 'Status is required' });
            }
            const orders = await order_service_1.OrderService.getOrdersByStatus(status);
            res.json(orders);
        }
        catch (error) {
            console.error('❌ Error listing orders:', error);
            res.status(500).json({ error: 'Failed to list orders' });
        }
    }
    static async updateStatus(req, res) {
        try {
            const orderId = Number(req.params.id);
            const { status, paymentMethod, amountPaid, items, paymentDetails, discountTotal, appliedPromotions } = req.body;
            if (!orderId || !status) {
                return res.status(400).json({ error: 'Order ID and status are required' });
            }
            const existingOrder = await prisma_1.prisma.order.findUnique({ where: { id: orderId } });
            if (!existingOrder) {
                return res.status(404).json({ error: 'Orden no encontrada' });
            }
            if (status === 'completed') {
                let effectiveTotal = existingOrder.total;
                if (Array.isArray(items) && items.length > 0) {
                    const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
                    const tax = 0;
                    effectiveTotal = subtotal + tax;
                    await prisma_1.prisma.order.update({
                        where: { id: orderId },
                        data: {
                            subtotal,
                            tax,
                            total: effectiveTotal,
                            discountTotal: Number(discountTotal || 0),
                            appliedPromotions: appliedPromotions ?? null,
                            items: {
                                deleteMany: {},
                                create: items.map((item) => ({
                                    productId: item.productId,
                                    name: item.name,
                                    quantity: item.quantity,
                                    price: item.price,
                                    subtotal: Number(item.price || 0) * Number(item.quantity || 0)
                                }))
                            }
                        }
                    });
                }
                if (!paymentMethod) {
                    return res.status(400).json({ error: 'Payment method required' });
                }
                // 💳 Tarjeta NO requiere amountPaid
                if (paymentMethod === 'cash' && (amountPaid === undefined || amountPaid === null)) {
                    return res.status(400).json({ error: 'amountPaid required for cash payments' });
                }
                await payment_service_1.PaymentService.registerPayment(orderId, paymentMethod, paymentMethod === 'cash' ? amountPaid : undefined, paymentDetails);
                if (existingOrder.status !== 'completed') {
                    await cash_registers_controller_1.CashRegistersController.applySaleToOpenRegister(paymentMethod, effectiveTotal);
                }
            }
            else {
                if (status === 'pending' && Array.isArray(items) && items.length > 0) {
                    const pendingOrder = await prisma_1.prisma.order.findUnique({
                        where: { id: orderId },
                        include: { items: true }
                    });
                    if (!pendingOrder) {
                        return res.status(404).json({ error: 'Orden no encontrada' });
                    }
                    const mergedItemsMap = new Map();
                    for (const item of pendingOrder.items) {
                        mergedItemsMap.set(item.productId, {
                            productId: item.productId,
                            name: item.name,
                            quantity: item.quantity,
                            price: item.price,
                            subtotal: item.subtotal
                        });
                    }
                    for (const item of items) {
                        const existing = mergedItemsMap.get(item.productId);
                        if (existing) {
                            existing.quantity += item.quantity;
                            existing.subtotal = existing.price * existing.quantity;
                        }
                        else {
                            mergedItemsMap.set(item.productId, {
                                productId: item.productId,
                                name: item.name,
                                quantity: item.quantity,
                                price: item.price,
                                subtotal: item.price * item.quantity
                            });
                        }
                    }
                    const mergedItems = Array.from(mergedItemsMap.values());
                    const subtotal = mergedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
                    const tax = 0;
                    const total = subtotal + tax;
                    await prisma_1.prisma.order.update({
                        where: { id: orderId },
                        data: {
                            status,
                            subtotal,
                            tax,
                            total,
                            items: {
                                deleteMany: {},
                                create: mergedItems.map((item) => ({
                                    productId: item.productId,
                                    name: item.name,
                                    quantity: item.quantity,
                                    price: item.price,
                                    subtotal: item.price * item.quantity
                                }))
                            }
                        }
                    });
                }
                else {
                    await prisma_1.prisma.order.update({
                        where: { id: orderId },
                        data: { status }
                    });
                }
            }
            res.json({ success: true });
        }
        catch (error) {
            console.error('❌ Error updating order:', error);
            res.status(500).json({ error: error.message });
        }
    }
    static async cancel(req, res) {
        try {
            const orderId = Number(req.params.id);
            if (!orderId) {
                return res.status(400).json({ error: 'Invalid order id' });
            }
            const order = await prisma_1.prisma.order.update({
                where: { id: orderId },
                data: { status: 'cancelled' }
            });
            // 🔔 Notificar por socket
            const io = (0, socket_1.getIO)();
            io.to('waiters').emit('order-updated', order);
            io.to('admins').emit('order-updated', order);
            res.json(order);
        }
        catch (error) {
            console.error('❌ Error cancelling order:', error);
            res.status(500).json({ error: 'Error cancelling order' });
        }
    }
    static async getById(req, res) {
        try {
            const orderId = Number(req.params.id);
            const order = await prisma_1.prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    items: true
                }
            });
            if (!order) {
                return res.status(404).json({ error: 'Orden no encontrada' });
            }
            res.json(order);
        }
        catch (error) {
            console.error('❌ Error getting order:', error);
            res.status(500).json({ error: error.message });
        }
    }
}
exports.OrderController = OrderController;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderController = void 0;
const order_service_1 = require("../services/order.service");
const socket_1 = require("../socket");
const prisma_1 = require("../prisma");
const payment_service_1 = require("../services/payment.service");
const cash_registers_controller_1 = require("./cash-registers.controller");
class OrderController {
    static getPendingItemMergeKey(item) {
        const productId = Number(item.productId || 0);
        const name = String(item.name || '').trim();
        const price = Number(item.price || 0).toFixed(2);
        return `${productId}::${name}::${price}`;
    }
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
            if ((status ?? 'pending') === 'pending') {
                const io = (0, socket_1.getIO)();
                io.to('baristas').emit('new-order', order);
                io.to('admins').emit('new-order', order);
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
                        mergedItemsMap.set(OrderController.getPendingItemMergeKey(item), {
                            productId: item.productId,
                            name: item.name,
                            quantity: item.quantity,
                            price: item.price,
                            subtotal: item.subtotal
                        });
                    }
                    for (const item of items) {
                        const mergeKey = OrderController.getPendingItemMergeKey(item);
                        const existing = mergedItemsMap.get(mergeKey);
                        if (existing) {
                            existing.quantity += item.quantity;
                            existing.subtotal = existing.price * existing.quantity;
                        }
                        else {
                            mergedItemsMap.set(mergeKey, {
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
            const updatedOrder = await prisma_1.prisma.order.findUnique({
                where: { id: orderId },
                include: { items: true }
            });
            if (!updatedOrder) {
                return res.status(404).json({ error: 'Orden no encontrada' });
            }
            const io = (0, socket_1.getIO)();
            io.to('waiters').emit('order-updated', updatedOrder);
            io.to('baristas').emit('order-updated', updatedOrder);
            io.to('admins').emit('order-updated', updatedOrder);
            res.json(updatedOrder);
        }
        catch (error) {
            console.error('❌ Error updating order:', error);
            res.status(500).json({ error: error.message });
        }
    }
    static async replacePendingOrder(req, res) {
        try {
            const orderId = Number(req.params.id);
            const items = Array.isArray(req.body?.items) ? req.body.items : [];
            if (!orderId) {
                return res.status(400).json({ error: 'Invalid order id' });
            }
            if (items.length === 0) {
                return res.status(400).json({ error: 'La orden debe tener al menos un producto' });
            }
            const existingOrder = await prisma_1.prisma.order.findUnique({
                where: { id: orderId },
                include: { items: true }
            });
            if (!existingOrder) {
                return res.status(404).json({ error: 'Orden no encontrada' });
            }
            if (existingOrder.status !== 'pending') {
                return res.status(400).json({ error: 'Solo se pueden editar comandas pendientes' });
            }
            const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
            const tax = 0;
            const total = subtotal + tax;
            const updatedOrder = await prisma_1.prisma.order.update({
                where: { id: orderId },
                data: {
                    subtotal,
                    tax,
                    total,
                    items: {
                        deleteMany: {},
                        create: items.map((item) => ({
                            productId: item.productId,
                            name: item.name,
                            quantity: Number(item.quantity || 0),
                            price: Number(item.price || 0),
                            subtotal: Number(item.price || 0) * Number(item.quantity || 0)
                        }))
                    }
                },
                include: {
                    items: true
                }
            });
            const io = (0, socket_1.getIO)();
            io.to('waiters').emit('order-updated', updatedOrder);
            io.to('admins').emit('order-updated', updatedOrder);
            res.json(updatedOrder);
        }
        catch (error) {
            console.error('❌ Error replacing pending order items:', error);
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
            io.to('baristas').emit('order-cancelled', order.id);
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

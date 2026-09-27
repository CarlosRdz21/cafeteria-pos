"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderController = void 0;
const order_service_1 = require("./order.service");
const socket_1 = require("../../sockets/socket");
const prisma_1 = require("../../config/prisma");
const payment_service_1 = require("../payments/payment.service");
const cash_registers_controller_1 = require("../cash/cash-registers.controller");
const socket_constants_1 = require("../../sockets/socket.constants");
const order_utils_1 = require("./order.utils");
const error_middleware_1 = require("../../middlewares/error.middleware");
class OrderController {
    static async create(req, res, next) {
        try {
            const { items, status, paymentMethod, amountPaid, paymentDetails, discountTotal, appliedPromotions, tableNumber, customerName, notes } = req.body;
            if (!items || items.length === 0) {
                return res.status(400).json({ error: 'La orden está vacía' });
            }
            const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const tax = 0;
            const total = subtotal + tax;
            const requestedStatus = status ?? 'pending';
            if (requestedStatus === 'completed' && !paymentMethod) {
                return res.status(400).json({ error: 'Payment method required' });
            }
            if (requestedStatus === 'completed' && paymentMethod === 'cash' && (amountPaid === undefined || amountPaid === null)) {
                return res.status(400).json({ error: 'amountPaid required for cash payments' });
            }
            const order = await prisma_1.prisma.$transaction(async (tx) => {
                const createdOrder = await tx.order.create({
                    data: {
                        subtotal,
                        tax,
                        total,
                        discountTotal: Number(discountTotal || 0),
                        appliedPromotions: appliedPromotions ?? null,
                        status: requestedStatus,
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
                if (requestedStatus === 'completed') {
                    await payment_service_1.PaymentService.registerPayment(createdOrder.id, paymentMethod, paymentMethod === 'cash' ? amountPaid : undefined, paymentDetails, tx);
                    const cajaActualizada = await cash_registers_controller_1.CashRegistersController.applySaleToOpenRegister(paymentMethod, total, tx);
                    if (!cajaActualizada) {
                        throw new error_middleware_1.ApplicationError(409, 'No open cash register for sale', 'No hay caja abierta');
                    }
                }
                return createdOrder;
            });
            if (requestedStatus === 'pending') {
                const io = (0, socket_1.getIO)();
                io.to(socket_constants_1.SOCKET_ROOMS.baristas).emit(socket_constants_1.SOCKET_EVENTS.newOrder, order);
                io.to(socket_constants_1.SOCKET_ROOMS.admins).emit(socket_constants_1.SOCKET_EVENTS.newOrder, order);
            }
            res.status(201).json(order);
        }
        catch (error) {
            if (next)
                next(error);
            else
                throw error;
        }
    }
    static async list(req, res, next) {
        try {
            const status = req.query.status;
            if (!status) {
                return res.status(400).json({ error: 'Status is required' });
            }
            const orders = await order_service_1.OrderService.obtenerPedidosPorEstado(status);
            res.json(orders);
        }
        catch (error) {
            if (next)
                next(error);
            else
                throw error;
        }
    }
    static async updateStatus(req, res, next) {
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
            if (existingOrder.status === 'completed' && status !== 'completed') {
                throw new error_middleware_1.ApplicationError(409, 'Completed orders cannot transition to another status', 'Una orden completada y pagada no puede volver a pendiente ni cambiar de estado');
            }
            let emitirActualizacion = true;
            if (status === 'completed') {
                if (existingOrder.status === 'completed') {
                    const completedOrder = await prisma_1.prisma.order.findUnique({
                        where: { id: orderId },
                        include: { items: true }
                    });
                    return res.json(completedOrder);
                }
                if (existingOrder.status !== 'pending') {
                    throw new error_middleware_1.ApplicationError(409, 'Only pending orders can be completed', 'Sólo una orden pendiente puede completarse');
                }
                if (!paymentMethod) {
                    return res.status(400).json({ error: 'Payment method required' });
                }
                // 💳 Tarjeta NO requiere amountPaid
                if (paymentMethod === 'cash' && (amountPaid === undefined || amountPaid === null)) {
                    return res.status(400).json({ error: 'amountPaid required for cash payments' });
                }
                emitirActualizacion = await prisma_1.prisma.$transaction(async (tx) => {
                    const reclamo = await tx.order.updateMany({
                        where: {
                            id: orderId,
                            status: 'pending'
                        },
                        data: { status: 'completed' }
                    });
                    if (reclamo.count !== 1)
                        return false;
                    let effectiveTotal = existingOrder.total;
                    if (Array.isArray(items) && items.length > 0) {
                        const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
                        const tax = 0;
                        effectiveTotal = subtotal + tax;
                        await tx.order.update({
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
                    await payment_service_1.PaymentService.registerPayment(orderId, paymentMethod, paymentMethod === 'cash' ? amountPaid : undefined, paymentDetails, tx);
                    const cajaActualizada = await cash_registers_controller_1.CashRegistersController.applySaleToOpenRegister(paymentMethod, effectiveTotal, tx);
                    if (!cajaActualizada) {
                        throw new error_middleware_1.ApplicationError(409, 'No open cash register for sale', 'No hay caja abierta');
                    }
                    return true;
                });
            }
            else {
                if (status === 'pending' && Array.isArray(items) && items.length > 0) {
                    await prisma_1.prisma.$transaction(async (tx) => {
                        const pendingOrder = await tx.order.findUnique({
                            where: { id: orderId },
                            include: { items: true }
                        });
                        if (!pendingOrder) {
                            throw new error_middleware_1.ApplicationError(404, 'Order not found', 'Orden no encontrada');
                        }
                        const claim = await tx.order.updateMany({
                            where: { id: orderId, status: 'pending' },
                            data: { status: 'pending' }
                        });
                        if (claim.count !== 1) {
                            throw new error_middleware_1.ApplicationError(409, 'Only pending orders can be edited', 'La orden ya no está pendiente y no puede modificarse');
                        }
                        const mergedItemsMap = new Map();
                        for (const item of pendingOrder.items) {
                            mergedItemsMap.set((0, order_utils_1.generarClaveFusionProductoPendiente)(item), {
                                productId: item.productId,
                                name: item.name,
                                quantity: item.quantity,
                                price: item.price,
                                subtotal: item.subtotal
                            });
                        }
                        for (const item of items) {
                            const mergeKey = (0, order_utils_1.generarClaveFusionProductoPendiente)(item);
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
                        await tx.order.update({
                            where: { id: orderId },
                            data: {
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
            if (emitirActualizacion) {
                const io = (0, socket_1.getIO)();
                io.to(socket_constants_1.SOCKET_ROOMS.waiters).emit(socket_constants_1.SOCKET_EVENTS.orderUpdated, updatedOrder);
                io.to(socket_constants_1.SOCKET_ROOMS.baristas).emit(socket_constants_1.SOCKET_EVENTS.orderUpdated, updatedOrder);
                io.to(socket_constants_1.SOCKET_ROOMS.admins).emit(socket_constants_1.SOCKET_EVENTS.orderUpdated, updatedOrder);
            }
            res.json(updatedOrder);
        }
        catch (error) {
            if (next)
                next(error);
            else
                throw error;
        }
    }
    static async replacePendingOrder(req, res, next) {
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
            const updatedOrder = await prisma_1.prisma.$transaction(async (tx) => {
                const claim = await tx.order.updateMany({
                    where: { id: orderId, status: 'pending' },
                    data: { status: 'pending' }
                });
                if (claim.count !== 1) {
                    throw new error_middleware_1.ApplicationError(409, 'Only pending orders can be edited', 'La orden ya no está pendiente y no puede modificarse');
                }
                return tx.order.update({
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
            });
            const io = (0, socket_1.getIO)();
            io.to(socket_constants_1.SOCKET_ROOMS.waiters).emit(socket_constants_1.SOCKET_EVENTS.orderUpdated, updatedOrder);
            io.to(socket_constants_1.SOCKET_ROOMS.admins).emit(socket_constants_1.SOCKET_EVENTS.orderUpdated, updatedOrder);
            res.json(updatedOrder);
        }
        catch (error) {
            if (next)
                next(error);
            else
                throw error;
        }
    }
    static async cancel(req, res, next) {
        try {
            const orderId = Number(req.params.id);
            if (!orderId) {
                return res.status(400).json({ error: 'Invalid order id' });
            }
            const order = await prisma_1.prisma.$transaction(async (tx) => {
                const claim = await tx.order.updateMany({
                    where: { id: orderId, status: 'pending' },
                    data: { status: 'cancelled' }
                });
                if (claim.count !== 1) {
                    throw new error_middleware_1.ApplicationError(409, 'Only pending orders can be cancelled', 'Sólo una orden pendiente puede cancelarse');
                }
                return tx.order.findUniqueOrThrow({ where: { id: orderId } });
            });
            // 🔔 Notificar por socket
            const io = (0, socket_1.getIO)();
            io.to(socket_constants_1.SOCKET_ROOMS.baristas).emit(socket_constants_1.SOCKET_EVENTS.orderCancelled, order.id);
            io.to(socket_constants_1.SOCKET_ROOMS.waiters).emit(socket_constants_1.SOCKET_EVENTS.orderUpdated, order);
            io.to(socket_constants_1.SOCKET_ROOMS.admins).emit(socket_constants_1.SOCKET_EVENTS.orderUpdated, order);
            res.json(order);
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
            const orderId = Number(req.params.id);
            if (!orderId) {
                return res.status(400).json({ error: 'Invalid order id' });
            }
            const deletedOrder = await prisma_1.prisma.$transaction(async (tx) => {
                const order = await tx.order.findUnique({
                    where: { id: orderId },
                    include: {
                        items: true,
                        payments: {
                            orderBy: { paidAt: 'asc' }
                        }
                    }
                });
                if (!order) {
                    return null;
                }
                const payment = order.payments[0];
                const paymentMethod = (payment?.method || order.paymentMethod);
                const saleAmount = Number(order.total || payment?.amount || 0);
                const paidAt = payment?.paidAt || order.createdAt;
                if (order.status === 'completed' && paymentMethod && saleAmount > 0) {
                    const openRegister = await tx.cashRegister.findFirst({
                        where: {
                            status: 'open',
                            openedAt: { lte: paidAt }
                        },
                        orderBy: { openedAt: 'desc' }
                    });
                    if (openRegister) {
                        await tx.cashRegister.update({
                            where: { id: openRegister.id },
                            data: {
                                totalTransactions: Math.max(0, Number(openRegister.totalTransactions || 0) - 1),
                                ...(paymentMethod === 'cash'
                                    ? { cashSales: Math.max(0, Number(openRegister.cashSales || 0) - saleAmount) }
                                    : { cardSales: Math.max(0, Number(openRegister.cardSales || 0) - saleAmount) })
                            }
                        });
                    }
                }
                await tx.order.delete({ where: { id: orderId } });
                return order;
            });
            if (!deletedOrder) {
                return res.status(404).json({ error: 'Orden no encontrada' });
            }
            const io = (0, socket_1.getIO)();
            io.to(socket_constants_1.SOCKET_ROOMS.baristas).emit(socket_constants_1.SOCKET_EVENTS.orderCancelled, deletedOrder.id);
            io.to(socket_constants_1.SOCKET_ROOMS.waiters).emit(socket_constants_1.SOCKET_EVENTS.orderUpdated, { ...deletedOrder, status: 'deleted' });
            io.to(socket_constants_1.SOCKET_ROOMS.admins).emit(socket_constants_1.SOCKET_EVENTS.orderUpdated, { ...deletedOrder, status: 'deleted' });
            res.json(deletedOrder);
        }
        catch (error) {
            if (next)
                next(error);
            else
                throw error;
        }
    }
    static async getById(req, res, next) {
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
            if (next)
                next(error);
            else
                throw error;
        }
    }
}
exports.OrderController = OrderController;

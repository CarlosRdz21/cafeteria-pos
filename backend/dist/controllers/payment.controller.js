"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentController = void 0;
const payment_service_1 = require("../services/payment.service");
const mercado_pago_checkout_service_1 = require("../services/mercado-pago-checkout.service");
class PaymentController {
    static async create(req, res) {
        try {
            const { orderId, method, amount, paymentDetails } = req.body;
            if (!orderId || !method || (method === 'cash' && !amount)) {
                return res.status(400).json({ error: 'Datos incompletos' });
            }
            const payment = await payment_service_1.PaymentService.registerPayment(orderId, method, amount, paymentDetails);
            res.status(201).json(payment);
        }
        catch (error) {
            console.error('❌ Error creating payment:', error);
            res.status(500).json({ error: error.message });
        }
    }
    static async listByDate(req, res) {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Fechas requeridas' });
        }
        const payments = await payment_service_1.PaymentService.getPaymentsByDateRange(new Date(startDate), new Date(endDate));
        res.json(payments);
    }
    static async createMercadoPagoPreference(req, res) {
        try {
            const { items, externalReference, payerEmail, metadata } = req.body || {};
            if (!Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ error: 'items are required' });
            }
            if (!externalReference || String(externalReference).trim().length === 0) {
                return res.status(400).json({ error: 'externalReference is required' });
            }
            const preference = await mercado_pago_checkout_service_1.MercadoPagoCheckoutService.createPreference({
                items: items.map((item) => ({
                    title: String(item?.title || ''),
                    quantity: Number(item?.quantity || 1),
                    unitPrice: Number(item?.unitPrice || 0),
                    currencyId: item?.currencyId ? String(item.currencyId) : 'MXN'
                })),
                externalReference: String(externalReference),
                payerEmail: payerEmail ? String(payerEmail) : undefined,
                metadata: metadata && typeof metadata === 'object' ? metadata : undefined
            });
            return res.status(201).json(preference);
        }
        catch (error) {
            return res.status(500).json({ error: error?.message || 'Error creating Mercado Pago preference' });
        }
    }
    static async verifyMercadoPagoPayment(req, res) {
        try {
            const paymentId = String(req.body?.paymentId || '').trim();
            if (!paymentId) {
                return res.status(400).json({ error: 'paymentId is required' });
            }
            const payment = await mercado_pago_checkout_service_1.MercadoPagoCheckoutService.verifyPayment(paymentId);
            return res.json(payment);
        }
        catch (error) {
            return res.status(500).json({ error: error?.message || 'Error verifying Mercado Pago payment' });
        }
    }
    static async createMercadoPagoPointOrder(req, res) {
        try {
            const totalAmount = Number(req.body?.totalAmount || 0);
            const externalReference = String(req.body?.externalReference || '').trim();
            const description = typeof req.body?.description === 'string' ? req.body.description : undefined;
            if (!externalReference) {
                return res.status(400).json({ error: 'externalReference is required' });
            }
            if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
                return res.status(400).json({ error: 'totalAmount must be greater than 0' });
            }
            const order = await mercado_pago_checkout_service_1.MercadoPagoCheckoutService.createPointOrder({
                externalReference,
                totalAmount,
                description
            });
            return res.status(201).json(order);
        }
        catch (error) {
            const message = error?.message || 'Error creating Mercado Pago Point order';
            const status = this.resolveMercadoPagoErrorStatus(message);
            return res.status(status).json({ error: message });
        }
    }
    static async getMercadoPagoPointOrder(req, res) {
        try {
            const orderId = String(req.params?.id || '').trim();
            if (!orderId) {
                return res.status(400).json({ error: 'order id is required' });
            }
            const order = await mercado_pago_checkout_service_1.MercadoPagoCheckoutService.getPointOrder(orderId);
            return res.json(order);
        }
        catch (error) {
            const message = error?.message || 'Error fetching Mercado Pago Point order';
            const status = this.resolveMercadoPagoErrorStatus(message);
            return res.status(status).json({ error: message });
        }
    }
    static resolveMercadoPagoErrorStatus(message) {
        const normalized = String(message || '').toLowerCase();
        if (normalized.includes('configura mp_point_terminal_id') ||
            normalized.includes('configura mp_point_terminal_serial') ||
            normalized.includes('no se encontro terminal') ||
            normalized.includes('monto') ||
            normalized.includes('terminal')) {
            return 400;
        }
        return 500;
    }
}
exports.PaymentController = PaymentController;

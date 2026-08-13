import { Router } from 'express';
import { PaymentController } from './payment.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validateCreatePayment } from '../../middlewares/validation.middleware';

const router = Router();

router.use(authMiddleware(['admin', 'barista', 'mesero', 'waiter']));

router.post('/', validateCreatePayment, PaymentController.create);
router.post('/mercado-pago/preference', PaymentController.createMercadoPagoPreference);
router.post('/mercado-pago/verify', PaymentController.verifyMercadoPagoPayment);
router.post('/mercado-pago/point/order', authMiddleware(['admin', 'barista']), PaymentController.createMercadoPagoPointOrder);
router.get('/mercado-pago/point/order/:id', authMiddleware(['admin', 'barista']), PaymentController.getMercadoPagoPointOrder);

router.get('/reports', authMiddleware(['admin', 'barista']), PaymentController.listByDate);


export default router;

import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';

const router = Router();

router.post('/', PaymentController.create);
router.post('/mercado-pago/preference', PaymentController.createMercadoPagoPreference);
router.post('/mercado-pago/verify', PaymentController.verifyMercadoPagoPayment);
router.post('/mercado-pago/point/order', PaymentController.createMercadoPagoPointOrder);
router.get('/mercado-pago/point/order/:id', PaymentController.getMercadoPagoPointOrder);

router.get('/reports', PaymentController.listByDate);


export default router;

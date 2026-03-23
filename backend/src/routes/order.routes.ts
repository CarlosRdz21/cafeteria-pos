import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';

const router = Router();

router.post('/', OrderController.create);
router.get('/', OrderController.list);
router.get('/:id', OrderController.getById);
router.put('/:id', OrderController.replacePendingOrder);
router.patch('/:id/status', OrderController.updateStatus);
router.patch('/:id/cancel', OrderController.cancel);

export default router;


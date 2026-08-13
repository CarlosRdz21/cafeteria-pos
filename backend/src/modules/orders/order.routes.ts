import { Router } from 'express';
import { OrderController } from './order.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validateCreateOrder } from '../../middlewares/validation.middleware';

const router = Router();

router.use(authMiddleware(['admin', 'barista', 'mesero', 'waiter']));

router.post('/', validateCreateOrder, OrderController.create);
router.get('/', OrderController.list);
router.get('/:id', OrderController.getById);
router.put('/:id', OrderController.replacePendingOrder);
router.patch('/:id/status', OrderController.updateStatus);
router.patch('/:id/cancel', OrderController.cancel);
router.delete('/:id', authMiddleware(['admin']), OrderController.remove);

export default router;

import { Router } from 'express';
import { PromotionsController } from './promotions.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware());

router.get('/', PromotionsController.list);
router.put('/', authMiddleware(['admin']), PromotionsController.upsert);
router.delete('/:id', authMiddleware(['admin']), PromotionsController.remove);

export default router;

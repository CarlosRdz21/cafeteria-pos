import { Router } from 'express';
import { PromotionsController } from '../controllers/promotions.controller';

const router = Router();

router.get('/', PromotionsController.list);
router.put('/', PromotionsController.upsert);
router.delete('/:id', PromotionsController.remove);

export default router;

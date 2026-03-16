import { Router } from 'express';
import { SupplyMovementsController } from '../controllers/supply-movements.controller';

const router = Router();

router.get('/', SupplyMovementsController.list);
router.post('/entry', SupplyMovementsController.entry);
router.post('/exit', SupplyMovementsController.exit);

export default router;


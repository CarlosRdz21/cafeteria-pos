import { Router } from 'express';
import { SupplyMovementsController } from './supply-movements.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware(['admin', 'barista']));

router.get('/', SupplyMovementsController.list);
router.post('/entry', SupplyMovementsController.entry);
router.post('/exit', SupplyMovementsController.exit);

export default router;

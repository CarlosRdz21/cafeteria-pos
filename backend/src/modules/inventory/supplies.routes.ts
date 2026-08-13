import { Router } from 'express';
import { SuppliesController } from './supplies.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware(['admin']));

router.get('/', SuppliesController.list);
router.post('/', SuppliesController.create);
router.put('/:id', SuppliesController.update);

export default router;

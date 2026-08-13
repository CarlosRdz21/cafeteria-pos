import { Router } from 'express';
import { SupplyCategoriesController } from './supply-categories.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware(['admin']));

router.get('/', SupplyCategoriesController.list);
router.post('/', SupplyCategoriesController.create);

export default router;

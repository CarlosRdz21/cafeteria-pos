import { Router } from 'express';
import { SupplyCategoriesController } from '../controllers/supply-categories.controller';

const router = Router();

router.get('/', SupplyCategoriesController.list);
router.post('/', SupplyCategoriesController.create);

export default router;


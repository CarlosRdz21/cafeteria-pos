import { Router } from 'express';
import { ProductCategoriesController } from '../controllers/product-categories.controller';

const router = Router();

router.get('/', ProductCategoriesController.list);
router.post('/', ProductCategoriesController.create);
router.patch('/:id', ProductCategoriesController.update);
router.delete('/:id', ProductCategoriesController.remove);

export default router;


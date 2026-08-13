import { Router } from 'express';
import { ProductCategoriesController } from './product-categories.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware());

router.get('/', ProductCategoriesController.list);
router.post('/', authMiddleware(['admin']), ProductCategoriesController.create);
router.patch('/:id', authMiddleware(['admin']), ProductCategoriesController.update);
router.delete('/:id', authMiddleware(['admin']), ProductCategoriesController.remove);

export default router;

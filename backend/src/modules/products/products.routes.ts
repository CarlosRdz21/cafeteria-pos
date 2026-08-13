import { Router } from 'express';
import { ProductsController } from './products.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware());

router.get('/', ProductsController.list);
router.post('/', authMiddleware(['admin']), ProductsController.create);
router.put('/:id', authMiddleware(['admin']), ProductsController.update);
router.delete('/:id', authMiddleware(['admin']), ProductsController.remove);

export default router;

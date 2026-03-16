import { Router } from 'express';
import { ProductsController } from '../controllers/products.controller';

const router = Router();

router.get('/', ProductsController.list);
router.post('/', ProductsController.create);
router.put('/:id', ProductsController.update);
router.delete('/:id', ProductsController.remove);

export default router;


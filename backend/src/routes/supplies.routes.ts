import { Router } from 'express';
import { SuppliesController } from '../controllers/supplies.controller';

const router = Router();

router.get('/', SuppliesController.list);
router.post('/', SuppliesController.create);
router.put('/:id', SuppliesController.update);

export default router;


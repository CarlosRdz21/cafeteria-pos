import { Router } from 'express';
import { ExpensesController } from './expenses.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware(['admin', 'barista']));

router.get('/', ExpensesController.list);
router.post('/', ExpensesController.create);
router.delete('/:id', authMiddleware(['admin']), ExpensesController.remove);

export default router;

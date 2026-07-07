import { Router } from 'express';
import { ExpensesController } from '../controllers/expenses.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', ExpensesController.list);
router.post('/', ExpensesController.create);
router.delete('/:id', authMiddleware(['admin']), ExpensesController.remove);

export default router;

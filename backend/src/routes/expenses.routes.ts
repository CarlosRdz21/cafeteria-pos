import { Router } from 'express';
import { ExpensesController } from '../controllers/expenses.controller';

const router = Router();

router.get('/', ExpensesController.list);
router.post('/', ExpensesController.create);

export default router;


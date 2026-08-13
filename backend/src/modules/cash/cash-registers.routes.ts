import { Router } from 'express';
import { CashRegistersController } from './cash-registers.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware(['admin', 'barista']));

router.get('/current', CashRegistersController.current);
router.get('/', CashRegistersController.history);
router.post('/open', CashRegistersController.open);
router.post('/current/close', CashRegistersController.closeCurrent);
router.post('/current/record-sale', CashRegistersController.recordSaleCurrent);
router.post('/current/record-expense', CashRegistersController.recordExpenseCurrent);

export default router;

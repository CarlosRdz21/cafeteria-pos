import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

const router = Router();
router.post('/login', AuthController.login);
router.get('/debug/users', AuthController.debugUsers);
export default router;

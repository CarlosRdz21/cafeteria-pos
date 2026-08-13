import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validateLogin } from '../../middlewares/validation.middleware';
import { loginRateLimiter } from '../../middlewares/security.middleware';

const router = Router();
router.post('/login', loginRateLimiter, validateLogin, AuthController.login);
router.get('/debug/users', authMiddleware(['admin']), AuthController.debugUsers);
export default router;

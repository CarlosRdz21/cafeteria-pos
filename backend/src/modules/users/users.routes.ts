import { Router } from 'express';
import { UsersController } from './users.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validateCreateUser, validateUpdateUser } from '../../middlewares/validation.middleware';

const router = Router();

router.use(authMiddleware(['admin']));

router.get('/', UsersController.list);
router.post('/', validateCreateUser, UsersController.create);
router.put('/:id', validateUpdateUser, UsersController.update);
router.delete('/:id', UsersController.remove);

export default router;

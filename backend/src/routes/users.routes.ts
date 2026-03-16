import { Router } from 'express';
import { UsersController } from '../controllers/users.controller';

const router = Router();

router.get('/', UsersController.list);
router.post('/', UsersController.create);
router.put('/:id', UsersController.update);
router.delete('/:id', UsersController.remove);

export default router;


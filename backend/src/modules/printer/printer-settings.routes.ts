import { Router } from 'express';
import { PrinterSettingsController } from './printer-settings.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware(['admin', 'barista']));

router.get('/', PrinterSettingsController.get);
router.put('/', PrinterSettingsController.upsert);

export default router;

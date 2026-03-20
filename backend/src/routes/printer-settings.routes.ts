import { Router } from 'express';
import { PrinterSettingsController } from '../controllers/printer-settings.controller';

const router = Router();

router.get('/', PrinterSettingsController.get);
router.put('/', PrinterSettingsController.upsert);

export default router;

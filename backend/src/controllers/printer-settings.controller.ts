import { Request, Response } from 'express';
import { prisma } from '../prisma';

const DEFAULT_PRINTER_SETTINGS = {
  id: 1,
  bluetoothName: 'BlueTooth Printer',
  businessName: 'CAFETERIA',
  businessAddress: '',
  businessPhone: '',
  cutPaper: true
};

export class PrinterSettingsController {
  static async get(_req: Request, res: Response) {
    try {
      const settings = await prisma.printerSetting.findUnique({
        where: { id: 1 }
      });

      res.json(settings ?? DEFAULT_PRINTER_SETTINGS);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error loading printer settings' });
    }
  }

  static async upsert(req: Request, res: Response) {
    try {
      const bluetoothName = String(req.body?.bluetoothName || DEFAULT_PRINTER_SETTINGS.bluetoothName).trim() || DEFAULT_PRINTER_SETTINGS.bluetoothName;
      const businessName = String(req.body?.businessName || DEFAULT_PRINTER_SETTINGS.businessName).trim() || DEFAULT_PRINTER_SETTINGS.businessName;
      const businessAddress = String(req.body?.businessAddress || '').trim();
      const businessPhone = String(req.body?.businessPhone || '').trim();
      const cutPaper = req.body?.cutPaper !== false;

      const settings = await prisma.printerSetting.upsert({
        where: { id: 1 },
        update: {
          bluetoothName,
          businessName,
          businessAddress,
          businessPhone,
          cutPaper
        },
        create: {
          id: 1,
          bluetoothName,
          businessName,
          businessAddress,
          businessPhone,
          cutPaper
        }
      });

      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error saving printer settings' });
    }
  }
}

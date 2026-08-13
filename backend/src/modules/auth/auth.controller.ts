import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import type { NextFunction } from 'express';
import { prisma } from '../../config/prisma';

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, email, password } = req.body;
      const identificadorAcceso = (username || email || '').toString().trim();

      if (!identificadorAcceso || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      const resultadoAutenticacion = await AuthService.login(identificadorAcceso, password);
      res.json(resultadoAutenticacion);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Invalid credentials') {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      next(error);
    }
  }

  static async debugUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const token = String(req.query?.token || req.headers['x-auth-debug-token'] || '').trim();
      if (!process.env.AUTH_DEBUG_TOKEN || token !== process.env.AUTH_DEBUG_TOKEN) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const filasBaseDatos = await prisma.$queryRawUnsafe<Array<{ databaseName: string }>>(
        'SELECT DATABASE() AS databaseName'
      );
      const usuarios = await (prisma as any).user.findMany({
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          active: true
        },
        orderBy: { id: 'asc' }
      });

      return res.json({
        ok: true,
        database: filasBaseDatos?.[0]?.databaseName || null,
        count: usuarios.length,
        users: usuarios
      });
    } catch (error: unknown) {
      next(error);
    }
  }
}

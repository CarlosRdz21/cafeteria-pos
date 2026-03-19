import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { prisma } from '../prisma';

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { username, email, password } = req.body;
      const loginUsername = (username || email || '').toString().trim();

      if (!loginUsername || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      const data = await AuthService.login(loginUsername, password);
      res.json(data);
    } catch (error: any) {
      const attemptedUsername = (req.body?.username || req.body?.email || '').toString().trim().toLowerCase();
      console.warn(`[auth] login response 401 username="${attemptedUsername}" reason="${error?.message || 'unknown'}"`);
      res.status(401).json({ error: error.message });
    }
  }

  static async debugUsers(req: Request, res: Response) {
    try {
      const token = String(req.query?.token || req.headers['x-auth-debug-token'] || '').trim();
      if (!process.env.AUTH_DEBUG_TOKEN || token !== process.env.AUTH_DEBUG_TOKEN) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const databaseRows = await prisma.$queryRawUnsafe<Array<{ databaseName: string }>>(
        'SELECT DATABASE() AS databaseName'
      );
      const users = await (prisma as any).user.findMany({
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
        database: databaseRows?.[0]?.databaseName || null,
        count: users.length,
        users
      });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Debug auth error' });
    }
  }
}

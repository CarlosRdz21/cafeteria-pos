import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma';

const db = prisma as any;

function toRole(value: unknown): 'admin' | 'barista' | 'mesero' {
  if (value === 'admin' || value === 'barista' || value === 'mesero') return value;
  return 'mesero';
}

export class UsersController {
  static async list(_req: Request, res: Response) {
    try {
      const rows = await db.user.findMany({
        orderBy: { createdAt: 'desc' }
      });
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error listing users' });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const username = String(req.body?.username || '').trim().toLowerCase();
      const name = String(req.body?.name || '').trim();
      const password = String(req.body?.password || '');
      const role = toRole(req.body?.role);
      const active = req.body?.active !== false;

      if (!username || !name || !password) {
        return res.status(400).json({ error: 'username, name and password are required' });
      }

      const existing = await db.user.findFirst({
        where: { username }
      });
      if (existing) {
        return res.status(409).json({ error: 'Username already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const created = await db.user.create({
        data: {
          username,
          name,
          password: passwordHash,
          role,
          active
        }
      });
      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error creating user' });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid user id' });

      const existing = await db.user.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'User not found' });

      const data: Record<string, unknown> = {};
      if (req.body?.username !== undefined) data.username = String(req.body.username).trim().toLowerCase();
      if (req.body?.name !== undefined) data.name = String(req.body.name).trim();
      if (req.body?.password !== undefined) {
        const rawPassword = String(req.body.password || '');
        if (rawPassword) {
          data.password = await bcrypt.hash(rawPassword, 10);
        }
      }
      if (req.body?.role !== undefined) data.role = toRole(req.body.role);
      if (req.body?.active !== undefined) data.active = !!req.body.active;

      if (typeof data.username === 'string' && data.username) {
        const duplicate = await db.user.findFirst({
          where: {
            username: data.username,
            NOT: { id }
          }
        });
        if (duplicate) {
          return res.status(409).json({ error: 'Username already exists' });
        }
      }

      const updated = await db.user.update({
        where: { id },
        data
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error updating user' });
    }
  }

  static async remove(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid user id' });

      const existing = await db.user.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'User not found' });

      await db.user.delete({ where: { id } });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error deleting user' });
    }
  }
}

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import type { NextFunction } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

const publicUserSelect = {
  id: true,
  username: true,
  email: true,
  name: true,
  role: true,
  active: true,
  createdAt: true,
} as const satisfies Prisma.UserSelect;

function toRole(value: unknown): 'admin' | 'barista' | 'mesero' {
  if (value === 'admin' || value === 'barista' || value === 'mesero') return value;
  return 'mesero';
}

export class UsersController {
  static async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const usuarios = await prisma.user.findMany({
        select: publicUserSelect,
        orderBy: { createdAt: 'desc' }
      });
      res.json(usuarios);
    } catch (error: unknown) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const username = String(req.body?.username || '').trim().toLowerCase();
      const name = String(req.body?.name || '').trim();
      const password = String(req.body?.password || '');
      const role = toRole(req.body?.role);
      const active = req.body?.active !== false;

      if (!username || !name || !password) {
        return res.status(400).json({ error: 'username, name and password are required' });
      }

      const usuarioExistente = await prisma.user.findFirst({
        where: { username },
        select: { id: true }
      });
      if (usuarioExistente) {
        return res.status(409).json({ error: 'Username already exists' });
      }

      const hashContrasena = await bcrypt.hash(password, 10);

      const usuarioCreado = await prisma.user.create({
        data: {
          username,
          name,
          password: hashContrasena,
          role,
          active
        },
        select: publicUserSelect
      });
      res.status(201).json(usuarioCreado);
    } catch (error: unknown) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid user id' });

      const usuarioExistente = await prisma.user.findUnique({
        where: { id },
        select: { id: true }
      });
      if (!usuarioExistente) return res.status(404).json({ error: 'User not found' });

      const datosActualizacion: Prisma.UserUpdateInput = {};
      if (req.body?.username !== undefined) datosActualizacion.username = String(req.body.username).trim().toLowerCase();
      if (req.body?.name !== undefined) datosActualizacion.name = String(req.body.name).trim();
      if (req.body?.password !== undefined) {
        const contrasenaSinProcesar = String(req.body.password || '');
        if (contrasenaSinProcesar) {
          datosActualizacion.password = await bcrypt.hash(contrasenaSinProcesar, 10);
        }
      }
      if (req.body?.role !== undefined) datosActualizacion.role = toRole(req.body.role);
      if (req.body?.active !== undefined) datosActualizacion.active = !!req.body.active;

      if (typeof datosActualizacion.username === 'string' && datosActualizacion.username) {
        const usuarioDuplicado = await prisma.user.findFirst({
          where: {
            username: datosActualizacion.username,
            NOT: { id }
          },
          select: { id: true }
        });
        if (usuarioDuplicado) {
          return res.status(409).json({ error: 'Username already exists' });
        }
      }

      const usuarioActualizado = await prisma.user.update({
        where: { id },
        data: datosActualizacion,
        select: publicUserSelect
      });
      res.json(usuarioActualizado);
    } catch (error: unknown) {
      next(error);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid user id' });

      const usuarioExistente = await prisma.user.findUnique({
        where: { id },
        select: { id: true }
      });
      if (!usuarioExistente) return res.status(404).json({ error: 'User not found' });

      await prisma.user.delete({ where: { id } });
      res.json({ success: true });
    } catch (error: unknown) {
      next(error);
    }
  }
}

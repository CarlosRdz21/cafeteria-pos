import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaSimulado = vi.hoisted(() => ({
  buscarUsuarios: vi.fn(),
  buscarUsuario: vi.fn(),
  buscarPrimero: vi.fn(),
  crearUsuario: vi.fn(),
  actualizarUsuario: vi.fn(),
  eliminarUsuario: vi.fn(),
}));

vi.mock('../src/config/prisma', () => ({
  prisma: {
    user: {
      findMany: prismaSimulado.buscarUsuarios,
      findUnique: prismaSimulado.buscarUsuario,
      findFirst: prismaSimulado.buscarPrimero,
      create: prismaSimulado.crearUsuario,
      update: prismaSimulado.actualizarUsuario,
      delete: prismaSimulado.eliminarUsuario,
    },
  },
}));

import { UsersController } from '../src/modules/users/users.controller';

describe('UsersController', () => {
  const usuarioPublico = {
    id: 1,
    username: 'administrador',
    email: null,
    name: 'Administración',
    role: 'admin',
    active: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function crearRespuesta() {
    const respuesta = {
      json: vi.fn(),
      status: vi.fn(),
    };
    respuesta.status.mockReturnValue(respuesta);
    return respuesta;
  }

  it('no incluye hashes de contraseña en el listado de usuarios', async () => {
    prismaSimulado.buscarUsuarios.mockResolvedValue([usuarioPublico]);
    const respuesta = crearRespuesta();

    await UsersController.list({} as Request, respuesta as unknown as Response, vi.fn());

    const cuerpo = respuesta.json.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(cuerpo.every(usuario => !Object.prototype.hasOwnProperty.call(usuario, 'password'))).toBe(true);
    expect(prismaSimulado.buscarUsuarios).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.not.objectContaining({ password: true }),
    }));
  });

  it('no incluye el hash al crear un usuario', async () => {
    prismaSimulado.buscarPrimero.mockResolvedValue(null);
    prismaSimulado.crearUsuario.mockResolvedValue(usuarioPublico);
    const respuesta = crearRespuesta();

    await UsersController.create({
      body: {
        username: 'administrador',
        name: 'Administración',
        password: 'clave-segura',
        role: 'admin',
      },
    } as Request, respuesta as unknown as Response, vi.fn());

    expect(respuesta.status).toHaveBeenCalledWith(201);
    expect(respuesta.json).toHaveBeenCalledWith(usuarioPublico);
    expect(prismaSimulado.buscarPrimero).toHaveBeenCalledWith({
      where: { username: 'administrador' },
      select: { id: true },
    });
    expect(prismaSimulado.crearUsuario).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.not.objectContaining({ password: true }),
    }));
  });

  it('no incluye el hash al actualizar un usuario', async () => {
    prismaSimulado.buscarUsuario.mockResolvedValue({ ...usuarioPublico, password: '$2b$10$hash' });
    prismaSimulado.actualizarUsuario.mockResolvedValue(usuarioPublico);
    const respuesta = crearRespuesta();

    await UsersController.update({
      params: { id: '1' },
      body: { name: 'Administración actualizada' },
    } as unknown as Request, respuesta as unknown as Response, vi.fn());

    expect(respuesta.json).toHaveBeenCalledWith(usuarioPublico);
    expect(prismaSimulado.buscarUsuario).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { id: true },
    });
    expect(prismaSimulado.actualizarUsuario).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.not.objectContaining({ password: true }),
    }));
  });

  it('selecciona solo el id al comprobar un nombre de usuario duplicado', async () => {
    prismaSimulado.buscarUsuario.mockResolvedValue({ id: 1 });
    prismaSimulado.buscarPrimero.mockResolvedValue(null);
    prismaSimulado.actualizarUsuario.mockResolvedValue(usuarioPublico);
    const respuesta = crearRespuesta();

    await UsersController.update({
      params: { id: '1' },
      body: { username: 'nuevo-nombre' },
    } as unknown as Request, respuesta as unknown as Response, vi.fn());

    expect(prismaSimulado.buscarPrimero).toHaveBeenCalledWith({
      where: { username: 'nuevo-nombre', NOT: { id: 1 } },
      select: { id: true },
    });
  });

  it('selecciona solo el id antes de eliminar un usuario', async () => {
    prismaSimulado.buscarUsuario.mockResolvedValue({ id: 1 });
    prismaSimulado.eliminarUsuario.mockResolvedValue({ id: 1 });
    const respuesta = crearRespuesta();

    await UsersController.remove({
      params: { id: '1' },
    } as unknown as Request, respuesta as unknown as Response, vi.fn());

    expect(prismaSimulado.buscarUsuario).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { id: true },
    });
    expect(respuesta.json).toHaveBeenCalledWith({ success: true });
  });

  it('responde 409 cuando el nombre de usuario ya existe al crear', async () => {
    prismaSimulado.buscarPrimero.mockResolvedValue({ id: 2 });
    const respuesta = crearRespuesta();

    await UsersController.create({
      body: { username: 'duplicado', name: 'Duplicado', password: 'clave-segura' },
    } as Request, respuesta as unknown as Response, vi.fn());

    expect(respuesta.status).toHaveBeenCalledWith(409);
    expect(respuesta.json).toHaveBeenCalledWith({ error: 'Username already exists' });
    expect(prismaSimulado.crearUsuario).not.toHaveBeenCalled();
  });

  it('responde 404 al actualizar un usuario inexistente', async () => {
    prismaSimulado.buscarUsuario.mockResolvedValue(null);
    const respuesta = crearRespuesta();

    await UsersController.update({
      params: { id: '44' }, body: { name: 'No existe' },
    } as unknown as Request, respuesta as unknown as Response, vi.fn());

    expect(respuesta.status).toHaveBeenCalledWith(404);
    expect(prismaSimulado.actualizarUsuario).not.toHaveBeenCalled();
  });

  it('responde 404 al eliminar un usuario inexistente', async () => {
    prismaSimulado.buscarUsuario.mockResolvedValue(null);
    const respuesta = crearRespuesta();

    await UsersController.remove({ params: { id: '44' } } as unknown as Request, respuesta as unknown as Response, vi.fn());

    expect(respuesta.status).toHaveBeenCalledWith(404);
    expect(prismaSimulado.eliminarUsuario).not.toHaveBeenCalled();
  });
});

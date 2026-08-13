import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthRequest, authMiddleware } from '../src/middlewares/auth.middleware';

function crearRespuestaSimulada() {
  const respuesta = {
    status: vi.fn(),
    json: vi.fn(),
  };
  respuesta.status.mockReturnValue(respuesta);
  respuesta.json.mockReturnValue(respuesta);
  return respuesta;
}

describe('authMiddleware', () => {
  const jwtSecretAnterior = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'secreto-exclusivo-para-pruebas';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (jwtSecretAnterior === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = jwtSecretAnterior;
  });

  it('responde 401 cuando una ruta protegida se solicita sin JWT', () => {
    const solicitud = { headers: {} } as AuthRequest;
    const respuesta = crearRespuestaSimulada();
    const siguiente = vi.fn();

    authMiddleware()(solicitud, respuesta as unknown as Response, siguiente as NextFunction);

    expect(respuesta.status).toHaveBeenCalledWith(401);
    expect(respuesta.json).toHaveBeenCalledWith({ error: 'No token' });
    expect(siguiente).not.toHaveBeenCalled();
  });

  it('responde 401 cuando el JWT es inválido', () => {
    const solicitud = { headers: { authorization: 'Bearer token-invalido' } } as AuthRequest;
    const respuesta = crearRespuestaSimulada();
    const siguiente = vi.fn();

    authMiddleware()(solicitud, respuesta as unknown as Response, siguiente as NextFunction);

    expect(respuesta.status).toHaveBeenCalledWith(401);
    expect(respuesta.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(siguiente).not.toHaveBeenCalled();
  });

  it('responde 401 cuando el JWT está expirado', () => {
    const token = jwt.sign(
      { userId: 1, role: 'admin' },
      process.env.JWT_SECRET!,
      { expiresIn: -1 },
    );
    const solicitud = { headers: { authorization: `Bearer ${token}` } } as AuthRequest;
    const respuesta = crearRespuestaSimulada();
    const siguiente = vi.fn();

    authMiddleware()(solicitud, respuesta as unknown as Response, siguiente as NextFunction);

    expect(respuesta.status).toHaveBeenCalledWith(401);
    expect(respuesta.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(siguiente).not.toHaveBeenCalled();
  });

  it('permite el acceso cuando el rol del JWT está autorizado', () => {
    const token = jwt.sign({ userId: 1, role: 'admin' }, process.env.JWT_SECRET!);
    const solicitud = { headers: { authorization: `Bearer ${token}` } } as AuthRequest;
    const respuesta = crearRespuestaSimulada();
    const siguiente = vi.fn();

    authMiddleware(['admin'])(solicitud, respuesta as unknown as Response, siguiente as NextFunction);

    expect(siguiente).toHaveBeenCalledOnce();
    expect(solicitud.user).toMatchObject({ userId: 1, role: 'admin' });
    expect(respuesta.status).not.toHaveBeenCalled();
  });

  it('responde 403 cuando el rol del JWT no está autorizado', () => {
    const token = jwt.sign({ userId: 2, role: 'barista' }, process.env.JWT_SECRET!);
    const solicitud = { headers: { authorization: `Bearer ${token}` } } as AuthRequest;
    const respuesta = crearRespuestaSimulada();
    const siguiente = vi.fn();

    authMiddleware(['admin'])(solicitud, respuesta as unknown as Response, siguiente as NextFunction);

    expect(respuesta.status).toHaveBeenCalledWith(403);
    expect(respuesta.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    expect(siguiente).not.toHaveBeenCalled();
  });
});

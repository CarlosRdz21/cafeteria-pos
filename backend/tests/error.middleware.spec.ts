import type { NextFunction, Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApplicationError, errorMiddleware } from '../src/middlewares/error.middleware';

function createResponse() {
  const response = { status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  return response;
}

describe('errorMiddleware', () => {
  const nodeEnvironmentAnterior = process.env.NODE_ENV;

  afterEach(() => {
    vi.restoreAllMocks();
    if (nodeEnvironmentAnterior === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnvironmentAnterior;
  });

  it('devuelve errores conocidos con su estado público', () => {
    const response = createResponse();

    errorMiddleware(
      new ApplicationError(400, 'detalle interno', 'Solicitud inválida'),
      {} as Request,
      response as unknown as Response,
      vi.fn() as NextFunction,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ error: 'Solicitud inválida' });
  });

  it('no expone stack, consultas ni detalles Prisma en producción', () => {
    process.env.NODE_ENV = 'production';
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = createResponse();
    const error = Object.assign(new Error('SELECT password FROM User'), {
      code: 'P9999',
      stack: 'ruta/interna/users.controller.ts:42',
      meta: { table: 'User' },
    });

    errorMiddleware(error, {} as Request, response as unknown as Response, vi.fn() as NextFunction);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    const body = JSON.stringify(response.json.mock.calls[0][0]);
    expect(body).not.toContain('password');
    expect(body).not.toContain('User');
    expect(body).not.toContain('controller');
  });

  it('convierte conflictos Prisma conocidos sin devolver metadata', () => {
    const response = createResponse();

    errorMiddleware(
      { code: 'P2002', meta: { target: ['username'] } },
      {} as Request,
      response as unknown as Response,
      vi.fn() as NextFunction,
    );

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({ error: 'Resource already exists' });
  });
});

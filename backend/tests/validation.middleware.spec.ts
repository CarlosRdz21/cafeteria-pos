import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import {
  validateCreateOrder,
  validateCreatePayment,
  validateCreateUser,
  validateLogin,
} from '../src/middlewares/validation.middleware';

function runValidation(handler: typeof validateLogin, body: unknown) {
  const response = { status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  const next = vi.fn();
  handler(
    { body } as Request,
    response as unknown as Response,
    next as NextFunction,
  );
  return { response, next };
}

describe('validación de entradas críticas', () => {
  it('rechaza login con valores que no son strings', () => {
    const { response, next } = runValidation(validateLogin, {
      username: { valor: 'admin' },
      password: ['secreto'],
    });

    expect(response.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('rechaza roles y contraseñas inválidas al crear usuarios', () => {
    const { response, next } = runValidation(validateCreateUser, {
      username: 'usuario',
      name: 'Usuario',
      password: 'corta',
      role: 'superadmin',
    });

    expect(response.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('rechaza pedidos con cantidades NaN o negativas', () => {
    const { response, next } = runValidation(validateCreateOrder, {
      items: [{ productId: 1, name: 'Café', quantity: -1, price: 'NaN', subtotal: 0 }],
    });

    expect(response.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ['cantidad decimal', 1.5],
    ['cantidad infinita', Number.POSITIVE_INFINITY],
    ['cantidad vacía', ''],
  ])('rechaza pedidos con %s', (_caso, quantity) => {
    const { response, next } = runValidation(validateCreateOrder, {
      items: [{ productId: 1, name: 'Café', quantity, price: 45, subtotal: 45 }],
    });

    expect(response.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ['identificador decimal', 1.5],
    ['identificador infinito', Number.POSITIVE_INFINITY],
    ['identificador vacío', ''],
  ])('rechaza pagos con %s', (_caso, orderId) => {
    const { response, next } = runValidation(validateCreatePayment, {
      orderId,
      method: 'card',
    });

    expect(response.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 'sin-monto', ''])(
    'rechaza pagos con importe no finito: %s',
    amount => {
      const { response, next } = runValidation(validateCreatePayment, {
        orderId: 1,
        method: 'cash',
        amount,
      });

      expect(response.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    },
  );

  it('rechaza pagos con método o identificador inválido', () => {
    const { response, next } = runValidation(validateCreatePayment, {
      orderId: 0,
      method: 'transferencia',
      amount: -1,
    });

    expect(response.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});

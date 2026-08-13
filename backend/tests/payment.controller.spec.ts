import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationError } from '../src/middlewares/error.middleware';

const simulacion = vi.hoisted(() => ({
  registrarPago: vi.fn(),
  listarPagos: vi.fn(),
  crearPreferencia: vi.fn(),
  verificarPago: vi.fn(),
  crearOrdenPoint: vi.fn(),
  obtenerOrdenPoint: vi.fn(),
}));

vi.mock('../src/modules/payments/payment.service', () => ({
  PaymentService: {
    registerPayment: simulacion.registrarPago,
    getPaymentsByDateRange: simulacion.listarPagos,
  },
}));

vi.mock('../src/modules/payments/mercado-pago-checkout.service', () => ({
  MercadoPagoCheckoutService: {
    createPreference: simulacion.crearPreferencia,
    verifyPayment: simulacion.verificarPago,
    createPointOrder: simulacion.crearOrdenPoint,
    getPointOrder: simulacion.obtenerOrdenPoint,
  },
}));

import { PaymentController } from '../src/modules/payments/payment.controller';

function crearRespuesta() {
  const respuesta = { status: vi.fn(), json: vi.fn() };
  respuesta.status.mockReturnValue(respuesta);
  return respuesta;
}

describe('PaymentController', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rechaza rangos de fecha inválidos antes de consultar pagos', async () => {
    const respuesta = crearRespuesta();

    await PaymentController.listByDate({
      query: { startDate: 'fecha-invalida', endDate: '2026-07-22' },
    } as unknown as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(respuesta.json).toHaveBeenCalledWith({ error: 'Invalid date range' });
    expect(simulacion.listarPagos).not.toHaveBeenCalled();
  });

  it('delega errores internos al registrar un pago', async () => {
    const errorInterno = new Error('SELECT secret FROM Payment');
    simulacion.registrarPago.mockRejectedValue(errorInterno);
    const respuesta = crearRespuesta();
    const siguiente = vi.fn();

    await PaymentController.create({
      body: { orderId: 8, method: 'cash', amount: 100 },
    } as Request, respuesta as unknown as Response, siguiente);

    expect(siguiente).toHaveBeenCalledWith(errorInterno);
    expect(respuesta.status).not.toHaveBeenCalled();
    expect(respuesta.json).not.toHaveBeenCalled();
  });

  it('delega fallos de preferencia sin exponer la respuesta de Mercado Pago', async () => {
    const errorInterno = new Error('token o respuesta privada');
    simulacion.crearPreferencia.mockRejectedValue(errorInterno);
    const respuesta = crearRespuesta();
    const siguiente = vi.fn();

    await PaymentController.createMercadoPagoPreference({
      body: {
        items: [{ title: 'Café', quantity: 1, unitPrice: 45 }],
        externalReference: 'pedido-8',
      },
    } as Request, respuesta as unknown as Response, siguiente);

    expect(siguiente).toHaveBeenCalledWith(errorInterno);
    expect(respuesta.json).not.toHaveBeenCalled();
  });

  it('conserva 400 para configuración Point con un mensaje público seguro', async () => {
    simulacion.crearOrdenPoint.mockRejectedValue(
      new Error('No se encontro terminal Mercado Pago para el serial SENSIBLE'),
    );
    const respuesta = crearRespuesta();
    const siguiente = vi.fn();

    await PaymentController.createMercadoPagoPointOrder({
      body: { totalAmount: 45, externalReference: 'pedido-8' },
    } as Request, respuesta as unknown as Response, siguiente);

    const error = siguiente.mock.calls[0][0];
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error.statusCode).toBe(400);
    expect(error.publicMessage).toBe('Mercado Pago terminal configuration error');
    expect(error.publicMessage).not.toContain('SENSIBLE');
    expect(respuesta.json).not.toHaveBeenCalled();
  });
});

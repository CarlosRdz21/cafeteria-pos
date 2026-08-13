import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbSimulado = vi.hoisted(() => ({
  buscarPrimero: vi.fn(),
  buscarHistorial: vi.fn(),
  obtenerMaximo: vi.fn(),
  crearCaja: vi.fn(),
  actualizarCaja: vi.fn(),
  transaccion: vi.fn(),
}));

const clienteTransaccional = {
  cashRegister: {
    findFirst: dbSimulado.buscarPrimero,
    create: dbSimulado.crearCaja,
  },
};

vi.mock('../src/config/prisma', () => ({
  prisma: {
    $transaction: dbSimulado.transaccion,
    cashRegister: {
      findFirst: dbSimulado.buscarPrimero,
      findMany: dbSimulado.buscarHistorial,
      aggregate: dbSimulado.obtenerMaximo,
      create: dbSimulado.crearCaja,
      update: dbSimulado.actualizarCaja,
    },
  },
}));

import { CashRegistersController } from '../src/modules/cash/cash-registers.controller';

function crearRespuesta() {
  const respuesta = { status: vi.fn(), json: vi.fn() };
  respuesta.status.mockReturnValue(respuesta);
  return respuesta;
}

describe('CashRegistersController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbSimulado.transaccion.mockImplementation(
      async (operacion: (tx: unknown) => unknown) =>
        operacion(clienteTransaccional),
    );
  });

  it('devuelve null cuando no existe una caja abierta', async () => {
    dbSimulado.buscarPrimero.mockResolvedValue(null);
    const respuesta = crearRespuesta();

    await CashRegistersController.current({} as Request, respuesta as unknown as Response);

    expect(respuesta.json).toHaveBeenCalledWith(null);
  });

  it('rechaza una apertura sin monto valido antes de consultar la base', async () => {
    const respuesta = crearRespuesta();

    await CashRegistersController.open({ body: { openingAmount: -1, userId: '7' } } as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(dbSimulado.buscarPrimero).not.toHaveBeenCalled();
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, '', 'sin-monto'])(
    'rechaza un monto de apertura no finito: %s',
    async openingAmount => {
      const respuesta = crearRespuesta();

      await CashRegistersController.open({
        body: { openingAmount, userId: '7' },
      } as Request, respuesta as unknown as Response);

      expect(respuesta.status).toHaveBeenCalledWith(400);
      expect(dbSimulado.buscarPrimero).not.toHaveBeenCalled();
    },
  );

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, ''])(
    'rechaza una venta con monto no positivo o no finito: %s',
    async amount => {
      const respuesta = crearRespuesta();

      await CashRegistersController.recordSaleCurrent({
        body: { amount, paymentMethod: 'cash' },
      } as Request, respuesta as unknown as Response);

      expect(respuesta.status).toHaveBeenCalledWith(400);
      expect(dbSimulado.buscarPrimero).not.toHaveBeenCalled();
    },
  );

  it('responde 409 cuando ya hay una caja abierta', async () => {
    dbSimulado.buscarPrimero.mockResolvedValue({ id: 3, status: 'open' });
    const respuesta = crearRespuesta();

    await CashRegistersController.open({ body: { openingAmount: 500, userId: '7' } } as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(409);
    expect(dbSimulado.crearCaja).not.toHaveBeenCalled();
    expect(dbSimulado.transaccion).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
  });

  it('abre una caja con los acumuladores en cero', async () => {
    const cajaCreada = { id: 4, openingAmount: 500, status: 'open' };
    dbSimulado.buscarPrimero.mockResolvedValue(null);
    dbSimulado.crearCaja.mockResolvedValue(cajaCreada);
    const respuesta = crearRespuesta();

    await CashRegistersController.open({ body: { openingAmount: '500', userId: '7' } } as Request, respuesta as unknown as Response);

    expect(dbSimulado.crearCaja).toHaveBeenCalledWith({ data: expect.objectContaining({
      openingAmount: 500,
      cashSales: 0,
      cardSales: 0,
      expenses: 0,
      totalTransactions: 0,
      status: 'open',
      userRef: '7',
    }) });
    expect(dbSimulado.obtenerMaximo).not.toHaveBeenCalled();
    expect(respuesta.status).toHaveBeenCalledWith(201);
    expect(respuesta.json).toHaveBeenCalledWith(cajaCreada);
  });

  it('calcula monto esperado y diferencia al cerrar', async () => {
    dbSimulado.buscarPrimero.mockResolvedValue({
      id: 4, openingAmount: 500, cashSales: 320, expenses: 70, status: 'open',
    });
    dbSimulado.actualizarCaja.mockResolvedValue({ id: 4, status: 'closed' });
    const respuesta = crearRespuesta();

    await CashRegistersController.closeCurrent({ body: { closingAmount: 760 } } as Request, respuesta as unknown as Response);

    expect(dbSimulado.actualizarCaja).toHaveBeenCalledWith({
      where: { id: 4 },
      data: expect.objectContaining({
        closingAmount: 760,
        expectedAmount: 750,
        difference: 10,
        status: 'closed',
      }),
    });
  });

  it.each([
    ['cash', 'cashSales'],
    ['card', 'cardSales'],
  ] as const)('registra una venta %s en el acumulador correcto', async (metodo, campo) => {
    const cliente = {
      cashRegister: {
        findFirst: vi.fn().mockResolvedValue({ id: 4 }),
        update: vi.fn().mockResolvedValue({ id: 4 }),
      },
    };

    await CashRegistersController.applySaleToOpenRegister(metodo, 85, cliente);

    expect(cliente.cashRegister.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: {
        totalTransactions: { increment: 1 },
        [campo]: { increment: 85 },
      },
    });
  });

  it('delega un error de persistencia al middleware central', async () => {
    const errorInterno = new Error('SELECT * FROM CashRegister');
    dbSimulado.buscarPrimero.mockRejectedValue(errorInterno);
    const respuesta = crearRespuesta();
    const siguiente = vi.fn();

    await CashRegistersController.current(
      {} as Request,
      respuesta as unknown as Response,
      siguiente,
    );

    expect(siguiente).toHaveBeenCalledWith(errorInterno);
    expect(respuesta.status).not.toHaveBeenCalled();
    expect(respuesta.json).not.toHaveBeenCalled();
  });
});

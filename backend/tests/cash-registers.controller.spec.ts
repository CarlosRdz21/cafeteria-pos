import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbSimulado = vi.hoisted(() => ({
  buscarPrimero: vi.fn(),
  buscarHistorial: vi.fn(),
  obtenerMaximo: vi.fn(),
  crearCaja: vi.fn(),
  actualizarCaja: vi.fn(),
  actualizarVariasCajas: vi.fn(),
  buscarCajaPorId: vi.fn(),
  ejecutarSql: vi.fn(),
  transaccion: vi.fn(),
}));

const clienteTransaccional = {
  cashRegister: {
    findFirst: dbSimulado.buscarPrimero,
    findUnique: dbSimulado.buscarCajaPorId,
    create: dbSimulado.crearCaja,
    updateMany: dbSimulado.actualizarVariasCajas,
  },
  $executeRaw: dbSimulado.ejecutarSql,
};

vi.mock('../src/config/prisma', () => ({
  prisma: {
    $transaction: dbSimulado.transaccion,
    cashRegister: {
      findFirst: dbSimulado.buscarPrimero,
      findMany: dbSimulado.buscarHistorial,
      aggregate: dbSimulado.obtenerMaximo,
      create: dbSimulado.crearCaja,
      findUnique: dbSimulado.buscarCajaPorId,
      update: dbSimulado.actualizarCaja,
      updateMany: dbSimulado.actualizarVariasCajas,
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
    dbSimulado.ejecutarSql.mockResolvedValue(1);
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
    const cajaCerrada = {
      id: 4,
      closingAmount: 760,
      expectedAmount: 750,
      difference: 10,
      status: 'closed',
    };
    dbSimulado.buscarCajaPorId.mockResolvedValue(cajaCerrada);
    const respuesta = crearRespuesta();

    await CashRegistersController.closeCurrent({ body: { closingAmount: 760 } } as Request, respuesta as unknown as Response);

    expect(dbSimulado.ejecutarSql).toHaveBeenCalledTimes(1);
    expect(dbSimulado.buscarCajaPorId).toHaveBeenCalledWith({ where: { id: 4 } });
    expect(respuesta.json).toHaveBeenCalledWith(cajaCerrada);
  });

  it('responde 404 cuando no existe una caja abierta para cerrar', async () => {
    dbSimulado.buscarPrimero.mockResolvedValue(null);
    const respuesta = crearRespuesta();

    await CashRegistersController.closeCurrent(
      { body: { closingAmount: 760 } } as Request,
      respuesta as unknown as Response,
    );

    expect(respuesta.status).toHaveBeenCalledWith(404);
    expect(dbSimulado.ejecutarSql).not.toHaveBeenCalled();
  });

  it('responde 404 cuando otra solicitud reclama primero el cierre', async () => {
    dbSimulado.buscarPrimero.mockResolvedValue({ id: 4, status: 'open' });
    dbSimulado.ejecutarSql.mockResolvedValue(0);
    const respuesta = crearRespuesta();

    await CashRegistersController.closeCurrent(
      { body: { closingAmount: 760 } } as Request,
      respuesta as unknown as Response,
    );

    expect(respuesta.status).toHaveBeenCalledWith(404);
    expect(dbSimulado.buscarCajaPorId).not.toHaveBeenCalled();
  });

  it('delega un error Prisma durante el reclamo de cierre', async () => {
    const errorInterno = new Error('fallo SQL al cerrar');
    dbSimulado.buscarPrimero.mockResolvedValue({ id: 4, status: 'open' });
    dbSimulado.ejecutarSql.mockRejectedValue(errorInterno);
    const respuesta = crearRespuesta();
    const siguiente = vi.fn();

    await CashRegistersController.closeCurrent(
      { body: { closingAmount: 760 } } as Request,
      respuesta as unknown as Response,
      siguiente,
    );

    expect(siguiente).toHaveBeenCalledWith(errorInterno);
    expect(respuesta.json).not.toHaveBeenCalled();
  });

  it.each([
    ['cash', 'cashSales'],
    ['card', 'cardSales'],
  ] as const)('registra una venta %s en el acumulador correcto', async (metodo, campo) => {
    const cliente = {
      cashRegister: {
        findFirst: vi.fn().mockResolvedValue({ id: 4 }),
        findUnique: vi.fn().mockResolvedValue({ id: 4 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    await CashRegistersController.applySaleToOpenRegister(metodo, 85, cliente);

    expect(cliente.cashRegister.updateMany).toHaveBeenCalledWith({
      where: { id: 4, status: 'open' },
      data: {
        totalTransactions: { increment: 1 },
        [campo]: { increment: 85 },
      },
    });
  });

  it('no incrementa una caja que ya perdio el estado open', async () => {
    const cliente = {
      cashRegister: {
        findFirst: vi.fn().mockResolvedValue({ id: 4 }),
        findUnique: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const resultado = await CashRegistersController.applySaleToOpenRegister(
      'cash',
      85,
      cliente,
    );

    expect(resultado).toBeNull();
    expect(cliente.cashRegister.findUnique).not.toHaveBeenCalled();
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

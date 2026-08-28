import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbSimulado = vi.hoisted(() => ({
  listarGastos: vi.fn(),
  maximoGasto: vi.fn(),
  crearGasto: vi.fn(),
  buscarCaja: vi.fn(),
  buscarCajaPorId: vi.fn(),
  actualizarCaja: vi.fn(),
  actualizarVariasCajas: vi.fn(),
  transaccion: vi.fn(),
  buscarGasto: vi.fn(),
  eliminarGasto: vi.fn(),
  eliminarVariosGastos: vi.fn(),
  ejecutarSql: vi.fn(),
}));

const clienteTransaccional = {
  expense: {
    create: dbSimulado.crearGasto,
    findUnique: dbSimulado.buscarGasto,
    deleteMany: dbSimulado.eliminarVariosGastos,
  },
  cashRegister: {
    findFirst: dbSimulado.buscarCaja,
    updateMany: dbSimulado.actualizarVariasCajas,
  },
  $executeRaw: dbSimulado.ejecutarSql,
};

vi.mock('../src/config/prisma', () => ({
  prisma: {
    expense: {
      findMany: dbSimulado.listarGastos,
      aggregate: dbSimulado.maximoGasto,
      create: dbSimulado.crearGasto,
      findUnique: dbSimulado.buscarGasto,
    },
    cashRegister: {
      findFirst: dbSimulado.buscarCaja,
      findUnique: dbSimulado.buscarCajaPorId,
      update: dbSimulado.actualizarCaja,
      updateMany: dbSimulado.actualizarVariasCajas,
    },
    $transaction: dbSimulado.transaccion,
  },
}));

import { ExpensesController } from '../src/modules/expenses/expenses.controller';

function crearRespuesta() {
  const respuesta = { status: vi.fn(), json: vi.fn() };
  respuesta.status.mockReturnValue(respuesta);
  return respuesta;
}

describe('ExpensesController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbSimulado.buscarGasto.mockResolvedValue(null);
    dbSimulado.actualizarVariasCajas.mockResolvedValue({ count: 1 });
    dbSimulado.eliminarVariosGastos.mockResolvedValue({ count: 1 });
    dbSimulado.ejecutarSql.mockResolvedValue(1);
    dbSimulado.transaccion.mockImplementation(async (operacion: (tx: unknown) => unknown) => operacion(clienteTransaccional));
  });

  it('consulta gastos con rango de fechas inclusivo', async () => {
    dbSimulado.listarGastos.mockResolvedValue([]);
    const respuesta = crearRespuesta();
    const inicio = '2026-07-01T00:00:00.000Z';
    const fin = '2026-07-31T23:59:59.999Z';

    await ExpensesController.list({ query: { startDate: inicio, endDate: fin } } as unknown as Request, respuesta as unknown as Response);

    expect(dbSimulado.listarGastos).toHaveBeenCalledWith({
      where: { timestamp: { gte: new Date(inicio), lte: new Date(fin) } },
      orderBy: { timestamp: 'desc' },
    });
  });

  it('rechaza concepto, categoria o monto invalidos', async () => {
    const respuesta = crearRespuesta();

    await ExpensesController.create({ body: { concept: '', category: '', amount: 0 } } as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(dbSimulado.crearGasto).not.toHaveBeenCalled();
  });

  it('rechaza descontar de caja cuando no existe una abierta', async () => {
    dbSimulado.buscarCaja.mockResolvedValue(null);
    const respuesta = crearRespuesta();

    await ExpensesController.create({
      body: { concept: 'Gas', category: 'Servicios', amount: 300, paidFromCashRegister: true },
    } as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(dbSimulado.crearGasto).not.toHaveBeenCalled();
  });

  it('crea un gasto y actualiza el acumulado de la caja abierta', async () => {
    dbSimulado.buscarCaja.mockResolvedValue({ id: 5, expenses: 100 });
    dbSimulado.crearGasto.mockResolvedValue({ id: 10, amount: 300 });
    const respuesta = crearRespuesta();

    await ExpensesController.create({
      body: { concept: 'Gas', category: 'Servicios', amount: '300', paidFromCashRegister: true },
    } as Request, respuesta as unknown as Response);

    expect(dbSimulado.crearGasto).toHaveBeenCalledWith({ data: expect.objectContaining({
      concept: 'Gas',
      description: 'Gas',
      amount: 300,
      category: 'Servicios',
      cashRegisterId: 5,
      paidFromCashRegister: true,
    }) });
    expect(dbSimulado.maximoGasto).not.toHaveBeenCalled();
    expect(dbSimulado.actualizarVariasCajas).toHaveBeenCalledWith({
      where: { id: 5, status: 'open' },
      data: { expenses: { increment: 300 } },
    });
    expect(respuesta.status).toHaveBeenCalledWith(201);
  });

  it('responde 404 al eliminar un gasto inexistente', async () => {
    dbSimulado.buscarGasto.mockResolvedValue(null);
    const respuesta = crearRespuesta();

    await ExpensesController.remove({ params: { id: '80' } } as unknown as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(404);
    expect(dbSimulado.eliminarGasto).not.toHaveBeenCalled();
  });

  it.each(['1.5', '-1', '0', 'invalido'])(
    'rechaza eliminar con identificador inválido: %s',
    async id => {
      const respuesta = crearRespuesta();

      await ExpensesController.remove({
        params: { id },
      } as unknown as Request, respuesta as unknown as Response);

      expect(respuesta.status).toHaveBeenCalledWith(400);
      expect(dbSimulado.transaccion).not.toHaveBeenCalled();
    },
  );

  it('elimina el gasto y revierte su acumulado de caja dentro de la transaccion', async () => {
    const gasto = { id: 10, amount: 300, paidFromCashRegister: true, cashRegisterId: 5 };
    dbSimulado.buscarGasto.mockResolvedValue(gasto);
    const respuesta = crearRespuesta();

    await ExpensesController.remove({ params: { id: '10' } } as unknown as Request, respuesta as unknown as Response);

    expect(dbSimulado.eliminarVariosGastos).toHaveBeenCalledWith({ where: { id: 10 } });
    expect(dbSimulado.ejecutarSql).toHaveBeenCalledTimes(1);
    expect(respuesta.json).toHaveBeenCalledWith(gasto);
  });

  it('reutiliza un gasto existente cuando la clave y la intencion coinciden', async () => {
    const timestamp = new Date('2026-08-27T12:00:00.000Z');
    const gasto = {
      id: 10,
      idempotencyKey: 'misma-clave',
      concept: 'Leche',
      description: 'Leche',
      amount: 100,
      category: 'Insumos',
      notes: null,
      paidFromCashRegister: false,
      timestamp,
    };
    dbSimulado.buscarGasto.mockResolvedValue(gasto);
    const respuesta = crearRespuesta();

    await ExpensesController.create({
      headers: { 'idempotency-key': 'misma-clave' },
      body: {
        concept: 'Leche',
        category: 'Insumos',
        amount: 100,
        timestamp: timestamp.toISOString(),
      },
    } as unknown as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(200);
    expect(respuesta.json).toHaveBeenCalledWith(gasto);
    expect(dbSimulado.crearGasto).not.toHaveBeenCalled();
    expect(dbSimulado.actualizarVariasCajas).not.toHaveBeenCalled();
  });

  it('rechaza reutilizar una clave con datos contables distintos', async () => {
    dbSimulado.buscarGasto.mockResolvedValue({
      id: 10,
      concept: 'Leche',
      amount: 100,
      category: 'Insumos',
      notes: null,
      paidFromCashRegister: false,
      timestamp: new Date(),
    });
    const respuesta = crearRespuesta();

    await ExpensesController.create({
      body: {
        idempotencyKey: 'clave-reutilizada',
        concept: 'Cafe',
        category: 'Insumos',
        amount: 100,
      },
    } as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(409);
    expect(dbSimulado.crearGasto).not.toHaveBeenCalled();
  });

  it('no deja una respuesta exitosa si la caja se cierra antes del incremento', async () => {
    dbSimulado.buscarCaja.mockResolvedValue({ id: 5 });
    dbSimulado.crearGasto.mockResolvedValue({ id: 10, amount: 100 });
    dbSimulado.actualizarVariasCajas.mockResolvedValue({ count: 0 });
    const respuesta = crearRespuesta();

    await ExpensesController.create({
      body: {
        idempotencyKey: 'caja-cerrada',
        concept: 'Gas',
        category: 'Servicios',
        amount: 100,
        paidFromCashRegister: true,
      },
    } as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(409);
    expect(respuesta.json).toHaveBeenCalledWith({
      error: 'La caja se cerró antes de registrar el gasto',
    });
  });

  it('delega al middleware central si falla la transaccion de eliminacion', async () => {
    const errorInterno = new Error('fallo transaccional simulado');
    dbSimulado.transaccion.mockRejectedValue(errorInterno);
    const respuesta = crearRespuesta();
    const siguiente = vi.fn();

    await ExpensesController.remove(
      { params: { id: '10' } } as unknown as Request,
      respuesta as unknown as Response,
      siguiente,
    );

    expect(siguiente).toHaveBeenCalledWith(errorInterno);
    expect(respuesta.status).not.toHaveBeenCalled();
    expect(respuesta.json).not.toHaveBeenCalled();
  });
});

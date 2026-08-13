import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbSimulado = vi.hoisted(() => ({
  transaccion: vi.fn(),
  buscarInsumos: vi.fn(),
  buscarInsumo: vi.fn(),
  maximoInsumo: vi.fn(),
  crearInsumo: vi.fn(),
  actualizarInsumo: vi.fn(),
  actualizarInsumoCondicional: vi.fn(),
  buscarCategoria: vi.fn(),
  listarCategorias: vi.fn(),
  buscarCategoriaPorNombre: vi.fn(),
  maximoCategoria: vi.fn(),
  crearCategoria: vi.fn(),
  actualizarCategoria: vi.fn(),
  buscarMovimientos: vi.fn(),
  maximoMovimiento: vi.fn(),
  crearMovimiento: vi.fn(),
}));

const clienteTransaccional = {
  productSupply: {
    findUnique: dbSimulado.buscarInsumo,
    update: dbSimulado.actualizarInsumo,
    updateMany: dbSimulado.actualizarInsumoCondicional,
  },
  supplyMovement: {
    aggregate: dbSimulado.maximoMovimiento,
    create: dbSimulado.crearMovimiento,
  },
};

vi.mock('../src/config/prisma', () => ({
  prisma: {
    $transaction: dbSimulado.transaccion,
    productSupply: {
      findMany: dbSimulado.buscarInsumos,
      findUnique: dbSimulado.buscarInsumo,
      aggregate: dbSimulado.maximoInsumo,
      create: dbSimulado.crearInsumo,
      update: dbSimulado.actualizarInsumo,
    },
    supplyCategory: {
      findUnique: dbSimulado.buscarCategoria,
      findMany: dbSimulado.listarCategorias,
      findFirst: dbSimulado.buscarCategoriaPorNombre,
      aggregate: dbSimulado.maximoCategoria,
      create: dbSimulado.crearCategoria,
      update: dbSimulado.actualizarCategoria,
    },
    supplyMovement: {
      findMany: dbSimulado.buscarMovimientos,
      aggregate: dbSimulado.maximoMovimiento,
      create: dbSimulado.crearMovimiento,
    },
  },
}));

import { SuppliesController } from '../src/modules/inventory/supplies.controller';
import { SupplyCategoriesController } from '../src/modules/inventory/supply-categories.controller';
import { SupplyMovementsController } from '../src/modules/inventory/supply-movements.controller';

function crearRespuesta() {
  const respuesta = { status: vi.fn(), json: vi.fn() };
  respuesta.status.mockReturnValue(respuesta);
  return respuesta;
}

describe('controladores de inventario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbSimulado.transaccion.mockImplementation(async (operacion: (tx: unknown) => unknown) => operacion(clienteTransaccional));
  });

  it('rechaza un insumo sin nombre, unidad o categoria', async () => {
    const respuesta = crearRespuesta();

    await SuppliesController.create({ body: { name: 'Leche' } } as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(dbSimulado.crearInsumo).not.toHaveBeenCalled();
  });

  it('rechaza una categoria de insumo inexistente', async () => {
    dbSimulado.buscarCategoria.mockResolvedValue(null);
    const respuesta = crearRespuesta();

    await SuppliesController.create({
      body: { name: 'Leche', unit: 'litro', categoryId: 4 },
    } as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(dbSimulado.crearInsumo).not.toHaveBeenCalled();
  });

  it('delega el identificador de una categoria de insumo a MySQL', async () => {
    dbSimulado.buscarCategoriaPorNombre.mockResolvedValue(null);
    dbSimulado.maximoCategoria.mockResolvedValue({ _max: { sortOrder: 3 } });
    dbSimulado.crearCategoria.mockResolvedValue({
      id: 8,
      name: 'Desechables',
      active: true,
      sortOrder: 4,
    });
    const respuesta = crearRespuesta();

    await SupplyCategoriesController.create({
      body: { name: ' Desechables ' },
    } as Request, respuesta as unknown as Response);

    expect(dbSimulado.maximoCategoria).toHaveBeenCalledWith({
      _max: { sortOrder: true },
    });
    expect(dbSimulado.crearCategoria).toHaveBeenCalledWith({
      data: {
        name: 'Desechables',
        active: true,
        sortOrder: 4,
      },
    });
    expect(respuesta.status).toHaveBeenCalledWith(201);
  });

  it('crea un insumo con la categoria persistida', async () => {
    dbSimulado.buscarCategoria.mockResolvedValue({ id: 4, name: 'Lacteos' });
    dbSimulado.crearInsumo.mockResolvedValue({ id: 11, name: 'Leche' });
    const respuesta = crearRespuesta();

    await SuppliesController.create({
      body: { name: ' Leche ', unit: 'litro', categoryId: 4, currentStock: '8.5' },
    } as Request, respuesta as unknown as Response);

    expect(dbSimulado.crearInsumo).toHaveBeenCalledWith({ data: expect.objectContaining({
      name: 'Leche',
      categoryId: 4,
      categoryName: 'Lacteos',
      currentStock: 8.5,
    }) });
    expect(dbSimulado.maximoInsumo).not.toHaveBeenCalled();
    expect(respuesta.status).toHaveBeenCalledWith(201);
  });

  it('responde 404 al actualizar un insumo inexistente', async () => {
    dbSimulado.buscarInsumo.mockResolvedValue(null);
    const respuesta = crearRespuesta();

    await SuppliesController.update({ params: { id: '7' }, body: { name: 'Otro' } } as unknown as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(404);
    expect(dbSimulado.actualizarInsumo).not.toHaveBeenCalled();
  });

  it('rechaza movimientos con cantidad no positiva antes de la transaccion', async () => {
    const respuesta = crearRespuesta();

    await SupplyMovementsController.entry({ body: { supplyId: 2, quantity: 0 } } as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(dbSimulado.transaccion).not.toHaveBeenCalled();
  });

  it('registra una entrada y aumenta el stock dentro de la transaccion', async () => {
    dbSimulado.buscarInsumo.mockResolvedValue({ id: 2, currentStock: 5 });
    dbSimulado.crearMovimiento.mockResolvedValue({ id: 21, type: 'in', quantity: 3 });
    const respuesta = crearRespuesta();

    await SupplyMovementsController.entry({
      body: { supplyId: 2, quantity: 3, unitCost: 12.5 },
    } as Request, respuesta as unknown as Response);

    expect(dbSimulado.crearMovimiento).toHaveBeenCalledWith({ data: expect.objectContaining({
      supplyId: 2, type: 'in', quantity: 3, unitCost: 12.5, totalCost: 37.5,
    }) });
    expect(dbSimulado.actualizarInsumo).toHaveBeenCalledWith({
      where: { id: 2 }, data: { currentStock: { increment: 3 } },
    });
    expect(respuesta.status).toHaveBeenCalledWith(201);
  });

  it('rechaza una salida con stock insuficiente sin crear movimiento', async () => {
    dbSimulado.buscarInsumo.mockResolvedValue({ id: 2, currentStock: 2, unitCost: 10 });
    dbSimulado.actualizarInsumoCondicional.mockResolvedValue({ count: 0 });
    const respuesta = crearRespuesta();

    await SupplyMovementsController.exit({
      body: { supplyId: 2, quantity: 3 },
    } as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(respuesta.json).toHaveBeenCalledWith({ error: 'Stock insuficiente' });
    expect(dbSimulado.crearMovimiento).not.toHaveBeenCalled();
    expect(dbSimulado.actualizarInsumo).not.toHaveBeenCalled();
  });

  it.each([1.5, -1, 0, Number.POSITIVE_INFINITY])(
    'rechaza un identificador de insumo inválido: %s',
    async supplyId => {
      const respuesta = crearRespuesta();

      await SupplyMovementsController.entry({
        body: { supplyId, quantity: 1 },
      } as Request, respuesta as unknown as Response);

      expect(respuesta.status).toHaveBeenCalledWith(400);
      expect(dbSimulado.transaccion).not.toHaveBeenCalled();
    },
  );

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, 'sin-costo'])(
    'rechaza costo unitario inválido: %s',
    async unitCost => {
      const respuesta = crearRespuesta();

      await SupplyMovementsController.entry({
        body: { supplyId: 2, quantity: 1, unitCost },
      } as Request, respuesta as unknown as Response);

      expect(respuesta.status).toHaveBeenCalledWith(400);
      expect(dbSimulado.transaccion).not.toHaveBeenCalled();
    },
  );

  it('registra una salida y descuenta el stock dentro de la transaccion', async () => {
    dbSimulado.buscarInsumo.mockResolvedValue({ id: 2, currentStock: 7, unitCost: 10 });
    dbSimulado.actualizarInsumoCondicional.mockResolvedValue({ count: 1 });
    dbSimulado.crearMovimiento.mockResolvedValue({ id: 22, type: 'out', quantity: 3 });
    const respuesta = crearRespuesta();

    await SupplyMovementsController.exit({ body: { supplyId: 2, quantity: 3 } } as Request, respuesta as unknown as Response);

    expect(dbSimulado.actualizarInsumoCondicional).toHaveBeenCalledWith({
      where: { id: 2, currentStock: { gte: 3 } },
      data: { currentStock: { decrement: 3 } },
    });
    expect(respuesta.status).toHaveBeenCalledWith(201);
  });

  it('aplica un rango inclusivo al consultar movimientos', async () => {
    dbSimulado.buscarMovimientos.mockResolvedValue([]);
    const respuesta = crearRespuesta();
    const inicio = '2026-07-01T00:00:00.000Z';
    const fin = '2026-07-31T23:59:59.999Z';

    await SupplyMovementsController.list({ query: { startDate: inicio, endDate: fin } } as unknown as Request, respuesta as unknown as Response);

    expect(dbSimulado.buscarMovimientos).toHaveBeenCalledWith({
      where: { timestamp: { gte: new Date(inicio), lte: new Date(fin) } },
      orderBy: { timestamp: 'desc' },
    });
  });

  it.each([
    ['insumos', () => SuppliesController.list],
    ['categorías', () => SupplyCategoriesController.list],
    ['movimientos', () => SupplyMovementsController.list],
  ])('delega errores internos al listar %s', async (_modulo, obtenerControlador) => {
    const errorInterno = new Error('SELECT secret FROM Inventory');
    dbSimulado.buscarInsumos.mockRejectedValue(errorInterno);
    dbSimulado.listarCategorias.mockRejectedValue(errorInterno);
    dbSimulado.buscarMovimientos.mockRejectedValue(errorInterno);
    const respuesta = crearRespuesta();
    const siguiente = vi.fn();
    const controlador = obtenerControlador();

    await controlador(
      { query: {} } as unknown as Request,
      respuesta as unknown as Response,
      siguiente,
    );

    expect(siguiente).toHaveBeenCalledWith(errorInterno);
    expect(respuesta.status).not.toHaveBeenCalled();
    expect(respuesta.json).not.toHaveBeenCalled();
  });
});

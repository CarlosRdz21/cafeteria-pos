import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbSimulado = vi.hoisted(() => ({
  listarProductos: vi.fn(),
  buscarProducto: vi.fn(),
  crearProducto: vi.fn(),
  actualizarProducto: vi.fn(),
  eliminarProducto: vi.fn(),
  buscarCategoriaProducto: vi.fn(),
  buscarCategoriasProducto: vi.fn(),
  listarPromociones: vi.fn(),
  guardarPromocion: vi.fn(),
  eliminarPromocion: vi.fn(),
}));

vi.mock('../src/config/prisma', () => ({
  prisma: {
    product: {
      findMany: dbSimulado.listarProductos,
      findUnique: dbSimulado.buscarProducto,
      create: dbSimulado.crearProducto,
      update: dbSimulado.actualizarProducto,
      delete: dbSimulado.eliminarProducto,
    },
    productCategory: {
      findUnique: dbSimulado.buscarCategoriaProducto,
      findMany: dbSimulado.buscarCategoriasProducto,
    },
    promotion: {
      findMany: dbSimulado.listarPromociones,
      upsert: dbSimulado.guardarPromocion,
      delete: dbSimulado.eliminarPromocion,
    },
  },
}));

import { ProductsController } from '../src/modules/products/products.controller';
import { ProductCategoriesController } from '../src/modules/products/product-categories.controller';
import { PromotionsController } from '../src/modules/promotions/promotions.controller';

function crearRespuesta() {
  const respuesta = { status: vi.fn(), json: vi.fn() };
  respuesta.status.mockReturnValue(respuesta);
  return respuesta;
}

describe('ProductsController', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lista productos con el orden requerido por el POS', async () => {
    dbSimulado.listarProductos.mockResolvedValue([]);
    const respuesta = crearRespuesta();

    await ProductsController.list({} as Request, respuesta as unknown as Response);

    expect(dbSimulado.listarProductos).toHaveBeenCalledWith({
      orderBy: [{ categoryName: 'asc' }, { name: 'asc' }],
    });
  });

  it('rechaza crear un producto sin nombre o categoria', async () => {
    const respuesta = crearRespuesta();

    await ProductsController.create({ body: { name: '' } } as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(dbSimulado.crearProducto).not.toHaveBeenCalled();
  });

  it('normaliza los campos conocidos al crear un producto', async () => {
    dbSimulado.buscarCategoriaProducto.mockResolvedValue({ id: 2 });
    dbSimulado.crearProducto.mockResolvedValue({ id: 3, name: 'Latte' });
    const respuesta = crearRespuesta();

    await ProductsController.create({
      body: {
        name: ' Latte ', categoryId: '2', categoryName: 'Bebidas', price: '55.5',
        available: false, allowFlavorSelection: true, flavorOptions: ['vainilla'],
      },
    } as Request, respuesta as unknown as Response);

    expect(dbSimulado.crearProducto).toHaveBeenCalledWith({ data: expect.objectContaining({
      name: 'Latte', categoryId: 2, categoryName: 'Bebidas', price: 55.5,
      available: false, allowFlavorSelection: true, flavorOptions: ['vainilla'],
    }) });
    expect(respuesta.status).toHaveBeenCalledWith(201);
  });

  it.each([
    ['negativo', -1],
    ['NaN', Number.NaN],
    ['infinito', Number.POSITIVE_INFINITY],
    ['texto', 'gratis'],
  ])('rechaza precio %s al crear', async (_caso, price) => {
    const respuesta = crearRespuesta();

    await ProductsController.create({
      body: { name: 'Latte', categoryId: 2, price },
    } as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(respuesta.json).toHaveBeenCalledWith({ error: 'Invalid price' });
    expect(dbSimulado.crearProducto).not.toHaveBeenCalled();
  });

  it.each(['', '   '])('rechaza nombre vacío o con espacios al crear', async name => {
    const respuesta = crearRespuesta();

    await ProductsController.create({
      body: { name, categoryId: 2, price: 0 },
    } as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(dbSimulado.crearProducto).not.toHaveBeenCalled();
  });

  it('acepta precio cero porque el catálogo actual admite productos gratuitos', async () => {
    dbSimulado.buscarCategoriaProducto.mockResolvedValue({ id: 2 });
    dbSimulado.crearProducto.mockResolvedValue({ id: 4, name: 'Cortesía', price: 0 });
    const respuesta = crearRespuesta();

    await ProductsController.create({
      body: { name: 'Cortesía', categoryId: 2, price: 0 },
    } as Request, respuesta as unknown as Response);

    expect(dbSimulado.crearProducto).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Cortesía', price: 0, categoryId: 2 }),
    });
    expect(respuesta.status).toHaveBeenCalledWith(201);
  });

  it('rechaza actualizar un identificador invalido', async () => {
    const respuesta = crearRespuesta();

    await ProductsController.update({ params: { id: 'invalido' }, body: {} } as unknown as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(dbSimulado.actualizarProducto).not.toHaveBeenCalled();
  });

  it('acepta una actualización parcial válida', async () => {
    dbSimulado.buscarProducto.mockResolvedValue({ id: 7 });
    dbSimulado.actualizarProducto.mockResolvedValue({ id: 7, price: 60 });
    const respuesta = crearRespuesta();

    await ProductsController.update({
      params: { id: '7' },
      body: { price: '60' },
    } as unknown as Request, respuesta as unknown as Response);

    expect(dbSimulado.actualizarProducto).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({ price: 60 }),
    });
    expect(respuesta.json).toHaveBeenCalledWith({ id: 7, price: 60 });
  });

  it('responde 404 al actualizar un producto inexistente', async () => {
    dbSimulado.buscarProducto.mockResolvedValue(null);
    const respuesta = crearRespuesta();

    await ProductsController.update({
      params: { id: '99' },
      body: { price: 10 },
    } as unknown as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(404);
    expect(respuesta.json).toHaveBeenCalledWith({ error: 'Resource not found' });
    expect(dbSimulado.actualizarProducto).not.toHaveBeenCalled();
  });

  it('elimina por id y conserva la respuesta publica actual', async () => {
    dbSimulado.eliminarProducto.mockResolvedValue({ id: 8 });
    const respuesta = crearRespuesta();

    await ProductsController.remove({ params: { id: '8' } } as unknown as Request, respuesta as unknown as Response);

    expect(dbSimulado.eliminarProducto).toHaveBeenCalledWith({ where: { id: 8 } });
    expect(respuesta.json).toHaveBeenCalledWith({ success: true });
  });

  it('delega los errores inesperados sin construir una respuesta insegura', async () => {
    const errorInterno = Object.assign(new Error('fallo interno'), {
      code: 'P9999',
      meta: { table: 'Product' },
    });
    dbSimulado.listarProductos.mockRejectedValue(errorInterno);
    const respuesta = crearRespuesta();
    const siguiente = vi.fn();

    await ProductsController.list(
      {} as Request,
      respuesta as unknown as Response,
      siguiente,
    );

    expect(siguiente).toHaveBeenCalledOnce();
    expect(siguiente).toHaveBeenCalledWith(errorInterno);
    expect(respuesta.status).not.toHaveBeenCalled();
    expect(respuesta.json).not.toHaveBeenCalled();
  });
});

describe('ProductCategoriesController', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delega errores internos al listar categorías', async () => {
    const errorInterno = new Error('SELECT secret FROM ProductCategory');
    dbSimulado.buscarCategoriasProducto.mockRejectedValue(errorInterno);
    const respuesta = crearRespuesta();
    const siguiente = vi.fn();

    await ProductCategoriesController.list(
      {} as Request,
      respuesta as unknown as Response,
      siguiente,
    );

    expect(siguiente).toHaveBeenCalledWith(errorInterno);
    expect(respuesta.status).not.toHaveBeenCalled();
    expect(respuesta.json).not.toHaveBeenCalled();
  });
});

describe('PromotionsController', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rechaza una promocion sin id o nombre', async () => {
    const respuesta = crearRespuesta();

    await PromotionsController.upsert({ body: { id: '', name: '' } } as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(dbSimulado.guardarPromocion).not.toHaveBeenCalled();
  });

  it('normaliza listas, dias y valores antes de guardar una promocion', async () => {
    dbSimulado.listarProductos.mockResolvedValue([{ id: 2 }]);
    dbSimulado.guardarPromocion.mockResolvedValue({ id: 'promo-1' });
    const respuesta = crearRespuesta();

    await PromotionsController.upsert({
      body: {
        id: ' promo-1 ', name: ' Lunes ', type: 'percentage_discount', scope: 'product',
        productIds: ['2', 2, 'invalido'], categoryNames: [' Bebidas ', '', 'Bebidas'],
        percentageOff: '15', dayOfWeek: [1, 1, 8, -1], startDate: '', endDate: '',
      },
    } as Request, respuesta as unknown as Response);

    expect(dbSimulado.guardarPromocion).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'promo-1' },
      create: expect.objectContaining({
        id: 'promo-1', name: 'Lunes', productIds: [2], categoryNames: ['Bebidas'],
        percentageOff: 15, dayOfWeek: [1], startDate: null, endDate: null,
      }),
    }));
  });

  it.each([0, -1, 100.01, Number.NaN, Number.POSITIVE_INFINITY])(
    'rechaza un porcentaje fuera del rango permitido: %s',
    async percentageOff => {
      const respuesta = crearRespuesta();

      await PromotionsController.upsert({
        body: {
          id: 'promo-porcentaje',
          name: 'Descuento',
          type: 'percentage_discount',
          scope: 'all',
          percentageOff,
        },
      } as Request, respuesta as unknown as Response);

      expect(respuesta.status).toHaveBeenCalledWith(400);
      expect(respuesta.json).toHaveBeenCalledWith({ error: 'Invalid percentageOff' });
      expect(dbSimulado.guardarPromocion).not.toHaveBeenCalled();
    },
  );

  it('acepta el porcentaje máximo de 100', async () => {
    dbSimulado.guardarPromocion.mockResolvedValue({ id: 'promo-total' });
    const respuesta = crearRespuesta();

    await PromotionsController.upsert({
      body: {
        id: 'promo-total',
        name: 'Cortesía',
        type: 'percentage_discount',
        scope: 'all',
        percentageOff: 100,
      },
    } as Request, respuesta as unknown as Response);

    expect(dbSimulado.guardarPromocion).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ percentageOff: 100 }),
    }));
  });

  it.each([
    ['cantidad menor a dos', 1, 25, 'Invalid bundleQuantity'],
    ['cantidad decimal', 2.5, 25, 'Invalid bundleQuantity'],
    ['precio cero', 2, 0, 'Invalid bundlePrice'],
    ['precio negativo', 2, -1, 'Invalid bundlePrice'],
  ])('rechaza combo con %s', async (_caso, bundleQuantity, bundlePrice, error) => {
    const respuesta = crearRespuesta();

    await PromotionsController.upsert({
      body: {
        id: 'promo-combo',
        name: 'Combo',
        type: 'bundle_price',
        scope: 'all',
        bundleQuantity,
        bundlePrice,
      },
    } as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(respuesta.json).toHaveBeenCalledWith({ error });
    expect(dbSimulado.guardarPromocion).not.toHaveBeenCalled();
  });

  it('acepta un combo de dos productos con precio positivo', async () => {
    dbSimulado.guardarPromocion.mockResolvedValue({ id: 'promo-combo' });
    const respuesta = crearRespuesta();

    await PromotionsController.upsert({
      body: {
        id: 'promo-combo',
        name: 'Combo',
        type: 'bundle_price',
        scope: 'all',
        bundleQuantity: 2,
        bundlePrice: 25,
      },
    } as Request, respuesta as unknown as Response);

    expect(dbSimulado.guardarPromocion).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ bundleQuantity: 2, bundlePrice: 25 }),
    }));
  });

  it.each([
    ['fecha inexistente', '2026-02-30', '2026-03-01'],
    ['formato ambiguo', '22/07/2026', ''],
    ['rango invertido', '2026-07-23', '2026-07-22'],
  ])('rechaza %s', async (_caso, startDate, endDate) => {
    const respuesta = crearRespuesta();

    await PromotionsController.upsert({
      body: {
        id: 'promo-fecha',
        name: 'Promoción por fecha',
        type: 'percentage_discount',
        scope: 'all',
        percentageOff: 10,
        startDate,
        endDate,
      },
    } as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(respuesta.json).toHaveBeenCalledWith({ error: 'Invalid promotion date range' });
    expect(dbSimulado.guardarPromocion).not.toHaveBeenCalled();
  });

  it('acepta que una promoción inicie y termine el mismo día', async () => {
    dbSimulado.guardarPromocion.mockResolvedValue({ id: 'promo-dia' });
    const respuesta = crearRespuesta();

    await PromotionsController.upsert({
      body: {
        id: 'promo-dia',
        name: 'Promoción del día',
        type: 'percentage_discount',
        scope: 'all',
        percentageOff: 10,
        startDate: '2026-07-22',
        endDate: '2026-07-22',
      },
    } as Request, respuesta as unknown as Response);

    expect(dbSimulado.guardarPromocion).toHaveBeenCalled();
  });

  it('rechaza alcance de producto cuando algún producto no existe', async () => {
    dbSimulado.listarProductos.mockResolvedValue([{ id: 2 }]);
    const respuesta = crearRespuesta();

    await PromotionsController.upsert({
      body: {
        id: 'promo-productos',
        name: 'Productos seleccionados',
        type: 'percentage_discount',
        scope: 'product',
        percentageOff: 10,
        productIds: [2, 999],
      },
    } as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(respuesta.json).toHaveBeenCalledWith({ error: 'Invalid productIds' });
    expect(dbSimulado.guardarPromocion).not.toHaveBeenCalled();
  });

  it('rechaza eliminar una promocion sin identificador', async () => {
    const respuesta = crearRespuesta();

    await PromotionsController.remove({ params: { id: ' ' } } as unknown as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(dbSimulado.eliminarPromocion).not.toHaveBeenCalled();
  });

  it('delega los errores inesperados sin exponer detalles internos', async () => {
    const errorInterno = new Error('SELECT secret FROM Promotion');
    dbSimulado.listarPromociones.mockRejectedValue(errorInterno);
    const respuesta = crearRespuesta();
    const siguiente = vi.fn();

    await PromotionsController.list(
      {} as Request,
      respuesta as unknown as Response,
      siguiente,
    );

    expect(siguiente).toHaveBeenCalledOnce();
    expect(siguiente).toHaveBeenCalledWith(errorInterno);
    expect(respuesta.status).not.toHaveBeenCalled();
    expect(respuesta.json).not.toHaveBeenCalled();
  });
});

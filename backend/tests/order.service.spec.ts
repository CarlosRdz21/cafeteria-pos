import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaSimulado = vi.hoisted(() => ({
  crearPedido: vi.fn(),
  buscarPedidos: vi.fn(),
}));

vi.mock('../src/config/prisma', () => ({
  prisma: {
    order: {
      create: prismaSimulado.crearPedido,
      findMany: prismaSimulado.buscarPedidos,
    },
  },
}));

import { OrderService } from '../src/modules/orders/order.service';

describe('OrderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('crea un pedido pendiente con sus subtotales y el contrato actual de Prisma', async () => {
    const pedidoCreado = {
      id: 31,
      status: 'pending',
      subtotal: 90,
      tax: 0,
      total: 90,
      items: [{ productId: 10, name: 'Café', price: 45, quantity: 2, subtotal: 90 }],
    };
    prismaSimulado.crearPedido.mockResolvedValue(pedidoCreado);

    const resultado = await OrderService.crearPedido({
      subtotal: 90,
      tax: 0,
      total: 90,
      tableNumber: '4',
      customerName: 'Cliente de prueba',
      notes: 'Sin azúcar',
      items: [{ productId: 10, name: 'Café', price: 45, quantity: 2 }],
    });

    expect(prismaSimulado.crearPedido).toHaveBeenCalledWith({
      data: {
        status: 'pending',
        subtotal: 90,
        tax: 0,
        total: 90,
        tableNumber: '4',
        customerName: 'Cliente de prueba',
        notes: 'Sin azúcar',
        items: {
          create: [{ productId: 10, name: 'Café', price: 45, quantity: 2, subtotal: 90 }],
        },
      },
      include: { items: true },
    });
    expect(resultado).toEqual(pedidoCreado);
  });

  it('consulta pedidos pendientes ordenados del más reciente al más antiguo', async () => {
    const pedidosPendientes = [{ id: 31, status: 'pending', items: [] }];
    prismaSimulado.buscarPedidos.mockResolvedValue(pedidosPendientes);

    const resultado = await OrderService.obtenerPedidosPorEstado('pending');

    expect(prismaSimulado.buscarPedidos).toHaveBeenCalledWith({
      where: { status: 'pending' },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    expect(resultado).toEqual(pedidosPendientes);
  });
});

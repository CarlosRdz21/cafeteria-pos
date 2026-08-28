import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const simulacion = vi.hoisted(() => {
  const emitir = vi.fn();
  return {
    transaccion: vi.fn(),
    crearPedido: vi.fn(),
    buscarPedido: vi.fn(),
    actualizarPedido: vi.fn(),
    actualizarPedidosCondicional: vi.fn(),
    eliminarPedido: vi.fn(),
    buscarCaja: vi.fn(),
    actualizarCaja: vi.fn(),
    registrarPago: vi.fn(),
    registrarVenta: vi.fn(),
    emitir,
    irASala: vi.fn(() => ({ emit: emitir })),
  };
});

vi.mock('../src/config/prisma', () => ({
  prisma: {
    $transaction: simulacion.transaccion,
    order: {
      findUnique: simulacion.buscarPedido,
      update: simulacion.actualizarPedido,
      updateMany: simulacion.actualizarPedidosCondicional,
    },
  },
}));

vi.mock('../src/sockets/socket', () => ({
  getIO: () => ({ to: simulacion.irASala }),
}));

vi.mock('../src/modules/payments/payment.service', () => ({
  PaymentService: { registerPayment: simulacion.registrarPago },
}));

vi.mock('../src/modules/cash/cash-registers.controller', () => ({
  CashRegistersController: { applySaleToOpenRegister: simulacion.registrarVenta },
}));

import { OrderController } from '../src/modules/orders/order.controller';
import { SOCKET_EVENTS, SOCKET_ROOMS } from '../src/sockets/socket.constants';

function crearRespuesta() {
  const respuesta = { status: vi.fn(), json: vi.fn() };
  respuesta.status.mockReturnValue(respuesta);
  return respuesta;
}

describe('OrderController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('rechaza pedidos vacios antes de iniciar una transaccion', async () => {
    const respuesta = crearRespuesta();

    await OrderController.create({ body: { items: [] } } as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(simulacion.transaccion).not.toHaveBeenCalled();
  });

  it('crea un pedido pendiente y emite new-order una vez por sala operativa', async () => {
    const pedido = { id: 8, status: 'pending', subtotal: 80, tax: 0, total: 80, items: [] };
    simulacion.crearPedido.mockResolvedValue(pedido);
    simulacion.transaccion.mockImplementation(async (operacion: (tx: unknown) => unknown) => operacion({
      order: { create: simulacion.crearPedido },
    }));
    const respuesta = crearRespuesta();

    await OrderController.create({
      body: { items: [{ productId: 2, name: 'Latte', price: 40, quantity: 2, subtotal: 80 }] },
    } as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(201);
    expect(simulacion.irASala).toHaveBeenCalledTimes(2);
    expect(simulacion.irASala).toHaveBeenCalledWith(SOCKET_ROOMS.baristas);
    expect(simulacion.irASala).toHaveBeenCalledWith(SOCKET_ROOMS.admins);
    expect(simulacion.emitir).toHaveBeenCalledTimes(2);
    expect(simulacion.emitir).toHaveBeenCalledWith(SOCKET_EVENTS.newOrder, pedido);
  });

  it('no emite eventos cuando falla la transaccion de creacion', async () => {
    const errorInterno = new Error('fallo Prisma');
    simulacion.transaccion.mockRejectedValue(errorInterno);
    const respuesta = crearRespuesta();
    const siguiente = vi.fn();

    await OrderController.create({
      body: { items: [{ productId: 2, name: 'Latte', price: 40, quantity: 1, subtotal: 40 }] },
    } as Request, respuesta as unknown as Response, siguiente);

    expect(siguiente).toHaveBeenCalledWith(errorInterno);
    expect(respuesta.status).not.toHaveBeenCalled();
    expect(respuesta.json).not.toHaveBeenCalled();
    expect(simulacion.emitir).not.toHaveBeenCalled();
  });

  it('exige metodo de pago antes de completar un pedido', async () => {
    simulacion.buscarPedido.mockResolvedValue({ id: 8, status: 'pending', total: 80 });
    const respuesta = crearRespuesta();

    await OrderController.updateStatus({
      params: { id: '8' }, body: { status: 'completed' },
    } as unknown as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(400);
    expect(simulacion.registrarPago).not.toHaveBeenCalled();
  });

  it('no repite pago, caja ni eventos cuando otro intento ya completo el pedido', async () => {
    const pedidoPendiente = { id: 8, status: 'pending', total: 80 };
    const pedidoCompletado = { ...pedidoPendiente, status: 'completed', items: [] };
    simulacion.buscarPedido
      .mockResolvedValueOnce(pedidoPendiente)
      .mockResolvedValueOnce(pedidoCompletado);
    simulacion.actualizarPedidosCondicional.mockResolvedValue({ count: 0 });
    simulacion.transaccion.mockImplementation(
      async (operacion: (tx: unknown) => unknown) =>
        operacion({
          order: {
            update: simulacion.actualizarPedido,
            updateMany: simulacion.actualizarPedidosCondicional,
          },
        }),
    );
    const respuesta = crearRespuesta();

    await OrderController.updateStatus(
      {
        params: { id: '8' },
        body: {
          status: 'completed',
          paymentMethod: 'card',
        },
      } as unknown as Request,
      respuesta as unknown as Response,
    );

    expect(simulacion.registrarPago).not.toHaveBeenCalled();
    expect(simulacion.registrarVenta).not.toHaveBeenCalled();
    expect(simulacion.emitir).not.toHaveBeenCalled();
    expect(respuesta.json).toHaveBeenCalledWith(pedidoCompletado);
  });

  it('no emite eventos si falla una operacion posterior dentro de la transaccion', async () => {
    const errorInterno = new Error('fallo al actualizar caja');
    simulacion.buscarPedido.mockResolvedValue({
      id: 8,
      status: 'pending',
      total: 80,
    });
    simulacion.actualizarPedidosCondicional.mockResolvedValue({ count: 1 });
    simulacion.registrarPago.mockResolvedValue({ id: 4, orderId: 8 });
    simulacion.registrarVenta.mockRejectedValue(errorInterno);
    simulacion.transaccion.mockImplementation(
      async (operacion: (tx: unknown) => unknown) =>
        operacion({
          order: {
            update: simulacion.actualizarPedido,
            updateMany: simulacion.actualizarPedidosCondicional,
          },
        }),
    );
    const respuesta = crearRespuesta();
    const siguiente = vi.fn();

    await OrderController.updateStatus(
      {
        params: { id: '8' },
        body: {
          status: 'completed',
          paymentMethod: 'cash',
          amountPaid: 80,
        },
      } as unknown as Request,
      respuesta as unknown as Response,
      siguiente,
    );

    expect(siguiente).toHaveBeenCalledWith(errorInterno);
    expect(simulacion.emitir).not.toHaveBeenCalled();
    expect(respuesta.json).not.toHaveBeenCalled();
  });

  it('rechaza el pago sin emitir eventos cuando la caja pierde el estado open', async () => {
    simulacion.buscarPedido.mockResolvedValue({
      id: 8,
      status: 'pending',
      total: 80,
    });
    simulacion.actualizarPedidosCondicional.mockResolvedValue({ count: 1 });
    simulacion.registrarPago.mockResolvedValue({ id: 4, orderId: 8 });
    simulacion.registrarVenta.mockResolvedValue(null);
    simulacion.transaccion.mockImplementation(
      async (operacion: (tx: unknown) => unknown) =>
        operacion({
          order: {
            update: simulacion.actualizarPedido,
            updateMany: simulacion.actualizarPedidosCondicional,
          },
        }),
    );
    const respuesta = crearRespuesta();
    const siguiente = vi.fn();

    await OrderController.updateStatus(
      {
        params: { id: '8' },
        body: {
          status: 'completed',
          paymentMethod: 'cash',
          amountPaid: 80,
        },
      } as unknown as Request,
      respuesta as unknown as Response,
      siguiente,
    );

    expect(siguiente).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 409, publicMessage: 'No hay caja abierta' }),
    );
    expect(simulacion.emitir).not.toHaveBeenCalled();
    expect(respuesta.json).not.toHaveBeenCalled();
  });

  it('cancela y notifica exactamente los tres destinos actuales', async () => {
    const pedido = { id: 8, status: 'cancelled' };
    simulacion.actualizarPedido.mockResolvedValue(pedido);
    const respuesta = crearRespuesta();

    await OrderController.cancel({ params: { id: '8' } } as unknown as Request, respuesta as unknown as Response);

    expect(simulacion.emitir).toHaveBeenCalledTimes(3);
    expect(simulacion.emitir).toHaveBeenCalledWith(SOCKET_EVENTS.orderCancelled, 8);
    expect(simulacion.emitir).toHaveBeenCalledWith(SOCKET_EVENTS.orderUpdated, pedido);
    expect(respuesta.json).toHaveBeenCalledWith(pedido);
  });

  it('responde 404 al eliminar un pedido inexistente sin emitir eventos', async () => {
    simulacion.transaccion.mockImplementation(async (operacion: (tx: unknown) => unknown) => operacion({
      order: { findUnique: simulacion.buscarPedido, delete: simulacion.eliminarPedido },
      cashRegister: { findFirst: simulacion.buscarCaja, update: simulacion.actualizarCaja },
    }));
    simulacion.buscarPedido.mockResolvedValue(null);
    const respuesta = crearRespuesta();

    await OrderController.remove({ params: { id: '99' } } as unknown as Request, respuesta as unknown as Response);

    expect(respuesta.status).toHaveBeenCalledWith(404);
    expect(simulacion.eliminarPedido).not.toHaveBeenCalled();
    expect(simulacion.emitir).not.toHaveBeenCalled();
  });
});

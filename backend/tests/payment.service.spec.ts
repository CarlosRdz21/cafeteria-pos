import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaSimulado = vi.hoisted(() => ({
  buscarPedido: vi.fn(),
  actualizarPedido: vi.fn(),
  buscarPago: vi.fn(),
  crearPago: vi.fn(),
  buscarPagos: vi.fn(),
}));

vi.mock('../src/config/prisma', () => ({
  prisma: {
    order: {
      findUnique: prismaSimulado.buscarPedido,
      update: prismaSimulado.actualizarPedido,
    },
    payment: {
      findFirst: prismaSimulado.buscarPago,
      create: prismaSimulado.crearPago,
      findMany: prismaSimulado.buscarPagos,
    },
  },
}));

import { PaymentService } from '../src/modules/payments/payment.service';

describe('PaymentService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rechaza el pago cuando el pedido no existe', async () => {
    prismaSimulado.buscarPedido.mockResolvedValue(null);

    await expect(PaymentService.registerPayment(99, 'cash', 100))
      .rejects.toThrow('Orden no encontrada');
    expect(prismaSimulado.crearPago).not.toHaveBeenCalled();
  });

  it('devuelve el pago existente sin crear un duplicado', async () => {
    const pagoExistente = { id: 3, orderId: 7, method: 'cash', amount: 80 };
    prismaSimulado.buscarPedido.mockResolvedValue({ id: 7, status: 'completed', total: 80 });
    prismaSimulado.buscarPago.mockResolvedValue(pagoExistente);

    await expect(PaymentService.registerPayment(7, 'cash', 100)).resolves.toEqual(pagoExistente);
    expect(prismaSimulado.crearPago).not.toHaveBeenCalled();
    expect(prismaSimulado.actualizarPedido).not.toHaveBeenCalled();
  });

  it('repara el estado pendiente cuando ya existe un pago', async () => {
    const pagoExistente = { id: 3, orderId: 7, method: 'card', amount: 80 };
    prismaSimulado.buscarPedido.mockResolvedValue({ id: 7, status: 'pending', total: 80 });
    prismaSimulado.buscarPago.mockResolvedValue(pagoExistente);

    await PaymentService.registerPayment(7, 'card');

    expect(prismaSimulado.actualizarPedido).toHaveBeenCalledWith({
      where: { id: 7 }, data: { status: 'completed' },
    });
    expect(prismaSimulado.crearPago).not.toHaveBeenCalled();
  });

  it('registra una sola vez el total del pedido y conserva detalles permitidos', async () => {
    const pagoCreado = { id: 5, orderId: 7, method: 'card', amount: 80 };
    prismaSimulado.buscarPedido.mockResolvedValue({ id: 7, status: 'pending', total: 80 });
    prismaSimulado.buscarPago.mockResolvedValue(null);
    prismaSimulado.crearPago.mockResolvedValue(pagoCreado);

    const resultado = await PaymentService.registerPayment(7, 'card', undefined, {
      provider: 'proveedor-simulado', reference: 'referencia-segura', metadata: { estado: 'aprobado' },
    });

    expect(prismaSimulado.crearPago).toHaveBeenCalledOnce();
    expect(prismaSimulado.crearPago).toHaveBeenCalledWith({
      data: {
        orderId: 7,
        method: 'card',
        amount: 80,
        provider: 'proveedor-simulado',
        reference: 'referencia-segura',
        metadata: { estado: 'aprobado' },
      },
    });
    expect(prismaSimulado.actualizarPedido).toHaveBeenCalledWith({
      where: { id: 7 }, data: { status: 'completed' },
    });
    expect(resultado).toEqual(pagoCreado);
  });

  it('trata un conflicto unico concurrente como reintento idempotente', async () => {
    const pagoGanador = { id: 5, orderId: 7, method: 'card', amount: 80 };
    prismaSimulado.buscarPedido.mockResolvedValue({
      id: 7,
      status: 'pending',
      total: 80,
    });
    prismaSimulado.buscarPago
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(pagoGanador);
    prismaSimulado.crearPago.mockRejectedValue({ code: 'P2002' });

    await expect(PaymentService.registerPayment(7, 'card')).resolves.toEqual(
      pagoGanador,
    );
    expect(prismaSimulado.actualizarPedido).not.toHaveBeenCalled();
  });

  it('no oculta un conflicto si no existe el pago ganador', async () => {
    const conflicto = { code: 'P2002' };
    prismaSimulado.buscarPedido.mockResolvedValue({
      id: 7,
      status: 'pending',
      total: 80,
    });
    prismaSimulado.buscarPago.mockResolvedValue(null);
    prismaSimulado.crearPago.mockRejectedValue(conflicto);

    await expect(PaymentService.registerPayment(7, 'card')).rejects.toBe(
      conflicto,
    );
  });

  it('consulta reportes por un rango inclusivo y orden descendente', async () => {
    const inicio = new Date('2026-07-01T00:00:00.000Z');
    const fin = new Date('2026-07-31T23:59:59.999Z');
    prismaSimulado.buscarPagos.mockResolvedValue([]);

    await PaymentService.getPaymentsByDateRange(inicio, fin);

    expect(prismaSimulado.buscarPagos).toHaveBeenCalledWith({
      where: { paidAt: { gte: inicio, lte: fin } },
      include: { order: { include: { items: true } } },
      orderBy: { paidAt: 'desc' },
    });
  });
});

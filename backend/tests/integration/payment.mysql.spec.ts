import { PrismaClient } from '@prisma/client';
import type { Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OrderController } from '../../src/modules/orders/order.controller';
import { PaymentService } from '../../src/modules/payments/payment.service';
import { initSocket } from '../../src/sockets/socket';
import { SOCKET_EVENTS } from '../../src/sockets/socket.constants';

const describirMysql =
  process.env.RUN_MYSQL_INTEGRATION === 'true' ? describe : describe.skip;
const prisma = new PrismaClient();
const prefijo = `test_pago_${Date.now()}_`;
const eventos: Array<{ sala: string; evento: string }> = [];
let cajaId = 0;

function crearRespuesta() {
  const respuesta = {
    codigo: 200,
    cuerpo: undefined as unknown,
    status(codigo: number) {
      this.codigo = codigo;
      return this;
    },
    json(cuerpo: unknown) {
      this.cuerpo = cuerpo;
      return this;
    },
  };
  return respuesta;
}

describirMysql('idempotencia persistente de pagos en MySQL', () => {
  beforeAll(async () => {
    initSocket({
      to: (sala: string) => ({
        emit: (evento: string) => {
          eventos.push({ sala, evento });
        },
      }),
    } as never);
    const caja = await prisma.cashRegister.create({
      data: {
        openingAmount: 100,
        cashSales: 0,
        cardSales: 0,
        expenses: 0,
        totalTransactions: 0,
        openedAt: new Date(),
        status: 'open',
        userRef: `${prefijo}caja`,
      },
    });
    cajaId = caja.id;
  });

  afterAll(async () => {
    await prisma.order.deleteMany({
      where: { customerName: { startsWith: prefijo } },
    });
    await prisma.cashRegister.deleteMany({ where: { id: cajaId } });
    const pagosRestantes = await prisma.payment.count({
      where: { order: { customerName: { startsWith: prefijo } } },
    });
    await prisma.$disconnect();
    expect(pagosRestantes).toBe(0);
  });

  it.each([2, 5, 10])(
    'persiste un pago y un asiento contable ante %i finalizaciones simultaneas',
    async cantidad => {
      const pedido = await prisma.order.create({
        data: {
          status: 'pending',
          subtotal: 10,
          tax: 0,
          total: 10,
          customerName: `${prefijo}mismo_${cantidad}`,
        },
      });
      const cajaAntes = await prisma.cashRegister.findUniqueOrThrow({
        where: { id: cajaId },
      });
      eventos.length = 0;
      const respuestas = Array.from({ length: cantidad }, () =>
        crearRespuesta(),
      );

      await Promise.all(
        respuestas.map(respuesta =>
          OrderController.updateStatus(
            {
              params: { id: String(pedido.id) },
              body: {
                status: 'completed',
                paymentMethod: 'cash',
                amountPaid: 10,
              },
            } as unknown as Request,
            respuesta as unknown as Response,
          ),
        ),
      );

      const pagos = await prisma.payment.findMany({
        where: { orderId: pedido.id },
      });
      const pedidoFinal = await prisma.order.findUniqueOrThrow({
        where: { id: pedido.id },
      });
      const cajaFinal = await prisma.cashRegister.findUniqueOrThrow({
        where: { id: cajaId },
      });

      expect(pagos).toHaveLength(1);
      expect(pedidoFinal.status).toBe('completed');
      expect(cajaFinal.totalTransactions).toBe(
        cajaAntes.totalTransactions + 1,
      );
      expect(cajaFinal.cashSales).toBe(cajaAntes.cashSales + 10);
      expect(
        eventos.filter(evento => evento.evento === SOCKET_EVENTS.orderUpdated),
      ).toHaveLength(3);
      expect(respuestas.every(respuesta => respuesta.codigo === 200)).toBe(true);

      await OrderController.updateStatus(
        {
          params: { id: String(pedido.id) },
          body: {
            status: 'completed',
            paymentMethod: 'cash',
            amountPaid: 10,
          },
        } as unknown as Request,
        crearRespuesta() as unknown as Response,
      );
      expect(await prisma.payment.count({ where: { orderId: pedido.id } })).toBe(
        1,
      );
      expect(
        (await prisma.cashRegister.findUniqueOrThrow({ where: { id: cajaId } }))
          .totalTransactions,
      ).toBe(cajaFinal.totalTransactions);
      expect(eventos).toHaveLength(3);
    },
  );

  it('permite pagar pedidos diferentes en paralelo', async () => {
    const pedidos = await Promise.all(
      Array.from({ length: 5 }, (_, indice) =>
        prisma.order.create({
          data: {
            status: 'pending',
            subtotal: 5,
            tax: 0,
            total: 5,
            customerName: `${prefijo}distinto_${indice}`,
          },
        }),
      ),
    );

    const resultados = await Promise.all(
      pedidos.map(pedido =>
        PaymentService.registerPayment(pedido.id, 'card'),
      ),
    );

    expect(new Set(resultados.map(resultado => resultado.id)).size).toBe(5);
    expect(
      await prisma.payment.count({
        where: { orderId: { in: pedidos.map(pedido => pedido.id) } },
      }),
    ).toBe(5);
  });
});

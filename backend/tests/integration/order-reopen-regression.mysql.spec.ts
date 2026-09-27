import { PrismaClient } from '@prisma/client';
import type { Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApplicationError } from '../../src/middlewares/error.middleware';
import { OrderController } from '../../src/modules/orders/order.controller';
import { initSocket } from '../../src/sockets/socket';

const describirMysql =
  process.env.RUN_MYSQL_INTEGRATION === 'true' ? describe : describe.skip;
const prisma = new PrismaClient();
const prefijo = `TEST_regresion_1540_${Date.now()}_`;
const eventos: string[] = [];
let cajaId = 0;

function crearRespuesta() {
  return {
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
}

function capturarError(respuesta: ReturnType<typeof crearRespuesta>) {
  return (error: unknown) => {
    if (error instanceof ApplicationError) {
      respuesta.status(error.statusCode).json({ error: error.publicMessage });
      return;
    }
    throw error;
  };
}

describirMysql('regresión del patrón histórico de reapertura y doble cobro', () => {
  beforeAll(async () => {
    initSocket({
      to: () => ({ emit: (evento: string) => eventos.push(evento) }),
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
    await prisma.$disconnect();
  });

  it('impide completed -> pending -> completed sin reutilizar pago ni afectar caja', async () => {
    // Protege contra el patrón histórico: completar, reabrir, modificar, volver a
    // completar, reutilizar el Payment anterior y afectar CashRegister otra vez.
    const pedido = await prisma.order.create({
      data: {
        status: 'pending',
        subtotal: 115,
        tax: 0,
        total: 115,
        customerName: `${prefijo}pedido`,
        items: {
          create: [{
            productId: 61,
            name: 'Desayuno de prueba',
            price: 115,
            quantity: 1,
            subtotal: 115,
          }],
        },
      },
    });

    await OrderController.updateStatus(
      {
        params: { id: String(pedido.id) },
        body: { status: 'completed', paymentMethod: 'cash', amountPaid: 115 },
      } as unknown as Request,
      crearRespuesta() as unknown as Response,
    );

    const cajaTrasPrimerCobro = await prisma.cashRegister.findUniqueOrThrow({
      where: { id: cajaId },
    });
    expect(await prisma.payment.findMany({ where: { orderId: pedido.id } })).toMatchObject([
      { amount: 115, method: 'cash' },
    ]);
    expect(cajaTrasPrimerCobro.cashSales).toBe(115);
    expect(cajaTrasPrimerCobro.cardSales).toBe(0);
    expect(cajaTrasPrimerCobro.totalTransactions).toBe(1);

    eventos.length = 0;
    const solicitudes = Array.from({ length: 10 }, (_, indice) => {
      const respuesta = crearRespuesta();
      const promesa = indice % 2 === 0
        ? OrderController.updateStatus(
          {
            params: { id: String(pedido.id) },
            body: {
              status: 'pending',
              items: [
                { productId: 3, name: 'Latte', price: 65, quantity: 1 },
                { productId: 39, name: 'Huevos', price: 99, quantity: 2 },
              ],
            },
          } as unknown as Request,
          respuesta as unknown as Response,
          capturarError(respuesta),
        )
        : OrderController.updateStatus(
          {
            params: { id: String(pedido.id) },
            body: {
              status: 'completed',
              paymentMethod: 'card',
              items: [
                { productId: 61, name: 'Desayuno', price: 115, quantity: 1 },
                { productId: 3, name: 'Latte', price: 65, quantity: 1 },
                { productId: 39, name: 'Huevos', price: 99, quantity: 2 },
              ],
            },
          } as unknown as Request,
          respuesta as unknown as Response,
          capturarError(respuesta),
        );
      return { respuesta, promesa };
    });

    await Promise.all(solicitudes.map(item => item.promesa));

    const [pedidoFinal, pagosFinales, cajaFinal] = await Promise.all([
      prisma.order.findUniqueOrThrow({
        where: { id: pedido.id },
        include: { items: true },
      }),
      prisma.payment.findMany({ where: { orderId: pedido.id } }),
      prisma.cashRegister.findUniqueOrThrow({ where: { id: cajaId } }),
    ]);

    const reaperturas = solicitudes.filter((_, indice) => indice % 2 === 0);
    expect(reaperturas.every(item => item.respuesta.codigo === 409)).toBe(true);
    expect(pedidoFinal.status).toBe('completed');
    expect(pedidoFinal.total).toBe(115);
    expect(pedidoFinal.items).toHaveLength(1);
    expect(pagosFinales).toHaveLength(1);
    expect(pagosFinales[0]).toMatchObject({ amount: 115, method: 'cash' });
    expect(cajaFinal.cashSales).toBe(115);
    expect(cajaFinal.cardSales).toBe(0);
    expect(cajaFinal.totalTransactions).toBe(1);
    expect(eventos).toHaveLength(0);
  });
});

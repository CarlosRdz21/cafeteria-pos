import { PrismaClient } from '@prisma/client';
import type { Request, Response } from 'express';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { CashRegistersController } from '../../src/modules/cash/cash-registers.controller';
import { ApplicationError } from '../../src/middlewares/error.middleware';
import { OrderController } from '../../src/modules/orders/order.controller';
import { initSocket } from '../../src/sockets/socket';
import { SOCKET_EVENTS } from '../../src/sockets/socket.constants';

const describirMysql =
  process.env.RUN_MYSQL_INTEGRATION === 'true' ? describe : describe.skip;
const prisma = new PrismaClient();
const prefijo = `TEST_integridad_cierre_${Date.now()}_`;
const eventos: string[] = [];

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

describirMysql('integridad concurrente del cierre de caja en MySQL', () => {
  it('preserva la caja histórica abierta y no deja cajas de prueba abiertas', async () => {
    expect(await prisma.cashRegister.count({
      where: { status: 'open', userRef: { startsWith: prefijo } },
    })).toBe(0);

    if (process.env.ALLOW_PROD_CLONE_TRANSACTION_TEST === 'true') {
      const cajasHistoricas = await prisma.cashRegister.findMany({
        where: { status: 'open', userRef: { not: { startsWith: prefijo } } },
        select: { id: true },
      });
      expect(cajasHistoricas).toEqual([]);
      return;
    }

    expect(await prisma.cashRegister.count({ where: { status: 'open' } })).toBe(0);
  });

  afterEach(async () => {
    await prisma.order.deleteMany({
      where: { customerName: { startsWith: prefijo } },
    });
    await prisma.cashRegister.deleteMany({
      where: { userRef: { startsWith: prefijo } },
    });
  });

  afterAll(async () => {
    const restantes = await prisma.cashRegister.count({
      where: { userRef: { startsWith: prefijo } },
    });
    await prisma.$disconnect();
    expect(restantes).toBe(0);
  });

  it.each([2, 5, 10, 20])(
    'permite exactamente un cierre ante %i solicitudes simultaneas en tres rondas',
    async cantidad => {
      for (let ronda = 1; ronda <= 3; ronda += 1) {
        const caja = await crearCajaAbierta(`${cantidad}_${ronda}`, {
          cashSales: 300,
          cardSales: 150,
          expenses: 50,
          totalTransactions: 3,
        });
        const respuestas = Array.from({ length: cantidad }, () =>
          crearRespuesta(),
        );

        await Promise.all(
          respuestas.map((respuesta, indice) =>
            CashRegistersController.closeCurrent(
              { body: { closingAmount: 750 + indice } } as Request,
              respuesta as unknown as Response,
            ),
          ),
        );

        const cajaFinal = await prisma.cashRegister.findUniqueOrThrow({
          where: { id: caja.id },
        });
        const exitosas = respuestas.filter(respuesta => respuesta.codigo === 200);
        const rechazadas = respuestas.filter(respuesta =>
          [404, 409].includes(respuesta.codigo),
        );

        expect(exitosas).toHaveLength(1);
        expect(rechazadas).toHaveLength(cantidad - 1);
        expect(cajaFinal.status).toBe('closed');
        expect(cajaFinal.expectedAmount).toBe(750);
        expect(cajaFinal.closingAmount).toBe(
          (exitosas[0].cuerpo as { closingAmount: number }).closingAmount,
        );
      }
    },
  );

  it('cierra normalmente con la formula contable actual', async () => {
    const caja = await crearCajaAbierta('normal', {
      cashSales: 300,
      cardSales: 150,
      expenses: 50,
      totalTransactions: 3,
    });
    const respuesta = crearRespuesta();

    await CashRegistersController.closeCurrent(
      { body: { closingAmount: 750 } } as Request,
      respuesta as unknown as Response,
    );

    const cajaFinal = await prisma.cashRegister.findUniqueOrThrow({
      where: { id: caja.id },
    });
    expect(respuesta.codigo).toBe(200);
    expect(cajaFinal.expectedAmount).toBe(750);
    expect(cajaFinal.closingAmount).toBe(750);
    expect(cajaFinal.difference).toBe(0);
    expect(cajaFinal.closedAt).toBeInstanceOf(Date);
  });

  it.each([1, 5, 10])(
    'conserva el primer cierre ante %i repeticiones secuenciales',
    async repeticiones => {
      const caja = await crearCajaAbierta(`secuencial_${repeticiones}`);
      const primera = crearRespuesta();
      await CashRegistersController.closeCurrent(
        { body: { closingAmount: 500 } } as Request,
        primera as unknown as Response,
      );
      const cierreOriginal = await prisma.cashRegister.findUniqueOrThrow({
        where: { id: caja.id },
      });
      const respuestas = Array.from({ length: repeticiones }, () => crearRespuesta());

      for (const respuesta of respuestas) {
        await CashRegistersController.closeCurrent(
          { body: { closingAmount: 100 } } as Request,
          respuesta as unknown as Response,
        );
      }

      const cierreFinal = await prisma.cashRegister.findUniqueOrThrow({
        where: { id: caja.id },
      });
      expect(respuestas.every(respuesta => respuesta.codigo === 404)).toBe(true);
      expect(cierreFinal.closingAmount).toBe(cierreOriginal.closingAmount);
      expect(cierreFinal.difference).toBe(cierreOriginal.difference);
      expect(cierreFinal.closedAt?.getTime()).toBe(cierreOriginal.closedAt?.getTime());
    },
  );

  it('mantiene exactamente los valores del request ganador', async () => {
    const caja = await crearCajaAbierta('ganador');
    const respuestas = [crearRespuesta(), crearRespuesta()];

    await Promise.all([
      CashRegistersController.closeCurrent(
        { body: { closingAmount: 750 } } as Request,
        respuestas[0] as unknown as Response,
      ),
      CashRegistersController.closeCurrent(
        { body: { closingAmount: 700 } } as Request,
        respuestas[1] as unknown as Response,
      ),
    ]);

    const ganador = respuestas.find(respuesta => respuesta.codigo === 200);
    const perdedor = respuestas.find(respuesta => respuesta.codigo !== 200);
    const cajaFinal = await prisma.cashRegister.findUniqueOrThrow({
      where: { id: caja.id },
    });

    expect(ganador).toBeDefined();
    expect(perdedor?.codigo).toBe(404);
    expect(cajaFinal.closingAmount).toBe(
      (ganador?.cuerpo as { closingAmount: number }).closingAmount,
    );
    expect(cajaFinal.difference).toBe(
      (ganador?.cuerpo as { difference: number }).difference,
    );
  });

  it('mantiene pago, orden y caja consistentes ante 20 carreras pago vs cierre', async () => {
    initSocket({
      to: () => ({
        emit: (evento: string) => eventos.push(evento),
      }),
    } as never);

    for (let ronda = 0; ronda < 20; ronda += 1) {
      const caja = await crearCajaAbierta(`pago_cierre_${ronda}`);
      const pedido = await prisma.order.create({
        data: {
          status: 'pending',
          subtotal: 100,
          tax: 0,
          total: 100,
          customerName: `${prefijo}pedido_${ronda}`,
        },
      });
      const respuestaPago = crearRespuesta();
      const respuestaCierre = crearRespuesta();
      let errorPago: unknown;
      eventos.length = 0;

      await Promise.all([
        OrderController.updateStatus(
          {
            params: { id: String(pedido.id) },
            body: {
              status: 'completed',
              paymentMethod: 'cash',
              amountPaid: 100,
            },
          } as unknown as Request,
          respuestaPago as unknown as Response,
          error => {
            errorPago = error;
            if (error instanceof ApplicationError) {
              respuestaPago.status(error.statusCode).json({
                error: error.publicMessage,
              });
            }
          },
        ),
        CashRegistersController.closeCurrent(
          { body: { closingAmount: 500 } } as Request,
          respuestaCierre as unknown as Response,
        ),
      ]);

      const [pedidoFinal, pagos, cajaFinal] = await Promise.all([
        prisma.order.findUniqueOrThrow({ where: { id: pedido.id } }),
        prisma.payment.findMany({ where: { orderId: pedido.id } }),
        prisma.cashRegister.findUniqueOrThrow({ where: { id: caja.id } }),
      ]);

      expect(respuestaCierre.codigo).toBe(200);
      expect(cajaFinal.status).toBe('closed');

      if (pagos.length === 1) {
        expect(errorPago).toBeUndefined();
        expect(pedidoFinal.status).toBe('completed');
        expect(cajaFinal.cashSales).toBe(100);
        expect(cajaFinal.totalTransactions).toBe(1);
        expect(cajaFinal.expectedAmount).toBe(600);
        expect(eventos.filter(evento => evento === SOCKET_EVENTS.orderUpdated)).toHaveLength(3);
      } else {
        expect(pagos).toHaveLength(0);
        expect(errorPago).toBeInstanceOf(ApplicationError);
        expect((errorPago as ApplicationError).statusCode).toBe(409);
        expect(pedidoFinal.status).toBe('pending');
        expect(cajaFinal.cashSales).toBe(0);
        expect(cajaFinal.totalTransactions).toBe(0);
        expect(cajaFinal.expectedAmount).toBe(500);
        expect(eventos).toHaveLength(0);
      }
    }
  });
});

async function crearCajaAbierta(
  sufijo: string,
  valores: Partial<{
    cashSales: number;
    cardSales: number;
    expenses: number;
    totalTransactions: number;
  }> = {},
) {
  return prisma.cashRegister.create({
    data: {
      openingAmount: 500,
      cashSales: valores.cashSales ?? 0,
      cardSales: valores.cardSales ?? 0,
      expenses: valores.expenses ?? 0,
      totalTransactions: valores.totalTransactions ?? 0,
      openedAt: new Date(Date.now() + 60_000),
      status: 'open',
      userRef: `${prefijo}${sufijo}`,
    },
  });
}

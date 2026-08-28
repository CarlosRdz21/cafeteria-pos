import { PrismaClient } from '@prisma/client';
import type { Request, Response } from 'express';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CashRegistersController } from '../../src/modules/cash/cash-registers.controller';
import { ExpensesController } from '../../src/modules/expenses/expenses.controller';
import { OrderController } from '../../src/modules/orders/order.controller';
import { PaymentService } from '../../src/modules/payments/payment.service';
import { initSocket } from '../../src/sockets/socket';

const describirMysql =
  process.env.RUN_MYSQL_INTEGRATION === 'true' ? describe : describe.skip;
const prisma = new PrismaClient();
const prefijo = `TEST_integridad_gasto_${Date.now()}_`;

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

describirMysql('integridad contable de gastos en MySQL', () => {
  beforeAll(() => {
    initSocket({ to: () => ({ emit: () => undefined }) } as never);
  });

  afterEach(async () => {
    await limpiarDatosTemporales();
  });

  afterAll(async () => {
    await limpiarDatosTemporales();
    await prisma.$disconnect();
  });

  it.each([2, 5, 10, 20])(
    'persiste una sola vez la misma intencion ante %i solicitudes concurrentes',
    async cantidad => {
      const clave = `${prefijo}clave_${cantidad}`;
      const concepto = `${prefijo}mismo_${cantidad}`;
      const respuestas = Array.from({ length: cantidad }, () => crearRespuesta());

      await Promise.all(
        respuestas.map(respuesta =>
          ExpensesController.create(
            {
              body: {
                concept: concepto,
                category: 'Pruebas',
                amount: 100,
                paidFromCashRegister: false,
                idempotencyKey: clave,
              },
            } as Request,
            respuesta as unknown as Response,
          ),
        ),
      );

      const resumen = await prisma.expense.aggregate({
        where: { concept: concepto },
        _count: { id: true },
        _sum: { amount: true },
      });
      expect(resumen._count.id).toBe(1);
      expect(resumen._sum.amount).toBe(100);
      expect(respuestas.every(respuesta => respuesta.codigo < 500)).toBe(true);
    },
  );

  it.each([2, 5, 10, 20])(
    'descuenta una sola vez de caja la misma intencion ante %i solicitudes concurrentes',
    async cantidad => {
      const caja = await crearCajaAbierta(`misma_caja_${cantidad}`, 500);
      const clave = `${prefijo}misma_caja_${cantidad}`;
      const cuerpo = crearCuerpoGasto(clave, 100, true);
      const respuestas = Array.from({ length: cantidad }, () => crearRespuesta());

      await Promise.all(
        respuestas.map(respuesta =>
          ExpensesController.create(
            { body: cuerpo } as Request,
            respuesta as unknown as Response,
          ),
        ),
      );

      const cajaFinal = await prisma.cashRegister.findUniqueOrThrow({
        where: { id: caja.id },
      });
      expect(await prisma.expense.count({ where: { idempotencyKey: clave } })).toBe(1);
      expect(cajaFinal.expenses).toBe(100);
      expect(respuestas.filter(respuesta => respuesta.codigo === 201)).toHaveLength(1);
      expect(respuestas.filter(respuesta => respuesta.codigo === 200)).toHaveLength(cantidad - 1);
    },
  );

  it.each([1, 5, 10])(
    'aplica una sola vez un gasto de caja ante %i reintentos secuenciales',
    async reintentos => {
      const caja = await crearCajaAbierta(`retry_caja_${reintentos}`, 500);
      const clave = `${prefijo}retry_caja_${reintentos}`;
      const cuerpo = crearCuerpoGasto(clave, 100, true);
      const respuestas = Array.from({ length: reintentos + 1 }, () => crearRespuesta());

      for (const respuesta of respuestas) {
        await ExpensesController.create(
          { body: cuerpo } as Request,
          respuesta as unknown as Response,
        );
      }

      const cajaFinal = await prisma.cashRegister.findUniqueOrThrow({
        where: { id: caja.id },
      });
      expect(await prisma.expense.count({ where: { idempotencyKey: clave } })).toBe(1);
      expect(cajaFinal.expenses).toBe(100);
      expect(respuestas[0].codigo).toBe(201);
      expect(respuestas.slice(1).every(respuesta => respuesta.codigo === 200)).toBe(true);
    },
  );

  it.each([5, 10, 20])(
    'permite %i gastos legitimos iguales con claves distintas sin lost update',
    async cantidad => {
      const caja = await crearCajaAbierta(`distintos_${cantidad}`, 500);
      const respuestas = Array.from({ length: cantidad }, () => crearRespuesta());

      await Promise.all(
        respuestas.map((respuesta, indice) =>
          ExpensesController.create(
            {
              body: crearCuerpoGasto(
                `${prefijo}distinto_${cantidad}_${indice}`,
                10,
                true,
                `${prefijo}compra_igual`,
              ),
            } as Request,
            respuesta as unknown as Response,
          ),
        ),
      );

      const cajaFinal = await prisma.cashRegister.findUniqueOrThrow({
        where: { id: caja.id },
      });
      expect(respuestas.every(respuesta => respuesta.codigo === 201)).toBe(true);
      expect(
        await prisma.expense.count({
          where: { concept: `${prefijo}compra_igual` },
        }),
      ).toBe(cantidad);
      expect(cajaFinal.expenses).toBe(cantidad * 10);
    },
  );

  it('revierte el incremento de caja si falla la insercion de Expense', async () => {
    const caja = await crearCajaAbierta('rollback', 500);
    const clave = `${prefijo}rollback`;
    const respuesta = crearRespuesta();
    let errorRecibido: unknown;

    await ExpensesController.create(
      {
        body: {
          ...crearCuerpoGasto(clave, 100, true),
          userId: 2_147_483_647,
        },
      } as Request,
      respuesta as unknown as Response,
      error => {
        errorRecibido = error;
      },
    );

    expect(errorRecibido).toBeDefined();
    expect(await prisma.expense.count({ where: { idempotencyKey: clave } })).toBe(0);
    expect(
      (await prisma.cashRegister.findUniqueOrThrow({ where: { id: caja.id } })).expenses,
    ).toBe(0);
  });

  it('mantiene estados coherentes ante 20 carreras gasto vs cierre', async () => {
    for (let ronda = 0; ronda < 20; ronda += 1) {
      const caja = await crearCajaAbierta(`cierre_${ronda}`, 500);
      const clave = `${prefijo}cierre_${ronda}`;
      const respuestaGasto = crearRespuesta();
      const respuestaCierre = crearRespuesta();

      await Promise.all([
        ExpensesController.create(
          { body: crearCuerpoGasto(clave, 100, true) } as Request,
          respuestaGasto as unknown as Response,
        ),
        CashRegistersController.closeCurrent(
          { body: { closingAmount: 500 } } as Request,
          respuestaCierre as unknown as Response,
        ),
      ]);

      const [cajaFinal, gastos] = await Promise.all([
        prisma.cashRegister.findUniqueOrThrow({ where: { id: caja.id } }),
        prisma.expense.findMany({ where: { idempotencyKey: clave } }),
      ]);
      expect(respuestaCierre.codigo).toBe(200);
      expect(cajaFinal.status).toBe('closed');
      if (gastos.length === 1) {
        expect(respuestaGasto.codigo).toBe(201);
        expect(cajaFinal.expenses).toBe(100);
        expect(cajaFinal.expectedAmount).toBe(400);
      } else {
        expect(gastos).toHaveLength(0);
        expect([400, 409]).toContain(respuestaGasto.codigo);
        expect(cajaFinal.expenses).toBe(0);
        expect(cajaFinal.expectedAmount).toBe(500);
      }

      await limpiarDatosTemporales();
    }
  });

  it('concilia un pago en efectivo y un gasto concurrentes sin lost update', async () => {
    const caja = await crearCajaAbierta('pago_gasto', 500);
    const pedido = await crearPedidoPendiente('pago_gasto', 200);
    const respuestaPago = crearRespuesta();
    const respuestaGasto = crearRespuesta();

    await Promise.all([
      completarPedido(pedido.id, 'cash', respuestaPago),
      ExpensesController.create(
        {
          body: crearCuerpoGasto(`${prefijo}pago_gasto`, 50, true),
        } as Request,
        respuestaGasto as unknown as Response,
      ),
    ]);
    const cierre = crearRespuesta();
    await CashRegistersController.closeCurrent(
      { body: { closingAmount: 650 } } as Request,
      cierre as unknown as Response,
    );

    const cajaFinal = await prisma.cashRegister.findUniqueOrThrow({
      where: { id: caja.id },
    });
    expect(respuestaPago.codigo).toBe(200);
    expect(respuestaGasto.codigo).toBe(201);
    expect(cajaFinal.cashSales).toBe(200);
    expect(cajaFinal.expenses).toBe(50);
    expect(cajaFinal.expectedAmount).toBe(650);
  });

  it('concilia 10 pagos y 10 gastos concurrentes durante tres rondas', async () => {
    for (let ronda = 0; ronda < 3; ronda += 1) {
      const caja = await crearCajaAbierta(`mixto_${ronda}`, 1000);
      const pedidos = await Promise.all(
        Array.from({ length: 10 }, (_, indice) =>
          crearPedidoPendiente(`mixto_${ronda}_${indice}`, 10),
        ),
      );

      await Promise.all([
        ...pedidos.map(pedido => completarPedido(pedido.id, 'cash', crearRespuesta())),
        ...Array.from({ length: 10 }, (_, indice) =>
          ExpensesController.create(
            {
              body: crearCuerpoGasto(
                `${prefijo}mixto_${ronda}_${indice}`,
                5,
                true,
              ),
            } as Request,
            crearRespuesta() as unknown as Response,
          ),
        ),
      ]);
      await CashRegistersController.closeCurrent(
        { body: { closingAmount: 1050 } } as Request,
        crearRespuesta() as unknown as Response,
      );

      const cajaFinal = await prisma.cashRegister.findUniqueOrThrow({
        where: { id: caja.id },
      });
      expect(cajaFinal.cashSales).toBe(100);
      expect(cajaFinal.expenses).toBe(50);
      expect(cajaFinal.expectedAmount).toBe(1050);
      expect(cajaFinal.totalTransactions).toBe(10);
      await limpiarDatosTemporales();
    }
  });

  it.each([2, 5, 10])(
    'elimina una sola vez un gasto de caja ante %i eliminaciones concurrentes',
    async cantidad => {
      const caja = await crearCajaAbierta(`delete_${cantidad}`, 500);
      const clave = `${prefijo}delete_${cantidad}`;
      const creacion = crearRespuesta();
      await ExpensesController.create(
        { body: crearCuerpoGasto(clave, 100, true) } as Request,
        creacion as unknown as Response,
      );
      const gasto = creacion.cuerpo as { id: number };
      const respuestas = Array.from({ length: cantidad }, () => crearRespuesta());

      await Promise.all(
        respuestas.map(respuesta =>
          ExpensesController.remove(
            { params: { id: String(gasto.id) } } as unknown as Request,
            respuesta as unknown as Response,
          ),
        ),
      );

      expect(await prisma.expense.count({ where: { id: gasto.id } })).toBe(0);
      expect(respuestas.filter(respuesta => respuesta.codigo === 200)).toHaveLength(1);
      expect(respuestas.filter(respuesta => respuesta.codigo === 404)).toHaveLength(cantidad - 1);
      expect(
        (await prisma.cashRegister.findUniqueOrThrow({ where: { id: caja.id } })).expenses,
      ).toBe(0);
    },
  );

  it('elimina un gasto normal y responde 404 al segundo intento', async () => {
    const creacion = crearRespuesta();
    await ExpensesController.create(
      {
        body: crearCuerpoGasto(`${prefijo}delete_normal`, 40, false),
      } as Request,
      creacion as unknown as Response,
    );
    const gasto = creacion.cuerpo as { id: number };
    const primera = crearRespuesta();
    const segunda = crearRespuesta();

    await ExpensesController.remove(
      { params: { id: String(gasto.id) } } as unknown as Request,
      primera as unknown as Response,
    );
    await ExpensesController.remove(
      { params: { id: String(gasto.id) } } as unknown as Request,
      segunda as unknown as Response,
    );

    expect(primera.codigo).toBe(200);
    expect(segunda.codigo).toBe(404);
  });

  it.each([
    0,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_VALUE,
    'invalido',
    null,
    undefined,
  ])('rechaza el monto contable invalido %s', async amount => {
    const respuesta = crearRespuesta();
    await ExpensesController.create(
      {
        body: {
          ...crearCuerpoGasto(`${prefijo}invalido_${String(amount)}`, 1, false),
          amount,
        },
      } as Request,
      respuesta as unknown as Response,
    );
    expect(respuesta.codigo).toBe(400);
  });

  it('acepta un decimal positivo finito', async () => {
    const respuesta = crearRespuesta();
    await ExpensesController.create(
      {
        body: crearCuerpoGasto(`${prefijo}decimal`, 12.5, false),
      } as Request,
      respuesta as unknown as Response,
    );
    expect(respuesta.codigo).toBe(201);
    expect((respuesta.cuerpo as { amount: number }).amount).toBe(12.5);
  });

  it('reconcilia la simulacion contable completa durante tres rondas', async () => {
    for (let ronda = 0; ronda < 3; ronda += 1) {
      const caja = await crearCajaAbierta(`simulacion_${ronda}`, 1000);
      const ventas: Array<{ monto: number; metodo: 'cash' | 'card' }> = [
        { monto: 100, metodo: 'cash' },
        { monto: 200, metodo: 'cash' },
        { monto: 150, metodo: 'cash' },
        { monto: 300, metodo: 'card' },
        { monto: 250, metodo: 'card' },
      ];
      for (const [indice, venta] of ventas.entries()) {
        const pedido = await crearPedidoPendiente(
          `simulacion_${ronda}_${indice}`,
          venta.monto,
        );
        await completarPedido(pedido.id, venta.metodo, crearRespuesta());
      }
      for (const [indice, gasto] of [
        { monto: 50, caja: true },
        { monto: 75, caja: true },
        { monto: 120, caja: false },
      ].entries()) {
        await ExpensesController.create(
          {
            body: crearCuerpoGasto(
              `${prefijo}simulacion_${ronda}_${indice}`,
              gasto.monto,
              gasto.caja,
            ),
          } as Request,
          crearRespuesta() as unknown as Response,
        );
      }
      await CashRegistersController.closeCurrent(
        { body: { closingAmount: 1325 } } as Request,
        crearRespuesta() as unknown as Response,
      );

      const [cajaFinal, pagos, gastos] = await Promise.all([
        prisma.cashRegister.findUniqueOrThrow({ where: { id: caja.id } }),
        PaymentService.getPaymentsByDateRange(
          new Date(Date.now() - 60_000),
          new Date(Date.now() + 60_000),
        ),
        obtenerGastosDesdeControlador(),
      ]);
      const pagosPrueba = pagos.filter((pago: { order?: { customerName?: string } }) =>
        pago.order?.customerName?.startsWith(`${prefijo}simulacion_${ronda}_`),
      );
      const gastosPrueba = gastos.filter(gasto =>
        gasto.concept?.startsWith(`${prefijo}gasto_`),
      );

      expect(cajaFinal.cashSales).toBe(450);
      expect(cajaFinal.cardSales).toBe(550);
      expect(cajaFinal.expenses).toBe(125);
      expect(cajaFinal.expectedAmount).toBe(1325);
      expect(pagosPrueba.reduce((total: number, pago: { amount: number }) => total + pago.amount, 0)).toBe(1000);
      expect(gastosPrueba.reduce((total, gasto) => total + gasto.amount, 0)).toBe(245);
      expect(1000 - 245).toBe(755);
      await limpiarDatosTemporales();
    }
  });
});

function crearCuerpoGasto(
  idempotencyKey: string,
  amount: number,
  paidFromCashRegister: boolean,
  concept = `${prefijo}gasto_${idempotencyKey.slice(-20)}`,
) {
  return {
    idempotencyKey,
    concept,
    category: 'Pruebas',
    amount,
    paidFromCashRegister,
    timestamp: new Date(),
  };
}

async function crearCajaAbierta(sufijo: string, openingAmount: number) {
  return prisma.cashRegister.create({
    data: {
      openingAmount,
      cashSales: 0,
      cardSales: 0,
      expenses: 0,
      totalTransactions: 0,
      openedAt: new Date(Date.now() + 60_000),
      status: 'open',
      userRef: `${prefijo}${sufijo}`,
    },
  });
}

async function crearPedidoPendiente(sufijo: string, total: number) {
  return prisma.order.create({
    data: {
      status: 'pending',
      subtotal: total,
      tax: 0,
      total,
      customerName: `${prefijo}${sufijo}`,
    },
  });
}

async function completarPedido(
  id: number,
  paymentMethod: 'cash' | 'card',
  respuesta: ReturnType<typeof crearRespuesta>,
) {
  return OrderController.updateStatus(
    {
      params: { id: String(id) },
      body: {
        status: 'completed',
        paymentMethod,
        ...(paymentMethod === 'cash' ? { amountPaid: 1_000_000 } : {}),
      },
    } as unknown as Request,
    respuesta as unknown as Response,
  );
}

async function obtenerGastosDesdeControlador() {
  const respuesta = crearRespuesta();
  await ExpensesController.list(
    {
      query: {
        startDate: new Date(Date.now() - 60_000).toISOString(),
        endDate: new Date(Date.now() + 60_000).toISOString(),
      },
    } as unknown as Request,
    respuesta as unknown as Response,
  );
  return respuesta.cuerpo as Array<{ concept?: string; amount: number }>;
}

async function limpiarDatosTemporales() {
  await prisma.expense.deleteMany({
    where: { concept: { startsWith: prefijo } },
  });
  await prisma.order.deleteMany({
    where: { customerName: { startsWith: prefijo } },
  });
  await prisma.cashRegister.deleteMany({
    where: { userRef: { startsWith: prefijo } },
  });
}

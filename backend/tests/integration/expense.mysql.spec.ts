import { PrismaClient } from '@prisma/client';
import type { Request, Response } from 'express';
import { afterAll, describe, expect, it } from 'vitest';
import { ExpensesController } from '../../src/modules/expenses/expenses.controller';

const describirMysql =
  process.env.RUN_MYSQL_INTEGRATION === 'true' ? describe : describe.skip;
const prisma = new PrismaClient();
const prefijo = `test_gasto_${Date.now()}_`;

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

describirMysql('identificadores concurrentes de Expense en MySQL', () => {
  afterAll(async () => {
    await prisma.expense.deleteMany({
      where: { concept: { startsWith: prefijo } },
    });
    const restantes = await prisma.expense.count({
      where: { concept: { startsWith: prefijo } },
    });
    await prisma.$disconnect();
    expect(restantes).toBe(0);
  });

  it.each([2, 5, 10])(
    'crea %i gastos simultaneos con IDs unicos',
    async cantidad => {
      const prefijoLote = `${prefijo}${cantidad}_`;
      const respuestas = Array.from({ length: cantidad }, () =>
        crearRespuesta(),
      );

      await Promise.all(
        respuestas.map((respuesta, indice) =>
          ExpensesController.create(
            {
              body: {
                concept: `${prefijoLote}${indice}`,
                category: 'Pruebas',
                amount: 1,
                paidFromCashRegister: false,
              },
            } as Request,
            respuesta as unknown as Response,
          ),
        ),
      );

      expect(respuestas.every(respuesta => respuesta.codigo === 201)).toBe(true);
      const filas = await prisma.expense.findMany({
        where: { concept: { startsWith: prefijoLote } },
        orderBy: { id: 'asc' },
      });
      const identificadores = filas.map(fila => fila.id);

      expect(filas).toHaveLength(cantidad);
      expect(new Set(identificadores).size).toBe(cantidad);
      expect(identificadores.every(Number.isInteger)).toBe(true);
    },
  );
});

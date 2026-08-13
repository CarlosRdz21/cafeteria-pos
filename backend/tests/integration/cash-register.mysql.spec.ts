import { PrismaClient } from '@prisma/client';
import type { Request, Response } from 'express';
import { afterAll, describe, expect, it } from 'vitest';
import { CashRegistersController } from '../../src/modules/cash/cash-registers.controller';

const describirMysql =
  process.env.RUN_MYSQL_INTEGRATION === 'true' ? describe : describe.skip;
const prisma = new PrismaClient();
const prefijo = `test_caja_${Date.now()}_`;

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

describirMysql('apertura global concurrente de caja en MySQL', () => {
  afterAll(async () => {
    await prisma.cashRegister.deleteMany({
      where: { userRef: { startsWith: prefijo } },
    });
    const restantes = await prisma.cashRegister.count({
      where: { userRef: { startsWith: prefijo } },
    });
    await prisma.$disconnect();
    expect(restantes).toBe(0);
  });

  it.each([2, 5, 10])(
    'permite una sola caja de %i aperturas simultaneas',
    async cantidad => {
      const prefijoLote = `${prefijo}${cantidad}_`;
      const cajaPreexistente = await prisma.cashRegister.findFirst({
        where: { status: 'open' },
        select: { id: true },
      });
      const respuestas = Array.from({ length: cantidad }, () =>
        crearRespuesta(),
      );

      try {
        await Promise.all(
          respuestas.map((respuesta, indice) =>
            CashRegistersController.open(
              {
                body: {
                  openingAmount: 100,
                  userId: `${prefijoLote}${indice}`,
                },
              } as Request,
              respuesta as unknown as Response,
            ),
          ),
        );

        const cajas = await prisma.cashRegister.findMany({
          where: { userRef: { startsWith: prefijoLote } },
        });
        if (cajaPreexistente) {
          expect(cajas).toHaveLength(0);
          expect(respuestas.filter(respuesta => respuesta.codigo === 409)).toHaveLength(
            cantidad,
          );
          return;
        }

        expect(cajas).toHaveLength(1);
        expect(respuestas.filter(respuesta => respuesta.codigo === 201)).toHaveLength(1);
        expect(respuestas.filter(respuesta => respuesta.codigo === 409)).toHaveLength(
          cantidad - 1,
        );
      } finally {
        await prisma.cashRegister.deleteMany({
          where: { userRef: { startsWith: prefijoLote } },
        });
      }
    },
  );
});

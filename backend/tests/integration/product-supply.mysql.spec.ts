import { PrismaClient } from '@prisma/client';
import type { Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SuppliesController } from '../../src/modules/inventory/supplies.controller';

const describirMysql =
  process.env.RUN_MYSQL_INTEGRATION === 'true' ? describe : describe.skip;
const prisma = new PrismaClient();
const prefijo = `test_insumo_${Date.now()}_`;
let categoriaId = 0;

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

describirMysql('identificadores concurrentes de ProductSupply en MySQL', () => {
  beforeAll(async () => {
    const categoria = await prisma.supplyCategory.create({
      data: {
        name: `${prefijo}categoria`,
        active: true,
        sortOrder: 1,
      },
    });
    categoriaId = categoria.id;
  });

  afterAll(async () => {
    await prisma.productSupply.deleteMany({
      where: { name: { startsWith: prefijo } },
    });
    await prisma.supplyCategory.deleteMany({
      where: { name: { startsWith: prefijo } },
    });
    const restantes = await prisma.productSupply.count({
      where: { name: { startsWith: prefijo } },
    });
    await prisma.$disconnect();
    expect(restantes).toBe(0);
  });

  it.each([2, 5, 10])(
    'crea %i insumos simultaneos con IDs unicos',
    async cantidad => {
      const prefijoLote = `${prefijo}${cantidad}_`;
      const respuestas = Array.from({ length: cantidad }, () =>
        crearRespuesta(),
      );

      await Promise.all(
        respuestas.map((respuesta, indice) =>
          SuppliesController.create(
            {
              body: {
                name: `${prefijoLote}${indice}`,
                unit: 'pieza',
                categoryId: categoriaId,
                currentStock: 0,
              },
            } as Request,
            respuesta as unknown as Response,
          ),
        ),
      );

      expect(respuestas.every(respuesta => respuesta.codigo === 201)).toBe(true);
      const filas = await prisma.productSupply.findMany({
        where: { name: { startsWith: prefijoLote } },
        orderBy: { id: 'asc' },
      });
      const identificadores = filas.map(fila => fila.id);

      expect(filas).toHaveLength(cantidad);
      expect(new Set(identificadores).size).toBe(cantidad);
      expect(identificadores.every(Number.isInteger)).toBe(true);
    },
  );
});

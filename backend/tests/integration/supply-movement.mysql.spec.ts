import { PrismaClient } from '@prisma/client';
import type { Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SupplyMovementsController } from '../../src/modules/inventory/supply-movements.controller';

const describirMysql =
  process.env.RUN_MYSQL_INTEGRATION === 'true' ? describe : describe.skip;
const prisma = new PrismaClient();
const prefijo = `test_movimiento_${Date.now()}_`;
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

describirMysql('movimientos e inventario concurrente en MySQL', () => {
  beforeAll(async () => {
    const categoria = await prisma.supplyCategory.create({
      data: { name: `${prefijo}categoria`, active: true, sortOrder: 1 },
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
    const movimientosRestantes = await prisma.supplyMovement.count({
      where: { reference: { startsWith: prefijo } },
    });
    await prisma.$disconnect();
    expect(movimientosRestantes).toBe(0);
  });

  it.each([2, 5, 10])(
    'registra %i entradas simultaneas con IDs unicos y suma atomica',
    async cantidad => {
      const referencia = `${prefijo}entrada_${cantidad}_`;
      const insumo = await prisma.productSupply.create({
        data: {
          name: `${prefijo}insumo_entrada_${cantidad}`,
          categoryId: categoriaId,
          categoryName: `${prefijo}categoria`,
          unit: 'pieza',
          currentStock: 0,
          active: true,
        },
      });
      const respuestas = Array.from({ length: cantidad }, () =>
        crearRespuesta(),
      );

      await Promise.all(
        respuestas.map((respuesta, indice) =>
          SupplyMovementsController.entry(
            {
              body: {
                supplyId: insumo.id,
                quantity: 1,
                reference: `${referencia}${indice}`,
              },
            } as Request,
            respuesta as unknown as Response,
          ),
        ),
      );

      const movimientos = await prisma.supplyMovement.findMany({
        where: { reference: { startsWith: referencia } },
      });
      const insumoFinal = await prisma.productSupply.findUniqueOrThrow({
        where: { id: insumo.id },
      });

      expect(respuestas.every(respuesta => respuesta.codigo === 201)).toBe(true);
      expect(movimientos).toHaveLength(cantidad);
      expect(new Set(movimientos.map(movimiento => movimiento.id)).size).toBe(
        cantidad,
      );
      expect(insumoFinal.currentStock).toBe(cantidad);
    },
  );

  it('rechaza una de dos salidas simultaneas cuando el stock solo alcanza para una', async () => {
    const referencia = `${prefijo}salida_atomica_`;
    const insumo = await prisma.productSupply.create({
      data: {
        name: `${prefijo}insumo_salida`,
        categoryId: categoriaId,
        categoryName: `${prefijo}categoria`,
        unit: 'pieza',
        currentStock: 10,
        unitCost: 2,
        active: true,
      },
    });
    const respuestas = [crearRespuesta(), crearRespuesta()];

    await Promise.all(
      respuestas.map((respuesta, indice) =>
        SupplyMovementsController.exit(
          {
            body: {
              supplyId: insumo.id,
              quantity: 6,
              reference: `${referencia}${indice}`,
            },
          } as Request,
          respuesta as unknown as Response,
        ),
      ),
    );

    const insumoFinal = await prisma.productSupply.findUniqueOrThrow({
      where: { id: insumo.id },
    });
    const movimientos = await prisma.supplyMovement.count({
      where: { reference: { startsWith: referencia } },
    });

    expect(respuestas.map(respuesta => respuesta.codigo).sort()).toEqual([
      201, 400,
    ]);
    expect(insumoFinal.currentStock).toBe(4);
    expect(movimientos).toBe(1);
  });
});

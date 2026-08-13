import { describe, expect, it } from 'vitest';

const {
  argumentosPrisma,
  // El ejecutor protegido es CommonJS para poder invocarse directamente.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
} = require('../scripts/deploy-test-migrations.js') as {
  argumentosPrisma: (argumentos: string[]) => string[];
};

describe('acciones permitidas por el ejecutor de migraciones aisladas', () => {
  it('usa migrate deploy cuando no recibe una accion especial', () => {
    expect(argumentosPrisma([])).toEqual([
      'migrate',
      'deploy',
      '--schema',
      'prisma/schema.mysql.prisma',
    ]);
  });

  it('permite marcar una migracion valida como revertida', () => {
    expect(
      argumentosPrisma([
        'resolve-rolled-back',
        '20260723153500_payment_order_unique',
      ]),
    ).toEqual([
      'migrate',
      'resolve',
      '--rolled-back',
      '20260723153500_payment_order_unique',
      '--schema',
      'prisma/schema.mysql.prisma',
    ]);
  });

  it('permite consultar el estado sin modificar migraciones', () => {
    expect(argumentosPrisma(['status'])).toEqual([
      'migrate',
      'status',
      '--schema',
      'prisma/schema.mysql.prisma',
    ]);
  });

  it('rechaza nombres y acciones arbitrarias', () => {
    expect(() =>
      argumentosPrisma(['resolve-rolled-back', '../migracion']),
    ).toThrow('no permitida');
    expect(() => argumentosPrisma(['db-push'])).toThrow('no permitida');
  });
});

import { describe, expect, it } from 'vitest';

const {
  analizarPermisos,
  // La utilidad ejecutable usa CommonJS para poder invocarse directamente con Node.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
} = require('../scripts/inspect-test-database.js') as {
  analizarPermisos: (
    permisos: string[],
    nombreBaseDatos: string,
  ) => {
    exclusivoBasePruebas: boolean;
    cantidadPermisos: number;
    cantidadAlcancesExternos: number;
    cantidadPrivilegiosProhibidos: number;
  };
};

describe('revision de permisos del usuario MySQL de pruebas', () => {
  it('acepta USAGE global y permisos limitados a la base aislada', () => {
    expect(
      analizarPermisos(
        [
          'GRANT USAGE ON *.* TO `usuario_test`@`localhost`',
          'GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON `cafeteria_pos_test`.* TO `usuario_test`@`localhost`',
        ],
        'cafeteria_pos_test',
      ),
    ).toEqual({
      exclusivoBasePruebas: true,
      cantidadPermisos: 2,
      cantidadAlcancesExternos: 0,
      cantidadPrivilegiosProhibidos: 0,
    });
  });

  it('rechaza permisos globales', () => {
    const resultado = analizarPermisos(
      ['GRANT SELECT, INSERT ON *.* TO `usuario_test`@`localhost`'],
      'cafeteria_pos_test',
    );

    expect(resultado.exclusivoBasePruebas).toBe(false);
    expect(resultado.cantidadAlcancesExternos).toBe(1);
  });

  it('rechaza privilegios administrativos aunque el alcance sea la base', () => {
    const resultado = analizarPermisos(
      ['GRANT SELECT, FILE ON `cafeteria_pos_test`.* TO `usuario_test`@`localhost`'],
      'cafeteria_pos_test',
    );

    expect(resultado.exclusivoBasePruebas).toBe(false);
    expect(resultado.cantidadPrivilegiosProhibidos).toBe(1);
  });
});

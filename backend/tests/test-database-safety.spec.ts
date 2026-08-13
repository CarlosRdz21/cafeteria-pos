import { describe, expect, it } from 'vitest';

const {
  ocultarCredencialesBaseDatos,
  validarConfiguracionBasePruebas,
  // El script de smoke se ejecuta directamente con Node en CommonJS.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
} = require('../scripts/test-database-safety.js') as {
  ocultarCredencialesBaseDatos: (url: string) => string;
  validarConfiguracionBasePruebas: (
    env: NodeJS.ProcessEnv,
    opciones?: { requerirDestructiva?: boolean },
  ) => {
    host: string;
    puerto: number;
    nombreBaseDatos: string;
    entorno: string;
    urlOculta: string;
  };
};

function entornoSeguro(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    ALLOW_DESTRUCTIVE_TESTS: 'true',
    DATABASE_URL: 'mysql://usuario_test:clave-no-real@127.0.0.1:3306/cafeteria_pos_test',
    TEST_DATABASE_URL: 'mysql://usuario_test:clave-no-real@127.0.0.1:3306/cafeteria_pos_test',
    PRODUCTION_DATABASE_URL: 'mysql://usuario_prod:otra-clave@servidor:3306/cafeteria_pos',
  };
}

describe('proteccion central de la base MySQL de pruebas', () => {
  it('bloquea NODE_ENV=production', () => {
    expect(() =>
      validarConfiguracionBasePruebas({
        ...entornoSeguro(),
        NODE_ENV: 'production',
      }),
    ).toThrow('NODE_ENV=production');
  });

  it('rechaza una URL ausente', () => {
    expect(() =>
      validarConfiguracionBasePruebas({
        ...entornoSeguro(),
        TEST_DATABASE_URL: '',
      }),
    ).toThrow('TEST_DATABASE_URL');
  });

  it('rechaza una DATABASE_URL distinta de TEST_DATABASE_URL', () => {
    expect(() =>
      validarConfiguracionBasePruebas({
        ...entornoSeguro(),
        DATABASE_URL: 'mysql://usuario_test:clave-no-real@127.0.0.1:3306/otra_test',
      }),
    ).toThrow('exactamente a TEST_DATABASE_URL');
  });

  it('rechaza que la URL de pruebas sea igual a produccion', () => {
    const env = entornoSeguro();
    env.PRODUCTION_DATABASE_URL = env.TEST_DATABASE_URL;

    expect(() => validarConfiguracionBasePruebas(env)).toThrow('PRODUCTION_DATABASE_URL');
  });

  it('rechaza localhost cuando el nombre no contiene marcador de prueba', () => {
    const env = entornoSeguro();
    env.DATABASE_URL = 'mysql://usuario_test:clave-no-real@localhost:3306/cafeteria_pos';
    env.TEST_DATABASE_URL = env.DATABASE_URL;

    expect(() => validarConfiguracionBasePruebas(env)).toThrow('cafeteria_pos_test');
  });

  it('rechaza bases de prueba remotas aunque su nombre parezca seguro', () => {
    const env = entornoSeguro();
    env.DATABASE_URL =
      'mysql://usuario_test:clave-no-real@db.remota.invalid:3306/cafeteria_pos_test';
    env.TEST_DATABASE_URL = env.DATABASE_URL;

    expect(() => validarConfiguracionBasePruebas(env)).toThrow(
      'localhost o 127.0.0.1',
    );
  });

  it('rechaza referencias a Render o Hostinger', () => {
    const env = entornoSeguro();
    env.DATABASE_URL =
      'mysql://usuario_test:clave-no-real@render.localhost:3306/cafeteria_pos_test';
    env.TEST_DATABASE_URL = env.DATABASE_URL;

    expect(() => validarConfiguracionBasePruebas(env)).toThrow(
      'localhost o 127.0.0.1',
    );
  });

  it('oculta la contrasena al describir la conexion', () => {
    const url = String(entornoSeguro().TEST_DATABASE_URL);
    const urlOculta = ocultarCredencialesBaseDatos(url);

    expect(urlOculta).toBe('mysql://***:***@127.0.0.1:3306/cafeteria_pos_test');
    expect(urlOculta).not.toContain('clave-no-real');
    expect(urlOculta).not.toContain('usuario_test');
  });

  it('acepta una configuracion aislada completa', () => {
    expect(
      validarConfiguracionBasePruebas(entornoSeguro(), {
        requerirDestructiva: true,
      }),
    ).toEqual({
      host: '127.0.0.1',
      puerto: 3306,
      nombreBaseDatos: 'cafeteria_pos_test',
      entorno: 'test',
      urlOculta: 'mysql://***:***@127.0.0.1:3306/cafeteria_pos_test',
    });
  });

  it('exige autorizacion explicita para operaciones destructivas', () => {
    expect(() =>
      validarConfiguracionBasePruebas(
        {
          ...entornoSeguro(),
          ALLOW_DESTRUCTIVE_TESTS: 'false',
        },
        { requerirDestructiva: true },
      ),
    ).toThrow('ALLOW_DESTRUCTIVE_TESTS=true');
  });
});

import { describe, expect, it } from 'vitest';

const { validarEntorno } = require('../scripts/smoke-api.js') as {
  validarEntorno: (env: NodeJS.ProcessEnv) => {
    baseUrl: string;
    adminUsername: string;
    adminPassword: string;
  };
};

function entornoSeguro(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    ALLOW_DESTRUCTIVE_TESTS: 'true',
    DATABASE_URL: 'mysql://usuario:clave@127.0.0.1:3306/cafeteria_pos_test',
    TEST_DATABASE_URL: 'mysql://usuario:clave@127.0.0.1:3306/cafeteria_pos_test',
    PRODUCTION_DATABASE_URL: 'mysql://usuario:clave@produccion:3306/cafeteria_pos',
    TEST_BASE_URL: 'http://127.0.0.1:3001/',
    TEST_ADMIN_USERNAME: 'admin-pruebas',
    TEST_ADMIN_PASSWORD: 'valor-solo-simulado',
  };
}

describe('seguridad del smoke test', () => {
  it('rechaza ejecutarse en produccion aunque exista autorizacion', () => {
    expect(() => validarEntorno({ ...entornoSeguro(), NODE_ENV: 'production' }))
      .toThrow('NODE_ENV=production');
  });

  it('rechaza una base sin marcador explicito de pruebas', () => {
    const env = entornoSeguro();
    env.DATABASE_URL = 'mysql://usuario:clave@127.0.0.1:3306/cafeteria_pos';
    env.TEST_DATABASE_URL = env.DATABASE_URL;

    expect(() => validarEntorno(env)).toThrow('exclusivamente cafeteria_pos_test');
  });

  it('rechaza cuando la base activa no coincide con TEST_DATABASE_URL', () => {
    const env = entornoSeguro();
    env.DATABASE_URL = 'mysql://usuario:clave@127.0.0.1:3306/otra_test';

    expect(() => validarEntorno(env)).toThrow('exactamente a TEST_DATABASE_URL');
  });

  it('rechaza una URL marcada como produccion', () => {
    const env = entornoSeguro();
    env.PRODUCTION_DATABASE_URL = env.TEST_DATABASE_URL;

    expect(() => validarEntorno(env)).toThrow('PRODUCTION_DATABASE_URL');
  });

  it('acepta solo una configuracion aislada completa', () => {
    expect(validarEntorno(entornoSeguro())).toEqual({
      baseUrl: 'http://127.0.0.1:3001',
      adminUsername: 'admin-pruebas',
      adminPassword: 'valor-solo-simulado',
    });
  });
});

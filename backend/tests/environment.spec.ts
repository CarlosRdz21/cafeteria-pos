import { describe, expect, it } from 'vitest';
import { validateEnvironment } from '../src/config/environment';

const validEnvironment = {
  DATABASE_URL: 'mysql://usuario:contrasena@localhost:3306/cafeteria_pruebas',
  JWT_SECRET: 'secreto-de-pruebas-con-mas-de-32-caracteres',
  JWT_EXPIRES_IN: '8h',
  FRONTEND_ORIGINS: 'http://localhost:4200,https://cafeteria.example',
  SOCKET_ORIGINS: 'http://localhost:4200',
  NODE_ENV: 'test',
  PORT: '3000',
  JSON_BODY_LIMIT: '1mb',
} as NodeJS.ProcessEnv;

describe('validateEnvironment', () => {
  it('acepta una configuración válida', () => {
    expect(() => validateEnvironment(validEnvironment)).not.toThrow();
  });

  it('rechaza variables obligatorias ausentes sin exponer valores', () => {
    const environment = { ...validEnvironment, JWT_SECRET: '' };

    expect(() => validateEnvironment(environment)).toThrow('JWT_SECRET');
  });

  it('rechaza secretos JWT demasiado cortos', () => {
    const environment = { ...validEnvironment, JWT_SECRET: 'corto' };

    expect(() => validateEnvironment(environment)).toThrow('al menos 32 caracteres');
  });

  it('rechaza puertos y orígenes inválidos', () => {
    expect(() => validateEnvironment({ ...validEnvironment, PORT: '70000' }))
      .toThrow('PORT');
    expect(() => validateEnvironment({ ...validEnvironment, FRONTEND_ORIGINS: '*' }))
      .toThrow('comodín');
    expect(() => validateEnvironment({ ...validEnvironment, SOCKET_ORIGINS: '*' }))
      .toThrow('comodín');
  });

  it('exige modo de sólo lectura para el clon histórico', () => {
    const cloneEnvironment = {
      ...validEnvironment,
      DATABASE_URL: 'mysql://usuario:contrasena@localhost:3306/cafeteria_pos_prod_clone',
    };

    expect(() => validateEnvironment(cloneEnvironment))
      .toThrow('CLONE_READ_ONLY=true');
    expect(() => validateEnvironment({
      ...cloneEnvironment,
      CLONE_READ_ONLY: 'true',
    })).not.toThrow();
  });
});

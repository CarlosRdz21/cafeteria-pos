import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app, resolveAllowedOrigins } from '../src/app';

describe('rutas protegidas', () => {
  let server: Server;
  let baseUrl: string;
  const jwtSecretAnterior = process.env.JWT_SECRET;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'secreto-exclusivo-rutas-seguridad';
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No se pudo iniciar el servidor de pruebas');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
    if (jwtSecretAnterior === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = jwtSecretAnterior;
  });

  it.each([
    '/api/users',
    '/api/printer-settings',
    '/api/products',
    '/api/product-categories',
    '/api/promotions',
    '/api/supplies',
    '/api/supply-categories',
    '/api/supply-movements',
    '/api/expenses',
    '/api/cash-registers',
    '/api/orders',
    '/api/payments/reports',
    '/api/auth/debug/users',
  ])(
    'rechaza sin JWT la ruta %s',
    async endpoint => {
      const response = await fetch(`${baseUrl}${endpoint}`);

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: 'No token' });
    },
  );

  it.each([
    ['GET', '/api/users', 'barista'],
    ['POST', '/api/products', 'barista'],
    ['POST', '/api/product-categories', 'barista'],
    ['PUT', '/api/promotions', 'barista'],
    ['GET', '/api/supplies', 'barista'],
    ['GET', '/api/supply-categories', 'barista'],
    ['GET', '/api/supply-movements', 'mesero'],
    ['GET', '/api/expenses', 'mesero'],
  ])('rechaza con 403 %s %s para el rol %s', async (method, endpoint, role) => {
    const token = jwt.sign({ userId: 2, role }, process.env.JWT_SECRET!);
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: method === 'GET' ? undefined : '{}',
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it.each([
    ['GET', '/api/cash-registers', 'mesero'],
    ['GET', '/api/orders', 'desconocido'],
    ['GET', '/api/payments/reports', 'mesero'],
    ['GET', '/api/auth/debug/users', 'barista'],
  ])('rechaza con 403 %s %s para el rol operativo %s', async (method, endpoint, role) => {
    const token = jwt.sign({ userId: 3, role }, process.env.JWT_SECRET!);
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it.each([
    'http://localhost:4200',
    'http://127.0.0.1:4200',
  ])('acepta el origen local %s', async origin => {
    const response = await fetch(`${baseUrl}/api/health`, { headers: { origin } });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(origin);
  });

  it('deshabilita cache para respuestas dinamicas de la API', async () => {
    const response = await fetch(`${baseUrl}/api/health`);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it.each([
    'https://origen-no-autorizado.example',
    'https://servicio.onrender.com',
    'https://dulcearomacafeteria.com',
  ])('rechaza el origen externo %s', async origin => {
    const response = await fetch(`${baseUrl}/api/health`, { headers: { origin } });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Origin not allowed' });
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('en producción permite sólo los orígenes configurados explícitamente', () => {
    const origins = resolveAllowedOrigins({
      NODE_ENV: 'production',
      FRONTEND_ORIGINS: 'https://frontend.example.com',
      SOCKET_ORIGINS: 'https://tablet.example.com',
    });

    expect(origins).toEqual(new Set([
      'https://frontend.example.com',
      'https://tablet.example.com',
    ]));
    expect(origins.has('http://localhost:4200')).toBe(false);
  });
});

import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaSimulado = vi.hoisted(() => ({
  buscarUsuario: vi.fn(),
}));

vi.mock('../src/config/prisma', () => ({
  prisma: {
    user: { findUnique: prismaSimulado.buscarUsuario },
  },
}));

import { authenticateSocketToken, getRoomForRole } from '../src/sockets/socket';
import { isSocketOriginAllowed } from '../src/app';

describe('seguridad Socket.IO', () => {
  const jwtSecretAnterior = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'secreto-exclusivo-socket-con-32-caracteres';
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (jwtSecretAnterior === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = jwtSecretAnterior;
  });

  it('usa el rol vigente de un usuario activo y no el rol incluido en el token', async () => {
    prismaSimulado.buscarUsuario.mockResolvedValue({ id: 5, role: 'barista', active: true });
    const token = jwt.sign({ userId: 5, role: 'admin' }, process.env.JWT_SECRET!);

    await expect(authenticateSocketToken(token)).resolves.toEqual({ userId: 5, role: 'barista' });
    expect(getRoomForRole('barista')).toBe('baristas');
  });

  it('asigna mesero a su sala operativa y nunca a admins', () => {
    expect(getRoomForRole('mesero')).toBe('waiters');
    expect(getRoomForRole('waiter')).toBe('waiters');
    expect(getRoomForRole('rol-desconocido')).toBeUndefined();
  });

  it('rechaza usuario inexistente, inactivo o con rol desconocido', async () => {
    const token = jwt.sign({ userId: 6, role: 'admin' }, process.env.JWT_SECRET!);

    prismaSimulado.buscarUsuario.mockResolvedValueOnce(null);
    await expect(authenticateSocketToken(token)).rejects.toThrow('Invalid token');

    prismaSimulado.buscarUsuario.mockResolvedValueOnce({ id: 6, role: 'admin', active: false });
    await expect(authenticateSocketToken(token)).rejects.toThrow('Invalid token');

    prismaSimulado.buscarUsuario.mockResolvedValueOnce({ id: 6, role: 'desconocido', active: true });
    await expect(authenticateSocketToken(token)).rejects.toThrow('Invalid token');
  });

  it('rechaza token expirado', async () => {
    const token = jwt.sign({ userId: 7, role: 'admin' }, process.env.JWT_SECRET!, { expiresIn: -1 });

    await expect(authenticateSocketToken(token)).rejects.toThrow('Invalid token');
    expect(prismaSimulado.buscarUsuario).not.toHaveBeenCalled();
  });

  it('permite orígenes locales y rechaza destinos externos', () => {
    expect(isSocketOriginAllowed('http://localhost:4200')).toBe(true);
    expect(isSocketOriginAllowed('http://127.0.0.1:4200')).toBe(true);
    expect(isSocketOriginAllowed('https://servicio.onrender.com')).toBe(false);
    expect(isSocketOriginAllowed('https://dulcearomacafeteria.com')).toBe(false);
    expect(isSocketOriginAllowed('https://externo.example')).toBe(false);
  });
});

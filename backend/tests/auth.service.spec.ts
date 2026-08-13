import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthRepository } from '../src/modules/auth/auth.repository';
import { AuthService } from '../src/modules/auth/auth.service';

describe('AuthService', () => {
  const jwtSecretAnterior = process.env.JWT_SECRET;
  const jwtExpiresInAnterior = process.env.JWT_EXPIRES_IN;

  const usuarioBase = {
    id: 7,
    username: 'administrador',
    email: null,
    password: '',
    name: 'Administración',
    role: 'admin',
    active: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    process.env.JWT_SECRET = 'secreto-exclusivo-para-pruebas';
    process.env.JWT_EXPIRES_IN = '1h';
  });

  afterEach(() => {
    vi.restoreAllMocks();

    if (jwtSecretAnterior === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = jwtSecretAnterior;

    if (jwtExpiresInAnterior === undefined) delete process.env.JWT_EXPIRES_IN;
    else process.env.JWT_EXPIRES_IN = jwtExpiresInAnterior;
  });

  it('inicia sesión con bcrypt y devuelve el contrato actual', async () => {
    const passwordHash = await bcrypt.hash('clave-correcta', 4);
    vi.spyOn(AuthRepository, 'findByUsername').mockResolvedValue({
      ...usuarioBase,
      password: passwordHash,
    });
    const actualizarPassword = vi.spyOn(AuthRepository, 'updatePassword').mockResolvedValue();

    const resultado = await AuthService.login('administrador', 'clave-correcta');
    const payload = jwt.verify(resultado.token, process.env.JWT_SECRET!) as jwt.JwtPayload;

    expect(resultado.user).toEqual({ id: 7, name: 'Administración', role: 'admin' });
    expect(resultado.user).not.toHaveProperty('password');
    expect(payload).toMatchObject({ userId: 7, role: 'admin' });
    expect(actualizarPassword).not.toHaveBeenCalled();
  });

  it('rechaza una contraseña incorrecta con el error genérico', async () => {
    const passwordHash = await bcrypt.hash('clave-correcta', 4);
    vi.spyOn(AuthRepository, 'findByUsername').mockResolvedValue({
      ...usuarioBase,
      password: passwordHash,
    });

    await expect(AuthService.login('administrador', 'clave-incorrecta'))
      .rejects.toThrow('Invalid credentials');
  });

  it('migra una contraseña legacy válida y permite el siguiente login con bcrypt', async () => {
    const usuarioLegacy = {
      ...usuarioBase,
      id: 8,
      username: 'barista',
      name: 'Barista',
      role: 'barista',
      password: 'clave-legacy',
    };
    const buscarUsuario = vi.spyOn(AuthRepository, 'findByUsername');
    const actualizarPassword = vi.spyOn(AuthRepository, 'updatePassword').mockResolvedValue();
    buscarUsuario.mockResolvedValueOnce(usuarioLegacy);

    await AuthService.login('barista', 'clave-legacy');

    expect(actualizarPassword).toHaveBeenCalledOnce();
    const hashMigrado = actualizarPassword.mock.calls[0][1];
    expect(hashMigrado).toMatch(/^\$2[aby]\$/);
    await expect(bcrypt.compare('clave-legacy', hashMigrado)).resolves.toBe(true);

    buscarUsuario.mockResolvedValueOnce({ ...usuarioLegacy, password: hashMigrado });
    await expect(AuthService.login('barista', 'clave-legacy')).resolves.toMatchObject({
      user: { id: 8, role: 'barista' },
    });
    expect(actualizarPassword).toHaveBeenCalledOnce();
  });

  it('responde con el mismo error genérico para un usuario inexistente', async () => {
    vi.spyOn(AuthRepository, 'findByUsername').mockResolvedValue(null);

    await expect(AuthService.login('usuario-inexistente', 'cualquier-clave'))
      .rejects.toThrow('Invalid credentials');
  });

  it('rechaza un usuario inactivo antes de comparar una contraseña bcrypt', async () => {
    const compararContrasena = vi.spyOn(bcrypt, 'compare');
    const firmarToken = vi.spyOn(jwt, 'sign');
    const actualizarPassword = vi.spyOn(AuthRepository, 'updatePassword').mockResolvedValue();
    vi.spyOn(AuthRepository, 'findByUsername').mockResolvedValue({
      ...usuarioBase,
      active: false,
      password: await bcrypt.hash('clave-correcta', 4),
    });
    compararContrasena.mockClear();

    await expect(AuthService.login('administrador', 'clave-correcta'))
      .rejects.toThrow('Invalid credentials');

    expect(compararContrasena).not.toHaveBeenCalled();
    expect(actualizarPassword).not.toHaveBeenCalled();
    expect(firmarToken).not.toHaveBeenCalled();
  });

  it('mantiene el error genérico para un usuario inactivo con contraseña incorrecta', async () => {
    const compararContrasena = vi.spyOn(bcrypt, 'compare');
    vi.spyOn(AuthRepository, 'findByUsername').mockResolvedValue({
      ...usuarioBase,
      active: false,
      password: await bcrypt.hash('clave-correcta', 4),
    });
    compararContrasena.mockClear();

    await expect(AuthService.login('administrador', 'clave-incorrecta'))
      .rejects.toThrow('Invalid credentials');

    expect(compararContrasena).not.toHaveBeenCalled();
  });

  it('no migra contraseña legacy ni genera JWT para un usuario inactivo', async () => {
    const generarHash = vi.spyOn(bcrypt, 'hash');
    const firmarToken = vi.spyOn(jwt, 'sign');
    const actualizarPassword = vi.spyOn(AuthRepository, 'updatePassword').mockResolvedValue();
    vi.spyOn(AuthRepository, 'findByUsername').mockResolvedValue({
      ...usuarioBase,
      active: false,
      password: 'clave-legacy',
    });

    await expect(AuthService.login('administrador', 'clave-legacy'))
      .rejects.toThrow('Invalid credentials');

    expect(generarHash).not.toHaveBeenCalled();
    expect(actualizarPassword).not.toHaveBeenCalled();
    expect(firmarToken).not.toHaveBeenCalled();
  });
});

import { estaJwtExpirado } from './auth.service';

function createToken(payload: Record<string, unknown>): string {
  const encoded = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `cabecera.${encoded}.firma`;
}

describe('seguridad de sesión', () => {
  it('detecta un JWT expirado', () => {
    expect(estaJwtExpirado(createToken({ exp: 100 }), 101)).toBeTrue();
  });

  it('acepta temporalmente un JWT cuya expiración sigue vigente', () => {
    expect(estaJwtExpirado(createToken({ exp: 200 }), 100)).toBeFalse();
  });

  it('trata tokens inválidos o sin expiración como no autenticados', () => {
    expect(estaJwtExpirado('token-invalido')).toBeTrue();
    expect(estaJwtExpirado(createToken({ role: 'admin' }), 100)).toBeTrue();
  });
});

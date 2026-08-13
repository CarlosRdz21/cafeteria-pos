import {
  DEFAULT_SERVER_URL,
  getServerUrl,
  guardarUrlServidorLocal,
  validarUrlServidorLocal
} from './server.config';

describe('Configuración local del servidor', () => {
  beforeEach(() => localStorage.clear());

  it('usa localhost:3000 de forma predeterminada', () => {
    expect(getServerUrl()).toBe(DEFAULT_SERVER_URL);
  });

  it('acepta únicamente los hosts locales esperados', () => {
    expect(validarUrlServidorLocal('http://localhost:3000/')).toBe('http://localhost:3000');
    expect(validarUrlServidorLocal('http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000');
  });

  it('rechaza Render, dominios externos y protocolos productivos', () => {
    expect(() => validarUrlServidorLocal('https://servicio.onrender.com')).toThrow();
    expect(() => validarUrlServidorLocal('https://dulcearomacafeteria.com')).toThrow();
    expect(() => validarUrlServidorLocal('http://hostinger.example:3000')).toThrow();
    expect(() => validarUrlServidorLocal('https://localhost:3000')).toThrow();
  });

  it('descarta una URL externa heredada de localStorage', () => {
    localStorage.setItem('serverUrl', 'https://servicio.onrender.com');

    expect(getServerUrl()).toBe(DEFAULT_SERVER_URL);
    expect(localStorage.getItem('serverUrl')).toBeNull();
  });

  it('guarda solamente una URL local validada', () => {
    expect(guardarUrlServidorLocal('http://localhost:3000/')).toBe(DEFAULT_SERVER_URL);
    expect(localStorage.getItem('serverUrl')).toBe(DEFAULT_SERVER_URL);
  });
});

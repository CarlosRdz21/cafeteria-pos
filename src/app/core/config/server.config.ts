export const DEFAULT_SERVER_URL = 'http://localhost:3000';
const CLAVE_URL_SERVIDOR = 'serverUrl';
const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1']);

export function getServerUrl(): string {
  if (typeof localStorage !== 'undefined') {
    const savedUrl = localStorage.getItem(CLAVE_URL_SERVIDOR);
    if (savedUrl) {
      try {
        return validarUrlServidorLocal(savedUrl);
      } catch {
        localStorage.removeItem(CLAVE_URL_SERVIDOR);
      }
    }
  }

  return DEFAULT_SERVER_URL;
}

export function buildApiUrl(path: string): string {
  return `${getServerUrl()}/api/${trimPath(path)}`;
}

export function guardarUrlServidorLocal(url: string): string {
  const urlValidada = validarUrlServidorLocal(url);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(CLAVE_URL_SERVIDOR, urlValidada);
  }
  return urlValidada;
}

export function validarUrlServidorLocal(url: string): string {
  let urlAnalizada: URL;
  try {
    urlAnalizada = new URL(String(url || '').trim());
  } catch {
    throw new Error('La URL del servidor local no es válida.');
  }

  const esHostLocal = HOSTS_LOCALES.has(urlAnalizada.hostname);
  const esPuertoLocal = urlAnalizada.port === '3000';
  const esRutaBase =
    (urlAnalizada.pathname === '' || urlAnalizada.pathname === '/') &&
    !urlAnalizada.search &&
    !urlAnalizada.hash &&
    !urlAnalizada.username &&
    !urlAnalizada.password;

  if (urlAnalizada.protocol !== 'http:' || !esHostLocal || !esPuertoLocal || !esRutaBase) {
    throw new Error('Sólo se permite el backend local en http://localhost:3000.');
  }

  return `${urlAnalizada.protocol}//${urlAnalizada.host}`;
}

function trimPath(path: string): string {
  return String(path || '').replace(/^\/+/, '');
}

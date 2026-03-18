export const DEFAULT_SERVER_URL = 'https://cafeteria-pos-8bwt.onrender.com';

export function getServerUrl(): string {
  if (typeof localStorage !== 'undefined') {
    const savedUrl = localStorage.getItem('serverUrl');
    if (savedUrl) {
      return normalizeServerUrl(savedUrl);
    }
  }

  return normalizeServerUrl(DEFAULT_SERVER_URL);
}

export function buildApiUrl(path: string): string {
  return `${getServerUrl()}/api/${trimPath(path)}`;
}

function normalizeServerUrl(url: string): string {
  return String(url || '').trim().replace(/\/+$/, '');
}

function trimPath(path: string): string {
  return String(path || '').replace(/^\/+/, '');
}

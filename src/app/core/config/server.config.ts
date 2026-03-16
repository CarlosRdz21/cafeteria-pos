export const DEFAULT_SERVER_URL = 'http://172.25.16.1:3000';

export function getServerUrl(): string {
  if (typeof localStorage !== 'undefined') {
    const savedUrl = localStorage.getItem('serverUrl');
    if (savedUrl) {
      return savedUrl;
    }
  }
  return DEFAULT_SERVER_URL;
}

export function buildApiUrl(path: string): string {
  return `${getServerUrl()}/api/${path}`;
}

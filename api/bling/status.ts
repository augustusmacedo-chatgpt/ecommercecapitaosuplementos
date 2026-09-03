import { CONFIG_COOKIE, REFRESH_COOKIE, json, parseCookies, unseal, type BlingConfig } from './shared.js';

export default async function handler(request: Request) {
  if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405);
  const cookies = parseCookies(request);
  const config = await unseal<BlingConfig>(cookies[CONFIG_COOKIE]);
  const refreshToken = await unseal<string>(cookies[REFRESH_COOKIE]);
  return json({ configured: Boolean(config?.clientId && config.clientSecret), connected: Boolean(refreshToken), clientId: config?.clientId ? mask(config.clientId) : '' });
}

function mask(value: string) {
  if (value.length <= 8) return '••••••••';
  return `${value.slice(0, 4)}${'•'.repeat(Math.min(20, value.length - 8))}${value.slice(-4)}`;
}

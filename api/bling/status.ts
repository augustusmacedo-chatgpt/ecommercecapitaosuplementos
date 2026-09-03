import { CONFIG_COOKIE, REFRESH_COOKIE, json, parseCookies, unseal, type BlingConfig } from './shared';

export default async function handler(request: Request) {
  if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405);
  try {
    const cookies = parseCookies(request);
    const config = await unseal<BlingConfig>(cookies[CONFIG_COOKIE]);
    const refreshToken = await unseal<string>(cookies[REFRESH_COOKIE]);
    return json({
      configured: Boolean(config?.clientId && config.clientSecret),
      connected: Boolean(refreshToken),
      clientId: config?.clientId ? mask(config.clientId) : '',
    }, 200, { 'Cache-Control': 'no-store' });
  } catch (error) {
    console.error('Bling status error:', error);
    return json({ configured: false, connected: false, clientId: '' }, 500);
  }
}

function mask(value: string) {
  if (value.length <= 8) return '••••••••';
  return `${value.slice(0, 4)}${'•'.repeat(Math.min(20, value.length - 8))}${value.slice(-4)}`;
}

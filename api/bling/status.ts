import { CONFIG_COOKIE, REFRESH_COOKIE, json, parseCookies, unseal, type BlingConfig } from '../../src/server/bling';

export default async function handler(request: Request) {
  if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405);
  const cookies = parseCookies(request);
  const config = await unseal<BlingConfig>(cookies[CONFIG_COOKIE]);
  const refreshToken = await unseal<string>(cookies[REFRESH_COOKIE]);
  return json({ configured: Boolean(config?.clientId && config.clientSecret), connected: Boolean(refreshToken), clientId: config?.clientId || '' });
}

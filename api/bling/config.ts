import { CONFIG_COOKIE, json, parseCookies, readJsonBody, seal, unseal, type BlingConfig } from './shared.js';

export default async function handler(request: any, response: any) {
  try {
    const cookies = parseCookies(request);
    const current = await unseal<BlingConfig>(cookies[CONFIG_COOKIE]);

    if (request.method === 'GET') {
      return json(response, {
        configured: Boolean(current?.clientId && current.clientSecret),
        clientId: current?.clientId || '',
        inviteLink: current?.inviteLink || '',
        secretConfigured: Boolean(current?.clientSecret),
      }, 200, { 'Cache-Control': 'no-store' });
    }

    if (request.method !== 'POST') return json(response, { error: 'Método não permitido.' }, 405);

    const body = await readJsonBody(request) as Partial<BlingConfig>;
    const clientId = body.clientId?.trim() || current?.clientId || '';
    const clientSecret = body.clientSecret?.trim() || current?.clientSecret || '';
    const inviteLink = body.inviteLink?.trim() || current?.inviteLink || '';

    if (!clientId || !clientSecret) return json(response, { error: 'Client ID e Client Secret são obrigatórios.' }, 400);

    const value: BlingConfig = { clientId, clientSecret, inviteLink };
    const sealed = await seal(value);
    return json(response, { ok: true, configured: true, clientId: value.clientId, secretConfigured: true, inviteLink: value.inviteLink }, 200, {
      'Set-Cookie': `${CONFIG_COOKIE}=${encodeURIComponent(sealed)}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`,
      'Cache-Control': 'no-store',
    });
  } catch (error) {
    console.error('Bling config error:', error);
    return json(response, { error: 'Não foi possível carregar a configuração do Bling.' }, 500);
  }
}

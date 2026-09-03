import { BLING_REDIRECT_URI, CONFIG_COOKIE, STATE_COOKIE, cookie, json, parseCookies, unseal, type BlingConfig } from './shared.js';

export default async function handler(request: Request) {
  if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405);

  const cookies = parseCookies(request);
  const config = await unseal<BlingConfig>(cookies[CONFIG_COOKIE]);
  if (!config?.clientId || !config.clientSecret) {
    return json({ error: 'Configure o Client ID e o Client Secret antes de conectar o Bling.' }, 400);
  }

  const state = crypto.randomUUID().replaceAll('-', '');
  const authorizeUrl = new URL('https://www.bling.com.br/Api/v3/oauth/authorize');
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', config.clientId);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('redirect_uri', BLING_REDIRECT_URI);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.toString(),
      'Set-Cookie': cookie(STATE_COOKIE, state, { maxAge: 600 }),
      'Cache-Control': 'no-store',
    },
  });
}

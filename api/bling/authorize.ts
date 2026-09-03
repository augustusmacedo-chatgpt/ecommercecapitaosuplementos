import { BLING_REDIRECT_URI, CONFIG_COOKIE, STATE_COOKIE, cookie, parseCookies, unseal, type BlingConfig } from './shared.js';

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.statusCode = 405;
    return response.end('Método não permitido.');
  }

  const cookies = parseCookies(request);
  const config = await unseal<BlingConfig>(cookies[CONFIG_COOKIE]);
  if (!config?.clientId || !config.clientSecret) {
    response.statusCode = 400;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    return response.end(JSON.stringify({ error: 'Configure o Client ID e o Client Secret antes de conectar o Bling.' }));
  }

  const state = crypto.randomUUID().replaceAll('-', '');
  const authorizeUrl = new URL('https://www.bling.com.br/Api/v3/oauth/authorize');
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', config.clientId);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('redirect_uri', BLING_REDIRECT_URI);

  response.statusCode = 302;
  response.setHeader('Location', authorizeUrl.toString());
  response.setHeader('Set-Cookie', cookie(STATE_COOKIE, state, { maxAge: 600 }));
  response.setHeader('Cache-Control', 'no-store');
  return response.end();
}

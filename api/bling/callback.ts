import { BLING_REDIRECT_URI, CONFIG_COOKIE, REFRESH_COOKIE, STATE_COOKIE, clearCookie, cookie, json, parseCookies, seal, unseal, type BlingConfig } from './bling-shared';

export default async function handler(request: Request) {
  if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405);

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const cookies = parseCookies(request);
  const expectedState = cookies[STATE_COOKIE];

  if (error) return fail('A autorização no Bling não foi concluída.');
  if (!code || !returnedState || !expectedState || returnedState !== expectedState) return fail('Não foi possível validar a autorização. Tente conectar novamente.');

  const config = await unseal<BlingConfig>(cookies[CONFIG_COOKIE]);
  if (!config?.clientId || !config.clientSecret) return fail('As credenciais do aplicativo não estão configuradas.');

  try {
    const basic = btoa(`${config.clientId}:${config.clientSecret}`);
    const tokenResponse = await fetch('https://api.bling.com.br/Api/v3/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: '1.0', Authorization: `Basic ${basic}`, 'enable-jwt': '1' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code }).toString(),
    });

    if (!tokenResponse.ok) {
      console.error('Bling OAuth token error:', tokenResponse.status, await tokenResponse.text());
      return fail('O Bling recusou a troca do código de autorização. Confira o Client ID, Client Secret e a URL de redirecionamento.', 502);
    }

    const tokens = await tokenResponse.json() as { refresh_token?: string };
    if (!tokens.refresh_token) return fail('O Bling não retornou um refresh token.', 502);

    const sealedRefreshToken = await seal(tokens.refresh_token);
    const redirect = new URL('/admin', BLING_REDIRECT_URI);
    redirect.searchParams.set('bling', 'connected');

    const headers = new Headers({ Location: redirect.toString(), 'Cache-Control': 'no-store' });
    headers.append('Set-Cookie', cookie(REFRESH_COOKIE, sealedRefreshToken, { maxAge: 2592000 }));
    headers.append('Set-Cookie', clearCookie(STATE_COOKIE));
    return new Response(null, { status: 302, headers });
  } catch (err) {
    console.error('Bling OAuth callback error:', err);
    return fail('Não foi possível concluir a conexão com o Bling.', 502);
  }
}

function fail(message: string, status = 400) {
  return new Response(errorPage(message), {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Set-Cookie': clearCookie(STATE_COOKIE),
      'Cache-Control': 'no-store',
    },
  });
}

function errorPage(message: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Capitão • Bling</title></head><body style="font-family:Arial,sans-serif;background:#f3f3f1;padding:48px"><main style="max-width:560px;margin:auto;background:#fff;padding:32px;border:1px solid #ddd"><strong style="color:#b48622">CAPITÃO SUPLEMENTOS</strong><h1>Conexão não concluída</h1><p>${escapeHtml(message)}</p><a href="/admin" style="display:inline-block;background:#171717;color:#fff;padding:12px 16px;text-decoration:none">Voltar ao Admin</a></main></body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char] || char));
}

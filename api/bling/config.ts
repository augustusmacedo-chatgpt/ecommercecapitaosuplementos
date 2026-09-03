import { CONFIG_COOKIE, json, parseCookies, seal, unseal, type BlingConfig } from '../../src/server/bling';

export default async function handler(request: Request) {
  const cookies = parseCookies(request);
  const current = await unseal<BlingConfig>(cookies[CONFIG_COOKIE]);

  if (request.method === 'GET') {
    return json({
      configured: Boolean(current?.clientId && current.clientSecret),
      clientId: current?.clientId ? mask(current.clientId) : '',
      inviteLink: current?.inviteLink || '',
      secretConfigured: Boolean(current?.clientSecret),
    });
  }

  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const body = await request.json() as Partial<BlingConfig>;
    const clientId = body.clientId?.trim() || current?.clientId || '';
    const clientSecret = body.clientSecret?.trim() || current?.clientSecret || '';
    const inviteLink = body.inviteLink?.trim() || current?.inviteLink || '';

    if (!clientId || !clientSecret) return json({ error: 'Client ID e Client Secret são obrigatórios.' }, 400);

    const value: BlingConfig = { clientId, clientSecret, inviteLink };
    const sealed = await seal(value);
    return json({ ok: true, configured: true, clientId: mask(value.clientId), secretConfigured: true, inviteLink: value.inviteLink }, 200, {
      'Set-Cookie': `${CONFIG_COOKIE}=${encodeURIComponent(sealed)}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`,
      'Cache-Control': 'no-store',
    });
  } catch {
    return json({ error: 'Não foi possível salvar a configuração. Verifique o BLING_CONFIG_SECRET na Vercel.' }, 500);
  }
}

function mask(value: string) {
  if (value.length <= 8) return '••••••••';
  return `${value.slice(0, 4)}${'•'.repeat(Math.min(20, value.length - 8))}${value.slice(-4)}`;
}

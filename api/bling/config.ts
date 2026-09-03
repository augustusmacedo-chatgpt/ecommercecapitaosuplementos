import { CONFIG_COOKIE, json, parseCookies, seal, unseal, type BlingConfig } from '../../src/server/bling';

export default async function handler(request: Request) {
  if (request.method === 'GET') {
    const cookies = parseCookies(request);
    const config = await unseal<BlingConfig>(cookies[CONFIG_COOKIE]);
    return json({ configured: Boolean(config?.clientId && config?.clientSecret), clientId: config?.clientId ? mask(config.clientId) : '', inviteLink: config?.inviteLink || '' });
  }

  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const body = await request.json() as Partial<BlingConfig>;
    if (!body.clientId?.trim() || !body.clientSecret?.trim()) return json({ error: 'Client ID e Client Secret são obrigatórios.' }, 400);

    const value: BlingConfig = { clientId: body.clientId.trim(), clientSecret: body.clientSecret.trim(), inviteLink: body.inviteLink?.trim() || '' };
    const sealed = await seal(value);
    return json({ ok: true, configured: true, clientId: mask(value.clientId) }, 200, {
      'Set-Cookie': `${CONFIG_COOKIE}=${encodeURIComponent(sealed)}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`,
    });
  } catch {
    return json({ error: 'Não foi possível salvar a configuração. Verifique o BLING_CONFIG_SECRET na Vercel.' }, 500);
  }
}

function mask(value: string) {
  if (value.length <= 8) return '••••••••';
  return `${value.slice(0, 4)}${'•'.repeat(Math.min(20, value.length - 8))}${value.slice(-4)}`;
}

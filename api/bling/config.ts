const CONFIG_COOKIE = 'capitao_bling_config';

type BlingConfig = { clientId: string; clientSecret: string; inviteLink?: string };

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}

function parseCookies(request: any) {
  const headers = request?.headers;
  const raw = typeof headers?.get === 'function'
    ? headers.get('cookie') || ''
    : headers?.cookie || headers?.Cookie || '';
  const result: Record<string, string> = {};
  for (const part of String(raw).split(';')) {
    if (!part.trim()) continue;
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    const encodedValue = part.slice(index + 1).trim();
    try {
      result[name] = decodeURIComponent(encodedValue);
    } catch {
      result[name] = encodedValue;
    }
  }
  return result;
}

function getSecret() {
  const secret = process.env.BLING_CONFIG_SECRET;
  if (!secret) throw new Error('BLING_CONFIG_SECRET não configurado na Vercel.');
  return secret;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function keyFromSecret() {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(getSecret()));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function seal(value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFromSecret();
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const packed = new Uint8Array(iv.length + encrypted.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(encrypted), iv.length);
  return bytesToBase64(packed);
}

async function unseal<T>(value?: string): Promise<T | null> {
  if (!value) return null;
  try {
    const packed = base64ToBytes(value);
    if (packed.length <= 12) return null;
    const iv = packed.slice(0, 12);
    const encrypted = packed.slice(12);
    const key = await keyFromSecret();
    const decoded = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    return JSON.parse(new TextDecoder().decode(decoded)) as T;
  } catch {
    return null;
  }
}

export default async function handler(request: any) {
  const cookies = parseCookies(request);
  const current = await unseal<BlingConfig>(cookies[CONFIG_COOKIE]);

  if (request.method === 'GET') {
    return json({
      configured: Boolean(current?.clientId && current.clientSecret),
      clientId: current?.clientId || '',
      inviteLink: current?.inviteLink || '',
      secretConfigured: Boolean(current?.clientSecret),
    }, 200, { 'Cache-Control': 'no-store' });
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
    return json({ ok: true, configured: true, clientId: value.clientId, secretConfigured: true, inviteLink: value.inviteLink }, 200, {
      'Set-Cookie': `${CONFIG_COOKIE}=${encodeURIComponent(sealed)}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`,
      'Cache-Control': 'no-store',
    });
  } catch (error) {
    console.error('Bling config error:', error);
    return json({ error: 'Não foi possível salvar a configuração. Verifique o BLING_CONFIG_SECRET na Vercel.' }, 500);
  }
}

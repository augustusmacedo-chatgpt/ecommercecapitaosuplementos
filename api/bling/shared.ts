const CONFIG_COOKIE = 'capitao_bling_config';
const REFRESH_COOKIE = 'capitao_bling_refresh';
const STATE_COOKIE = 'capitao_bling_oauth_state';

export const BLING_REDIRECT_URI = 'https://ecommercecapitaosuplementos.vercel.app/api/bling/callback';
export { CONFIG_COOKIE, REFRESH_COOKIE, STATE_COOKIE };

type BlingConfig = { clientId: string; clientSecret: string; inviteLink?: string };

type CookieRequest = {
  headers?: {
    get?: (name: string) => string | null;
    cookie?: string | string[];
  };
};

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

export async function seal(value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFromSecret();
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const packed = new Uint8Array(iv.length + encrypted.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(encrypted), iv.length);
  return bytesToBase64(packed);
}

export async function unseal<T>(value?: string): Promise<T | null> {
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

export function parseCookies(request: CookieRequest) {
  const headers = request.headers;
  let raw = '';

  if (headers?.get) {
    raw = headers.get('cookie') || '';
  } else if (headers?.cookie) {
    raw = Array.isArray(headers.cookie) ? headers.cookie.join('; ') : headers.cookie;
  }

  const result: Record<string, string> = {};
  for (const part of raw.split(';')) {
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

export function cookie(name: string, value: string, options: { maxAge?: number; httpOnly?: boolean; sameSite?: string; secure?: boolean; path?: string } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path || '/'}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.secure !== false) parts.push('Secure');
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);
  return parts.join('; ');
}

export function clearCookie(name: string) {
  return cookie(name, '', { maxAge: 0 });
}

export function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}

export type { BlingConfig };

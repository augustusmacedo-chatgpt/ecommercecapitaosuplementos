const STATE_COOKIE = 'capitao_bling_oauth_state';
export const BLING_REDIRECT_URI = 'https://ecommercecapitaosuplementos.vercel.app/api/bling/callback';
export { STATE_COOKIE };
export type BlingConfig = { clientId: string; clientSecret: string; inviteLink?: string };

export function parseCookies(request: Request) {
  const raw = request.headers.get('cookie') || '';
  const result: Record<string, string> = {};
  for (const part of raw.split(';')) {
    if (!part.trim()) continue;
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    const encodedValue = part.slice(index + 1).trim();
    try { result[name] = decodeURIComponent(encodedValue); } catch { result[name] = encodedValue; }
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
export function clearCookie(name: string) { return cookie(name, '', { maxAge: 0 }); }
export function json(data: unknown, status = 200, extraHeaders: Record<string, string | string[]> = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
  for (const [name, value] of Object.entries(extraHeaders)) { if (Array.isArray(value)) value.forEach(item => headers.append(name, item)); else headers.set(name, value); }
  return new Response(JSON.stringify(data), { status, headers });
}
export async function readJsonBody(request: Request) { try { return await request.json(); } catch { return {}; } }

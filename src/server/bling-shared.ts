export const STATE_COOKIE = 'capitao_bling_oauth_state';
export type BlingConfig = { clientId: string; clientSecret: string; inviteLink?: string };
type RequestLike = Request & { body?: unknown; on?: (event: string, listener: (...args: any[]) => void) => void };
function headerValue(request: RequestLike, name: string) {
  const headers = request.headers as Headers & Record<string, unknown>;
  if (headers && typeof headers.get === 'function') return headers.get(name) || '';
  return String(headers?.[name] ?? headers?.[name.toLowerCase()] ?? '');
}
export function parseCookies(request: RequestLike) {
  const header = headerValue(request, 'cookie');
  return Object.fromEntries(header.split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const index = part.indexOf('=');
    const key = index >= 0 ? part.slice(0, index) : part;
    const value = index >= 0 ? part.slice(index + 1) : '';
    try { return [key, decodeURIComponent(value)]; } catch { return [key, value]; }
  }));
}
export function cookie(name: string, value: string, options: { maxAge?: number; path?: string } = {}) { return `${name}=${encodeURIComponent(value)}; Path=${options.path || '/'}; Max-Age=${options.maxAge ?? 600}; HttpOnly; Secure; SameSite=Lax`; }
export function clearCookie(name: string) { return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`; }
export function json(data: unknown, status = 200, headers: Record<string, string> = {}) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } }); }
export async function readJsonBody(request: RequestLike) {
  const body: unknown = (request as unknown as { body?: unknown }).body;
  if (body !== undefined && body !== null) {
    if (typeof body === 'string' && body.trim()) {
      try { return JSON.parse(body); } catch { throw new Error('JSON inválido.'); }
    }
    if (typeof body === 'object') {
      const streamLike = typeof (body as { getReader?: unknown }).getReader === 'function'
        || typeof (body as { pipe?: unknown }).pipe === 'function'
        || typeof (body as { on?: unknown }).on === 'function';
      if (!streamLike) return body;
    }
  }
  if (typeof (request as Request & { json?: unknown }).json === 'function') {
    try { return await (request as Request & { json: () => Promise<unknown> }).json(); }
    catch { throw new Error('JSON inválido.'); }
  }
  if (typeof request.text === 'function') {
    const text = await request.text();
    if (!text) return {};
    try { return JSON.parse(text); } catch { throw new Error('JSON inválido.'); }
  }
  if (typeof request.on === 'function') {
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => { request.on!('data', chunk => chunks.push(Buffer.from(chunk))); request.on!('end', () => resolve()); request.on!('error', reject); });
    const text = Buffer.concat(chunks).toString('utf8');
    if (!text) return {};
    try { return JSON.parse(text); } catch { throw new Error('JSON inválido.'); }
  }
  return {};
}

export const STATE_COOKIE = 'capitao_bling_oauth_state';
export const BLING_REDIRECT_URI = 'https://ecommercecapitaosuplementos.vercel.app/api/bling/callback';
export type BlingConfig = { clientId: string; clientSecret: string; inviteLink?: string };
export function parseCookies(request: Request) { const header = request.headers.get('cookie') || ''; return Object.fromEntries(header.split(';').map(part => part.trim()).filter(Boolean).map(part => { const index = part.indexOf('='); return [index >= 0 ? part.slice(0, index) : part, index >= 0 ? decodeURIComponent(part.slice(index + 1)) : '']; })); }
export function cookie(name: string, value: string, options: { maxAge?: number; path?: string } = {}) { return `${name}=${encodeURIComponent(value)}; Path=${options.path || '/'}; Max-Age=${options.maxAge ?? 600}; HttpOnly; Secure; SameSite=Lax`; }
export function clearCookie(name: string) { return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`; }
export function json(data: unknown, status = 200, headers: Record<string, string> = {}) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } }); }
export async function readJsonBody(request: Request) { const text = await request.text(); if (!text) return {}; try { return JSON.parse(text); } catch { throw new Error('JSON inválido.'); } }

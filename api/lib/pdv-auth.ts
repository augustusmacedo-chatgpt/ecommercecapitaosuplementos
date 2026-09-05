import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { get, put, hasStorage } from '../../src/server/storage.js';

const STORE_KEY = 'pdv/users.json';
const SESSION_COOKIE = 'pdv_session';
const SESSION_TTL = 60 * 60 * 8;
const PASSWORD_MIN = 8;

type StoredUser = { id: string; name: string; username: string; email: string; role: 'ADMIN' | 'OPERATOR'; active: boolean; blingSellerId: number | null; blingSellerName: string | null; passwordHash: string; passwordSalt: string; recoveryHash?: string; recoveryExpiresAt?: number; createdAt: string; updatedAt: string };
function secret() { return process.env.PDV_AUTH_SECRET || ''; }
function clean(value: unknown) { return String(value ?? '').trim(); }
function normalize(value: unknown) { return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR'); }
function safeBase64(value: Buffer) { return value.toString('base64url'); }
function fromBase64(value: string) { return Buffer.from(value, 'base64url'); }
export function assertPassword(password: string) { if (password.length < PASSWORD_MIN) throw new Error(`A senha deve ter pelo menos ${PASSWORD_MIN} caracteres.`); }
export function hashPassword(password: string, salt = randomBytes(16)) { assertPassword(password); return { salt: safeBase64(salt), hash: safeBase64(scryptSync(password, salt, 64)) }; }
export function verifyPassword(password: string, salt: string, hash: string) { try { const derived = scryptSync(password, fromBase64(salt), 64); const expected = fromBase64(hash); return expected.length === derived.length && timingSafeEqual(expected, derived); } catch { return false; } }
export async function loadUsers(): Promise<StoredUser[]> { if (!hasStorage()) throw new Error('Armazenamento persistente do PDV não está conectado ao Cloudflare R2.'); try { const result = await get(STORE_KEY); if (!result?.stream) return []; const parsed = JSON.parse(await new Response(result.stream).text()) as { users?: StoredUser[] }; return Array.isArray(parsed.users) ? parsed.users : []; } catch (error: any) { if (error?.statusCode === 404) return []; return []; } }
export async function saveUsers(users: StoredUser[]) { if (!hasStorage()) throw new Error('Armazenamento persistente do PDV não está conectado ao Cloudflare R2.'); await put(STORE_KEY, JSON.stringify({ version: 1, users }, null, 2), { contentType: 'application/json' }); }
export function publicUser(user: StoredUser) { return { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role, active: user.active, blingSellerId: user.blingSellerId, blingSellerName: user.blingSellerName, createdAt: user.createdAt, updatedAt: user.updatedAt }; }
export function findUser(users: StoredUser[], identifier: string) { const value = normalize(identifier); return users.find(user => normalize(user.username) === value || normalize(user.email) === value); }
export function createUserRecord(input: { name: string; username: string; email: string; role?: 'ADMIN' | 'OPERATOR'; active?: boolean; blingSellerId?: number | null; blingSellerName?: string | null; password: string }) { const now = new Date().toISOString(); const password = hashPassword(input.password); return { id: `usr_${randomBytes(9).toString('hex')}`, name: clean(input.name), username: clean(input.username), email: clean(input.email).toLowerCase(), role: input.role === 'ADMIN' ? 'ADMIN' : 'OPERATOR', active: input.active !== false, blingSellerId: Number(input.blingSellerId) > 0 ? Number(input.blingSellerId) : null, blingSellerName: clean(input.blingSellerName) || null, passwordHash: password.hash, passwordSalt: password.salt, createdAt: now, updatedAt: now } satisfies StoredUser; }
function sign(payload: string) { return safeBase64(createHmac('sha256', secret()).update(payload).digest()); }
export function sessionCookie(user: StoredUser) { if (!secret()) throw new Error('PDV_AUTH_SECRET não configurado.'); const payload = safeBase64(Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + SESSION_TTL }))); return `${SESSION_COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}`; }
export function clearSessionCookie() { return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }
export function readCookie(request: Request, name: string) { const header = request.headers.get('cookie') || ''; for (const part of header.split(';')) { const [key, ...rest] = part.trim().split('='); if (key === name) return rest.join('='); } return ''; }
export async function sessionUser(request: Request) { if (!secret()) return null; const token = readCookie(request, SESSION_COOKIE); const [payload, signature] = token.split('.'); if (!payload || !signature || sign(payload) !== signature) return null; try { const parsed = JSON.parse(fromBase64(payload).toString('utf8')) as { sub?: string; exp?: number }; if (!parsed.sub || !parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null; const users = await loadUsers(); const user = users.find(item => item.id === parsed.sub && item.active); return user || null; } catch { return null; } }
export function recoveryToken() { return randomBytes(32).toString('base64url'); }
export function recoveryHash(token: string) { return createHmac('sha256', secret()).update(token).digest('hex'); }
export const recoveryTtlMs = 15 * 60 * 1000;

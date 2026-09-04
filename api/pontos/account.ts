import { createHmac, timingSafeEqual } from 'node:crypto';
import { get } from '@vercel/blob';
import { json } from '../../src/server/bling-shared.js';
import { accountStorageKey, emptyPointsAccount, pointsValue } from '../../src/server/pontos.js';

function sessionSecret() { return process.env.CUSTOMER_SESSION_SECRET || process.env.BLOB_READ_WRITE_TOKEN || process.env.RESEND_API_KEY || ''; }
function verifySession(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const [payload, signature] = token.split('.');
  const secret = sessionSecret();
  if (!payload || !signature || !secret) return '';
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return '';
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; exp?: number };
    if (!data.sub || !data.exp || Date.now() > data.exp) return '';
    return data.sub;
  } catch { return ''; }
}
async function loadAccount(customerKey: string) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const result = await get(accountStorageKey(customerKey), { access: 'private', useCache: false, ...(token ? { token } : {}) });
  if (!result?.stream) return emptyPointsAccount(customerKey);
  const parsed = JSON.parse(await new Response(result.stream).text());
  return { ...emptyPointsAccount(customerKey), ...parsed, customerKey, entries: Array.isArray(parsed.entries) ? parsed.entries : [], bonuses: Array.isArray(parsed.bonuses) ? parsed.bonuses : [], cycleEarned: Number(parsed.cycleEarned || 0) };
}

export async function GET(request: Request) {
  try {
    if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) return json({ error: 'Armazenamento não configurado.' }, 503);
    const customerKey = verifySession(request);
    if (!customerKey) return json({ error: 'Sessão expirada. Faça a validação novamente.' }, 401);
    const account = await loadAccount(customerKey);
    const nextMilestone = [200, 400, 600, 800, 1000].find(value => value > account.cycleEarned) || 1000;
    return json({ customerKey, email: account.email || null, balance: account.balance, value: pointsValue(account.balance), lifetimeEarned: account.lifetimeEarned, lifetimeRedeemed: account.lifetimeRedeemed, cycleEarned: account.cycleEarned, cycleRemaining: Math.max(0, 1000 - account.cycleEarned), nextMilestone, bonuses: account.bonuses || [], entries: account.entries.slice(-50).reverse() }, 200, { 'Cache-Control': 'no-store' });
  } catch (error) { console.error('Points account:', error); return json({ error: 'Não foi possível consultar seus pontos.' }, 503); }
}

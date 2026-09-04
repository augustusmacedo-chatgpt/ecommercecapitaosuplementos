import { get, put } from '@vercel/blob';
import { json, readJsonBody } from '../../src/server/bling-shared.js';
import { accountStorageKey, applyEntry, canonicalCustomerKey, emptyPointsAccount, pointsFromOrderTotal } from '../../src/server/pontos.js';

async function load(customerKey: string) { const token = process.env.BLOB_READ_WRITE_TOKEN; const result = await get(accountStorageKey(customerKey), { access: 'private', useCache: false, ...(token ? { token } : {}) }); if (!result?.stream) return emptyPointsAccount(customerKey); return JSON.parse(await new Response(result.stream).text()); }
async function save(account: ReturnType<typeof emptyPointsAccount>) { const token = process.env.BLOB_READ_WRITE_TOKEN; await put(accountStorageKey(account.customerKey), JSON.stringify(account), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', ...(token ? { token } : {}) }); }

export async function POST(request: Request) {
  try {
    if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) return json({ error: 'Armazenamento não configurado.' }, 503);
    const body = await readJsonBody(request) as { document?: string; email?: string; orderId?: number; checkoutId?: string; total?: number };
    const customerKey = canonicalCustomerKey(body.document, body.email); const orderId = Number(body.orderId || 0); const checkoutId = String(body.checkoutId || '').trim(); const total = Number(body.total || 0);
    if (!customerKey || !orderId || !checkoutId || !Number.isFinite(total) || total <= 0) return json({ error: 'Dados insuficientes para registrar os pontos.' }, 400);
    const account = await load(customerKey);
    if (account.entries.some((entry: any) => entry.type === 'earn' && (entry.orderId === orderId || entry.checkoutId === checkoutId))) return json({ earned: false, duplicate: true, balance: account.balance }, 200);
    const points = pointsFromOrderTotal(total); const next = applyEntry(account, { type: 'earn', points, orderId, checkoutId, description: `Pontos da compra #${orderId}` }); await save(next);
    return json({ earned: true, points, balance: next.balance, orderId }, 201);
  } catch (error) { console.error('Points earn:', error); return json({ error: 'Não foi possível registrar os pontos.' }, 503); }
}

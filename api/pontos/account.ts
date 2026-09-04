import { get } from '@vercel/blob';
import { json } from '../../src/server/bling-shared.js';
import { accountStorageKey, canonicalCustomerKey, emptyPointsAccount, pointsValue } from '../../src/server/pontos.js';

async function loadAccount(customerKey: string) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const result = await get(accountStorageKey(customerKey), { access: 'private', useCache: false, ...(token ? { token } : {}) });
  if (!result?.stream) return emptyPointsAccount(customerKey);
  const parsed = JSON.parse(await new Response(result.stream).text());
  return { ...emptyPointsAccount(customerKey), ...parsed, entries: Array.isArray(parsed.entries) ? parsed.entries : [], bonuses: Array.isArray(parsed.bonuses) ? parsed.bonuses : [], cycleEarned: Number(parsed.cycleEarned || 0) };
}

export async function GET(request: Request) {
  try {
    if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) return json({ error: 'Armazenamento não configurado.' }, 503);
    const url = new URL(request.url);
    const customerKey = canonicalCustomerKey(url.searchParams.get('document') || '', url.searchParams.get('email') || '');
    if (!customerKey) return json({ error: 'Informe um CPF/CNPJ ou e-mail válido.' }, 400);
    const account = await loadAccount(customerKey);
    return json({ customerKey, balance: account.balance, value: pointsValue(account.balance), lifetimeEarned: account.lifetimeEarned, lifetimeRedeemed: account.lifetimeRedeemed, cycleEarned: account.cycleEarned, cycleRemaining: Math.max(0, 1000 - account.cycleEarned), bonuses: account.bonuses || [], entries: account.entries.slice(-50).reverse() }, 200, { 'Cache-Control': 'no-store' });
  } catch (error) {
    console.error('Points account:', error);
    return json({ error: 'Não foi possível consultar seus pontos.' }, 503);
  }
}

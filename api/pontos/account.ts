import { get, put } from '@vercel/blob';
import { json } from '../../src/server/bling-shared.js';
import { accountStorageKey, canonicalCustomerKey, emptyPointsAccount, pointsValue } from '../../src/server/pontos.js';

async function loadAccount(customerKey: string) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const result = await get(accountStorageKey(customerKey), { access: 'private', useCache: false, ...(token ? { token } : {}) });
  if (!result?.stream) return emptyPointsAccount(customerKey);
  return JSON.parse(await new Response(result.stream).text());
}

async function saveAccount(account: ReturnType<typeof emptyPointsAccount>) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  await put(accountStorageKey(account.customerKey), JSON.stringify(account), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', ...(token ? { token } : {}) });
}

export async function GET(request: Request) {
  try {
    if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) return json({ error: 'Armazenamento não configurado.' }, 503);
    const url = new URL(request.url);
    const customerKey = canonicalCustomerKey(url.searchParams.get('document') || '', url.searchParams.get('email') || '');
    if (!customerKey) return json({ error: 'Informe um CPF/CNPJ ou e-mail válido.' }, 400);
    const account = await loadAccount(customerKey);
    return json({ customerKey, balance: account.balance, value: pointsValue(account.balance), lifetimeEarned: account.lifetimeEarned, lifetimeRedeemed: account.lifetimeRedeemed, entries: account.entries.slice(-50).reverse() }, 200, { 'Cache-Control': 'no-store' });
  } catch (error) {
    console.error('Points account:', error);
    return json({ error: 'Não foi possível consultar seus pontos.' }, 503);
  }
}

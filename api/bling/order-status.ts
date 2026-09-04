import { createHash } from 'node:crypto';
import { get, put } from '@vercel/blob';
import { json } from '../../src/server/bling-shared.js';

function storageKey(checkoutId: string) { return `orders/${createHash('sha256').update(checkoutId).digest('hex')}.json`; }
function storageOptions() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  return token ? { access: 'private' as const, useCache: false, token } : { access: 'private' as const, useCache: false };
}
async function loadOrder(checkoutId: string) {
  if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const result = await get(storageKey(checkoutId), storageOptions());
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return JSON.parse(await new Response(result.stream).text()) as Record<string, unknown>;
  } catch { return null; }
}
async function saveOrder(checkoutId: string, value: Record<string, unknown>) {
  if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) return;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  await put(storageKey(checkoutId), JSON.stringify(value), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', ...(token ? { token } : {}) });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url, 'https://capitaosuplementos.com.br');
    const checkoutId = (url.searchParams.get('checkoutId') || '').trim();
    if (!checkoutId || checkoutId.length > 120) return json({ error: 'Pedido não informado.' }, 400);
    const stored = await loadOrder(checkoutId);
    if (!stored?.id) return json({ error: 'Pedido não encontrado.' }, 404);
    return json(stored, 200);
  } catch (error) {
    console.error('Order status error:', error);
    return json({ error: 'Não foi possível consultar o pedido.' }, 503);
  }
}

export async function saveOrderSnapshot(checkoutId: string, value: Record<string, unknown>) {
  await saveOrder(checkoutId, value);
}

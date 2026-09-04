import { createHash } from 'node:crypto';
import { get } from '@vercel/blob';
import { json } from '../../src/server/bling-shared.js';
import { getBlingAccessToken } from '../../src/server/bling-client.js';

const BLING_BASE = 'https://api.bling.com.br/Api/v3';
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
    return JSON.parse(await new Response(result.stream).text()) as { id?: number; numero?: number };
  } catch { return null; }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url, 'https://capitaosuplementos.com.br');
    const checkoutId = (url.searchParams.get('checkoutId') || '').trim();
    if (!checkoutId || checkoutId.length > 120) return json({ error: 'Pedido não informado.' }, 400);
    const stored = await loadOrder(checkoutId);
    if (!stored?.id) return json({ error: 'Pedido não encontrado.' }, 404);

    const token = await getBlingAccessToken();
    const response = await fetch(`${BLING_BASE}/pedidos/vendas/${stored.id}`, {
      headers: { Accept: '1.0', Authorization: `Bearer ${token}`, 'enable-jwt': '1' },
    });
    const text = await response.text();
    if (!response.ok) return json({ error: 'Não foi possível consultar o pedido no Bling.' }, response.status === 401 || response.status === 403 ? 403 : 502);
    const parsed = JSON.parse(text) as { data?: any };
    const order = parsed.data || {};
    return json({
      id: order.id || stored.id,
      numero: order.numero || stored.numero,
      data: order.data || null,
      total: Number(order.total || 0),
      situacao: order.situacao || null,
      contato: order.contato || null,
      loja: order.loja || null,
      vendedor: order.vendedor || null,
      itens: Array.isArray(order.itens) ? order.itens.map((item: any) => ({
        id: item.id || null,
        produtoId: item.produto?.id || null,
        descricao: item.descricao || item.produto?.descricao || item.produto?.nome || 'Produto',
        quantidade: Number(item.quantidade || 1),
        valor: Number(item.valor || 0),
        total: Number(item.total || (Number(item.quantidade || 1) * Number(item.valor || 0))),
      })) : [],
    }, 200);
  } catch (error) {
    console.error('Bling order status error:', error);
    return json({ error: error instanceof Error ? error.message : 'Não foi possível consultar o pedido.' }, 503);
  }
}

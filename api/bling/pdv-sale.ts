import { createHash } from 'node:crypto';
import { get } from '@vercel/blob';
import { json, readJsonBody } from '../../src/server/bling-shared.js';
import { getBlingAccessToken } from '../../src/server/bling-client.js';

type Item = { id?: number; name?: string; code?: string; price?: number; quantity?: number };
type Body = { checkoutId?: string; location?: 'camapua' | 'newfit'; sellerId?: number | string; sellerName?: string; customer?: { name?: string; document?: string; phone?: string; email?: string }; payment?: string; documentChoice?: 'nfc' | 'receipt'; items?: Item[]; total?: number };
type Channel = { id?: number; nome?: string; descricao?: string; idUnidadeNegocio?: number | string; unidadeNegocio?: { id?: number } };
const BASE = 'https://api.bling.com.br/Api/v3';
const CHANNELS = { camapua: 206151819, newfit: 206151809 } as const;
function clean(v: unknown) { return String(v ?? '').trim(); }
function digits(v: unknown) { return clean(v).replace(/\D/g, ''); }
function amount(v: unknown) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function errorText(text: string) { try { const x = JSON.parse(text); return String(x?.error?.message || x?.message || x?.error || text).slice(0, 500); } catch { return text.slice(0, 500); } }
function key(id: string) { return `pdv-orders/${createHash('sha256').update(id).digest('hex')}.json`; }
async function exists(id: string) { try { const r = await get(key(id), { access: 'private', useCache: false }); return Boolean(r?.stream); } catch { return false; } }

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get('resource') !== 'sellers') return json({ error: 'Recurso não informado.' }, 400);
    const token = await getBlingAccessToken();
    const response = await fetch(`${BASE}/vendedores?pagina=1&limite=100`, { headers: { Accept: '1.0', Authorization: `Bearer ${token}`, 'enable-jwt': '1' } });
    const text = await response.text();
    if (!response.ok) return json({ error: `Não foi possível consultar os vendedores do Bling. ${errorText(text)}` }, response.status === 401 || response.status === 403 ? 403 : 502);
    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch { parsed = {}; }
    const sellers = Array.isArray(parsed?.data) ? parsed.data.map((seller: any) => ({ id: Number(seller.id), name: String(seller.nome || seller.name || seller.apelido || '').trim() })).filter((seller: { id: number; name: string }) => seller.id > 0 && seller.name) : [];
    return json({ sellers }, 200, { 'Cache-Control': 'private, max-age=60' });
  } catch (error) {
    console.error('Bling sellers error:', error);
    return json({ error: error instanceof Error ? error.message : 'Não foi possível carregar os vendedores do Bling.' }, 503);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request) as Body;
    const checkoutId = clean(body.checkoutId);
    const location = body.location;
    const items = Array.isArray(body.items) ? body.items : [];
    const sellerId = Number(body.sellerId || 0);
    if (!checkoutId) return json({ error: 'Identificador da venda não informado.' }, 400);
    if (!['camapua', 'newfit'].includes(String(location))) return json({ error: 'Loja do PDV não informada.' }, 400);
    if (!sellerId || !Number.isInteger(sellerId)) return json({ error: 'Vendedor do Bling não informado.' }, 400);
    if (!items.length) return json({ error: 'A venda está sem produtos.' }, 400);
    if (await exists(checkoutId)) return json({ created: true, duplicate: true, checkoutId }, 200);

    const token = await getBlingAccessToken();
    const headers = { Accept: '1.0', 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'enable-jwt': '1' };
    const channelId = CHANNELS[location];
    const channelResponse = await fetch(`${BASE}/canais-venda/${channelId}`, { headers });
    const channelText = await channelResponse.text();
    if (!channelResponse.ok) return json({ error: `Não foi possível consultar a Loja Física no Bling. ${errorText(channelText)}` }, 502);
    let channel: { data?: Channel } = {};
    try { channel = JSON.parse(channelText); } catch { channel = {}; }
    const resolvedUnitId = Number(channel.data?.idUnidadeNegocio || channel.data?.unidadeNegocio?.id || 0);

    const document = digits(body.customer?.document);
    let contactId = 0;
    if (document) {
      const lookup = await fetch(`${BASE}/contatos?numeroDocumento=${encodeURIComponent(document)}&limite=1`, { headers });
      if (!lookup.ok) return json({ error: `Não foi possível consultar o cliente. ${errorText(await lookup.text())}` }, 502);
      const found = await lookup.json() as { data?: Array<{ id?: number }> };
      contactId = Number(found.data?.[0]?.id || 0);
    }

    const normalized = items.map(item => ({ produto: { id: Number(item.id) }, codigo: clean(item.code) || undefined, descricao: clean(item.name) || undefined, unidade: 'UN', quantidade: Math.max(1, Math.floor(amount(item.quantity || 1))), valor: amount(item.price), desconto: 0 })).filter(item => Number.isInteger(item.produto.id) && item.produto.id > 0 && item.valor > 0);
    if (!normalized.length) return json({ error: 'Nenhum produto válido foi identificado.' }, 400);
    const subtotal = normalized.reduce((s, item) => s + item.quantidade * item.valor, 0);
    const payment = clean(body.payment) || 'NÃO INFORMADO';
    const sellerName = clean(body.sellerName);
    const customerName = clean(body.customer?.name);
    const customerPhone = clean(body.customer?.phone);
    const customerEmail = clean(body.customer?.email);
    const documentLabel = body.documentChoice === 'nfc' ? 'NFC-e' : 'COMPROVANTE';
    const payload: Record<string, any> = {
      numeroLoja: checkoutId,
      data: new Date().toISOString().slice(0, 10),
      loja: { id: channelId },
      vendedor: { id: sellerId },
      ...(resolvedUnitId > 0 ? { unidadeNegocio: { id: resolvedUnitId } } : {}),
      ...(contactId ? { contato: { id: contactId } } : {}),
      itens: normalized,
      observacoes: [`VENDA REALIZADA PELO PDV CAPITÃO SUPLEMENTOS`, `LOJA: ${location === 'camapua' ? 'CAMAPUÃ' : 'NEWFIT'}`, `CANAL LOJA FÍSICA: ${channelId}`, `VENDEDOR: ${sellerName || sellerId}`, `PAGAMENTO: ${payment}`, `DOCUMENTO: ${documentLabel}`, customerName ? `CLIENTE: ${customerName}` : '', customerPhone ? `TELEFONE: ${customerPhone}` : '', customerEmail ? `E-MAIL: ${customerEmail}` : ''].filter(Boolean).join('\n'),
      observacoesInternas: `PDV CHECKOUT: ${checkoutId} | LOJA: ${location} | CANAL: ${channelId} | VENDEDOR BLING: ${sellerId}`,
    };
    const response = await fetch(`${BASE}/pedidos/vendas`, { method: 'POST', headers, body: JSON.stringify(payload) });
    const text = await response.text();
    if (!response.ok) return json({ error: `O Bling rejeitou a venda. ${errorText(text)}` }, response.status === 401 || response.status === 403 ? 403 : 422);
    let result: any = {}; try { result = JSON.parse(text); } catch {}
    const orderId = Number(result?.data?.id || 0);
    const orderNumber = Number(result?.data?.numero || 0) || undefined;
    if (!orderId) return json({ error: 'O Bling recebeu a venda, mas não retornou o ID do pedido.' }, 502);
    return json({ created: true, orderId, orderNumber, checkoutId, location, sellerId, sellerName: sellerName || null, channelId, unitId: resolvedUnitId || null, subtotal, total: subtotal, documentChoice: body.documentChoice || null }, 201);
  } catch (error) {
    console.error('PDV sale Bling error:', error);
    return json({ error: error instanceof Error ? error.message : 'Não foi possível registrar a venda no Bling.' }, 503);
  }
}

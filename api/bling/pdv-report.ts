import { json } from '../../src/server/bling-shared.js';
import { getBlingAccessToken } from '../../src/server/bling-client.js';

const API_BASE = 'https://api.bling.com.br/Api/v3';
const STORE_DEFINITIONS = [
  { key: 'CAMAPUA', name: 'CAMAPUÃ', stock: 'ESTOQUE MATRIZ', channelId: 206151819 },
  { key: 'NEWFIT', name: 'NEWFIT', stock: 'ESTOQUE NEWFIT', channelId: 206151809 },
];

type AnyRecord = Record<string, any>;

function normalize(value: unknown) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase(); }
function amount(value: unknown) { const number = Number(value); return Number.isFinite(number) ? number : 0; }
function numericField(order: AnyRecord, candidates: Array<unknown>) {
  for (const candidate of candidates) if (candidate !== undefined && candidate !== null && candidate !== '') return { available: true, value: amount(candidate) };
  return { available: false, value: 0 };
}
function valueBreakdown(order: AnyRecord) {
  const total = amount(order?.total);
  const before = numericField(order, [order?.subtotal, order?.subtotalProdutos, order?.valorProdutos, order?.totalProdutos, order?.valorBruto, order?.valorTotalSemDesconto]);
  const discount = numericField(order, [order?.desconto?.valor, order?.valorDesconto, order?.desconto]);
  if (before.available) return { available: true, before: before.value, discount: discount.available ? discount.value : Math.max(0, before.value - total), total };
  if (discount.available) return { available: true, before: total + discount.value, discount: discount.value, total };
  return { available: false, before: 0, discount: 0, total };
}
function isAttended(order: AnyRecord) {
  const situation = order?.situacao ?? {};
  const configuredId = process.env.BLING_ATENDIDO_SITUACAO_ID?.trim();
  if (configuredId && String(situation.id ?? '') === configuredId) return true;
  return [situation.nome, situation.descricao, situation.valor, order?.situacaoNome, order?.status].some(value => normalize(value) === 'ATENDIDO');
}
function storeFor(order: AnyRecord) {
  const channelId = Number(order?.loja?.id || 0);
  const byChannel = STORE_DEFINITIONS.find(store => store.channelId === channelId);
  if (byChannel) return byChannel;
  const candidates = [order?.unidadeNegocio?.nome, order?.loja?.nome, order?.unidadeNegocio?.descricao, order?.loja?.descricao].map(normalize);
  if (candidates.some(value => value.includes('CAMAPUA'))) return STORE_DEFINITIONS[0];
  if (candidates.some(value => value.includes('NEWFIT'))) return STORE_DEFINITIONS[1];
  return null;
}
function paymentBucket(description: unknown) {
  const value = normalize(description);
  if (!value) return null;
  if (value.includes('PIX')) return 'pix';
  if (value.includes('DINHEIRO') || value.includes('ESPECIE')) return 'cash';
  if (value.includes('BEMOL')) return 'bemol';
  if (value.includes('DEBITO')) return 'debit';
  if (value.includes('CREDITO') || value.includes('CARTAO')) return 'credit';
  return null;
}
function addPayments(target: AnyRecord, order: AnyRecord) {
  const parcels = Array.isArray(order?.parcelas) ? order.parcelas : [];
  for (const parcel of parcels) {
    const description = parcel?.formaPagamento?.descricao ?? parcel?.formaPagamento?.nome ?? parcel?.formaPagamento?.tipo ?? parcel?.descricao;
    const bucket = paymentBucket(description);
    if (bucket) target[bucket] += amount(parcel?.valor ?? parcel?.valorPago ?? parcel?.valorParcela);
  }
  return parcels.length > 0;
}
async function blingGet(token: string, path: string) {
  const response = await fetch(`${API_BASE}${path}`, { headers: { Accept: '1.0', Authorization: `Bearer ${token}`, 'enable-jwt': '1' } });
  const text = await response.text();
  let body: AnyRecord = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { error: text }; }
  if (!response.ok) { const detail = body?.error?.message || body?.message || body?.error || `HTTP ${response.status}`; const error = new Error(String(detail)); (error as AnyRecord).status = response.status; throw error; }
  return body;
}
export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get('data') || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'Data inválida. Use AAAA-MM-DD.' }, 400);
  try {
    const token = await getBlingAccessToken();
    const stores = STORE_DEFINITIONS.map(store => ({ name: store.name, stock: store.stock, sales: 0, total: 0, beforeDiscount: 0, discount: 0, pix: 0, cash: 0, credit: 0, debit: 0, bemol: 0 }));
    let attended = 0, gross = 0, beforeDiscount = 0, discount = 0;
    let valueBreakdownAvailable = true, paymentBreakdownAvailable = true, page = 1;
    while (page <= 50) {
      const params = new URLSearchParams({ pagina: String(page), limite: '100', dataInicial: date, dataFinal: date });
      const result = await blingGet(token, `/pedidos/vendas?${params.toString()}`);
      const orders = Array.isArray(result?.data) ? result.data : [];
      if (!orders.length) break;
      for (const order of orders) {
        if (!isAttended(order)) continue;
        attended += 1;
        const breakdown = valueBreakdown(order);
        gross += breakdown.total;
        if (breakdown.available) { beforeDiscount += breakdown.before; discount += breakdown.discount; } else valueBreakdownAvailable = false;
        const store = storeFor(order); if (!store) continue;
        const target = stores.find(item => item.name === store.name); if (!target) continue;
        target.sales += 1; target.total += breakdown.total;
        if (breakdown.available) { target.beforeDiscount += breakdown.before; target.discount += breakdown.discount; }
        if (!addPayments(target, order)) paymentBreakdownAvailable = false;
      }
      if (orders.length < 100) break;
      page += 1; await new Promise(resolve => setTimeout(resolve, 350));
    }
    return json({ date, stores, sales: attended, total: gross, beforeDiscount: valueBreakdownAvailable ? beforeDiscount : null, discount: valueBreakdownAvailable ? discount : null, valueBreakdownAvailable, paymentBreakdownAvailable });
  } catch (error) {
    const status = Number((error as AnyRecord)?.status) || 500;
    console.error('PDV report Bling error:', error);
    return json({ error: error instanceof Error ? error.message : 'Não foi possível consultar o Bling.' }, status >= 400 && status < 600 ? status : 500);
  }
}

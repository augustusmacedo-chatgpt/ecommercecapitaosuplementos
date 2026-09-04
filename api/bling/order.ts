import { createHash } from 'node:crypto';
import { get, put } from '@vercel/blob';
import { json, readJsonBody } from '../../src/server/bling-shared.js';
import { getBlingAccessToken } from '../../src/server/bling-client.js';
import { canonicalCustomerKey, pointsFromOrderTotal } from '../../src/server/pontos.js';

type CartItem = { id?: number; name?: string; price?: string; quantity?: number; code?: string };
type Input = { checkoutId?: string; customer?: { document?: string; name?: string; birthDate?: string; email?: string; phone?: string; zip?: string; street?: string; number?: string; complement?: string; district?: string; city?: string; state?: string; observation?: string }; payment?: string; items?: CartItem[] };
const BLING_BASE = 'https://api.bling.com.br/Api/v3';
function digits(value: unknown) { return String(value || '').replace(/\D/g, ''); }
function clean(value: unknown) { return String(value || '').trim(); }
function normalizeEmail(value: unknown) { return clean(value).toLowerCase(); }
function money(value: unknown) { const normalized = String(value || '').replace(/[^0-9,]/g, '').replace(/\./g, '').replace(',', '.'); const parsed = Number(normalized); return Number.isFinite(parsed) ? parsed : 0; }
function today() { return new Date().toISOString().slice(0, 10); }
function storageKey(checkoutId: string) { return `orders/${createHash('sha256').update(checkoutId).digest('hex')}.json`; }
function storageOptions() { const token = process.env.BLOB_READ_WRITE_TOKEN; return token ? { access: 'private' as const, useCache: false, token } : { access: 'private' as const, useCache: false }; }
async function loadCreatedOrder(checkoutId: string) { if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) return null; try { const result = await get(storageKey(checkoutId), storageOptions()); if (!result || result.statusCode !== 200 || !result.stream) return null; return JSON.parse(await new Response(result.stream).text()) as Record<string, any>; } catch { return null; } }
async function saveCreatedOrder(checkoutId: string, value: Record<string, any>) { if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) return; const token = process.env.BLOB_READ_WRITE_TOKEN; await put(storageKey(checkoutId), JSON.stringify(value), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', ...(token ? { token } : {}) }); }
function blingError(responseBody: string) { try { const parsed = JSON.parse(responseBody); const errors = Array.isArray(parsed.error) ? parsed.error.map((item: any) => item.message || item.description || item.mensagem || item).join('; ') : ''; return String(errors || parsed.error?.message || parsed.error?.description || parsed.message || parsed.mensagem || parsed.error || '').slice(0, 500); } catch { return responseBody.slice(0, 500); } }

export async function POST(request: Request) {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  try {
    const body = await readJsonBody(request) as Input;
    const checkoutId = clean(body.checkoutId); const customer = body.customer || {}; const document = digits(customer.document); const email = normalizeEmail(customer.email); const items = Array.isArray(body.items) ? body.items : [];
    if (!checkoutId) return json({ error: 'Identificador do pedido não informado.' }, 400);
    if (![11, 14].includes(document.length)) return json({ error: 'CPF/CNPJ inválido.' }, 400);
    if (!clean(customer.name) || !customer.birthDate || !email.includes('@') || !clean(customer.phone)) return json({ error: 'Preencha os dados obrigatórios do cliente.' }, 400);
    if (!/^[0-9]{8}$/.test(digits(customer.zip)) || !clean(customer.street) || !clean(customer.number) || !clean(customer.district) || !clean(customer.city) || !clean(customer.state)) return json({ error: 'Preencha um endereço de entrega completo.' }, 400);
    if (!items.length) return json({ error: 'A sacola está vazia.' }, 400);
    const existing = await loadCreatedOrder(checkoutId); if (existing?.id) return json({ created: true, duplicate: true, orderId: existing.id, orderNumber: existing.numero }, 200);
    const token = await getBlingAccessToken();
    const headers = { Accept: '1.0', 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'enable-jwt': '1' };
    const tipoPessoa = document.length === 14 ? 'J' : 'F';
    const contactSearch = await fetch(`${BLING_BASE}/contatos?numeroDocumento=${encodeURIComponent(document)}&limite=1`, { headers });
    if (!contactSearch.ok) { const details = await contactSearch.text(); return json({ error: `Não foi possível consultar o cliente no Bling. ${blingError(details)}`.trim() }, 502); }
    const contactPayload = await contactSearch.json() as { data?: Array<{ id?: number }> }; let contactId = Number(contactPayload.data?.[0]?.id || 0);
    const contactData = { nome: clean(customer.name), fantasia: tipoPessoa === 'J' ? clean(customer.name) : undefined, tipoPessoa, numeroDocumento: document, email, telefone: clean(customer.phone), endereco: { geral: { endereco: clean(customer.street), numero: clean(customer.number), complemento: clean(customer.complement), bairro: clean(customer.district), municipio: clean(customer.city), uf: clean(customer.state).toUpperCase(), cep: digits(customer.zip) } }, dadosAdicionais: { dataNascimento: clean(customer.birthDate) } };
    if (contactId) { const updateResponse = await fetch(`${BLING_BASE}/contatos/${contactId}`, { method: 'PUT', headers, body: JSON.stringify(contactData) }); if (!updateResponse.ok && ![400, 404].includes(updateResponse.status)) { const details = await updateResponse.text(); console.warn('Bling contact update rejected; continuing with existing contact:', updateResponse.status, blingError(details)); } } else { const createResponse = await fetch(`${BLING_BASE}/contatos`, { method: 'POST', headers, body: JSON.stringify(contactData) }); if (!createResponse.ok) { const details = await createResponse.text(); return json({ error: `Não foi possível cadastrar o cliente no Bling. ${blingError(details)}`.trim() }, 422); } const created = await createResponse.json() as { data?: { id?: number } }; contactId = Number(created.data?.id || 0); }
    if (!contactId) return json({ error: 'O Bling não retornou o ID do cliente.' }, 502);
    const normalizedItems = items.map(item => ({ produto: { id: Number(item.id) }, codigo: clean(item.code) || undefined, descricao: clean(item.name) || undefined, unidade: 'UN', quantidade: Math.max(1, Number(item.quantity || 1)), valor: money(item.price), desconto: 0 })).filter(item => Number.isInteger(item.produto.id) && item.produto.id > 0 && item.valor > 0);
    if (!normalizedItems.length) return json({ error: 'Não foi possível identificar os produtos da sacola.' }, 400);
    const payment = clean(body.payment) || 'NÃO INFORMADO'; const addressLine = `${clean(customer.street)}, ${clean(customer.number)}${clean(customer.complement) ? `, ${clean(customer.complement)}` : ''} - ${clean(customer.district)} - ${clean(customer.city)}/${clean(customer.state).toUpperCase()} - CEP ${digits(customer.zip)}`;
    const observations = ['PEDIDO REALIZADO PELO SITE CAPITÃO SUPLEMENTOS', `Pagamento escolhido: ${payment}`, 'Pagamento será realizado somente no momento da entrega.', `Endereço de entrega: ${addressLine}`, clean(customer.observation) ? `Observação: ${clean(customer.observation)}` : ''].filter(Boolean).join('\n');
    const orderPayload = { numeroLoja: checkoutId, data: today(), contato: { id: contactId, tipoPessoa, numeroDocumento: document }, observacoes: observations, observacoesInternas: `CHECKOUT ID: ${checkoutId}`, itens: normalizedItems, transporte: { etiqueta: { nome: clean(customer.name), endereco: clean(customer.street), numero: clean(customer.number), complemento: clean(customer.complement), bairro: clean(customer.district), municipio: clean(customer.city), uf: clean(customer.state).toUpperCase(), cep: digits(customer.zip) } } };
    const orderResponse = await fetch(`${BLING_BASE}/pedidos/vendas`, { method: 'POST', headers, body: JSON.stringify(orderPayload) }); const orderText = await orderResponse.text();
    if (!orderResponse.ok) { console.error('Bling sales order rejected:', orderResponse.status, orderText.slice(0, 1500)); return json({ error: `O Bling rejeitou o pedido. ${blingError(orderText)}`.trim() }, orderResponse.status === 401 || orderResponse.status === 403 ? 403 : 422); }
    let result: { data?: { id?: number; numero?: number } } = {}; try { result = JSON.parse(orderText); } catch { /* resposta inesperada */ }
    const orderId = Number(result.data?.id || 0); const orderNumber = Number(result.data?.numero || 0) || undefined; if (!orderId) return json({ error: 'O Bling recebeu uma resposta sem o ID do pedido.' }, 502);
    const total = normalizedItems.reduce((sum, item) => sum + item.quantidade * item.valor, 0);
    const customerKey = canonicalCustomerKey(document, email);
    await saveCreatedOrder(checkoutId, { id: orderId, numero: orderNumber, checkoutId, customerKey, customerDocument: document, customerEmail: email, customerName: clean(customer.name), data: today(), total, pointsEligible: true, pointsAwarded: false, pointsReversed: false, situacao: { valor: 'Em aberto' }, vendedor: null, itens: normalizedItems.map(item => ({ produtoId: item.produto.id, descricao: item.descricao || 'Produto', quantidade: item.quantidade, valor: item.valor, total: item.quantidade * item.valor })), estimatedPoints: pointsFromOrderTotal(total), updatedAt: new Date().toISOString() });
    return json({ created: true, orderId, orderNumber, blingContactId: contactId }, 201);
  } catch (error) { console.error('Bling order creation error:', error); return json({ error: error instanceof Error ? error.message : 'Não foi possível registrar o pedido.' }, 503); }
}

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { get, put } from '../../src/server/storage.js';
import { json, readJsonBody } from '../../src/server/bling-shared.js';
import { blingFetch } from '../../src/server/bling-gateway.js';
import { applyEntry, cleanupExpiredReservations, emptyPointsAccount, pointsFromOrderTotal, PointsAccount } from '../../src/server/pontos.js';
import { loadCustomerById, saveCustomer, saveCustomerAddress } from '../../src/server/customer-store.js';
import { queueSiteOrderCreated } from '../../src/server/notifications.js';

type CartItem = { id?: number; name?: string; price?: string; quantity?: number; code?: string };
type Input = { checkoutId?: string; customer?: { addressId?: string; document?: string; name?: string; birthDate?: string; email?: string; phone?: string; zip?: string; street?: string; number?: string; complement?: string; district?: string; city?: string; state?: string; observation?: string }; payment?: string; items?: CartItem[]; loyalty?: { reservationId?: string } };
function digits(value: unknown) { return String(value || '').replace(/\D/g, ''); }
function clean(value: unknown) { return String(value || '').trim(); }
function normalizeEmail(value: unknown) { return clean(value).toLowerCase(); }
function money(value: unknown) { const normalized = String(value || '').replace(/[^0-9,]/g, '').replace(/\./g, '').replace(',', '.'); const parsed = Number(normalized); return Number.isFinite(parsed) ? parsed : 0; }
function today() { return new Date().toISOString().slice(0, 10); }
function storageKey(checkoutId: string) { return `orders/${createHash('sha256').update(checkoutId).digest('hex')}.json`; }
async function loadCreatedOrder(checkoutId: string) { try { const result = await get(storageKey(checkoutId)); if (!result?.stream) return null; return JSON.parse(await new Response(result.stream).text()) as Record<string, any>; } catch { return null; } }
async function saveCreatedOrder(checkoutId: string, value: Record<string, any>) { await put(storageKey(checkoutId), JSON.stringify(value), { contentType: 'application/json' }); }
function blingError(responseBody: string) { try { const parsed = JSON.parse(responseBody); const errors = Array.isArray(parsed.error) ? parsed.error.map((item: any) => item.message || item.description || item.mensagem || item).join('; ') : ''; return String(errors || parsed.error?.message || parsed.error?.description || parsed.message || parsed.mensagem || parsed.error || '').slice(0, 500); } catch { return responseBody.slice(0, 500); } }
function sessionSecret() { return process.env.CUSTOMER_SESSION_SECRET || ''; }
function verifySession(request: Request) { const token = (request.headers.get('authorization') || '').startsWith('Bearer ') ? (request.headers.get('authorization') || '').slice(7).trim() : ''; const [payload, signature] = token.split('.'); const secret = sessionSecret(); if (!payload || !signature || !secret) return ''; const expected = createHmac('sha256', secret).update(payload).digest('base64url'); const a = Buffer.from(signature); const b = Buffer.from(expected); if (a.length !== b.length || !timingSafeEqual(a, b)) return ''; try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; exp?: number }; return data.sub && data.exp && Date.now() <= data.exp ? data.sub : ''; } catch { return ''; } }
async function loadPointsAccount(customerKey: string) { try { const result = await get(`points/accounts/${createHash('sha256').update(customerKey).digest('hex')}.json`); if (!result?.stream) return emptyPointsAccount(customerKey); const parsed = JSON.parse(await new Response(result.stream).text()); return { ...emptyPointsAccount(customerKey), ...parsed, customerKey, entries: Array.isArray(parsed.entries) ? parsed.entries : [], reservations: Array.isArray(parsed.reservations) ? parsed.reservations : [], bonuses: Array.isArray(parsed.bonuses) ? parsed.bonuses : [] } as PointsAccount; } catch { return emptyPointsAccount(customerKey); } }
async function savePointsAccount(account: PointsAccount) { await put(`points/accounts/${createHash('sha256').update(account.customerKey).digest('hex')}.json`, JSON.stringify(account), { contentType: 'application/json' }); }

export async function POST(request: Request) {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  try {
    const body = await readJsonBody(request) as Input;
    const checkoutId = clean(body.checkoutId); const customer = body.customer || {}; const email = normalizeEmail(customer.email); const items = Array.isArray(body.items) ? body.items : []; const reservationId = clean(body.loyalty?.reservationId); const customerKey = verifySession(request);
    if (!checkoutId) return json({ error: 'Identificador do pedido não informado.' }, 400);
    if (!customerKey) return json({ error: 'Sessão do cliente expirada. Faça a identificação novamente.' }, 401);
    if (!clean(customer.name) || !email.includes('@') || !clean(customer.phone)) return json({ error: 'Preencha nome completo, e-mail e WhatsApp.' }, 400);
    if (!/^[0-9]{8}$/.test(digits(customer.zip)) || !clean(customer.street) || !clean(customer.number) || !clean(customer.district) || !clean(customer.city) || !clean(customer.state)) return json({ error: 'Preencha um endereço de entrega completo.' }, 400);
    if (!items.length) return json({ error: 'A sacola está vazia.' }, 400);
    const existing = await loadCreatedOrder(checkoutId); if (existing?.id) return json({ created: true, duplicate: true, orderId: existing.id, orderNumber: existing.numero }, 200);
    const sessionCustomer = await loadCustomerById(customerKey);
    if (!sessionCustomer) return json({ error: 'Cliente não encontrado.' }, 404);

    const customerWithProfile = await saveCustomer({
      ...sessionCustomer,
      name: clean(customer.name),
      email,
      phone: digits(customer.phone),
      birthDate: clean(customer.birthDate) || sessionCustomer.birthDate,
    });
    const customerWithAddress = await saveCustomerAddress(customerWithProfile, {
      id: clean(customer.addressId) || undefined,
      zip: digits(customer.zip),
      street: clean(customer.street),
      number: clean(customer.number),
      complement: clean(customer.complement),
      district: clean(customer.district),
      city: clean(customer.city),
      state: clean(customer.state),
      isDefault: !clean(customer.addressId) ? undefined : undefined,
    });
    const persistedCustomer = customerWithAddress;
    let loyaltyReservation: { id: string; points: number; value: number } | null = null;
    if (reservationId) { const sessionCustomerKey = verifySession(request); if (!sessionCustomerKey || sessionCustomerKey !== customerKey) return json({ error: 'A sessão de fidelidade não corresponde ao cliente do pedido.' }, 401); const account = cleanupExpiredReservations(await loadPointsAccount(customerKey)); const reservation = (account.reservations || []).find(item => item.id === reservationId && item.checkoutId === checkoutId && item.status === 'reserved'); if (!reservation) return json({ error: 'A reserva de pontos não está disponível ou expirou.' }, 409); loyaltyReservation = { id: reservation.id, points: reservation.points, value: reservation.value }; }

    let contactId = Number(persistedCustomer.blingContactId || 0);
    const contactData = { nome: clean(customer.name), tipoPessoa: 'F', email, telefone: clean(customer.phone), endereco: { geral: { endereco: clean(customer.street), numero: clean(customer.number), complemento: clean(customer.complement), bairro: clean(customer.district), municipio: clean(customer.city), uf: clean(customer.state).toUpperCase(), cep: digits(customer.zip) } } };
    if (contactId) {
      const updateResponse = await blingFetch(`/contatos/${contactId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(contactData) });
      if (!updateResponse.ok && ![400, 404].includes(updateResponse.status)) { const details = await updateResponse.text(); console.warn('Bling contact update rejected; continuing with existing contact:', updateResponse.status, blingError(details)); }
      if (!updateResponse.ok && updateResponse.status === 404) contactId = 0;
    }
    if (!contactId) {
      const createResponse = await blingFetch('/contatos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(contactData) });
      if (!createResponse.ok) { const details = await createResponse.text(); return json({ error: `Não foi possível cadastrar o cliente no Bling. ${blingError(details)}`.trim() }, 422); }
      const created = await createResponse.json() as { data?: { id?: number } };
      contactId = Number(created.data?.id || 0);
      if (contactId) await saveCustomer({ ...persistedCustomer, blingContactId: contactId });
    }
    if (!contactId) return json({ error: 'O Bling não retornou o ID do cliente.' }, 502);

    const normalizedItems = items.map(item => ({ produto: { id: Number(item.id) }, codigo: clean(item.code) || undefined, descricao: clean(item.name) || undefined, unidade: 'UN', quantidade: Math.max(1, Number(item.quantity || 1)), valor: money(item.price), desconto: 0 })).filter(item => Number.isInteger(item.produto.id) && item.produto.id > 0 && item.valor > 0);
    if (!normalizedItems.length) return json({ error: 'Não foi possível identificar os produtos da sacola.' }, 400);
    const subtotal = normalizedItems.reduce((sum, item) => sum + item.quantidade * item.valor, 0); const loyaltyDiscount = loyaltyReservation ? Math.min(loyaltyReservation.value, subtotal) : 0; const payment = clean(body.payment) || 'NÃO INFORMADO'; const addressLine = `${clean(customer.street)}, ${clean(customer.number)}${clean(customer.complement) ? `, ${clean(customer.complement)}` : ''} - ${clean(customer.district)} - ${clean(customer.city)}/${clean(customer.state).toUpperCase()} - CEP ${digits(customer.zip)}`;
    const observations = ['PEDIDO REALIZADO PELO SITE CAPITÃO SUPLEMENTOS', `Pagamento escolhido: ${payment}`, 'Pagamento será realizado somente no momento da entrega.', loyaltyReservation ? `RESGATE DE PONTOS: ${loyaltyReservation.points} pontos = R$ ${loyaltyDiscount.toFixed(2)}` : '', `Endereço de entrega: ${addressLine}`, clean(customer.observation) ? `Observação: ${clean(customer.observation)}` : ''].filter(Boolean).join('\n');
    const orderPayload = { numeroLoja: checkoutId, data: today(), contato: { id: contactId }, observacoes: observations, observacoesInternas: `CHECKOUT ID: ${checkoutId}${loyaltyReservation ? ` | RESGATE PONTOS: ${loyaltyReservation.id}` : ''}`, itens: normalizedItems, ...(loyaltyDiscount > 0 ? { desconto: { valor: Number(loyaltyDiscount.toFixed(2)), unidade: 'REAL' } } : {}), transporte: { etiqueta: { nome: clean(customer.name), endereco: clean(customer.street), numero: clean(customer.number), complemento: clean(customer.complement), bairro: clean(customer.district), municipio: clean(customer.city), uf: clean(customer.state).toUpperCase(), cep: digits(customer.zip) } } };
    const orderResponse = await blingFetch('/pedidos/vendas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderPayload) });
    const orderText = await orderResponse.text();
    if (!orderResponse.ok) { console.error('Bling sales order rejected:', orderResponse.status, orderText.slice(0, 1500)); return json({ error: `O Bling rejeitou o pedido. ${blingError(orderText)}`.trim() }, orderResponse.status === 401 || orderResponse.status === 403 ? 403 : 422); }
    let result: { data?: { id?: number; numero?: number } } = {}; try { result = JSON.parse(orderText); } catch { }
    const orderId = Number(result.data?.id || 0); const orderNumber = Number(result.data?.numero || 0) || undefined; if (!orderId) return json({ error: 'O Bling recebeu uma resposta sem o ID do pedido.' }, 502);
    const total = Math.max(0, subtotal - loyaltyDiscount); const accountBeforeSave = loyaltyReservation ? cleanupExpiredReservations(await loadPointsAccount(customerKey)) : null; let pointsAccount = accountBeforeSave;
    if (loyaltyReservation && pointsAccount) { const reservation = (pointsAccount.reservations || []).find(item => item.id === loyaltyReservation!.id && item.checkoutId === checkoutId && item.status === 'reserved'); if (!reservation) return json({ error: 'O pedido foi criado, mas a reserva de pontos não pôde ser localizada para baixa automática.' }, 500); pointsAccount = applyEntry(pointsAccount, { type: 'redeem', points: -reservation.points, orderId, checkoutId, description: `Resgate de ${reservation.points} pontos no pedido ${orderNumber || orderId}` }); pointsAccount = { ...pointsAccount, reservations: (pointsAccount.reservations || []).map(item => item.id === reservation.id ? { ...item, status: 'consumed' as const } : item), updatedAt: new Date().toISOString() }; await savePointsAccount(pointsAccount); }
    await saveCreatedOrder(checkoutId, { id: orderId, numero: orderNumber, checkoutId, customerKey, customerId: customerKey, customerEmail: email, customerName: clean(customer.name), customerPhone: digits(customer.phone), data: today(), total, subtotal, loyaltyDiscount, loyaltyReservationId: loyaltyReservation?.id || null, loyaltyPointsRedeemed: loyaltyReservation?.points || 0, pointsEligible: true, pointsAwarded: false, pointsReversed: false, situacao: { valor: 'Em aberto' }, vendedor: null, itens: normalizedItems.map(item => ({ produtoId: item.produto.id, descricao: item.descricao || 'Produto', quantidade: item.quantidade, valor: item.valor, total: item.quantidade * item.valor })), estimatedPoints: pointsFromOrderTotal(total), updatedAt: new Date().toISOString() });
    let notificationQueued=false; let notificationId:string|null=null; try { const notification=await queueSiteOrderCreated({checkoutId,phone:digits(customer.phone),customerName:clean(customer.name),orderId,orderNumber}); notificationQueued=Boolean(notification); notificationId=notification?.id||null; } catch (notificationError) { console.error('Site order notification queue error:', notificationError); }
    return json({ created: true, orderId, orderNumber, blingContactId: contactId, subtotal, loyaltyDiscount, total, loyaltyPointsRedeemed: loyaltyReservation?.points || 0, notificationQueued, notificationId }, 201);
  } catch (error) { console.error('Bling order creation error:', error); return json({ error: error instanceof Error ? error.message : 'Não foi possível registrar o pedido.' }, 503); }
}

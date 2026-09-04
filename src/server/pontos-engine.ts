import { get, put } from '@vercel/blob';
import { accountStorageKey, applyEntry, canonicalCustomerKey, CYCLE_POINTS, emptyPointsAccount, pointsFromOrderTotal } from './pontos.js';
import { createBonusRecord, flushPendingPointEmails, queueBonusEmail, queueMilestoneEmails } from './pontos-notifications.js';

type OrderSnapshot = Record<string, any>;
function blobOptions() { const token = process.env.BLOB_READ_WRITE_TOKEN; return token ? { access: 'private' as const, useCache: false, token } : { access: 'private' as const, useCache: false }; }
async function loadAccount(customerKey: string) {
  try {
    const result = await get(accountStorageKey(customerKey), blobOptions());
    if (!result?.stream) return emptyPointsAccount(customerKey);
    const parsed = JSON.parse(await new Response(result.stream).text());
    return { ...emptyPointsAccount(customerKey), ...parsed, customerKey, entries: Array.isArray(parsed.entries) ? parsed.entries : [], bonuses: Array.isArray(parsed.bonuses) ? parsed.bonuses : [], pendingEmails: Array.isArray(parsed.pendingEmails) ? parsed.pendingEmails : [], sentEmailIds: Array.isArray(parsed.sentEmailIds) ? parsed.sentEmailIds : [], cycleEarned: Number(parsed.cycleEarned || 0) };
  } catch { return emptyPointsAccount(customerKey); }
}
async function saveAccount(account: ReturnType<typeof emptyPointsAccount>) { const token = process.env.BLOB_READ_WRITE_TOKEN; await put(accountStorageKey(account.customerKey), JSON.stringify(account), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', ...(token ? { token } : {}) }); }
function orderDocument(order: OrderSnapshot) { return order.customerDocument || order.contato?.numeroDocumento || order.customer?.document || order.cliente?.numeroDocumento || ''; }
function orderEmail(order: OrderSnapshot) { return String(order.customerEmail || order.email || order.customer?.email || order.contato?.email || '').trim().toLowerCase(); }
function statusText(status: unknown) { return typeof status === 'object' && status !== null ? String((status as any).descricao || (status as any).nome || (status as any).valor || '') : String(status || ''); }
function normalizedStatus(status: unknown) { return statusText(status).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
export function isEligibleOrderStatus(status: unknown) { const normalized = normalizedStatus(status); return ['entregue', 'finalizado', 'concluido', 'concluida'].some(word => normalized.includes(word)); }
export function isCancelledOrderStatus(status: unknown) { const normalized = normalizedStatus(status); return normalized.includes('cancel') || normalized.includes('devol') || normalized.includes('estornado'); }

export async function awardOrderPoints(order: OrderSnapshot) {
  const customerKey = String(order.customerKey || canonicalCustomerKey(orderDocument(order), orderEmail(order)));
  const orderId = Number(order.id || 0); const checkoutId = String(order.checkoutId || '').trim(); const total = Number(order.total || 0);
  if (!customerKey || !orderId || !checkoutId || total <= 0) return { earned: false, reason: 'missing-data' as const };
  const account = await loadAccount(customerKey);
  const existing = account.entries.find(entry => entry.type === 'earn' && (entry.orderId === orderId || entry.checkoutId === checkoutId));
  if (existing) return { earned: false, duplicate: true, points: existing.points, balance: account.balance };
  const points = pointsFromOrderTotal(total); if (!points) return { earned: false, reason: 'zero-points' as const };
  let next = { ...account, email: orderEmail(order) || account.email || null };
  const previousCycleEarned = next.cycleEarned || 0;
  next = applyEntry(next, { type: 'earn', points, orderId, checkoutId, description: `Pontos da compra #${orderId}` });
  next = await queueMilestoneEmails(next, previousCycleEarned);

  while (next.cycleEarned >= CYCLE_POINTS) {
    const cycle = Math.floor(((next.lifetimeEarned || 0) - next.cycleEarned) / CYCLE_POINTS) + 1;
    next = await queueBonusEmail(next, cycle);
    const bonus = createBonusRecord(cycle, next);
    const conversionId = `cycle-${cycle}-conversion`;
    if (!next.entries.some(entry => entry.id === conversionId)) {
      next = { ...next, balance: Math.max(0, next.balance - CYCLE_POINTS), cycleEarned: next.cycleEarned - CYCLE_POINTS, entries: [...next.entries, { id: conversionId, type: 'redeem', points: -CYCLE_POINTS, description: `Conversão automática do ciclo ${cycle} em bônus de R$ 50,00`, createdAt: new Date().toISOString() }], lifetimeRedeemed: next.lifetimeRedeemed + CYCLE_POINTS, bonuses: [...(next.bonuses || []).filter(item => item.id !== bonus.id), bonus], updatedAt: new Date().toISOString() };
      next = await queueMilestoneEmails(next, 0);
    } else {
      next = { ...next, cycleEarned: next.cycleEarned - CYCLE_POINTS, balance: Math.max(0, next.balance - CYCLE_POINTS) };
    }
  }

  await saveAccount(next);
  await flushPendingPointEmails(next);
  return { earned: true, points, balance: next.balance, customerKey };
}

export async function reverseOrderPoints(order: OrderSnapshot) {
  const customerKey = String(order.customerKey || canonicalCustomerKey(orderDocument(order), orderEmail(order)));
  const orderId = Number(order.id || 0); const checkoutId = String(order.checkoutId || '').trim();
  if (!customerKey || !orderId || !checkoutId) return { reversed: false, reason: 'missing-data' as const };
  const account = await loadAccount(customerKey);
  const earned = account.entries.find(entry => entry.type === 'earn' && (entry.orderId === orderId || entry.checkoutId === checkoutId));
  if (!earned) return { reversed: false, reason: 'earn-not-found' as const };
  const reversalId = `reversal-${earned.id}`;
  if (account.entries.some(entry => entry.id === reversalId)) return { reversed: false, duplicate: true, balance: account.balance };
  const applied = applyEntry(account, { type: 'reversal', points: -Math.abs(earned.points), orderId, checkoutId, description: `Estorno dos pontos da compra #${orderId}` });
  const last = applied.entries[applied.entries.length - 1];
  const entries = applied.entries.filter(entry => entry.id !== last.id).concat({ ...last, id: reversalId });
  const next = { ...applied, entries, cycleEarned: Math.max(0, applied.cycleEarned - Math.abs(earned.points)) };
  await saveAccount(next);
  await flushPendingPointEmails(next);
  return { reversed: true, points: Math.abs(earned.points), balance: next.balance };
}

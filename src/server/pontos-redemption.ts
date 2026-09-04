import { createHmac, timingSafeEqual } from 'node:crypto';
import { get, put } from '@vercel/blob';
import { accountStorageKey, applyEntry, cleanupExpiredReservations, emptyPointsAccount, PointsAccount, PointsReservation } from './pontos.js';

function sessionSecret() { return process.env.CUSTOMER_SESSION_SECRET || process.env.BLOB_READ_WRITE_TOKEN || process.env.RESEND_API_KEY || ''; }

export function verifyCustomerSession(request: Request) {
  const token = (request.headers.get('authorization') || '').startsWith('Bearer ') ? (request.headers.get('authorization') || '').slice(7).trim() : '';
  const [payload, signature] = token.split('.');
  const secret = sessionSecret();
  if (!payload || !signature || !secret) return '';
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return '';
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; exp?: number };
    return data.sub && data.exp && Date.now() <= data.exp ? data.sub : '';
  } catch { return ''; }
}

function blobOptions() { const token = process.env.BLOB_READ_WRITE_TOKEN; return { access: 'private' as const, useCache: false, ...(token ? { token } : {}) }; }

export async function loadPointsAccount(customerKey: string) {
  try {
    const result = await get(accountStorageKey(customerKey), blobOptions());
    if (!result?.stream) return emptyPointsAccount(customerKey);
    const parsed = JSON.parse(await new Response(result.stream).text());
    return { ...emptyPointsAccount(customerKey), ...parsed, customerKey, entries: Array.isArray(parsed.entries) ? parsed.entries : [], reservations: Array.isArray(parsed.reservations) ? parsed.reservations : [], bonuses: Array.isArray(parsed.bonuses) ? parsed.bonuses : [], pendingEmails: Array.isArray(parsed.pendingEmails) ? parsed.pendingEmails : [], sentEmailIds: Array.isArray(parsed.sentEmailIds) ? parsed.sentEmailIds : [] } as PointsAccount;
  } catch { return emptyPointsAccount(customerKey); }
}

export async function savePointsAccount(account: PointsAccount) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  await put(accountStorageKey(account.customerKey), JSON.stringify(account), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', ...(token ? { token } : {}) });
}

export function findReservation(account: PointsAccount, reservationId: string, checkoutId: string) {
  return (account.reservations || []).find(item => item.id === reservationId && item.checkoutId === checkoutId) || null;
}

export async function consumeReservation(customerKey: string, reservationId: string, checkoutId: string, orderId: number) {
  const account = cleanupExpiredReservations(await loadPointsAccount(customerKey));
  const reservation = findReservation(account, reservationId, checkoutId);
  if (!reservation) return { ok: false as const, reason: 'not-found' as const };
  if (reservation.status === 'consumed') return { ok: true as const, duplicate: true, points: reservation.points, value: reservation.value, account };
  if (reservation.status !== 'reserved') return { ok: false as const, reason: 'not-active' as const };
  if (new Date(reservation.expiresAt).getTime() <= Date.now()) return { ok: false as const, reason: 'expired' as const };
  const nextReservations = (account.reservations || []).map(item => item.id === reservation.id ? { ...item, status: 'consumed' as const } : item);
  const entryKey = `redeem-${reservation.id}`;
  let next = { ...account, reservations: nextReservations };
  next = applyEntry(next, { type: 'redeem', points: -Math.abs(reservation.points), orderId, checkoutId, description: `Resgate de ${reservation.points} pontos no pedido #${orderId}` });
  await savePointsAccount(next);
  return { ok: true as const, duplicate: false, points: reservation.points, value: reservation.value, account: next, entryKey };
}

export function reservationIsUsable(reservation: PointsReservation | null, checkoutId: string) {
  return Boolean(reservation && reservation.checkoutId === checkoutId && reservation.status === 'reserved' && new Date(reservation.expiresAt).getTime() > Date.now());
}

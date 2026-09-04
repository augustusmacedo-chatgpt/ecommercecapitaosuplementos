import { createHash } from 'node:crypto';

export const POINTS_PER_REAL = 1;
export const VALUE_PER_POINT = 0.05;
export const MIN_REDEMPTION_POINTS = 100;
export const CYCLE_POINTS = 1000;

export type PointsEntryType = 'earn' | 'redeem' | 'adjust' | 'reversal' | 'expiration';

export type PendingPointEmail = {
  id: string;
  type: 'milestone' | 'bonus';
  milestone?: number;
  cycle?: number;
  to: string;
  bonusCodePix?: string;
  bonusCodeCard?: string;
  bonusValue?: number;
  createdAt: string;
};

export type PointsBonus = {
  id: string;
  cycle: number;
  value: number;
  pointsConverted: number;
  pixCashCode: string | null;
  cardCode: string | null;
  createdAt: string;
  status: 'available' | 'used' | 'expired';
};

export type PointsEntry = {
  id: string;
  type: PointsEntryType;
  points: number;
  orderId?: number | null;
  checkoutId?: string | null;
  description: string;
  createdAt: string;
};

export type PointsAccount = {
  customerKey: string;
  email?: string | null;
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  cycleEarned: number;
  entries: PointsEntry[];
  bonuses?: PointsBonus[];
  pendingEmails?: PendingPointEmail[];
  sentEmailIds?: string[];
  updatedAt: string;
};

export function normalizeDocument(value: string) {
  return String(value || '').replace(/\D/g, '');
}

export function normalizeEmail(value: string) {
  return String(value || '').trim().toLowerCase();
}

export function canonicalCustomerKey(document?: string, email?: string) {
  const doc = normalizeDocument(document || '');
  if ([11, 14].includes(doc.length)) return `document:${doc}`;
  const mail = normalizeEmail(email || '');
  if (mail.includes('@')) return `email:${mail}`;
  return '';
}

export function pointsFromOrderTotal(total: number) {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.floor(total * POINTS_PER_REAL);
}

export function pointsValue(points: number) {
  return Math.max(0, Math.floor(points)) * VALUE_PER_POINT;
}

export function accountStorageKey(customerKey: string) {
  return `points/accounts/${createHash('sha256').update(customerKey).digest('hex')}.json`;
}

export function emptyPointsAccount(customerKey: string): PointsAccount {
  return { customerKey, email: null, balance: 0, lifetimeEarned: 0, lifetimeRedeemed: 0, cycleEarned: 0, entries: [], bonuses: [], pendingEmails: [], sentEmailIds: [], updatedAt: new Date().toISOString() };
}

export function applyEntry(account: PointsAccount, entry: Omit<PointsEntry, 'id' | 'createdAt'>): PointsAccount {
  const id = createHash('sha256').update(JSON.stringify({ ...entry, customerKey: account.customerKey })).digest('hex').slice(0, 24);
  if (account.entries.some(existing => existing.id === id)) return account;
  const points = Math.floor(entry.points);
  const next = { ...account, entries: [...account.entries, { ...entry, points, id, createdAt: new Date().toISOString() }] };
  next.balance = Math.max(0, next.balance + points);
  if (entry.type === 'earn' && points > 0) {
    next.lifetimeEarned += points;
    next.cycleEarned += points;
  }
  if (entry.type === 'redeem' && points < 0) next.lifetimeRedeemed += Math.abs(points);
  next.updatedAt = new Date().toISOString();
  return next;
}

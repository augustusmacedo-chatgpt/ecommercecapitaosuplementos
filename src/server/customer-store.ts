import { createHash } from 'node:crypto';
import { get, put, hasStorage } from './storage.js';

const CUSTOMER_PREFIX = 'customers/by-id/';
const EMAIL_PREFIX = 'customers/by-email/';
const PHONE_PREFIX = 'customers/by-phone/';
const NAME_PREFIX = 'customers/by-name/';

export type CustomerAddress = { street: string; number: string; complement: string; district: string; city: string; state: string; zip: string; label?: string; };
export type CustomerRecord = {
  id: string;
  email: string;
  emailVerified?: boolean;
  name: string;
  phone: string;
  document?: string;
  birthDate?: string;
  addresses?: CustomerAddress[];
  address?: CustomerAddress;
  observation?: string;
  blingContactId?: number;
  createdAt: string;
  updatedAt?: string;
};

export function normalizeEmail(value: unknown) { return String(value ?? '').trim().toLowerCase(); }
export function normalizePhone(value: unknown) { return String(value ?? '').replace(/\D/g, ''); }
export function normalizeName(value: unknown) { return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR'); }
function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
function idKey(id: string) { return `${CUSTOMER_PREFIX}${id}.json`; }
function emailKey(email: string) { return `${EMAIL_PREFIX}${hash(normalizeEmail(email))}.json`; }
function phoneKey(phone: string) { return `${PHONE_PREFIX}${hash(normalizePhone(phone))}.json`; }
function nameKey(name: string) { return `${NAME_PREFIX}${hash(normalizeName(name))}.json`; }

async function readJson<T>(key: string): Promise<T | null> {
  if (!hasStorage()) throw new Error('Armazenamento de clientes não configurado no Cloudflare R2.');
  const result = await get(key);
  if (!result?.stream) return null;
  try { return JSON.parse(await new Response(result.stream).text()) as T; } catch { return null; }
}

export async function loadCustomerById(id: string) {
  return readJson<CustomerRecord>(idKey(String(id || '').trim()));
}

export async function loadCustomerByEmail(email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const index = await readJson<{ id?: string }>(emailKey(normalized));
  if (index?.id) {
    const customer = await loadCustomerById(index.id);
    if (customer) return customer;
  }
  // Compatibilidade com a base antiga, que usava o e-mail como arquivo principal.
  const legacy = await readJson<CustomerRecord>(`customers/${hash(normalized)}.json`);
  return legacy;
}

export async function loadCustomerByPhone(phone: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const index = await readJson<{ id?: string }>(phoneKey(normalized));
  return index?.id ? loadCustomerById(index.id) : null;
}

export async function findCustomersByName(name: string) {
  const normalized = normalizeName(name);
  if (!normalized) return [] as CustomerRecord[];
  const index = await readJson<{ ids?: string[] }>(nameKey(normalized));
  const ids = Array.isArray(index?.ids) ? index!.ids! : [];
  const customers = await Promise.all(ids.map(loadCustomerById));
  return customers.filter((customer): customer is CustomerRecord => Boolean(customer));
}

export async function saveCustomer(customer: CustomerRecord) {
  if (!hasStorage()) throw new Error('Armazenamento de clientes não configurado no Cloudflare R2.');
  const now = new Date().toISOString();
  const normalized: CustomerRecord = {
    ...customer,
    id: customer.id || crypto.randomUUID(),
    name: String(customer.name || '').trim(),
    email: normalizeEmail(customer.email),
    phone: normalizePhone(customer.phone),
    createdAt: customer.createdAt || now,
    updatedAt: now,
  };
  await put(idKey(normalized.id), JSON.stringify(normalized), { contentType: 'application/json' });
  if (normalized.email) await put(emailKey(normalized.email), JSON.stringify({ id: normalized.id }), { contentType: 'application/json' });
  if (normalized.phone) await put(phoneKey(normalized.phone), JSON.stringify({ id: normalized.id }), { contentType: 'application/json' });
  if (normalized.name) {
    const existing = await readJson<{ ids?: string[] }>(nameKey(normalized.name));
    const ids = [...new Set([...(existing?.ids || []), normalized.id])];
    await put(nameKey(normalized.name), JSON.stringify({ ids }), { contentType: 'application/json' });
  }
  return normalized;
}

// Compatibilidade: o carregamento público por e-mail continua disponível para partes antigas.
export async function loadCustomer(email: string) { return loadCustomerByEmail(email); }
export function customerKey(email: string) { return emailKey(email); }
export function publicCustomer(customer: CustomerRecord) {
  return { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, blingContactId: customer.blingContactId };
}

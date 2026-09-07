import { createHash } from 'node:crypto';
import { get, put, hasStorage } from './storage.js';

const CUSTOMER_PREFIX = 'customers/by-id/';
const EMAIL_PREFIX = 'customers/by-email/';
const PHONE_PREFIX = 'customers/by-phone/';
const NAME_PREFIX = 'customers/by-name/';

export type CustomerAddress = {
  id: string;
  label?: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  zip: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

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

function normalizeAddress(value: Partial<CustomerAddress>, fallbackDefault = false): CustomerAddress {
  const now = new Date().toISOString();
  return {
    id: String(value.id || crypto.randomUUID()),
    label: String(value.label || '').trim() || undefined,
    street: String(value.street || '').trim(),
    number: String(value.number || '').trim(),
    complement: String(value.complement || '').trim(),
    district: String(value.district || '').trim(),
    city: String(value.city || '').trim(),
    state: String(value.state || '').trim().toUpperCase(),
    zip: String(value.zip || '').replace(/\D/g, '').slice(0, 8),
    isDefault: Boolean(value.isDefault ?? fallbackDefault),
    createdAt: value.createdAt || now,
    updatedAt: now,
  };
}

export function customerAddresses(customer: CustomerRecord): CustomerAddress[] {
  const raw = Array.isArray(customer.addresses) && customer.addresses.length
    ? customer.addresses
    : customer.address ? [customer.address] : [];
  const addresses = raw.map((address, index) => normalizeAddress(address, index === 0));
  if (addresses.length && !addresses.some(address => address.isDefault)) addresses[0].isDefault = true;
  return addresses;
}

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
    if (customer && normalizeEmail(customer.email) === normalized) return customer;
  }
  const legacy = await readJson<CustomerRecord>(`customers/${hash(normalized)}.json`);
  return legacy;
}

export async function loadCustomerByPhone(phone: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const index = await readJson<{ id?: string }>(phoneKey(normalized));
  if (!index?.id) return null;
  const customer = await loadCustomerById(index.id);
  return customer && normalizePhone(customer.phone) === normalized ? customer : null;
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
  const normalizedAddresses = customerAddresses(customer);
  const defaultAddress = normalizedAddresses.find(address => address.isDefault) || normalizedAddresses[0];
  const normalized: CustomerRecord = {
    ...customer,
    id: customer.id || crypto.randomUUID(),
    name: String(customer.name || '').trim(),
    email: normalizeEmail(customer.email),
    phone: normalizePhone(customer.phone),
    addresses: normalizedAddresses,
    address: defaultAddress,
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

export async function saveCustomerAddress(customer: CustomerRecord, input: Partial<CustomerAddress>) {
  const addresses = customerAddresses(customer);
  const existingIndex = input.id ? addresses.findIndex(address => address.id === input.id) : -1;
  const existing = existingIndex >= 0 ? addresses[existingIndex] : undefined;
  const next = normalizeAddress({ ...existing, ...input, id: existing?.id || input.id || crypto.randomUUID(), createdAt: existing?.createdAt }, !addresses.length);
  let updated: CustomerAddress[];
  if (existingIndex >= 0) updated = addresses.map((address, index) => index === existingIndex ? next : address);
  else updated = [...addresses, next];

  if (next.isDefault || !updated.some(address => address.isDefault)) {
    updated = updated.map(address => ({ ...address, isDefault: address.id === next.id }));
  }
  return saveCustomer({ ...customer, addresses: updated, address: updated.find(address => address.isDefault) || updated[0] });
}

export async function removeCustomerAddress(customer: CustomerRecord, addressId: string) {
  const addresses = customerAddresses(customer).filter(address => address.id !== addressId);
  if (addresses.length && !addresses.some(address => address.isDefault)) addresses[0].isDefault = true;
  return saveCustomer({ ...customer, addresses, address: addresses.find(address => address.isDefault) || addresses[0] });
}

export async function setDefaultCustomerAddress(customer: CustomerRecord, addressId: string) {
  const addresses = customerAddresses(customer);
  if (!addresses.some(address => address.id === addressId)) throw new Error('Endereço não encontrado.');
  const updated = addresses.map(address => ({ ...address, isDefault: address.id === addressId }));
  return saveCustomer({ ...customer, addresses: updated, address: updated.find(address => address.isDefault) });
}

export async function loadCustomer(email: string) { return loadCustomerByEmail(email); }
export function customerKey(email: string) { return emailKey(email); }
export function publicCustomer(customer: CustomerRecord) {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    birthDate: customer.birthDate || '',
    addresses: customerAddresses(customer),
    address: customerAddresses(customer).find(address => address.isDefault) || customerAddresses(customer)[0] || null,
    blingContactId: customer.blingContactId,
  };
}

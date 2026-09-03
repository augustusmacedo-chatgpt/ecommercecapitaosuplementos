import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { get, put } from '@vercel/blob';

const PATH_PREFIX = 'customers/';
export type CustomerRecord = {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  phone: string;
  document: string;
  birthDate: string;
  address: { street: string; number: string; complement: string; district: string; city: string; state: string; zip: string };
  observation: string;
  blingContactId?: number;
  createdAt: string;
};
export function normalizeEmail(value: string) { return value.trim().toLowerCase(); }
export function customerKey(email: string) { return `${PATH_PREFIX}${createHash('sha256').update(normalizeEmail(email)).digest('hex')}.json`; }
export function hashPassword(password: string) { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; }
export function verifyPassword(password: string, stored: string) { const [salt, hash] = stored.split(':'); if (!salt || !hash) return false; const actual = scryptSync(password, salt, 64); const expected = Buffer.from(hash, 'hex'); return actual.length === expected.length && timingSafeEqual(actual, expected); }
function hasStorage() { return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID); }
export async function loadCustomer(email: string) { if (!hasStorage()) throw new Error('Armazenamento de clientes não configurado.'); const token = process.env.BLOB_READ_WRITE_TOKEN; const result = token ? await get(customerKey(email), { access: 'private', useCache: false, token }) : await get(customerKey(email), { access: 'private', useCache: false }); if (!result || result.statusCode !== 200 || !result.stream) return null; try { return JSON.parse(await new Response(result.stream).text()) as CustomerRecord; } catch { return null; } }
export async function saveCustomer(customer: CustomerRecord) { if (!hasStorage()) throw new Error('Armazenamento de clientes não configurado.'); const token = process.env.BLOB_READ_WRITE_TOKEN; await put(customerKey(customer.email), JSON.stringify(customer), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', ...(token ? { token } : {}) }); }
export function publicCustomer(customer: CustomerRecord) { return { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, blingContactId: customer.blingContactId }; }

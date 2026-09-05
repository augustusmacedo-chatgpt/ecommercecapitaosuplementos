import { createHash } from 'node:crypto';

export type CustomerIdentityType = 'document' | 'email';

export function normalizeDocument(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function isValidDocument(value: unknown): boolean {
  const document = normalizeDocument(value);
  return document.length === 11 || document.length === 14;
}

export function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function isValidEmail(value: unknown): boolean {
  const email = normalizeEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * CPF/CNPJ is the preferred identity key because it connects site and PDV.
 * Email is the fallback for customers who entered the flow without a document.
 */
export function resolveCustomerIdentity(input: { document?: unknown; email?: unknown }) {
  const document = normalizeDocument(input.document);
  if (document) {
    return {
      type: 'document' as const,
      value: document,
      key: customerKey('document', document),
    };
  }

  const email = normalizeEmail(input.email);
  if (email) {
    return {
      type: 'email' as const,
      value: email,
      key: customerKey('email', email),
    };
  }

  return null;
}

export function customerKey(type: CustomerIdentityType, value: string): string {
  return createHash('sha256').update(`${type}:${value}`).digest('hex');
}

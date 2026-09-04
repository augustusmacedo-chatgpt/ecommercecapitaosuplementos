import { createHash, createHmac } from 'node:crypto';
import { get } from '@vercel/blob';
import { json, readJsonBody } from '../../src/server/bling-shared.js';
import { customerKey, normalizeDocument, normalizeEmail } from '../../src/server/customer-identity.js';

const otpKey = (identifier: string) => `customer-otp/${createHash('sha256').update(identifier).digest('hex')}.json`;
function sessionSecret() { return process.env.CUSTOMER_SESSION_SECRET || process.env.BLOB_READ_WRITE_TOKEN || process.env.RESEND_API_KEY || ''; }
function createSessionToken(key: string) {
  const secret = sessionSecret();
  if (!secret) return '';
  const payload = Buffer.from(JSON.stringify({ sub: key, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request) as { document?: string; email?: string; code?: string };
    const document = normalizeDocument(body.document);
    const email = normalizeEmail(body.email);
    const identifier = email.includes('@') ? email : document;
    if (!identifier || !body.code) return json({ error: 'Informe o CPF/CNPJ ou e-mail e o código.' }, 400);
    if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) return json({ error: 'Armazenamento não configurado.' }, 503);
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const result = await get(otpKey(identifier), { access: 'private', useCache: false, ...(token ? { token } : {}) });
    if (!result || !result.stream) return json({ error: 'Código expirado. Solicite um novo código.' }, 401);
    const saved = JSON.parse(await new Response(result.stream).text()) as { code: string; expires: number; email?: string; identifierType?: 'document' | 'email'; customerKey?: string };
    if (Date.now() > saved.expires) return json({ error: 'Código expirado. Solicite um novo código.' }, 401);
    if (String(body.code) !== saved.code) return json({ error: 'Código inválido ou expirado.' }, 401);
    const identifierType = saved.identifierType || (email ? 'email' : 'document');
    const resolvedValue = identifierType === 'document' ? document || identifier : normalizeEmail(saved.email || email || identifier);
    const resolvedKey = saved.customerKey || customerKey(identifierType, resolvedValue);
    const sessionToken = createSessionToken(resolvedKey);
    if (!sessionToken) return json({ error: 'Sessão segura indisponível.' }, 503);
    return json({ verified: true, identifierType, customerKey: resolvedKey, sessionToken, document: identifierType === 'document' ? resolvedValue : null, email: saved.email || email || null }, 200);
  } catch { return json({ error: 'Não foi possível validar o código.' }, 503); }
}

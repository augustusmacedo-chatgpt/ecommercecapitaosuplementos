import { createHash } from 'node:crypto';
import { get } from '@vercel/blob';
import { json, readJsonBody } from '../../src/server/bling-shared.js';

const key = (identifier: string) => `customer-otp/${createHash('sha256').update(identifier).digest('hex')}.json`;

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request) as { document?: string; email?: string; code?: string };
    const rawDocument = String(body.document || '').replace(/\D/g, '');
    const email = String(body.email || '').trim().toLowerCase();
    const identifier = email.includes('@') ? email : rawDocument;
    if (!identifier || !body.code) return json({ error: 'Informe o CPF/CNPJ ou e-mail e o código.' }, 400);
    if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) return json({ error: 'Armazenamento não configurado.' }, 503);
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const result = await get(key(identifier), { access: 'private', useCache: false, ...(token ? { token } : {}) });
    if (!result || !result.stream) return json({ error: 'Código expirado. Solicite um novo código.' }, 401);
    const saved = JSON.parse(await new Response(result.stream).text()) as { code: string; expires: number; email?: string; identifierType?: string };
    if (Date.now() > saved.expires) return json({ error: 'Código expirado. Solicite um novo código.' }, 401);
    if (String(body.code) !== saved.code) return json({ error: 'Código inválido ou expirado.' }, 401);
    return json({ verified: true, identifierType: saved.identifierType || (email ? 'email' : 'document'), email: saved.email || email || null }, 200);
  } catch {
    return json({ error: 'Não foi possível validar o código.' }, 503);
  }
}

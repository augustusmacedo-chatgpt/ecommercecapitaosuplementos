import { createHash } from 'node:crypto';
import { get } from '@vercel/blob';
import { json } from '../../src/server/bling-shared.js';

const key = (d: string) => `customer-otp/${createHash('sha256').update(d).digest('hex')}.json`;

export async function POST(request: Request) {
  try {
    const { document, code } = await request.json() as { document?: string; code?: string };
    const doc = String(document || '').replace(/\D/g, '');
    if (!doc || !code) return json({ error: 'Informe o documento e o código.' }, 400);

    if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) {
      return json({ error: 'Armazenamento não configurado.' }, 503);
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const result = await get(key(doc), {
      access: 'private',
      useCache: false,
      ...(token ? { token } : {}),
    });

    if (!result || !result.stream) return json({ error: 'Código expirado. Solicite um novo código.' }, 401);

    const saved = JSON.parse(await new Response(result.stream).text()) as { code: string; expires: number };
    if (Date.now() > saved.expires) return json({ error: 'Código expirado. Solicite um novo código.' }, 401);
    if (String(code || '') !== saved.code) return json({ error: 'Código inválido ou expirado.' }, 401);

    return json({ verified: true }, 200);
  } catch {
    return json({ error: 'Não foi possível validar o código.' }, 503);
  }
}

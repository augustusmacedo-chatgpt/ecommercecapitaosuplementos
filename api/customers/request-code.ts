import { createHash, randomInt } from 'node:crypto';
import { get, put } from '@vercel/blob';
import { json, readJsonBody } from '../../src/server/bling-shared.js';
import { getBlingAccessToken } from '../../src/server/bling-client.js';

const key = (identifier: string) => `customer-otp/${createHash('sha256').update(identifier).digest('hex')}.json`;
const maskEmail = (email: string) => email.replace(/^(.).+(@.*)$/, '$1***$2');

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request) as { document?: string; email?: string };
    const rawDocument = String(body.document || '').replace(/\D/g, '');
    const emailInput = String(body.email || '').trim().toLowerCase();
    const isEmail = Boolean(emailInput && emailInput.includes('@'));

    if (!isEmail && ![11, 14].includes(rawDocument.length)) {
      return json({ error: 'Informe um CPF/CNPJ ou um e-mail válido.' }, 400);
    }

    let email = emailInput;
    if (!isEmail) {
      const token = await getBlingAccessToken();
      const headers = { Accept: '1.0', Authorization: `Bearer ${token}` };
      const r = await fetch(`https://api.bling.com.br/Api/v3/contatos?numeroDocumento=${encodeURIComponent(rawDocument)}&limite=1`, { headers });
      if (!r.ok) return json({ error: 'Não foi possível consultar o cadastro no Bling.' }, 502);
      const data = await r.json() as { data?: Array<{ id?: number; email?: string }> };
      const contact = data.data?.[0];
      if (!contact) return json({ error: 'Não encontramos um cadastro para este CPF/CNPJ no Bling.' }, 422);
      email = contact.email || '';
      if (contact.id && !email) {
        const detail = await fetch(`https://api.bling.com.br/Api/v3/contatos/${contact.id}`, { headers });
        if (detail.ok) {
          const detailData = await detail.json() as { data?: { email?: string; emailNotaFiscal?: string } };
          email = detailData.data?.email || detailData.data?.emailNotaFiscal || '';
        }
      }
      if (!email) return json({ error: 'Encontramos seu cadastro no Bling, mas ele não possui um e-mail válido para envio do código.' }, 422);
    }

    if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Armazenamento não configurado.');
    const identifier = isEmail ? email : rawDocument;
    const code = String(randomInt(100000, 1000000));
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    await put(key(identifier), JSON.stringify({ code, expires: Date.now() + 10 * 60 * 1000, email, identifierType: isEmail ? 'email' : 'document' }), {
      access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', ...(blobToken ? { token: blobToken } : {})
    });

    const mail = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Capitão Suplementos <naoresponda@capitaosuplementos.com.br>', to: [email], subject: 'Seu código de acesso — Capitão Suplementos',
        html: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Seu código de acesso</title></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;color:#171717"><div style="max-width:600px;margin:0 auto;padding:32px 16px"><div style="background:#111;border-radius:16px;padding:28px 24px;text-align:center"><div style="font-size:24px;font-weight:800;letter-spacing:.5px;color:#f4c542">CAPITÃO SUPLEMENTOS</div><div style="margin-top:8px;font-size:14px;color:#d8d8d8">Seu acesso está quase pronto</div></div><div style="background:#fff;border-radius:16px;margin-top:16px;padding:32px 24px;text-align:center"><h1 style="margin:0 0 12px;font-size:24px;color:#171717">Seu código de acesso</h1><p style="margin:0 auto 24px;max-width:460px;font-size:16px;line-height:1.6;color:#555">Você solicitou um código para acessar sua compra na Capitão Suplementos.</p><div style="display:inline-block;background:#f5f5f5;border:2px solid #e0b52f;border-radius:12px;padding:18px 28px;font-size:36px;font-weight:800;letter-spacing:8px;color:#111">${code}</div><p style="margin:18px 0 0;font-size:14px;color:#777">Este código é válido por <strong>10 minutos</strong>.</p><div style="margin-top:28px;padding-top:24px;border-top:1px solid #eee;text-align:left"><p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#555"><strong>🔒 Segurança</strong></p><p style="margin:0;font-size:14px;line-height:1.6;color:#666">Nunca compartilhe este código. A equipe da Capitão Suplementos nunca solicitará seu código de acesso.</p></div><div style="margin-top:24px;padding-top:20px;border-top:1px solid #eee"><p style="margin:0;font-size:13px;line-height:1.6;color:#888"><strong>Este é um e-mail automático.</strong><br>Por favor, não responda a esta mensagem.</p><p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#888">Se você não solicitou este código, pode simplesmente ignorar este e-mail.</p></div></div><div style="padding:20px 10px;text-align:center;font-size:12px;color:#999">Capitão Suplementos<br>Sua evolução começa aqui.</div></div></body></html>`
      })
    });
    if (!mail.ok) throw new Error('Não foi possível enviar o código por e-mail.');
    return json({ sent: true, maskedEmail: maskEmail(email), identifierType: isEmail ? 'email' : 'document' });
  } catch (e) {
    console.error('Request customer code:', e);
    return json({ error: e instanceof Error ? e.message : 'Não foi possível enviar o código.' }, 503);
  }
}

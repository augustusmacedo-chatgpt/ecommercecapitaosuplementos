import { createHash, createHmac, randomInt } from 'node:crypto';
import { get, put } from '../../src/server/storage.js';
import { json, readJsonBody } from '../../src/server/bling-shared.js';
import { getBlingAccessToken } from '../../src/server/bling-client.js';
import { isValidEmail, normalizeEmail } from '../../src/server/customer-identity.js';
import { findCustomersByName, loadCustomerByEmail, loadCustomerByPhone, loadCustomerById, normalizePhone, publicCustomer, saveCustomer, CustomerRecord } from '../../src/server/customer-store.js';

const otpKey = (email: string) => `customer-otp/${createHash('sha256').update(email).digest('hex')}.json`;
const maskEmail = (email: string) => email.replace(/^(.).+(@.*)$/, '$1***$2');
function sessionSecret() { return process.env.CUSTOMER_SESSION_SECRET || process.env.PDV_AUTH_SECRET || process.env.RESEND_API_KEY || ''; }
function actionFrom(request: Request) { return new URL(request.url).pathname.split('/').filter(Boolean).pop() || ''; }

function createSessionToken(customerId: string) {
  const secret = sessionSecret();
  if (!secret) return '';
  const payload = Buffer.from(JSON.stringify({ sub: customerId, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

async function resolveBlingContactId(customer: CustomerRecord) {
  if (customer.blingContactId) return customer.blingContactId;
  // O cliente Capitão continua funcionando sem Bling. O vínculo é preenchido quando existir.
  return undefined;
}

async function identify(request: Request) {
  try {
    const url = new URL(request.url);
    const phone = normalizePhone(url.searchParams.get('phone') || '');
    const email = normalizeEmail(url.searchParams.get('email') || '');
    const name = String(url.searchParams.get('name') || '').trim();

    if (phone) {
      const customer = await loadCustomerByPhone(phone);
      if (customer) return json({ found: true, match: 'phone', customer: publicCustomer(customer), customerId: customer.id, blingContactId: await resolveBlingContactId(customer) }, 200, { 'Cache-Control': 'no-store' });
    }
    if (email && isValidEmail(email)) {
      const customer = await loadCustomerByEmail(email);
      if (customer) return json({ found: true, match: 'email', customer: publicCustomer(customer), customerId: customer.id, blingContactId: await resolveBlingContactId(customer) }, 200, { 'Cache-Control': 'no-store' });
    }
    if (name) {
      const matches = await findCustomersByName(name);
      if (matches.length) return json({ found: false, possibleDuplicates: matches.map(publicCustomer) }, 200, { 'Cache-Control': 'no-store' });
    }
    return json({ found: false, possibleDuplicates: [] }, 200, { 'Cache-Control': 'no-store' });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Consulta temporariamente indisponível.' }, 503);
  }
}

async function requestCode(request: Request) {
  try {
    const body = await readJsonBody(request) as { email?: string };
    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) return json({ error: 'Informe um e-mail válido.' }, 400);

    const code = String(randomInt(100000, 1000000));
    await put(otpKey(email), JSON.stringify({ code, expires: Date.now() + 10 * 60 * 1000, email }), { contentType: 'application/json' });

    const mail = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Capitão Suplementos <naoresponda@capitaosuplementos.com.br>',
        to: [email],
        subject: 'Seu código de acesso — Capitão Suplementos',
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px;text-align:center"><h2>CAPITÃO SUPLEMENTOS</h2><p>Seu código de acesso:</p><div style="font-size:36px;font-weight:800;letter-spacing:8px;padding:18px">${code}</div><p>Este código é válido por <strong>10 minutos</strong> e pode ser usado uma única vez.</p><p>Nunca compartilhe este código.</p></div>`,
      }),
    });
    if (!mail.ok) throw new Error('Não foi possível enviar o código por e-mail.');
    return json({ sent: true, maskedEmail: maskEmail(email) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Não foi possível enviar o código.' }, 503);
  }
}

async function verifyCode(request: Request) {
  try {
    const body = await readJsonBody(request) as { email?: string; code?: string };
    const email = normalizeEmail(body.email);
    if (!isValidEmail(email) || !body.code) return json({ error: 'Informe o e-mail e o código.' }, 400);

    const result = await get(otpKey(email));
    if (!result?.stream) return json({ error: 'Código expirado. Solicite um novo código.' }, 401);
    const saved = JSON.parse(await new Response(result.stream).text()) as { code: string; expires: number; email: string };
    if (Date.now() > saved.expires || String(body.code) !== saved.code) return json({ error: 'Código inválido ou expirado.' }, 401);

    let customer = await loadCustomerByEmail(email);
    if (!customer) return json({ verified: true, existingCustomer: false, email }, 200);

    // Migra cadastros antigos para a nova base no primeiro acesso válido.
    customer = await saveCustomer({ ...customer, id: customer.id || crypto.randomUUID(), email, emailVerified: true });
    const sessionToken = createSessionToken(customer.id);
    if (!sessionToken) return json({ error: 'Sessão segura indisponível.' }, 503);
    return json({ verified: true, existingCustomer: true, email, customerId: customer.id, sessionToken, customer: publicCustomer(customer) });
  } catch {
    return json({ error: 'Não foi possível validar o código.' }, 503);
  }
}

async function createBlingContact(customer: CustomerRecord) {
  try {
    const token = await getBlingAccessToken();
    const response = await fetch('https://api.bling.com.br/Api/v3/contatos', {
      method: 'POST',
      headers: { Accept: '1.0', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ nome: customer.name, tipoPessoa: 'F', email: customer.email, telefone: customer.phone }),
    });
    if (!response.ok) return undefined;
    const data = await response.json() as { data?: { id?: number } };
    return data.data?.id;
  } catch { return undefined; }
}

async function register(request: Request) {
  try {
    const body = await readJsonBody(request) as Record<string, unknown>;
    const name = String(body.name || '').trim();
    const phone = normalizePhone(body.phone);
    const email = normalizeEmail(body.email);
    if (!name || !phone || !isValidEmail(email)) return json({ error: 'Nome completo, WhatsApp e e-mail são obrigatórios.' }, 400);

    const byPhone = await loadCustomerByPhone(phone);
    if (byPhone) return json({ error: 'Já existe um cadastro com este WhatsApp.', customer: publicCustomer(byPhone), customerId: byPhone.id }, 409);

    const byEmail = await loadCustomerByEmail(email);
    if (byEmail) return json({ error: 'Já existe um cadastro com este e-mail.', customer: publicCustomer(byEmail), customerId: byEmail.id }, 409);

    const possibleDuplicates = await findCustomersByName(name);
    const address = body.address && typeof body.address === 'object' ? body.address as CustomerRecord['address'] : undefined;
    let customer: CustomerRecord = { id: crypto.randomUUID(), name, phone, email, emailVerified: false, address, addresses: address ? [address] : [], createdAt: new Date().toISOString() };
    const blingContactId = await createBlingContact(customer);
    customer = await saveCustomer({ ...customer, blingContactId });
    return json({ created: true, customerId: customer.id, blingContactId: customer.blingContactId, possibleDuplicates: possibleDuplicates.map(publicCustomer) }, 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erro ao cadastrar cliente.' }, 503);
  }
}

async function updatePhone(request: Request) {
  try {
    const customerId = verifySession(request);
    if (!customerId) return json({ error: 'Sessão expirada.' }, 401);
    const body = await readJsonBody(request) as { phone?: string };
    const phone = normalizePhone(body.phone);
    if (!phone) return json({ error: 'Informe um WhatsApp válido.' }, 400);
    const owner = await loadCustomerByPhone(phone);
    if (owner && owner.id !== customerId) return json({ error: 'Este WhatsApp já está vinculado a outro cadastro.' }, 409);
    const customer = await loadCustomerById(customerId);
    if (!customer) return json({ error: 'Cliente não encontrado.' }, 404);
    const saved = await saveCustomer({ ...customer, phone });
    return json({ updated: true, customer: publicCustomer(saved) });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Não foi possível atualizar o WhatsApp.' }, 503); }
}

function verifySession(request: Request) {
  const token = (request.headers.get('authorization') || '').startsWith('Bearer ') ? (request.headers.get('authorization') || '').slice(7).trim() : '';
  const [payload, signature] = token.split('.');
  const secret = sessionSecret();
  if (!payload || !signature || !secret) return '';
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  if (signature !== expected) return '';
  try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; exp?: number }; return data.sub && data.exp && Date.now() <= data.exp ? data.sub : ''; } catch { return ''; }
}

export async function GET(request: Request) {
  if (actionFrom(request) === 'identify') return identify(request);
  return json({ error: 'Ação de cliente não encontrada.' }, 404);
}
export async function POST(request: Request) {
  const action = actionFrom(request);
  if (action === 'request-code') return requestCode(request);
  if (action === 'verify-code') return verifyCode(request);
  if (action === 'register') return register(request);
  if (action === 'update-phone') return updatePhone(request);
  return json({ error: 'Ação de cliente não encontrada.' }, 404);
}

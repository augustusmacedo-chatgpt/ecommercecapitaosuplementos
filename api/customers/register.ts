import { randomUUID } from 'node:crypto';
import { json, readJsonBody } from '../../src/server/bling-shared.js';
import { getBlingAccessToken } from '../../src/server/bling-client.js';
import { customerKey, hashPassword, loadCustomer, normalizeEmail, saveCustomer } from '../../src/server/customer-store.js';

type Input = { name?: string; email?: string; password?: string; phone?: string; document?: string; birthDate?: string; street?: string; number?: string; complement?: string; district?: string; city?: string; state?: string; zip?: string; observation?: string };
export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request) as Input;
    const email = normalizeEmail(String(body.email || ''));
    const required = ['name','password','phone','document','birthDate','street','number','district','city','state','zip'];
    if (!email || !email.includes('@') || required.some(key => !String(body[key as keyof Input] || '').trim()) || String(body.password || '').length < 8) return json({ error: 'Preencha todos os campos obrigatórios. A senha deve ter no mínimo 8 caracteres.' }, 400);
    if (await loadCustomer(email)) return json({ error: 'Já existe um cadastro com este e-mail.' }, 409);
    const token = await getBlingAccessToken();
    const document = String(body.document).replace(/\D/g, '');
    const response = await fetch('https://api.bling.com.br/Api/v3/contatos', { method: 'POST', headers: { Accept: '1.0', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ nome: body.name, tipoPessoa: document.length === 14 ? 'J' : 'F', numeroDocumento: document, email, telefone: body.phone, endereco: { endereco: body.street, numero: body.number, complemento: body.complement, bairro: body.district, municipio: body.city, uf: body.state, cep: body.zip }, observacoes: body.observation }) });
    if (!response.ok) return json({ error: 'Não foi possível vincular o cadastro ao Bling.' }, 502);
    const result = await response.json() as { data?: { id?: number } };
    await saveCustomer({ id: randomUUID(), email, passwordHash: hashPassword(String(body.password)), name: String(body.name), phone: String(body.phone), document, birthDate: String(body.birthDate), address: { street: String(body.street), number: String(body.number), complement: String(body.complement || ''), district: String(body.district), city: String(body.city), state: String(body.state), zip: String(body.zip) }, observation: String(body.observation || ''), blingContactId: result.data?.id, createdAt: new Date().toISOString() });
    return json({ created: true, blingContactId: result.data?.id });
  } catch (error) { console.error('Customer registration error:', error); return json({ error: error instanceof Error ? error.message : 'Erro ao cadastrar cliente.' }, 503); }
}

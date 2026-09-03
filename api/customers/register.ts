import { randomUUID } from 'node:crypto';
import { json, readJsonBody } from '../../src/server/bling-shared.js';
import { getBlingAccessToken } from '../../src/server/bling-client.js';
import { customerKey, hashPassword, loadCustomer, normalizeEmail, saveCustomer } from '../../src/server/customer-store.js';

type Input = { name?: string; email?: string; password?: string; phone?: string; document?: string; stateRegistration?: string; birthDate?: string; street?: string; number?: string; complement?: string; district?: string; city?: string; state?: string; zip?: string; observation?: string };
export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request) as Input;
    const email = normalizeEmail(String(body.email || ''));
    const required = ['name','password','phone','document','birthDate','street','number','district','city','state','zip'];
    if (!email || !email.includes('@') || required.some(key => !String(body[key as keyof Input] || '').trim()) || String(body.password || '').length < 8) return json({ error: 'Preencha todos os campos obrigatórios. A senha deve ter no mínimo 8 caracteres.' }, 400);
    if (await loadCustomer(email)) return json({ error: 'Já existe um cadastro com este e-mail.' }, 409);
    const token = await getBlingAccessToken();
    const document = String(body.document).replace(/\D/g, '');
    const headers = { Accept: '1.0', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    const fullPayload = { nome: body.name, fantasia: document.length === 14 ? body.name : undefined, tipoPessoa: document.length === 14 ? 'J' : 'F', numeroDocumento: document, contribuinte: document.length === 14 ? 9 : undefined, inscricaoEstadual: body.stateRegistration || undefined, email, telefone: body.phone, endereco: { geral: { endereco: body.street, numero: body.number, complemento: body.complement, bairro: body.district, municipio: body.city, uf: body.state, cep: body.zip } }, dadosAdicionais: body.birthDate ? { dataNascimento: body.birthDate } : undefined };
    let response = await fetch('https://api.bling.com.br/Api/v3/contatos', { method: 'POST', headers, body: JSON.stringify(fullPayload) });
    if (!response.ok && response.status >= 400 && response.status < 500 && response.status !== 401 && response.status !== 403) {
      response = await fetch('https://api.bling.com.br/Api/v3/contatos', { method: 'POST', headers, body: JSON.stringify({ nome: body.name, tipo: document.length === 14 ? 'J' : 'F', numeroDocumento: document, email, telefone: body.phone, endereco: fullPayload.endereco }) });
    }
    if (!response.ok) {
      const details = await response.text();
      console.error('Bling contact registration rejected:', response.status, details.slice(0, 1000));
      const duplicate = /documento|cpf|cnpj|já cadastrado|duplicad/i.test(details);
      let blingMessage = '';
      try { const parsed = JSON.parse(details); const errors = Array.isArray(parsed.error) ? parsed.error.map((item: any) => item.message || item.description || item.mensagem || item).join('; ') : ''; blingMessage = String(errors || parsed.error?.message || parsed.error?.description || parsed.message || parsed.mensagem || parsed.error || '').slice(0, 240); } catch { /* resposta não-JSON */ }
      return json({ error: response.status === 401 || response.status === 403 ? 'O aplicativo do Bling não tem permissão para cadastrar contatos. Habilite o escopo de Contatos e reconecte o aplicativo.' : duplicate ? 'Este CPF/CNPJ já está cadastrado no Bling. Tente entrar com seu e-mail ou use “Esqueci minha senha”.' : `O Bling rejeitou os dados do cadastro.${blingMessage ? ` Motivo: ${blingMessage}` : ' Confira CPF/CNPJ, CEP e endereço.'}` }, response.status === 401 || response.status === 403 ? 403 : 422);
    }
    const result = await response.json() as { data?: { id?: number } };
    await saveCustomer({ id: randomUUID(), email, passwordHash: hashPassword(String(body.password)), name: String(body.name), phone: String(body.phone), document, birthDate: String(body.birthDate), address: { street: String(body.street), number: String(body.number), complement: String(body.complement || ''), district: String(body.district), city: String(body.city), state: String(body.state), zip: String(body.zip) }, observation: String(body.observation || ''), blingContactId: result.data?.id, createdAt: new Date().toISOString() });
    return json({ created: true, blingContactId: result.data?.id });
  } catch (error) { console.error('Customer registration error:', error); return json({ error: error instanceof Error ? error.message : 'Erro ao cadastrar cliente.' }, 503); }
}

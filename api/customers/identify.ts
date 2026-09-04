import { json } from '../../src/server/bling-shared.js';
import { getBlingAccessToken } from '../../src/server/bling-client.js';
import { customerKey, normalizeDocument } from '../../src/server/customer-identity.js';

export async function GET(request: Request) {
  try {
    const raw = new URL(request.url).searchParams.get('document') || '';
    const document = normalizeDocument(raw);
    if (![11, 14].includes(document.length)) {
      return json({ error: 'Informe um CPF ou CNPJ válido.' }, 400);
    }

    const token = await getBlingAccessToken();
    const response = await fetch(
      `https://api.bling.com.br/Api/v3/contatos?numeroDocumento=${encodeURIComponent(document)}&limite=1`,
      {
        headers: {
          Accept: '1.0',
          Authorization: `Bearer ${token}`,
          'enable-jwt': '1',
        },
      },
    );

    if (!response.ok) return json({ error: 'Não foi possível consultar o cadastro no Bling.' }, 502);

    const data = await response.json() as { data?: Array<{ id?: number; email?: string }> };
    const contact = data.data?.[0];

    return json(
      {
        found: Boolean(contact),
        contactId: contact?.id || null,
        customerKey: customerKey('document', document),
        identityType: 'document',
      },
      200,
      { 'Cache-Control': 'no-store' },
    );
  } catch (error) {
    console.error('Customer identify:', error);
    return json({ error: 'Consulta temporariamente indisponível.' }, 503);
  }
}

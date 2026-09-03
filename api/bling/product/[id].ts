import { json } from '../../../src/server/bling-shared.js';
import { getBlingAccessToken } from '../../../src/server/bling-client.js';
export async function GET(request: Request) {
  const id = new URL(request.url).pathname.split('/').pop();
  if (!id || !/^\d+$/.test(id)) return json({ error: 'Produto inválido.' }, 400);
  try {
    const token = await getBlingAccessToken();
    const response = await fetch(`https://api.bling.com.br/Api/v3/produtos/${id}`, { headers: { Accept: '1.0', Authorization: `Bearer ${token}` } });
    if (!response.ok) return json({ error: 'Produto não encontrado no Bling.' }, response.status === 404 ? 404 : 502);
    const payload = await response.json() as { data?: unknown };
    return json({ product: payload.data }, 200, { 'Cache-Control': 'no-store' });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Erro ao carregar produto.' }, 503); }
}

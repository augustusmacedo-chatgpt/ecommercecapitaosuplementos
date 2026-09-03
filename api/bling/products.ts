import { json } from '../../src/server/bling-shared.js';
import { getBlingAccessToken } from '../../src/server/bling-client.js';

const BLING_PRODUCTS_URL = 'https://api.bling.com.br/Api/v3/produtos';

export async function GET(request: Request) {
  if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405);
  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('pagina') || 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limite') || 20) || 20));
    const token = await getBlingAccessToken();
    const response = await fetch(`${BLING_PRODUCTS_URL}?pagina=${page}&limite=${limit}`, {
      headers: { Accept: '1.0', Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      console.error('Bling products error:', response.status, await response.text());
      return json({ error: 'Não foi possível consultar os produtos no Bling.' }, response.status === 401 ? 401 : 502);
    }
    const payload = await response.json() as { data?: unknown[] };
    return json({ products: Array.isArray(payload.data) ? payload.data : [], page, limit }, 200, { 'Cache-Control': 'no-store' });
  } catch (error) {
    console.error('Bling products route error:', error);
    return json({ error: error instanceof Error ? error.message : 'Não foi possível consultar os produtos no Bling.' }, 503);
  }
}

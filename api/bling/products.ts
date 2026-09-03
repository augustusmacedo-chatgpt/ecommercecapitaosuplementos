import { json } from '../../src/server/bling-shared.js';
import { getBlingAccessToken } from '../../src/server/bling-client.js';

const BLING_PRODUCTS_URL = 'https://api.bling.com.br/Api/v3/produtos';

export async function GET(request: Request) {
  if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405);
  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('pagina') || 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limite') || 20) || 20));
    const all = url.searchParams.get('todos') === '1';
    const token = await getBlingAccessToken();
    const fetchPage = async (currentPage: number) => {
      const response = await fetch(`${BLING_PRODUCTS_URL}?pagina=${currentPage}&limite=${limit}`, {
        headers: { Accept: '1.0', Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        console.error('Bling products error:', response.status, await response.text());
        throw new Error(response.status === 401 ? 'A autorização do Bling expirou. Reconecte o aplicativo.' : 'Não foi possível consultar os produtos no Bling.');
      }
      const payload = await response.json() as { data?: unknown[] };
      return Array.isArray(payload.data) ? payload.data : [];
    };
    if (all) {
      const products: unknown[] = [];
      let currentPage = 1;
      const maxPages = 20;
      while (currentPage <= maxPages) {
        const batch = await fetchPage(currentPage);
        products.push(...batch);
        if (batch.length < limit) break;
        currentPage += 1;
      }
      return json({ products, total: products.length, page: 1, limit, complete: currentPage <= maxPages }, 200, { 'Cache-Control': 'no-store' });
    }
    const products = await fetchPage(page);
    return json({ products, total: products.length, page, limit }, 200, { 'Cache-Control': 'no-store' });
  } catch (error) {
    console.error('Bling products route error:', error);
    return json({ error: error instanceof Error ? error.message : 'Não foi possível consultar os produtos no Bling.' }, 503);
  }
}

import { json } from '../../src/server/bling-shared.js';
import { getBlingAccessToken } from '../../src/server/bling-client.js';
import { matchesCatalogQuery, normalizeCatalogProduct, type CatalogProduct } from '../../src/server/catalog.js';

const BLING_PRODUCTS_URL = 'https://api.bling.com.br/Api/v3/produtos';
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function authHeaders(token: string) {
  return { Accept: '1.0', Authorization: 'Bearer ' + token, 'enable-jwt': '1' };
}

async function getDetail(id: string, token: string): Promise<CatalogProduct | null> {
  const response = await fetch(BLING_PRODUCTS_URL + '/' + id, { headers: authHeaders(token) });
  if (!response.ok) return null;
  const payload = await response.json() as { data?: unknown };
  return normalizeCatalogProduct(payload.data || {});
}

async function fetchPage(page: number, limit: number, token: string) {
  const response = await fetch(BLING_PRODUCTS_URL + '?pagina=' + page + '&limite=' + limit, { headers: authHeaders(token) });
  if (!response.ok) {
    console.error('Bling products error:', response.status, await response.text());
    throw new Error(response.status === 401
      ? 'A autorização do Bling expirou. Reconecte o aplicativo.'
      : 'Não foi possível consultar os produtos no Bling.');
  }
  const payload = await response.json() as { data?: unknown[] };
  return Array.isArray(payload.data) ? payload.data.map(normalizeCatalogProduct) : [];
}

async function enrichVisibleImages(products: CatalogProduct[], token: string, maxProducts: number) {
  const visible = products.slice(0, maxProducts);
  for (let index = 0; index < visible.length; index += 1) {
    if (!visible[index]?.id) continue;
    if (index > 0) await sleep(220);
    try {
      const detail = await getDetail(String(visible[index].id), token);
      if (detail) products[index] = { ...products[index], ...detail, updatedAt: products[index].updatedAt };
    } catch (error) {
      console.warn('Bling product detail enrichment failed:', visible[index].id, error);
    }
  }
  return products;
}

function filterProducts(products: CatalogProduct[], url: URL) {
  const query = url.searchParams.get('busca') || url.searchParams.get('q') || '';
  const category = (url.searchParams.get('categoria') || '').trim().toLocaleLowerCase('pt-BR');
  const activeOnly = url.searchParams.get('ativos') === '1';
  const inStockOnly = url.searchParams.get('estoque') === '1';

  return products.filter(product => {
    if (!matchesCatalogQuery(product, query)) return false;
    if (category && !product.category.toLocaleLowerCase('pt-BR').includes(category)) return false;
    if (activeOnly && !product.active) return false;
    if (inStockOnly && product.stock <= 0) return false;
    return true;
  });
}

export async function GET(request: Request) {
  if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405);

  try {
    const url = new URL(request.url);
    const id = (url.searchParams.get('id') || '').trim();
    const token = await getBlingAccessToken();

    if (id) {
      if (!/^\d+$/.test(id)) return json({ error: 'Produto inválido.' }, 400);
      const product = await getDetail(id, token);
      if (!product) return json({ error: 'Produto não encontrado no Bling.' }, 404);
      return json({ product }, 200, { 'Cache-Control': 'no-store' });
    }

    const requestedPage = Math.max(1, Number(url.searchParams.get('pagina') || 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limite') || 20) || 20));
    const all = url.searchParams.get('todos') === '1';

    let products: CatalogProduct[] = [];
    let page = requestedPage;
    let complete = true;

    if (all) {
      const maxPages = 50;
      for (page = 1; page <= maxPages; page += 1) {
        const batch = await fetchPage(page, limit, token);
        products.push(...batch);
        if (batch.length < limit) break;
      }
      complete = page <= maxPages;
      await enrichVisibleImages(products, token, Math.min(12, products.length));
    } else {
      products = await fetchPage(requestedPage, limit, token);
      await enrichVisibleImages(products, token, Math.min(12, products.length));
    }

    const filtered = filterProducts(products, url);
    return json(
      {
        products: filtered,
        total: filtered.length,
        page: all ? 1 : requestedPage,
        limit,
        complete,
        source: 'bling',
        filters: {
          query: url.searchParams.get('busca') || url.searchParams.get('q') || '',
          category: url.searchParams.get('categoria') || '',
          activeOnly: url.searchParams.get('ativos') === '1',
          inStockOnly: url.searchParams.get('estoque') === '1',
        },
      },
      200,
      { 'Cache-Control': 'no-store' },
    );
  } catch (error) {
    console.error('Bling products route error:', error);
    return json(
      { error: error instanceof Error ? error.message : 'Não foi possível consultar os produtos no Bling.' },
      503,
    );
  }
}

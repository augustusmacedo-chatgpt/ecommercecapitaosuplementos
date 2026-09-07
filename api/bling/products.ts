import { json } from '../../src/server/bling-shared.js';
import { getBlingAccessToken } from '../../src/server/bling-client.js';
import { matchesCatalogQuery, normalizeCatalogProduct, type CatalogProduct } from '../../src/server/catalog.js';
import { get, put, hasStorage } from '../../src/server/storage.js';

const BLING_PRODUCTS_URL = 'https://api.bling.com.br/Api/v3/produtos';
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const CATALOG_CACHE_KEY = 'bling/catalog-last-good.json';

async function readLastGoodCatalog(): Promise<{ products: CatalogProduct[]; savedAt?: string } | null> {
  if (!hasStorage()) return null;
  try {
    const stored = await get(CATALOG_CACHE_KEY);
    if (!stored?.stream) return null;
    const payload = JSON.parse(await new Response(stored.stream).text());
    if (!Array.isArray(payload?.products) || !payload.products.length) return null;
    return { products: payload.products, savedAt: payload.savedAt };
  } catch { return null; }
}
async function writeLastGoodCatalog(products: CatalogProduct[]) {
  if (!hasStorage() || !products.length) return;
  try {
    await put(CATALOG_CACHE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), products }), { contentType: 'application/json' });
  } catch (error) {
    console.warn('Não foi possível atualizar o catálogo seguro:', error);
  }
}

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
  // criterio=5 força a listagem completa (ativos, inativos e excluídos, conforme o catálogo do Bling)
  // e tipo=T evita limitar a consulta a apenas um subtipo de produto.
  const params = new URLSearchParams({
    pagina: String(page),
    limite: String(limit),
    criterio: '5',
    tipo: 'T',
  });
  const response = await fetch(BLING_PRODUCTS_URL + '?' + params.toString(), { headers: authHeaders(token) });
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
    const ids = Array.from(new Set(
      (url.searchParams.get('ids') || '')
        .split(',')
        .map(value => value.trim())
        .filter(value => /^\d+$/.test(value))
        .slice(0, 30)
    ));
    const token = await getBlingAccessToken();

    if (id) {
      if (!/^\d+$/.test(id)) return json({ error: 'Produto inválido.' }, 400);
      const product = await getDetail(id, token);
      if (!product) return json({ error: 'Produto não encontrado no Bling.' }, 404);
      return json({ product }, 200, { 'Cache-Control': 'no-store' });
    }

    // Consulta detalhada sob demanda: a listagem do Bling não traz,
    // necessariamente, os saldos separados por depósito. Para o PDV,
    // buscamos apenas os produtos visíveis/consultados e retornamos os
    // saldos reais de cada depósito sem carregar o catálogo inteiro novamente.
    if (ids.length) {
      const products: CatalogProduct[] = [];
      for (let index = 0; index < ids.length; index += 1) {
        if (index > 0) await sleep(90);
        const product = await getDetail(ids[index], token);
        if (product) products.push(product);
      }
      return json({ products, total: products.length, source: 'bling-detail' }, 200, { 'Cache-Control': 'no-store' });
    }

    const requestedPage = Math.max(1, Number(url.searchParams.get('pagina') || 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limite') || 20) || 20));
    const all = url.searchParams.get('todos') === '1';

    let products: CatalogProduct[] = [];
    let page = requestedPage;
    let complete = true;

    if (all) {
      const maxPages = 50;
      const seenIds = new Set<number>();
      for (page = 1; page <= maxPages; page += 1) {
        const batch = await fetchPage(page, limit, token);
        const before = products.length;
        for (const product of batch) {
          const id = Number(product.id || 0);
          if (id > 0 && seenIds.has(id)) continue;
          if (id > 0) seenIds.add(id);
          products.push(product);
        }
        if (batch.length < limit) {
          complete = true;
          break;
        }
        // Segurança contra uma API que repita a mesma página.
        if (products.length === before) {
          complete = false;
          break;
        }
        complete = page < maxPages;
      }
      await enrichVisibleImages(products, token, Math.min(12, products.length));
      await writeLastGoodCatalog(products);
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
    const url = new URL(request.url);
    const cached = await readLastGoodCatalog();
    if (cached?.products.length) {
      const filtered = filterProducts(cached.products, url);
      return json(
        {
          products: filtered,
          total: filtered.length,
          page: 1,
          limit: Math.min(100, Math.max(1, Number(url.searchParams.get('limite') || 20) || 20)),
          complete: true,
          source: 'cache',
          savedAt: cached.savedAt || null,
          stale: true,
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
    }
    return json(
      { error: error instanceof Error ? error.message : 'Não foi possível consultar os produtos no Bling.' },
      503,
    );
  }
}

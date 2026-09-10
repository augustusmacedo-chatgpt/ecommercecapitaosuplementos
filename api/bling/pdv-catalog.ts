import { json } from '../../src/server/bling-shared.js';
import { loadCatalogIndex } from '../../src/server/bling-domain-store.js';
import type { CatalogProduct } from '../../src/server/catalog.js';

export async function GET(request: Request) {
  if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405);

  const url = new URL(request.url);
  const query = (url.searchParams.get('busca') || url.searchParams.get('q') || '').trim().toLocaleLowerCase('pt-BR');
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limite') || 1000) || 1000));

  const index = await loadCatalogIndex();
  if (!index?.length) {
    return json({ products: [], total: 0, source: 'r2-pdv-index', ready: false }, 200, { 'Cache-Control': 'no-store' });
  }

  const products = index
    .filter((product: CatalogProduct) => product.active === true)
    .filter((product: CatalogProduct) => {
      if (!query) return true;
      const haystack = [product.name, product.code, product.ean, product.category]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR');
      return query.split(/\s+/).filter(Boolean).every(token => haystack.includes(token));
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

  return json({
    products: products.slice(0, limit),
    total: products.length,
    source: 'r2-pdv-index',
    ready: true,
  }, 200, { 'Cache-Control': 'no-store' });
}

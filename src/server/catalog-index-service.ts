import { loadCatalogIndex } from './bling-domain-store.js';
import { matchesCatalogQuery, type CatalogProduct } from './catalog.js';

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

export async function catalogIndexResponse(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.searchParams.has('id') || url.searchParams.has('ids')) return null;

  const indexed = await loadCatalogIndex();
  if (!indexed?.length) return null;

  const filtered = filterProducts(indexed, url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limite') || 20) || 20));
  const all = url.searchParams.get('todos') === '1';
  const requestedPage = Math.max(1, Number(url.searchParams.get('pagina') || 1) || 1);
  const products = all
    ? filtered
    : filtered.slice((requestedPage - 1) * limit, requestedPage * limit);

  return Response.json({
    products,
    total: all ? filtered.length : products.length,
    page: all ? 1 : requestedPage,
    limit,
    complete: true,
    source: 'r2-index',
    stale: false,
    filters: {
      query: url.searchParams.get('busca') || url.searchParams.get('q') || '',
      category: url.searchParams.get('categoria') || '',
      activeOnly: url.searchParams.get('ativos') === '1',
      inStockOnly: url.searchParams.get('estoque') === '1',
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}

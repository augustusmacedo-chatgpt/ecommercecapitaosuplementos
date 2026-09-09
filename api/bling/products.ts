import { json } from '../../src/server/bling-shared.js';
import { blingFetch } from '../../src/server/bling-gateway.js';
import { matchesCatalogQuery, normalizeCatalogProduct, type CatalogProduct } from '../../src/server/catalog.js';
import { get, put, hasStorage } from '../../src/server/storage.js';

const BLING_PRODUCTS_URL = '/produtos';
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

async function getDetail(id: string): Promise<CatalogProduct | null> {
  const response = await blingFetch(BLING_PRODUCTS_URL + '/' + id);
  if (!response.ok) return null;
  const payload = await response.json() as { data?: unknown };
  return normalizeCatalogProduct(payload.data || {});
}

async function fetchPage(page: number, limit: number) {
  // criterio=5 força a listagem completa (ativos, inativos e excluídos, conforme o catálogo do Bling)
  // e tipo=T evita limitar a consulta a apenas um subtipo de produto.
  const params = new URLSearchParams({
    pagina: String(page),
    limite: String(limit),
    criterio: '5',
    tipo: 'T',
  });
  const response = await blingFetch(BLING_PRODUCTS_URL + '?' + params.toString());
  if (!response.ok) {
    const details = await response.text();
    console.error('Bling products error:', response.status, details.slice(0, 500));
    throw new Error(response.status === 401
      ? 'A autorização do Bling expirou. Reconecte o aplicativo.'
      : 'Não foi possível consultar os produtos no Bling.');
  }
  const payload = await response.json() as { data?: unknown[] };
  return Array.isArray(payload.data) ? payload.data.map(normalizeCatalogProduct) : [];
}

async function enrichVisibleImages(products: CatalogProduct[], maxProducts: number) {
  const visible = products.slice(0, maxProducts);
  for (let index = 0; index < visible.length; index += 1) {
    if (!visible[index]?.id) continue;
    try {
      const detail = await getDetail(String(visible[index].id));
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

    if (id) {
      if (!/^\d+$/.test(id)) return json({ error: 'Produto inválido.' }, 400);
      const product = await getDetail(id);
      if (!product) return json({ error: 'Produto não encontrado no Bling.' }, 404);
      return json({ product }, 200, { 'Cache-Control': 'no-store' });
    }

    // Consulta detalhada sob demanda: o PDV precisa dos saldos reais de
    // CAMAPUÃ e NEWFIT. A API do Bling já retorna os dois depósitos no
    // endpoint agregado, evitando que uma falha de resolução de um depósito
    // faça uma das lojas aparecer zerada.
    if (ids.length) {
      const stockParams = new URLSearchParams();
      ids.forEach(productId => stockParams.append('idsProdutos[]', productId));

      const normDeposit = (value: unknown) => String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();

      const depositName = (deposit: any) => String(
        deposit?.descricao ||
        deposit?.nome ||
        deposit?.descricaoDeposito ||
        deposit?.deposito?.descricao ||
        deposit?.deposito?.nome ||
        ''
      ).trim();

      // Depósitos também são paginados no Bling. Não podemos assumir que os
      // dois depósitos operacionais estejam sempre na primeira página.
      const deposits: any[] = [];
      for (let page = 1; page <= 20; page += 1) {
        const response = await blingFetch('/depositos?pagina=' + page + '&limite=100');
        if (!response.ok) {
          throw new Error('Não foi possível consultar os depósitos do Bling.');
        }
        const payload = await response.json() as { data?: any[] };
        const batch = Array.isArray(payload.data) ? payload.data : [];
        deposits.push(...batch);
        if (batch.length < 100) break;
      }

      const findDeposit = (exactNames: string[], keywords: string[]) => {
        const exact = deposits.find((deposit: any) => {
          const name = normDeposit(depositName(deposit));
          return exactNames.includes(name);
        });
        if (exact) return exact;

        return deposits.find((deposit: any) => {
          const name = normDeposit(depositName(deposit));
          return keywords.every(keyword => name.includes(keyword));
        }) || null;
      };

      const camapuaDeposit = findDeposit(
        ['CAPITAO SUPLEMENTOS CAMAPUA', 'ESTOQUE MATRIZ', 'MATRIZ'],
        ['CAMAPUA'],
      );
      const newfitDeposit = findDeposit(
        ['CAPITAO SUPLEMENTOS NEWFIT', 'ESTOQUE NEWFIT', 'NEWFIT'],
        ['NEWFIT'],
      );

      // Consulta única oficial para os produtos solicitados. A resposta traz
      // todos os depósitos de cada produto, com os IDs e saldos reais.
      const stockResponse = await blingFetch('/estoques/saldos?' + stockParams.toString());
      if (!stockResponse.ok) {
        throw new Error('Não foi possível consultar os saldos de estoque no Bling.');
      }
      const stockPayload = await stockResponse.json() as { data?: any[] };
      const stockRows = Array.isArray(stockPayload.data) ? stockPayload.data : [];
      const stockByProduct = new Map<number, any>();

      for (const item of stockRows) {
        const productId = Number(
          item?.produto?.id ??
          item?.idProduto ??
          item?.produtoId ??
          item?.id
        );
        if (productId > 0) stockByProduct.set(productId, item);
      }

      const saldoOf = (deposit: any) => {
        const value = Number(
          deposit?.saldoVirtual ??
          deposit?.saldoFisico ??
          deposit?.saldo ??
          deposit?.quantidade ??
          0
        );
        return Number.isFinite(value) ? value : 0;
      };

      const targetDeposit = (row: any, target: any) => {
        const targetId = Number(target?.id);
        if (!targetId) return null;
        const rowDeposits = Array.isArray(row?.depositos) ? row.depositos : [];
        return rowDeposits.find((deposit: any) => Number(deposit?.id ?? deposit?.deposito?.id) === targetId) || null;
      };

      const products = ids.map(productId => {
        const idNumber = Number(productId);
        const row = stockByProduct.get(idNumber);
        const camapuaSaldo = saldoOf(targetDeposit(row, camapuaDeposit));
        const newfitSaldo = saldoOf(targetDeposit(row, newfitDeposit));
        const stockDeposits = [
          camapuaDeposit ? {
            id: Number(camapuaDeposit.id) || undefined,
            nome: depositName(camapuaDeposit),
            saldo: camapuaSaldo,
            quantidade: camapuaSaldo,
            saldoVirtual: camapuaSaldo,
            deposito: { id: Number(camapuaDeposit.id) || undefined, nome: depositName(camapuaDeposit) },
          } : null,
          newfitDeposit ? {
            id: Number(newfitDeposit.id) || undefined,
            nome: depositName(newfitDeposit),
            saldo: newfitSaldo,
            quantidade: newfitSaldo,
            saldoVirtual: newfitSaldo,
            deposito: { id: Number(newfitDeposit.id) || undefined, nome: depositName(newfitDeposit) },
          } : null,
        ].filter(Boolean);

        return {
          id: idNumber,
          estoque: {
            saldoVirtualTotal: Number(row?.saldoVirtualTotal ?? 0) || 0,
            depositos: stockDeposits,
          },
        };
      });

      return json({
        products,
        total: products.length,
        source: 'bling-stock-by-deposit',
        stockSource: 'estoques/saldos',
        deposits: {
          camapua: camapuaDeposit ? { id: Number(camapuaDeposit.id), nome: depositName(camapuaDeposit) } : null,
          newfit: newfitDeposit ? { id: Number(newfitDeposit.id), nome: depositName(newfitDeposit) } : null,
        },
      }, 200, { 'Cache-Control': 'no-store' });
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
        const batch = await fetchPage(page, limit);
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
      await enrichVisibleImages(products, Math.min(12, products.length));
      await writeLastGoodCatalog(products);
    } else {
      products = await fetchPage(requestedPage, limit);
      await enrichVisibleImages(products, Math.min(12, products.length));
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

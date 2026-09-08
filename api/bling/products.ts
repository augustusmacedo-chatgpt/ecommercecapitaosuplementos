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

    // Consulta detalhada sob demanda: cada PDV precisa do saldo do seu
    // próprio depósito. Em vez de depender da resposta agregada, consultamos
    // diretamente os dois depósitos operacionais conhecidos da empresa.
    if (ids.length) {
      const stockParams = new URLSearchParams();
      ids.forEach(productId => stockParams.append('idsProdutos[]', productId));

      const depositsResponse = await fetch(
        'https://api.bling.com.br/Api/v3/depositos?pagina=1&limite=100',
        { headers: authHeaders(token) },
      );
      const depositsPayload = depositsResponse.ok
        ? await depositsResponse.json() as { data?: any[] }
        : { data: [] };
      const deposits = Array.isArray(depositsPayload.data) ? depositsPayload.data : [];

      const normDeposit = (value: unknown) => String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();

      const depositName = (deposit: any) => String(
        deposit?.descricao || deposit?.nome || deposit?.descricaoDeposito || ''
      ).trim();

      // A unidade de negócio da Camapuã é "Matriz", mas o DEPÓSITO real no
      // Bling é "CAPITÃO SUPLEMENTOS CAMAPUÃ". Primeiro priorizamos o nome
      // exato do depósito e mantemos os nomes antigos apenas como compatibilidade.
      const matrixDeposit = deposits.find((deposit: any) => {
        const name = normDeposit(depositName(deposit));
        return name === 'CAPITAO SUPLEMENTOS CAMAPUA' || name === 'ESTOQUE MATRIZ' || name === 'MATRIZ';
      }) || deposits.find((deposit: any) => {
        const name = normDeposit(depositName(deposit));
        return name.includes('CAMAPUA') || name.includes('MATRIZ');
      });
      const newfitDeposit = deposits.find((deposit: any) => {
        const name = normDeposit(depositName(deposit));
        return name === 'CAPITAO SUPLEMENTOS NEWFIT' || name === 'ESTOQUE NEWFIT' || name.includes('NEWFIT');
      });

      async function getDepositStock(deposit: any) {
        const depositId = Number(deposit?.id);
        if (!depositId) return { deposit, byProduct: new Map<number, number>() };
        const response = await fetch(
          'https://api.bling.com.br/Api/v3/estoques/saldos/' + depositId + '?' + stockParams.toString(),
          { headers: authHeaders(token) },
        );
        const payload = response.ok ? await response.json() as { data?: any[] } : { data: [] };
        const byProduct = new Map<number, number>();
        for (const item of Array.isArray(payload.data) ? payload.data : []) {
          const productId = Number(item?.produto?.id ?? item?.idProduto ?? item?.id);
          if (!productId) continue;
          const saldo = Number(
            item?.saldoVirtualTotal ??
            item?.saldoVirtual ??
            item?.saldoFisicoTotal ??
            item?.saldoFisico ??
            item?.saldo ??
            item?.quantidade ??
            0
          );
          byProduct.set(productId, Number.isFinite(saldo) ? saldo : 0);
        }
        return { deposit, byProduct };
      }

      const [matrixStock, newfitStock] = await Promise.all([
        getDepositStock(matrixDeposit),
        getDepositStock(newfitDeposit),
      ]);

      const products = ids.map(productId => {
        const idNumber = Number(productId);
        const matrixSaldo = matrixStock.byProduct.get(idNumber) ?? 0;
        const newfitSaldo = newfitStock.byProduct.get(idNumber) ?? 0;
        const stockDeposits = [
          matrixDeposit ? {
            id: Number(matrixDeposit.id) || undefined,
            nome: depositName(matrixDeposit),
            saldo: matrixSaldo,
            quantidade: matrixSaldo,
            saldoVirtual: matrixSaldo,
            deposito: { id: Number(matrixDeposit.id) || undefined, nome: depositName(matrixDeposit) },
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
            saldoVirtualTotal: matrixSaldo + newfitSaldo,
            depositos: stockDeposits,
          },
        };
      });

      return json({
        products,
        total: products.length,
        source: 'bling-stock-by-deposit',
        stockSource: 'estoques/saldos/{idDeposito}',
        deposits: {
          camapua: matrixDeposit ? { id: Number(matrixDeposit.id), nome: depositName(matrixDeposit) } : null,
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

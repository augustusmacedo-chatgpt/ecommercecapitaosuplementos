import { json } from '../../src/server/bling-shared.js';
import { blingFetch } from '../../src/server/bling-gateway.js';
import { loadCatalogIndex, saveCatalogIndex } from '../../src/server/bling-domain-store.js';
import { get, put, hasStorage } from '../../src/server/storage.js';
import { normalizeCatalogProduct, type CatalogProduct } from '../../src/server/catalog.js';
import { sessionUser } from '../lib/pdv-auth.js';

const STATE_KEY = 'bling/domain/catalog-sync-state.json';
const BUFFER_KEY = 'bling/domain/catalog-sync-buffer.json';
const DEFAULT_LIMIT = 100;
const MAX_PAGES_PER_RUN = 5;
const MAX_TOTAL_PAGES = 50;

type SyncState = {
  version: 1;
  nextPage: number;
  pagesProcessed: number;
  productsProcessed: number;
  complete: boolean;
  updatedAt: string;
};

type StoredCatalog = { products: CatalogProduct[] };

async function readJson<T>(key: string): Promise<T | null> {
  if (!hasStorage()) return null;
  try {
    const result = await get(key);
    if (!result?.stream) return null;
    return JSON.parse(await new Response(result.stream).text()) as T;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown) {
  if (!hasStorage()) throw new Error('Armazenamento do catálogo não configurado.');
  await put(key, JSON.stringify(value), { contentType: 'application/json' });
}

function emptyState(): SyncState {
  return {
    version: 1,
    nextPage: 1,
    pagesProcessed: 0,
    productsProcessed: 0,
    complete: false,
    updatedAt: new Date().toISOString(),
  };
}

function isAdmin(request: Request) {
  return sessionUser(request).then(user => user?.role === 'ADMIN');
}

async function fetchPage(page: number, limit: number): Promise<CatalogProduct[]> {
  const params = new URLSearchParams({
    pagina: String(page),
    limite: String(limit),
    criterio: '5',
    tipo: 'T',
  });
  const response = await blingFetch('/produtos?' + params.toString());
  if (!response.ok) {
    const details = await response.text();
    throw new Error(response.status === 401
      ? 'A autorização do Bling expirou. Reconecte o aplicativo.'
      : `Não foi possível sincronizar o catálogo com o Bling (HTTP ${response.status}). ${details.slice(0, 180)}`);
  }
  const payload = await response.json() as { data?: unknown[] };
  return Array.isArray(payload.data) ? payload.data.map(normalizeCatalogProduct) : [];
}

function mergeProducts(current: CatalogProduct[], incoming: CatalogProduct[]) {
  const products = new Map<number, CatalogProduct>();
  for (const product of current) {
    if (Number.isInteger(product?.id) && product.id > 0) products.set(product.id, product);
  }
  for (const product of incoming) {
    if (Number.isInteger(product?.id) && product.id > 0) {
      const previous = products.get(product.id);
      products.set(product.id, previous ? { ...previous, ...product } : product);
    }
  }
  return [...products.values()];
}

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return json({ error: 'Acesso administrativo necessário.' }, 403);
  const state = await readJson<SyncState>(STATE_KEY);
  const buffer = await readJson<StoredCatalog>(BUFFER_KEY);
  const index = await loadCatalogIndex();
  return json({
    state: state || emptyState(),
    bufferedProducts: Array.isArray(buffer?.products) ? buffer!.products.length : 0,
    indexedProducts: index?.length || 0,
  }, 200, { 'Cache-Control': 'no-store' });
}

export async function POST(request: Request) {
  if (!(await isAdmin(request))) return json({ error: 'Acesso administrativo necessário.' }, 403);

  try {
    const url = new URL(request.url);
    const restart = url.searchParams.get('reiniciar') === '1';
    const limit = Math.min(DEFAULT_LIMIT, Math.max(1, Number(url.searchParams.get('limite') || DEFAULT_LIMIT) || DEFAULT_LIMIT));
    const requestedPages = Math.min(MAX_PAGES_PER_RUN, Math.max(1, Number(url.searchParams.get('paginas') || MAX_PAGES_PER_RUN) || MAX_PAGES_PER_RUN));

    let state = restart ? emptyState() : (await readJson<SyncState>(STATE_KEY) || emptyState());
    if (state.complete && !restart) {
      return json({ ok: true, complete: true, state, message: 'O catálogo já está sincronizado. Use reiniciar=1 para um novo snapshot.' }, 200, { 'Cache-Control': 'no-store' });
    }

    const stored = restart ? null : await readJson<StoredCatalog>(BUFFER_KEY);
    let products = Array.isArray(stored?.products) ? stored!.products : [];
    let page = Math.max(1, Number(state.nextPage) || 1);
    let pageCount = 0;

    while (page <= MAX_TOTAL_PAGES && pageCount < requestedPages) {
      const batch = await fetchPage(page, limit);
      products = mergeProducts(products, batch);
      pageCount += 1;
      state.pagesProcessed += 1;
      state.productsProcessed = products.length;
      state.nextPage = page + 1;
      state.updatedAt = new Date().toISOString();

      const lastPage = batch.length < limit || page >= MAX_TOTAL_PAGES;
      if (lastPage) {
        state.complete = true;
        await saveCatalogIndex(products);
        await writeJson(BUFFER_KEY, { products });
        await writeJson(STATE_KEY, state);
        return json({
          ok: true,
          complete: true,
          state,
          products: products.length,
          message: 'Snapshot do catálogo concluído e publicado no índice do R2.',
        }, 200, { 'Cache-Control': 'no-store' });
      }

      await writeJson(BUFFER_KEY, { products });
      await writeJson(STATE_KEY, state);
      page += 1;
      await new Promise(resolve => setTimeout(resolve, 400));
    }

    await writeJson(BUFFER_KEY, { products });
    await writeJson(STATE_KEY, state);
    return json({
      ok: true,
      complete: false,
      state,
      products: products.length,
      message: `Lote concluído. Próxima página: ${state.nextPage}.`,
    }, 200, { 'Cache-Control': 'no-store' });
  } catch (error) {
    console.error('Catalog sync error:', error);
    return json({
      error: error instanceof Error ? error.message : 'Não foi possível sincronizar o catálogo.',
    }, 503);
  }
}

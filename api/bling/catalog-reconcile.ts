import { json } from '../../src/server/bling-shared.js';
import { blingFetch } from '../../src/server/bling-gateway.js';
import { loadCatalogIndex, saveCatalogIndex } from '../../src/server/bling-domain-store.js';
import { normalizeCatalogProduct, type CatalogProduct } from '../../src/server/catalog.js';
import { acquireCatalogSyncLock, releaseCatalogSyncLock } from '../../src/server/catalog-sync-lock.js';
import { sessionUser } from '../lib/pdv-auth.js';

const DEFAULT_LIMIT = 100;
const MAX_TOTAL_PAGES = 50;
const MAX_SAMPLES = 100;

type Diff = { id: number; name?: string; reason: string };

async function isAdmin(request: Request) {
  const user = await sessionUser(request);
  return user?.role === 'ADMIN';
}

async function fetchPage(page: number, limit: number): Promise<CatalogProduct[]> {
  const params = new URLSearchParams({ pagina: String(page), limite: String(limit), criterio: '5', tipo: 'T' });
  const response = await blingFetch('/produtos?' + params.toString());
  if (!response.ok) {
    const details = await response.text();
    throw new Error(response.status === 401 ? 'A autorização do Bling expirou. Reconecte o aplicativo.' : `Não foi possível consultar o catálogo do Bling (HTTP ${response.status}). ${details.slice(0, 180)}`);
  }
  const payload = await response.json() as { data?: unknown[] };
  return Array.isArray(payload.data) ? payload.data.map(normalizeCatalogProduct) : [];
}

function changed(a: CatalogProduct, b: CatalogProduct) {
  return a.name !== b.name || a.code !== b.code || a.category !== b.category || a.price !== b.price || a.active !== b.active || a.ean !== b.ean || a.shortDescription !== b.shortDescription || a.description !== b.description;
}

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return json({ error: 'Acesso administrativo necessário.' }, 403);
  return json({ ok: true, message: 'Use POST para executar uma reconciliação Bling × R2. Por padrão, a execução apenas analisa e não altera o índice.' }, 200, { 'Cache-Control': 'no-store' });
}

export async function POST(request: Request) {
  if (!(await isAdmin(request))) return json({ error: 'Acesso administrativo necessário.' }, 403);
  const lock = await acquireCatalogSyncLock();
  if (!lock) return json({ error: 'Já existe uma sincronização ou reconciliação de catálogo em andamento.' }, 409, { 'Cache-Control': 'no-store' });

  try {
    const url = new URL(request.url);
    const limit = Math.min(DEFAULT_LIMIT, Math.max(1, Number(url.searchParams.get('limite') || DEFAULT_LIMIT) || DEFAULT_LIMIT));
    const repair = url.searchParams.get('corrigir') === '1';
    const index = (await loadCatalogIndex()) || [];
    const indexById = new Map(index.map(product => [product.id, product]));
    const blingIds = new Set<number>();
    const missingFromIndex: Diff[] = [];
    const changedProducts: Diff[] = [];
    let pages = 0;
    let blingProducts = 0;
    let complete = false;
    const snapshot: CatalogProduct[] = [];

    for (let page = 1; page <= MAX_TOTAL_PAGES; page += 1) {
      const batch = await fetchPage(page, limit);
      pages += 1;
      if (!batch.length) { complete = true; break; }
      for (const product of batch) {
        if (!product.id || blingIds.has(product.id)) continue;
        blingIds.add(product.id);
        blingProducts += 1;
        snapshot.push(product);
        const indexed = indexById.get(product.id);
        if (!indexed) {
          if (missingFromIndex.length < MAX_SAMPLES) missingFromIndex.push({ id: product.id, name: product.name, reason: 'existe no Bling e não está no índice R2' });
        } else if (changed(indexed, product)) {
          if (changedProducts.length < MAX_SAMPLES) changedProducts.push({ id: product.id, name: product.name, reason: 'dados principais divergentes entre Bling e R2' });
        }
      }
      if (batch.length < limit) { complete = true; break; }
    }

    const missingFromBling: Diff[] = [];
    for (const product of index) {
      if (!blingIds.has(product.id) && missingFromBling.length < MAX_SAMPLES) missingFromBling.push({ id: product.id, name: product.name, reason: 'existe no índice R2 e não apareceu no snapshot do Bling' });
    }

    if (repair && complete) await saveCatalogIndex(snapshot);

    const missingFromIndexCount = snapshot.filter(product => !indexById.has(product.id)).length;
    const changedCount = snapshot.filter(product => { const indexed = indexById.get(product.id); return Boolean(indexed && changed(indexed, product)); }).length;
    const missingFromBlingCount = index.filter(product => !blingIds.has(product.id)).length;

    return json({
      ok: true,
      complete,
      repairApplied: Boolean(repair && complete),
      pages,
      blingProducts,
      indexedProductsBefore: index.length,
      missingFromIndexCount,
      changedCount,
      missingFromBlingCount: complete ? missingFromBlingCount : null,
      samples: { missingFromIndex, changedProducts, missingFromBling: complete ? missingFromBling : [] },
      message: repair && complete ? 'Reconciliação concluída e índice R2 atualizado com o snapshot completo do Bling.' : complete ? 'Reconciliação concluída sem alterar o índice R2.' : 'Reconciliação parcial: o limite de páginas foi atingido antes de um snapshot completo; nenhuma correção foi aplicada.',
    }, 200, { 'Cache-Control': 'no-store' });
  } catch (error) {
    console.error('Catalog reconcile error:', error);
    return json({ error: error instanceof Error ? error.message : 'Não foi possível reconciliar o catálogo.' }, 503);
  } finally {
    await releaseCatalogSyncLock(lock);
  }
}

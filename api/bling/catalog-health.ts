import { json } from '../../src/server/bling-shared.js';
import { loadCatalogIndex } from '../../src/server/bling-domain-store.js';
import { get, hasStorage } from '../../src/server/storage.js';
import { sessionUser } from '../lib/pdv-auth.js';

const STATE_KEY = 'bling/domain/catalog-sync-state.json';
const LOCK_KEY = 'bling/domain/catalog-sync-lock.json';
const COOLDOWN_KEY = 'bling/api-rate-cooldown.json';

type JsonRecord = Record<string, any>;

async function readJson(key: string): Promise<JsonRecord | null> {
  if (!hasStorage()) return null;
  try {
    const result = await get(key);
    if (!result?.stream) return null;
    return JSON.parse(await new Response(result.stream).text()) as JsonRecord;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const user = await sessionUser(request);
  if (user?.role !== 'ADMIN') return json({ error: 'Acesso administrativo necessário.' }, 403);

  const [index, state, lock, cooldown] = await Promise.all([
    loadCatalogIndex(),
    readJson(STATE_KEY),
    readJson(LOCK_KEY),
    readJson(COOLDOWN_KEY),
  ]);
  const now = Date.now();

  return json({
    ok: true,
    storage: { configured: hasStorage() },
    catalog: {
      indexedProducts: index?.length || 0,
      source: 'r2-index',
    },
    sync: {
      complete: Boolean(state?.complete),
      nextPage: Number(state?.nextPage || 1),
      pagesProcessed: Number(state?.pagesProcessed || 0),
      productsProcessed: Number(state?.productsProcessed || 0),
      updatedAt: state?.updatedAt || null,
    },
    concurrency: {
      active: Boolean(lock?.expiresAt && Number(lock.expiresAt) > now),
      expiresAt: Number(lock?.expiresAt || 0) || null,
    },
    rateLimit: {
      cooldownActive: Boolean(cooldown?.expiresAt && Number(cooldown.expiresAt) > now),
      expiresAt: Number(cooldown?.expiresAt || 0) || null,
      period: cooldown?.period || null,
    },
    checkedAt: new Date(now).toISOString(),
  }, 200, { 'Cache-Control': 'no-store' });
}

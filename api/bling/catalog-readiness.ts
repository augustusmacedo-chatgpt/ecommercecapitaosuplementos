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
  const storageReady = hasStorage();
  const indexReady = Boolean(index?.length);
  const syncComplete = Boolean(state?.complete);
  const lockActive = Boolean(lock?.expiresAt && Number(lock.expiresAt) > now);
  const cooldownActive = Boolean(cooldown?.expiresAt && Number(cooldown.expiresAt) > now);
  const ready = storageReady && indexReady && !cooldownActive && !lockActive;

  return json({
    ok: true,
    ready,
    checks: {
      storage: storageReady,
      index: indexReady,
      syncComplete,
      noActiveLock: !lockActive,
      noRateLimitCooldown: !cooldownActive,
    },
    catalog: {
      indexedProducts: index?.length || 0,
      source: indexReady ? 'r2-index' : 'unavailable',
    },
    sync: {
      complete: syncComplete,
      nextPage: Number(state?.nextPage || 1),
      pagesProcessed: Number(state?.pagesProcessed || 0),
      productsProcessed: Number(state?.productsProcessed || 0),
      updatedAt: state?.updatedAt || null,
    },
    blocking: {
      lockExpiresAt: lockActive ? Number(lock.expiresAt) : null,
      cooldownExpiresAt: cooldownActive ? Number(cooldown.expiresAt) : null,
      cooldownPeriod: cooldownActive ? cooldown?.period || null : null,
    },
    checkedAt: new Date(now).toISOString(),
  }, 200, { 'Cache-Control': 'no-store' });
}

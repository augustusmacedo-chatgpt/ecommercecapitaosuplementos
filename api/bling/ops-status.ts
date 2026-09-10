import { json } from '../../src/server/bling-shared.js';
import { get, hasStorage } from '../../src/server/storage.js';
import { loadCatalogIndex } from '../../src/server/bling-domain-store.js';
import { sessionUser } from '../lib/pdv-auth.js';

const STATE_KEY = 'bling/domain/catalog-sync-state.json';
const LOCK_KEY = 'bling/domain/catalog-sync-lock.json';
const COOLDOWN_KEY = 'bling/api-cooldown.json';

async function isAdmin(request: Request) {
  const user = await sessionUser(request);
  return user?.role === 'ADMIN';
}

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

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return json({ error: 'Acesso administrativo necessário.' }, 403);

  const now = Date.now();
  const index = await loadCatalogIndex();
  const sync = await readJson<{ nextPage?: number; pagesProcessed?: number; productsProcessed?: number; complete?: boolean; updatedAt?: string }>(STATE_KEY);
  const lock = await readJson<{ expiresAt?: number; updatedAt?: string }>(LOCK_KEY);
  const cooldown = await readJson<{ until?: number; period?: string; updatedAt?: string }>(COOLDOWN_KEY);

  const lockActive = Number(lock?.expiresAt || 0) > now;
  const cooldownActive = Number(cooldown?.until || 0) > now;

  return json({
    ok: true,
    generatedAt: new Date(now).toISOString(),
    storage: { configured: hasStorage(), catalogIndexedProducts: index?.length || 0 },
    catalog: {
      syncComplete: Boolean(sync?.complete),
      nextPage: Number(sync?.nextPage || 1),
      pagesProcessed: Number(sync?.pagesProcessed || 0),
      productsProcessed: Number(sync?.productsProcessed || 0),
      updatedAt: sync?.updatedAt || null,
    },
    protection: {
      syncLockActive: lockActive,
      syncLockUpdatedAt: lock?.updatedAt || null,
      blingCooldownActive: cooldownActive,
      blingCooldownUntil: cooldown?.until ? new Date(cooldown.until).toISOString() : null,
      blingCooldownPeriod: cooldown?.period || null,
    },
  }, 200, { 'Cache-Control': 'no-store' });
}

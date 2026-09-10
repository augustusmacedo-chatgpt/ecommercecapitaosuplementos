import { get, putConditional, hasStorage } from './storage.js';

const LOCK_KEY = 'bling/domain/catalog-sync-lock.json';
const LOCK_TTL_MS = 10 * 60 * 1000;

type LockRecord = { version: 1; token: string; expiresAt: number; updatedAt: string };

export async function acquireCatalogSyncLock(): Promise<string | null> {
  if (!hasStorage()) throw new Error('Armazenamento do catálogo não configurado.');
  const now = Date.now();
  const token = crypto.randomUUID();
  const record: LockRecord = { version: 1, token, expiresAt: now + LOCK_TTL_MS, updatedAt: new Date(now).toISOString() };
  const current = await get(LOCK_KEY);

  if (!current) {
    const created = await putConditional(LOCK_KEY, JSON.stringify(record), { contentType: 'application/json', onlyIf: { etagDoesNotMatch: '*' } });
    return created ? token : null;
  }

  try {
    const saved = JSON.parse(await new Response(current.stream).text()) as LockRecord;
    if (Number(saved?.expiresAt) > now) return null;
    const replaced = await putConditional(LOCK_KEY, JSON.stringify(record), { contentType: 'application/json', onlyIf: { etagMatches: current.etag } });
    return replaced ? token : null;
  } catch {
    return null;
  }
}

export async function releaseCatalogSyncLock(token: string) {
  try {
    const current = await get(LOCK_KEY);
    if (!current) return;
    const saved = JSON.parse(await new Response(current.stream).text()) as LockRecord;
    if (saved?.token !== token) return;
    await putConditional(LOCK_KEY, JSON.stringify({ ...saved, expiresAt: 0, updatedAt: new Date().toISOString() }), { contentType: 'application/json', onlyIf: { etagMatches: current.etag } });
  } catch (error) {
    console.warn('Não foi possível liberar o lock da sincronização:', error);
  }
}

import { randomUUID } from 'node:crypto';
import { get, put, putConditional } from './storage.js';

const LOCK_KEY = 'bling/token-refresh.lock';
const LOCK_TTL_MS = 15_000;
const MAX_WAIT_MS = 10_000;
const POLL_MS = 150;

type LockRecord = {
  owner: string;
  acquiredAt: number;
  expiresAt: number;
};

export type BlingRefreshLock = {
  owner: string;
  etag: string;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function readLock(): Promise<{ record: LockRecord; etag: string } | null> {
  const result = await get(LOCK_KEY);
  if (!result?.stream || !result.etag) return null;

  try {
    const record = JSON.parse(await new Response(result.stream).text()) as LockRecord;
    if (!record?.owner || !Number.isFinite(record.expiresAt)) return null;
    return { record, etag: result.etag };
  } catch {
    return null;
  }
}

async function tryCreateLock(owner: string) {
  const now = Date.now();
  const record: LockRecord = { owner, acquiredAt: now, expiresAt: now + LOCK_TTL_MS };
  const result = await putConditional(
    LOCK_KEY,
    JSON.stringify(record),
    { contentType: 'application/json', onlyIf: { etagDoesNotMatch: '*' } },
  );
  if (!result?.etag) return null;
  return { owner, etag: result.etag } satisfies BlingRefreshLock;
}

async function tryReplaceExpiredLock(owner: string, expectedEtag: string) {
  const now = Date.now();
  const record: LockRecord = { owner, acquiredAt: now, expiresAt: now + LOCK_TTL_MS };
  const result = await putConditional(
    LOCK_KEY,
    JSON.stringify(record),
    { contentType: 'application/json', onlyIf: { etagMatches: expectedEtag } },
  );
  if (!result?.etag) return null;
  return { owner, etag: result.etag } satisfies BlingRefreshLock;
}

export async function acquireBlingRefreshLock(): Promise<BlingRefreshLock> {
  const owner = randomUUID();
  const deadline = Date.now() + MAX_WAIT_MS;

  while (Date.now() < deadline) {
    const current = await readLock();

    if (!current) {
      const created = await tryCreateLock(owner);
      if (created) return created;
      await sleep(POLL_MS);
      continue;
    }

    if (current.record.expiresAt <= Date.now()) {
      const replaced = await tryReplaceExpiredLock(owner, current.etag);
      if (replaced) return replaced;
      await sleep(POLL_MS);
      continue;
    }

    await sleep(POLL_MS);
  }

  throw new Error('A sincronização de autorização do Bling está ocupada. Tente novamente em alguns segundos.');
}

export async function releaseBlingRefreshLock(lock: BlingRefreshLock) {
  const current = await readLock();
  if (!current || current.record.owner !== lock.owner) return;

  const released: LockRecord = {
    ...current.record,
    expiresAt: Date.now(),
  };

  await putConditional(
    LOCK_KEY,
    JSON.stringify(released),
    { contentType: 'application/json', onlyIf: { etagMatches: current.etag } },
  );
}

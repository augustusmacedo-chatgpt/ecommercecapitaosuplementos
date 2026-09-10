import { createHash } from 'node:crypto';
import { get, hasStorage, put } from './storage.js';

type CacheEnvelope<T> = {
  savedAt: number;
  expiresAt: number;
  data: T;
};

const VERSION_KEY = 'bling/cache-version.json';
const memoryCache = new Map<string, CacheEnvelope<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
let memoryVersion = '';
let memoryVersionCheckedAt = 0;

function hashKey(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

async function readVersion() {
  const now = Date.now();
  if (now - memoryVersionCheckedAt < 1_000 && memoryVersion) return memoryVersion;
  memoryVersionCheckedAt = now;

  if (!hasStorage()) {
    if (!memoryVersion) memoryVersion = '0';
    return memoryVersion;
  }

  try {
    const result = await get(VERSION_KEY);
    if (!result?.stream) {
      if (!memoryVersion) memoryVersion = '0';
      return memoryVersion;
    }
    const payload = JSON.parse(await new Response(result.stream).text()) as { version?: string };
    memoryVersion = String(payload.version || '0');
  } catch {
    if (!memoryVersion) memoryVersion = '0';
  }
  return memoryVersion;
}

export async function bumpBlingDataVersion(reason = 'change') {
  const version = `${Date.now()}-${hashKey(reason).slice(0, 8)}`;
  memoryVersion = version;
  memoryVersionCheckedAt = Date.now();
  if (!hasStorage()) return version;
  try {
    await put(VERSION_KEY, JSON.stringify({ version, reason, updatedAt: new Date().toISOString() }), { contentType: 'application/json' });
  } catch (error) {
    console.warn('Não foi possível atualizar a versão do cache Bling:', error);
  }
  return version;
}

function cacheKey(scope: string, version: string) {
  return `bling/data-cache/${hashKey(`${version}:${scope}`)}.json`;
}

async function readEnvelope<T>(key: string): Promise<CacheEnvelope<T> | null> {
  const memory = memoryCache.get(key) as CacheEnvelope<T> | undefined;
  if (memory) return memory;

  if (!hasStorage()) return null;
  try {
    const result = await get(key);
    if (!result?.stream) return null;
    const envelope = JSON.parse(await new Response(result.stream).text()) as CacheEnvelope<T>;
    if (!Number.isFinite(envelope?.savedAt) || !Number.isFinite(envelope?.expiresAt)) return null;
    memoryCache.set(key, envelope as CacheEnvelope<unknown>);
    return envelope;
  } catch {
    return null;
  }
}

async function writeEnvelope<T>(key: string, envelope: CacheEnvelope<T>) {
  memoryCache.set(key, envelope as CacheEnvelope<unknown>);
  if (!hasStorage()) return;
  try {
    await put(key, JSON.stringify(envelope), { contentType: 'application/json' });
  } catch (error) {
    console.warn('Não foi possível gravar cache Bling:', error);
  }
}

export async function getBlingCached<T>(scope: string, ttlMs: number, loader: () => Promise<T>): Promise<{ data: T; cached: boolean; savedAt?: number }> {
  const version = await readVersion();
  const key = cacheKey(scope, version);
  const now = Date.now();
  const cached = await readEnvelope<T>(key);
  if (cached && cached.expiresAt > now) return { data: cached.data, cached: true, savedAt: cached.savedAt };

  const pendingKey = key;
  const existing = inFlight.get(pendingKey) as Promise<T> | undefined;
  if (existing) return { data: await existing, cached: false };

  const pending = (async () => {
    try {
      const data = await loader();
      await writeEnvelope(key, { savedAt: Date.now(), expiresAt: Date.now() + Math.max(500, ttlMs), data });
      return data;
    } catch (error) {
      if (cached) return cached.data;
      throw error;
    }
  })();
  inFlight.set(pendingKey, pending as Promise<unknown>);

  try {
    const data = await pending;
    return { data, cached: false };
  } finally {
    inFlight.delete(pendingKey);
  }
}

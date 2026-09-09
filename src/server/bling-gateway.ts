import { getBlingAccessToken, refreshBlingAccessToken } from './bling-client.js';
import { noteBlingRateLimit, waitForBlingRateCooldown } from './bling-rate-limit.js';
import { bumpBlingDataVersion, getBlingCached } from './bling-data-cache.js';

const BLING_API_BASE = 'https://api.bling.com.br/Api/v3';
const MIN_REQUEST_INTERVAL_MS = 400;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRYABLE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);

let nextSlotAt = 0;
let scheduler: Promise<void> = Promise.resolve();

type CacheableResponse = {
  status: number;
  statusText: string;
  headers: [string, string][];
  body: string;
};

export type BlingGatewayOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
  signal?: AbortSignal;
  timeoutMs?: number;
  retries?: number;
  cacheTtlMs?: number;
};

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function urlFor(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${BLING_API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

function isRetryableStatus(status: number) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function retryDelay(attempt: number, response?: Response) {
  const retryAfter = response?.headers.get('retry-after');
  const seconds = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(10_000, Math.max(1000, seconds * 1000));
  return Math.min(5000, 1000 * 2 ** attempt);
}

function cacheTtlFor(path: string, options: BlingGatewayOptions) {
  if ((options.method || 'GET').toUpperCase() !== 'GET') return 0;
  if (options.cacheTtlMs !== undefined) return Math.max(0, options.cacheTtlMs);

  const parsed = new URL(urlFor(path));
  const pathname = parsed.pathname;
  if (pathname === '/Api/v3/produtos') return parsed.searchParams.has('id') ? 120_000 : 60_000;
  if (pathname === '/Api/v3/depositos') return 10 * 60_000;
  if (pathname === '/Api/v3/estoques/saldos') return 3_000;
  if (pathname === '/Api/v3/vendedores') return 10 * 60_000;
  if (pathname.startsWith('/Api/v3/canais-venda/')) return 10 * 60_000;
  if (pathname === '/Api/v3/contatos') return 30_000;
  return 0;
}

function isMutationThatMayAffectCachedData(path: string) {
  const pathname = new URL(urlFor(path)).pathname;
  return [
    '/Api/v3/produtos',
    '/Api/v3/depositos',
    '/Api/v3/estoques',
    '/Api/v3/pedidos',
    '/Api/v3/contatos',
    '/Api/v3/canais-venda',
    '/Api/v3/vendedores',
  ].some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function cacheResponse(response: Response): Promise<CacheableResponse> {
  const headers: [string, string][] = [];
  response.headers.forEach((value, key) => headers.push([key, value]));
  return response.text().then(body => ({
    status: response.status,
    statusText: response.statusText,
    headers,
    body,
  }));
}

function responseFromCache(cached: CacheableResponse) {
  return new Response(cached.body, {
    status: cached.status,
    statusText: cached.statusText,
    headers: cached.headers,
  });
}

async function waitForRateSlot() {
  let release: () => void = () => undefined;
  const previous = scheduler;
  scheduler = new Promise<void>(resolve => { release = resolve; });
  await previous;

  try {
    await waitForBlingRateCooldown();
    const now = Date.now();
    const wait = Math.max(0, nextSlotAt - now);
    if (wait) await sleep(wait);
    nextSlotAt = Date.now() + MIN_REQUEST_INTERVAL_MS;
  } finally {
    release();
  }
}

async function requestOnce(path: string, options: BlingGatewayOptions, token: string) {
  const controller = new AbortController();
  const timeoutMs = Math.max(1000, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort(options.signal?.reason);

  if (options.signal) {
    if (options.signal.aborted) controller.abort(options.signal.reason);
    else options.signal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    const headers = new Headers(options.headers || {});
    headers.set('Accept', headers.get('Accept') || '1.0');
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('enable-jwt', '1');

    return await fetch(urlFor(path), {
      method: (options.method || 'GET').toUpperCase(),
      headers,
      body: options.body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

async function fetchLive(path: string, options: BlingGatewayOptions, token: string, retries: number, method: string) {
  let currentToken = token;
  let refreshedAfter401 = false;

  for (let attempt = 0; ; attempt += 1) {
    await waitForRateSlot();

    let response: Response;
    try {
      response = await requestOnce(path, options, currentToken);
    } catch (error) {
      if (attempt >= retries) throw error;
      await sleep(retryDelay(attempt));
      continue;
    }

    if (response.status === 401 && !refreshedAfter401) {
      refreshedAfter401 = true;
      await response.body?.cancel().catch(() => undefined);
      currentToken = await refreshBlingAccessToken();
      continue;
    }

    if (response.status === 429) {
      await noteBlingRateLimit(response);
    }

    if (!isRetryableStatus(response.status) || attempt >= retries) {
      if (response.ok && method !== 'GET' && isMutationThatMayAffectCachedData(path)) {
        await bumpBlingDataVersion(`${method}:${new URL(urlFor(path)).pathname}`);
      }
      return response;
    }

    const delay = retryDelay(attempt, response);
    await response.body?.cancel().catch(() => undefined);
    await sleep(delay);
  }
}

export async function blingFetch(path: string, options: BlingGatewayOptions = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const retryableMethod = RETRYABLE_METHODS.has(method);
  const retries = retryableMethod
    ? Math.max(0, Math.min(MAX_RETRIES, options.retries ?? MAX_RETRIES))
    : Math.max(0, Math.min(MAX_RETRIES, options.retries ?? 0));
  const cacheTtlMs = cacheTtlFor(path, options);

  if (cacheTtlMs > 0) {
    const cached = await getBlingCached<CacheableResponse>(
      `response:${method}:${path}`,
      cacheTtlMs,
      async () => {
        const token = await getBlingAccessToken();
        const response = await fetchLive(path, options, token, retries, method);
        const snapshot = await cacheResponse(response.clone());
        return snapshot.status >= 200 && snapshot.status < 300 ? snapshot : Promise.reject(new Error(`HTTP ${snapshot.status}`));
      },
    );
    return responseFromCache(cached.data);
  }

  const token = await getBlingAccessToken();
  return fetchLive(path, options, token, retries, method);
}

export async function blingJson<T = unknown>(path: string, options: BlingGatewayOptions = {}) {
  const response = await blingFetch(path, options);
  const text = await response.text();
  let data: T | null = null;
  if (text) {
    try { data = JSON.parse(text) as T; } catch { data = null; }
  }
  return { response, text, data };
}

export function blingApiUrl(path: string) {
  return urlFor(path);
}

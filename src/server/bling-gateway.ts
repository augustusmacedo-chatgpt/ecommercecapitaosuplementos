import { getBlingAccessToken } from './bling-client.js';

const BLING_API_BASE = 'https://api.bling.com.br/Api/v3';
const MIN_REQUEST_INTERVAL_MS = Math.ceil(1000 / 3);
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;

let queue: Promise<unknown> = Promise.resolve();
let nextAllowedAt = 0;

export type BlingGatewayOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
  signal?: AbortSignal;
  timeoutMs?: number;
  retries?: number;
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

async function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const now = Date.now();
    const wait = Math.max(0, nextAllowedAt - now);
    if (wait) await sleep(wait);
    nextAllowedAt = Date.now() + MIN_REQUEST_INTERVAL_MS;
    return operation();
  });
  queue = run.catch(() => undefined);
  return run;
}

async function requestOnce(path: string, options: BlingGatewayOptions, token: string) {
  const controller = new AbortController();
  const timeoutMs = Math.max(1000, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  if (options.signal) {
    if (options.signal.aborted) controller.abort(options.signal.reason);
    else options.signal.addEventListener('abort', () => controller.abort(options.signal?.reason), { once: true });
  }

  try {
    const headers = new Headers(options.headers || {});
    headers.set('Accept', headers.get('Accept') || '1.0');
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('enable-jwt', '1');

    return await fetch(urlFor(path), {
      method: options.method || 'GET',
      headers,
      body: options.body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function blingFetch(path: string, options: BlingGatewayOptions = {}) {
  return enqueue(async () => {
    let token = await getBlingAccessToken();
    const retries = Math.max(0, Math.min(MAX_RETRIES, options.retries ?? MAX_RETRIES));

    for (let attempt = 0; ; attempt += 1) {
      let response: Response;
      try {
        response = await requestOnce(path, options, token);
      } catch (error) {
        if (attempt >= retries) throw error;
        await sleep(retryDelay(attempt));
        continue;
      }

      if (response.status !== 401 || attempt >= retries) {
        if (!isRetryableStatus(response.status) || attempt >= retries) return response;
        const delay = retryDelay(attempt, response);
        await response.body?.cancel().catch(() => undefined);
        await sleep(delay);
        continue;
      }

      // A single 401 recovery is safe: refresh the token through the guarded
      // OAuth client, then retry the same request once with the fresh token.
      await response.body?.cancel().catch(() => undefined);
      token = await getBlingAccessToken();
    }
  });
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

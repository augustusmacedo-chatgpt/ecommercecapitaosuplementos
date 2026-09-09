import { get, put } from './storage.js';

const COOLDOWN_KEY = 'bling/api-rate-cooldown.json';
const REMOTE_CHECK_INTERVAL_MS = 1_000;
const DEFAULT_COOLDOWN_MS = 5_000;
const MAX_COOLDOWN_MS = 60_000;

let localCooldownUntil = 0;
let lastRemoteCheckAt = 0;

type RateLimitPeriod = 'second' | 'day' | 'unknown';

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function parseRetryAfter(value: string | null) {
  if (!value) return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(MAX_COOLDOWN_MS, Math.max(1_000, Math.ceil(seconds * 1_000)));
}

async function readRemoteCooldown(now: number) {
  if (now - lastRemoteCheckAt < REMOTE_CHECK_INTERVAL_MS) return;
  lastRemoteCheckAt = now;

  try {
    const result = await get(COOLDOWN_KEY);
    if (!result?.stream) return;
    const text = await new Response(result.stream).text();
    const saved = JSON.parse(text) as { expiresAt?: number };
    if (Number.isFinite(saved.expiresAt)) {
      localCooldownUntil = Math.max(localCooldownUntil, Number(saved.expiresAt));
    }
  } catch {
    // Uma falha no armazenamento não pode derrubar a integração com o Bling.
  }
}

export async function waitForBlingRateCooldown() {
  for (;;) {
    const now = Date.now();
    await readRemoteCooldown(now);
    const wait = localCooldownUntil - Date.now();
    if (wait <= 0) return;
    await sleep(Math.min(wait, MAX_COOLDOWN_MS));
  }
}

export async function noteBlingRateLimit(response: Response): Promise<RateLimitPeriod> {
  let cooldownMs = parseRetryAfter(response.headers.get('retry-after')) ?? DEFAULT_COOLDOWN_MS;
  let period: RateLimitPeriod = 'unknown';

  try {
    const payload = await response.clone().json() as { error?: { period?: string } };
    if (payload?.error?.period === 'day') {
      period = 'day';
      cooldownMs = Math.max(cooldownMs, MAX_COOLDOWN_MS);
    } else if (payload?.error?.period === 'second') {
      period = 'second';
    }
  } catch {
    // Respostas 429 sem JSON continuam usando Retry-After ou cooldown padrão.
  }

  const expiresAt = Date.now() + cooldownMs;
  localCooldownUntil = Math.max(localCooldownUntil, expiresAt);

  try {
    await put(
      COOLDOWN_KEY,
      JSON.stringify({ expiresAt, period, updatedAt: Date.now() }),
      { contentType: 'application/json' },
    );
  } catch {
    // O bloqueio local continua valendo mesmo sem R2.
  }

  return period;
}

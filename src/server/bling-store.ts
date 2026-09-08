import { get, put, hasStorage } from './storage.js';
import type { BlingConfig } from './bling-shared.js';

const PATH = 'bling/capitao-credentials.json';
const WEBHOOK_PATH = 'bling/capitao-webhook-state.json';

export type BlingStoredData = BlingConfig & {
  refreshToken?: string;
  accessToken?: string;
  accessTokenExpiresAt?: number;
  tokenUpdatedAt?: number;
  lastTokenRefreshAt?: number;
  lastWebhookEventId?: string;
  lastWebhookEventAt?: string;
  oauthState?: string;
  oauthStateExpiresAt?: number;
};

export type BlingWebhookState = Pick<BlingStoredData, 'lastWebhookEventId' | 'lastWebhookEventAt'>;

function storageError() {
  return new Error('Armazenamento persistente do Bling não está conectado ao Cloudflare R2.');
}

export function hasPersistentStorage() {
  return hasStorage();
}

async function readJson<T>(path: string): Promise<T | null> {
  const result = await get(path);
  if (!result || result.statusCode !== 200 || !result.stream) return null;

  const text = await new Response(result.stream).text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Os dados persistidos do Bling estão corrompidos.');
  }
}

export async function loadStoredData(): Promise<BlingStoredData | null> {
  if (!hasPersistentStorage()) throw storageError();

  const credentials = await readJson<Omit<BlingStoredData, keyof BlingWebhookState>>(PATH);
  if (!credentials) return null;

  const webhook = await readJson<BlingWebhookState>(WEBHOOK_PATH);
  return { ...credentials, ...(webhook || {}) } as BlingStoredData;
}

export async function saveStoredData(value: BlingStoredData) {
  if (!hasPersistentStorage()) throw storageError();

  const {
    lastWebhookEventId: _lastWebhookEventId,
    lastWebhookEventAt: _lastWebhookEventAt,
    ...credentials
  } = value;

  // Credentials and OAuth tokens are private state. Keep them isolated from
  // webhook metadata so a busy webhook stream cannot overwrite token state.
  await put(PATH, JSON.stringify(credentials), {
    contentType: 'application/json',
    cacheControlMaxAge: 0,
  });
}

export async function loadWebhookState(): Promise<BlingWebhookState> {
  if (!hasPersistentStorage()) throw storageError();
  return (await readJson<BlingWebhookState>(WEBHOOK_PATH)) || {};
}

export async function saveWebhookState(value: BlingWebhookState) {
  if (!hasPersistentStorage()) throw storageError();

  await put(WEBHOOK_PATH, JSON.stringify(value), {
    contentType: 'application/json',
    cacheControlMaxAge: 0,
  });
}

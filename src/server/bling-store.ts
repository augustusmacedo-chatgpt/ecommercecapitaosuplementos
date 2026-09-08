import { get, put, hasStorage } from './storage.js';
import type { BlingConfig } from './bling-shared.js';

const PATH = 'bling/capitao-credentials.json';

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

function storageError() {
  return new Error('Armazenamento persistente do Bling não está conectado ao Cloudflare R2.');
}

export function hasPersistentStorage() {
  return hasStorage();
}

export async function loadStoredData(): Promise<BlingStoredData | null> {
  if (!hasPersistentStorage()) throw storageError();

  const result = await get(PATH);
  if (!result || result.statusCode !== 200 || !result.stream) return null;

  const text = await new Response(result.stream).text();

  try {
    return JSON.parse(text) as BlingStoredData;
  } catch {
    throw new Error('Os dados persistidos do Bling estão corrompidos.');
  }
}

export async function saveStoredData(value: BlingStoredData) {
  if (!hasPersistentStorage()) throw storageError();

  // Credentials and OAuth tokens are private state. Do not assign public
  // cache metadata to this R2 object.
  await put(PATH, JSON.stringify(value), {
    contentType: 'application/json',
    cacheControlMaxAge: 0,
  });
}

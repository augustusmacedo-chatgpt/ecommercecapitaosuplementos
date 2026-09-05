import { get, put, hasStorage } from './storage.js';
import type { BlingConfig } from './bling-shared.js';
const PATH = 'bling/capitao-credentials.json';
export type BlingStoredData = BlingConfig & { refreshToken?: string; accessToken?: string; accessTokenExpiresAt?: number; lastWebhookEventId?: string; lastWebhookEventAt?: string };
function storageError() { return new Error('Armazenamento persistente do Bling não está conectado ao Cloudflare R2.'); }
export function hasPersistentStorage() { return hasStorage(); }
export async function loadStoredData(): Promise<BlingStoredData | null> { if (!hasPersistentStorage()) throw storageError(); const result = await get(PATH); if (!result || result.statusCode !== 200 || !result.stream) return null; const text = await new Response(result.stream).text(); try { return JSON.parse(text) as BlingStoredData; } catch { return null; } }
export async function saveStoredData(value: BlingStoredData) { if (!hasPersistentStorage()) throw storageError(); await put(PATH, JSON.stringify(value), { contentType: 'application/json', cacheControlMaxAge: 60 }); }

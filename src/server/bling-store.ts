import { get, put } from '@vercel/blob';
import type { BlingConfig } from './bling-shared.js';
const PATH = 'bling/capitao-credentials.json';
export type BlingStoredData = BlingConfig & { refreshToken?: string; accessToken?: string; accessTokenExpiresAt?: number };
function storageError() { return new Error('Armazenamento persistente do Bling não está conectado. Conecte um Vercel Blob privado ao projeto.'); }
export function hasPersistentStorage() { return Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN); }
export async function loadStoredData(): Promise<BlingStoredData | null> { if (!hasPersistentStorage()) throw storageError(); const token = process.env.BLOB_READ_WRITE_TOKEN; const result = token ? await get(PATH, { access: 'private', useCache: false, token }) : await get(PATH, { access: 'private', useCache: false }); if (!result || result.statusCode !== 200 || !result.stream) return null; const text = await new Response(result.stream).text(); try { return JSON.parse(text) as BlingStoredData; } catch { return null; } }
export async function saveStoredData(value: BlingStoredData) { if (!hasPersistentStorage()) throw storageError(); const token = process.env.BLOB_READ_WRITE_TOKEN; await put(PATH, JSON.stringify(value), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60, ...(token ? { token } : {}) }); }

import { GET as syncGet, POST as syncPost } from './catalog-sync.js';
import { acquireCatalogSyncLock, releaseCatalogSyncLock } from '../../src/server/catalog-sync-lock.js';

export async function GET(request: Request) {
  return syncGet(request);
}

export async function POST(request: Request) {
  const token = await acquireCatalogSyncLock();
  if (!token) {
    return Response.json({ error: 'Já existe uma sincronização de catálogo em andamento. Aguarde a execução atual terminar.' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    return await syncPost(request);
  } finally {
    await releaseCatalogSyncLock(token);
  }
}

import { json, readJsonBody, type BlingConfig } from '../../src/server/bling-shared.js';
import { hasPersistentStorage, loadStoredData, saveStoredData } from '../../src/server/bling-store.js';

function storageUnavailable() {
  return json(
    { error: 'Armazenamento persistente do Bling ainda não está conectado ao Cloudflare R2.' },
    503,
  );
}

export async function GET() {
  if (!hasPersistentStorage()) return storageUnavailable();
  try {
    const data = await loadStoredData();
    return json(
      {
        configured: Boolean(data?.clientId && data?.clientSecret),
        secretConfigured: Boolean(data?.clientSecret),
        inviteLink: data?.inviteLink || '',
      },
      200,
      { 'Cache-Control': 'no-store' },
    );
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Não foi possível carregar a configuração do Bling.' }, 503);
  }
}

export async function POST(request: Request) {
  if (!hasPersistentStorage()) return storageUnavailable();
  try {
    const body = await readJsonBody(request) as Partial<BlingConfig>;
    const current = await loadStoredData();
    const clientId = String(body.clientId ?? current?.clientId ?? '').trim();
    const clientSecret = String(body.clientSecret ?? current?.clientSecret ?? '').trim();
    const inviteLink = String(body.inviteLink ?? current?.inviteLink ?? '').trim();
    if (!clientId || !clientSecret) return json({ error: 'Client ID e Client Secret são obrigatórios.' }, 400);
    await saveStoredData({ ...current, clientId, clientSecret, inviteLink });
    return json({ ok: true, configured: true, secretConfigured: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Não foi possível salvar a configuração do Bling.' }, 503);
  }
}

import { json } from '../../src/server/bling-shared.js';
import { hasPersistentStorage, loadStoredData, saveStoredData } from '../../src/server/bling-store.js';
import { sessionUser } from '../lib/pdv-auth.js';
import { bumpBlingDataVersion } from '../../src/server/bling-data-cache.js';

export async function POST(request: Request) {
  if (!hasPersistentStorage()) {
    return json({ error: 'Armazenamento persistente do Bling ainda não está conectado ao Cloudflare R2.' }, 503);
  }

  const user = await sessionUser(request);
  if (user?.role !== 'ADMIN') return json({ error: 'Acesso administrativo necessário.' }, 403);

  try {
    const current = await loadStoredData();

    if (!current) {
      return json({ ok: true, connected: false }, 200, { 'Cache-Control': 'no-store' });
    }

    await saveStoredData({
      ...current,
      accessToken: undefined,
      accessTokenExpiresAt: undefined,
      refreshToken: undefined,
      refreshTokenUpdatedAt: undefined,
      refreshTokenExpiresAt: undefined,
      tokenUpdatedAt: undefined,
      lastTokenRefreshAt: undefined,
      oauthState: undefined,
      oauthStateExpiresAt: undefined,
    });
    await bumpBlingDataVersion('oauth-reset');

    return json({ ok: true, connected: false }, 200, { 'Cache-Control': 'no-store' });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Não foi possível limpar a conexão atual do Bling.' },
      503,
    );
  }
}

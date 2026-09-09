import { json, readJsonBody, type BlingConfig } from '../../src/server/bling-shared.js';
import { hasPersistentStorage, loadStoredData, saveStoredData } from '../../src/server/bling-store.js';

function storageUnavailable() {
  return json(
    { error: 'Armazenamento persistente do Bling ainda não está conectado ao Cloudflare R2.' },
    503,
  );
}

export async function GET(request?: Request) {
  if (!hasPersistentStorage()) return storageUnavailable();
  try {
    const data = await loadStoredData();
    const reveal = request ? new URL(request.url).searchParams.get('reveal') === '1' : false;
    const storedSecret = data?.clientSecret || '';
    return json(
      {
        clientId: data?.clientId || '',
        configured: Boolean(data?.clientId && storedSecret),
        secretConfigured: Boolean(storedSecret),
        secretMask: storedSecret ? '•'.repeat(Math.max(32, storedSecret.length)) : '',
        ...(reveal && storedSecret ? { clientSecret: storedSecret } : {}),
        inviteLink: data?.inviteLink || '',
      },
      200,
      { 'Cache-Control': 'no-store' },
    );
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Não foi possível carregar a configuração do Bling.' },
      503,
    );
  }
}

export async function POST(request: Request) {
  if (!hasPersistentStorage()) return storageUnavailable();

  try {
    const body = await readJsonBody(request) as Partial<BlingConfig>;
    const current = await loadStoredData();

    const requestedClientId = String(body.clientId ?? '').trim();
    const requestedClientSecret = String(body.clientSecret ?? '').trim();
    const requestedInviteLink = String(body.inviteLink ?? '').trim();

    const clientId = requestedClientId || current?.clientId || '';
    const clientSecret = requestedClientSecret || current?.clientSecret || '';
    const inviteLink = requestedInviteLink || current?.inviteLink || '';

    if (!clientId || !clientSecret) {
      return json({ error: 'Client ID e Client Secret são obrigatórios.' }, 400);
    }

    // Changing OAuth application credentials invalidates the old authorization.
    // Never keep tokens that belong to a previous Client ID/Secret.
    const credentialsChanged =
      clientId !== (current?.clientId || '') ||
      clientSecret !== (current?.clientSecret || '');

    const next = {
      ...current,
      clientId,
      clientSecret,
      inviteLink,
      ...(credentialsChanged
        ? {
            accessToken: undefined,
            accessTokenExpiresAt: undefined,
            refreshToken: undefined,
            oauthState: undefined,
            oauthStateExpiresAt: undefined,
          }
        : {}),
    };

    await saveStoredData(next);

    return json(
      {
        ok: true,
        configured: true,
        secretConfigured: true,
        secretMask: '•'.repeat(Math.max(32, clientSecret.length)),
        authorizationReset: credentialsChanged,
      },
      200,
      { 'Cache-Control': 'no-store' },
    );
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Não foi possível salvar a configuração do Bling.' },
      503,
    );
  }
}

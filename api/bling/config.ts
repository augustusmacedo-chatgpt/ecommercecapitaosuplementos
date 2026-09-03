import { json, readJsonBody, type BlingConfig } from '../../src/server/bling-shared.js';
import { hasPersistentStorage, loadStoredData, saveStoredData } from '../../src/server/bling-store.js';

function storageUnavailable() {
  return json(
    { error: 'Armazenamento persistente do Bling ainda não está conectado na Vercel.' },
    503,
  );
}

function errorResponse(error: unknown) {
  console.error('Bling config error:', error);
  return json(
    {
      error:
        error instanceof Error
          ? error.message
          : 'Não foi possível processar a configuração do Bling.',
    },
    500,
  );
}

export async function GET() {
  try {
    if (!hasPersistentStorage()) return storageUnavailable();

    const current = await loadStoredData();
    return json(
      {
        configured: Boolean(current?.clientId && current.clientSecret),
        clientId: current?.clientId || '',
        inviteLink: current?.inviteLink || '',
        secretConfigured: Boolean(current?.clientSecret),
      },
      200,
      { 'Cache-Control': 'no-store' },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!hasPersistentStorage()) return storageUnavailable();

    const current = await loadStoredData();
    const body = (await readJsonBody(request)) as Partial<BlingConfig>;
    const suppliedClientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
    const suppliedClientSecret = typeof body.clientSecret === 'string' ? body.clientSecret.trim() : '';
    const clientId = suppliedClientId || current?.clientId || '';
    const clientSecret = suppliedClientSecret || current?.clientSecret || '';
    const inviteLink = typeof body.inviteLink === 'string' ? body.inviteLink.trim() : (current?.inviteLink || '');

    if (!clientId || !clientSecret) {
      return json({ error: 'Client ID e Client Secret são obrigatórios.' }, 400);
    }

    const credentialsChanged = Boolean(current && (
      current.clientId !== clientId
      || (suppliedClientSecret && current.clientSecret !== clientSecret)
    ));
    await saveStoredData({
      clientId,
      clientSecret,
      inviteLink,
      ...(credentialsChanged ? {} : {
        refreshToken: current?.refreshToken,
        accessToken: current?.accessToken,
        accessTokenExpiresAt: current?.accessTokenExpiresAt,
      }),
    });

    return json(
      { ok: true, configured: true, clientId, secretConfigured: true, inviteLink },
      200,
      { 'Cache-Control': 'no-store' },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

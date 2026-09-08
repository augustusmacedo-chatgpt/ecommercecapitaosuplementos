import { json } from '../../src/server/bling-shared.js';
import { loadStoredData } from '../../src/server/bling-store.js';

const TOKEN_SAFETY_WINDOW_MS = 60_000;

export async function GET(request: Request) {
  if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405);

  try {
    const data = await loadStoredData();
    const now = Date.now();
    const configured = Boolean(data?.clientId && data?.clientSecret);
    const connected = Boolean(data?.refreshToken);
    const accessTokenValid = Boolean(
      data?.accessToken
        && (data.accessTokenExpiresAt ?? 0) > now + TOKEN_SAFETY_WINDOW_MS,
    );

    return json(
      {
        configured,
        connected,
        accessTokenValid,
        clientId: data?.clientId ? mask(data.clientId) : '',
        accessTokenExpiresAt: data?.accessTokenExpiresAt || null,
        tokenUpdatedAt: data?.tokenUpdatedAt || null,
        lastTokenRefreshAt: data?.lastTokenRefreshAt || null,
      },
      200,
      { 'Cache-Control': 'no-store' },
    );
  } catch (error) {
    console.error('Bling status error:', error);
    return json(
      {
        configured: false,
        connected: false,
        accessTokenValid: false,
        clientId: '',
        error: error instanceof Error ? error.message : 'Armazenamento persistente indisponível.',
      },
      503,
    );
  }
}

function mask(value: string) {
  if (value.length <= 8) return '••••••••';
  return `${value.slice(0, 4)}${'•'.repeat(Math.min(20, value.length - 8))}${value.slice(-4)}`;
}

import { json } from '../../src/server/bling-shared.js';
import { loadStoredData } from '../../src/server/bling-store.js';
import { sessionUser } from '../lib/pdv-auth.js';

const TOKEN_SAFETY_WINDOW_MS = 60_000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405);
  const user = await sessionUser(request);
  if (user?.role !== 'ADMIN') return json({ error: 'Acesso administrativo necessário.' }, 403);

  try {
    const data = await loadStoredData();
    const now = Date.now();
    const configured = Boolean(data?.clientId && data?.clientSecret);
    const connected = Boolean(data?.refreshToken);
    const accessTokenValid = Boolean(
      data?.accessToken
        && (data.accessTokenExpiresAt ?? 0) > now + TOKEN_SAFETY_WINDOW_MS,
    );
    const refreshTokenExpired = Boolean(
      data?.refreshTokenExpiresAt && data.refreshTokenExpiresAt <= now,
    );
    const refreshTokenAgeMs = data?.refreshTokenUpdatedAt ? Math.max(0, now - data.refreshTokenUpdatedAt) : null;
    const refreshTokenHealthy = connected
      ? !refreshTokenExpired
        && (data?.refreshTokenUpdatedAt ? refreshTokenAgeMs! < REFRESH_TOKEN_TTL_MS : true)
      : false;

    return json(
      {
        configured,
        connected,
        accessTokenValid,
        refreshTokenHealthy,
        refreshTokenExpired,
        clientId: data?.clientId ? mask(data.clientId) : '',
        accessTokenExpiresAt: data?.accessTokenExpiresAt || null,
        refreshTokenUpdatedAt: data?.refreshTokenUpdatedAt || null,
        refreshTokenExpiresAt: data?.refreshTokenExpiresAt || null,
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
        refreshTokenHealthy: false,
        refreshTokenExpired: false,
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

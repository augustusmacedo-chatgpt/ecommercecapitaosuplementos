import { loadStoredData, saveStoredData, type BlingStoredData } from './bling-store.js';
import { acquireBlingRefreshLock, releaseBlingRefreshLock } from './bling-refresh-lock.js';

const BLING_TOKEN_URL = 'https://api.bling.com.br/Api/v3/oauth/token';
const TOKEN_SAFETY_WINDOW_MS = 60_000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_REQUEST_TIMEOUT_MS = 10_000;

let refreshInFlight: Promise<string> | null = null;

function hasUsableAccessToken(stored: BlingStoredData | null): stored is BlingStoredData & { accessToken: string } {
  return Boolean(
    stored?.accessToken
      && (stored.accessTokenExpiresAt ?? 0) > Date.now() + TOKEN_SAFETY_WINDOW_MS,
  );
}

async function refreshAccessToken(stored: BlingStoredData): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TOKEN_REQUEST_TIMEOUT_MS);

  try {
    const basic = btoa(`${stored.clientId}:${stored.clientSecret}`);
    const response = await fetch(BLING_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: '1.0',
        Authorization: `Basic ${basic}`,
        'enable-jwt': '1',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: stored.refreshToken || '',
      }).toString(),
      signal: controller.signal,
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      console.error('Bling refresh token error:', response.status, details.slice(0, 500));
      throw new Error(response.status === 401
        ? 'A autorização do Bling expirou. Reconecte o Bling no painel administrativo.'
        : 'Não foi possível renovar a autorização do Bling.');
    }

    const tokens = await response.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!tokens.access_token) {
      throw new Error('O Bling não retornou um access token válido.');
    }

    const expiresIn = Math.max(60, Number(tokens.expires_in ?? 21600));
    const now = Date.now();
    const rotatedRefreshToken = Boolean(tokens.refresh_token && tokens.refresh_token !== stored.refreshToken);

    await saveStoredData({
      ...stored,
      accessToken: tokens.access_token,
      accessTokenExpiresAt: now + expiresIn * 1000,
      refreshToken: tokens.refresh_token || stored.refreshToken,
      ...(rotatedRefreshToken
        ? {
            refreshTokenUpdatedAt: now,
            refreshTokenExpiresAt: now + REFRESH_TOKEN_TTL_MS,
          }
        : {}),
      lastTokenRefreshAt: now,
      tokenUpdatedAt: now,
    });

    return tokens.access_token;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('A comunicação com o Bling demorou demais para responder. Tente novamente.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function renewFromLatestStoredState(): Promise<string> {
  const lock = await acquireBlingRefreshLock();
  try {
    const stored = await loadStoredData();

    if (!stored?.clientId || !stored.clientSecret || !stored.refreshToken) {
      throw new Error('Conecte o Bling antes de consultar os dados.');
    }

    if (hasUsableAccessToken(stored)) return stored.accessToken;

    const refreshTokenExpired = Boolean(
      stored.refreshTokenExpiresAt && stored.refreshTokenExpiresAt <= Date.now(),
    );
    if (refreshTokenExpired) {
      throw new Error('A autorização do Bling expirou. Reconecte o Bling no painel administrativo.');
    }

    try {
      return await refreshAccessToken(stored);
    } catch (firstError) {
      const latest = await loadStoredData();
      if (hasUsableAccessToken(latest)) return latest.accessToken;
      throw firstError;
    }
  } finally {
    await releaseBlingRefreshLock(lock).catch(error => {
      console.warn('Bling refresh lock release failed:', error);
    });
  }
}

export async function refreshBlingAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = renewFromLatestStoredState().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function getBlingAccessToken() {
  const stored = await loadStoredData();

  if (!stored?.clientId || !stored.clientSecret || !stored.refreshToken) {
    throw new Error('Conecte o Bling antes de consultar os dados.');
  }

  if (hasUsableAccessToken(stored)) return stored.accessToken;

  return refreshBlingAccessToken();
}

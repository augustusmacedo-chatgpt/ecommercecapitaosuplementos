import { loadStoredData, saveStoredData } from './bling-store.js';

const BLING_TOKEN_URL = 'https://api.bling.com.br/Api/v3/oauth/token';
const TOKEN_SAFETY_WINDOW_MS = 60_000;

type BlingTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

export async function getBlingAccessToken() {
  const stored = await loadStoredData();
  if (!stored?.clientId || !stored.clientSecret || !stored.refreshToken) {
    throw new Error('Conecte o Bling antes de consultar os dados.');
  }

  if (stored.accessToken && (stored.accessTokenExpiresAt ?? 0) > Date.now() + TOKEN_SAFETY_WINDOW_MS) {
    return stored.accessToken;
  }

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
      refresh_token: stored.refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    console.error('Bling refresh token error:', response.status, await response.text());
    throw new Error('A autorização do Bling expirou. Reconecte o aplicativo para continuar.');
  }

  const tokens = await response.json() as BlingTokenResponse;
  if (!tokens.access_token) {
    throw new Error('O Bling não retornou um access token válido.');
  }

  const expiresIn = Math.max(60, Number(tokens.expires_in ?? 21600));
  await saveStoredData({
    ...stored,
    accessToken: tokens.access_token,
    accessTokenExpiresAt: Date.now() + expiresIn * 1000,
    refreshToken: tokens.refresh_token || stored.refreshToken,
  });

  return tokens.access_token;
}

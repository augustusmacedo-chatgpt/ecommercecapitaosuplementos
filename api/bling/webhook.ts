import { createHmac, timingSafeEqual } from 'node:crypto';
import { json } from '../../src/server/bling-shared.js';
import { loadStoredData, saveStoredData } from '../../src/server/bling-store.js';

type WebhookPayload = {
  eventId?: string;
  date?: string;
  version?: string;
  event?: string;
  companyId?: number;
  data?: unknown;
};

type RequestLike = Request & { body?: unknown };

function isValidSignature(rawBody: string, signature: string, secret: string) {
  if (!signature.startsWith('sha256=')) return false;
  const received = Buffer.from(signature.slice(7), 'hex');
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest();
  return received.length === expected.length && timingSafeEqual(received, expected);
}

async function rawRequestBody(request: RequestLike) {
  const body = request.body;
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object' && typeof (body as { getReader?: unknown }).getReader === 'function') {
    return await new Response(body as ReadableStream).text();
  }
  if (typeof request.text === 'function') return await request.text();
  return JSON.stringify(body ?? {});
}

export async function POST(request: Request) {
  try {
    const stored = await loadStoredData();
    if (!stored?.clientSecret) return json({ error: 'Webhook do Bling não está configurado.' }, 503);

    const rawBody = await rawRequestBody(request as RequestLike);
    const signature = request.headers.get('x-bling-signature-256') || '';
    if (!isValidSignature(rawBody, signature, stored.clientSecret)) {
      return json({ error: 'Assinatura do webhook inválida.' }, 401);
    }

    let payload: WebhookPayload;
    try { payload = JSON.parse(rawBody) as WebhookPayload; }
    catch { return json({ error: 'Payload do webhook inválido.' }, 400); }

    const eventId = typeof payload.eventId === 'string' ? payload.eventId : '';
    if (eventId && eventId === stored.lastWebhookEventId) return json({ received: true, duplicate: true });

    await saveStoredData({
      ...stored,
      ...(eventId ? { lastWebhookEventId: eventId } : {}),
      lastWebhookEventAt: new Date().toISOString(),
    });

    console.info('Bling webhook recebido:', payload.event || 'evento sem nome');
    return json({ received: true });
  } catch (error) {
    console.error('Bling webhook error:', error);
    return json({ error: 'Não foi possível processar o webhook do Bling.' }, 503);
  }
}

export async function GET() {
  return json({ ok: true, endpoint: 'bling-webhook' });
}

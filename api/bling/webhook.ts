import { createHmac, timingSafeEqual } from 'node:crypto';
import { createHash } from 'node:crypto';
import { get, put } from '@vercel/blob';
import { json } from '../../src/server/bling-shared.js';
import { loadStoredData, saveStoredData } from '../../src/server/bling-store.js';
import { awardOrderPoints, isCancelledOrderStatus, isEligibleOrderStatus, reverseOrderPoints } from '../../src/server/pontos-engine.js';

type WebhookPayload = { eventId?: string; date?: string; version?: string; event?: string; companyId?: number; data?: any };
type RequestLike = Request & { body?: unknown };
function isValidSignature(rawBody: string, signature: string, secret: string) { if (!signature.startsWith('sha256=')) return false; const received = Buffer.from(signature.slice(7), 'hex'); const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest(); return received.length === expected.length && timingSafeEqual(received, expected); }
async function rawRequestBody(request: RequestLike) { const body = request.body; if (typeof body === 'string') return body; if (body && typeof body === 'object' && typeof (body as { getReader?: unknown }).getReader === 'function') return await new Response(body as ReadableStream).text(); if (typeof request.text === 'function') return await request.text(); return JSON.stringify(body ?? {}); }
function storageKey(checkoutId: string) { return `orders/${createHash('sha256').update(checkoutId).digest('hex')}.json`; }
function storageOptions() { const token = process.env.BLOB_READ_WRITE_TOKEN; return token ? { access: 'private' as const, useCache: false, token } : { access: 'private' as const, useCache: false }; }
async function loadOrder(checkoutId: string) { try { const result = await get(storageKey(checkoutId), storageOptions()); if (!result || result.statusCode !== 200 || !result.stream) return null; return JSON.parse(await new Response(result.stream).text()) as Record<string, any>; } catch { return null; } }
async function saveOrder(checkoutId: string, value: Record<string, any>) { const token = process.env.BLOB_READ_WRITE_TOKEN; await put(storageKey(checkoutId), JSON.stringify(value), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', ...(token ? { token } : {}) }); }

export async function POST(request: Request) {
  try {
    const stored = await loadStoredData();
    if (!stored?.clientSecret) return json({ error: 'Webhook do Bling não está configurado.' }, 503);
    const rawBody = await rawRequestBody(request as RequestLike);
    const signature = request.headers.get('x-bling-signature-256') || '';
    if (!isValidSignature(rawBody, signature, stored.clientSecret)) return json({ error: 'Assinatura do webhook inválida.' }, 401);
    let payload: WebhookPayload;
    try { payload = JSON.parse(rawBody) as WebhookPayload; } catch { return json({ error: 'Payload do webhook inválido.' }, 400); }
    const eventId = typeof payload.eventId === 'string' ? payload.eventId : '';
    if (eventId && eventId === stored.lastWebhookEventId) return json({ received: true, duplicate: true });
    await saveStoredData({ ...stored, ...(eventId ? { lastWebhookEventId: eventId } : {}), lastWebhookEventAt: new Date().toISOString() });

    const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
    const checkoutId = String(data.numeroLoja || '').trim();
    const resource = String(data.recurso || payload.event || '').toLowerCase();
    const isOrderEvent = resource.includes('pedido') || resource.includes('order') || Boolean(data.numeroLoja);
    if (checkoutId && isOrderEvent) {
      const current = await loadOrder(checkoutId);
      if (current) {
        const status = data.situacao || current.situacao || null;
        const next = { ...current, id: Number(data.id || current.id), numero: Number(data.numero || current.numero || 0) || current.numero, data: data.data || current.data || null, total: Number(data.total || current.total || 0), situacao: status, contato: data.contato || current.contato || null, loja: data.loja || current.loja || null, vendedor: data.vendedor || current.vendedor || null, updatedAt: new Date().toISOString(), webhookEvent: payload.event || null };
        await saveOrder(checkoutId, next);

        if (isEligibleOrderStatus(status) && !next.pointsAwarded && !next.pointsReversed) {
          const result = await awardOrderPoints({ ...next, checkoutId });
          if (result.earned || result.duplicate) {
            await saveOrder(checkoutId, { ...next, pointsAwarded: true, pointsAwardedAt: next.pointsAwardedAt || new Date().toISOString(), pointsAwardedResult: result });
          }
          console.info('Pontos processados para pedido:', checkoutId, result);
        } else if (isCancelledOrderStatus(status) && next.pointsAwarded && !next.pointsReversed) {
          const result = await reverseOrderPoints({ ...next, checkoutId });
          if (result.reversed || result.duplicate) await saveOrder(checkoutId, { ...next, pointsReversed: true, pointsReversedAt: next.pointsReversedAt || new Date().toISOString(), pointsReversalResult: result });
          console.info('Estorno de pontos processado para pedido:', checkoutId, result);
        }
        console.info('Pedido sincronizado pelo webhook:', checkoutId, status, next.vendedor);
      }
    }
    console.info('Bling webhook recebido:', payload.event || 'evento sem nome');
    return json({ received: true, synchronized: Boolean(checkoutId && isOrderEvent) });
  } catch (error) {
    console.error('Bling webhook error:', error);
    return json({ error: 'Não foi possível processar o webhook do Bling.' }, 503);
  }
}
export async function GET() { return json({ ok: true, endpoint: 'bling-webhook' }); }

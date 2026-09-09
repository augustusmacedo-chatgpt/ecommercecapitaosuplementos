import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import { get, put } from '../../src/server/storage.js';
import { json } from '../../src/server/bling-shared.js';
import { loadStoredData, saveWebhookState } from '../../src/server/bling-store.js';
import { awardOrderPoints, isCancelledOrderStatus, isEligibleOrderStatus, reverseOrderPoints, reverseOrderRedemption } from '../../src/server/pontos-engine.js';
import { queueOrderSeparated } from '../../src/server/notifications.js';
import { bumpBlingDataVersion } from '../../src/server/bling-data-cache.js';

type OrderRecord = Record<string, any>;
type WebhookPayload = { eventId?: string; date?: string; version?: string; event?: string; companyId?: number; data?: any };
type ExecutionCtx = { waitUntil(promise: Promise<unknown>): void };
function statusText(value: unknown) { if (typeof value==='string') return value.trim().toLowerCase(); if (value && typeof value==='object') { const v=value as Record<string,unknown>; return String(v.valor||v.nome||v.descricao||v.id||'').trim().toLowerCase(); } return ''; }
function isSeparatedStatus(value: unknown) { const s=statusText(value); return s==='separado'||s==='em separacao'||s==='em separação'||s.includes('separad'); }
function isValidSignature(rawBody: string, signature: string, secret: string) { if (!signature.startsWith('sha256=')) return false; const received = Buffer.from(signature.slice(7), 'hex'); const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest(); return received.length === expected.length && timingSafeEqual(received, expected); }
function storageKey(checkoutId: string) { return `orders/${createHash('sha256').update(checkoutId).digest('hex')}.json`; }
async function loadOrder(checkoutId: string): Promise<OrderRecord | null> { try { const result = await get(storageKey(checkoutId)); if (!result?.stream) return null; return JSON.parse(await new Response(result.stream).text()) as OrderRecord; } catch { return null; } }
async function saveOrder(checkoutId: string, value: OrderRecord) { await put(storageKey(checkoutId), JSON.stringify(value), { contentType: 'application/json' }); }

export async function POST(request: Request, ctx?: ExecutionCtx) {
  try {
    const stored = await loadStoredData();
    if (!stored?.clientSecret) return json({ error: 'Webhook do Bling não está configurado.' }, 503);
    const rawBody = await request.text();
    const signature = request.headers.get('x-bling-signature-256') || '';
    if (!isValidSignature(rawBody, signature, stored.clientSecret)) return json({ error: 'Assinatura do webhook inválida.' }, 401);
    let payload: WebhookPayload;
    try { payload = JSON.parse(rawBody) as WebhookPayload; } catch { return json({ error: 'Payload do webhook inválido.' }, 400); }
    const eventId = typeof payload.eventId === 'string' ? payload.eventId : '';
    if (eventId && eventId === stored.lastWebhookEventId) return json({ received: true, duplicate: true });
    await saveWebhookState({ ...(eventId ? { lastWebhookEventId: eventId } : {}), lastWebhookEventAt: new Date().toISOString() });
    await bumpBlingDataVersion(payload.event || 'webhook');
    const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
    const checkoutId = String(data.numeroLoja || '').trim();
    const resource = String(data.recurso || payload.event || '').toLowerCase();
    const isOrderEvent = resource.includes('pedido') || resource.includes('order') || Boolean(data.numeroLoja);
    if (checkoutId && isOrderEvent) {
      const current = await loadOrder(checkoutId);
      if (current) {
        const status = data.situacao || current.situacao || null;
        const next: OrderRecord = { ...current, id: Number(data.id || current.id), numero: Number(data.numero || current.numero || 0) || current.numero, data: data.data || current.data || null, total: Number(data.total || current.total || 0), situacao: status, contato: data.contato || current.contato || null, loja: data.loja || current.loja || null, vendedor: data.vendedor || current.vendedor || null, updatedAt: new Date().toISOString(), webhookEvent: payload.event || null };
        await saveOrder(checkoutId, next);
        if (isSeparatedStatus(status) && !next.orderSeparatedNotificationQueued) { const phone=String(next.customerPhone||next.phone||data.contato?.telefone||'').trim(); if(phone){ ctx?.waitUntil(queueOrderSeparated({checkoutId,phone,customerName:String(next.customerName||next.contato?.nome||''),orderId:Number(next.id||0)||undefined,orderNumber:Number(next.numero||0)||undefined,status}).then(async notification=>{ if(notification) await saveOrder(checkoutId,{...next,orderSeparatedNotificationQueued:true,orderSeparatedNotificationId:notification.id,orderSeparatedNotificationQueuedAt:new Date().toISOString()}); }).catch(error=>console.error('Notificação de pedido separado:',checkoutId,error))); } }
        if (isCancelledOrderStatus(status)) {
          if (next.pointsAwarded && !next.pointsReversed) ctx?.waitUntil(reverseOrderPoints({ ...next, checkoutId }).then(async result => { if (result.reversed || result.duplicate) await saveOrder(checkoutId, { ...next, pointsReversed: true, pointsReversedAt: next.pointsReversedAt || new Date().toISOString(), pointsReversalResult: result }); }).catch(error => console.error('Estorno de pontos da compra:', checkoutId, error)));
          if (Number(next.loyaltyPointsRedeemed || 0) > 0 && !next.loyaltyPointsReversed) ctx?.waitUntil(reverseOrderRedemption({ ...next, checkoutId }).then(async result => { if (result.reversed || result.duplicate) await saveOrder(checkoutId, { ...next, loyaltyPointsReversed: true, loyaltyPointsReversedAt: next.loyaltyPointsReversedAt || new Date().toISOString(), loyaltyPointsReversalResult: result }); }).catch(error => console.error('Estorno do resgate de pontos:', checkoutId, error)));
        } else if (isEligibleOrderStatus(status) && !next.pointsAwarded && !next.pointsReversed) ctx?.waitUntil(awardOrderPoints({ ...next, checkoutId }).then(async result => { if (result.earned || result.duplicate) await saveOrder(checkoutId, { ...next, pointsAwarded: true, pointsAwardedAt: next.pointsAwardedAt || new Date().toISOString(), pointsAwardedResult: result }); }).catch(error => console.error('Processamento de pontos do pedido:', checkoutId, error)));
      }
    }
    return json({ received: true, synchronized: Boolean(checkoutId && isOrderEvent) });
  } catch (error) { console.error('Bling webhook error:', error); return json({ error: 'Não foi possível processar o webhook do Bling.' }, 503); }
}
export async function GET() { return json({ ok: true, endpoint: 'bling-webhook' }); }

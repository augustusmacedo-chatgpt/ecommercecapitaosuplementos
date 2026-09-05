import { GET as cnpjGet } from '../api/cnpj.js';
import { GET as blingAuthorize } from '../api/bling/authorize.js';
import { GET as blingCallback } from '../api/bling/callback.js';
import { GET as blingConfigGet, POST as blingConfigPost } from '../api/bling/config.js';
import { POST as blingOrderPost } from '../api/bling/order.js';
import { GET as pdvReportGet, POST as pdvReportPost } from '../api/bling/pdv-report.js';
import { GET as pdvSaleGet, POST as pdvSalePost } from '../api/bling/pdv-sale.js';
import { GET as blingProductsGet } from '../api/bling/products.js';
import { GET as blingStatusGet } from '../api/bling/status.js';
import { GET as blingWebhookGet, POST as blingWebhookPost } from '../api/bling/webhook.js';
import { GET as customersGet, POST as customersPost } from '../api/customers/[action].js';
import { GET as pontosGet, POST as pontosPost, DELETE as pontosDelete } from '../api/pontos/[action].js';

type R2ObjectLike = { body: ReadableStream<Uint8Array> | null };
type R2BucketLike = { get(key: string): Promise<R2ObjectLike | null>; put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream<Uint8Array>, options?: unknown): Promise<unknown> };
type WorkerEnv = { APP_STORAGE?: R2BucketLike };
type ExecutionCtx = { waitUntil(promise: Promise<unknown>): void };
type StorageGlobal = typeof globalThis & { __CAPITAO_R2__?: R2BucketLike };

function setStorage(env: WorkerEnv) { (globalThis as StorageGlobal).__CAPITAO_R2__ = env.APP_STORAGE; }

async function dispatch(request: Request, ctx: ExecutionCtx): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path === '/api/cnpj' && request.method === 'GET') return cnpjGet(request);
  if (path === '/api/bling/authorize' && request.method === 'GET') return blingAuthorize(request);
  if (path === '/api/bling/callback' && request.method === 'GET') return blingCallback(request);
  if (path === '/api/bling/config') { if (request.method === 'GET') return blingConfigGet(); if (request.method === 'POST') return blingConfigPost(request); }
  if (path === '/api/bling/order' && request.method === 'POST') return blingOrderPost(request);
  if (path === '/api/bling/pdv-report') { if (request.method === 'GET') return pdvReportGet(request); if (request.method === 'POST') return pdvReportPost(request); }
  if (path === '/api/bling/pdv-sale') { if (request.method === 'GET') return pdvSaleGet(request); if (request.method === 'POST') return pdvSalePost(request); }
  if (path === '/api/bling/products' && request.method === 'GET') return blingProductsGet(request);
  if (path === '/api/bling/status' && request.method === 'GET') return blingStatusGet(request);
  if (path === '/api/bling/webhook') { if (request.method === 'GET') return blingWebhookGet(); if (request.method === 'POST') return blingWebhookPost(request, ctx); }
  if (path.startsWith('/api/customers/')) { if (request.method === 'GET') return customersGet(request); if (request.method === 'POST') return customersPost(request); }
  if (path.startsWith('/api/pontos/')) { if (request.method === 'GET') return pontosGet(request); if (request.method === 'POST') return pontosPost(request); if (request.method === 'DELETE') return pontosDelete(request); }
  return Response.json({ error: 'API não encontrada.' }, { status: 404 });
}

export default { async fetch(request: Request, env: WorkerEnv, ctx: ExecutionCtx) { setStorage(env); if (new URL(request.url).pathname.startsWith('/api/')) return dispatch(request, ctx); return new Response(null, { status: 404 }); } };

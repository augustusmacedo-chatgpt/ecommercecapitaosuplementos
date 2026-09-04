import * as authorize from '../handlers/bling/authorize.js';
import * as callback from '../handlers/bling/callback.js';
import * as config from '../handlers/bling/config.js';
import * as order from '../handlers/bling/order.js';
import * as pdvReport from '../handlers/bling/pdv-report.js';
import * as pdvSale from '../handlers/bling/pdv-sale.js';
import * as products from '../handlers/bling/products.js';
import * as status from '../handlers/bling/status.js';
import * as webhook from '../handlers/bling/webhook.js';
import * as cnpj from '../handlers/cnpj.js';
import * as customers from '../handlers/customers/[action].js';
import * as pontos from '../handlers/pontos/[action].js';

type RouteModule = { GET?: (request: Request) => Promise<Response> | Response; POST?: (request: Request) => Promise<Response> | Response; DELETE?: (request: Request) => Promise<Response> | Response };

const routes: Record<string, RouteModule> = {
  '/api/bling/authorize': authorize,
  '/api/bling/callback': callback,
  '/api/bling/config': config,
  '/api/bling/order': order,
  '/api/bling/pdv-report': pdvReport,
  '/api/bling/pdv-sale': pdvSale,
  '/api/bling/products': products,
  '/api/bling/status': status,
  '/api/bling/webhook': webhook,
  '/api/cnpj': cnpj,
};

function customerRoute(pathname: string): RouteModule | null {
  return /^\/api\/customers\/(identify|request-code|verify-code|register)\/?$/.test(pathname) ? customers : null;
}
function pointsRoute(pathname: string): RouteModule | null {
  return /^\/api\/pontos\/(account|redeem)\/?$/.test(pathname) ? pontos : null;
}

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/$/, '') || '/';
  const route = routes[pathname] || customerRoute(pathname) || pointsRoute(pathname);
  if (!route) return new Response(JSON.stringify({ error: 'API route não encontrada.' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  const method = request.method as keyof RouteModule;
  const fn = route[method];
  if (!fn) return new Response(JSON.stringify({ error: 'Método não permitido.' }), { status: 405, headers: { Allow: Object.keys(route).join(', '), 'Content-Type': 'application/json' } });
  return fn(request);
}

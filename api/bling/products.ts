import { json } from '../../src/server/bling-shared.js';
import { getBlingAccessToken } from '../../src/server/bling-client.js';

const BLING_PRODUCTS_URL = 'https://api.bling.com.br/Api/v3/produtos';
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type ImageCandidate = { url?: string; kind: 'original' | 'thumbnail' };

function uniqueUrls(values: ImageCandidate[]) {
  const seen = new Set<string>();
  return values.filter(item => {
    const url = String(item.url || '').trim();
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

function normalizeImages(product: any) {
  const external: ImageCandidate[] = Array.isArray(product.midia?.imagens?.externas)
    ? product.midia.imagens.externas.map((item: any) => ({ url: item?.link || item?.url, kind: 'original' as const }))
    : [];
  const internalOriginal: ImageCandidate[] = Array.isArray(product.midia?.imagens?.internas)
    ? product.midia.imagens.internas.map((item: any) => ({ url: item?.link || item?.url, kind: 'original' as const }))
    : [];
  const legacy: ImageCandidate[] = Array.isArray(product.imagens)
    ? product.imagens.map((item: any) => ({ url: typeof item === 'string' ? item : item?.link || item?.url, kind: 'original' as const }))
    : [];
  const productLevel: ImageCandidate[] = [
    { url: product.imagemOriginal, kind: 'original' },
    { url: product.imagemURL, kind: 'original' },
  ];
  const thumbnails: ImageCandidate[] = Array.isArray(product.midia?.imagens?.internas)
    ? product.midia.imagens.internas.map((item: any) => ({ url: item?.linkMiniatura, kind: 'thumbnail' as const }))
    : [];

  const ordered = uniqueUrls([...external, ...internalOriginal, ...legacy, ...productLevel, ...thumbnails]);
  return {
    images: ordered,
    original: ordered.find(item => item.kind === 'original')?.url,
    thumbnail: ordered.find(item => item.kind === 'thumbnail')?.url,
  };
}

async function getDetail(id: string, token: string) {
  const response = await fetch(BLING_PRODUCTS_URL + '/' + id, {
    headers: { Accept: '1.0', Authorization: 'Bearer ' + token, 'enable-jwt': '1' },
  });
  if (!response.ok) return null;

  const payload = await response.json() as { data?: any };
  const product = payload.data || {};
  const media = normalizeImages(product);
  const primaryImage = media.original || media.thumbnail;

  return {
    ...product,
    imagemURL: primaryImage,
    imagemOriginal: media.original || undefined,
    imagemMiniatura: media.thumbnail || undefined,
    imagens: media.images.map(item => ({ link: item.url, tipo: item.kind })),
  };
}

async function enrichVisibleImages(products: any[], token: string, maxProducts = 12) {
  const visible = products.slice(0, maxProducts);
  for (let index = 0; index < visible.length; index += 1) {
    const product = visible[index];
    if (!product?.id) continue;
    if (index > 0) await sleep(260);
    try {
      const detail = await getDetail(String(product.id), token);
      if (!detail) continue;
      if (detail.imagemURL) product.imagemURL = detail.imagemURL;
      if (detail.imagemOriginal) product.imagemOriginal = detail.imagemOriginal;
      if (detail.imagemMiniatura) product.imagemMiniatura = detail.imagemMiniatura;
      if (detail.imagens?.length) product.imagens = detail.imagens;
    } catch (error) {
      console.warn('Bling product image enrichment failed:', product.id, error);
    }
  }
  return products;
}

export async function GET(request: Request) {
  if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405);

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id') || '';
    const token = await getBlingAccessToken();

    if (id) {
      if (!/^\d+$/.test(id)) return json({ error: 'Produto inválido.' }, 400);
      const product = await getDetail(id, token);
      if (!product) return json({ error: 'Produto não encontrado no Bling.' }, 404);
      return json({ product }, 200, { 'Cache-Control': 'no-store' });
    }

    const page = Math.max(1, Number(url.searchParams.get('pagina') || 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limite') || 20) || 20));
    const all = url.searchParams.get('todos') === '1';
    const headers = { Accept: '1.0', Authorization: 'Bearer ' + token, 'enable-jwt': '1' };

    const fetchPage = async (currentPage: number) => {
      const response = await fetch(BLING_PRODUCTS_URL + '?pagina=' + currentPage + '&limite=' + limit, { headers });
      if (!response.ok) {
        console.error('Bling products error:', response.status, await response.text());
        throw new Error(response.status === 401 ? 'A autorização do Bling expirou. Reconecte o aplicativo.' : 'Não foi possível consultar os produtos no Bling.');
      }
      const payload = await response.json() as { data?: unknown[] };
      return Array.isArray(payload.data) ? payload.data : [];
    };

    if (all) {
      const products: any[] = [];
      let currentPage = 1;
      const maxPages = 20;
      while (currentPage <= maxPages) {
        const batch = await fetchPage(currentPage);
        products.push(...batch);
        if (batch.length < limit) break;
        currentPage += 1;
      }
      await enrichVisibleImages(products, token, 12);
      return json({ products, total: products.length, page: 1, limit, complete: currentPage <= maxPages }, 200, { 'Cache-Control': 'no-store' });
    }

    const products = await fetchPage(page);
    await enrichVisibleImages(products as any[], token, 12);
    return json({ products, total: products.length, page, limit }, 200, { 'Cache-Control': 'no-store' });
  } catch (error) {
    console.error('Bling products route error:', error);
    return json({ error: error instanceof Error ? error.message : 'Não foi possível consultar os produtos no Bling.' }, 503);
  }
}

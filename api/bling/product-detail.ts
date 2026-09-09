import { json } from '../../src/server/bling-shared.js';
import { blingFetch } from '../../src/server/bling-gateway.js';
import { normalizeCatalogProduct } from '../../src/server/catalog.js';
import { loadProductMirror, saveProductMirror } from '../../src/server/bling-domain-store.js';

function validId(value: string) {
  return /^\d+$/.test(value) && Number(value) > 0;
}

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id')?.trim() || '';
    if (!validId(id)) return json({ error: 'Produto inválido.' }, 400);

    const numericId = Number(id);
    const mirrored = await loadProductMirror(numericId);
    if (mirrored && !mirrored.__deleted) {
      return json({ product: normalizeCatalogProduct(mirrored), source: 'retaguarda', synchronized: true }, 200, { 'Cache-Control': 'private, max-age=30' });
    }

    const response = await blingFetch(`/produtos/${numericId}`, { cacheTtlMs: 120_000 });
    if (!response.ok) {
      const details = await response.text().catch(() => '');
      return json({ error: response.status === 404 ? 'Produto não encontrado no Bling.' : 'Não foi possível consultar o produto no Bling.', details: details.slice(0, 300) }, response.status === 404 ? 404 : response.status);
    }

    const payload = await response.json() as { data?: any };
    if (!payload?.data) return json({ error: 'O Bling não retornou os dados do produto.' }, 502);

    await saveProductMirror(numericId, payload.data).catch(error => console.warn('Não foi possível persistir espelho do produto:', numericId, error));
    return json({ product: normalizeCatalogProduct(payload.data), source: 'bling', synchronized: true }, 200, { 'Cache-Control': 'private, max-age=30' });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Não foi possível carregar o produto.' }, 503);
  }
}

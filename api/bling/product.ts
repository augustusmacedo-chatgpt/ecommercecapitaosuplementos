import { json } from '../../src/server/bling-shared.js';
import { getBlingAccessToken } from '../../src/server/bling-client.js';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') || url.pathname.split('/').pop();
  if (!id || !/^\d+$/.test(id)) return json({ error: 'Produto inválido.' }, 400);
  try {
    const token = await getBlingAccessToken();
    const response = await fetch(`https://api.bling.com.br/Api/v3/produtos/${id}`, { headers: { Accept: '1.0', Authorization: `Bearer ${token}` } });
    if (!response.ok) return json({ error: 'Produto não encontrado no Bling.' }, response.status === 404 ? 404 : 502);
    const payload = await response.json() as { data?: any };
    const product = payload.data || {};
    const media = [...(product.midia?.imagens?.internas || []), ...(product.midia?.imagens?.externas || [])];
    const images = [...(product.imagens || []), ...media].map((item: any) => typeof item === 'string' ? item : item.link || item.url).filter(Boolean).filter((value: string, index: number, all: string[]) => all.indexOf(value) === index);
    return json({ product: { ...product, imagemURL: product.imagemURL || images[0], imagens: images.map((link: string) => ({ link })) } }, 200, { 'Cache-Control': 'no-store' });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Erro ao carregar produto.' }, 503); }
}

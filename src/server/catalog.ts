export type CatalogImage = { url: string; type: 'original' | 'thumbnail' };
export type CatalogDeposit = {
  id?: number;
  nome?: string;
  saldo: number;
  quantidade?: number;
  saldoVirtual?: number;
  deposito?: { id?: number; nome?: string };
};

export type CatalogProduct = {
  id: number;
  name: string;
  code: string;
  ean?: string;
  gtin?: string;
  gtinTributario?: string;
  shortDescription: string;
  description: string;
  price: number | null;
  category: string;
  active: boolean;
  stock: number;
  available: boolean;
  image?: string;
  originalImage?: string;
  thumbnailImage?: string;
  images: CatalogImage[];
  source: 'bling';
  updatedAt: string;
  // Compatibility aliases while the storefront transitions to the internal model.
  nome: string;
  codigo: string;
  codigoBarras?: string;
  descricaoCurta: string;
  descricao: string;
  preco: number | undefined;
  imagemURL?: string;
  imagemOriginal?: string;
  imagemMiniatura?: string;
  categoria: { nome: string };
  situacao: string;
  estoque: { saldoVirtualTotal: number; depositos: CatalogDeposit[] };
};

type Candidate = { url?: unknown; type: 'original' | 'thumbnail' };

function text(value: unknown) {
  return String(value ?? '').trim();
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function uniqueImages(candidates: Candidate[]): CatalogImage[] {
  const seen = new Set<string>();
  return candidates
    .map(item => ({ url: text(item.url), type: item.type }))
    .filter(item => {
      if (!item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
}

export function normalizeCatalogImages(product: any): CatalogImage[] {
  const external = Array.isArray(product?.midia?.imagens?.externas)
    ? product.midia.imagens.externas.map((item: any) => ({ url: item?.link || item?.url, type: 'original' as const }))
    : [];
  const internal = Array.isArray(product?.midia?.imagens?.internas)
    ? product.midia.imagens.internas.flatMap((item: any) => [
        { url: item?.link || item?.url, type: 'original' as const },
        { url: item?.linkMiniatura, type: 'thumbnail' as const },
      ])
    : [];
  const legacy = Array.isArray(product?.imagens)
    ? product.imagens.map((item: any) => ({
        url: typeof item === 'string' ? item : item?.link || item?.url,
        type: item?.tipo === 'thumbnail' ? 'thumbnail' as const : 'original' as const,
      }))
    : [];
  return uniqueImages([
    ...external,
    ...internal,
    ...legacy,
    { url: product?.imagemOriginal, type: 'original' },
    { url: product?.imagemURL, type: 'original' },
    { url: product?.imagemMiniatura, type: 'thumbnail' },
  ]);
}

export function normalizeCatalogDeposits(product: any): CatalogDeposit[] {
  const deposits = product?.estoque?.depositos;
  if (!Array.isArray(deposits)) return [];
  return deposits.map((item: any) => {
    const deposit = item?.deposito || item?.local || {};
    const id = number(deposit?.id ?? item?.id, 0) || undefined;
    const nome = text(deposit?.nome || item?.nome || item?.name || item?.local?.nome) || undefined;
    const saldo = number(item?.saldo ?? item?.quantidade ?? item?.saldoVirtual, 0);
    return {
      ...(id ? { id } : {}),
      ...(nome ? { nome } : {}),
      saldo,
      quantidade: number(item?.quantidade, saldo),
      saldoVirtual: number(item?.saldoVirtual, saldo),
      deposito: {
        ...(id ? { id } : {}),
        ...(nome ? { nome } : {}),
      },
    };
  });
}

export function catalogStock(product: any) {
  const deposits = normalizeCatalogDeposits(product);
  if (deposits.length) {
    return deposits.reduce((sum, item) => sum + number(item?.saldo ?? item?.quantidade, 0), 0);
  }
  return number(product?.estoque?.saldoVirtualTotal ?? product?.saldoVirtualTotal, 0);
}

export function normalizeCatalogProduct(product: any): CatalogProduct {
  const images = normalizeCatalogImages(product);
  const originalImage = images.find(item => item.type === 'original')?.url;
  const thumbnailImage = images.find(item => item.type === 'thumbnail')?.url;
  const deposits = normalizeCatalogDeposits(product);
  const stock = catalogStock(product);
  const active = text(product?.situacao).toUpperCase() === 'A' || product?.situacao === true || !product?.situacao;
  const priceValue = number(product?.preco, NaN);
  const price = Number.isFinite(priceValue) ? priceValue : null;
  const category = text(product?.categoria?.nome) || text(product?.categoria) || 'Suplementos';
  const id = number(product?.id, 0);
  const name = text(product?.nome) || text(product?.descricaoCurta) || 'Produto sem nome';
  const code = text(product?.codigo);
  const ean = text(
    product?.gtin ||
    product?.gtinProduto ||
    product?.codigoBarras ||
    product?.ean ||
    product?.codigoEAN ||
    product?.codigoBarrasTributario ||
    product?.gtinTributario ||
    product?.gtinTrib
  ) || undefined;
  const gtinTributario = text(
    product?.gtinTributario ||
    product?.codigoBarrasTributario ||
    product?.gtinTrib
  ) || undefined;
  const shortDescription = text(product?.descricaoCurta);
  const description = text(product?.descricao);
  const image = originalImage || thumbnailImage;

  return {
    id,
    name,
    code,
    ean,
    gtin: ean,
    gtinTributario,
    shortDescription,
    description,
    price,
    category,
    active,
    stock,
    available: active && stock > 0,
    image,
    originalImage,
    thumbnailImage,
    images,
    source: 'bling',
    updatedAt: new Date().toISOString(),
    nome: name,
    codigo: code,
    descricaoCurta: shortDescription,
    descricao: description,
    preco: price ?? undefined,
    imagemURL: image,
    imagemOriginal: originalImage,
    imagemMiniatura: thumbnailImage,
    categoria: { nome: category },
    situacao: active ? 'A' : 'I',
    estoque: {
      saldoVirtualTotal: number(product?.estoque?.saldoVirtualTotal ?? product?.saldoVirtualTotal, stock),
      depositos: deposits,
    },
  };
}

export function matchesCatalogQuery(product: CatalogProduct, query: string) {
  const needle = text(query).toLocaleLowerCase('pt-BR');
  if (!needle) return true;
  return [product.name, product.code, product.ean || '', product.gtin || '', product.gtinTributario || '', product.category, product.shortDescription]
    .join(' ')
    .toLocaleLowerCase('pt-BR')
    .includes(needle);
}

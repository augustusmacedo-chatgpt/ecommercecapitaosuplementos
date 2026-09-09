import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Heart, ShoppingBag } from 'lucide-react';

type Deposit = { id?: number; nome?: string; saldo?: number; quantidade?: number; saldoVirtual?: number };
type Product = {
  id: number;
  name: string;
  code: string;
  ean?: string;
  shortDescription: string;
  description: string;
  price: number | null;
  category: string;
  active: boolean;
  stock: number;
  available: boolean;
  originalImage?: string;
  thumbnailImage?: string;
  images?: Array<{ url: string; type: 'original' | 'thumbnail' }>;
  estoque?: { saldoVirtualTotal?: number; depositos?: Deposit[] };
};

type CartLine = { product: Record<string, unknown>; quantity: number };

function formatPrice(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'Consultar';
}

function parseStoredCart(): CartLine[] {
  try {
    const saved = JSON.parse(localStorage.getItem('capitao-cart') || '[]');
    if (!Array.isArray(saved)) return [];
    return saved.map((entry: any) => ({
      product: entry?.product || entry,
      quantity: Math.max(1, Number(entry?.quantity || 1)),
    })).filter((entry: CartLine) => Number(entry.product?.id || 0) > 0);
  } catch {
    return [];
  }
}

function addToCart(product: Product, quantity: number) {
  const cart = parseStoredCart();
  const existing = cart.find(line => Number(line.product?.id) === product.id);
  const nextQuantity = Math.min(product.stock, Math.max(1, quantity + Number(existing?.quantity || 0)));
  const productRecord: Record<string, unknown> = {
    id: product.id,
    name: product.name,
    category: product.category,
    price: formatPrice(product.price),
    badge: 'CATÁLOGO BLING',
    tags: product.code ? [product.code] : ['CATÁLOGO REAL'],
    image: product.originalImage || product.thumbnailImage,
    stock: product.stock,
    code: product.code,
  };
  const next = existing
    ? cart.map(line => Number(line.product?.id) === product.id ? { product: productRecord, quantity: nextQuantity } : line)
    : [...cart, { product: productRecord, quantity: Math.min(product.stock, Math.max(1, quantity)) }];
  localStorage.setItem('capitao-cart', JSON.stringify(next));
  window.dispatchEvent(new Event('capitao-cart-updated'));
}

export default function ProductPage({ productId }: { productId: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetch(`/api/bling/products?id=${encodeURIComponent(productId)}`, { cache: 'no-store' })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || `Não foi possível carregar o produto (HTTP ${response.status}).`);
        return data?.product as Product;
      })
      .then(data => { if (active) setProduct(data || null); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar o produto.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId]);

  const images = useMemo(() => {
    if (!product) return [];
    const listed = Array.isArray(product.images) ? product.images.map(item => item.url).filter(Boolean) : [];
    return Array.from(new Set([product.originalImage, product.thumbnailImage, ...listed].filter(Boolean))) as string[];
  }, [product]);

  if (loading) return <main className="product-detail-page"><div className="container product-detail-state">Carregando produto...</div></main>;
  if (error || !product) return <main className="product-detail-page"><div className="container product-detail-state"><strong>Produto indisponível</strong><p>{error || 'Produto não encontrado.'}</p><a href="/">Voltar para a loja</a></div></main>;

  const unavailable = !product.active || product.stock <= 0;
  const stockMessage = product.stock > 0 ? `${product.stock} unidade(s) disponível(is)` : 'Produto esgotado';

  return <main className="product-detail-page">
    <div className="container">
      <a className="product-back" href="/"><ArrowLeft size={16} /> Voltar para a loja</a>
      <div className="product-detail-grid">
        <section className="product-gallery" aria-label="Imagens do produto">
          <div className="product-gallery-main">
            {images[0] ? <img src={images[0]} alt={product.name} /> : <div className="placeholder"><span>IMAGEM DO PRODUTO</span></div>}
          </div>
          {images.length > 1 && <div className="product-gallery-thumbs">{images.slice(0, 5).map((image, index) => <img key={`${image}-${index}`} src={image} alt="" />)}</div>}
        </section>

        <section className="product-detail-info">
          <span className="product-detail-category">{product.category}</span>
          <div className="product-detail-title-row"><h1>{product.name}</h1><button className="product-detail-favorite" aria-label="Adicionar aos favoritos"><Heart size={20} /></button></div>
          {product.shortDescription && <p className="product-detail-short">{product.shortDescription}</p>}
          <div className="product-detail-price">{formatPrice(product.price)}</div>
          <div className={`product-stock ${unavailable ? 'is-unavailable' : ''}`}>{stockMessage}</div>

          <div className="product-detail-meta">
            {product.code && <span>Código: <strong>{product.code}</strong></span>}
            {product.ean && <span>GTIN/EAN: <strong>{product.ean}</strong></span>}
          </div>

          {!unavailable && <div className="product-buy-box">
            <div className="product-quantity"><button onClick={() => setQuantity(value => Math.max(1, value - 1))}>−</button><strong>{quantity}</strong><button onClick={() => setQuantity(value => Math.min(product.stock, value + 1))} disabled={quantity >= product.stock}>+</button></div>
            <button className="product-add-large" onClick={() => { addToCart(product, quantity); setAdded(true); }}><ShoppingBag size={18} /> {added ? 'ADICIONADO À SACOLA' : 'ADICIONAR À SACOLA'}</button>
          </div>}

          <div className="product-detail-description">
            <h2>Sobre o produto</h2>
            <p>{product.description || 'Descrição disponível conforme cadastro do produto no Bling.'}</p>
          </div>

          {Array.isArray(product.estoque?.depositos) && product.estoque!.depositos!.length > 0 && <div className="product-detail-stock-list">
            <h2>Disponibilidade</h2>
            {product.estoque!.depositos!.map((deposit, index) => <div key={`${deposit.id || deposit.nome || index}`}><span>{deposit.nome || 'Estoque'}</span><strong>{Number(deposit.saldo ?? deposit.quantidade ?? deposit.saldoVirtual ?? 0)} un.</strong></div>)}
          </div>}
        </section>
      </div>
    </div>
  </main>;
}

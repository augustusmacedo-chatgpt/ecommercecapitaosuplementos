import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, ChevronDown, ChevronLeft, ChevronRight, Heart, MessageCircle, Search, ShoppingBag, UserRound, X } from 'lucide-react';

const categories = [
  { name: 'Creatina', slug: 'creatina' },
  { name: 'Whey Protein', slug: 'whey-protein' },
  { name: 'Termogênicos', slug: 'termogenicos' },
  { name: 'Pré-Treinos', slug: 'pre-treinos' },
  { name: 'Hipercalóricos', slug: 'hipercaloricos' },
  { name: 'Barras Proteicas', slug: 'barras-proteicas' },
];

type SiteProduct = {
  id: number;
  name: string;
  category: string;
  price: string;
  badge: string;
  tags: string[];
  image?: string;
  stock: number;
  code?: string;
};

type BlingApiProduct = {
  id?: number;
  nome?: string;
  codigo?: string;
  descricaoCurta?: string;
  preco?: number;
  imagemURL?: string;
  imagens?: Array<{ link?: string; url?: string }>;
  categoria?: { nome?: string };
  estoque?: { saldoVirtualTotal?: number };
  situacao?: string;
};

const fallbackProducts: SiteProduct[] = [
  { id: 1, name: 'Produto em destaque', category: 'Creatina', price: 'R$ 00,00', badge: 'DESTAQUE', tags: ['PERFORMANCE'], stock: 0 },
  { id: 2, name: 'Produto em destaque', category: 'Whey Protein', price: 'R$ 00,00', badge: 'MAIS VENDIDO', tags: ['GANHO DE MASSA'], stock: 0 },
];

function formatBlingPrice(value?: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'Consultar';
}

function toSiteProduct(product: BlingApiProduct, index: number): SiteProduct {
  const image = product.imagemURL || product.imagens?.find(item => item.link || item.url)?.link || product.imagens?.find(item => item.url)?.url;
  return {
    id: product.id ?? index + 1,
    name: product.nome || product.descricaoCurta || 'Produto Bling',
    category: product.categoria?.nome || 'Suplementos',
    price: formatBlingPrice(product.preco),
    badge: product.situacao === 'A' ? 'CATÁLOGO BLING' : 'INDISPONÍVEL',
    tags: [product.codigo || 'CATÁLOGO REAL'],
    image,
    stock: Number(product.estoque?.saldoVirtualTotal ?? 0),
    code: product.codigo,
  };
}

async function readCatalog(response: Response) {
  const data = await response.json().catch(() => ({})) as { products?: BlingApiProduct[]; error?: string };
  if (!response.ok) throw new Error(data.error || `Erro HTTP ${response.status}`);
  return data;
}

const learning = [
  { title: 'Como tomar creatina?', text: 'Entenda como incluir a creatina na sua rotina.' },
  { title: 'Como utilizar whey protein?', text: 'Formas práticas de usar whey no dia a dia.' },
  { title: 'Receitas com whey', text: 'Ideias simples para variar seu shake e suas refeições.' },
  { title: 'Como utilizar o pré-treino?', text: 'Informações para aproveitar melhor seu produto.' },
];
const goals = [
  { name: 'Ganho de Massa', slug: 'ganho-de-massa', image: '/banner-ganho-de-massa.png' },
  { name: 'Emagrecimento', slug: 'emagrecimento', image: '/banner-emagrecimento.png' },
  { name: 'Saúde e Bem-Estar', slug: 'saude-e-bem-estar', image: '/banner-saude-bem-estar.png' },
  { name: 'Definição Muscular', slug: 'definicao-muscular', image: '/banner-definicao-muscular.png' },
];

function InstagramIcon({ size = 24 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" /></svg>;
}
function Placeholder({ label, className = '' }: { label: string; className?: string }) {
  return <div className={`placeholder ${className}`} aria-label={`Espaço reservado para ${label}`}><span>{label}</span></div>;
}
function ProductCard({ product, onAdd }: { product: SiteProduct; onAdd: (product: SiteProduct, quantity: number) => void }) {
  const [quantity, setQuantity] = useState(0);
  const [showQuantity, setShowQuantity] = useState(false);
  const unavailable = product.stock <= 0;
  return <article className={`product-card ${unavailable ? 'product-unavailable' : ''}`}>
    <div className="product-media">
      <span className={`badge ${unavailable ? 'badge-muted' : ''}`}>{unavailable ? 'ESGOTADO' : product.badge}</span>
      <button className="favorite" aria-label={`Adicionar ${product.name} aos favoritos`}><Heart size={17} /></button>
      {product.image ? <img className="product-image" src={product.image} alt={product.name} loading="lazy" /> : <Placeholder label="IMAGEM DO PRODUTO" />}
    </div>
    <div className="product-body">
      <div className="tag-row"><span>{product.category}</span>{product.tags.slice(0, 1).map(tag => <span key={tag}>{tag}</span>)}</div>
      <h3>{product.name}</h3>
      <strong>{product.price}</strong>
      <small>{unavailable ? 'Sem estoque no momento' : `Estoque disponível: ${product.stock}`}</small>
      <button className="product-detail-link" onClick={() => !unavailable && setShowQuantity(true)} disabled={unavailable}>{unavailable ? 'INDISPONÍVEL' : 'VER PRODUTO'}</button>{showQuantity && <div className="quantity-picker"><button onClick={() => setQuantity(value => Math.max(0, value - 1))} aria-label="Diminuir quantidade">−</button><strong>{quantity}</strong><button onClick={() => setQuantity(value => Math.min(product.stock, value + 1))} aria-label="Aumentar quantidade">+</button></div>}<button className={`product-button ${unavailable || quantity === 0 ? 'disabled' : ''}`} onClick={() => quantity > 0 && onAdd(product, quantity)} disabled={unavailable || quantity === 0}>{unavailable ? 'INDISPONÍVEL' : 'ADICIONAR À SACOLA'}</button>
    </div>
  </article>;
}

export default function App() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [slide, setSlide] = useState(0);
  const [blingProducts, setBlingProducts] = useState<SiteProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<SiteProduct[]>(() => { try { return JSON.parse(localStorage.getItem('capitao-cart') || '[]'); } catch { return []; } });
  const addToCart = (product: SiteProduct, quantity: number) => { setCart(current => { const next = [...current, ...Array.from({ length: quantity }, () => product)]; localStorage.setItem('capitao-cart', JSON.stringify(next)); return next; }); setCartOpen(true); };
  const removeFromCart = (id: number) => setCart(current => { const next = current.filter(item => item.id !== id); localStorage.setItem('capitao-cart', JSON.stringify(next)); return next; });

  useEffect(() => {
    let active = true;
    fetch('/api/bling/products?pagina=1&limite=100', { cache: 'no-store' })
      .then(readCatalog)
      .then(data => { if (active) setBlingProducts((data.products || []).map(toSiteProduct)); })
      .catch(error => { if (active) setCatalogError(error instanceof Error ? error.message : 'Catálogo temporariamente indisponível.'); })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, []);

  const allProducts = blingProducts.length ? blingProducts : fallbackProducts;
  const visibleProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return allProducts.filter(product => {
      const matchesSearch = !query || `${product.name} ${product.category} ${product.code || ''}`.toLocaleLowerCase('pt-BR').includes(query);
      const matchesCategory = !category || product.category.toLocaleLowerCase('pt-BR').includes(category);
      return matchesSearch && matchesCategory;
    });
  }, [allProducts, category, search]);
  const availableProducts = visibleProducts.filter(product => product.stock > 0);

  const chooseCategory = (value: string) => { setCategory(value); document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' }); };
  const renderProducts = (badge?: string) => {
    const items = visibleProducts.slice(0, 8).map(product => badge ? { ...product, badge } : product);
    if (!items.length) return <p className="catalog-empty">Nenhum produto encontrado. Tente outro nome ou categoria.</p>;
    return <div className="product-grid">{items.map(product => <ProductCard key={`${badge || 'catalog'}-${product.id}`} product={product} onAdd={addToCart} />)}</div>;
  };

  return <div className="site-shell">
    <div className="announcement">ASSUMA O COMANDO <span>•</span> ENTREGA EXCLUSIVA EM MANAUS <span>•</span> PAGAMENTO NA ENTREGA</div>
    <header className="header"><div className="header-main container"><a className="brand" href="#top" aria-label="Capitão Suplementos"><img className="logo-image" src="/Logo_Capitao_Esportivo.png" alt="Capitão Suplementos" /></a><div className="search-wrap"><Search size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Busque por whey, creatina, pré..." aria-label="Buscar produtos" /></div><div className="header-actions"><button aria-label="Minha conta"><UserRound size={20} /><span>Login</span></button><button aria-label="Favoritos"><Heart size={20} /></button><button className="bag" aria-label="Sacola" onClick={() => setCartOpen(true)}><ShoppingBag size={20} /><b>{cart.length}</b></button></div></div><nav className="category-nav"><div className="container nav-inner"><a href="#produtos" onClick={() => chooseCategory('')}>TODOS OS PRODUTOS <ChevronDown size={14} /></a><a href="#produtos" onClick={() => chooseCategory('whey')}>WHEY PROTEIN <ChevronDown size={14} /></a><a href="#produtos" onClick={() => chooseCategory('creatina')}>CREATINA</a><a href="#produtos" onClick={() => chooseCategory('pré')}>PRÉ-TREINO</a><a href="#produtos">KITS PROMOCIONAIS</a><a href="#objetivos">OBJETIVOS <ChevronDown size={14} /></a></div></nav></header>
    <main id="top">
      <section className="hero-banner container"><button className="carousel-arrow left" onClick={() => setSlide((slide + 2) % 3)} aria-label="Banner anterior"><ChevronLeft /></button><Placeholder label={`BANNER PRINCIPAL ${slide + 1}`} /><button className="carousel-arrow right" onClick={() => setSlide((slide + 1) % 3)} aria-label="Próximo banner"><ChevronRight /></button><div className="dots">{[0, 1, 2].map(index => <i className={index === slide ? 'active' : ''} key={index} />)}</div></section>
      <section className="section section-tinted" id="destaques"><div className="container"><SectionHeading eyebrow="O que está em evidência" title="🔥 DESTAQUES DA CAPITÃO" /><CatalogNotice loading={catalogLoading} error={catalogError} count={availableProducts.length} />{renderProducts()}</div></section>
      <section className="section" id="lancamentos"><div className="container"><SectionHeading eyebrow="Produtos novos no catálogo" title="LANÇAMENTOS" />{renderProducts('LANÇAMENTO')}</div></section>
      <section className="section section-tinted" id="categorias"><div className="container"><SectionHeading title="COMPRE POR CATEGORIA" /><div className="category-art-grid">{categories.map(item => <a className="category-art" href="#produtos" onClick={() => chooseCategory(item.name.toLocaleLowerCase('pt-BR'))} key={item.slug}><Placeholder label="IMAGEM" /><strong>{item.name}</strong><span>Ver produtos <ArrowRight size={14} /></span></a>)}</div></div></section>
      <section className="section" id="objetivos"><div className="container"><SectionHeading eyebrow="Escolha seu caminho" title="QUAL É O SEU OBJETIVO?" /><div className="goal-grid">{goals.map(goal => <a href={`/objetivo/${goal.slug}`} key={goal.slug} className="goal-banner" aria-label={`Ver produtos para ${goal.name}`}><img src={goal.image} alt={goal.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} /></a>)}</div></div></section>
      <section className="section section-tinted" id="produtos"><div className="container"><SectionHeading eyebrow="Vitrine Capitão" title="CATÁLOGO BLING" /><div className="catalog-toolbar"><span>{visibleProducts.length} produto(s) encontrado(s)</span><button className={category ? 'active' : ''} onClick={() => setCategory('')}>{category ? `Filtro: ${category} ×` : 'Todos os produtos'}</button></div>{renderProducts('OFERTA')}</div></section>
      <section className="section brands-section" id="marcas"><div className="container"><SectionHeading title="MARCAS" /><div className="brand-list">{['MARCA 01', 'MARCA 02', 'MARCA 03', 'MARCA 04', 'MARCA 05'].map(brand => <a href={`/marca/${brand.toLowerCase().replaceAll(' ', '-')}`} key={brand}>{brand}</a>)}</div></div></section>
      <section className="section section-tinted learning-section"><div className="container"><SectionHeading eyebrow="Conteúdo Capitão" title="📚 APRENDA COM A CAPITÃO" /><div className="learning-grid">{learning.map(item => <a href="#aprendizado" className="learning-card" key={item.title}><BookOpen size={21} /><h3>{item.title}</h3><p>{item.text}</p><span>Ler conteúdo <ArrowRight size={14} /></span></a>)}</div></div></section>
      <section className="section final-section"><div className="container final-grid"><a className="final-card dark" href="https://instagram.com/capitaosuplementosoficial"><InstagramIcon /><div><small>SIGA A CAPITÃO</small><strong>Instagram</strong><span>@capitaosuplementosoficial <ArrowRight size={15} /></span></div></a><a className="final-card gold" href="https://wa.me/5592985828394"><MessageCircle /><div><small>FALE COM A CAPITÃO</small><strong>WhatsApp</strong><span>(92) 98582-8394 <ArrowRight size={15} /></span></div></a><a className="final-card light" href="#beneficios"><span className="reward-symbol">R$</span><div><small>PROGRAMA DE FIDELIDADE</small><strong>Compre sempre, ganhe mais</strong><span>Conheça seus benefícios <ArrowRight size={15} /></span></div></a></div></section>
    </main><aside className={`cart-drawer ${cartOpen ? "open" : ""}`} aria-label="Sacola de compras"><div className="cart-head"><h2>Sua sacola</h2><button onClick={() => setCartOpen(false)} aria-label="Fechar sacola"><X /></button></div>{cart.length ? <>{cart.map((item,index) => <div className="cart-item" key={`${item.id}-${index}`}><span>{item.name}</span><strong>{item.price}</strong><button onClick={() => removeFromCart(item.id)}>Remover</button></div>)}<div className="cart-total">Itens: {cart.length}</div><button className="cart-checkout">CONTINUAR PARA CADASTRO</button></> : <p className="cart-empty">Sua sacola está vazia.</p>}</aside><button className="benefits-float" aria-label="Benefícios, resgate aqui"><span>BENEFÍCIOS</span><strong>RESGATE<br />AQUI</strong></button><footer className="footer"><div className="container footer-grid"><div><div className="footer-logo">CAPITÃO<br /><span>SUPLEMENTOS</span></div><p>ASSUMA O COMANDO.</p></div><div><h4>ATENDIMENTO</h4><a href="https://wa.me/5592985828394">WhatsApp</a><a href="#horarios">Horários</a><a href="#manaus">Entrega em Manaus</a></div><div><h4>MINHA CONTA</h4><a href="#login">Login</a><a href="#pedidos">Meus pedidos</a><a href="#beneficios">Benefícios</a></div><div><h4>INSTITUCIONAL</h4><a href="#sobre">Sobre a Capitão</a><a href="#privacidade">Privacidade</a><a href="#termos">Termos e condições</a></div></div><div className="footer-bottom">© {new Date().getFullYear()} CAPITÃO SUPLEMENTOS · MANAUS/AM</div></footer>
  </div>;
}
function CatalogNotice({ loading, error, count }: { loading: boolean; error: string; count: number }) { return <div className="catalog-notice" role="status">{loading ? 'Carregando catálogo real do Bling...' : error ? `Catálogo real indisponível: ${error}` : `${count} produto(s) disponível(is) para compra`}</div>; }
function SectionHeading({ eyebrow, title }: { eyebrow?: string; title: string }) { return <div className="section-heading">{eyebrow && <p>{eyebrow}</p>}<h2>{title}</h2></div>; }

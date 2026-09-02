import { useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Heart, Search, ShoppingBag, UserRound, ArrowRight, BookOpen, MessageCircle } from 'lucide-react';

const categories = [
  { name: 'Creatina', slug: 'creatina' },
  { name: 'Whey Protein', slug: 'whey-protein' },
  { name: 'Termogênicos', slug: 'termogenicos' },
  { name: 'Pré-Treinos', slug: 'pre-treinos' },
  { name: 'Hipercalóricos', slug: 'hipercaloricos' },
  { name: 'Barras Proteicas', slug: 'barras-proteicas' },
];

const products = [
  { id: 1, name: 'Produto em destaque', category: 'Creatina', price: 'R$ 00,00', oldPrice: '', badge: 'DESTAQUE', tags: ['PERFORMANCE'] },
  { id: 2, name: 'Produto em destaque', category: 'Whey Protein', price: 'R$ 00,00', oldPrice: '', badge: 'MAIS VENDIDO', tags: ['GANHO DE MASSA'] },
  { id: 3, name: 'Produto em destaque', category: 'Pré-Treinos', price: 'R$ 00,00', oldPrice: '', badge: 'OFERTA', tags: ['ENERGIA'] },
  { id: 4, name: 'Produto em destaque', category: 'Termogênicos', price: 'R$ 00,00', oldPrice: '', badge: 'DESTAQUE', tags: ['DEFINIÇÃO'] },
];

const learning = [
  { title: 'Como tomar creatina?', text: 'Entenda como incluir a creatina na sua rotina.' },
  { title: 'Como utilizar whey protein?', text: 'Formas práticas de usar whey no dia a dia.' },
  { title: 'Receitas com whey', text: 'Ideias simples para variar seu shake e suas refeições.' },
  { title: 'Como utilizar o pré-treino?', text: 'Informações para aproveitar melhor seu produto.' },
];

function InstagramIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Placeholder({ label, className = '' }: { label: string; className?: string }) {
  return <div className={`placeholder ${className}`} aria-label={`Espaço reservado para ${label}`}><span>{label}</span></div>;
}

function ProductCard({ product }: { product: typeof products[number] }) {
  return (
    <article className="product-card">
      <div className="product-media">
        {product.badge && <span className="badge">{product.badge}</span>}
        <button className="favorite" aria-label="Adicionar aos favoritos"><Heart size={17} /></button>
        <Placeholder label="IMAGEM DO PRODUTO" />
      </div>
      <div className="product-body">
        <div className="tag-row">
          <span>{product.category}</span>
          {product.tags.map(tag => <span key={tag}>{tag}</span>)}
        </div>
        <h3>{product.name}</h3>
        {product.oldPrice && <p className="old-price">{product.oldPrice}</p>}
        <strong>{product.price}</strong>
        <small>à vista no PIX</small>
        <button className="product-button">VER PRODUTO</button>
      </div>
    </article>
  );
}

export default function App() {
  const [search, setSearch] = useState('');
  const [slide, setSlide] = useState(0);

  return (
    <div className="site-shell">
      <div className="announcement">ASSUMA O COMANDO <span>•</span> ENTREGA EXCLUSIVA EM MANAUS <span>•</span> PAGAMENTO NA ENTREGA</div>

      <header className="header">
        <div className="header-main container">
          <a className="brand" href="#top" aria-label="Capitão Suplementos">
            <Placeholder label="LOGO CAPITÃO" className="logo-placeholder" />
          </a>

          <div className="search-wrap">
            <Search size={18} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Busque por whey, creatina, pré..." />
          </div>

          <div className="header-actions">
            <button aria-label="Minha conta"><UserRound size={20} /><span>Login</span></button>
            <button aria-label="Favoritos"><Heart size={20} /></button>
            <button className="bag" aria-label="Sacola"><ShoppingBag size={20} /><b>0</b></button>
          </div>
        </div>

        <nav className="category-nav">
          <div className="container nav-inner">
            <a href="#produtos">TODOS OS PRODUTOS <ChevronDown size={14} /></a>
            <a href="#categorias">WHEY PROTEIN <ChevronDown size={14} /></a>
            <a href="#categorias">CREATINA</a>
            <a href="#categorias">PRÉ-TREINO</a>
            <a href="#produtos">KITS PROMOCIONAIS</a>
            <a href="#objetivos">OBJETIVOS <ChevronDown size={14} /></a>
          </div>
        </nav>
      </header>

      <main id="top">
        <section className="hero-banner container">
          <button className="carousel-arrow left" onClick={() => setSlide((slide + 2) % 3)} aria-label="Banner anterior"><ChevronLeft /></button>
          <Placeholder label={`BANNER PRINCIPAL ${slide + 1}`} />
          <button className="carousel-arrow right" onClick={() => setSlide((slide + 1) % 3)} aria-label="Próximo banner"><ChevronRight /></button>
          <div className="dots"><i className="active" /><i /><i /></div>
        </section>

        <section className="section section-tinted" id="destaques">
          <div className="container">
            <SectionHeading eyebrow="O que está em evidência" title="🔥 DESTAQUES DA CAPITÃO" />
            <div className="product-grid">{products.map(p => <ProductCard key={p.id} product={p} />)}</div>
          </div>
        </section>

        <section className="section" id="lancamentos">
          <div className="container">
            <SectionHeading eyebrow="Produtos novos no catálogo" title="LANÇAMENTOS" />
            <div className="product-grid">{products.map(p => <ProductCard key={p.id} product={{ ...p, badge: 'LANÇAMENTO' }} />)}</div>
          </div>
        </section>

        <section className="section section-tinted" id="categorias">
          <div className="container">
            <SectionHeading title="COMPRE POR CATEGORIA" />
            <div className="category-art-grid">
              {categories.map(category => (
                <a className="category-art" href={`/categoria/${category.slug}`} key={category.slug}>
                  <Placeholder label="IMAGEM" />
                  <strong>{category.name}</strong>
                  <span>Ver produtos <ArrowRight size={14} /></span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="objetivos">
          <div className="container">
            <SectionHeading eyebrow="Escolha seu caminho" title="QUAL É O SEU OBJETIVO?" />
            <div className="goal-grid">
              {['GANHO DE MASSA', 'EMAGRECIMENTO', 'SAÚDE E BEM-ESTAR', 'DEFINIÇÃO MUSCULAR'].map(goal => (
                <a href={`/objetivo/${goal.toLowerCase().replaceAll(' ', '-')}`} key={goal} className="goal-banner"><Placeholder label="BANNER KLAUS / REBECA" /><strong>{goal}</strong><span>Ver produtos <ArrowRight size={15} /></span></a>
              ))}
            </div>
          </div>
        </section>

        <section className="section section-tinted" id="produtos">
          <div className="container">
            <SectionHeading eyebrow="Vitrine Capitão" title="OFERTAS" />
            <div className="product-grid">{products.map(p => <ProductCard key={p.id} product={{ ...p, badge: 'OFERTA' }} />)}</div>
          </div>
        </section>

        <section className="section brands-section" id="marcas">
          <div className="container">
            <SectionHeading title="MARCAS" />
            <div className="brand-list">{['MARCA 01', 'MARCA 02', 'MARCA 03', 'MARCA 04', 'MARCA 05'].map(brand => <a href={`/marca/${brand.toLowerCase().replaceAll(' ', '-')}`} key={brand}>{brand}</a>)}</div>
          </div>
        </section>

        <section className="section section-tinted learning-section">
          <div className="container">
            <SectionHeading eyebrow="Conteúdo Capitão" title="📚 APRENDA COM A CAPITÃO" />
            <div className="learning-grid">
              {learning.map(item => <a href="#aprendizado" className="learning-card" key={item.title}><BookOpen size={21} /><h3>{item.title}</h3><p>{item.text}</p><span>Ler conteúdo <ArrowRight size={14} /></span></a>)}
            </div>
          </div>
        </section>

        <section className="section final-section">
          <div className="container final-grid">
            <a className="final-card dark" href="https://instagram.com/capitaosuplementosoficial"><InstagramIcon /><div><small>SIGA A CAPITÃO</small><strong>Instagram</strong><span>@capitaosuplementosoficial <ArrowRight size={15} /></span></div></a>
            <a className="final-card gold" href="https://wa.me/5592985828394"><MessageCircle /><div><small>FALE COM A CAPITÃO</small><strong>WhatsApp</strong><span>(92) 98582-8394 <ArrowRight size={15} /></span></div></a>
            <a className="final-card light" href="#beneficios"><span className="reward-symbol">R$</span><div><small>PROGRAMA DE FIDELIDADE</small><strong>Compre sempre, ganhe mais</strong><span>Conheça seus benefícios <ArrowRight size={15} /></span></div></a>
          </div>
        </section>
      </main>

      <button className="benefits-float" aria-label="Benefícios, resgate aqui"><span>BENEFÍCIOS</span><strong>RESGATE<br />AQUI</strong></button>

      <footer className="footer">
        <div className="container footer-grid">
          <div><div className="footer-logo">CAPITÃO<br /><span>SUPLEMENTOS</span></div><p>ASSUMA O COMANDO.</p></div>
          <div><h4>ATENDIMENTO</h4><a href="https://wa.me/5592985828394">WhatsApp</a><a href="#horarios">Horários</a><a href="#manaus">Entrega em Manaus</a></div>
          <div><h4>MINHA CONTA</h4><a href="#login">Login</a><a href="#pedidos">Meus pedidos</a><a href="#beneficios">Benefícios</a></div>
          <div><h4>INSTITUCIONAL</h4><a href="#sobre">Sobre a Capitão</a><a href="#privacidade">Privacidade</a><a href="#termos">Termos e condições</a></div>
        </div>
        <div className="footer-bottom">© {new Date().getFullYear()} CAPITÃO SUPLEMENTOS · MANAUS/AM</div>
      </footer>
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return <div className="section-heading">{eyebrow && <p>{eyebrow}</p>}<h2>{title}</h2></div>;
}

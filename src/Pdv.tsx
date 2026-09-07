import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Banknote, Check, CreditCard, FileText, Menu, Minus, Plus, QrCode, Search, ShoppingCart, Sparkles, Trash2, UserRound, X } from 'lucide-react';

type Product = { id: number; name: string; code?: string; ean?: string; price: number; image?: string; stock: number; stockByLocation: { camapua: number; newfit: number } };
type Payment = { id: string; label: string; account: string; icon: 'credit' | 'debit' | 'pix' | 'cash' | 'bemol'; settlement: string };
type CartItem = Product & { quantity: number };
type Customer = { name: string; document: string; phone: string; email: string; points?: number };
type View = 'sale' | 'customers' | 'orders' | 'nfc' | 'closing' | 'closing-message';
type LocationConfig = { label: string; stock: string; payments: [string, string, string, string, Payment['icon']][] };
type LocationKey = 'camapua' | 'newfit';
type CatalogCache = { savedAt: number; products: Product[] };

const LOCATIONS: Record<'camapua' | 'newfit', LocationConfig> = {
  camapua: { label: 'CAMAPUÃ', stock: 'ESTOQUE MATRIZ', payments: [
    ['credit1', 'CARTÃO CRÉDITO 1X', 'GETNET', 'D+2', 'credit'], ['credit2', 'CARTÃO CRÉDITO 2X', 'GETNET', 'D+2', 'credit'], ['credit3', 'CARTÃO CRÉDITO 3X', 'GETNET', 'D+2', 'credit'], ['debit', 'CARTÃO DÉBITO', 'GETNET', 'D+1', 'debit'], ['pix', 'PIX', 'SANTANDER PJ', 'D+0', 'pix'], ['cash', 'DINHEIRO', 'CAMAPUÃ', 'D+0', 'cash'], ['bemol', 'CREDIÁRIO BEMOL', 'BEMOL', 'CONTA ÚNICA', 'bemol']
  ] },
  newfit: { label: 'NEWFIT', stock: 'ESTOQUE NEWFIT', payments: [
    ['credit1', 'CARTÃO CRÉDITO 1X', 'CAIXA', 'D+2', 'credit'], ['credit2', 'CARTÃO CRÉDITO 2X', 'CAIXA', 'D+2', 'credit'], ['credit3', 'CARTÃO CRÉDITO 3X', 'CAIXA', 'D+2', 'credit'], ['debit', 'CARTÃO DÉBITO', 'CAIXA', 'D+1', 'debit'], ['pix', 'PIX', 'CAIXA PJ', 'D+0', 'pix'], ['cash', 'DINHEIRO', 'NEWFIT', 'D+0', 'cash'], ['bemol', 'CREDIÁRIO BEMOL', 'BEMOL', 'CONTA ÚNICA', 'bemol']
  ] }
};

const SELLERS = ['AUGUSTUS', 'HEVELLYN', 'ELIAS'];
const PDV_ACTIVE_SELLER_KEY = 'capitao-pdv-active-seller-v1';

function readActiveSeller() {
  try {
    const saved = localStorage.getItem(PDV_ACTIVE_SELLER_KEY);
    return saved && SELLERS.includes(saved) ? saved : SELLERS[0];
  } catch { return SELLERS[0]; }
}
const KLAUS = ['Assuma o comando! Essa venda começou forte.', 'Boa! Cada atendimento abre uma nova oportunidade.', 'Foco no cliente, confiança na oferta e vamos para cima!', 'Excelente início. Vamos transformar atendimento em resultado.', 'Cada venda conta. Mantenha o ritmo!', 'Você está no comando. Vamos fechar essa venda!'];
const REBECA = ['Muito bem! Atendimento de qualidade gera resultado.', 'Começamos bem. Continue oferecendo com confiança!', 'Você está fazendo acontecer. Vamos para a próxima!', 'Excelente! Escute o cliente e encontre a melhor solução.', 'Boa venda! Consistência é o caminho para crescer.', 'Confiança no atendimento, excelência no resultado. ✨'];

function money(value: number) { return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function parsePrice(value: unknown) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim(); }
function locationStock(raw: any, location: 'camapua' | 'newfit') {
  const deposits = raw?.estoque?.depositos;
  // Nunca usar saldoVirtualTotal para uma loja específica: esse valor é agregado
  // e faria NEWFIT e CAMAPUÃ exibirem o mesmo saldo.
  if (!Array.isArray(deposits) || !deposits.length) return 0;

  const matches = deposits.filter((item: any) => {
    const name = normalize(String(item?.deposito?.nome || item?.nome || item?.local?.nome || item?.name || ''));
    if (location === 'newfit') {
      return name === 'capitao suplementos newfit' || name === 'estoque newfit' || name.includes('newfit');
    }
    // No Bling, a loja CAPITÃO SUPLEMENTOS CAMAPUÃ continua vinculada ao
    // depósito interno chamado ESTOQUE MATRIZ.
    return name === 'estoque matriz' || name === 'capitao suplementos camapua' || name.includes('estoque matriz') || name.includes('camapua');
  });

  return matches.reduce((sum: number, item: any) => sum + Number(item?.saldo ?? item?.quantidade ?? item?.saldoVirtual ?? 0), 0);
}
const PDV_CATALOG_CACHE_KEY = 'capitao-pdv-catalog-v2';
function readCatalogCache(): CatalogCache | null {
  try {
    const raw = localStorage.getItem(PDV_CATALOG_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CatalogCache;
    return Array.isArray(data?.products) && data.products.length ? data : null;
  } catch { return null; }
}
function writeCatalogCache(products: Product[]) {
  if (!products.length) return;
  try { localStorage.setItem(PDV_CATALOG_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), products })); } catch {}
}
function mapCatalogProducts(data: any): Product[] {
  const source = Array.isArray(data?.products) ? data.products : [];
  return source.map((p: any) => ({
    id: Number(p.id), name: p.nome || p.descricaoCurta || 'Produto', code: p.codigo,
    ean: p.gtin || p.gtinProduto || p.codigoBarras || p.ean, price: parsePrice(p.preco),
    image: p.imagemOriginal || p.originalImage || p.images?.find?.((image: any) => image?.type === 'original')?.url || p.imagemURL || p.imagens?.find?.((image: any) => image?.tipo !== 'thumbnail')?.link || p.midia?.imagens?.externas?.[0]?.link || p.midia?.imagens?.internas?.[0]?.link,
    stock: Number(p.estoque?.saldoVirtualTotal || 0),
    stockByLocation: { camapua: locationStock(p, 'camapua'), newfit: locationStock(p, 'newfit') }
  })).filter((p: Product) => Number.isFinite(p.id) && p.id > 0);
}
function paymentIcon(type: Payment['icon']) { if (type === 'credit' || type === 'debit') return <CreditCard size={17} />; if (type === 'pix') return <QrCode size={17} />; if (type === 'cash') return <Banknote size={17} />; return <FileText size={17} />; }

export default function Pdv({ initialLocation = 'camapua', lockLocation = false }: { initialLocation?: LocationKey; lockLocation?: boolean }) {
  const [location, setLocation] = useState<LocationKey>(initialLocation);
  const [seller, setSeller] = useState(readActiveSeller);
  const [sortMode, setSortMode] = useState<'az' | 'sku'>('az');
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<View>('sale');
  const [products, setProducts] = useState<Product[]>(() => readCatalogCache()?.products || []);
  const [catalogState, setCatalogState] = useState<'loading' | 'live' | 'cached' | 'offline'>('loading');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerPanel, setCustomerPanel] = useState(false);
  const [customerForm, setCustomerForm] = useState<Customer>({ name: '', document: '', phone: '', email: '' });
  const [selectedPayment, setSelectedPayment] = useState('');
  const [creditInstallment, setCreditInstallment] = useState('1');
  const [documentChoice, setDocumentChoice] = useState<'nfc' | 'receipt' | null>(null);
  const [showFinalize, setShowFinalize] = useState(false);
  const [message, setMessage] = useState('');
  const [closingReceived, setClosingReceived] = useState<Record<string, string>>({});
  const [closingStep, setClosingStep] = useState<'form' | 'message'>('form');
  const [orderSearch, setOrderSearch] = useState('');
  const [otherStoreOpen, setOtherStoreOpen] = useState(false);
  const [otherStoreQuery, setOtherStoreQuery] = useState('');

  const config = LOCATIONS[location];
  const payments: Payment[] = config.payments.map(([id, label, account, settlement, icon]) => ({ id, label, account, settlement, icon }));
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    let active = true;
    const cached = readCatalogCache();
    if (cached?.products.length) {
      setProducts(cached.products);
      setCatalogState(navigator.onLine ? 'cached' : 'offline');
    }
    const loadCatalog = async () => {
      if (!navigator.onLine) {
        if (active && cached?.products.length) setCatalogState('offline');
        if (active && !cached?.products.length) setMessage('Sem internet e ainda não existe um catálogo salvo neste dispositivo.');
        return;
      }
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch('/api/bling/products?pagina=1&limite=100&todos=1', { cache: 'no-store', signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || 'Catálogo indisponível.');
        const mapped = mapCatalogProducts(data);
        if (!mapped.length) throw new Error('O catálogo retornou vazio; mantendo a última cópia segura.');
        if (!active) return;
        setProducts(mapped);
        writeCatalogCache(mapped);
        setCatalogState('live');
      } catch (error) {
        if (!active) return;
        const fallback = readCatalogCache();
        if (fallback?.products.length) {
          setProducts(fallback.products);
          setCatalogState(navigator.onLine ? 'cached' : 'offline');
          setMessage('Catálogo seguro carregado localmente. A sincronização será retomada quando o Bling responder.');
        } else {
          setCatalogState('offline');
          setMessage(error instanceof Error ? error.message : 'Não foi possível carregar o catálogo agora.');
        }
      } finally {
        window.clearTimeout(timeout);
      }
    };
    void loadCatalog();
    const onOnline = () => void loadCatalog();
    window.addEventListener('online', onOnline);
    return () => { active = false; window.removeEventListener('online', onOnline); };
  }, []);

  useEffect(() => { setLocation(initialLocation); }, [initialLocation]);

  useEffect(() => { setSelectedPayment(''); setCreditInstallment('1'); }, [location]);

  useEffect(() => {
    try { localStorage.setItem(PDV_ACTIVE_SELLER_KEY, seller); } catch {}
  }, [seller]);

  function assumeSeller(nextSeller: string) {
    setSeller(nextSeller);
    setMessage(nextSeller === seller ? `${nextSeller} continua na operação atual.` : `${nextSeller} assumiu a operação atual.`);
  }

  const visibleProducts = useMemo(() => {
    const tokens = normalize(query).split(/\s+/).filter(Boolean);
    return products.filter(product => {
      if (!tokens.length) return true;
      const haystack = normalize([product.name, product.code || '', product.ean || ''].join(' '));
      return tokens.every(token => haystack.includes(token));
    }).sort((a, b) => {
      const bySelectedOrder = sortMode === 'sku'
        ? String(a.code || '').localeCompare(String(b.code || ''), 'pt-BR', { numeric: true, sensitivity: 'base' }) || a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
        : a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });

      if (!query.trim()) return bySelectedOrder;

      const q = normalize(query);
      const byRelevance = Number(!normalize(a.name).startsWith(q)) - Number(!normalize(b.name).startsWith(q));
      return byRelevance || bySelectedOrder;
    }).slice(0, 30);
  }, [products, query, sortMode]);

  const otherLocation = location === 'newfit' ? 'camapua' : 'newfit';
  const otherStoreProducts = useMemo(() => {
    const tokens = normalize(otherStoreQuery).split(/\s+/).filter(Boolean);
    return products.filter(product => {
      if (!tokens.length) return true;
      const haystack = normalize([product.name, product.code || '', product.ean || ''].join(' '));
      return tokens.every(token => haystack.includes(token));
    }).sort((a, b) => String(a.code || a.name).localeCompare(String(b.code || b.name), 'pt-BR', { numeric: true, sensitivity: 'base' })).slice(0, 30);
  }, [products, otherStoreQuery]);

  const activePayment = payments.find(p => p.id === selectedPayment);
  const paymentLabel = activePayment?.id.startsWith('credit') ? `CARTÃO CRÉDITO ${creditInstallment}X` : activePayment?.label || '';

  function add(product: Product) {
    const available = product.stockByLocation[location];
    setCart(current => {
      const found = current.find(x => x.id === product.id);
      const nextQuantity = (found?.quantity || 0) + 1;
      if (available <= 0 || nextQuantity > available) {
        setMessage(`${product.name}: estoque indisponível na ${LOCATIONS[location].label}.`);
        return current;
      }
      return found ? current.map(x => x.id === product.id ? { ...x, quantity: nextQuantity } : x) : [...current, { ...product, quantity: 1 }];
    });
  }
  function changeQty(id: number, delta: number) {
    setCart(current => current.map(x => {
      if (x.id !== id) return x;
      const nextQuantity = Math.max(0, x.quantity + delta);
      const available = x.stockByLocation[location];
      if (delta > 0 && nextQuantity > available) {
        setMessage(`${x.name}: quantidade máxima disponível nesta loja é ${available}.`);
        return x;
      }
      return { ...x, quantity: nextQuantity };
    }).filter(x => x.quantity > 0));
  }
  function removeFromCart(id: number) { setCart(current => current.filter(item => item.id !== id)); }
  function go(next: View) { setView(next); setMenuOpen(false); setCustomerPanel(false); setClosingStep('form'); }
  function saveCustomer() { if (!customerForm.name.trim() || !customerForm.document.trim()) { setMessage('Informe pelo menos nome e CPF/CNPJ para vincular o cliente.'); return; } setCustomer({ ...customerForm, points: 0 }); setCustomerPanel(false); setMessage('Cliente vinculado à venda.'); }
  function finishSale() {
    if (!cart.length || !selectedPayment || !documentChoice) return;
    try { localStorage.setItem(PDV_ACTIVE_SELLER_KEY, seller); } catch {}
    setShowFinalize(false);
    setCart([]);
    setCustomer(null);
    setSelectedPayment('');
    setCreditInstallment('1');
    setDocumentChoice(null);
    setMessage(`Venda concluída por ${seller}. Operação mantida com o último vendedor ativo.`);
  }

  const soldByPayment = payments.map(p => ({ ...p, sold: p.id === selectedPayment ? total : 0 }));
  const receivedTotal = Object.values(closingReceived).reduce((sum, value) => sum + (Number(String(value).replace(',', '.')) || 0), 0);
  const expectedTotal = soldByPayment.reduce((sum, p) => sum + p.sold, 0);
  const allClosingOk = soldByPayment.every(p => Math.abs(p.sold - (Number(String(closingReceived[p.id] || '').replace(',', '.')) || 0)) < 0.005);

  return <div className="pdv-shell">
    <style>{`
      .pdv-shell{min-height:100vh;background:#0a0b0c;color:#f4f2ed;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:-.01em}.pdv-shell *{box-sizing:border-box}.pdv-top{height:74px;background:#101112;border-bottom:1px solid #252729;display:flex;align-items:center;padding:0 22px;gap:18px;position:relative;z-index:30}.pdv-brand{display:flex;align-items:center;gap:13px;min-width:235px}.pdv-logo{height:48px;width:96px;object-fit:contain}.pdv-brand small{display:block;color:#777b80;font-size:8px;letter-spacing:1.8px;font-weight:800;margin-bottom:3px}.pdv-brand strong{font-size:13px;letter-spacing:.7px;font-weight:850}.pdv-top-meta{display:flex;align-items:center;gap:10px;margin-left:auto}.pdv-context{display:flex;align-items:center;gap:8px;background:#17191a;border:1px solid #303235;border-radius:10px;padding:7px 10px}.pdv-context label{display:block;color:#777b80;font-size:7px;letter-spacing:1.1px;font-weight:900;margin-bottom:2px}.pdv-context select{appearance:none;background:transparent;color:#eee;border:0;outline:0;font-size:10px;font-weight:800;min-width:135px}.pdv-context .seller-select{min-width:105px}.pdv-menu-btn{width:42px;height:42px;border:1px solid #343638;background:#17191a;color:#e9e7e2;border-radius:10px;display:grid;place-items:center;cursor:pointer;transition:.18s}.pdv-menu-btn:hover{border-color:#b78a3d;background:#1d1c19}.pdv-main{display:grid;grid-template-columns:286px minmax(450px,1fr) 365px;min-height:calc(100vh - 74px)}.pdv-left,.pdv-center,.pdv-right{min-width:0}.pdv-left{background:#101112;padding:20px;border-right:1px solid #26282a}.pdv-center{background:#f2f0eb;color:#171819;padding:20px}.pdv-right{background:#0f1011;padding:20px;border-left:1px solid #26282a}.pdv-eyebrow{font-size:8px;letter-spacing:1.7px;color:#777b80;font-weight:900;margin-bottom:9px}.pdv-client{background:#17191a;border:1px solid #2d3032;border-radius:12px;padding:15px}.pdv-client-main{display:flex;align-items:center;gap:11px}.pdv-avatar{width:36px;height:36px;border-radius:10px;background:#242629;display:grid;place-items:center;color:#b88a3d}.pdv-client strong{display:block;font-size:12px}.pdv-client span{font-size:9px;color:#81858a;display:block;margin-top:3px}.pdv-client-points{margin-top:12px;padding-top:11px;border-top:1px solid #2b2d2f;color:#bd9149;font-size:9px;font-weight:850}.pdv-client-actions{display:flex;gap:7px;margin-top:12px}.pdv-ghost{border:1px solid #34373a;background:#1c1e20;color:#e8e6e1;border-radius:8px;height:34px;padding:0 10px;font-size:8px;font-weight:900;cursor:pointer}.pdv-ghost:hover{border-color:#9a7438}.pdv-shortcuts{margin-top:28px}.pdv-shortcut{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #202224;font-size:9px;color:#92969a}.pdv-shortcut kbd{font-family:inherit;color:#65696e;border:1px solid #303337;border-radius:5px;padding:3px 5px;font-size:7px}.pdv-session{margin-top:24px;padding:12px;border-radius:10px;background:#151718;border:1px solid #292b2e}.pdv-session label{display:block;color:#73777c;font-size:7px;letter-spacing:1.2px;font-weight:900}.pdv-session strong{display:block;margin-top:5px;font-size:11px}.pdv-session span{font-size:8px;color:#777b80}.pdv-seller-list{margin-top:14px}.pdv-seller-list .pdv-eyebrow{margin-bottom:8px}.pdv-seller-option{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;height:34px;margin-top:6px;padding:0 10px;border:1px solid #292c2f;border-radius:8px;background:#17191a;color:#8f9499;font-size:8px;font-weight:900;letter-spacing:.4px;cursor:pointer;text-align:left}.pdv-seller-option:hover{border-color:#7c6237;color:#e9e7e2}.pdv-seller-option.active{border-color:#b4863d;background:#1f1a13;color:#f4e4c5}.pdv-seller-option small{font-size:7px;color:#b4863d;font-weight:950}.pdv-search{display:flex;align-items:center;gap:9px;height:46px;background:#fff;border:1px solid #d8d4cb;border-radius:11px;padding:0 13px;box-shadow:0 5px 18px #00000008}.pdv-search:focus-within{border-color:#b98a3c;box-shadow:0 0 0 3px #b98a3c18}.pdv-search input{border:0;outline:0;background:transparent;width:100%;font:600 12px/1 Inter,ui-sans-serif,system-ui;color:#171819}.pdv-search input::placeholder{color:#99958d;font-weight:500}.pdv-search-hint{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:9px 2px 14px;font-size:8px;color:#858078}.pdv-search-hint b{color:#6c675f}.pdv-sort{display:flex;align-items:center;gap:4px}.pdv-sort button{height:25px;padding:0 9px;border:1px solid #d5d0c6;background:#f8f7f4;color:#6f6a61;border-radius:6px;font-size:7px;font-weight:950;letter-spacing:.5px;cursor:pointer}.pdv-sort button.active{background:#b4863d;color:#fff;border-color:#b4863d}.pdv-sort button:hover{border-color:#b4863d}.pdv-sync-status{display:inline-flex;align-items:center;gap:5px;font-size:8px;font-weight:900;margin-left:8px;color:#607765}.pdv-sync-status:before{content:'';width:6px;height:6px;border-radius:50%;background:#5c8c68}.pdv-sync-status.cached{color:#9a7b47}.pdv-sync-status.cached:before{background:#b78a3d}.pdv-sync-status.offline{color:#b27a5d}.pdv-sync-status.offline:before{background:#b05b4f}.pdv-product-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;max-height:calc(100vh - 170px);overflow:auto;padding:1px 2px 20px}.pdv-product{appearance:none;background:#fff;border:1px solid #dedad2;border-radius:12px;padding:11px;cursor:pointer;text-align:left;min-height:166px;transition:.16s;box-shadow:0 2px 8px #00000008}.pdv-product:hover{transform:translateY(-2px);border-color:#bd8d42;box-shadow:0 10px 25px #00000012}.pdv-product img{width:100%;height:76px;object-fit:contain}.pdv-product .noimg{height:76px;display:grid;place-items:center;color:#aaa49b;font-size:8px;font-weight:900;letter-spacing:1px}.pdv-product-sku{display:block;color:#8d7040;font-size:7px;font-weight:950;letter-spacing:.8px;margin-top:7px}.pdv-product strong{display:block;color:#222;font-size:10px;line-height:1.35;margin:4px 0 8px;min-height:27px}.pdv-product-meta{display:flex;justify-content:space-between;align-items:end;gap:6px}.pdv-product-price{font-size:12px;color:#9a702f;font-weight:950}.pdv-stock{font-size:7px;color:#8e8981}.pdv-empty{padding:35px;text-align:center;color:#777;font-size:10px}.pdv-cart{display:flex;flex-direction:column;height:100%}.pdv-cart-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.pdv-cart-head .pdv-eyebrow{margin:0}.pdv-count{font-size:8px;color:#898d92;background:#191b1c;border:1px solid #2d3032;border-radius:999px;padding:5px 8px}.pdv-cart-list{height:246px;flex:0 0 246px;overflow-y:auto;overflow-x:hidden;min-height:0;padding-right:3px;scrollbar-width:thin;scrollbar-color:#4b4f53 transparent}.pdv-cart-list::-webkit-scrollbar{width:7px}.pdv-cart-list::-webkit-scrollbar-track{background:transparent}.pdv-cart-list::-webkit-scrollbar-thumb{background:#3d4246;border-radius:99px}.pdv-cart-item{padding:12px 0;border-bottom:1px solid #292b2d}.pdv-cart-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.pdv-cart-main{display:flex;align-items:center;gap:10px;min-width:0;flex:1}.pdv-cart-thumb{width:54px;height:54px;flex:0 0 54px;border-radius:8px;background:#181b1d;border:1px solid #282c2f;display:grid;place-items:center;overflow:hidden}.pdv-cart-thumb img{width:100%;height:100%;object-fit:contain}.pdv-cart-thumb .noimg{font-size:7px;color:#70757a;font-weight:900;letter-spacing:.8px}.pdv-cart-info{min-width:0}.pdv-cart-item strong{font-size:10px;line-height:1.35;display:block}.pdv-cart-code{font-size:8px;color:#777d82;margin-top:3px;display:block}.pdv-cart-item-total{font-size:10px;font-weight:900;white-space:nowrap}.pdv-cart-sub{display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-left:64px}.pdv-cart-sub span{font-size:8px;color:#7e8287}.pdv-step{display:flex;align-items:center;gap:6px}.pdv-step button{width:24px;height:24px;border:1px solid #34373a;background:#191b1c;color:#eee;border-radius:7px;display:grid;place-items:center;cursor:pointer}.pdv-step button:hover{border-color:#b88a3d}.pdv-step b{font-size:9px;min-width:12px;text-align:center}.pdv-cart-remove{margin-top:8px;margin-left:64px;border:1px solid #3a3030;background:#1b1919;color:#d59a92;border-radius:7px;height:28px;padding:0 9px;display:inline-flex;align-items:center;gap:6px;font-size:7px;font-weight:900;letter-spacing:.45px;cursor:pointer}.pdv-cart-remove:hover{border-color:#b45d55;background:#241a1a;color:#f0b0a8}.pdv-summary{padding:14px 0 4px;border-top:1px solid #2b2d2f;margin-top:10px}.pdv-summary-line{display:flex;justify-content:space-between;color:#85898e;font-size:9px;margin:6px 0}.pdv-summary-line b{color:#ddd}.pdv-summary-total{display:flex;justify-content:space-between;align-items:end;margin-top:10px}.pdv-summary-total span{font-size:8px;letter-spacing:1.2px;color:#777b80;font-weight:900}.pdv-summary-total strong{font-size:24px;letter-spacing:-.8px}.pdv-payment-wrap{margin-top:16px}.pdv-payment-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}.pdv-payment-head .pdv-eyebrow{margin:0}.pdv-payment-current{font-size:8px;color:#b88a3d;font-weight:850}.pdv-payment-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.pdv-payment{min-width:0;display:flex;align-items:center;gap:8px;border:1px solid #2d3032;background:#17191a;color:#eee;border-radius:9px;padding:10px 9px;text-align:left;cursor:pointer;transition:.15s}.pdv-payment:hover{border-color:#66502b}.pdv-payment.selected{border-color:#b88a3d;background:#201b12;box-shadow:0 0 0 1px #b88a3d22}.pdv-payment-icon{color:#9b9fa4;display:grid;place-items:center}.pdv-payment.selected .pdv-payment-icon{color:#c2964e}.pdv-payment b{display:block;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pdv-payment small{display:block;color:#73777c;font-size:7px;margin-top:2px}.pdv-installments{display:flex;gap:6px;margin-top:7px}.pdv-installments button{flex:1;height:29px;border:1px solid #33363a;background:#17191a;color:#999da2;border-radius:7px;font-size:8px;font-weight:850;cursor:pointer}.pdv-installments button.selected{border-color:#b88a3d;background:#251e12;color:#e9d3a7}.pdv-points{display:flex;align-items:center;gap:9px;margin-top:12px;padding:11px;border:1px solid #2d3032;border-radius:9px;background:#151718}.pdv-points-icon{color:#b88a3d}.pdv-points strong{font-size:9px}.pdv-points span{display:block;color:#777b80;font-size:7px;margin-top:3px}.pdv-finalize{width:100%;height:46px;margin-top:12px;background:#b4863d;color:#fff;border:0;border-radius:10px;font-size:9px;font-weight:950;letter-spacing:1px;cursor:pointer;box-shadow:0 8px 22px #b4863d18}.pdv-finalize:hover{background:#c1934a}.pdv-finalize:disabled{opacity:.35;cursor:not-allowed;box-shadow:none}.pdv-menu{position:absolute;right:22px;top:64px;width:275px;background:#17191a;border:1px solid #34373a;border-radius:12px;padding:7px;z-index:60;box-shadow:0 22px 55px #000b}.pdv-menu button{display:flex;align-items:center;gap:10px;width:100%;padding:12px 11px;border:0;background:transparent;color:#e9e7e2;text-align:left;border-radius:8px;font-weight:750;font-size:9px;cursor:pointer}.pdv-menu button:hover{background:#222426}.pdv-overlay{position:fixed;inset:0;background:#0009;z-index:100}.pdv-drawer{position:absolute;right:0;top:0;height:100%;width:min(460px,100%);background:#111314;border-left:1px solid #343638;padding:24px;box-shadow:-20px 0 60px #0008;overflow:auto}.pdv-drawer-head{display:flex;justify-content:space-between;align-items:start;margin-bottom:24px}.pdv-drawer h2{font-size:19px;margin:3px 0 0}.pdv-close{background:transparent;border:0;color:#8c9196;cursor:pointer}.pdv-form{display:grid;gap:9px}.pdv-form label{font-size:8px;color:#777b80;font-weight:850;letter-spacing:.8px}.pdv-form input{height:43px;background:#191b1c;border:1px solid #34373a;color:#fff;border-radius:8px;padding:0 12px;outline:0;font:600 11px Inter,system-ui}.pdv-form input:focus{border-color:#b88a3d}.pdv-form button{height:44px;border:0;background:#b4863d;color:#fff;border-radius:8px;font-weight:950;font-size:9px;margin-top:5px}.pdv-finalize-modal{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(540px,calc(100% - 30px));background:#17191a;border:1px solid #3b3e40;border-radius:15px;padding:24px;box-shadow:0 25px 70px #000b}.pdv-modal-title{font-size:19px;font-weight:900;margin:3px 0 7px}.pdv-modal-copy{font-size:9px;color:#85898e;line-height:1.5}.pdv-docs{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:20px 0}.pdv-doc{border:1px solid #34373a;background:#1e2021;color:#eee;border-radius:10px;padding:18px;text-align:left;cursor:pointer}.pdv-doc.selected{border-color:#b88a3d;background:#211b12}.pdv-doc strong{display:block;margin:9px 0 3px;font-size:10px}.pdv-doc span{font-size:8px;color:#7e8287}.pdv-actions{display:flex;gap:8px}.pdv-actions button{flex:1;height:42px;border-radius:8px;border:1px solid #373a3d;background:#202223;color:#eee;font-size:9px;font-weight:900}.pdv-actions .primary{background:#b4863d;border-color:#b4863d}.pdv-actions button:disabled{opacity:.35}.pdv-page{min-height:calc(100vh - 74px);padding:26px;background:#101112}.pdv-page-head{display:flex;align-items:center;gap:13px;margin-bottom:20px}.pdv-back{height:36px;border:1px solid #34373a;background:#181a1b;color:#eee;padding:0 11px;border-radius:8px;display:flex;align-items:center;gap:6px;font-size:8px;font-weight:900;cursor:pointer}.pdv-page h1{font-size:21px;margin:0}.pdv-card{background:#17191a;border:1px solid #2e3133;border-radius:12px;padding:18px}.pdv-closing-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.pdv-closing-line{padding:13px 0;border-bottom:1px solid #292b2d}.pdv-closing-line>div{display:flex;justify-content:space-between;align-items:center;gap:12px}.pdv-closing-line strong{font-size:9px}.pdv-closing-line small{display:block;color:#70757a;font-size:7px;margin-top:4px}.pdv-closing-line input{width:130px;height:35px;background:#202223;border:1px solid #3a3d40;color:#fff;border-radius:7px;padding:0 9px;text-align:right;font-weight:850;font-size:9px}.pdv-check{display:flex;align-items:center;gap:6px;margin-top:7px;font-size:7px;font-weight:900}.ok{color:#72c98b}.bad{color:#dc8076}.pdv-closing-total{margin-top:14px;padding:15px;border:1px solid #34373a;border-radius:10px;background:#1b1d1e}.pdv-closing-total div{display:flex;justify-content:space-between;margin:7px 0;font-size:9px;color:#92969a}.pdv-closing-total strong{font-size:18px;color:#eee}.pdv-message{max-width:820px;margin:30px auto;text-align:center;padding:55px 35px;background:linear-gradient(145deg,#1a1c1d,#111213);border:1px solid #383b3d;border-radius:17px}.pdv-message .char{font-size:42px}.pdv-message blockquote{font-size:19px;line-height:1.5;margin:18px auto 24px;max-width:640px}.pdv-message button{height:44px;background:#b4863d;color:#fff;border:0;border-radius:8px;padding:0 24px;font-size:9px;font-weight:950}.pdv-stock-drawer{position:absolute;right:0;top:0;height:100%;width:min(700px,100%);background:#111314;color:#fff;border-left:1px solid #343638;padding:24px;box-shadow:-20px 0 60px #0008;overflow:auto}.pdv-stock-drawer h2{color:#fff;font-size:28px;font-weight:900;margin:3px 0 0}.pdv-stock-drawer p{color:#b9bdc2!important;font-size:10px!important}.pdv-stock-search{margin:18px 0 14px}.pdv-stock-search input{color:#fff!important}.pdv-stock-search input::placeholder{color:#858a90!important}.pdv-stock-results{display:grid;gap:10px}.pdv-stock-row{display:grid;grid-template-columns:74px minmax(0,1fr) 104px 104px;gap:12px;align-items:center;padding:12px;border:1px solid #292d30;border-radius:12px;background:#181a1b}.pdv-stock-thumb{width:74px;height:74px;border-radius:9px;background:#0f1011;border:1px solid #2d3134;display:grid;place-items:center;overflow:hidden}.pdv-stock-thumb img{width:100%;height:100%;object-fit:contain}.pdv-stock-thumb .noimg{font-size:7px;color:#7f858a;font-weight:900}.pdv-stock-info{min-width:0}.pdv-stock-row strong{display:block;color:#fff;font-size:11px;line-height:1.35;font-weight:900}.pdv-stock-row small{display:block;color:#9aa0a6;font-size:8px;margin-top:5px}.pdv-stock-location{text-align:center;padding:10px 6px;border-radius:9px;background:#111314;border:1px solid #2b2f32}.pdv-stock-location label{display:block;color:#9aa0a6;font-size:7px;letter-spacing:.7px;font-weight:900;margin-bottom:6px}.pdv-stock-location b{font-size:16px;color:#fff}.pdv-stock-location.other{border-color:#4d3a1d;background:#1a1712}.pdv-stock-location.other label{color:#c4a46a}.pdv-stock-location.other b{color:#e1b762}.pdv-stock-empty{padding:28px 0;color:#a7adb2;font-size:10px;text-align:center}@media(max-width:620px){.pdv-stock-row{grid-template-columns:58px minmax(0,1fr);gap:9px}.pdv-stock-thumb{width:58px;height:58px}.pdv-stock-location{grid-column:span 1}.pdv-stock-info{grid-column:2}.pdv-stock-location:nth-last-child(2){grid-column:1}.pdv-stock-location:last-child{grid-column:2}}.pdv-toast{position:fixed;right:20px;bottom:20px;background:#202223;color:#fff;border:1px solid #414447;padding:12px 14px;border-radius:9px;font-size:9px;font-weight:750;z-index:200;box-shadow:0 15px 40px #0009}
      @media(max-width:1120px){.pdv-main{grid-template-columns:250px 1fr}.pdv-right{grid-column:1/-1;border-top:1px solid #26282a}.pdv-payment-grid{grid-template-columns:repeat(4,1fr)}}
      @media(max-width:780px){.pdv-top{padding:0 12px}.pdv-brand{min-width:auto}.pdv-brand>div{display:none}.pdv-context{padding:6px}.pdv-main{display:block}.pdv-left,.pdv-center,.pdv-right{border:0}.pdv-product-list{grid-template-columns:repeat(2,minmax(0,1fr));max-height:none}.pdv-closing-grid{grid-template-columns:1fr}.pdv-payment-grid{grid-template-columns:repeat(2,1fr)}}
    `}</style>

    <header className="pdv-top">
      <div className="pdv-brand"><img className="pdv-logo" src="/Logo_Capitao_Esportivo.png" alt="Capitão Suplementos" /><div><small>PDV • OPERAÇÃO</small><strong>CAPITÃO SUPLEMENTOS</strong></div></div>
      <div className="pdv-top-meta">
        <div className="pdv-context"><div><label>LOJA / ESTOQUE</label><select value={location} disabled={lockLocation} onChange={e => setLocation(e.target.value as LocationKey)}><option value="camapua">CAMAPUÃ · MATRIZ</option><option value="newfit">NEWFIT · DEPÓSITO NEWFIT</option></select></div></div>
        <div className="pdv-context"><div><label>VENDEDOR</label><select className="seller-select" value={seller} onChange={e => setSeller(e.target.value)}>{SELLERS.map(name => <option key={name}>{name}</option>)}</select></div></div>
        <button className="pdv-menu-btn" onClick={() => setMenuOpen(v => !v)} aria-label="Abrir menu"><Menu size={19}/></button>
      </div>
      {menuOpen && <nav className="pdv-menu"><button onClick={() => { setCustomerPanel(true); setMenuOpen(false); }}><UserRound size={15}/> CONSULTAR CLIENTE</button><button onClick={() => go('orders')}><ShoppingCart size={15}/> CONSULTAR VENDAS</button><button onClick={() => go('nfc')}><FileText size={15}/> CONSULTAR NFC-e</button><button onClick={() => { setOtherStoreOpen(true); setMenuOpen(false); }}><Search size={15}/> CONSULTAR ESTOQUE</button><button onClick={() => go('closing')}><Banknote size={15}/> FECHAMENTO TOTAL DO CAIXA</button><button onClick={() => { go('closing'); setMessage('TROCA DE CAIXA exige pré-fechamento obrigatório.'); }}><span style={{display:'inline-grid',placeItems:'center',width:15,height:15,border:'1px solid currentColor',borderRadius:'50%',fontSize:9}}>↻</span> TROCA DE CAIXA</button></nav>}
    </header>

    {view === 'sale' ? <main className="pdv-main">
      <aside className="pdv-left"><div className="pdv-eyebrow">CLIENTE</div><div className="pdv-client">{customer ? <><div className="pdv-client-main"><div className="pdv-avatar"><UserRound size={17}/></div><div><strong>{customer.name}</strong><span>{customer.document}</span></div></div><div className="pdv-client-points">{customer.points?.toLocaleString('pt-BR') || 0} PONTOS DISPONÍVEIS</div><div className="pdv-client-actions"><button className="pdv-ghost" onClick={() => setCustomerPanel(true)}>CONSULTAR</button><button className="pdv-ghost" onClick={() => setCustomer(null)}>TROCAR</button></div></> : <><div className="pdv-client-main"><div className="pdv-avatar"><UserRound size={17}/></div><div><strong>Venda sem cliente</strong><span>Identifique para Pontos</span></div></div><button className="pdv-ghost" style={{width:'100%',marginTop:12}} onClick={() => setCustomerPanel(true)}>+ ADICIONAR / CONSULTAR CLIENTE</button></>}</div><div className="pdv-shortcuts"><div className="pdv-eyebrow">ATALHOS</div><div className="pdv-shortcut"><span>Buscar produto</span><kbd>F2</kbd></div><div className="pdv-shortcut"><span>Cliente</span><kbd>F3</kbd></div><div className="pdv-shortcut"><span>Finalizar venda</span><kbd>F8</kbd></div><div className="pdv-shortcut"><span>Fechar painel</span><kbd>ESC</kbd></div></div><div className="pdv-session"><label>OPERAÇÃO ATUAL</label><strong>{seller}</strong><span>{config.label} · {config.stock}</span><div className="pdv-seller-list"><div className="pdv-eyebrow">VENDEDORES</div>{SELLERS.map(name => <button key={name} className={`pdv-seller-option ${seller === name ? 'active' : ''}`} onClick={() => assumeSeller(name)}><span>{name}</span>{seller === name && <small>EM OPERAÇÃO</small>}</button>)}</div></div></aside>
      <section className="pdv-center"><div className="pdv-search"><Search size={17} color="#77736c"/><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar produto por nome, código ou EAN..."/><span style={{fontSize:8,color:'#aaa'}}>ENTER não é necessário</span></div><div className="pdv-search-hint"><span>{query ? `${visibleProducts.length} produto(s) encontrado(s)` : 'Digite qualquer parte do nome ou código para localizar rapidamente'}</span><div className="pdv-sort"><button className={sortMode === 'az' ? 'active' : ''} onClick={() => setSortMode('az')}>A-Z</button><button className={sortMode === 'sku' ? 'active' : ''} onClick={() => setSortMode('sku')}>SKU</button><b>{query ? 'Busca inteligente ativa' : <>CATÁLOGO BLING {catalogState !== 'live' && catalogState !== 'loading' && <span className={`pdv-sync-status ${catalogState}`}>{catalogState === 'offline' ? 'MODO OFFLINE' : 'CÓPIA SEGURA'}</span>}</>}</b></div></div><div className="pdv-product-list">{visibleProducts.map(p => { const localStock = p.stockByLocation[location]; return <button className="pdv-product" key={p.id} onClick={() => add(p)} disabled={localStock <= 0}>{p.image ? <img src={p.image} alt=""/> : <div className="noimg">CAPITÃO</div>}<span className="pdv-product-sku">SKU {p.code || '—'}</span><strong>{p.name}</strong><div className="pdv-product-meta"><span className="pdv-product-price">{money(p.price)}</span><span className="pdv-stock">{localStock > 0 ? `${localStock} em estoque` : 'SEM ESTOQUE NESTA LOJA'}</span></div></button>})}</div>{!visibleProducts.length && <div className="pdv-empty">Nenhum produto encontrado. Tente outra palavra, código ou EAN.</div>}</section>
      <aside className="pdv-right"><div className="pdv-cart"><div className="pdv-cart-head"><div className="pdv-eyebrow">VENDA ATUAL</div><span className="pdv-count">{itemCount} {itemCount === 1 ? 'ITEM' : 'ITENS'}</span></div><div className="pdv-cart-list">{cart.length ? cart.map(item => <div className="pdv-cart-item" key={item.id}><div className="pdv-cart-row"><div className="pdv-cart-main"><div className="pdv-cart-thumb">{item.image ? <img src={item.image} alt=""/> : <div className="noimg">CAPITÃO</div>}</div><div className="pdv-cart-info"><strong>{item.name}</strong><span className="pdv-cart-code">Código: {item.code || '—'}</span></div></div><span className="pdv-cart-item-total">{money(item.price * item.quantity)}</span></div><div className="pdv-cart-sub"><span>{money(item.price)} cada</span><div className="pdv-step"><button onClick={() => changeQty(item.id,-1)} aria-label="Diminuir"><Minus size={12}/></button><b>{item.quantity}</b><button onClick={() => changeQty(item.id,1)} aria-label="Aumentar"><Plus size={12}/></button></div></div><button className="pdv-cart-remove" onClick={() => removeFromCart(item.id)} aria-label={`Remover ${item.name} da venda`}><Trash2 size={12}/> REMOVER</button></div>) : <div className="pdv-empty">Adicione produtos para iniciar a venda.</div>}</div><div className="pdv-summary"><div className="pdv-summary-line"><span>Itens</span><b>{itemCount}</b></div><div className="pdv-summary-line"><span>Subtotal</span><b>{money(total)}</b></div><div className="pdv-summary-total"><span>TOTAL DA VENDA</span><strong>{money(total)}</strong></div></div><div className="pdv-payment-wrap"><div className="pdv-payment-head"><div className="pdv-eyebrow">PAGAMENTO</div><span className="pdv-payment-current">{paymentLabel || 'Selecione uma forma'}</span></div><div className="pdv-payment-grid">{payments.filter(p => !p.id.startsWith('credit')).map(p => <button className={`pdv-payment ${selectedPayment === p.id ? 'selected' : ''}`} key={p.id} onClick={() => setSelectedPayment(p.id)}><span className="pdv-payment-icon">{paymentIcon(p.icon)}</span><span><b>{p.label.replace('CARTÃO ', '')}</b><small>{p.account}</small></span></button>)}<button className={`pdv-payment ${selectedPayment.startsWith('credit') ? 'selected' : ''}`} onClick={() => setSelectedPayment(`credit${creditInstallment}`)}><span className="pdv-payment-icon"><CreditCard size={17}/></span><span><b>CARTÃO CRÉDITO</b><small>Escolher parcelas</small></span></button></div>{selectedPayment.startsWith('credit') && <div className="pdv-installments">{['1','2','3'].map(n => <button key={n} className={creditInstallment === n ? 'selected' : ''} onClick={() => { setCreditInstallment(n); setSelectedPayment(`credit${n}`); }}>{n}X</button>)}</div>}</div><div className="pdv-points"><Sparkles size={16} className="pdv-points-icon"/><div><strong>CAPITÃO PONTOS</strong><span>{customer ? 'Cliente identificado. Pontos disponíveis na venda.' : 'Identifique o cliente para utilizar pontos.'}</span></div></div><button className="pdv-finalize" disabled={!cart.length || !selectedPayment} onClick={() => setShowFinalize(true)}>FINALIZAR VENDA · {money(total)}</button></div></aside>
    </main> : view === 'closing' && closingStep === 'form' ? <section className="pdv-page"><div className="pdv-page-head"><button className="pdv-back" onClick={() => go('sale')}><ArrowLeft size={14}/> VOLTAR</button><div><h1>Fechamento do caixa</h1><span style={{fontSize:8,color:'#777b80'}}>{config.label} · {seller} · pré-fechamento obrigatório para troca de caixa</span></div></div><div className="pdv-closing-grid"><div className="pdv-card"><div className="pdv-eyebrow">VALORES VENDIDOS PELO SISTEMA</div>{soldByPayment.map(p => <div className="pdv-closing-line" key={p.id}><div><strong>{p.label}</strong><b>{money(p.sold)}</b></div><small>{p.account}</small></div>)}<div className="pdv-closing-total"><div><span>TOTAL VENDIDO</span><b>{money(expectedTotal)}</b></div></div></div><div className="pdv-card"><div className="pdv-eyebrow">VALORES RECEBIDOS</div>{soldByPayment.map(p => { const received = Number(String(closingReceived[p.id] || '').replace(',','.')) || 0; const ok = Math.abs(p.sold - received) < .005; return <div className="pdv-closing-line" key={p.id}><div><strong>{p.label}</strong><input inputMode="decimal" placeholder="R$ 0,00" value={closingReceived[p.id] || ''} onChange={e => setClosingReceived(v => ({...v,[p.id]:e.target.value}))}/></div><small>{p.account} · esperado {money(p.sold)}</small><div className={`pdv-check ${ok ? 'ok' : 'bad'}`}>{ok ? <><Check size={13}/> VALOR CONFERE</> : <><X size={13}/> DIVERGÊNCIA · {money(Math.abs(p.sold-received))}</>}</div></div>})}<div className="pdv-closing-total"><div><span>TOTAL ESPERADO</span><b>{money(expectedTotal)}</b></div><div><span>TOTAL RECEBIDO</span><b>{money(receivedTotal)}</b></div><div><span>DIFERENÇA</span><strong className={Math.abs(expectedTotal-receivedTotal)<.005?'ok':'bad'}>{money(receivedTotal-expectedTotal)}</strong></div></div><button className="pdv-finalize" disabled={!allClosingOk} onClick={() => setClosingStep('message')}>CONFERIR E ENCERRAR CAIXA</button></div></div></section> : view === 'closing' && closingStep === 'message' ? <section className="pdv-page"><div className="pdv-page-head"><button className="pdv-back" onClick={() => go('sale')}><ArrowLeft size={14}/> VOLTAR</button></div><div className="pdv-message"><div className="char">⚓</div><div style={{color:'#bd9149',fontSize:8,fontWeight:900,letterSpacing:2}}>ASSUMA O COMANDO</div><blockquote>{[...KLAUS,...REBECA][Math.floor(Math.random()*12)]}</blockquote><button onClick={() => { setClosingReceived({}); setView('sale'); setClosingStep('form'); setMessage('Caixa encerrado.'); }}>ABRIR NOVO CAIXA</button></div></section> : <section className="pdv-page"><div className="pdv-page-head"><button className="pdv-back" onClick={() => go('sale')}><ArrowLeft size={14}/> VOLTAR</button><h1>{view === 'orders' ? 'Consultar vendas' : view === 'nfc' ? 'Consultar NFC-e' : 'Consulta'}</h1></div><div className="pdv-card"><div className="pdv-search" style={{background:'#181a1b',borderColor:'#34373a'}}><Search size={16}/><input value={orderSearch} onChange={e=>setOrderSearch(e.target.value)} placeholder={view === 'orders' ? 'Buscar pedido, cliente ou CPF...' : 'Buscar número da NFC-e...'}/></div><div className="pdv-empty">A consulta será carregada diretamente do Bling. O histórico não será apagado pelo PDV.</div></div></section>}

    {otherStoreOpen && <div className="pdv-overlay" onMouseDown={() => setOtherStoreOpen(false)}><aside className="pdv-stock-drawer" onMouseDown={e => e.stopPropagation()}><div className="pdv-drawer-head"><div><div className="pdv-eyebrow">CONSULTA DE ESTOQUE</div><h2>Consultar disponibilidade</h2></div><button className="pdv-close" onClick={() => setOtherStoreOpen(false)}><X size={22}/></button></div><p style={{fontSize:9,color:'#7d8287',lineHeight:1.5}}>Você está operando no <b style={{color:'#e9e7e2'}}>{config.stock}</b>. Consulte o saldo do depósito atual e, quando necessário, compare com o estoque da outra loja.</p><div className="pdv-stock-search pdv-search" style={{background:'#181a1b',borderColor:'#34373a'}}><Search size={16}/><input value={otherStoreQuery} onChange={e=>setOtherStoreQuery(e.target.value)} placeholder="Buscar por nome, SKU ou EAN..."/></div><div className="pdv-stock-results">{otherStoreProducts.map(p => <div className="pdv-stock-row" key={p.id}><div className="pdv-stock-thumb">{p.image ? <img src={p.image} alt="" /> : <div className="noimg">CAPITÃO</div>}</div><div className="pdv-stock-info"><strong>{p.name}</strong><small>SKU: {p.code || '—'}</small></div><div className="pdv-stock-location"><label>NEWFIT</label><b>{p.stockByLocation.newfit}</b></div><div className="pdv-stock-location other"><label>CAMAPUÃ</label><b>{p.stockByLocation.camapua}</b></div></div>)}{!otherStoreProducts.length && <div className="pdv-stock-empty">Nenhum produto encontrado.</div>}</div></aside></div>}

    {customerPanel && <div className="pdv-overlay" onMouseDown={() => setCustomerPanel(false)}><aside className="pdv-drawer" onMouseDown={e => e.stopPropagation()}><div className="pdv-drawer-head"><div><div className="pdv-eyebrow">CLIENTE</div><h2>Consultar cliente</h2></div><button className="pdv-close" onClick={() => setCustomerPanel(false)}><X size={22}/></button></div><p style={{fontSize:9,color:'#7d8287',lineHeight:1.5,marginBottom:20}}>Identifique o cliente para vincular a venda e preparar o uso do Capitão Pontos.</p><div className="pdv-form"><label>NOME COMPLETO<input placeholder="Nome completo" value={customerForm.name} onChange={e=>setCustomerForm(v=>({...v,name:e.target.value}))}/></label><label>CPF / CNPJ<input placeholder="CPF/CNPJ" value={customerForm.document} onChange={e=>setCustomerForm(v=>({...v,document:e.target.value}))}/></label><label>TELEFONE<input placeholder="Telefone" value={customerForm.phone} onChange={e=>setCustomerForm(v=>({...v,phone:e.target.value}))}/></label><label>E-MAIL<input placeholder="E-mail" value={customerForm.email} onChange={e=>setCustomerForm(v=>({...v,email:e.target.value}))}/></label><button onClick={saveCustomer}>VINCULAR CLIENTE À VENDA</button></div></aside></div>}
    {showFinalize && <div className="pdv-overlay"><div className="pdv-finalize-modal"><button className="pdv-close" style={{float:'right'}} onClick={()=>setShowFinalize(false)}><X/></button><div className="pdv-eyebrow">FINALIZAÇÃO</div><div className="pdv-modal-title">Como deseja emitir?</div><div className="pdv-modal-copy">Escolha entre NFC-e fiscal ou comprovante de venda.</div><div className="pdv-docs"><button className={`pdv-doc ${documentChoice==='nfc'?'selected':''}`} onClick={()=>setDocumentChoice('nfc')}><FileText size={21}/><strong>NFC-e</strong><span>Emitir documento fiscal ao consumidor</span></button><button className={`pdv-doc ${documentChoice==='receipt'?'selected':''}`} onClick={()=>setDocumentChoice('receipt')}><ShoppingCart size={21}/><strong>Comprovante</strong><span>Somente comprovante da venda</span></button></div><div className="pdv-actions"><button onClick={()=>setShowFinalize(false)}>VOLTAR</button><button className="primary" disabled={!documentChoice} onClick={finishSale}>FINALIZAR</button></div></div></div>}
    {message && <div className="pdv-toast" onClick={()=>setMessage('')}>{message}</div>}
  </div>;
}

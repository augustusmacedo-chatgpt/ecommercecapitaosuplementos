import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, Image as ImageIcon, RefreshCw, Save, Settings2, ShoppingBag, SlidersHorizontal, Zap } from 'lucide-react';

type PreviewProduct = { name: string; brand: string; price: string; image?: string };
type BlingApiProduct = { id?: number; nome?: string; descricao?: string; descricaoCurta?: string; preco?: number; imagemURL?: string; imagens?: Array<{ link?: string; url?: string }>; categoria?: { nome?: string } };

const mockProducts: PreviewProduct[] = [
  { name: 'Creatina 300g', brand: 'Produto Bling', price: 'R$ 00,00' },
  { name: 'Whey Protein 1kg', brand: 'Produto Bling', price: 'R$ 00,00' },
  { name: 'Pré-Treino 300g', brand: 'Produto Bling', price: 'R$ 00,00' },
  { name: 'Termogênico 60 caps', brand: 'Produto Bling', price: 'R$ 00,00' },
];

function formatBlingPrice(value?: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'Consultar';
}

function toPreviewProduct(product: BlingApiProduct): PreviewProduct {
  const image = product.imagemURL || product.imagens?.find(item => item.link)?.link || product.imagens?.find(item => item.url)?.url;
  return { name: product.nome || product.descricao || product.descricaoCurta || 'Produto Bling', brand: product.categoria?.nome || 'Bling', price: formatBlingPrice(product.preco), image };
}

const redirectUrl = 'https://ecommercecapitaosuplementos.vercel.app/api/bling/callback';

async function readJson(response: Response) {
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text || `HTTP ${response.status}` }; }
  if (!response.ok) throw new Error(data.error || `Erro HTTP ${response.status}`);
  return data;
}

export default function Admin() {
  const [fit, setFit] = useState<'contain' | 'cover'>('contain');
  const [background, setBackground] = useState<'white' | 'soft' | 'dark'>('white');
  const [connected, setConnected] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [error, setError] = useState('');
  const [showClientId, setShowClientId] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [secretConfigured, setSecretConfigured] = useState(false);
  const [blingProducts, setBlingProducts] = useState<PreviewProduct[]>([]);
  const [catalogTotal, setCatalogTotal] = useState<number | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const clientIdInputRef = useRef<HTMLInputElement>(null);
  const clientSecretInputRef = useRef<HTMLInputElement>(null);
  const inviteLinkInputRef = useRef<HTMLInputElement>(null);

  const mediaClass = useMemo(() => `admin-product-media fit-${fit} bg-${background}`, [fit, background]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoadingConfig(true);
      setError('');
      try {
        const configResponse = await fetch('/api/bling/config', { cache: 'no-store' });
        const config = await readJson(configResponse);
        if (!active) return;
        setClientId(config.clientId || '');
        setInviteLink(config.inviteLink || '');
        setSecretConfigured(Boolean(config.secretConfigured));
        setConfigured(Boolean(config.configured));

        try {
          const statusResponse = await fetch('/api/bling/status', { cache: 'no-store' });
          const status = await readJson(statusResponse);
          const isConnected = Boolean(status.connected);
          if (active) setConnected(isConnected);
          if (isConnected) {
            try {
              const productsResponse = await fetch('/api/bling/products?pagina=1&limite=100&todos=1', { cache: 'no-store' });
              const productsData = await readJson(productsResponse);
              if (active) {
                const returnedProducts = Array.isArray(productsData.products) ? productsData.products : [];
                setCatalogTotal(Number(productsData.total ?? returnedProducts.length));
                setBlingProducts(returnedProducts.slice(0, 4).map(toPreviewProduct));
                setCatalogError('');
              }
            } catch (productError) {
              if (active) setCatalogError(productError instanceof Error ? productError.message : 'Não foi possível carregar o catálogo do Bling.');
            }
          } else if (active) {
            setBlingProducts([]);
          }
        } catch {
          if (active) setConnected(false);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar a configuração do Bling.');
      } finally {
        if (active) setLoadingConfig(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  async function saveConfiguration() {
    setError('');
    // Password managers/autofill may update the DOM without firing React's onChange.
    // Read the live input values so the payload cannot be empty while the fields look filled.
    const currentClientId = clientIdInputRef.current?.value ?? clientId;
    const currentClientSecret = clientSecretInputRef.current?.value ?? clientSecret;
    const currentInviteLink = inviteLinkInputRef.current?.value ?? inviteLink;
    setClientId(currentClientId);
    setClientSecret(currentClientSecret);
    setInviteLink(currentInviteLink);
    if (!currentClientId.trim()) {
      setError('Informe o Client ID.');
      return;
    }
    if (!currentClientSecret.trim() && !secretConfigured) {
      setError('Informe o Client Secret.');
      return;
    }
    try {
      const response = await fetch('/api/bling/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: currentClientId, clientSecret: currentClientSecret, inviteLink: currentInviteLink }),
      });
      const data = await readJson(response);
      setConfigured(Boolean(data.configured));
      setSecretConfigured(Boolean(data.secretConfigured));
      setClientSecret('');
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a configuração.');
    }
  }

  function connectBling() {
    setError('');
    if (!configured) {
      setError('Salve as credenciais do Bling antes de conectar.');
      return;
    }
    setConnecting(true);
    window.location.href = '/api/bling/authorize';
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <span className="admin-eyebrow">CAPITÃO SUPLEMENTOS</span>
          <h1>Painel de Administração</h1>
          <p>Centro de controle do catálogo, integração e apresentação dos produtos.</p>
        </div>
        <a className="admin-back" href="/">← Voltar para a loja</a>
      </header>

      <main className="admin-main">
        <section className="admin-panel bling-config-panel">
          <div className="bling-config-heading">
            <div className="panel-icon"><Zap size={20} /></div>
            <div>
              <span className="panel-label">INTEGRAÇÃO</span>
              <h2>Configuração do Bling ERP</h2>
              <p>Cadastre aqui as credenciais do aplicativo criado no Bling. Os campos sensíveis ficam protegidos por padrão.</p>
            </div>
            <div className={`connection-state ${connected ? 'online' : ''}`}><span />{connected ? 'Conectado' : configured ? 'Configurado' : 'Não configurado'}</div>
          </div>

          <div className="bling-fields">
            <div className="bling-field">
              <label>Client ID</label>
              <div className="bling-input-wrap">
                <input ref={clientIdInputRef} type={showClientId ? 'text' : 'password'} value={clientId} onChange={e => setClientId(e.target.value)} placeholder={loadingConfig ? 'Carregando...' : 'Informe o Client ID'} autoComplete="off" />
                <button type="button" aria-label={showClientId ? 'Ocultar Client ID' : 'Mostrar Client ID'} onClick={() => setShowClientId(v => !v)}>{showClientId ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </div>

            <div className="bling-field">
              <label>Client Secret</label>
              <div className="bling-input-wrap">
                <input ref={clientSecretInputRef} type={showSecret ? 'text' : 'password'} value={clientSecret} onChange={e => setClientSecret(e.target.value)} placeholder={secretConfigured ? '•••••••••••••••••••••••••••••••' : 'Informe o Client Secret'} autoComplete="new-password" />
                <button type="button" aria-label={showSecret ? 'Ocultar Client Secret' : 'Mostrar Client Secret'} onClick={() => setShowSecret(v => !v)}>{showSecret ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </div>

            <div className="bling-field bling-field-wide">
              <label>Link de convite</label>
              <input ref={inviteLinkInputRef} value={inviteLink} onChange={e => setInviteLink(e.target.value)} placeholder="https://www.bling.com.br/..." autoComplete="off" />
            </div>

            <div className="bling-field bling-field-wide">
              <label>Link de redirecionamento <span>🔒</span></label>
              <div className="bling-readonly-wrap">
                <input value={redirectUrl} readOnly />
                <span>Definida pelo sistema</span>
              </div>
            </div>
          </div>

          {error && <p className="bling-config-error">⚠️ {error}</p>}

          <div className="bling-config-footer">
            <p><span>🔒</span> O Client Secret é armazenado de forma protegida e nunca é devolvido ao navegador em texto aberto.</p>
            <button className="admin-primary" onClick={saveConfiguration} disabled={loadingConfig}>
              <Save size={15} /> {saved ? 'Configuração salva' : 'Salvar configuração'}
            </button>
          </div>
        </section>

        <section className="admin-status-grid">
          <article className="admin-panel bling-panel">
            <div className="panel-icon"><Zap size={20} /></div>
            <div className="panel-copy">
              <span className="panel-label">CONEXÃO</span>
              <h2>Bling OAuth</h2>
              <p>{connected ? 'Aplicativo autorizado. A conexão agora usa OAuth 2.0 com JWT no servidor.' : 'Salve as credenciais e autorize a aplicação na sua conta Bling.'}</p>
            </div>
            <div className={`connection-state ${connected ? 'online' : ''}`}><span />{connected ? 'Conectado' : 'Aguardando'}</div>
            <button className="admin-primary" onClick={connectBling} disabled={connecting || loadingConfig}>
              {connecting ? <RefreshCw size={16} className="spin" /> : <Zap size={16} />}
              {connecting ? 'Abrindo Bling...' : connected ? 'Reconectar Bling' : 'Conectar Bling'}
            </button>
          </article>

          <article className="admin-panel">
            <div className="panel-icon"><ShoppingBag size={20} /></div>
            <div className="panel-copy">
              <span className="panel-label">CATÁLOGO</span>
              <h2>Produtos</h2>
              <p>{catalogError || (blingProducts.length ? `Prévia dos produtos reais carregados do catálogo completo do Bling (${catalogTotal} no total).` : 'Prévia de como os produtos sincronizados serão apresentados na loja.')}</p>
            </div>
            <div className="admin-stat"><strong>{connected ? (catalogTotal === null ? '…' : catalogTotal) : '—'}</strong><span>produtos sincronizados</span></div>
          </article>
        </section>

        <section className="admin-panel preview-panel">
          <div className="preview-head">
            <div>
              <span className="panel-label">LABORATÓRIO VISUAL</span>
              <h2>Como o produto vai aparecer?</h2>
              <p>Vamos resolver aqui o enquadramento das imagens antes de colocar qualquer produto real na vitrine.</p>
            </div>
            <div className="preview-controls">
              <label><SlidersHorizontal size={15} /> Enquadramento
                <select value={fit} onChange={e => setFit(e.target.value as 'contain' | 'cover')}>
                  <option value="contain">Produto inteiro</option>
                  <option value="cover">Preencher quadro</option>
                </select>
              </label>
              <label><ImageIcon size={15} /> Fundo
                <select value={background} onChange={e => setBackground(e.target.value as 'white' | 'soft' | 'dark')}>
                  <option value="white">Branco</option>
                  <option value="soft">Cinza suave</option>
                  <option value="dark">Escuro</option>
                </select>
              </label>
            </div>
          </div>

          <div className="admin-product-grid">
            {(blingProducts.length ? blingProducts : mockProducts).map(product => (
              <article className="admin-product-card" key={product.name}>
                  <div className={mediaClass}>
                  {product.image ? <img className="bling-original-image" src={product.image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: fit }} /> : <div className="admin-image-placeholder"><ImageIcon size={27} /><span>IMAGEM DO BLING</span><small>prévia do enquadramento</small></div>}
                </div>
                <div className="admin-product-info">
                  <span>{product.brand}</span>
                  <h3>{product.name}</h3>
                  <strong>{product.price}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-panel roadmap-panel">
          <div className="panel-icon"><Settings2 size={20} /></div>
          <div className="panel-copy">
            <span className="panel-label">PRÓXIMA ETAPA</span>
            <h2>Catálogo real do Bling</h2>
            <p>OAuth concluído. O próximo passo é consultar os produtos reais e preencher o laboratório visual com imagens, preços e estoque.</p>
          </div>
          <div className="roadmap-steps">
            <span className="done"><CheckCircle2 size={15} /> Painel</span>
            <span className="done"><CheckCircle2 size={15} /> OAuth</span>
            <span>Produtos</span>
            <span>Imagens</span>
            <span>Estoque</span>
          </div>
        </section>
      </main>
    </div>
  );
}

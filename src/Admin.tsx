import { useMemo, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, Image as ImageIcon, RefreshCw, Save, Settings2, ShoppingBag, SlidersHorizontal, Zap } from 'lucide-react';

const mockProducts = [
  { name: 'Creatina 300g', brand: 'Produto Bling', price: 'R$ 00,00' },
  { name: 'Whey Protein 1kg', brand: 'Produto Bling', price: 'R$ 00,00' },
  { name: 'Pré-Treino 300g', brand: 'Produto Bling', price: 'R$ 00,00' },
  { name: 'Termogênico 60 caps', brand: 'Produto Bling', price: 'R$ 00,00' },
];

const redirectUrl = 'https://ecommercecapitaosuplementos.vercel.app/api/bling/callback';

export default function Admin() {
  const [fit, setFit] = useState<'contain' | 'cover'>('contain');
  const [background, setBackground] = useState<'white' | 'soft' | 'dark'>('white');
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showClientId, setShowClientId] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  const mediaClass = useMemo(() => `admin-product-media fit-${fit} bg-${background}`, [fit, background]);

  function saveConfiguration() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  function simulateSync() {
    setSyncing(true);
    window.setTimeout(() => {
      setSyncing(false);
      setConnected(true);
    }, 900);
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
            <div className={`connection-state ${connected ? 'online' : ''}`}><span />{connected ? 'Conectado' : 'Não conectado'}</div>
          </div>

          <div className="bling-fields">
            <div className="bling-field">
              <label>Client ID</label>
              <div className="bling-input-wrap">
                <input type={showClientId ? 'text' : 'password'} value={clientId} onChange={e => setClientId(e.target.value)} placeholder="Informe o Client ID" autoComplete="off" />
                <button type="button" aria-label={showClientId ? 'Ocultar Client ID' : 'Mostrar Client ID'} onClick={() => setShowClientId(v => !v)}>{showClientId ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </div>

            <div className="bling-field">
              <label>Client Secret</label>
              <div className="bling-input-wrap">
                <input type={showSecret ? 'text' : 'password'} value={clientSecret} onChange={e => setClientSecret(e.target.value)} placeholder="Informe o Client Secret" autoComplete="new-password" />
                <button type="button" aria-label={showSecret ? 'Ocultar Client Secret' : 'Mostrar Client Secret'} onClick={() => setShowSecret(v => !v)}>{showSecret ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </div>

            <div className="bling-field bling-field-wide">
              <label>Link de convite</label>
              <input value={inviteLink} onChange={e => setInviteLink(e.target.value)} placeholder="https://www.bling.com.br/..." autoComplete="off" />
            </div>

            <div className="bling-field bling-field-wide">
              <label>Link de redirecionamento <span>🔒</span></label>
              <div className="bling-readonly-wrap">
                <input value={redirectUrl} readOnly />
                <span>Definida pelo sistema</span>
              </div>
            </div>
          </div>

          <div className="bling-config-footer">
            <p><span>🔒</span> O Client Secret não será exibido em texto aberto no painel.</p>
            <button className="admin-primary" onClick={saveConfiguration}>
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
              <p>{connected ? 'Conexão simulada pronta para receber o OAuth do Bling.' : 'Depois de salvar as credenciais, o próximo passo será autorizar a aplicação no Bling.'}</p>
            </div>
            <div className={`connection-state ${connected ? 'online' : ''}`}><span />{connected ? 'Conectado' : 'Aguardando'}</div>
            <button className="admin-primary" onClick={simulateSync} disabled={syncing}>
              {syncing ? <RefreshCw size={16} className="spin" /> : <Zap size={16} />}
              {syncing ? 'Testando...' : connected ? 'Testar conexão' : 'Conectar Bling'}
            </button>
          </article>

          <article className="admin-panel">
            <div className="panel-icon"><ShoppingBag size={20} /></div>
            <div className="panel-copy">
              <span className="panel-label">CATÁLOGO</span>
              <h2>Produtos</h2>
              <p>Prévia de como os produtos sincronizados serão apresentados na loja.</p>
            </div>
            <div className="admin-stat"><strong>—</strong><span>produtos sincronizados</span></div>
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
            {mockProducts.map(product => (
              <article className="admin-product-card" key={product.name}>
                <div className={mediaClass}>
                  <div className="admin-image-placeholder"><ImageIcon size={27} /><span>IMAGEM DO BLING</span><small>prévia do enquadramento</small></div>
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
            <h2>Conector real do Bling</h2>
            <p>O painel está preparado para receber o OAuth e, depois, carregar o catálogo real. A autenticação ficará no servidor.</p>
          </div>
          <div className="roadmap-steps">
            <span className="done"><CheckCircle2 size={15} /> Painel</span>
            <span>OAuth</span>
            <span>Produtos</span>
            <span>Imagens</span>
            <span>Estoque</span>
          </div>
        </section>
      </main>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Clock3, PackageCheck, RefreshCw, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';

type OrderItem = { id?: number; produtoId?: number; descricao: string; quantidade: number; valor: number; total: number };
type OrderData = { id: number; numero?: number; data?: string | null; total: number; situacao?: { id?: number; valor?: string | number } | null; loja?: { id?: number; nome?: string } | null; vendedor?: { id?: number; nome?: string } | null; itens: OrderItem[] };

const LAST_ORDER_KEY = 'capitao-last-order';
const CHECKOUT_ID_KEY = 'capitao-checkout-id';

function money(value: number) { return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function statusText(order: OrderData) { return String(order.situacao?.valor ?? 'Em aberto').trim() || 'Em aberto'; }
function stage(order: OrderData) {
  const value = statusText(order).toLowerCase();
  if (value.includes('cancel')) return 'cancelled';
  if (value.includes('conclu') || value.includes('atendid') || value.includes('separad')) return 'ready';
  if (value.includes('separa') || value.includes('andamento')) return 'separating';
  return 'received';
}

export default function OrderPage() {
  const [order, setOrder] = useState<OrderData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const checkoutId = useMemo(() => sessionStorage.getItem(CHECKOUT_ID_KEY) || '', []);
  const load = useCallback(async () => {
    if (!checkoutId) { setError('Não encontramos o pedido nesta sessão.'); setLoading(false); return; }
    try {
      const response = await fetch(`/api/bling/order-status?checkoutId=${encodeURIComponent(checkoutId)}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível consultar o pedido.');
      setOrder(data as OrderData); setUpdatedAt(new Date()); setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível consultar o pedido.');
    } finally { setLoading(false); }
  }, [checkoutId]);

  useEffect(() => { load(); const timer = window.setInterval(load, 15000); return () => window.clearInterval(timer); }, [load]);

  const currentStage = order ? stage(order) : 'received';
  const itemTotal = order?.itens?.reduce((sum, item) => sum + item.total, 0) || 0;

  return <main className="order-page"><style>{styles}</style>
    <header className="order-top"><a href="/" className="order-logo"><img src="/Logo_Capitao_Esportivo.png" alt="Capitão Suplementos" /></a><div className="order-secure"><ShieldCheck size={17}/> ACOMPANHAMENTO SEGURO</div></header>
    <a href="/" className="order-back"><ArrowLeft size={17}/> VOLTAR PARA A COMPRA</a>

    {loading ? <section className="order-card center"><RefreshCw className="spin" size={30}/><h1>Consultando seu pedido...</h1><p>Estamos buscando a atualização mais recente no Bling.</p></section> : error ? <section className="order-card center"><PackageCheck size={38}/><span className="eyebrow">ACOMPANHAMENTO</span><h1>Não foi possível carregar o pedido.</h1><p>{error}</p><button className="order-primary" onClick={load}>TENTAR NOVAMENTE</button></section> : order ? <>
      <section className="order-heading"><span className="eyebrow">PEDIDO #{order.numero || order.id}</span><h1>Seu pedido</h1><p>Acompanhe aqui o andamento da sua compra. A atualização é feita automaticamente.</p></section>
      <section className="status-card">
        <div className={`status-icon ${currentStage}`}>
          {currentStage === 'ready' ? <PackageCheck size={28}/> : currentStage === 'separating' ? <ShoppingBag size={28}/> : currentStage === 'cancelled' ? <Clock3 size={28}/> : <Clock3 size={28}/>} 
        </div>
        <div className="status-copy"><span className="eyebrow">STATUS ATUAL</span><h2>{currentStage === 'ready' ? 'PEDIDO SEPARADO — AGUARDANDO PARA ENTREGA' : currentStage === 'separating' ? 'PEDIDO EM SEPARAÇÃO' : currentStage === 'cancelled' ? 'PEDIDO CANCELADO' : 'PEDIDO RECEBIDO'}</h2><p>O Bling informa: <strong>{statusText(order)}</strong></p></div>
      </section>

      {currentStage !== 'cancelled' && <section className="timeline"><div className={`step ${['received','separating','ready'].includes(currentStage) ? 'done' : ''}`}><div><Check size={15}/></div><span>PEDIDO RECEBIDO</span></div><div className={`line ${['separating','ready'].includes(currentStage) ? 'done' : ''}`}/><div className={`step ${['separating','ready'].includes(currentStage) ? 'done' : ''}`}><div><ShoppingBag size={15}/></div><span>EM SEPARAÇÃO</span></div><div className={`line ${currentStage === 'ready' ? 'done' : ''}`}/><div className={`step ${currentStage === 'ready' ? 'done' : ''}`}><div><PackageCheck size={15}/></div><span>SEPARADO / AGUARDANDO ENTREGA</span></div></section>}

      <section className="order-card"><div className="card-head"><div><span className="eyebrow">ITENS DO PEDIDO</span><h2>Produtos</h2></div><span className="order-number">#{order.numero || order.id}</span></div><div className="items">{order.itens.map((item, index) => <div className="item" key={`${item.id || item.produtoId || item.descricao}-${index}`}><div className="item-icon"><ShoppingBag size={18}/></div><div className="item-info"><strong>{item.descricao}</strong><span>{item.quantidade} {item.quantidade === 1 ? 'unidade' : 'unidades'} × {money(item.valor)}</span></div><strong>{money(item.total)}</strong></div>)}</div><div className="total-row"><span>TOTAL DO PEDIDO</span><strong>{money(order.total || itemTotal)}</strong></div></section>

      <section className="delivery-note"><Truck size={20}/><div><strong>Pagamento e entrega</strong><p>O pagamento será realizado somente no momento da entrega, conforme combinado no pedido.</p></div></section>
      <div className="refresh-note"><RefreshCw size={13}/> Atualizado automaticamente{updatedAt ? ` às ${updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}</div>
    </> : null}
  </main>;
}

const styles = `
.order-page{min-height:100vh;background:#f8f8f7;color:#111;padding:28px 22px 60px;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.order-top{max-width:1040px;margin:0 auto 16px;display:flex;align-items:center;justify-content:space-between}.order-logo img{width:170px;max-width:42vw;height:auto;display:block}.order-secure{font-size:12px;letter-spacing:.14em;font-weight:700;color:#b57d18;display:flex;align-items:center;gap:7px}.order-back{max-width:1040px;margin:0 auto 28px;display:flex;align-items:center;gap:8px;border:1px solid #d7d7d7;border-radius:6px;padding:15px 18px;text-decoration:none;color:#111;background:#fff;font-size:14px;font-weight:700}.order-heading{max-width:820px;margin:0 auto 24px;text-align:center}.eyebrow{font-size:12px;letter-spacing:.2em;color:#b57d18;font-weight:800}.order-heading h1{font-size:clamp(34px,6vw,58px);margin:9px 0 10px;letter-spacing:-.04em}.order-heading p,.order-card p,.status-copy p{color:#6c6c6c;font-size:16px;line-height:1.6;margin:0}.status-card,.order-card,.delivery-note{max-width:820px;margin:0 auto 18px;background:#fff;border:1px solid #e2e2e2;border-radius:10px;box-shadow:0 8px 25px rgba(0,0,0,.035)}.status-card{padding:24px;display:flex;align-items:center;gap:18px}.status-icon{width:58px;height:58px;flex:0 0 58px;border-radius:50%;display:grid;place-items:center;background:#f4ead6;color:#b57d18}.status-icon.separating{background:#eee;color:#111}.status-icon.ready{background:#e4f4e9;color:#1f7a43}.status-icon.cancelled{background:#f7e5e5;color:#a72b2b}.status-copy h2{margin:4px 0 6px;font-size:18px;line-height:1.3}.timeline{max-width:820px;margin:0 auto 22px;display:grid;grid-template-columns:auto 1fr auto 1fr auto;align-items:start;gap:8px}.step{text-align:center;font-size:10px;font-weight:800;letter-spacing:.08em;color:#999;max-width:130px}.step>div{width:34px;height:34px;margin:0 auto 7px;border:1px solid #d8d8d8;border-radius:50%;display:grid;place-items:center}.step.done{color:#222}.step.done>div{background:#b57d18;color:#fff;border-color:#b57d18}.line{height:1px;background:#ddd;margin-top:17px}.line.done{background:#b57d18}.order-card{padding:24px}.center{text-align:center;padding:55px 25px}.center h1{font-size:28px;margin:16px 0 8px}.center p{max-width:560px;margin:0 auto 22px}.spin{animation:spin 1s linear infinite}.card-head{display:flex;justify-content:space-between;align-items:end;border-bottom:1px solid #ececec;padding-bottom:16px;margin-bottom:4px}.card-head h2{margin:4px 0 0;font-size:24px}.order-number{font-size:13px;font-weight:800;color:#777}.item{display:grid;grid-template-columns:40px 1fr auto;align-items:center;gap:12px;padding:15px 0;border-bottom:1px solid #eee}.item-icon{width:40px;height:40px;border-radius:7px;background:#f4f4f4;display:grid;place-items:center}.item-info{display:grid;gap:4px}.item-info span{font-size:13px;color:#777}.total-row{display:flex;justify-content:space-between;align-items:center;padding-top:19px;font-size:12px;letter-spacing:.12em;font-weight:800}.total-row strong{font-size:22px;letter-spacing:0}.delivery-note{padding:18px 20px;display:flex;gap:12px;align-items:flex-start;background:#111;color:#fff;border-color:#111}.delivery-note svg{color:#d0a04a;flex:0 0 auto}.delivery-note strong{font-size:14px}.delivery-note p{color:#cfcfcf;margin-top:4px;font-size:13px}.refresh-note{max-width:820px;margin:14px auto;text-align:center;color:#888;font-size:11px;display:flex;justify-content:center;align-items:center;gap:6px}.order-primary{border:0;background:#171717;color:#fff;padding:15px 25px;border-radius:5px;font-weight:800;cursor:pointer}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:640px){.order-page{padding:20px 14px 45px}.order-top{margin-bottom:12px}.order-secure{font-size:9px}.order-back{margin-bottom:22px}.status-card{padding:18px}.status-copy h2{font-size:15px}.timeline{gap:3px}.step{font-size:8px}.step>div{width:30px;height:30px}.line{margin-top:15px}.order-card{padding:18px}.item{grid-template-columns:34px 1fr auto}.item-icon{width:34px;height:34px}.item-info strong{font-size:13px}.item-info span{font-size:11px}.total-row strong{font-size:19px}}
`;

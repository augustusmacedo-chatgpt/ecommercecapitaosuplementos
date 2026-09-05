import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw, Store, TrendingUp } from 'lucide-react';

type StoreReport = { name: string; stock: string; sales: number; total: number; beforeDiscount: number; discount: number; pix: number; cash: number; credit: number; debit: number; bemol: number };

const emptyStore = (name: string, stock: string): StoreReport => ({ name, stock, sales: 0, total: 0, beforeDiscount: 0, discount: 0, pix: 0, cash: 0, credit: 0, debit: 0, bemol: 0 });

function money(value: number) { return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function today() { return new Date().toISOString().slice(0, 10); }

export default function PdvReport() {
  const [date, setDate] = useState(today());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [valueBreakdownAvailable, setValueBreakdownAvailable] = useState(false);
  const [paymentBreakdownAvailable, setPaymentBreakdownAvailable] = useState(false);
  const [stores, setStores] = useState<StoreReport[]>([emptyStore('CAMAPUÃ', 'ESTOQUE MATRIZ'), emptyStore('NEWFIT', 'ESTOQUE NEWFIT')]);

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/bling/pdv-report?data=${encodeURIComponent(date)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o relatório.');
      setStores(Array.isArray(data.stores) ? data.stores : []);
      setValueBreakdownAvailable(Boolean(data.valueBreakdownAvailable));
      setPaymentBreakdownAvailable(Boolean(data.paymentBreakdownAvailable));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar o relatório.');
      setValueBreakdownAvailable(false); setPaymentBreakdownAvailable(false);
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [date]);
  const total = useMemo(() => stores.reduce((s, x) => s + x.total, 0), [stores]);
  const sales = useMemo(() => stores.reduce((s, x) => s + x.sales, 0), [stores]);
  const beforeDiscount = useMemo(() => stores.reduce((s, x) => s + x.beforeDiscount, 0), [stores]);
  const discount = useMemo(() => stores.reduce((s, x) => s + x.discount, 0), [stores]);
  const average = sales ? total / sales : 0;

  return <div className="pdvr-shell">
    <style>{`.pdvr-shell{min-height:100vh;background:#0b0b0b;color:#f5f2ea;font-family:Inter,system-ui,-apple-system,sans-serif;padding:28px}.pdvr-wrap{max-width:1180px;margin:auto}.pdvr-head{display:flex;align-items:center;gap:14px;margin-bottom:24px}.pdvr-back{border:1px solid #38352f;background:#171715;color:#fff;border-radius:8px;padding:10px 13px;cursor:pointer;display:flex;align-items:center;gap:7px;font-weight:800}.pdvr-title h1{font-size:22px;margin:0}.pdvr-title span{font-size:10px;color:#8e8a82;letter-spacing:1.4px}.pdvr-tools{margin-left:auto;display:flex;gap:9px;align-items:center}.pdvr-tools input{background:#171715;border:1px solid #3a3832;color:#fff;border-radius:8px;padding:11px 12px}.pdvr-refresh{border:1px solid #3a3832;background:#171715;color:#fff;border-radius:8px;padding:11px;cursor:pointer}.pdvr-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:22px}.pdvr-kpi{background:#151513;border:1px solid #302e29;border-radius:11px;padding:16px}.pdvr-kpi small{display:block;color:#8e8a82;font-size:9px;letter-spacing:1.1px;font-weight:900}.pdvr-kpi strong{display:block;font-size:21px;margin-top:7px}.pdvr-kpi span{font-size:9px;color:#77736b;line-height:1.35}.pdvr-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.pdvr-card{background:#111;border:1px solid #302e29;border-radius:12px;padding:20px}.pdvr-card-head{display:flex;align-items:center;gap:10px;border-bottom:1px solid #292722;padding-bottom:14px;margin-bottom:14px}.pdvr-card-head svg{color:#bd8a2e}.pdvr-card-head strong{font-size:14px}.pdvr-card-head small{display:block;color:#77736b;font-size:9px;margin-top:3px}.pdvr-main{font-size:28px;font-weight:950;margin:5px 0 18px}.pdvr-main small{font-size:10px;color:#77736b;font-weight:600}.pdvr-lines{display:grid;gap:8px}.pdvr-line{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #20201d;font-size:11px}.pdvr-line span{color:#8f8b83}.pdvr-line b{color:#eee}.pdvr-highlight{margin:12px 0 2px;padding:11px 12px;border:1px solid #3b3428;border-radius:8px;background:#17140f}.pdvr-highlight div{display:flex;justify-content:space-between;font-size:10px;padding:4px 0}.pdvr-highlight div:last-child{font-size:12px;font-weight:900;border-top:1px solid #2d2922;margin-top:4px;padding-top:8px}.pdvr-note{margin:14px 0 0;padding:9px 10px;border:1px solid #302e29;border-radius:7px;color:#77736b;font-size:9px;line-height:1.45}.pdvr-footer{margin-top:18px;color:#77736b;font-size:9px;display:flex;align-items:center;gap:5px}.pdvr-error{margin-bottom:16px;border:1px solid #75413a;background:#241513;color:#f0b6aa;padding:12px;border-radius:8px;font-size:11px}@media(max-width:1000px){.pdvr-kpis{grid-template-columns:repeat(2,1fr)}}@media(max-width:800px){.pdvr-shell{padding:16px}.pdvr-grid,.pdvr-kpis{grid-template-columns:1fr}.pdvr-tools{margin-left:0}.pdvr-head{align-items:flex-start;flex-wrap:wrap}}`}</style>
    <div className="pdvr-wrap">
      <div className="pdvr-head">
        <button className="pdvr-back" onClick={() => { location.href = '/pdv'; }}><ArrowLeft size={16}/> VOLTAR</button>
        <div className="pdvr-title"><span>CAPITÃO SUPLEMENTOS</span><h1>RELATÓRIO PDV</h1></div>
        <div className="pdvr-tools"><input aria-label="Data do relatório" type="date" value={date} onChange={e => setDate(e.target.value)}/><button className="pdvr-refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={16}/></button></div>
      </div>
      {error && <div className="pdvr-error">{error}</div>}
      <div className="pdvr-kpis">
        <div className="pdvr-kpi"><small>VENDAS ATENDIDAS</small><strong>{sales}</strong><span>Pedidos considerados no período</span></div>
        <div className="pdvr-kpi"><small>ANTES DO DESCONTO</small><strong>{valueBreakdownAvailable ? money(beforeDiscount) : '—'}</strong><span>Valor comercial antes dos descontos</span></div>
        <div className="pdvr-kpi"><small>DESCONTOS</small><strong>{valueBreakdownAvailable ? money(discount) : '—'}</strong><span>Total concedido nas vendas</span></div>
        <div className="pdvr-kpi"><small>VALOR DA VENDA</small><strong>{money(total)}</strong><span>Valor efetivo após desconto</span></div>
        <div className="pdvr-kpi"><small>TICKET MÉDIO</small><strong>{money(average)}</strong><span>Valor da venda ÷ atendimentos</span></div>
      </div>
      <div className="pdvr-grid">{stores.map(store => <section className="pdvr-card" key={store.name}>
        <div className="pdvr-card-head"><Store size={19}/><div><strong>{store.name}</strong><small>{store.stock}</small></div></div>
        <div className="pdvr-main">{money(store.total)} <small>valor da venda</small></div>
        {valueBreakdownAvailable && <div className="pdvr-highlight"><div><span>Antes do desconto</span><b>{money(store.beforeDiscount)}</b></div><div><span>Desconto</span><b>{money(store.discount)}</b></div><div><span>Valor da venda</span><b>{money(store.total)}</b></div></div>}
        <div className="pdvr-lines"><div className="pdvr-line"><span>Vendas atendidas</span><b>{store.sales}</b></div><div className="pdvr-line"><span>PIX</span><b>{paymentBreakdownAvailable ? money(store.pix) : '—'}</b></div><div className="pdvr-line"><span>Dinheiro</span><b>{paymentBreakdownAvailable ? money(store.cash) : '—'}</b></div><div className="pdvr-line"><span>Cartões</span><b>{paymentBreakdownAvailable ? money(store.credit + store.debit) : '—'}</b></div><div className="pdvr-line"><span>Bemol</span><b>{paymentBreakdownAvailable ? money(store.bemol) : '—'}</b></div></div>
        {!valueBreakdownAvailable && <div className="pdvr-note">O retorno consultado do Bling não trouxe um campo confiável de valor anterior ao desconto para todas as vendas. Por isso, não tratamos ausência de informação como R$ 0,00.</div>}
        {!paymentBreakdownAvailable && <div className="pdvr-note">O Bling não trouxe o detalhamento das parcelas nessa consulta. O valor da venda acima continua sendo o valor real da venda.</div>}
      </section>)}</div>
      <div className="pdvr-footer"><TrendingUp size={11}/> Base operacional do PDV. O valor da venda é comercial; taxas de adquirência e outros custos financeiros ficam fora deste relatório.</div>
    </div>
  </div>;
}

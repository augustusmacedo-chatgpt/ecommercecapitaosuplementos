import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, MapPin, ShieldCheck, ShoppingBag, UserRound } from 'lucide-react';

type CartItem = { id: number; name: string; price: string; image?: string; stock?: number };

const SESSION_KEY = 'capitao-verified-document';
const SESSION_TIME_KEY = 'capitao-verified-at';
const SESSION_TTL = 15 * 60 * 1000;

export function hasValidCheckoutSession() {
  const document = localStorage.getItem(SESSION_KEY);
  const verifiedAt = Number(localStorage.getItem(SESSION_TIME_KEY) || 0);
  return Boolean(document && verifiedAt && Date.now() - verifiedAt < SESSION_TTL);
}

function price(value: string) {
  const n = Number(String(value).replace(/[^0-9,]/g, '').replace('.', '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function maskDocument(value: string) {
  const d = value.replace(/\D/g, '');
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return d.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export default function CheckoutPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState('entrega');
  const [submitted, setSubmitted] = useState(false);
  const [customer, setCustomer] = useState({ name: '', phone: '', zip: '', street: '', number: '', complement: '', district: '', city: 'Manaus', state: 'AM', observation: '' });

  useEffect(() => {
    if (!hasValidCheckoutSession()) {
      location.href = '/cadastro';
      return;
    }
    try { setCart(JSON.parse(localStorage.getItem('capitao-cart') || '[]')); } catch { setCart([]); }
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<number, CartItem & { quantity: number }>();
    cart.forEach(item => {
      const current = map.get(item.id);
      if (current) current.quantity += 1;
      else map.set(item.id, { ...item, quantity: 1 });
    });
    return Array.from(map.values());
  }, [cart]);

  const total = useMemo(() => cart.reduce((sum, item) => sum + price(item.price), 0), [cart]);

  if (!hasValidCheckoutSession()) return null;

  if (!cart.length && !submitted) {
    return <main className="checkout-page"><style>{styles}</style><div className="checkout-top"><a href="/" className="checkout-logo"><img src="/Logo_Capitao_Esportivo.png" alt="Capitão Suplementos" /></a></div><section className="checkout-empty"><ShoppingBag size={42}/><h1>Sua sacola está vazia</h1><p>Escolha seus produtos para continuar.</p><a href="/" className="checkout-primary">VOLTAR À LOJA</a></section></main>;
  }

  return <main className="checkout-page"><style>{styles}</style>
    <header className="checkout-top"><a href="/" className="checkout-logo"><img src="/Logo_Capitao_Esportivo.png" alt="Capitão Suplementos" /></a><div className="checkout-secure"><ShieldCheck size={17}/> COMPRA SEGURA</div></header>
    <div className="checkout-progress"><span className="done"><Check size={14}/> SACOLA</span><ChevronRight size={15}/><span className="done"><Check size={14}/> IDENTIFICAÇÃO</span><ChevronRight size={15}/><span className="active">PAGAMENTO</span></div>

    {submitted ? <section className="checkout-success"><div className="success-icon"><Check size={32}/></div><span className="checkout-eyebrow">PEDIDO PRONTO</span><h1>Pedido recebido pela Capitão.</h1><p>Seu pedido foi registrado com os dados informados. A equipe da Capitão entrará em contato para confirmar a entrega e o pagamento.</p><a href="/" className="checkout-primary">CONTINUAR COMPRANDO</a></section> :
      <div className="checkout-layout">
        <section className="checkout-main">
          <div className="checkout-heading"><div><span className="checkout-eyebrow">ÚLTIMA ETAPA</span><h1>Finalize seu pedido</h1><p>Identidade confirmada. Agora vamos organizar a entrega.</p></div><div className="verified"><ShieldCheck size={17}/> IDENTIDADE CONFIRMADA</div></div>

          <div className="checkout-card"><div className="card-title"><UserRound size={19}/><div><h2>Seus dados</h2><p>Precisamos deles para realizar a entrega.</p></div></div><div className="checkout-grid"><label>Nome completo<input value={customer.name} onChange={e=>setCustomer({...customer,name:e.target.value})} placeholder="Digite seu nome" required/></label><label>Telefone / WhatsApp<input value={customer.phone} onChange={e=>setCustomer({...customer,phone:e.target.value})} placeholder="(92) 99999-9999" required/></label></div><div className="verified-document"><ShieldCheck size={15}/><span>CPF/CNPJ verificado: <strong>{maskDocument(localStorage.getItem(SESSION_KEY) || '')}</strong></span></div></div>

          <div className="checkout-card"><div className="card-title"><MapPin size={19}/><div><h2>Endereço de entrega</h2><p>Entrega exclusiva em Manaus.</p></div></div><div className="checkout-grid"><label>CEP<input value={customer.zip} onChange={e=>setCustomer({...customer,zip:e.target.value})} placeholder="00000-000" required/></label><label>Endereço<input value={customer.street} onChange={e=>setCustomer({...customer,street:e.target.value})} placeholder="Rua / Avenida" required/></label><label>Número<input value={customer.number} onChange={e=>setCustomer({...customer,number:e.target.value})} placeholder="Nº" required/></label><label>Complemento<input value={customer.complement} onChange={e=>setCustomer({...customer,complement:e.target.value})} placeholder="Apartamento, casa..."/></label><label>Bairro<input value={customer.district} onChange={e=>setCustomer({...customer,district:e.target.value})} placeholder="Bairro" required/></label><label>Cidade / UF<input value={`${customer.city} / ${customer.state}`} readOnly/></label></div><label className="full-label">Observação para entrega<textarea value={customer.observation} onChange={e=>setCustomer({...customer,observation:e.target.value})} placeholder="Ponto de referência ou instrução para o entregador"/></label></div>

          <div className="checkout-card"><div className="card-title"><ShoppingBag size={19}/><div><h2>Forma de pagamento</h2><p>Escolha como deseja pagar seu pedido.</p></div></div><button type="button" className={`payment-option ${payment==='entrega'?'selected':''}`} onClick={()=>setPayment('entrega')}><span className="radio">{payment==='entrega'&&<i/>}</span><div><strong>Pagamento na entrega</strong><small>Você paga quando receber seu pedido.</small></div><span className="payment-tag">CAPITÃO</span></button></div>

          <button className="checkout-primary checkout-submit" onClick={()=>setSubmitted(true)}>CONFIRMAR PEDIDO <ChevronRight size={18}/></button>
          <a href="/" className="checkout-back"><ArrowLeft size={15}/> Voltar para a compra</a>
        </section>

        <aside className="checkout-summary"><div className="summary-sticky"><span className="checkout-eyebrow">RESUMO</span><h2>Seu pedido</h2>{grouped.map(item=><div className="summary-item" key={item.id}>{item.image?<img src={item.image} alt=""/>:<div className="summary-placeholder"/>}<div><strong>{item.name}</strong><span>Qtd. {item.quantity}</span></div><b>{money(price(item.price)*item.quantity)}</b></div>)}<div className="summary-line"><span>Subtotal</span><b>{money(total)}</b></div><div className="summary-line"><span>Entrega</span><b>A combinar</b></div><div className="summary-total"><span>Total</span><strong>{money(total)}</strong></div><div className="summary-note"><ShieldCheck size={16}/><span>Seus dados de identificação foram confirmados por código enviado ao seu e-mail.</span></div></div></aside>
      </div>}
  </main>;
}

const styles = `
.checkout-page{min-height:100vh;background:#f7f7f7;color:#151515;font-family:inherit}.checkout-top{height:82px;background:#101010;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 max(24px,calc((100% - 1180px)/2));border-bottom:1px solid #2d2d2d}.checkout-logo img{display:block;width:155px;max-height:55px;object-fit:contain}.checkout-secure{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:800;letter-spacing:.8px;color:#d5aa46}.checkout-progress{max-width:1180px;margin:0 auto;padding:18px 24px;display:flex;align-items:center;gap:9px;font-size:10px;font-weight:800;letter-spacing:.8px;color:#9a9a9a}.checkout-progress span{display:flex;align-items:center;gap:5px}.checkout-progress .done{color:#252525}.checkout-progress .active{color:#b1832f}.checkout-layout{max-width:1180px;margin:0 auto;padding:18px 24px 70px;display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:28px}.checkout-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:22px}.checkout-eyebrow{font-size:10px;font-weight:900;letter-spacing:1.4px;color:#b1832f}.checkout-heading h1,.checkout-success h1{font-size:34px;line-height:1.05;margin:7px 0 8px;letter-spacing:-1px}.checkout-heading p{margin:0;color:#777;font-size:14px}.verified{display:flex;align-items:center;gap:7px;border:1px solid #d9d9d9;background:#fff;padding:9px 11px;border-radius:6px;font-size:9px;font-weight:900;letter-spacing:.6px;white-space:nowrap}.checkout-card{background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:22px;margin-bottom:16px;box-shadow:0 5px 20px rgba(0,0,0,.025)}.card-title{display:flex;align-items:flex-start;gap:10px;margin-bottom:18px}.card-title svg{margin-top:2px;color:#b1832f}.card-title h2{font-size:16px;margin:0 0 4px}.card-title p{font-size:12px;color:#858585;margin:0}.checkout-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.checkout-grid label,.full-label{display:flex;flex-direction:column;gap:6px;font-size:10px;font-weight:800;color:#555;letter-spacing:.2px}.checkout-grid input,.full-label textarea{font:inherit;font-size:13px;font-weight:500;color:#171717;background:#fff;border:1px solid #d9d9d9;border-radius:5px;padding:12px;outline:none}.checkout-grid input:focus,.full-label textarea:focus{border-color:#b1832f;box-shadow:0 0 0 2px rgba(177,131,47,.1)}.full-label{margin-top:14px}.full-label textarea{min-height:72px;resize:vertical}.verified-document{display:flex;align-items:center;gap:7px;margin-top:14px;padding:10px;background:#f8f8f8;border-radius:5px;color:#6d6d6d;font-size:11px}.verified-document svg{color:#b1832f}.verified-document strong{color:#222}.payment-option{width:100%;display:flex;align-items:center;text-align:left;gap:12px;padding:14px;border:1px solid #ddd;background:#fff;border-radius:6px;cursor:pointer}.payment-option.selected{border-color:#b1832f;box-shadow:0 0 0 1px #b1832f}.radio{width:17px;height:17px;border:1px solid #aaa;border-radius:50%;display:grid;place-items:center;flex:none}.radio i{width:9px;height:9px;border-radius:50%;background:#b1832f}.payment-option div{display:flex;flex-direction:column;gap:3px;flex:1}.payment-option strong{font-size:12px}.payment-option small{font-size:10px;color:#777}.payment-tag{font-size:8px;font-weight:900;letter-spacing:.7px;color:#b1832f}.checkout-primary{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;border:0;border-radius:5px;background:#151515;color:#fff;padding:15px 18px;font-size:11px;font-weight:900;letter-spacing:.8px;text-decoration:none;cursor:pointer}.checkout-primary:hover{background:#2b2b2b}.checkout-submit{margin-top:5px}.checkout-back{display:flex;align-items:center;justify-content:center;gap:7px;color:#666;text-decoration:none;font-size:11px;font-weight:700;margin-top:15px}.summary-sticky{position:sticky;top:18px;background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:22px;box-shadow:0 5px 20px rgba(0,0,0,.025)}.summary-sticky h2{font-size:22px;margin:6px 0 20px}.summary-item{display:grid;grid-template-columns:48px 1fr auto;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid #eee}.summary-item img,.summary-placeholder{width:48px;height:48px;object-fit:contain;background:#f6f6f6;border-radius:4px}.summary-item div{display:flex;flex-direction:column;gap:4px;min-width:0}.summary-item strong{font-size:11px;line-height:1.25}.summary-item span{font-size:9px;color:#888}.summary-item b{font-size:11px;white-space:nowrap}.summary-line{display:flex;justify-content:space-between;padding-top:13px;font-size:11px;color:#777}.summary-line b{color:#222}.summary-total{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #ddd;margin-top:15px;padding-top:16px}.summary-total span{font-size:12px;font-weight:800}.summary-total strong{font-size:22px}.summary-note{display:flex;gap:8px;margin-top:17px;padding-top:14px;border-top:1px solid #eee;color:#777;font-size:9px;line-height:1.4}.summary-note svg{color:#b1832f;flex:none}.checkout-empty,.checkout-success{max-width:620px;margin:80px auto;text-align:center;background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:55px 35px}.checkout-empty svg,.success-icon{color:#b1832f}.checkout-empty h1{font-size:28px;margin:15px 0 8px}.checkout-empty p,.checkout-success p{color:#777;font-size:14px;line-height:1.6}.checkout-empty .checkout-primary,.checkout-success .checkout-primary{margin:25px auto 0;max-width:280px}.success-icon{width:66px;height:66px;border-radius:50%;background:#f4ecdc;display:grid;place-items:center;margin:0 auto 20px}.checkout-success{margin-top:70px}.checkout-success h1{margin-top:10px}.checkout-success .checkout-primary{max-width:290px}
@media(max-width:820px){.checkout-top{height:70px;padding:0 18px}.checkout-logo img{width:130px}.checkout-secure{font-size:9px}.checkout-progress{padding:15px 18px;font-size:8px}.checkout-layout{grid-template-columns:1fr;padding:10px 16px 50px}.summary-sticky{position:static}.checkout-heading{align-items:flex-start;flex-direction:column}.verified{white-space:normal}.checkout-heading h1,.checkout-success h1{font-size:28px}.checkout-card{padding:17px}.checkout-grid{grid-template-columns:1fr}.checkout-page{background:#f7f7f7}}
`;

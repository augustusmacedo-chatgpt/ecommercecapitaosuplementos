import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, ChevronRight, MapPin, ShieldCheck, ShoppingBag, UserRound } from 'lucide-react';

type CartItem = { id: number; name: string; price: string; image?: string; stock?: number; code?: string };
type PaymentMethod = 'CRÉDITO 1X' | 'CRÉDITO 2X' | 'CRÉDITO 3X' | 'DÉBITO À VISTA' | 'PIX PAGAR NA MÁQUINA DE CARTÃO' | 'DINHEIRO';

const SESSION_KEY = 'capitao-verified-document';
const EMAIL_KEY = 'capitao-verified-email';
const SESSION_TIME_KEY = 'capitao-verified-at';
const CHECKOUT_ID_KEY = 'capitao-checkout-id';
const LAST_ORDER_KEY = 'capitao-last-order';
const SESSION_TTL = 15 * 60 * 1000;

export function hasValidCheckoutSession() {
  const document = localStorage.getItem(SESSION_KEY);
  const email = localStorage.getItem(EMAIL_KEY);
  const verifiedAt = Number(localStorage.getItem(SESSION_TIME_KEY) || 0);
  return Boolean((document || email) && verifiedAt && Date.now() - verifiedAt < SESSION_TTL);
}

function price(value: string) {
  const normalized = String(value).replace(/[^0-9,]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}
function money(value: number) { return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function maskDocument(value: string) {
  const d = value.replace(/\D/g, '');
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return d.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}
function maskPhone(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function maskCep(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

const PAYMENT_METHODS: PaymentMethod[] = ['CRÉDITO 1X', 'CRÉDITO 2X', 'CRÉDITO 3X', 'DÉBITO À VISTA', 'PIX PAGAR NA MÁQUINA DE CARTÃO', 'DINHEIRO'];
type Customer = { document: string; name: string; birthDate: string; email: string; phone: string; zip: string; street: string; number: string; complement: string; district: string; city: string; state: string; observation: string };

export default function CheckoutPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState<PaymentMethod>('CRÉDITO 1X');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [loadingCep, setLoadingCep] = useState(false);
  const [formError, setFormError] = useState('');
  const [customer, setCustomer] = useState<Customer>({ document: '', name: '', birthDate: '', email: '', phone: '', zip: '', street: '', number: '', complement: '', district: '', city: 'Manaus', state: 'AM', observation: '' });
  const [checkoutId] = useState(() => {
    const existing = sessionStorage.getItem(CHECKOUT_ID_KEY);
    if (existing) return existing;
    const created = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(CHECKOUT_ID_KEY, created);
    return created;
  });

  const verifiedDocument = localStorage.getItem(SESSION_KEY) || '';
  const verifiedEmail = localStorage.getItem(EMAIL_KEY) || '';
  const isNewCustomer = !verifiedDocument && Boolean(verifiedEmail);

  useEffect(() => {
    if (!hasValidCheckoutSession()) { location.href = '/reconnect'; return; }
    try { setCart(JSON.parse(localStorage.getItem('capitao-cart') || '[]')); } catch { setCart([]); }
    setCustomer(current => ({ ...current, document: verifiedDocument ? maskDocument(verifiedDocument) : '', email: verifiedEmail }));
    try {
      const last = JSON.parse(sessionStorage.getItem(LAST_ORDER_KEY) || 'null') as { checkoutId?: string; orderNumber?: number } | null;
      if (last?.checkoutId === checkoutId && last.orderNumber) { setSubmitted(true); setOrderNumber(last.orderNumber); }
    } catch { /* sem pedido anterior nesta sessão */ }
  }, [checkoutId, verifiedDocument, verifiedEmail]);

  async function lookupCep(value: string) {
    const cep = value.replace(/\D/g, '');
    if (cep.length !== 8) return;
    setLoadingCep(true); setFormError('');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!response.ok) throw new Error('Não foi possível consultar o CEP.');
      const data = await response.json();
      if (data.erro) throw new Error('CEP não encontrado.');
      setCustomer(current => ({ ...current, zip: maskCep(data.cep || value), street: data.logradouro || '', district: data.bairro || '', city: data.localidade || '', state: data.uf || '' }));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível consultar o CEP.');
    } finally { setLoadingCep(false); }
  }

  function update<K extends keyof Customer>(key: K, value: Customer[K]) { setCustomer(current => ({ ...current, [key]: value })); }

  async function confirmOrder() {
    if (submitting) return;
    setFormError('');
    const required: Array<[keyof Customer, string]> = [
      ['document', 'CPF/CNPJ'], ['name', 'Nome completo'], ['birthDate', 'Data de nascimento'], ['email', 'E-mail'], ['phone', 'Telefone / WhatsApp'], ['zip', 'CEP'], ['street', 'Logradouro'], ['number', 'Número'], ['district', 'Bairro']
    ];
    const missing = required.find(([key]) => !String(customer[key]).trim());
    if (missing) { setFormError(`Preencha o campo obrigatório: ${missing[1]}.`); return; }
    if (![11, 14].includes(customer.document.replace(/\D/g, '').length)) { setFormError('Informe um CPF ou CNPJ válido.'); return; }
    if (!customer.city || !customer.state) { setFormError('Consulte um CEP válido para preencher cidade e estado.'); return; }
    if (!customer.email.includes('@')) { setFormError('Informe um e-mail válido.'); return; }
    if (!cart.length) { setFormError('Sua sacola está vazia.'); return; }

    setSubmitting(true);
    try {
      const response = await fetch('/api/bling/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkoutId,
          customer: {
            document: customer.document,
            name: customer.name,
            birthDate: customer.birthDate,
            email: customer.email,
            phone: customer.phone,
            zip: customer.zip,
            street: customer.street,
            number: customer.number,
            complement: customer.complement,
            district: customer.district,
            city: customer.city,
            state: customer.state,
            observation: customer.observation,
          },
          payment,
          items: grouped.map(item => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity, code: item.code })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.created) throw new Error(data.error || 'Não foi possível registrar o pedido no Bling.');
      const number = Number(data.orderNumber || 0) || null;
      setOrderNumber(number);
      setSubmitted(true);
      sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify({ checkoutId, orderNumber: number, orderId: data.orderId }));
      localStorage.removeItem('capitao-cart');
      setCart([]);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível registrar o pedido.');
    } finally { setSubmitting(false); }
  }

  const grouped = useMemo(() => {
    const map = new Map<number, CartItem & { quantity: number }>();
    cart.forEach(item => { const current = map.get(item.id); if (current) current.quantity += 1; else map.set(item.id, { ...item, quantity: 1 }); });
    return Array.from(map.values());
  }, [cart]);
  const total = useMemo(() => cart.reduce((sum, item) => sum + price(item.price), 0), [cart]);

  if (!hasValidCheckoutSession()) return null;
  if (!cart.length && !submitted) return <main className="checkout-page"><style>{styles}</style><div className="checkout-top"><a href="/" className="checkout-logo"><img src="/Logo_Capitao_Esportivo.png" alt="Capitão Suplementos" /></a></div><section className="checkout-empty"><ShoppingBag size={42}/><h1>Sua sacola está vazia</h1><p>Escolha seus produtos para continuar.</p><a href="/" className="checkout-primary">VOLTAR À LOJA</a></section></main>;

  return <main className="checkout-page"><style>{styles}</style>
    <header className="checkout-top"><a href="/" className="checkout-logo"><img src="/Logo_Capitao_Esportivo.png" alt="Capitão Suplementos" /></a><div className="checkout-secure"><ShieldCheck size={17}/> COMPRA SEGURA</div></header>
    <div className="checkout-progress"><span className="done"><Check size={14}/> SACOLA</span><ChevronRight size={15}/><span className="done"><Check size={14}/> IDENTIFICAÇÃO</span><ChevronRight size={15}/><span className="active">FINALIZAÇÃO</span></div>

    {submitted ? <section className="checkout-success"><div className="success-icon"><Check size={32}/></div><span className="checkout-eyebrow">PEDIDO REGISTRADO</span><h1>Pedido recebido pela Capitão.</h1>{orderNumber ? <p className="order-number">Pedido nº <strong>{orderNumber}</strong></p> : null}<p>Seu pedido foi registrado no Bling com os dados informados. A equipe da Capitão entrará em contato para confirmar a entrega e o pagamento.</p><a href="/" className="checkout-primary">CONTINUAR COMPRANDO</a></section> :
      <div className="checkout-layout">
        <section className="checkout-main">
          <div className="checkout-heading"><div><span className="checkout-eyebrow">ÚLTIMA ETAPA</span><h1>Finalize seu pedido</h1><p>{isNewCustomer ? 'Complete seu cadastro para continuar com a compra.' : 'Confira seus dados e escolha como prefere pagar no momento da entrega.'}</p></div><div className="verified"><ShieldCheck size={17}/> IDENTIDADE CONFIRMADA</div></div>
          <div className="payment-security-banner"><div className="payment-security-icon"><ShieldCheck size={19}/></div><div><strong>NENHUM PAGAMENTO SERÁ EFETUADO AGORA</strong><p>Seu pedido será apenas registrado neste momento. O pagamento acontece somente no momento da entrega.</p></div></div>
          <div className="checkout-card"><div className="card-title"><UserRound size={19}/><div><h2>{isNewCustomer ? 'Complete seu cadastro' : 'Seus dados'}</h2><p>{isNewCustomer ? 'Precisamos destes dados para registrar seu cadastro e realizar a entrega.' : 'Precisamos deles para realizar a entrega.'}</p></div></div>
            <div className="checkout-grid">
              <label>CPF/CNPJ <em>OBRIGATÓRIO</em><input value={customer.document} onChange={e=>!verifiedDocument&&update('document',maskDocument(e.target.value))} placeholder="Digite seu CPF/CNPJ" readOnly={Boolean(verifiedDocument)} required/></label>
              <label>Nome completo <em>OBRIGATÓRIO</em><input value={customer.name} onChange={e=>update('name',e.target.value)} placeholder="Digite seu nome" required/></label>
              <label>Data de nascimento <em>OBRIGATÓRIO</em><input type="date" value={customer.birthDate} onChange={e=>update('birthDate',e.target.value)} required/></label>
              <label>E-mail <em>OBRIGATÓRIO</em><input type="email" value={customer.email} onChange={e=>!verifiedEmail&&update('email',e.target.value)} placeholder="seu@email.com" readOnly={Boolean(verifiedEmail)} required/></label>
              <label>Telefone / WhatsApp <em>OBRIGATÓRIO</em><input value={customer.phone} onChange={e=>update('phone',maskPhone(e.target.value))} placeholder="(92) 99999-9999" required/></label>
            </div>
          </div>
          <div className="checkout-card"><div className="card-title"><MapPin size={19}/><div><h2>Endereço de entrega</h2><p>Digite o CEP e o endereço será preenchido automaticamente.</p></div></div><div className="checkout-grid"><label>CEP <em>OBRIGATÓRIO</em><input value={customer.zip} onChange={e=>update('zip',maskCep(e.target.value))} onBlur={e=>lookupCep(e.target.value)} placeholder="00000-000" required/></label><label>Logradouro <em>OBRIGATÓRIO</em><input value={customer.street} onChange={e=>update('street',e.target.value)} placeholder={loadingCep?'CONSULTANDO...':'Rua / Avenida'} required/></label><label>Número <em>OBRIGATÓRIO</em><input value={customer.number} onChange={e=>update('number',e.target.value)} placeholder="Nº" required/></label><label>Complemento<input value={customer.complement} onChange={e=>update('complement',e.target.value)} placeholder="Apartamento, casa..."/></label><label>Bairro <em>OBRIGATÓRIO</em><input value={customer.district} onChange={e=>update('district',e.target.value)} placeholder="Bairro" required/></label><label>Cidade / UF<input value={customer.city && customer.state ? `${customer.city} / ${customer.state}` : ''} readOnly placeholder="Preenchido pelo CEP"/></label></div><label className="full-label">Observação para entrega<textarea value={customer.observation} onChange={e=>update('observation',e.target.value)} placeholder="Ponto de referência ou instrução para o entregador"/></label><div className="address-note"><ShieldCheck size={14}/><span>O CEP preenche logradouro, bairro, cidade e estado. Número e complemento ficam para você informar.</span></div></div>
          <div className="checkout-card payment-card"><div className="card-title"><ShoppingBag size={19}/><div><h2>Como você prefere pagar?</h2><p>Esta escolha é apenas uma preferência. O pagamento será feito na entrega.</p></div></div>
            <button type="button" className={`payment-select ${paymentOpen?'open':''}`} onClick={()=>setPaymentOpen(open=>!open)} aria-expanded={paymentOpen}><span className="payment-select-main"><span className="payment-radio selected"><i/></span><span><strong>{payment}</strong><small>Pagamento somente no momento da entrega</small></span></span><ChevronDown size={19}/></button>
            {paymentOpen && <div className="payment-menu">{PAYMENT_METHODS.map(method=><button type="button" key={method} className={`payment-menu-item ${payment===method?'selected':''}`} onClick={()=>{setPayment(method);setPaymentOpen(false)}}><span className={`payment-radio ${payment===method?'selected':''}`}>{payment===method&&<i/>}</span><span>{method}</span>{payment===method&&<Check size={16}/>}</button>)}</div>}
            <div className="payment-delivery-note"><ShieldCheck size={16}/><span><strong>Pagamento na entrega.</strong> Nenhuma cobrança será realizada nesta página.</span></div>
          </div>
          {formError && <div className="checkout-form-error">{formError}</div>}
          <button className="checkout-primary checkout-submit" onClick={confirmOrder} disabled={submitting}>{submitting ? 'REGISTRANDO PEDIDO...' : 'CONFIRMAR PEDIDO'} {!submitting && <ChevronRight size={18}/>}</button><a href="/" className="checkout-back"><ArrowLeft size={15}/> Voltar para a compra</a>
        </section>
        <aside className="checkout-summary"><div className="summary-sticky"><span className="checkout-eyebrow">RESUMO</span><h2>Seu pedido</h2>{grouped.map(item=><div className="summary-item" key={item.id}>{item.image?<img src={item.image} alt=""/>:<div className="summary-placeholder"/>}<div><strong>{item.name}</strong><span>Qtd. {item.quantity}</span></div><b>{money(price(item.price)*item.quantity)}</b></div>)}<div className="summary-line"><span>Subtotal</span><b>{money(total)}</b></div><div className="summary-line"><span>Entrega</span><b>A combinar</b></div><div className="summary-total"><span>Total</span><strong>{money(total)}</strong></div><div className="summary-payment"><span>Pagamento escolhido</span><strong>{payment}</strong><small>Será realizado somente na entrega.</small></div><div className="summary-note"><ShieldCheck size={16}/><span>Seus dados de identificação foram confirmados por código enviado ao seu e-mail.</span></div></div></aside>
      </div>}
  </main>;
}

const styles = `
.checkout-page{min-height:100vh;background:#f6f6f5;color:#151515;font-family:inherit}.checkout-top{height:82px;background:#101010;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 max(24px,calc((100% - 1180px)/2));border-bottom:1px solid #2d2d2d}.checkout-logo img{display:block;width:155px;max-height:55px;object-fit:contain}.checkout-secure{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:800;letter-spacing:.8px;color:#d5aa46}.checkout-progress{max-width:1180px;margin:0 auto;padding:18px 24px;display:flex;align-items:center;gap:9px;font-size:10px;font-weight:800;letter-spacing:.8px;color:#9a9a9a}.checkout-progress span{display:flex;align-items:center;gap:5px}.checkout-progress .done{color:#252525}.checkout-progress .active{color:#b1832f}.checkout-layout{max-width:1180px;margin:0 auto;padding:18px 24px 70px;display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:28px}.checkout-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:22px}.checkout-eyebrow{font-size:10px;font-weight:900;letter-spacing:1.4px;color:#b1832f}.checkout-heading h1,.checkout-success h1{font-size:34px;line-height:1.05;margin:7px 0 8px;letter-spacing:-1px}.checkout-heading p{margin:0;color:#777;font-size:14px}.verified{display:flex;align-items:center;gap:7px;border:1px solid #d9d9d9;background:#fff;padding:9px 11px;border-radius:6px;font-size:9px;font-weight:900;letter-spacing:.6px;white-space:nowrap}.payment-security-banner{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #ddd8cb;border-left:3px solid #b1832f;border-radius:7px;padding:14px 16px;margin-bottom:16px}.payment-security-icon{width:34px;height:34px;border-radius:50%;background:#f4ecdc;color:#a37829;display:grid;place-items:center;flex:none}.payment-security-banner strong{display:block;font-size:10px;letter-spacing:.55px}.payment-security-banner p{margin:4px 0 0;color:#777;font-size:11px;line-height:1.45}.checkout-card{background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:22px;margin-bottom:16px;box-shadow:0 5px 20px rgba(0,0,0,.025)}.card-title{display:flex;align-items:flex-start;gap:10px;margin-bottom:18px}.card-title svg{margin-top:2px;color:#b1832f}.card-title h2{font-size:16px;margin:0 0 4px}.card-title p{font-size:12px;color:#858585;margin:0;line-height:1.4}.checkout-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.checkout-grid label,.full-label{display:flex;flex-direction:column;gap:6px;font-size:10px;font-weight:800;color:#555;letter-spacing:.2px}.checkout-grid label em{font-style:normal;color:#b1832f;font-size:8px;letter-spacing:.5px}.checkout-grid input,.full-label textarea{font:inherit;font-size:13px;font-weight:500;color:#171717;background:#fff;border:1px solid #d9d9d9;border-radius:5px;padding:12px;outline:none}.checkout-grid input:focus,.full-label textarea:focus{border-color:#b1832f;box-shadow:0 0 0 2px rgba(177,131,47,.1)}.checkout-grid input[readonly]{background:#f6f6f6;color:#555;cursor:not-allowed}.full-label{margin-top:14px}.full-label textarea{min-height:72px;resize:vertical}.address-note{display:flex;align-items:center;gap:7px;margin-top:12px;padding:10px;background:#f8f8f8;border-radius:5px;color:#777;font-size:9px;line-height:1.4}.address-note svg{color:#b1832f;flex:none}.payment-select{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;padding:15px;border:1px solid #d8d8d8;background:#fff;border-radius:7px;cursor:pointer;transition:.15s}.payment-select:hover,.payment-select.open{border-color:#b1832f}.payment-select.open{box-shadow:0 0 0 1px #b1832f}.payment-select>svg{color:#777;transition:.15s}.payment-select.open>svg{transform:rotate(180deg);color:#b1832f}.payment-select-main{display:flex;align-items:center;gap:11px;min-width:0}.payment-select-main>span:last-child{display:flex;flex-direction:column;gap:4px}.payment-select strong{font-size:12px}.payment-select small{font-size:10px;color:#777}.payment-radio{width:17px;height:17px;border:1px solid #aaa;border-radius:50%;display:grid;place-items:center;flex:none}.payment-radio.selected{border-color:#b1832f}.payment-radio i{width:9px;height:9px;border-radius:50%;background:#b1832f}.payment-menu{margin-top:7px;border:1px solid #e0e0e0;border-radius:7px;overflow:hidden;background:#fff;box-shadow:0 8px 22px rgba(0,0,0,.06)}.payment-menu-item{width:100%;display:flex;align-items:center;gap:11px;padding:13px 14px;border:0;border-bottom:1px solid #eee;background:#fff;text-align:left;cursor:pointer;font-size:11px;font-weight:800;color:#333}.payment-menu-item:last-child{border-bottom:0}.payment-menu-item:hover{background:#f8f8f8}.payment-menu-item.selected{background:#fbf8f0;color:#8f6825}.payment-menu-item>svg{margin-left:auto}.payment-delivery-note{display:flex;align-items:center;gap:8px;margin-top:12px;padding:10px 11px;background:#f8f8f8;border-radius:5px;color:#777;font-size:10px;line-height:1.4}.payment-delivery-note svg{color:#b1832f;flex:none}.payment-delivery-note strong{color:#333}.checkout-form-error{margin:0 0 10px;padding:11px 13px;border:1px solid #ead2d2;background:#fff6f6;color:#9b4444;border-radius:5px;font-size:10px;font-weight:700}.checkout-primary{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;border:0;border-radius:5px;background:#151515;color:#fff;padding:15px 18px;font-size:11px;font-weight:900;letter-spacing:.8px;text-decoration:none;cursor:pointer}.checkout-primary:hover{background:#2b2b2b}.checkout-primary:disabled{opacity:.6;cursor:wait}.checkout-submit{margin-top:5px}.checkout-back{display:flex;align-items:center;justify-content:center;gap:7px;color:#666;text-decoration:none;font-size:11px;font-weight:700;margin-top:15px}.summary-sticky{position:sticky;top:18px;background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:22px;box-shadow:0 5px 20px rgba(0,0,0,.025)}.summary-sticky h2{font-size:22px;margin:6px 0 20px}.summary-item{display:grid;grid-template-columns:48px 1fr auto;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid #eee}.summary-item img,.summary-placeholder{width:48px;height:48px;object-fit:contain;background:#f6f6f6;border-radius:4px}.summary-item div{display:flex;flex-direction:column;gap:4px;min-width:0}.summary-item strong{font-size:11px;line-height:1.25}.summary-item span{font-size:9px;color:#888}.summary-item b{font-size:11px;white-space:nowrap}.summary-line{display:flex;justify-content:space-between;padding-top:13px;font-size:11px;color:#777}.summary-line b{color:#222}.summary-total{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #ddd;margin-top:15px;padding-top:16px}.summary-total span{font-size:12px;font-weight:800}.summary-total strong{font-size:22px}.summary-payment{margin-top:14px;padding:12px;background:#fbf8f0;border:1px solid #eee4cf;border-radius:6px;display:flex;flex-direction:column;gap:4px}.summary-payment span{font-size:9px;color:#8b8b8b;text-transform:uppercase;letter-spacing:.6px}.summary-payment strong{font-size:10px;color:#6f501c;line-height:1.35}.summary-payment small{font-size:9px;color:#777}.summary-note{display:flex;gap:8px;margin-top:17px;padding-top:14px;border-top:1px solid #eee;color:#777;font-size:9px;line-height:1.4}.summary-note svg{color:#b1832f;flex:none}.checkout-empty,.checkout-success{max-width:620px;margin:80px auto;text-align:center;background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:55px 35px}.checkout-empty svg,.success-icon{color:#b1832f}.checkout-empty h1{font-size:28px;margin:15px 0 8px}.checkout-empty p,.checkout-success p{color:#777;font-size:14px;line-height:1.6}.checkout-empty .checkout-primary,.checkout-success .checkout-primary{margin:25px auto 0;max-width:280px}.checkout-success{margin-top:70px}.checkout-success h1{margin-top:10px}.checkout-success .checkout-primary{max-width:290px}.order-number{margin:12px 0 0!important;color:#b1832f!important;font-size:18px!important}.order-number strong{font-size:22px}
@media(max-width:820px){.checkout-top{height:70px;padding:0 18px}.checkout-logo img{width:130px}.checkout-secure{font-size:9px}.checkout-progress{padding:15px 18px;font-size:8px}.checkout-layout{grid-template-columns:1fr;padding:10px 16px 50px}.summary-sticky{position:static}.checkout-heading{align-items:flex-start;flex-direction:column}.checkout-heading h1,.checkout-success h1{font-size:28px}.verified{width:max-content}.checkout-grid{grid-template-columns:1fr}.checkout-card{padding:18px}.payment-security-banner{align-items:flex-start}.payment-security-banner p{font-size:10px}.summary-item{grid-template-columns:44px 1fr auto}.summary-item img,.summary-placeholder{width:44px;height:44px}}
@media(max-width:480px){.checkout-top{padding:0 14px}.checkout-logo img{width:115px}.checkout-secure{font-size:8px;letter-spacing:.5px}.checkout-progress{gap:5px;padding-left:14px;padding-right:14px}.checkout-layout{padding-left:12px;padding-right:12px}.checkout-heading h1{font-size:25px}.checkout-heading p{font-size:13px}.checkout-primary{padding:16px}.payment-select strong{font-size:11px}.payment-menu-item{padding:14px 11px;font-size:10px}.checkout-empty,.checkout-success{margin:50px 12px;padding:42px 22px}}
`;

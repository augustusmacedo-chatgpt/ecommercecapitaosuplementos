import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Gift, Minus, Plus, ShieldCheck, Sparkles, X } from 'lucide-react';

const SESSION_KEY = 'capitao-customer-session';
const RESERVATION_KEY = 'capitao-points-reservation';

type AccountResponse = { enabled?: boolean; minimumPoints?: number; availablePoints?: number; availableValue?: number; reservedPoints?: number; error?: string };
type ReservationResponse = { reserved?: boolean; reservationId?: string; points?: number; value?: number; expiresAt?: string; availablePoints?: number; error?: string };
function money(value: number) { return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

export default function CheckoutLoyalty({ checkoutId, total }: { checkoutId: string; total: number }) {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [points, setPoints] = useState(100);
  const [reservation, setReservation] = useState<ReservationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');

  const session = localStorage.getItem(SESSION_KEY) || '';
  const maxByTotal = Math.floor(Math.max(0, total) / 0.05);
  const maxPoints = Math.max(0, Math.min(Number(account?.availablePoints || 0), maxByTotal));
  const maxSelectable = Math.floor(maxPoints / 100) * 100;
  const discount = reservation?.value || (points >= 100 ? points * 0.05 : 0);

  useEffect(() => {
    if (location.pathname !== '/checkout') return;
    const target = document.createElement('div');
    target.id = 'checkout-loyalty-mount';
    const main = document.querySelector('.checkout-main');
    const submit = document.querySelector('.checkout-submit');
    if (!main || !submit) return;
    main.insertBefore(target, submit);
    setMount(target);
    return () => { target.remove(); };
  }, []);

  useEffect(() => {
    if (!session || !checkoutId || total <= 0) { setLoading(false); return; }
    fetch('/api/pontos/account', { headers: { Authorization: `Bearer ${session}` }, cache: 'no-store' })
      .then(response => response.json().catch(() => ({})))
      .then(data => { if (!data?.error) setAccount(data as AccountResponse); else setMessage(data.error); })
      .catch(() => setMessage('Não foi possível consultar seus pontos agora.'))
      .finally(() => setLoading(false));
  }, [checkoutId, session, total]);

  useEffect(() => {
    const stored = sessionStorage.getItem(RESERVATION_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as ReservationResponse & { checkoutId?: string };
      if (parsed.checkoutId === checkoutId && parsed.reservationId) setReservation(parsed);
    } catch { sessionStorage.removeItem(RESERVATION_KEY); }
  }, [checkoutId]);

  useEffect(() => {
    const summary = document.querySelector('.summary-sticky');
    const totalElement = summary?.querySelector<HTMLElement>('.summary-total strong');
    if (!summary || !totalElement) return;
    const existing = summary.querySelector<HTMLElement>('.summary-loyalty-discount');
    if (!reservation?.value) {
      existing?.remove();
      totalElement.textContent = money(total);
      return;
    }
    const row = existing || document.createElement('div');
    row.className = 'summary-line summary-loyalty-discount';
    row.innerHTML = `<span>Pontos utilizados</span><b>-${money(Number(reservation.value))}</b>`;
    if (!existing) {
      const totalRow = summary.querySelector('.summary-total');
      totalRow?.parentElement?.insertBefore(row, totalRow);
    }
    totalElement.textContent = money(Math.max(0, total - Number(reservation.value)));
  }, [reservation?.value, total]);

  useEffect(() => {
    if (!reservation?.reservationId) return;
    const originalFetch = window.fetch.bind(window);
    const patched = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (!url.includes('/api/bling/order') || !init?.body || typeof init.body !== 'string') return originalFetch(input, init);
      try {
        const body = JSON.parse(init.body);
        body.loyalty = { ...(body.loyalty || {}), reservationId: reservation.reservationId };
        const response = await originalFetch(input, { ...init, body: JSON.stringify(body) });
        if (response.ok) sessionStorage.removeItem(RESERVATION_KEY);
        return response;
      } catch { return originalFetch(input, init); }
    };
    window.fetch = patched as typeof window.fetch;
    return () => { window.fetch = originalFetch; };
  }, [reservation?.reservationId]);

  const canRedeem = Boolean(account?.enabled && maxSelectable >= Number(account?.minimumPoints || 100) && !reservation && !working);
  const quickValues = useMemo(() => [100, 200, 500, 1000].filter(value => value <= maxSelectable).slice(0, 4), [maxSelectable]);

  async function reserve() {
    if (!canRedeem) return;
    setWorking(true); setMessage('');
    try {
      const response = await fetch('/api/pontos/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` }, body: JSON.stringify({ checkoutId, points }) });
      const data = await response.json().catch(() => ({})) as ReservationResponse;
      if (!response.ok || !data.reservationId) throw new Error(data.error || 'Não foi possível reservar seus pontos.');
      const saved = { ...data, checkoutId };
      sessionStorage.setItem(RESERVATION_KEY, JSON.stringify(saved));
      setReservation(saved);
      setAccount(current => current ? { ...current, availablePoints: data.availablePoints ?? current.availablePoints } : current);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível reservar seus pontos.'); }
    finally { setWorking(false); }
  }

  async function release() {
    if (!reservation?.reservationId) return;
    setWorking(true); setMessage('');
    try {
      await fetch('/api/pontos/redeem', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` }, body: JSON.stringify({ reservationId: reservation.reservationId }) });
    } finally {
      sessionStorage.removeItem(RESERVATION_KEY);
      setReservation(null);
      setWorking(false);
    }
  }

  if (!mount || loading || !account?.enabled || Number(account.availablePoints || 0) < Number(account.minimumPoints || 100) || maxSelectable < Number(account.minimumPoints || 100) || total <= 0) return null;

  const content = <section className="checkout-card checkout-loyalty-card">
    <style>{`.checkout-loyalty-card{border:1px solid #ded7c8;background:linear-gradient(180deg,#fffdf8 0%,#fff 100%);box-shadow:0 6px 22px rgba(0,0,0,.035)}.checkout-loyalty-head{display:flex;align-items:flex-start;gap:12px}.checkout-loyalty-icon{width:38px;height:38px;border-radius:9px;background:#f4ecdc;color:#a37829;display:grid;place-items:center;flex:none}.checkout-loyalty-head h2{font-size:16px;margin:5px 0 5px}.checkout-loyalty-head p{font-size:11px;color:#777;margin:0;line-height:1.5}.checkout-loyalty-head strong{color:#7c5a22}.checkout-loyalty-picker{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:18px}.points-stepper{display:flex;align-items:center;gap:9px}.points-stepper button{width:30px;height:30px;border:1px solid #d7d1c5;background:#fff;border-radius:5px;display:grid;place-items:center;cursor:pointer;color:#76551f}.points-stepper button:disabled{opacity:.4;cursor:not-allowed}.points-stepper strong{font-size:18px;min-width:55px;text-align:center}.points-stepper span{font-size:10px;color:#777}.checkout-loyalty-benefit{display:flex;align-items:center;gap:6px;color:#9b7226}.checkout-loyalty-benefit strong{font-size:18px}.checkout-loyalty-benefit span{font-size:10px;color:#777}.checkout-loyalty-quick{display:flex;gap:6px;margin-top:11px}.checkout-loyalty-quick button{border:1px solid #ddd6c9;background:#fff;padding:6px 10px;border-radius:4px;font-size:9px;font-weight:800;cursor:pointer;color:#666}.checkout-loyalty-quick button.active{border-color:#b1832f;background:#fbf7ed;color:#8c6624}.checkout-loyalty-use{width:100%;margin-top:13px;display:flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:5px;background:#151515;color:#fff;padding:12px;font-size:10px;font-weight:900;letter-spacing:.65px;cursor:pointer}.checkout-loyalty-use:disabled{opacity:.55;cursor:wait}.checkout-loyalty-rule{display:block;margin-top:9px;color:#888;font-size:9px;text-align:center}.checkout-loyalty-reserved{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;padding:12px;background:#f7f3e9;border:1px solid #e4d9c0;border-radius:6px}.checkout-loyalty-reserved>div{display:flex;align-items:center;gap:8px;color:#876322}.checkout-loyalty-reserved>div>svg{flex:none}.checkout-loyalty-reserved span{display:flex;flex-direction:column;gap:3px}.checkout-loyalty-reserved strong{font-size:11px}.checkout-loyalty-reserved small{font-size:9px;color:#777}.checkout-loyalty-reserved button{display:flex;align-items:center;gap:4px;border:0;background:transparent;color:#777;font-size:9px;font-weight:800;cursor:pointer}.checkout-loyalty-error{margin-top:10px;padding:9px 11px;border-radius:5px;background:#fff5f5;border:1px solid #ead4d4;color:#985050;font-size:9px;font-weight:700}@media(max-width:760px){.checkout-loyalty-picker{align-items:stretch;flex-direction:column}.checkout-loyalty-benefit{justify-content:center}.checkout-loyalty-quick{justify-content:center}}`}</style>
    <div className="checkout-loyalty-head"><div className="checkout-loyalty-icon"><Gift size={19}/></div><div><span className="checkout-eyebrow">CAPITÃO PONTOS</span><h2>Use seus pontos nesta compra</h2><p>Você tem <strong>{Number(account.availablePoints || 0).toLocaleString('pt-BR')} pontos</strong> disponíveis ({money(Number(account.availableValue || 0))}).</p></div></div>
    {reservation ? <div className="checkout-loyalty-reserved"><div><Check size={17}/><span><strong>{reservation.points?.toLocaleString('pt-BR')} pontos reservados</strong><small>Desconto de {money(Number(reservation.value || 0))} aplicado ao pedido.</small></span></div><button type="button" onClick={release} disabled={working}><X size={14}/> Retirar</button></div> : <>
      <div className="checkout-loyalty-picker"><div className="points-stepper"><button type="button" aria-label="Diminuir pontos" disabled={points <= 100 || working} onClick={() => setPoints(value => Math.max(100, value - 100))}><Minus size={15}/></button><strong>{points.toLocaleString('pt-BR')}</strong><span>pontos</span><button type="button" aria-label="Aumentar pontos" disabled={points >= maxSelectable || working} onClick={() => setPoints(value => Math.min(maxSelectable, value + 100))}><Plus size={15}/></button></div><div className="checkout-loyalty-benefit"><Sparkles size={15}/><strong>{money(discount)}</strong><span>de desconto</span></div></div>
      {quickValues.length > 1 && <div className="checkout-loyalty-quick">{quickValues.map(value => <button type="button" key={value} className={points === value ? 'active' : ''} onClick={() => setPoints(value)}>{value.toLocaleString('pt-BR')}</button>)}</div>}
      <button type="button" className="checkout-loyalty-use" onClick={reserve} disabled={!canRedeem}><ShieldCheck size={15}/>{working ? 'RESERVANDO...' : `USAR ${points.toLocaleString('pt-BR')} PONTOS`}</button>
      <small className="checkout-loyalty-rule">1 ponto = R$ 0,05 • resgate mínimo de 100 pontos • limite pelo valor do pedido.</small>
    </>}
    {message && <div className="checkout-loyalty-error">{message}</div>}
  </section>;

  return createPortal(content, mount);
}

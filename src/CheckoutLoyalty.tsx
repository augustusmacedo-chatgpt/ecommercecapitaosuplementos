import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Gift, Minus, Plus, ShieldCheck, Sparkles, X } from 'lucide-react';

const SESSION_KEY = 'capitao-customer-session';
const RESERVATION_KEY = 'capitao-points-reservation';

type AccountResponse = { enabled?: boolean; minimumPoints?: number; availablePoints?: number; availableValue?: number; reservedPoints?: number; error?: string };
type ReservationResponse = { reserved?: boolean; reservationId?: string; points?: number; value?: number; expiresAt?: string; availablePoints?: number; error?: string };

function price(value: string) { const normalized = String(value).replace(/[^0-9,]/g, '').replace(/\./g, '').replace(',', '.'); const n = Number(normalized); return Number.isFinite(n) ? n : 0; }
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
    let active = true;
    const target = document.createElement('div');
    target.id = 'checkout-loyalty-mount';
    const main = document.querySelector('.checkout-main');
    const submit = document.querySelector('.checkout-submit');
    if (!main || !submit) return;
    main.insertBefore(target, submit);
    setMount(target);
    return () => { active = false; target.remove(); };
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
    if (!reservation?.reservationId) return;
    const originalFetch = window.fetch.bind(window);
    const patched = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (!url.includes('/api/bling/order') || !init?.body || typeof init.body !== 'string') return originalFetch(input, init);
      try {
        const body = JSON.parse(init.body);
        body.loyalty = { ...(body.loyalty || {}), reservationId: reservation.reservationId };
        return originalFetch(input, { ...init, body: JSON.stringify(body) });
      } catch { return originalFetch(input, init); }
    };
    window.fetch = patched as typeof window.fetch;
    return () => { window.fetch = originalFetch; };
  }, [reservation?.reservationId]);

  const canRedeem = Boolean(account?.enabled && maxSelectable >= Number(account?.minimumPoints || 100) && !reservation && !working);
  const quickValues = useMemo(() => {
    const values = [100, 200, 500, 1000];
    return values.filter(value => value <= maxSelectable).slice(0, 4);
  }, [maxSelectable]);

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

  if (!mount || loading || !account?.enabled || Number(account.availablePoints || 0) < Number(account.minimumPoints || 100) || total <= 0) return null;

  const content = <section className="checkout-card checkout-loyalty-card">
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

import { useState } from 'react';
import { ArrowLeft, LockKeyhole, ShieldCheck } from 'lucide-react';

export default function ReconnectPage() {
  const [email, setEmail] = useState(localStorage.getItem('capitao-verified-email') || '');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    setLoading(true); setMessage('');
    try {
      const r = await fetch('/api/customers/request-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim().toLowerCase() }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setMessage(data.error || 'Não foi possível renovar sua sessão.'); return; }
      setStep('code'); setMessage(`Novo código enviado para ${data.maskedEmail || 'seu e-mail'}.`);
    } catch { setMessage('Não foi possível conectar ao servidor.'); } finally { setLoading(false); }
  }

  async function verify() {
    setLoading(true); setMessage('');
    try {
      const normalized = email.trim().toLowerCase();
      const r = await fetch('/api/customers/verify-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: normalized, code }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setMessage(data.error || 'Código inválido ou expirado.'); return; }
      localStorage.setItem('capitao-verified-email', normalized);
      if (data.sessionToken) localStorage.setItem('capitao-customer-session', data.sessionToken);
      if (data.customerId) localStorage.setItem('capitao-customer-id', data.customerId);
      localStorage.setItem('capitao-verified-at', String(Date.now()));
      location.replace('/checkout');
    } catch { setMessage('Não foi possível conectar ao servidor.'); } finally { setLoading(false); }
  }

  return <main className="reconnect-page"><style>{styles}</style>
    <div className="reconnect-brand"><img src="/Logo_Capitao_Esportivo.png" alt="Capitão Suplementos" /><span>ASSUMA O COMANDO.</span></div>
    <section className="reconnect-card">
      <div className="reconnect-icon">{step === 'email' ? <LockKeyhole size={25}/> : <ShieldCheck size={27}/>}</div>
      <span className="reconnect-eyebrow">{step === 'email' ? 'SESSION EXPIRED' : 'SECURE RECONNECTION'}</span>
      <h1>{step === 'email' ? 'Sua sessão foi encerrada.' : 'Confirme sua identidade novamente.'}</h1>
      <p>{step === 'email' ? 'Informe seu e-mail para receber um novo código de acesso.' : 'Enviamos um novo código de segurança para o seu e-mail. Digite-o abaixo para voltar ao checkout.'}</p>
      {step === 'email' ? <>
        <label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Digite seu e-mail" autoComplete="email" /></label>
        <button className="reconnect-primary" onClick={sendCode} disabled={loading || !email.includes('@')}>{loading ? 'ENVIANDO CÓDIGO...' : 'RENOVAR MINHA SESSÃO'}</button>
      </> : <>
        <div className="reconnect-destination">Código enviado para <strong>{email.trim().toLowerCase()}</strong></div>
        <label>Código de 6 dígitos<input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000" inputMode="numeric" autoFocus /></label>
        <button className="reconnect-primary" onClick={verify} disabled={loading || code.length !== 6}>{loading ? 'VALIDANDO...' : 'RECONNECTAR E CONTINUAR'}</button>
        <button className="reconnect-resend" onClick={sendCode} disabled={loading}>REENVIAR CÓDIGO</button>
      </>}
      {message && <div className={`reconnect-message ${message.includes('enviado') ? 'success' : 'error'}`}>{message}</div>}
      <div className="reconnect-security"><ShieldCheck size={15}/><span>Sua sacola permanece salva durante a reconexão.</span></div>
      <a className="reconnect-back" href="/"><ArrowLeft size={14}/> Voltar para a loja</a>
    </section>
    <footer>CAPITÃO SUPLEMENTOS · MANAUS/AM</footer>
  </main>;
}

const styles = `
.reconnect-page{min-height:100vh;background:#0e0e0e;color:#fff;display:flex;flex-direction:column;align-items:center;padding:45px 20px 25px;box-sizing:border-box}.reconnect-brand{text-align:center;margin-bottom:38px}.reconnect-brand img{display:block;width:190px;max-height:78px;object-fit:contain;margin:0 auto 10px}.reconnect-brand span{font-size:9px;letter-spacing:2.2px;color:#b99042;font-weight:900}.reconnect-card{width:min(100%,520px);box-sizing:border-box;background:#171717;border:1px solid #303030;border-radius:10px;padding:40px;box-shadow:0 25px 70px rgba(0,0,0,.35);text-align:center}.reconnect-icon{width:58px;height:58px;border-radius:50%;margin:0 auto 18px;display:grid;place-items:center;background:#211d16;border:1px solid #4a3a20;color:#c9a15a}.reconnect-eyebrow{font-size:9px;font-weight:900;letter-spacing:1.8px;color:#b99042}.reconnect-card h1{font-size:28px;line-height:1.12;letter-spacing:-.6px;margin:10px 0 12px}.reconnect-card>p{color:#aaa;font-size:13px;line-height:1.65;margin:0 auto 25px;max-width:420px}.reconnect-card label{display:flex;flex-direction:column;text-align:left;gap:7px;color:#bbb;font-size:10px;font-weight:800;letter-spacing:.4px;margin-bottom:14px}.reconnect-card input{width:100%;box-sizing:border-box;background:#101010;border:1px solid #393939;border-radius:5px;color:#fff;padding:13px;font:inherit;font-size:14px;outline:none}.reconnect-card input:focus{border-color:#b99042;box-shadow:0 0 0 2px rgba(185,144,66,.12)}.reconnect-primary{width:100%;border:0;border-radius:5px;background:#b99042;color:#101010;padding:14px 18px;font-size:10px;font-weight:950;letter-spacing:.8px;cursor:pointer}.reconnect-primary:disabled{opacity:.55;cursor:not-allowed}.reconnect-resend{border:0;background:none;color:#b99042;font-size:10px;font-weight:800;letter-spacing:.5px;margin-top:15px;cursor:pointer}.reconnect-destination{background:#111;border:1px solid #303030;border-radius:5px;padding:11px;margin-bottom:15px;color:#888;font-size:10px}.reconnect-message{margin-top:15px;border-radius:5px;padding:10px;font-size:10px}.reconnect-message.success{background:#132219;color:#8bc79a}.reconnect-message.error{background:#261818;color:#d99a9a}.reconnect-security{display:flex;align-items:center;justify-content:center;gap:7px;border-top:1px solid #2a2a2a;margin-top:25px;padding-top:17px;color:#777;font-size:9px}.reconnect-back{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:20px;color:#999;text-decoration:none;font-size:10px;font-weight:700}.reconnect-page footer{margin-top:30px;color:#555;font-size:8px;letter-spacing:1px}`;

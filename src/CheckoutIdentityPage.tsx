import { useState } from 'react';
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react';

export default function CheckoutIdentityPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    setLoading(true); setMessage('');
    try {
      const normalized = email.trim().toLowerCase();
      const r = await fetch('/api/customers/request-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: normalized }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setMessage(data.error || 'Não foi possível enviar o código.'); return; }
      setStep('code'); setMessage(`Código enviado para ${data.maskedEmail || 'seu e-mail'}.`);
    } catch { setMessage('Não foi possível conectar ao servidor.'); } finally { setLoading(false); }
  }

  async function verify() {
    setLoading(true); setMessage('');
    try {
      const normalized = email.trim().toLowerCase();
      const r = await fetch('/api/customers/verify-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: normalized, code }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setMessage(data.error || 'Código inválido ou expirado.'); return; }
      localStorage.removeItem('capitao-verified-document');
      localStorage.setItem('capitao-verified-email', normalized);
      if (data.sessionToken) localStorage.setItem('capitao-customer-session', data.sessionToken);
      if (data.customerId) localStorage.setItem('capitao-customer-id', data.customerId);
      localStorage.setItem('capitao-verified-at', String(Date.now()));
      location.href = data.existingCustomer === false ? '/checkout' : '/checkout';
    } catch { setMessage('Não foi possível conectar ao servidor.'); } finally { setLoading(false); }
  }

  return <main className="identity-page container"><div className="identity-card">
    <a href="/" className="checkout-identity-back"><ArrowLeft size={15}/> VOLTAR PARA A COMPRA</a>
    <div className="identity-icon"><ShieldCheck size={25}/></div><span className="identity-eyebrow">COMPRA SEGURA</span>
    <h1>Acesse sua conta</h1><p>{step === 'email' ? 'Informe seu e-mail para receber um código de acesso.' : 'Digite o código recebido no seu e-mail.'}</p>
    {step === 'email' ? <>
      <div className="identity-hint"><Mail size={14}/> Não usamos senha. O acesso é confirmado por código enviado ao seu e-mail.</div>
      <input type="email" placeholder="Digite seu e-mail" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" />
      <button className="auth-submit" onClick={sendCode} disabled={loading || !email.includes('@')}>{loading?'ENVIANDO CÓDIGO...':'ENVIAR CÓDIGO'}</button>
    </> : <>
      <div className="identity-destination">Código enviado para <strong>{email.trim().toLowerCase()}</strong>.</div>
      <input inputMode="numeric" placeholder="Código de 6 dígitos" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} autoFocus />
      <button className="auth-submit" onClick={verify} disabled={loading || code.length !== 6}>{loading?'VALIDANDO...':'CONFIRMAR CÓDIGO'}</button>
      <button className="forgot-link" onClick={sendCode} disabled={loading}>REENVIAR CÓDIGO</button>
      <div className="identity-spam">Não encontrou o código? Verifique também a pasta de <strong>Spam / Lixo eletrônico</strong>.</div>
    </>}
    {message && <div className={message.includes('enviado')?'auth-success':'auth-error'}>{message}</div>}
  </div></main>;
}

const style = document.createElement('style');
style.textContent = `.identity-card{position:relative}.checkout-identity-back{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;box-sizing:border-box;padding:12px 16px;margin-bottom:24px;border:1px solid #d6d6d6;border-radius:4px;background:#fff;color:#171717;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:.3px}.identity-icon{width:54px;height:54px;border-radius:50%;margin:0 auto 15px;background:#f4ecdc;color:#b1832f;display:grid;place-items:center}.identity-eyebrow{display:block;text-align:center;font-size:10px;font-weight:900;letter-spacing:1.5px;color:#b1832f}.identity-hint{display:flex;align-items:center;gap:7px;font-size:11px;color:#777;line-height:1.45;margin:20px 0 10px;text-align:left}.identity-destination{background:#f8f8f8;border:1px solid #e4e4e4;border-radius:5px;padding:11px;margin:15px 0;font-size:10px;color:#777}.identity-spam{margin-top:14px;padding:11px;background:#fafafa;border:1px solid #eee;border-radius:5px;color:#777;font-size:10px;line-height:1.45}`;
document.head.appendChild(style);

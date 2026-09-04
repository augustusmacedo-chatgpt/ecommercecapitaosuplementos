import { useState } from 'react';
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react';

function maskDocument(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return d.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export default function CheckoutIdentityPage() {
  const [mode, setMode] = useState<'document' | 'email'>('document');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'identify' | 'code'>('identify');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  function switchMode(next: 'document' | 'email') { setMode(next); setIdentifier(''); setMessage(''); }
  async function sendCode() {
    setLoading(true); setMessage('');
    try {
      const body = mode === 'email' ? { email: identifier.trim().toLowerCase() } : { document: identifier };
      const r = await fetch('/api/customers/request-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setMessage(data.error || 'Não foi possível enviar o código.'); return; }
      setStep('code'); setMessage(`Código enviado para ${data.maskedEmail || 'seu e-mail'}.`);
    } catch { setMessage('Não foi possível conectar ao servidor.'); } finally { setLoading(false); }
  }
  async function verify() {
    setLoading(true); setMessage('');
    try {
      const body = mode === 'email' ? { email: identifier.trim().toLowerCase(), code } : { document: identifier, code };
      const r = await fetch('/api/customers/verify-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setMessage(data.error || 'Código inválido ou expirado.'); return; }
      localStorage.removeItem('capitao-verified-document'); localStorage.removeItem('capitao-verified-email');
      if (data.document) localStorage.setItem('capitao-verified-document', data.document);
      if (data.email) localStorage.setItem('capitao-verified-email', data.email);
      if (data.sessionToken) localStorage.setItem('capitao-customer-session', data.sessionToken);
      localStorage.setItem('capitao-verified-at', String(Date.now()));
      location.href = '/checkout';
    } catch { setMessage('Não foi possível conectar ao servidor.'); } finally { setLoading(false); }
  }
  const valid = mode === 'email' ? identifier.includes('@') : identifier.replace(/\D/g, '').length >= 11;
  return <main className="identity-page container"><div className="identity-card">
    <a href="/" className="checkout-identity-back"><ArrowLeft size={15}/> VOLTAR PARA A COMPRA</a>
    <div className="identity-icon"><ShieldCheck size={25}/></div><span className="identity-eyebrow">COMPRA SEGURA</span>
    <h1>Finalize sua venda</h1><p>{step === 'identify' ? 'Confirme sua identidade para continuar sua compra.' : 'Digite o código recebido no seu e-mail.'}</p>
    {step === 'identify' ? <><div className="identity-mode"><button type="button" className={mode==='document'?'active':''} onClick={()=>switchMode('document')}>CPF / CNPJ</button><button type="button" className={mode==='email'?'active':''} onClick={()=>switchMode('email')}><Mail size={14}/> E-MAIL</button></div><div className="identity-hint">{mode==='document' ? 'Já possui cadastro? Consulte pelo CPF ou CNPJ.' : 'Use seu e-mail para receber o código.'}</div><input type={mode==='email'?'email':'text'} placeholder={mode==='email'?'Digite seu e-mail':'Digite seu CPF/CNPJ'} value={identifier} onChange={e=>setIdentifier(mode==='email'?e.target.value:maskDocument(e.target.value))} autoComplete="email" /><button className="auth-submit" onClick={sendCode} disabled={loading || !valid}>{loading?'ENVIANDO CÓDIGO...':'ENVIAR CÓDIGO'}</button></> : <><div className="identity-destination">Código enviado para <strong>seu e-mail</strong>.</div><input inputMode="numeric" placeholder="Código de 6 dígitos" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} autoFocus /><button className="auth-submit" onClick={verify} disabled={loading || code.length !== 6}>{loading?'VALIDANDO...':'CONFIRMAR CÓDIGO'}</button><button className="forgot-link" onClick={sendCode} disabled={loading}>REENVIAR CÓDIGO</button><div className="identity-spam">Não encontrou o código? Verifique também a pasta de <strong>Spam / Lixo eletrônico</strong>.</div></>}
    {message && <div className={message.includes('enviado')?'auth-success':'auth-error'}>{message}</div>}
  </div></main>;
}
const style = document.createElement('style');
style.textContent = `.identity-card{position:relative}.checkout-identity-back{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;box-sizing:border-box;padding:12px 16px;margin-bottom:24px;border:1px solid #d6d6d6;border-radius:4px;background:#fff;color:#171717;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:.3px}.checkout-identity-back:hover{background:#f5f5f5}.identity-icon{width:54px;height:54px;border-radius:50%;margin:0 auto 15px;background:#f4ecdc;color:#b1832f;display:grid;place-items:center}.identity-eyebrow{display:block;text-align:center;font-size:10px;font-weight:900;letter-spacing:1.5px;color:#b1832f}.identity-mode{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:20px 0 10px}.identity-mode button{height:42px;border:1px solid #d7d7d7;background:#fff;border-radius:5px;font-size:10px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}.identity-mode button.active{border-color:#b1832f;background:#fbf8f0;color:#8f6825;box-shadow:0 0 0 1px #b1832f}.identity-hint{font-size:11px;color:#777;line-height:1.45;margin:0 0 10px;text-align:left}.identity-destination{background:#f8f8f8;border:1px solid #e4e4e4;border-radius:5px;padding:11px;margin:15px 0;font-size:10px;color:#777}.identity-spam{margin-top:14px;padding:11px;background:#fafafa;border:1px solid #eee;border-radius:5px;color:#777;font-size:10px;line-height:1.45}.identity-spam strong{color:#333}@media(max-width:480px){.identity-mode button{font-size:9px}}`;
document.head.appendChild(style);

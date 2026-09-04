import { useState } from 'react';
import { ArrowLeft, LockKeyhole, ShieldCheck } from 'lucide-react';

function mask(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return d.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export default function ReconnectPage() {
  const [document, setDocument] = useState(localStorage.getItem('capitao-verified-document') || '');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'document' | 'code'>('document');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    setLoading(true); setMessage('');
    const r = await fetch('/api/customers/request-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document }) });
    const data = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) { setMessage(data.error || 'Não foi possível renovar sua sessão.'); return; }
    setStep('code');
    setMessage(`Novo código enviado para ${data.maskedEmail || 'seu e-mail'}.`);
  }

  async function verify() {
    setLoading(true); setMessage('');
    const r = await fetch('/api/customers/verify-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document, code }) });
    const data = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) { setMessage(data.error || 'Código inválido ou expirado.'); return; }
    const normalized = document.replace(/\D/g, '');
    localStorage.setItem('capitao-verified-document', normalized);
    localStorage.setItem('capitao-verified-at', String(Date.now()));
    location.replace('/checkout');
  }

  return <main className="reconnect-page"><style>{styles}</style>
    <div className="reconnect-brand"><img src="/Logo_Capitao_Esportivo.png" alt="Capitão Suplementos" /><span>ASSUMA O COMANDO.</span></div>
    <section className="reconnect-card">
      <div className="reconnect-icon">{step === 'document' ? <LockKeyhole size={25}/> : <ShieldCheck size={27}/>}</div>
      <span className="reconnect-eyebrow">{step === 'document' ? 'SESSION EXPIRED' : 'SECURE RECONNECTION'}</span>
      <h1>{step === 'document' ? 'Sua sessão foi encerrada.' : 'Confirme sua identidade novamente.'}</h1>
      <p>{step === 'document' ? 'Você foi desconectado para sua segurança. Seu carrinho continua salvo e você pode renovar sua sessão sem perder nenhum produto.' : 'Enviamos um novo código de segurança para o e-mail cadastrado. Digite-o abaixo para voltar ao seu checkout.'}</p>
      {step === 'document' ? <>
        <label>CPF ou CNPJ<input value={document} onChange={e=>setDocument(mask(e.target.value))} placeholder="Digite seu CPF/CNPJ" inputMode="numeric" /></label>
        <button className="reconnect-primary" onClick={sendCode} disabled={loading || document.replace(/\D/g,'').length < 11}>{loading ? 'ENVIANDO CÓDIGO...' : 'RENOVAR MINHA SESSÃO'}</button>
      </> : <>
        <div className="reconnect-destination">Código enviado para <strong>seu e-mail cadastrado</strong></div>
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
.reconnect-page{min-height:100vh;background:#0e0e0e;color:#fff;display:flex;flex-direction:column;align-items:center;padding:45px 20px 25px;box-sizing:border-box}.reconnect-brand{text-align:center;margin-bottom:38px}.reconnect-brand img{display:block;width:190px;max-height:78px;object-fit:contain;margin:0 auto 10px}.reconnect-brand span{font-size:9px;letter-spacing:2.2px;color:#b99042;font-weight:900}.reconnect-card{width:min(100%,520px);box-sizing:border-box;background:#171717;border:1px solid #303030;border-radius:10px;padding:40px;box-shadow:0 25px 70px rgba(0,0,0,.35);text-align:center}.reconnect-icon{width:58px;height:58px;border-radius:50%;margin:0 auto 18px;display:grid;place-items:center;background:#211d16;border:1px solid #4a3a20;color:#c9a15a}.reconnect-eyebrow{font-size:9px;font-weight:900;letter-spacing:1.8px;color:#b99042}.reconnect-card h1{font-size:28px;line-height:1.12;letter-spacing:-.6px;margin:10px 0 12px}.reconnect-card>p{color:#aaa;font-size:13px;line-height:1.65;margin:0 auto 25px;max-width:420px}.reconnect-card label{display:flex;flex-direction:column;text-align:left;gap:7px;color:#bbb;font-size:10px;font-weight:800;letter-spacing:.4px;margin-bottom:14px}.reconnect-card input{width:100%;box-sizing:border-box;background:#101010;border:1px solid #393939;border-radius:5px;color:#fff;padding:13px;font:inherit;font-size:14px;outline:none}.reconnect-card input:focus{border-color:#b99042;box-shadow:0 0 0 2px rgba(185,144,66,.12)}.reconnect-primary{width:100%;border:0;border-radius:5px;background:#b99042;color:#101010;padding:14px 18px;font-size:10px;font-weight:950;letter-spacing:.8px;cursor:pointer}.reconnect-primary:hover{background:#d0ad68}.reconnect-primary:disabled{opacity:.55;cursor:not-allowed}.reconnect-resend{border:0;background:none;color:#b99042;font-size:10px;font-weight:800;letter-spacing:.5px;margin-top:15px;cursor:pointer}.reconnect-resend:disabled{opacity:.5}.reconnect-destination{background:#111;border:1px solid #303030;border-radius:5px;padding:11px;margin-bottom:15px;color:#888;font-size:10px}.reconnect-destination strong{color:#ddd}.reconnect-message{margin-top:15px;border-radius:5px;padding:10px;font-size:10px;line-height:1.4}.reconnect-message.success{background:#132219;border:1px solid #274b34;color:#8bc79a}.reconnect-message.error{background:#261818;border:1px solid #523030;color:#d99a9a}.reconnect-security{display:flex;align-items:center;justify-content:center;gap:7px;border-top:1px solid #2a2a2a;margin-top:25px;padding-top:17px;color:#777;font-size:9px}.reconnect-security svg{color:#b99042}.reconnect-back{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:20px;color:#999;text-decoration:none;font-size:10px;font-weight:700}.reconnect-back:hover{color:#fff}.reconnect-page footer{margin-top:30px;color:#555;font-size:8px;letter-spacing:1px}@media(max-width:560px){.reconnect-page{padding:28px 14px 20px}.reconnect-brand{margin-bottom:25px}.reconnect-brand img{width:155px}.reconnect-card{padding:30px 22px}.reconnect-card h1{font-size:24px}}
`;

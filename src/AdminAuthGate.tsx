import { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import Admin from './Admin';

type User={id:string;name:string;username:string;email:string;role:'ADMIN'|'OPERATOR'};
type Mode='login'|'recover'|'reset'|'bootstrap';

const css=`
@font-face{font-family:Modpot;src:url('/fonts/modpot-login.otf') format('opentype');font-display:swap}
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

:root{--nie-blue:#1f7dff;--nie-cyan:#4bd9ff;--nie-ice:#eaf7ff;--nie-panel:#07101d}
*{box-sizing:border-box}
.admin-auth-shell{
  min-height:100vh;
  background:
    radial-gradient(circle at 50% 10%,rgba(25,116,255,.16),transparent 29%),
    radial-gradient(circle at 0 100%,rgba(0,93,255,.13),transparent 34%),
    linear-gradient(135deg,#030814 0%,#06101d 48%,#020710 100%);
  color:#f4f8ff;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:20px;
  font-family:Inter,ui-sans-serif,system-ui;
  position:relative;
  overflow:hidden;
}
.admin-auth-shell:before,
.admin-auth-shell:after{content:"";position:fixed;pointer-events:none}
.admin-auth-shell:before{
  width:1100px;height:1100px;left:-740px;bottom:-780px;
  border:1px solid rgba(31,125,255,.55);
  transform:rotate(-42deg);
  box-shadow:0 0 45px rgba(26,108,255,.35),inset 0 0 45px rgba(26,108,255,.08);
}
.admin-auth-shell:after{
  width:900px;height:900px;right:-720px;bottom:-650px;
  border:1px solid rgba(31,125,255,.55);
  transform:rotate(42deg);
  box-shadow:0 0 45px rgba(26,108,255,.35);
}
.admin-auth-card{
  width:min(1020px,100%);
  min-height:min(1320px,calc(100vh - 40px));
  background:
    linear-gradient(180deg,rgba(6,15,28,.94),rgba(2,9,17,.97)),
    radial-gradient(circle at 50% 0%,rgba(30,123,255,.09),transparent 42%);
  border:1px solid rgba(79,185,255,.8);
  border-radius:30px;
  padding:40px 86px 34px;
  box-shadow:
    0 0 0 1px rgba(116,214,255,.08) inset,
    0 0 55px rgba(24,117,255,.18),
    0 35px 110px rgba(0,0,0,.55);
  position:relative;
  z-index:1;
  display:flex;
  flex-direction:column;
  justify-content:center;
}
.admin-auth-card:before{
  content:"";position:absolute;inset:0;border-radius:30px;pointer-events:none;
  background:linear-gradient(115deg,rgba(74,185,255,.07),transparent 20%,transparent 80%,rgba(33,115,255,.06));
}
.admin-auth-brand{
  width:100%;
  display:flex;
  align-items:center;
  justify-content:center;
  margin:0 0 44px;
  position:relative;
  z-index:1;
}
.admin-auth-logo{
  display:block;
  width:min(610px,82vw);
  height:auto;
  max-height:330px;
  object-fit:contain;
  filter:drop-shadow(0 14px 32px rgba(20,115,255,.18));
  user-select:none;
  -webkit-user-drag:none;
}
.admin-auth-content{position:relative;z-index:1;width:min(680px,100%);margin:0 auto}
.admin-auth-side{
  position:absolute;top:42px;width:120px;color:#c8d6e4;font-size:11px;
  font-weight:700;letter-spacing:7px;line-height:2.25;text-transform:uppercase;
}
.admin-auth-side.left{left:34px}.admin-auth-side.right{right:34px;text-align:right}
.admin-auth-side:after{
  content:"";display:block;width:50px;height:2px;background:#47c4ff;margin-top:13px;
  box-shadow:0 0 12px rgba(55,181,255,.7)
}
.admin-auth-side.right:after{margin-left:auto}
.panel-label{
  display:block;color:#5ec8ff;font-size:15px;font-weight:800;letter-spacing:13px;
  text-align:center;margin:0 0 18px;text-transform:uppercase;
}
.admin-auth-card h1{
  font-family:Modpot,Inter,sans-serif;
  font-size:52px;line-height:1;margin:0 0 18px;
  text-align:center;font-weight:700;letter-spacing:1px;color:#f5f7fa;
}
.admin-auth-card p{
  margin:0 auto 30px;color:#c1cbd7;font-size:18px;line-height:1.55;
  text-align:center;max-width:650px;
}
.admin-auth-card label{
  display:block;color:#eef3f8;font-size:17px;font-weight:800;
  margin:18px 0 8px;
}
.admin-auth-input{position:relative;margin-top:12px}
.admin-auth-input input{
  box-sizing:border-box;width:100%;height:64px;
  background:linear-gradient(90deg,rgba(13,27,45,.92),rgba(10,19,32,.96));
  border:1px solid rgba(99,179,238,.7);
  border-radius:15px;color:#fff;padding:0 60px;
  outline:0;font-size:17px;font-family:Inter,sans-serif;
  transition:.18s ease;
  box-shadow:inset 0 0 30px rgba(39,124,220,.04),0 0 0 1px rgba(78,188,255,.03);
}
.admin-auth-input input::placeholder{color:#8a9db5}
.admin-auth-input input:focus{
  border-color:#48d0ff;
  box-shadow:0 0 0 3px rgba(72,208,255,.1),0 0 28px rgba(33,133,255,.14)
}
.admin-auth-input .field-icon{
  position:absolute;left:20px;top:50%;transform:translateY(-50%);
  color:#c6d9eb;pointer-events:none;
}
.admin-auth-input button{
  position:absolute;right:12px;top:50%;transform:translateY(-50%);
  width:40px;height:40px;border:0;background:transparent;color:#c6d9eb;
  display:grid;place-items:center;cursor:pointer;
}
.admin-auth-submit{
  width:100%;height:70px;border:1px solid rgba(81,235,255,.95);
  border-radius:15px;
  background:linear-gradient(100deg,#1d82ff 0%,#3bcfff 50%,#1d52e8 100%);
  color:#06111e;font-family:Modpot,Inter,sans-serif;font-weight:700;
  font-size:22px;letter-spacing:2px;
  display:flex;align-items:center;justify-content:center;gap:16px;
  margin-top:24px;cursor:pointer;
  box-shadow:0 0 24px rgba(45,206,255,.4),0 16px 40px rgba(21,105,255,.25);
  transition:.18s ease;
}
.admin-auth-submit:hover{filter:brightness(1.08);transform:translateY(-1px)}
.admin-auth-submit:disabled{opacity:.55;cursor:not-allowed;transform:none}
.admin-auth-error,.admin-auth-success{
  padding:14px 16px;border-radius:13px;font-size:13px;line-height:1.5;margin:16px 0;text-align:center
}
.admin-auth-error{background:#291719;border:1px solid #6e373d;color:#f0b1b7}
.admin-auth-success{background:#10251e;border:1px solid #275d50;color:#aee7cf}
.admin-auth-link{
  display:block;text-align:center;margin:28px auto 0;border:0;background:transparent;
  color:#68c9ff;font-size:17px;font-weight:800;letter-spacing:2px;cursor:pointer;
}
.admin-auth-link:hover{color:#b6edff}
.admin-auth-muted{
  color:#9baabd!important;font-size:12px!important;text-align:center;
  margin:28px auto 0!important;letter-spacing:.3px;
}
.admin-auth-divider{height:1px;width:48%;margin:28px auto 0;background:linear-gradient(90deg,transparent,#2d78b5,transparent)}
.admin-auth-footer{
  position:absolute;left:38px;right:38px;bottom:30px;z-index:1;
  display:grid;grid-template-columns:1fr 2fr 1fr;gap:20px;align-items:end;
  color:#aeb9c7;text-transform:uppercase;
}
.admin-auth-footer div{font-size:10px;font-weight:700;letter-spacing:5px;line-height:1.7}
.admin-auth-footer div:nth-child(2){text-align:center}.admin-auth-footer div:nth-child(3){text-align:right}
.admin-auth-footer .foot-line{display:block;width:100%;height:1px;background:linear-gradient(90deg,#248fe0,transparent);margin-bottom:12px}
.admin-auth-footer div:nth-child(2) .foot-line{background:linear-gradient(90deg,transparent,#286da4,transparent)}
.admin-auth-footer div:nth-child(3) .foot-line{background:linear-gradient(90deg,transparent,#248fe0)}
.admin-auth-session{position:fixed;right:22px;top:18px;z-index:100;border:1px solid #1f425f;background:#09111be8;color:#d7eaff;border-radius:999px;padding:9px 11px;font-size:10px;display:flex;align-items:center;gap:8px;box-shadow:0 10px 30px #0008}
.admin-auth-session button{border:0;background:transparent;color:#58bfff;display:grid;place-items:center;cursor:pointer;padding:2px}

@media(max-width:900px){
  .admin-auth-card{padding:34px 48px 130px}
  .admin-auth-side{display:none}
  .admin-auth-wordmark{font-size:62px}
}
@media(max-width:620px){
  .admin-auth-shell{padding:10px;align-items:flex-start}
  .admin-auth-card{min-height:calc(100vh - 20px);padding:28px 22px 145px;border-radius:22px}
  .admin-auth-logo{width:min(420px,94vw);max-height:250px}
  .panel-label{font-size:10px;letter-spacing:7px}
  .admin-auth-card h1{font-size:36px}
  .admin-auth-card p{font-size:15px}
  .admin-auth-card label{font-size:16px}
  .admin-auth-input input{height:66px;border-radius:15px;font-size:16px;padding-left:62px}
  .admin-auth-submit{height:72px;font-size:20px}
  .admin-auth-footer{left:22px;right:22px;bottom:22px}
  .admin-auth-footer div{font-size:7px;letter-spacing:2px}
}
`;

function Brand(){
  return <div className="admin-auth-brand">
    <img className="admin-auth-logo" src="/logo-niegpt.png" alt="NIEGPT — Núcleo de Inteligência e Ecossistema" />
  </div>
}

function Footer(){
  return <footer className="admin-auth-footer">
    <div><span className="foot-line"/>NIEGPT<br/>V1.0</div>
    <div><span className="foot-line"/>UM SISTEMA.<br/>INFINITAS POSSIBILIDADES.</div>
    <div><span className="foot-line"/>INTELIGÊNCIA<br/>INOVAÇÃO<br/>EVOLUÇÃO</div>
  </footer>
}

async function call(resource:string,body?:any){
 const r=await fetch('/api/bling/pdv-report?resource='+resource,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const d=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(d.error||'Não foi possível processar o acesso.');
 return d;
}

export default function AdminAuthGate(){
 const [user,setUser]=useState<User|null>(null);
 const [loading,setLoading]=useState(true);
 const [identifier,setIdentifier]=useState('');
 const [password,setPassword]=useState('');
 const [name,setName]=useState('');
 const [username,setUsername]=useState('');
 const [email,setEmail]=useState('');
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const [showPassword,setShowPassword]=useState(false);
 const [mode,setMode]=useState<Mode>(new URLSearchParams(location.search).has('recover')?'reset':'login');

 useEffect(()=>{(async()=>{try{const d=await call('session');setUser(d.user||null)}catch{}finally{setLoading(false)}})()},[]);

 async function login(e:React.FormEvent){
  e.preventDefault();setError('');setSuccess('');setLoading(true);
  try{const d=await call('login',{identifier,password});setUser(d.user);setPassword('')}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível entrar.')}
  finally{setLoading(false)}
 }
 async function recover(e:React.FormEvent){
  e.preventDefault();setError('');setSuccess('');
  try{await call('recover-request',{email:identifier});setSuccess('Se o e-mail estiver cadastrado, enviamos as instruções de recuperação.')}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível solicitar a recuperação.')}
 }
 async function reset(e:React.FormEvent){
  e.preventDefault();setError('');setSuccess('');
  try{await call('recover-reset',{token:new URLSearchParams(location.search).get('recover')||'',password});setSuccess('Senha alterada. Voltando para o login...');setTimeout(()=>location.href='/admin',900)}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível alterar a senha.')}
 }
 async function bootstrap(e:React.FormEvent){
  e.preventDefault();setError('');setSuccess('');setLoading(true);
  try{const d=await call('bootstrap-admin',{name,username,email,password});setUser(d.user);setPassword('')}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível criar o administrador inicial.')}
  finally{setLoading(false)}
 }
 async function logout(){try{await call('logout')}finally{setUser(null);setIdentifier('');setPassword('');setMode('login')}}

 const sideLeft=<aside className="admin-auth-side left">TECNOLOGIA<br/>ESTRATÉGIA<br/>PESSOAS<br/>RESULTADOS</aside>;
 const sideRight=<aside className="admin-auth-side right">CONECTAR<br/>ORGANIZAR<br/>SIMPLIFICAR<br/>ESCALAR</aside>;

 if(loading)return <><style>{css}</style><main className="admin-auth-shell"><section className="admin-auth-card">{sideLeft}{sideRight}<Brand/><div className="admin-auth-content"><p>Verificando acesso ao sistema...</p></div><Footer/></section></main></>;

 if(user?.role==='ADMIN')return <><style>{css}</style><Admin/><div className="admin-auth-session"><ShieldCheck size={14}/> {user.name}<button onClick={logout} title="Sair da administração"><LogOut size={14}/></button></div></>;

 if(user&&user.role!=='ADMIN')return <><style>{css}</style><main className="admin-auth-shell"><section className="admin-auth-card">{sideLeft}{sideRight}<Brand/><div className="admin-auth-content"><span className="panel-label">ÁREA RESTRITA</span><h1>Acesso restrito</h1><p>Este usuário possui acesso operacional, mas não possui permissão para acessar o núcleo administrativo.</p><div className="admin-auth-error">Use uma conta com perfil ADMINISTRADOR para continuar.</div><button className="admin-auth-submit" onClick={logout}>SAIR <LogOut size={20}/></button></div><Footer/></section></main></>;

 const title=mode==='login'?'Entrar na administração':mode==='recover'?'Recuperar acesso':mode==='reset'?'Criar nova senha':'Criar administrador inicial';
 const subtitle=mode==='login'?'Acesso restrito ao sistema NIEGPT. Use seu usuário ou e-mail administrativo.':mode==='recover'?'Informe o e-mail do usuário para receber as instruções de recuperação.':mode==='reset'?'Defina uma nova senha segura para sua conta administrativa.':'Use esta opção apenas para configurar o primeiro administrador do sistema.';

 return <><style>{css}</style><main className="admin-auth-shell"><form className="admin-auth-card" onSubmit={mode==='login'?login:mode==='recover'?recover:mode==='reset'?reset:bootstrap}>
 {sideLeft}{sideRight}<Brand/>
 <div className="admin-auth-content">
 <span className="panel-label">{mode==='login'?'ÁREA RESTRITA':'ACESSO AO NÚCLEO'}</span>
 <h1>{title}</h1><p>{subtitle}</p>
 {error&&<div className="admin-auth-error">⚠️ {error}</div>}
 {success&&<div className="admin-auth-success">✓ {success}</div>}
 {mode==='bootstrap'&&<>
   <label>Nome completo<div className="admin-auth-input"><UserRound className="field-icon" size={25}/><input autoFocus placeholder="Digite seu nome completo" value={name} onChange={e=>setName(e.target.value)} required/></div></label>
   <label>Usuário<div className="admin-auth-input"><UserRound className="field-icon" size={25}/><input placeholder="Digite seu usuário" value={username} onChange={e=>setUsername(e.target.value)} required autoComplete="username"/></div></label>
   <label>E-mail<div className="admin-auth-input"><UserRound className="field-icon" size={25}/><input type="email" placeholder="Digite seu e-mail" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></div></label>
 </>}
 {(mode==='login'||mode==='recover')&&<label>{mode==='login'?'E-mail ou usuário':'E-mail'}<div className="admin-auth-input"><UserRound className="field-icon" size={27}/><input autoFocus placeholder={mode==='login'?'Digite seu e-mail ou usuário':'Digite seu e-mail'} value={identifier} onChange={e=>setIdentifier(e.target.value)} required autoComplete={mode==='login'?'username':'email'}/></div></label>}
 {mode!=='recover'&&<label>{mode==='reset'?'Nova senha':'Senha'}<div className="admin-auth-input"><LockKeyhole className="field-icon" size={26}/><input type={showPassword?'text':'password'} placeholder={mode==='reset'?'Digite sua nova senha':'Digite sua senha'} value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} autoComplete={mode==='login'?'current-password':'new-password'}/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Ocultar senha':'Mostrar senha'}>{showPassword?<EyeOff size={28}/>:<Eye size={28}/>}</button></div></label>}
 <button className="admin-auth-submit" disabled={loading}>{mode==='login'?'ENTRAR NO SISTEMA':mode==='recover'?'ENVIAR INSTRUÇÕES':mode==='reset'?'SALVAR NOVA SENHA':'CRIAR ADMINISTRADOR'} <ArrowRight size={32}/></button>
 {mode==='login'&&<><button type="button" className="admin-auth-link" onClick={()=>{setMode('recover');setError('');setSuccess('')}}>ESQUECI A SENHA</button><div className="admin-auth-divider"/><button type="button" className="admin-auth-link" onClick={()=>{setMode('bootstrap');setError('');setSuccess('')}}>PRIMEIRO ACESSO / CRIAR ADMINISTRADOR</button></>}
 {mode==='recover'&&<button type="button" className="admin-auth-link" onClick={()=>{setMode('login');setError('');setSuccess('')}}>VOLTAR PARA LOGIN</button>}
 {mode==='bootstrap'&&<button type="button" className="admin-auth-link" onClick={()=>{setMode('login');setError('');setSuccess('')}}>JÁ POSSUO ADMINISTRADOR</button>}
 <p className="admin-auth-muted">Acesso administrativo protegido pelo sistema central do NIEGPT.</p>
 </div><Footer/></form></main></>;
}

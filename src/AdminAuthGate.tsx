import { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LogOut, ShieldCheck } from 'lucide-react';
import Admin from './Admin';

type User={id:string;name:string;username:string;email:string;role:'ADMIN'|'OPERATOR'};
type Mode='login'|'recover'|'reset'|'bootstrap';

const css=`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
@font-face{font-family:'Modpot';src:url('/fonts/modpot-login.otf') format('opentype');font-style:normal;font-weight:400 900;font-display:swap;}
:root{--nie-blue:#2189ff;--nie-cyan:#4bc8ff;--nie-ice:#d8f2ff}
.admin-auth-shell{min-height:100vh;background:radial-gradient(circle at 50% 0%,#082243 0,#07111f 38%,#03080f 100%);color:#f4f8ff;display:grid;place-items:center;padding:24px;font-family:Inter,ui-sans-serif,system-ui;position:relative;overflow:hidden}
.admin-auth-shell:before,.admin-auth-shell:after{content:"";position:fixed;pointer-events:none;inset:auto}
.admin-auth-shell:before{width:760px;height:760px;border-radius:50%;top:-470px;left:50%;transform:translateX(-50%);background:radial-gradient(circle,#178cff22 0,#178cff08 42%,transparent 72%)}
.admin-auth-shell:after{width:100%;height:1px;bottom:10%;left:0;background:linear-gradient(90deg,transparent,#178cff66,transparent);box-shadow:0 0 30px #178cff55}
.admin-auth-card{width:min(480px,100%);background:linear-gradient(180deg,#0b121ce8,#080d15f2);border:1px solid #1a3854;border-radius:24px;padding:38px;box-shadow:0 30px 100px #000c,0 0 70px #137ce015;position:relative;z-index:1}
.admin-auth-brand{display:flex;align-items:center;justify-content:center;gap:13px;margin:0 0 30px;color:#e9f5ff}
.admin-auth-symbol{width:58px;height:58px;position:relative;display:grid;place-items:center}
.admin-auth-symbol:before{content:"N";font-family:Modpot,Inter,sans-serif;font-size:50px;font-weight:900;line-height:1;background:linear-gradient(135deg,#55d8ff 0%,#2086ff 52%,#6a63ff 100%);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 0 28px #188dff33}
.admin-auth-symbol:after{content:"✦";position:absolute;right:-6px;top:-8px;color:#63d8ff;font-size:22px;text-shadow:0 0 18px #24a8ff}
.admin-auth-wordmark{font-family:Modpot,Inter,sans-serif;font-size:26px;font-weight:900;letter-spacing:3px;line-height:1}
.admin-auth-wordmark small{display:block;font-family:Modpot,Inter,system-ui;font-size:7px;letter-spacing:3.2px;font-weight:800;color:#74bce7;margin-top:7px;white-space:nowrap}
.admin-auth-card h1{font-size:31px;line-height:1.12;margin:9px 0 11px;font-family:Modpot,Inter,sans-serif;font-weight:800;letter-spacing:-.8px}
.admin-auth-card p{margin:0 0 24px;color:#9eafc0;font-size:13px;line-height:1.7}
.admin-auth-card label{display:block;color:#8da2b6;font-size:10px;font-weight:900;letter-spacing:1px;margin:14px 0}
.admin-auth-input{position:relative;margin-top:7px}
.admin-auth-input input{box-sizing:border-box;width:100%;height:50px;background:#0a111a;border:1px solid #20374b;border-radius:12px;color:#fff;padding:0 14px;outline:0;font-size:14px;transition:.18s ease}
.admin-auth-input input:focus{border-color:#2189ff;box-shadow:0 0 0 3px #2189ff1f,0 0 22px #2189ff0f}
.admin-auth-input button{position:absolute;right:8px;top:7px;width:34px;height:34px;border:0;background:transparent;color:#71899d;display:grid;place-items:center;cursor:pointer}
.admin-auth-submit{width:100%;height:50px;border:1px solid #45baff66;border-radius:12px;background:linear-gradient(135deg,#117de9,#38bfff);color:#03101d;font-family:Modpot,Inter,sans-serif;font-weight:900;font-size:10px;letter-spacing:1.3px;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:22px;cursor:pointer;box-shadow:0 14px 35px #0e8bff25}
.admin-auth-submit:hover{filter:brightness(1.08);transform:translateY(-1px)}
.admin-auth-submit:disabled{opacity:.55;cursor:not-allowed;transform:none}
.admin-auth-error,.admin-auth-success{padding:12px 13px;border-radius:11px;font-size:11px;line-height:1.5;margin:14px 0}
.admin-auth-error{background:#291719;border:1px solid #6e373d;color:#f0b1b7}.admin-auth-success{background:#10251e;border:1px solid #275d50;color:#aee7cf}
.admin-auth-link{display:block;text-align:center;margin:14px auto 0;border:0;background:transparent;color:#66bfff;font-size:10px;font-weight:900;letter-spacing:.7px;cursor:pointer}
.admin-auth-link:hover{color:#a7e5ff}
.admin-auth-muted{color:#62778a!important;font-size:10px!important;text-align:center;margin-top:22px!important}
.admin-auth-session{position:fixed;right:22px;top:18px;z-index:100;border:1px solid #1f425f;background:#09111be8;color:#d7eaff;border-radius:999px;padding:9px 11px;font-size:10px;display:flex;align-items:center;gap:8px;box-shadow:0 10px 30px #0008}
.admin-auth-session button{border:0;background:transparent;color:#58bfff;display:grid;place-items:center;cursor:pointer;padding:2px}
.panel-label{display:block;color:#58bfff;font-size:9px;font-weight:900;letter-spacing:2.6px;margin-bottom:10px}
@media(max-width:560px){.admin-auth-shell{padding:16px}.admin-auth-card{padding:28px 22px;border-radius:20px}.admin-auth-card h1{font-size:25px}.admin-auth-wordmark{font-size:23px}}
`;

function Brand(){return <div className="admin-auth-brand"><div className="admin-auth-symbol"/><div className="admin-auth-wordmark">NIEGPT<small>NÚCLEO DE INTELIGÊNCIA E ECOSSISTEMA</small></div></div>}

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

 if(loading)return <><style>{css}</style><main className="admin-auth-shell"><div className="admin-auth-card"><Brand/><p>Verificando acesso ao núcleo...</p></div></main></>;

 if(user?.role==='ADMIN')return <><style>{css}</style><Admin/><div className="admin-auth-session"><ShieldCheck size={14}/> {user.name}<button onClick={logout} title="Sair da administração"><LogOut size={14}/></button></div></>;

 if(user&&user.role!=='ADMIN')return <><style>{css}</style><main className="admin-auth-shell"><div className="admin-auth-card"><Brand/><span className="panel-label">ACESSO RESTRITO</span><h1>Acesso restrito</h1><p>Este usuário possui acesso operacional, mas não possui permissão para acessar o núcleo administrativo.</p><div className="admin-auth-error">Use uma conta com perfil ADMINISTRADOR para continuar.</div><button className="admin-auth-submit" onClick={logout}>SAIR <LogOut size={16}/></button></div></main></>;

 const title=mode==='login'?'Entrar na administração':mode==='recover'?'Recuperar acesso':mode==='reset'?'Criar nova senha':'Criar administrador inicial';
 const subtitle=mode==='login'?'Acesso administrativo ao núcleo do NIEGPT. Use seu usuário ou e-mail administrativo.':mode==='recover'?'Informe o e-mail do usuário para receber as instruções de recuperação.':mode==='reset'?'Defina uma nova senha segura para sua conta administrativa.':'Use esta opção apenas para configurar o primeiro administrador do sistema.';

 return <><style>{css}</style><main className="admin-auth-shell"><form className="admin-auth-card" onSubmit={mode==='login'?login:mode==='recover'?recover:mode==='reset'?reset:bootstrap}><Brand/><span className="panel-label">ACESSO AO NÚCLEO</span><h1>{title}</h1><p>{subtitle}</p>{error&&<div className="admin-auth-error">⚠️ {error}</div>}{success&&<div className="admin-auth-success">✓ {success}</div>}
 {mode==='bootstrap'&&<><label>Nome completo<div className="admin-auth-input"><input autoFocus value={name} onChange={e=>setName(e.target.value)} required/></div></label><label>Usuário<div className="admin-auth-input"><input value={username} onChange={e=>setUsername(e.target.value)} required autoComplete="username"/></div></label><label>E-mail<div className="admin-auth-input"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></div></label></>}
 {(mode==='login'||mode==='recover')&&<label>{mode==='login'?'E-mail ou usuário':'E-mail'}<div className="admin-auth-input"><input autoFocus value={identifier} onChange={e=>setIdentifier(e.target.value)} required autoComplete={mode==='login'?'username':'email'}/></div></label>}
 {mode!=='recover'&&<label>{mode==='reset'?'Nova senha':'Senha'}<div className="admin-auth-input"><input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} autoComplete={mode==='login'?'current-password':'new-password'}/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Ocultar senha':'Mostrar senha'}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>}
 <button className="admin-auth-submit" disabled={loading}>{mode==='login'?'ENTRAR NO NÚCLEO':mode==='recover'?'ENVIAR INSTRUÇÕES':mode==='reset'?'SALVAR NOVA SENHA':'CRIAR ADMINISTRADOR'} <ArrowRight size={17}/></button>
 {mode==='login'&&<><button type="button" className="admin-auth-link" onClick={()=>{setMode('recover');setError('');setSuccess('')}}>ESQUECI A SENHA</button><button type="button" className="admin-auth-link" onClick={()=>{setMode('bootstrap');setError('');setSuccess('')}}>PRIMEIRO ACESSO / CRIAR ADMINISTRADOR</button></>}
 {mode==='recover'&&<button type="button" className="admin-auth-link" onClick={()=>{setMode('login');setError('');setSuccess('')}}>VOLTAR PARA LOGIN</button>}
 {mode==='bootstrap'&&<button type="button" className="admin-auth-link" onClick={()=>{setMode('login');setError('');setSuccess('')}}>JÁ POSSUO ADMINISTRADOR</button>}
 <p className="admin-auth-muted">Acesso administrativo protegido pelo sistema central do NIEGPT.</p></form></main></>;
}

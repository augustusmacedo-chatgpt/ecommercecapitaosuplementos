import { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, LogOut, ShieldCheck } from 'lucide-react';
import Admin from './Admin';

type User={id:string;name:string;username:string;email:string;role:'ADMIN'|'OPERATOR'};
type Mode='login'|'recover'|'reset'|'bootstrap';

const css=`
.admin-auth-shell{min-height:100vh;background:radial-gradient(circle at 20% 0,#1a1711 0,#0c0d0e 42%,#08090a 100%);color:#f5f2eb;display:grid;place-items:center;padding:24px;font-family:Inter,ui-sans-serif,system-ui}
.admin-auth-card{width:min(440px,100%);background:#121415;border:1px solid #303336;border-radius:22px;padding:34px;box-shadow:0 30px 90px #000b}
.admin-auth-mark{display:flex;align-items:center;gap:10px;color:#c3984d;font-size:11px;font-weight:950;letter-spacing:2px;margin-bottom:24px}
.admin-auth-icon{width:44px;height:44px;display:grid;place-items:center;border-radius:13px;background:#211a10;border:1px solid #5f4721;color:#d3a454}
.admin-auth-card h1{font-size:28px;line-height:1.1;margin:8px 0 10px}
.admin-auth-card p{margin:0 0 22px;color:#92979b;font-size:13px;line-height:1.65}
.admin-auth-card label{display:block;color:#989da2;font-size:10px;font-weight:900;letter-spacing:1px;margin:14px 0}
.admin-auth-input{position:relative;margin-top:7px}
.admin-auth-input input{box-sizing:border-box;width:100%;height:48px;background:#1a1c1e;border:1px solid #34383b;border-radius:10px;color:#fff;padding:0 14px;outline:0;font-size:14px}
.admin-auth-input input:focus{border-color:#bd9149;box-shadow:0 0 0 3px #bd91491f}
.admin-auth-input button{position:absolute;right:8px;top:7px;width:34px;height:34px;border:0;background:transparent;color:#8f959a;display:grid;place-items:center;cursor:pointer}
.admin-auth-submit{width:100%;height:48px;border:0;border-radius:10px;background:linear-gradient(135deg,#b88942,#d0a459);color:#15110a;font-weight:950;font-size:11px;letter-spacing:1.1px;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:20px;cursor:pointer}
.admin-auth-submit:disabled{opacity:.55;cursor:not-allowed}
.admin-auth-error,.admin-auth-success{padding:12px 13px;border-radius:10px;font-size:11px;line-height:1.5;margin:14px 0}
.admin-auth-error{background:#2a1717;border:1px solid #703838;color:#f0b1aa}.admin-auth-success{background:#17251b;border:1px solid #35613f;color:#b3dfba}
.admin-auth-link{display:block;text-align:center;margin:14px auto 0;border:0;background:transparent;color:#c3984d;font-size:10px;font-weight:900;letter-spacing:.6px;cursor:pointer}
.admin-auth-muted{color:#777d82!important;font-size:10px!important;text-align:center;margin-top:20px!important}
.admin-auth-session{position:fixed;right:22px;top:18px;z-index:100;border:1px solid #34373a;background:#161819;color:#d7d9da;border-radius:999px;padding:9px 11px;font-size:10px;display:flex;align-items:center;gap:8px;box-shadow:0 10px 30px #0006}
.admin-auth-session button{border:0;background:transparent;color:#bd9149;display:grid;place-items:center;cursor:pointer;padding:2px}
`;

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

 if(loading)return <><style>{css}</style><main className="admin-auth-shell"><div className="admin-auth-card"><div className="admin-auth-mark">CAPITÃO SUPLEMENTOS • ADMIN</div><p>Verificando acesso ao QG...</p></div></main></>;

 if(user?.role==='ADMIN')return <><style>{css}</style><Admin/><div className="admin-auth-session"><ShieldCheck size={14}/> {user.name}<button onClick={logout} title="Sair da administração"><LogOut size={14}/></button></div></>;

 if(user&&user.role!=='ADMIN')return <><style>{css}</style><main className="admin-auth-shell"><div className="admin-auth-card"><div className="admin-auth-mark"><div className="admin-auth-icon"><LockKeyhole size={20}/></div>CAPITÃO SUPLEMENTOS • ADMIN</div><h1>Acesso restrito</h1><p>Este usuário possui acesso operacional, mas não possui permissão de administrador.</p><div className="admin-auth-error">Use uma conta com perfil ADMINISTRADOR para acessar o QG.</div><button className="admin-auth-submit" onClick={logout}>SAIR <LogOut size={16}/></button></div></main></>;

 const title=mode==='login'?'Entrar na administração':mode==='recover'?'Recuperar acesso':mode==='reset'?'Criar nova senha':'Criar administrador inicial';
 const subtitle=mode==='login'?'Acesso restrito ao QG da Capitão Suplementos. Use seu usuário ou e-mail administrativo.':mode==='recover'?'Informe o e-mail do usuário para receber as instruções de recuperação.':mode==='reset'?'Defina uma nova senha segura para sua conta administrativa.':'Use esta opção apenas para configurar o primeiro administrador do sistema.';

 return <><style>{css}</style><main className="admin-auth-shell"><form className="admin-auth-card" onSubmit={mode==='login'?login:mode==='recover'?recover:mode==='reset'?reset:bootstrap}><div className="admin-auth-mark"><div className="admin-auth-icon"><LockKeyhole size={20}/></div>CAPITÃO SUPLEMENTOS • ADMIN</div><span className="panel-label">ÁREA RESTRITA</span><h1>{title}</h1><p>{subtitle}</p>{error&&<div className="admin-auth-error">⚠️ {error}</div>}{success&&<div className="admin-auth-success">✓ {success}</div>}
 {mode==='bootstrap'&&<><label>Nome completo<div className="admin-auth-input"><input autoFocus value={name} onChange={e=>setName(e.target.value)} required/></div></label><label>Usuário<div className="admin-auth-input"><input value={username} onChange={e=>setUsername(e.target.value)} required autoComplete="username"/></div></label><label>E-mail<div className="admin-auth-input"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></div></label></>}
 {(mode==='login'||mode==='recover')&&<label>{mode==='login'?'E-mail ou usuário':'E-mail'}<div className="admin-auth-input"><input autoFocus value={identifier} onChange={e=>setIdentifier(e.target.value)} required autoComplete={mode==='login'?'username':'email'}/></div></label>}
 {mode!=='recover'&&<label>{mode==='reset'?'Nova senha':'Senha'}<div className="admin-auth-input"><input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} autoComplete={mode==='login'?'current-password':'new-password'}/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Ocultar senha':'Mostrar senha'}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>}
 <button className="admin-auth-submit" disabled={loading}>{mode==='login'?'ENTRAR NO QG':mode==='recover'?'ENVIAR INSTRUÇÕES':mode==='reset'?'SALVAR NOVA SENHA':'CRIAR ADMINISTRADOR'} <ArrowRight size={17}/></button>
 {mode==='login'&&<><button type="button" className="admin-auth-link" onClick={()=>{setMode('recover');setError('');setSuccess('')}}>ESQUECI A SENHA</button><button type="button" className="admin-auth-link" onClick={()=>{setMode('bootstrap');setError('');setSuccess('')}}>PRIMEIRO ACESSO / CRIAR ADMINISTRADOR</button></>}
 {mode==='recover'&&<button type="button" className="admin-auth-link" onClick={()=>{setMode('login');setError('');setSuccess('')}}>VOLTAR PARA LOGIN</button>}
 {mode==='bootstrap'&&<button type="button" className="admin-auth-link" onClick={()=>{setMode('login');setError('');setSuccess('')}}>JÁ POSSUO ADMINISTRADOR</button>}
 <p className="admin-auth-muted">Acesso administrativo protegido pelo mesmo sistema de usuários do PDV.</p></form></main></>;
}

import { useEffect, useState } from 'react';
import { KeyRound, Mail, Pencil, Plus, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';

type Seller = { id: number; name: string };
type User = { id: string; name: string; username: string; email: string; role: 'ADMIN' | 'OPERATOR'; active: boolean; blingSellerId: number | null; blingSellerName: string | null; createdAt: string };
const emptyForm = { name: '', username: '', email: '', password: '', role: 'OPERATOR' as 'ADMIN' | 'OPERATOR', blingSellerId: '', blingSellerName: '' };

async function api(resource: string, options: RequestInit = {}) {
  const response = await fetch(`/api/bling/pdv-report?resource=${resource}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [needsBootstrap, setNeedsBootstrap] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try {
      const data = await api('users'); setUsers(data.users || []); setNeedsBootstrap(!(data.users || []).length);
      const sellerData = await fetch('/api/bling/pdv-sale?resource=sellers', { cache: 'no-store' }).then(r => r.json()); setSellers(sellerData.sellers || []);
    } catch (e) {
      const text = e instanceof Error ? e.message : 'Não foi possível carregar usuários.';
      setError(text); setNeedsBootstrap(text.includes('Acesso administrativo') || text.includes('persistente'));
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function chooseSeller(value: string) { const seller = sellers.find(item => String(item.id) === value); setForm(current => ({ ...current, blingSellerId: value, blingSellerName: seller?.name || '' })); }
  function resetForm() { setForm(emptyForm); setEditing(null); }

  async function save() {
    setSaving(true); setError(''); setMessage('');
    try {
      if (editing) {
        await api('user-update', { method: 'POST', body: JSON.stringify({ id: editing.id, name: form.name, email: form.email, role: form.role, blingSellerId: form.blingSellerId || null, blingSellerName: form.blingSellerName, password: form.password || undefined }) });
        setMessage('Usuário atualizado.');
      } else if (needsBootstrap) {
        await api('bootstrap-admin', { method: 'POST', body: JSON.stringify({ name: form.name, username: form.username, email: form.email, password: form.password }) });
        setMessage('Administrador inicial criado.');
      } else {
        await api('user-create', { method: 'POST', body: JSON.stringify({ ...form, blingSellerId: form.blingSellerId || null }) });
        setMessage('Usuário criado.');
      }
      resetForm(); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar o usuário.'); }
    finally { setSaving(false); }
  }

  async function sendReset(user: User) {
    setError(''); setMessage('');
    try { await api('user-reset', { method: 'POST', body: JSON.stringify({ id: user.id }) }); setMessage(`Link de redefinição enviado para ${user.email}.`); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível enviar a recuperação.'); }
  }

  function edit(user: User) { setEditing(user); setForm({ name: user.name, username: user.username, email: user.email, password: '', role: user.role, blingSellerId: user.blingSellerId ? String(user.blingSellerId) : '', blingSellerName: user.blingSellerName || '' }); }

  return <section className="admin-panel" style={{ marginTop: 18 }}>
    <div className="bling-config-heading">
      <div className="panel-icon"><ShieldCheck size={20} /></div>
      <div><span className="panel-label">PDV • ACESSOS</span><h2>Usuários e vendedores</h2><p>Usuários do PDV são independentes da senha do Bling e podem ser vinculados a um vendedor oficial do ERP.</p></div>
      <button className="admin-primary" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} /> Atualizar</button>
    </div>

    {needsBootstrap && <div style={{ marginTop: 16, padding: 16, border: '1px solid #d8c49a', borderRadius: 14, background: '#fffaf0' }}><strong>Primeiro acesso administrativo</strong><p style={{ margin: '6px 0 0', color: '#666' }}>Crie o administrador inicial. Depois dele, somente administradores poderão cadastrar e alterar usuários.</p></div>}
    {error && <p className="bling-config-error">⚠️ {error}</p>}
    {message && <p style={{ color: '#2f7d4a', fontWeight: 700 }}>{message}</p>}

    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(260px, 1fr)', gap: 16, marginTop: 18 }}>
      <div style={{ padding: 18, border: '1px solid #e9e3d8', borderRadius: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><strong>{editing ? 'Editar usuário' : needsBootstrap ? 'Criar administrador' : 'Novo usuário'}</strong>{editing && <button className="admin-back" onClick={resetForm}>Cancelar</button>}</div>
        <div style={{ display: 'grid', gap: 10 }}>
          <input placeholder="Nome completo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          {!editing && <input placeholder="Usuário de login" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />}
          <input type="email" placeholder="E-mail para recuperação" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input type="password" placeholder={editing ? 'Nova senha (opcional)' : 'Senha (mín. 8 caracteres)'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          {!needsBootstrap && <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as 'ADMIN' | 'OPERATOR' })}><option value="OPERATOR">OPERADOR</option><option value="ADMIN">ADMINISTRADOR</option></select>}
          {!needsBootstrap && <select value={form.blingSellerId} onChange={e => chooseSeller(e.target.value)}><option value="">Vincular vendedor do Bling</option>{sellers.map(seller => <option key={seller.id} value={seller.id}>{seller.name}</option>)}</select>}
          <button className="admin-primary" onClick={save} disabled={saving}><Plus size={15} /> {saving ? 'Salvando...' : editing ? 'Salvar alterações' : needsBootstrap ? 'Criar administrador' : 'Cadastrar usuário'}</button>
        </div>
      </div>

      <div style={{ padding: 18, border: '1px solid #e9e3d8', borderRadius: 16 }}>
        <strong>Usuários cadastrados</strong>
        <div style={{ display: 'grid', gap: 8, marginTop: 14, maxHeight: 310, overflowY: 'auto' }}>
          {!users.length && !loading && <span style={{ color: '#777' }}>Nenhum usuário cadastrado.</span>}
          {users.map(user => <div key={user.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: 12, border: '1px solid #eee', borderRadius: 12 }}>
            <div><strong>{user.name}</strong><div style={{ fontSize: 12, color: '#777', marginTop: 3 }}><UserRound size={12} style={{ verticalAlign: '-2px' }} /> @{user.username} · {user.role === 'ADMIN' ? 'Administrador' : 'Operador'}</div><div style={{ fontSize: 12, color: '#777', marginTop: 2 }}><Mail size={12} style={{ verticalAlign: '-2px' }} /> {user.email}</div><div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>{user.blingSellerName ? `Bling: ${user.blingSellerName}` : 'Bling: vendedor não vinculado'}</div></div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}><button title="Editar" onClick={() => edit(user)}><Pencil size={15} /></button><button title="Enviar redefinição" onClick={() => sendReset(user)}><KeyRound size={15} /></button></div>
          </div>)}
        </div>
      </div>
    </div>
  </section>;
}

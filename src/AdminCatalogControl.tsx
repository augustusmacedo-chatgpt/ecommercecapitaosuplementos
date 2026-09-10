import { useCallback, useState, type CSSProperties } from 'react';
import { Activity, ArrowLeft, Play, RefreshCw, ShieldCheck } from 'lucide-react';

type Health = {
  ok?: boolean;
  storage?: { configured?: boolean };
  catalog?: { indexedProducts?: number; source?: string };
  sync?: { complete?: boolean; nextPage?: number; pagesProcessed?: number; productsProcessed?: number; updatedAt?: string | null };
  concurrency?: { active?: boolean; expiresAt?: number | null };
  rateLimit?: { cooldownActive?: boolean; expiresAt?: number | null; period?: string | null };
  checkedAt?: string;
};

const card: CSSProperties = { border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: 18, background: 'rgba(255,255,255,.03)' };
const button: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, padding: '10px 14px', background: 'rgba(255,255,255,.06)', color: 'inherit', cursor: 'pointer', fontWeight: 700 };

async function readJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
  return data;
}

export default function AdminCatalogControl() {
  const [health, setHealth] = useState<Health | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadHealth = useCallback(async () => {
    setBusy(true); setError('');
    try { setHealth(await readJson('/api/bling/catalog-health')); }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao consultar a saúde do catálogo.'); }
    finally { setBusy(false); }
  }, []);

  const runSync = useCallback(async (restart = false) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const query = restart ? '?reiniciar=1' : '';
      const data = await readJson(`/api/bling/catalog-sync${query}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      setMessage(data?.message || 'Sincronização executada.');
      await loadHealth();
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao sincronizar o catálogo.'); }
    finally { setBusy(false); }
  }, [loadHealth]);

  return (
    <main style={{ minHeight: '100vh', padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, opacity: .65, letterSpacing: '.12em', fontWeight: 800 }}>CAPITÃO SUPLEMENTOS</div>
          <h1 style={{ margin: '6px 0 4px', fontSize: 28 }}>Controle do catálogo</h1>
          <div style={{ opacity: .72 }}>Operação do espelho R2, sincronização controlada e saúde do catálogo.</div>
        </div>
        <a href="/admin" style={{ ...button, textDecoration: 'none' }}><ArrowLeft size={16} /> Voltar ao admin</a>
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14, marginBottom: 16 }}>
        <div style={card}><ShieldCheck size={18} /><div style={{ marginTop: 10, opacity: .7, fontSize: 12 }}>Índice R2</div><strong style={{ fontSize: 24 }}>{health?.catalog?.indexedProducts ?? '—'}</strong><div style={{ opacity: .65, marginTop: 4 }}>{health?.catalog?.source || 'aguardando leitura'}</div></div>
        <div style={card}><RefreshCw size={18} /><div style={{ marginTop: 10, opacity: .7, fontSize: 12 }}>Sincronização</div><strong>{health?.sync?.complete ? 'COMPLETA' : health ? `PÁGINA ${health.sync?.nextPage ?? 1}` : '—'}</strong><div style={{ opacity: .65, marginTop: 4 }}>{health ? `${health.sync?.productsProcessed ?? 0} produtos processados` : 'aguardando leitura'}</div></div>
        <div style={card}><Activity size={18} /><div style={{ marginTop: 10, opacity: .7, fontSize: 12 }}>Operação</div><strong>{health?.concurrency?.active ? 'LOCK ATIVO' : health ? 'LIVRE' : '—'}</strong><div style={{ opacity: .65, marginTop: 4 }}>{health?.rateLimit?.cooldownActive ? 'Cooldown do Bling ativo' : 'Sem cooldown ativo'}</div></div>
      </section>

      <section style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={loadHealth} disabled={busy} style={button}><Activity size={16} /> Consultar saúde</button>
          <button type="button" onClick={() => runSync(false)} disabled={busy} style={button}><Play size={16} /> Rodar próximo lote</button>
          <button type="button" onClick={() => runSync(true)} disabled={busy} style={button}><RefreshCw size={16} /> Novo snapshot</button>
        </div>
        {(message || error) && <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'rgba(255,255,255,.04)' }}>{error || message}</div>}
      </section>

      {health && <section style={card}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Diagnóstico</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, fontSize: 14 }}>
          <div><span style={{ opacity: .65 }}>Storage:</span> {health.storage?.configured ? 'configurado' : 'não configurado'}</div>
          <div><span style={{ opacity: .65 }}>Páginas:</span> {health.sync?.pagesProcessed ?? 0}</div>
          <div><span style={{ opacity: .65 }}>Última atualização:</span> {health.sync?.updatedAt ? new Date(health.sync.updatedAt).toLocaleString('pt-BR') : '—'}</div>
          <div><span style={{ opacity: .65 }}>Cooldown:</span> {health.rateLimit?.cooldownActive ? (health.rateLimit?.period || 'ativo') : 'não'}</div>
          <div><span style={{ opacity: .65 }}>Verificado em:</span> {health.checkedAt ? new Date(health.checkedAt).toLocaleString('pt-BR') : '—'}</div>
        </div>
      </section>}
    </main>
  );
}

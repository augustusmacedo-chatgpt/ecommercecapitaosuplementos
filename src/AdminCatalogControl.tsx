import { useEffect, useState } from 'react';
import { Activity, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';

type Health = {
  storage?: { configured?: boolean };
  catalog?: { indexedProducts?: number };
  sync?: { complete?: boolean; nextPage?: number; pagesProcessed?: number; productsProcessed?: number };
  concurrency?: { active?: boolean; expiresAt?: number };
  rateLimit?: { cooldownActive?: boolean; expiresAt?: number; period?: string | null };
};

type SyncResult = { ok?: boolean; complete?: boolean; state?: { nextPage?: number; pagesProcessed?: number; productsProcessed?: number }; products?: number; message?: string; error?: string };

async function json<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
  return data as T;
}

export default function AdminCatalogControl() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    setError('');
    try {
      const data = await json<Health>(await fetch('/api/bling/catalog-health', { cache: 'no-store' }));
      setHealth(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível consultar a saúde do catálogo.');
    }
  }

  async function sync(restart = false) {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const suffix = restart ? '?reiniciar=1&paginas=5&limite=100' : '?paginas=5&limite=100';
      const data = await json<SyncResult>(await fetch('/api/bling/catalog-sync' + suffix, { method: 'POST', cache: 'no-store' }));
      setMessage(data.message || 'Lote de sincronização concluído.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível sincronizar o catálogo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const syncState = health?.sync;
  return <section className="admin-panel qg-panel">
    <div className="qg-head">
      <div>
        <span className="panel-label">CATÁLOGO OPERACIONAL</span>
        <h2>Saúde e sincronização</h2>
        <p>Controle administrativo do índice R2, sincronização protegida e estado do gateway.</p>
      </div>
      <button onClick={refresh} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} /> ATUALIZAR</button>
    </div>
    <div className="qg-cards">
      <article><small>ÍNDICE R2</small><strong>{health?.catalog?.indexedProducts ?? '—'}</strong><span>{health?.catalog ? 'produtos indexados' : 'sem leitura'}</span></article>
      <article><small>SINCRONIZAÇÃO</small><strong>{syncState?.complete ? 'CONCLUÍDA' : syncState ? `PÁG. ${syncState.nextPage ?? 1}` : '—'}</strong><span>{syncState?.productsProcessed ?? 0} produtos processados</span></article>
      <article><small>LOCK</small><strong>{health?.concurrency?.active ? 'ATIVO' : 'LIVRE'}</strong><span>{health?.concurrency?.active ? 'execução protegida' : 'nenhuma execução concorrente'}</span></article>
      <article><small>RATE LIMIT</small><strong>{health?.rateLimit?.cooldownActive ? 'COOLDOWN' : 'NORMAL'}</strong><span>{health?.rateLimit?.period || 'sem bloqueio'}</span></article>
    </div>
    {(message || error) && <div className={error ? 'qg-error' : 'qg-empty'}>{error || message}</div>}
    <div className="qg-filters" style={{ marginTop: 14 }}>
      <button onClick={() => sync(false)} disabled={loading || health?.concurrency?.active}><ShieldCheck size={15} /> {loading ? 'SINCRONIZANDO...' : 'SINCRONIZAR LOTE'}</button>
      <button onClick={() => sync(true)} disabled={loading || health?.concurrency?.active}><RotateCcw size={15} /> NOVO SNAPSHOT</button>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: .75 }}><Activity size={14} /> {health?.storage?.configured ? 'R2 configurado' : 'R2 não configurado'}</span>
    </div>
  </section>;
}

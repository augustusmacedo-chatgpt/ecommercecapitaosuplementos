import { useEffect } from 'react';

type Product = { id: number; name: string; code?: string; price: number };
type TrackedItem = { product: Product; quantity: number };
type Seller = { id: number; name: string };

const KEY = 'capitao-pdv-sale-guard';
const OFFLINE_QUEUE_KEY = 'capitao-pdv-offline-sales-v1';
const OFFLINE_MAX_AGE = 1000 * 60 * 60 * 24;
type OfflineSale = { checkoutId: string; payload: any; createdAt: number };
function readOfflineQueue(): OfflineSale[] {
  try {
    const value = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    const now = Date.now();
    return Array.isArray(value) ? value.filter((entry: any) => entry?.checkoutId && entry?.payload && now - Number(entry.createdAt || 0) <= OFFLINE_MAX_AGE) : [];
  } catch { return []; }
}
function writeOfflineQueue(queue: OfflineSale[]) {
  try { localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue.slice(-100))); } catch {}
}
function queueOfflineSale(entry: OfflineSale) {
  const queue = readOfflineQueue();
  if (!queue.some(item => item.checkoutId === entry.checkoutId)) queue.push(entry);
  writeOfflineQueue(queue);
}
async function flushOfflineSales(fetcher: typeof fetch) {
  if (!navigator.onLine) return { sent: 0, pending: readOfflineQueue().length };
  const queue = readOfflineQueue();
  if (!queue.length) return { sent: 0, pending: 0 };
  const pending: OfflineSale[] = [];
  let sent = 0;
  for (const entry of queue) {
    try {
      const response = await fetcher('/api/bling/pdv-sale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry.payload) });
      if (!response.ok) { pending.push(entry); continue; }
      sent += 1;
    } catch { pending.push(entry); break; }
  }
  writeOfflineQueue(pending);
  return { sent, pending: pending.length };
}

function clean(value: string) { return value.trim(); }
function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
function money(value: unknown) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function setButtonState(button: HTMLButtonElement, text: string, disabled = false) { button.textContent = text; button.disabled = disabled; }

export default function PdvRealSaleEnhancer() {
  useEffect(() => {
    if (location.pathname !== '/pdv') return;
    let products: Product[] = [];
    let sellers: Seller[] = [];
    const tracked = new Map<number, TrackedItem>();
    let documentChoice: 'nfc' | 'receipt' | null = null;
    let submitting = false;
    const originalFetch = window.fetch.bind(window);

    const loadSellers = async () => {
      try {
        const response = await originalFetch('/api/bling/pdv-sale?resource=sellers', { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(data?.sellers)) throw new Error(data?.error || 'Não foi possível carregar os vendedores do Bling.');
        sellers = data.sellers.map((seller: any) => ({ id: Number(seller.id), name: clean(String(seller.name || '')) })).filter((seller: Seller) => seller.id > 0 && seller.name);
        const select = globalThis.document.querySelector<HTMLSelectElement>('.seller-select');
        if (!select || !sellers.length) return;
        const current = clean(select.value);
        const preferred = sellers.find(seller => normalize(seller.name) === normalize(current)) || sellers[0];
        select.innerHTML = '';
        for (const seller of sellers) { const option = globalThis.document.createElement('option'); option.value = seller.name; option.textContent = seller.name; option.dataset.blingSellerId = String(seller.id); select.appendChild(option); }
        select.value = preferred.name;
      } catch (error) { console.warn('PDV: vendedores do Bling indisponíveis.', error); }
    };
    void loadSellers();
    const syncOfflineSales = () => { void flushOfflineSales(originalFetch).catch(() => {}); };
    syncOfflineSales();
    window.addEventListener('online', syncOfflineSales);
    const offlineSyncTimer = window.setInterval(syncOfflineSales, 30000);

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      try {
        const input = args[0];
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
        if (url.includes('/api/bling/products')) {
          const data = await response.clone().json();
          products = Array.isArray(data?.products) ? data.products.map((p: any) => ({ id: Number(p.id), name: String(p.nome || p.descricaoCurta || 'Produto'), code: p.codigo, price: money(p.preco) })).filter((p: Product) => p.id > 0) : [];
        }
      } catch { /* catálogo não precisa bloquear o PDV */ }
      return response;
    };

    const findProductFromCard = (card: HTMLElement) => {
      const text = normalize(card.innerText || '');
      const candidates = products.filter(p => text.includes(normalize(p.name)));
      if (candidates.length === 1) return candidates[0];
      const priceText = (card.innerText || '').match(/R\$\s*([\d.,]+)/i)?.[1];
      const price = priceText ? money(priceText.replace(/\./g, '').replace(',', '.')) : 0;
      return candidates.find(p => Math.abs(p.price - price) < 0.01) || candidates[0] || null;
    };

    const readCartFromDom = () => {
      const nodes = Array.from(globalThis.document.querySelectorAll<HTMLElement>('.pdv-cart-item'));
      if (!nodes.length) return Array.from(tracked.values()).filter(x => x.quantity > 0);
      const result: TrackedItem[] = [];
      for (const node of nodes) {
        const text = node.innerText || '';
        const strong = node.querySelector('strong');
        const name = clean(strong?.textContent || text.split('\n')[0] || '');
        const product = products.find(p => normalize(p.name) === normalize(name)) || products.find(p => normalize(name).includes(normalize(p.name)));
        if (!product) continue;
        const numbers = Array.from(text.matchAll(/(?:^|\n)\s*(\d+)\s*(?:\n|$)/g)).map(m => Number(m[1])).filter(Number.isFinite);
        const trackedItem = tracked.get(product.id);
        const quantity = trackedItem?.quantity || (numbers.length ? numbers[0] : 1);
        result.push({ product, quantity: Math.max(1, quantity) });
      }
      return result;
    };

    const readCustomer = () => {
      const inputs = Array.from(globalThis.document.querySelectorAll<HTMLInputElement>('.pdv-shell input'));
      const values = inputs.map(input => ({ input, value: clean(input.value), placeholder: normalize(input.placeholder || ''), type: normalize(input.type || '') }));
      const email = values.find(x => x.type === 'email' || x.placeholder.includes('email'))?.value || '';
      const phone = values.find(x => x.type === 'tel' || x.placeholder.includes('telefone') || x.placeholder.includes('celular'))?.value || '';
      const customerDocument = values.find(x => x.placeholder.includes('cpf') || x.placeholder.includes('cnpj') || /^\d[\d.\-/ ]{10,}$/.test(x.value))?.value || '';
      const name = values.find(x => x.placeholder.includes('nome'))?.value || values.find(x => x.type === 'text' && x.value && x.value !== customerDocument && x.value !== phone && x.value !== email)?.value || '';
      return { name, document: customerDocument, phone, email };
    };

    const readLocation = () => { const select = globalThis.document.querySelector<HTMLSelectElement>('.pdv-location select'); return normalize(select?.value || '').includes('newfit') ? 'newfit' : 'camapua'; };
    const readSeller = () => { const select = globalThis.document.querySelector<HTMLSelectElement>('.seller-select'); const name = clean(select?.value || ''); const selectedId = Number(select?.selectedOptions?.[0]?.dataset.blingSellerId || 0); const fallback = sellers.find(seller => normalize(seller.name) === normalize(name)); return { name, id: selectedId || fallback?.id || 0 }; };
    const readPayment = () => clean(globalThis.document.querySelector<HTMLElement>('.pdv-payment.selected')?.innerText || '').replace(/\n+/g, ' | ');
    const readDocumentChoice = () => { const overlay = globalThis.document.querySelector<HTMLElement>('.pdv-overlay'); if (!overlay) return documentChoice; const selected = overlay.querySelector<HTMLElement>('.pdv-doc.selected'); if (!selected) return documentChoice; return normalize(selected.innerText || '').includes('nfc') ? 'nfc' : 'receipt'; };

    const flash = (message: string, error = false) => {
      globalThis.document.getElementById('pdv-real-sale-feedback')?.remove();
      const box = globalThis.document.createElement('div'); box.id = 'pdv-real-sale-feedback'; box.textContent = message;
      box.style.cssText = `position:fixed;right:22px;bottom:22px;z-index:9999;max-width:420px;padding:14px 16px;border-radius:10px;border:1px solid ${error ? '#713d37' : '#66501f'};background:${error ? '#241513' : '#201b10'};color:#fff;font:800 12px/1.45 Inter,system-ui,sans-serif;box-shadow:0 18px 40px #0008`;
      globalThis.document.body.appendChild(box); window.setTimeout(() => box.remove(), 5000);
    };

    const submit = async (button: HTMLButtonElement) => {
      if (submitting) return; submitting = true; setButtonState(button, 'REGISTRANDO VENDA...', true);
      const items = readCartFromDom(), payment = readPayment(), customer = readCustomer(), choice = readDocumentChoice(), seller = readSeller();
      if (!items.length || !payment || !choice || !seller.id) { submitting = false; setButtonState(button, 'CONFIRMAR VENDA'); flash(!seller.id ? 'O vendedor do Bling ainda não foi carregado. Aguarde e tente novamente.' : 'Complete produtos, pagamento e documento antes de finalizar.', true); return; }
      const checkoutId = `PDV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const payload = { checkoutId, location: readLocation(), sellerId: seller.id, sellerName: seller.name, customer, payment, documentChoice: choice, items, total: items.reduce((sum, item) => sum + item.product.price * item.quantity, 0) };
      try {
        if (!navigator.onLine) throw new TypeError('OFFLINE');
        const response = await originalFetch('/api/bling/pdv-sale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'Não foi possível registrar a venda no Bling.');
        sessionStorage.setItem(KEY, JSON.stringify({ checkoutId, orderId: data.orderId, orderNumber: data.orderNumber, location: data.location, sellerId: seller.id, createdAt: new Date().toISOString() }));
        flash(`Venda registrada no Bling${data.orderNumber ? ` • Pedido ${data.orderNumber}` : ''}.`); setButtonState(button, 'VENDA REGISTRADA', true); window.setTimeout(() => globalThis.location.reload(), 1100);
      } catch (error) {
        const networkFailure = !navigator.onLine || error instanceof TypeError || String(error).includes('OFFLINE');
        if (networkFailure) {
          queueOfflineSale({ checkoutId, payload, createdAt: Date.now() });
          sessionStorage.setItem(KEY, JSON.stringify({ checkoutId, location: payload.location, sellerId: seller.id, createdAt: new Date().toISOString(), pendingSync: true }));
          flash('Sem internet: venda guardada com segurança neste caixa. Ela será sincronizada automaticamente quando a conexão voltar.');
          setButtonState(button, 'VENDA SALVA OFFLINE', true);
          window.setTimeout(() => globalThis.location.reload(), 1100);
          return;
        }
        submitting = false; setButtonState(button, 'CONFIRMAR VENDA'); flash(error instanceof Error ? error.message : 'Não foi possível registrar a venda.', true);
      }
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null; if (!target) return;
      const card = target.closest<HTMLElement>('.pdv-product');
      if (card) { const product = findProductFromCard(card); if (product) { const current = tracked.get(product.id); tracked.set(product.id, { product, quantity: (current?.quantity || 0) + 1 }); } return; }
      const step = target.closest<HTMLElement>('.pdv-step button');
      if (step) { const itemNode = step.closest<HTMLElement>('.pdv-cart-item'); const name = normalize(itemNode?.querySelector('strong')?.textContent || ''); const product = products.find(p => normalize(p.name) === name) || products.find(p => name.includes(normalize(p.name))); if (product) { const current = tracked.get(product.id); const delta = normalize(step.textContent || '').includes('+') ? 1 : -1; tracked.set(product.id, { product, quantity: Math.max(0, (current?.quantity || 1) + delta) }); } return; }
      const doc = target.closest<HTMLElement>('.pdv-doc'); if (doc) { documentChoice = normalize(doc.innerText || '').includes('nfc') ? 'nfc' : 'receipt'; return; }
      const button = target.closest<HTMLButtonElement>('button'); if (!button || !globalThis.document.querySelector('.pdv-overlay')?.contains(button)) return;
      const text = normalize(button.innerText || ''); if (text.includes('cancelar') || text.includes('voltar') || text === 'x') return;
      if (text.includes('confirmar') || text.includes('finalizar') || text.includes('emitir') || text.includes('concluir')) void submit(button);
    };

    globalThis.document.addEventListener('click', onClick, true);
    return () => { globalThis.document.removeEventListener('click', onClick, true); window.removeEventListener('online', syncOfflineSales); window.clearInterval(offlineSyncTimer); window.fetch = originalFetch; };
  }, []);
  return null;
}

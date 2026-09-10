import { get, put } from './storage.js';
import { normalizeCatalogProduct, type CatalogProduct } from './catalog.js';

const PRODUCT_PREFIX = 'bling/domain/products/';
const STOCK_PREFIX = 'bling/domain/stocks/';
const CATALOG_INDEX_KEY = 'bling/domain/catalog-index.json';
const MAX_PRODUCT_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_STOCK_AGE_MS = 10 * 60 * 1000;

type MirrorRecord = { id: number; data: any; updatedAt: number };
type CatalogIndexRecord = { version: 1; savedAt: string; products: CatalogProduct[] };

function productKey(id: number) {
  return `${PRODUCT_PREFIX}${id}.json`;
}

function stockKey(id: number) {
  return `${STOCK_PREFIX}${id}.json`;
}

async function readRecord(key: string): Promise<MirrorRecord | null> {
  try {
    const result = await get(key);
    if (!result?.stream) return null;
    const record = JSON.parse(await new Response(result.stream).text()) as MirrorRecord;
    if (!Number.isFinite(record?.id) || !Number.isFinite(record?.updatedAt) || !record?.data) return null;
    return record;
  } catch {
    return null;
  }
}

async function writeRecord(key: string, id: number, data: any) {
  await put(key, JSON.stringify({ id, data, updatedAt: Date.now() }), { contentType: 'application/json' });
}

async function readCatalogIndexRecord(): Promise<CatalogIndexRecord | null> {
  try {
    const result = await get(CATALOG_INDEX_KEY);
    if (!result?.stream) return null;
    const record = JSON.parse(await new Response(result.stream).text()) as CatalogIndexRecord;
    if (record?.version !== 1 || !Array.isArray(record.products)) return null;
    return record;
  } catch {
    return null;
  }
}

async function writeCatalogIndex(products: CatalogProduct[]) {
  await put(CATALOG_INDEX_KEY, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), products }), { contentType: 'application/json' });
}

export async function loadCatalogIndex() {
  const record = await readCatalogIndexRecord();
  return record?.products?.length ? record.products : null;
}

export async function saveCatalogIndex(products: CatalogProduct[]) {
  if (!products.length) return;
  const unique = new Map<number, CatalogProduct>();
  for (const product of products) {
    if (Number.isInteger(product?.id) && product.id > 0) unique.set(product.id, product);
  }
  await writeCatalogIndex([...unique.values()]);
}

export async function upsertCatalogIndex(data: any) {
  const product = normalizeCatalogProduct(data);
  if (!Number.isInteger(product.id) || product.id <= 0) return;
  const record = await readCatalogIndexRecord();
  const products = Array.isArray(record?.products) ? [...record.products] : [];
  const index = products.findIndex(item => item.id === product.id);
  if (index >= 0) products[index] = { ...products[index], ...product };
  else products.push(product);
  await writeCatalogIndex(products);
}

export async function removeCatalogIndex(id: number) {
  if (!Number.isInteger(id) || id <= 0) return;
  const record = await readCatalogIndexRecord();
  if (!record?.products?.length) return;
  const products = record.products.filter(product => product.id !== id);
  if (products.length !== record.products.length) await writeCatalogIndex(products);
}

export async function updateCatalogIndexStock(id: number, stock: any) {
  if (!Number.isInteger(id) || id <= 0) return;
  const record = await readCatalogIndexRecord();
  if (!record?.products?.length) return;
  const index = record.products.findIndex(product => product.id === id);
  if (index < 0) return;

  const current = record.products[index];
  const existingDeposits = Array.isArray(current.estoque?.depositos) ? current.estoque.depositos : [];
  const incomingDeposits = Array.isArray(stock?.depositos) ? stock.depositos : null;
  let deposits = existingDeposits;

  if (incomingDeposits) {
    deposits = incomingDeposits.map((deposit: any) => ({
      id: Number(deposit?.id ?? deposit?.deposito?.id) || undefined,
      nome: deposit?.nome || deposit?.deposito?.nome || undefined,
      saldo: Number(deposit?.saldo ?? deposit?.saldoVirtual ?? deposit?.quantidade ?? 0) || 0,
      quantidade: Number(deposit?.quantidade ?? deposit?.saldoVirtual ?? deposit?.saldo ?? 0) || 0,
      saldoVirtual: Number(deposit?.saldoVirtual ?? deposit?.saldo ?? deposit?.quantidade ?? 0) || 0,
      deposito: {
        id: Number(deposit?.id ?? deposit?.deposito?.id) || undefined,
        nome: deposit?.nome || deposit?.deposito?.nome || undefined,
      },
    }));
  } else {
    const incoming = stock?.deposito;
    const incomingId = Number(incoming?.id) || 0;
    if (incomingId) {
      const patch = {
        id: incomingId,
        saldo: Number(incoming?.saldoVirtual ?? incoming?.saldoFisico ?? stock?.quantidade ?? 0) || 0,
        quantidade: Number(incoming?.saldoVirtual ?? incoming?.saldoFisico ?? stock?.quantidade ?? 0) || 0,
        saldoVirtual: Number(incoming?.saldoVirtual ?? incoming?.saldoFisico ?? stock?.quantidade ?? 0) || 0,
      };
      const existingIndex = existingDeposits.findIndex(deposit => Number(deposit?.id ?? deposit?.deposito?.id) === incomingId);
      deposits = existingIndex >= 0
        ? existingDeposits.map((deposit, depositIndex) => depositIndex === existingIndex ? { ...deposit, ...patch } : deposit)
        : [...existingDeposits, patch];
    }
  }

  const saldoVirtualTotal = Number(stock?.saldoVirtualTotal ?? current.estoque?.saldoVirtualTotal ?? deposits.reduce((sum, item) => sum + Number(item?.saldo ?? item?.quantidade ?? 0), 0)) || 0;
  record.products[index] = {
    ...current,
    stock: saldoVirtualTotal,
    available: saldoVirtualTotal > 0 && current.active,
    estoque: {
      ...current.estoque,
      saldoVirtualTotal,
      depositos: deposits,
    },
  };
  await writeCatalogIndex(record.products);
}

function deepMerge(base: any, patch: any): any {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch === undefined ? base : patch;
  const output = base && typeof base === 'object' && !Array.isArray(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(patch)) {
    output[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? deepMerge(output[key], value)
      : value;
  }
  return output;
}

function applyStock(product: any, stock: any) {
  if (!stock || typeof stock !== 'object') return product;
  const next = { ...product };
  const current = product?.estoque && typeof product.estoque === 'object' ? product.estoque : {};
  const virtualDeposits = Array.isArray(stock.depositos) ? stock.depositos : null;
  if (virtualDeposits) {
    next.estoque = {
      ...current,
      saldoFisicoTotal: Number(stock.saldoFisicoTotal ?? current.saldoFisicoTotal ?? 0) || 0,
      saldoVirtualTotal: Number(stock.saldoVirtualTotal ?? current.saldoVirtualTotal ?? 0) || 0,
      depositos: virtualDeposits.map((deposit: any) => ({
        id: Number(deposit?.id) || undefined,
        saldoFisico: Number(deposit?.saldoFisico ?? 0) || 0,
        saldoVirtual: Number(deposit?.saldoVirtual ?? 0) || 0,
        quantidade: Number(deposit?.saldoVirtual ?? deposit?.saldoFisico ?? 0) || 0,
      })),
    };
    return next;
  }

  const deposit = stock.deposito;
  if (deposit && Number(deposit.id) > 0) {
    const existing = Array.isArray(current.depositos) ? [...current.depositos] : [];
    const id = Number(deposit.id);
    const index = existing.findIndex((item: any) => Number(item?.id ?? item?.deposito?.id) === id);
    const patch = {
      id,
      saldoFisico: Number(deposit.saldoFisico ?? 0) || 0,
      saldoVirtual: Number(deposit.saldoVirtual ?? 0) || 0,
      quantidade: Number(deposit.saldoVirtual ?? deposit.saldoFisico ?? stock.quantidade ?? 0) || 0,
    };
    if (index >= 0) existing[index] = { ...existing[index], ...patch };
    else existing.push(patch);
    next.estoque = {
      ...current,
      saldoFisicoTotal: Number(stock.saldoFisicoTotal ?? current.saldoFisicoTotal ?? 0) || 0,
      saldoVirtualTotal: Number(stock.saldoVirtualTotal ?? current.saldoVirtualTotal ?? 0) || 0,
      depositos: existing,
    };
  } else if (stock.saldoVirtualTotal !== undefined || stock.saldoFisicoTotal !== undefined) {
    next.estoque = {
      ...current,
      saldoFisicoTotal: Number(stock.saldoFisicoTotal ?? current.saldoFisicoTotal ?? 0) || 0,
      saldoVirtualTotal: Number(stock.saldoVirtualTotal ?? current.saldoVirtualTotal ?? 0) || 0,
    };
  }
  return next;
}

export async function loadProductMirror(id: number, allowStale = false) {
  if (!Number.isInteger(id) || id <= 0) return null;
  const product = await readRecord(productKey(id));
  if (!product) return null;
  if (!allowStale && Date.now() - product.updatedAt > MAX_PRODUCT_AGE_MS) return null;
  const stock = await readRecord(stockKey(id));
  const freshStock = stock && (allowStale || Date.now() - stock.updatedAt <= MAX_STOCK_AGE_MS) ? stock.data : null;
  return applyStock(product.data, freshStock);
}

export async function saveProductMirror(id: number, data: any) {
  if (!Number.isInteger(id) || id <= 0 || !data) return;
  const current = await readRecord(productKey(id));
  const merged = current?.data ? deepMerge(current.data, data) : data;
  await writeRecord(productKey(id), id, merged);
  await upsertCatalogIndex(merged);
}

export async function saveStockMirror(id: number, data: any) {
  if (!Number.isInteger(id) || id <= 0 || !data) return;
  await writeRecord(stockKey(id), id, data);
  await updateCatalogIndexStock(id, data);
}

export async function deleteProductMirror(id: number) {
  if (!Number.isInteger(id) || id <= 0) return;
  await writeRecord(productKey(id), id, { __deleted: true });
  await removeCatalogIndex(id);
}

import { get, put } from './storage.js';

const PRODUCT_PREFIX = 'bling/domain/products/';
const STOCK_PREFIX = 'bling/domain/stocks/';
const MAX_PRODUCT_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_STOCK_AGE_MS = 10 * 60 * 1000;

type MirrorRecord = { id: number; data: any; updatedAt: number };

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
}

export async function saveStockMirror(id: number, data: any) {
  if (!Number.isInteger(id) || id <= 0 || !data) return;
  await writeRecord(stockKey(id), id, data);
}

export async function deleteProductMirror(id: number) {
  if (!Number.isInteger(id) || id <= 0) return;
  // R2 storage wrapper intentionally has no delete primitive in the current architecture.
  // Tombstoning keeps deleted IDs from being treated as live data while avoiding a new storage API in this phase.
  await writeRecord(productKey(id), id, { __deleted: true });
}

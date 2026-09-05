import { get, put } from '@vercel/blob';

type Store = 'camapua' | 'newfit';
export type CashSession = { id: string; store: Store; register: string; businessDate: string; openedByUserId: string; openedByName: string; openedAt: string; openingAmount: number; status: 'OPEN' | 'CLOSED'; blingSnapshot?: any };
const key = (store: Store, date: string) => `pdv/cash/${store}/${date}.json`;
const options = { access: 'private' as const, useCache: false };
export async function loadCashSession(store: Store, date: string) { try { const result = await get(key(store, date), options); if (!result?.stream) return null; return JSON.parse(await new Response(result.stream).text()) as CashSession; } catch (error: any) { if (error?.statusCode === 404) return null; throw error; } }
export async function saveCashSession(session: CashSession) { await put(key(session.store, session.businessDate), JSON.stringify(session, null, 2), { ...options, contentType: 'application/json' }); return session; }
export function newCashSession(input: { store: Store; date: string; userId: string; userName: string; openingAmount: number; blingSnapshot?: any }): CashSession { return { id: `cash_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`, store: input.store, register: 'CAIXA 01', businessDate: input.date, openedByUserId: input.userId, openedByName: input.userName, openedAt: new Date().toISOString(), openingAmount: Number.isFinite(input.openingAmount) ? input.openingAmount : 0, status: 'OPEN', blingSnapshot: input.blingSnapshot }; }

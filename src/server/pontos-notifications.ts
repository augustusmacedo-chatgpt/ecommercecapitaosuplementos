import { createHash, randomBytes } from 'node:crypto';
import { put } from '@vercel/blob';
import { CYCLE_POINTS, VALUE_PER_POINT, PointsAccount, PendingPointEmail } from './pontos.js';

function key(customerKey: string) { return `points/accounts/${createHash('sha256').update(customerKey).digest('hex')}.json`; }
async function save(account: PointsAccount) { const token = process.env.BLOB_READ_WRITE_TOKEN; await put(key(account.customerKey), JSON.stringify(account), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', ...(token ? { token } : {}) }); }
function htmlEscape(value: string) { return value.replace(/[&<>\"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[char] || char)); }
function sender() { return process.env.POINTS_EMAIL_FROM || 'Capitão Suplementos <naoresponda@capitaosuplementos.com.br>'; }
function makeCode(prefix: string) { return `${prefix}-${randomBytes(5).toString('hex').toUpperCase()}`; }

async function sendEmail(message: PendingPointEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY não configurada.');
  const value = message.type === 'bonus' ? (message.bonusValue || 50) : (message.milestone || 0) * VALUE_PER_POINT;
  let subject: string; let html: string; let text: string;
  if (message.type === 'milestone') {
    subject = `Você chegou aos ${message.milestone} pontos, Parceiro(a)!`;
    html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;line-height:1.55;color:#222"><h1>Você alcançou ${message.milestone} pontos! 🎯</h1><p>Seu programa de fidelidade Capitão Suplementos acaba de atingir mais um marco.</p><p><strong>${message.milestone} pontos = R$ ${value.toFixed(2).replace('.', ',')}</strong> em valor de benefício.</p><p>Continue acumulando. Aos 1.000 pontos, o ciclo é convertido automaticamente em um <strong>bônus de R$ 50,00</strong>.</p><p>Este aviso é informativo e não significa que os pontos foram trocados automaticamente.</p><p>Capitão Suplementos</p></div>`;
    text = `Você alcançou ${message.milestone} pontos!\n\n${message.milestone} pontos equivalem a R$ ${value.toFixed(2).replace('.', ',')} em valor de benefício.\n\nContinue acumulando. Aos 1.000 pontos, o ciclo é convertido automaticamente em um bônus de R$ 50,00.\n\nEste aviso é informativo e não significa que os pontos foram trocados automaticamente.\n\nCapitão Suplementos`;
  } else {
    subject = 'Você desbloqueou seu bônus de R$ 50,00! 🏆';
    html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;line-height:1.55;color:#222"><h1>Parabéns! Você completou 1.000 pontos.</h1><p>Seu ciclo de fidelidade foi convertido automaticamente em um <strong>bônus de R$ 50,00</strong>.</p><p><strong>PD10 — PIX / DINHEIRO:</strong> ${htmlEscape(message.bonusCodePix || '')}<br>10% de desconto + R$ 50,00 de bônus.</p><p><strong>CD5 — CRÉDITO / DÉBITO:</strong> ${htmlEscape(message.bonusCodeCard || '')}<br>5% de desconto + R$ 50,00 de bônus.</p><p>Guarde este e-mail para usar os benefícios no próximo pedido.</p><p>Capitão Suplementos</p></div>`;
    text = `Parabéns! Você completou 1.000 pontos.\n\nSeu ciclo de fidelidade foi convertido automaticamente em um bônus de R$ 50,00.\n\nPD10 — PIX / DINHEIRO: ${message.bonusCodePix || ''}\n10% de desconto + R$ 50,00 de bônus.\n\nCD5 — CRÉDITO / DÉBITO: ${message.bonusCodeCard || ''}\n5% de desconto + R$ 50,00 de bônus.\n\nGuarde este e-mail para usar os benefícios no próximo pedido.\n\nCapitão Suplementos`;
  }
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: sender(), to: [message.to], subject, html, text }) });
  if (!response.ok) throw new Error(`Resend rejeitou o e-mail (${response.status}).`);
}

export async function queueMilestoneEmails(account: PointsAccount, previousCycleEarned: number) {
  const email = account.email || ''; if (!email.includes('@')) return account;
  const current = account.cycleEarned || 0;
  const cycle = Math.floor(((account.lifetimeEarned || 0) - current) / CYCLE_POINTS) + 1;
  let next = { ...account, pendingEmails: [...(account.pendingEmails || [])], sentEmailIds: [...(account.sentEmailIds || [])] };
  for (const milestone of [200, 400, 600, 800]) if (previousCycleEarned < milestone && current >= milestone) {
    const id = `milestone-${cycle}-${milestone}`;
    if (!next.pendingEmails.some(item => item.id === id) && !next.sentEmailIds.includes(id)) next.pendingEmails.push({ id, type: 'milestone', milestone, cycle, to: email, createdAt: new Date().toISOString() });
  }
  return next;
}

export async function queueBonusEmail(account: PointsAccount, cycle: number) {
  const email = account.email || ''; if (!email.includes('@')) return account;
  const id = `bonus-${cycle}`;
  if ((account.pendingEmails || []).some(item => item.id === id) || (account.sentEmailIds || []).includes(id)) return account;
  return { ...account, pendingEmails: [...(account.pendingEmails || []), { id, type: 'bonus' as const, cycle, to: email, bonusCodePix: makeCode('PD10'), bonusCodeCard: makeCode('CD5'), bonusValue: 50, createdAt: new Date().toISOString() }] };
}

export async function flushPendingPointEmails(account: PointsAccount) {
  let next = { ...account, pendingEmails: [...(account.pendingEmails || [])], sentEmailIds: [...(account.sentEmailIds || [])] };
  for (const message of next.pendingEmails) {
    try { await sendEmail(message); next.sentEmailIds.push(message.id); next.pendingEmails = next.pendingEmails.filter(item => item.id !== message.id); }
    catch (error) { console.error('Points notification email:', error); break; }
  }
  next.updatedAt = new Date().toISOString(); await save(next); return next;
}

export function createBonusRecord(cycle: number, account: PointsAccount) {
  const pending = account.pendingEmails?.find(item => item.id === `bonus-${cycle}`);
  return { id: `bonus-${cycle}`, cycle, value: 50, pointsConverted: CYCLE_POINTS, pixCashCode: pending?.bonusCodePix || null, cardCode: pending?.bonusCodeCard || null, createdAt: new Date().toISOString(), status: 'available' as const };
}

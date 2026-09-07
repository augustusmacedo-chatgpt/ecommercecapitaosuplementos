import { createHash } from 'node:crypto';
import { get, put } from './storage.js';

export type NotificationType='ORDER_CREATED_SITE'|'ORDER_SEPARATED'|'PDV_PURCHASE_THANK_YOU';
export type NotificationStatus='PENDING'|'DISPATCHED'|'FAILED';
export type NotificationRecord={
  id:string; type:NotificationType; status:NotificationStatus; phone:string; customerName?:string;
  orderId?:number; orderNumber?:number; store?:'camapua'|'newfit'; createdAt:string;
  attempts:number; payload:Record<string,unknown>; dispatchedAt?:string; error?:string;
};
const prefix='notifications/';
const clean=(v:unknown)=>String(v??'').trim();
const digits=(v:unknown)=>clean(v).replace(/\D/g,'');
function key(id:string){return `${prefix}${id}.json`;}
export function buildPdvThankYouMessage(customerName:string){
  const first=clean(customerName).split(/\s+/)[0]||'cliente';
  return `Olá, ${first}! 💪\n\nMuito obrigado pela sua compra na Capitão Suplementos! 🔥\n\nSua opinião é muito importante para nós. ⭐\n\nQueremos saber como foi sua experiência. Em breve você receberá nosso convite oficial para avaliar a loja no Google.`;
}
export async function queuePdvThankYou(input:{checkoutId:string;phone:string;customerName?:string;orderId?:number;orderNumber?:number;store:'camapua'|'newfit'}){
  const phone=digits(input.phone); if(phone.length<10) return null;
  const hash=createHash('sha256').update(`PDV_PURCHASE_THANK_YOU:${input.checkoutId}:${phone}`).digest('hex').slice(0,24);
  const id=`pdv_thanks_${hash}`;
  try{const existing=await get(key(id));if(existing?.stream)return JSON.parse(await new Response(existing.stream).text()) as NotificationRecord;}catch{}
  const customerName=clean(input.customerName);
  const record:NotificationRecord={id,type:'PDV_PURCHASE_THANK_YOU',status:'PENDING',phone,customerName:customerName||undefined,orderId:input.orderId,orderNumber:input.orderNumber,store:input.store,createdAt:new Date().toISOString(),attempts:0,payload:{message:buildPdvThankYouMessage(customerName),event:'PDV_PURCHASE_THANK_YOU',checkoutId:input.checkoutId,googleReviewUrl:null,mediaUrl:null}};
  await put(key(id),JSON.stringify(record),{contentType:'application/json'});
  return record;
}

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
function firstName(value:unknown){return clean(value).split(/\s+/)[0]||'cliente';}
async function existing(id:string){try{const result=await get(key(id));if(!result?.stream)return null;return JSON.parse(await new Response(result.stream).text()) as NotificationRecord;}catch{return null;}}
async function queue(input:{idSource:string;type:NotificationType;phone:string;customerName?:string;orderId?:number;orderNumber?:number;store?:'camapua'|'newfit';payload:Record<string,unknown>}){
  const phone=digits(input.phone); if(phone.length<10)return null;
  const hash=createHash('sha256').update(`${input.type}:${input.idSource}:${phone}`).digest('hex').slice(0,24);
  const id=`${input.type.toLowerCase()}_${hash}`;
  const already=await existing(id); if(already)return already;
  const record:NotificationRecord={id,type:input.type,status:'PENDING',phone,customerName:clean(input.customerName)||undefined,orderId:input.orderId,orderNumber:input.orderNumber,store:input.store,createdAt:new Date().toISOString(),attempts:0,payload:input.payload};
  await put(key(id),JSON.stringify(record),{contentType:'application/json'});
  return record;
}
export function buildPdvThankYouMessage(customerName:string){
  return `Olá, ${firstName(customerName)}! 💪\n\nMuito obrigado pela sua compra na Capitão Suplementos! 🔥\n\nSua opinião é muito importante para nós. ⭐\n\nQueremos saber como foi sua experiência. Em breve você receberá nosso convite oficial para avaliar a loja no Google.`;
}
export async function queuePdvThankYou(input:{checkoutId:string;phone:string;customerName?:string;orderId?:number;orderNumber?:number;store:'camapua'|'newfit'}){
  return queue({idSource:input.checkoutId,type:'PDV_PURCHASE_THANK_YOU',phone:input.phone,customerName:input.customerName,orderId:input.orderId,orderNumber:input.orderNumber,store:input.store,payload:{message:buildPdvThankYouMessage(clean(input.customerName)),event:'PDV_PURCHASE_THANK_YOU',checkoutId:input.checkoutId,googleReviewUrl:null,mediaUrl:null}});
}
export async function queueSiteOrderCreated(input:{checkoutId:string;phone:string;customerName?:string;orderId?:number;orderNumber?:number}){
  return queue({idSource:input.checkoutId,type:'ORDER_CREATED_SITE',phone:input.phone,customerName:input.customerName,orderId:input.orderId,orderNumber:input.orderNumber,payload:{event:'ORDER_CREATED_SITE',checkoutId:input.checkoutId,messageTemplate:'SITE_ORDER_CREATED_OFFICIAL'}});
}
export async function queueOrderSeparated(input:{checkoutId:string;phone:string;customerName?:string;orderId?:number;orderNumber?:number;status?:unknown}){
  return queue({idSource:input.checkoutId,type:'ORDER_SEPARATED',phone:input.phone,customerName:input.customerName,orderId:input.orderId,orderNumber:input.orderNumber,payload:{event:'ORDER_SEPARATED',checkoutId:input.checkoutId,status:clean(input.status),messageTemplate:'ORDER_SEPARATED_OFFICIAL'}});
}

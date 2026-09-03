import { createHash } from 'node:crypto';
import { get } from '@vercel/blob';
import { json } from '../../src/server/bling-shared.js';
const key=(d:string)=>`customer-otp/${createHash('sha256').update(d).digest('hex')}.json`;
export async function POST(request:Request){try{const {document,code}=await request.json() as {document?:string;code?:string};const doc=String(document||'').replace(/\D/g,'');const token=process.env.BLOB_READ_WRITE_TOKEN;const result=await get(key(doc),{access:'private',useCache:false,token});if(!result||!result.stream)return json({error:'Código expirado. Solicite um novo código.'},401);const saved=JSON.parse(await new Response(result.stream).text());if(Date.now()>saved.expires||String(code||'')!==saved.code)return json({error:'Código inválido ou expirado.'},401);return json({verified:true},200);}catch{return json({error:'Não foi possível validar o código.'},503)}}

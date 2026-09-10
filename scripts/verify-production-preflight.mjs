import { readFile } from 'node:fs/promises';

const errors = [];
const warnings = [];

async function read(path) {
  try { return await readFile(path, 'utf8'); }
  catch { errors.push(`Arquivo obrigatório ausente: ${path}`); return ''; }
}

const wrangler = await read('wrangler.jsonc');
const worker = await read('worker/index.ts');
const packageJsonText = await read('package.json');
const packageJson = packageJsonText ? JSON.parse(packageJsonText) : {};

if (!/"binding"\s*:\s*"APP_STORAGE"/.test(wrangler)) errors.push('Binding R2 APP_STORAGE não encontrado no wrangler.jsonc.');
if (!/"bucket_name"\s*:\s*"[^"]+"/.test(wrangler)) errors.push('Bucket R2 não configurado no wrangler.jsonc.');
if (!/"binding"\s*:\s*"ASSETS"/.test(wrangler)) errors.push('Binding ASSETS não encontrado no wrangler.jsonc.');
if (!worker.includes("'/api/bling/catalog-health'")) errors.push('Rota catalog-health ausente no Worker.');
if (!worker.includes("'/api/bling/catalog-readiness'")) errors.push('Rota catalog-readiness ausente no Worker.');
if (!worker.includes("'/api/bling/catalog-sync'")) errors.push('Rota catalog-sync ausente no Worker.');
if (!worker.includes("'/api/bling/catalog-reconcile'")) errors.push('Rota catalog-reconcile ausente no Worker.');
if (!worker.includes('catalogIndexResponse(request)')) errors.push('Leitura R2-first do catálogo ausente no Worker.');
if (!packageJson.scripts?.build) errors.push('Script build ausente no package.json.');
if (!packageJson.scripts?.typecheck) errors.push('Script typecheck ausente no package.json.');
if (!packageJson.scripts?.['catalog:verify']) warnings.push('catalog:verify ainda não existe nesta base.');

for (const secretPattern of ['BLING_CLIENT_SECRET=', 'BLING_CLIENT_ID=', 'BLING_ACCESS_TOKEN=']) {
  try {
    const hits = [];
    for (const path of ['worker/index.ts','api/bling/catalog-readiness.ts','wrangler.jsonc']) {
      const text = await read(path);
      if (text.includes(secretPattern)) hits.push(path);
    }
    if (hits.length) errors.push(`Possível segredo hardcoded (${secretPattern}) em: ${hits.join(', ')}`);
  } catch {}
}

if (errors.length) {
  console.error('Preflight de produção: FALHOU');
  for (const error of errors) console.error(`- ${error}`);
  if (warnings.length) for (const warning of warnings) console.warn(`Aviso: ${warning}`);
  process.exit(1);
}

console.log('Preflight de produção: OK');
console.log('- R2/Assets configurados');
console.log('- rotas críticas do Worker presentes');
console.log('- catálogo R2-first presente');
console.log('- scripts fundamentais presentes');
if (warnings.length) for (const warning of warnings) console.warn(`Aviso: ${warning}`);

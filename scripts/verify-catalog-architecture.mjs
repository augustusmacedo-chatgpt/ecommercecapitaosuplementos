import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const errors = [];

async function collect(dir) {
  const entries = await readdir(join(root, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collect(relative));
    else if (entry.isFile() && relative.endsWith('.ts')) files.push(relative.replaceAll('\\', '/'));
  }
  return files;
}

const files = [...await collect('api'), ...await collect('src/server')];
const directUrl = /https:\/\/api\.bling\.com\.br\/Api\/v3|https:\/\/bling\.com\.br\/Api\/v3/g;
const allowed = new Set(['api/bling/callback.ts', 'src/server/bling-client.ts', 'src/server/bling-gateway.ts']);

for (const file of files) {
  const text = await readFile(join(root, file), 'utf8');
  if (directUrl.test(text) && !allowed.has(file)) errors.push(`URL direta do Bling fora da fronteira: ${file}`);
  directUrl.lastIndex = 0;
}

const required = [
  ['worker/index.ts', "'/api/bling/catalog-health'"],
  ['worker/index.ts', "'/api/bling/catalog-sync'"],
  ['worker/index.ts', "'/api/bling/catalog-reconcile'"],
  ['worker/index.ts', 'catalogIndexResponse(request)'],
  ['api/bling/catalog-sync-guarded.ts', 'acquireCatalogSyncLock()'],
  ['api/bling/catalog-reconcile.ts', 'acquireCatalogSyncLock()'],
  ['api/bling/catalog-health.ts', 'sessionUser(request)'],
  ['src/server/catalog-index-service.ts', 'loadCatalogIndex()'],
];

for (const [file, needle] of required) {
  const text = await readFile(join(root, file), 'utf8');
  if (!text.includes(needle)) errors.push(`Contrato ausente: ${file} -> ${needle}`);
}

if (errors.length) {
  console.error('Falha na verificação arquitetural do catálogo:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`OK: arquitetura do catálogo validada (${files.length} arquivos TypeScript inspecionados).`);

# Capitão Suplementos — Estado das fases Bling/R2

## Arquitetura atual
Bling continua como fonte oficial. O fluxo operacional prioriza webhook e sincronização controlada para abastecer o espelho no R2. Site/Admin/PDV usam o R2 para catálogo comum; detalhes e saldos críticos continuam protegidos pelo gateway oficial.

## Fases concluídas nesta linha
- F1 OAuth e sessão administrativa do Bling
- F2 gateway e proteção de rate limit
- F3 experiência operacional de produto
- F4 espelho persistente de produto/estoque
- F5 clientes e pedidos no gateway
- F6 blindagem/CI
- F7 catálogo SWR no cliente
- F8 webhook rápido
- F9 limpeza de TypeScript
- F10 índice persistente do catálogo
- F11 sincronização controlada do catálogo
- F12 reconciliação Bling × R2
- F13 proteção de concorrência da sincronização/reconciliação

## Operações novas
### Sincronização
`POST /api/bling/catalog-sync`
- padrão: até 5 páginas por execução
- máximo: 50 páginas por snapshot
- checkpoint e buffer no R2
- novo snapshot com `reiniciar=1`
- protegido por lock distribuído

### Reconciliação
`POST /api/bling/catalog-reconcile`
- acesso ADMIN
- compara snapshot do Bling com índice R2
- identifica itens ausentes e dados principais divergentes
- por padrão não altera o índice
- `corrigir=1` aplica o snapshot somente quando a leitura foi completa
- compartilhamento do mesmo lock impede execução concorrente

## Regra de segurança
Nenhuma dessas operações deve consultar diretamente a API do Bling fora do `blingFetch`/camadas autorizadas. A `main` não deve ser alterada sem decisão explícita de merge.

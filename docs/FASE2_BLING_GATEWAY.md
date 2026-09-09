# Fase 2 — Gateway e retaguarda do Bling

Objetivo: fazer Site, Admin e PDV trabalharem sobre uma camada única de integração, como uma retaguarda operacional apoiada pelo Bling, sem transformar cada página em um consumidor direto da API.

## Camadas

1. **Bling** é a fonte oficial para dados operacionais e alterações.
2. **Gateway** centraliza autenticação, controle de início das requisições, timeout, retry seguro e recuperação de 401.
3. **Retaguarda/cache R2** mantém leituras recentes dos recursos mais consultados e deduplica chamadas simultâneas idênticas.
4. **Webhooks** invalidam a versão do cache quando o Bling informa alterações, reduzindo a dependência de polling.
5. **Último dado válido** pode continuar sendo usado quando uma leitura de catálogo falha, evitando que uma instabilidade momentânea derrube a operação de consulta.

## Proteções contra limite

- Intervalo de 400 ms entre inícios de chamadas live, mantendo margem abaixo de 3 req/s por instância.
- Cooldown compartilhado no R2 após `429`.
- Retry automático somente para métodos seguros/idempotentes por padrão.
- POST não recebe retry transitório automático.
- Uma única recuperação de `401` por chamada.
- Leituras cacheáveis não precisam buscar ou renovar token quando o cache está válido.
- Chamadas idênticas concorrentes na mesma instância compartilham uma única execução live.

## TTL de leitura

- Produtos/listagens: 60 s.
- Detalhe de produto: 120 s.
- Depósitos: 10 min.
- Saldos de estoque: 3 s.
- Vendedores: 10 min.
- Canais de venda: 10 min.
- Contatos: 30 s.

Esses TTLs são uma camada de proteção de tráfego, não uma substituição da fonte oficial. Mutação bem-sucedida e webhook renovam a versão lógica do cache.

## Webhooks

O Bling recomenda webhooks em vez de polling quando o objetivo é acompanhar alterações, justamente para evitar consultas repetidas sem novidade. A integração valida `X-Bling-Signature-256`, registra o evento e agora também invalida a versão da retaguarda local. O processamento deve continuar idempotente porque o Bling pode reenviar eventos e não garante ordenação entre eventos. citehttps://developer.bling.com.br/webhooks

## Limite oficial

A API do Bling limita cada conta a 3 requisições por segundo e 120.000 por dia, somando os módulos/endpoints da conta. Portanto, a retaguarda deve priorizar cache e eventos antes de aumentar polling. citehttps://developer.bling.com.br/limites

## Fronteira

As únicas chamadas diretas permitidas ao host autenticado do Bling são o gateway e os pontos de OAuth necessários ao fluxo de autorização/token. O CI verifica essa fronteira para evitar regressões.

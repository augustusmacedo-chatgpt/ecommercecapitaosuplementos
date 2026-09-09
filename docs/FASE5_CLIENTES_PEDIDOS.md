# Fase 5 — Clientes e pedidos

## Objetivo

Garantir que os dois fluxos comerciais mais sensíveis usem a mesma retaguarda de integração do Bling, sem criar uma segunda fonte de verdade desnecessária.

## Entregue

- O cadastro local de clientes continua persistente no R2 e mantém o `blingContactId` quando houver vínculo.
- O checkout atual continua usando o armazenamento local do pedido por `checkoutId` para idempotência e acompanhamento.
- Criação e atualização de contato no Bling passam pelo `blingFetch`.
- Criação do pedido de venda no Bling passa pelo `blingFetch`.
- Atualização de contato usa método idempotente (`PUT`) e pode usar retry controlado.
- Criação de venda (`POST`) não recebe retry transitório automático, evitando duplicação.
- `401` e renovação OAuth ficam centralizados no gateway.
- O webhook continua atualizando pedidos locais e o espelho de produtos/estoque.

## Por que não duplicar clientes e pedidos

A base local já guarda os registros necessários para a experiência da Capitão. Criar um segundo espelho paralelo dos mesmos campos, sem necessidade operacional, aumentaria risco de divergência. O Bling permanece como ERP oficial e a base local funciona como retaguarda da experiência web.

## Estado de produção

O código está separado em branch própria e pronto para revisão. O GitHub Actions não está retornando execução neste ambiente; por isso `typecheck` e `build` continuam aguardando confirmação do runner.

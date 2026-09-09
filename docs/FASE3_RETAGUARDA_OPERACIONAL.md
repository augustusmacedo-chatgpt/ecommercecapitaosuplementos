# Fase 3 — Retaguarda operacional

## Objetivo

Dar às páginas da Capitão uma experiência operacional apoiada pelo Bling sem transformar cada tela em uma sequência de consultas diretas à API.

## Entregue

- Gateway e cache da Fase 2 continuam sendo a única fronteira para a API autenticada.
- Produtos, detalhes, depósitos, saldos, vendedores, canais e contatos já possuem cache de curta duração adequado ao tipo de dado.
- Chamadas idênticas simultâneas são deduplicadas no cache compartilhado.
- Webhooks renovam a geração lógica do cache.
- Alteração de credenciais também troca a geração do cache.
- Nova página `Produto` em `/produto/{id}` consulta o endpoint existente de detalhe, que passa pelo gateway e pode ser atendido pelo cache.
- Página de produto apresenta nome, categoria, descrição, preço, situação, estoque e disponibilidade por depósito quando retornados pelo Bling.
- A página reutiliza a sacola local existente, respeitando o estoque retornado.

## Limites

Esta fase não cria pagamento, frete ou baixa própria de estoque. O Bling continua sendo a fonte oficial para os dados operacionais. O cache é uma camada de desempenho e contenção de tráfego.

## Próxima evolução natural

O próximo passo é transformar os snapshots em espelhos de domínio (catálogo, estoque, clientes e pedidos), com rotinas idempotentes de sincronização e trilha de atualização, antes de criar funcionalidades comerciais que dependam desses dados.

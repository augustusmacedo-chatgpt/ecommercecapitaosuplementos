# Fase 4 — Espelho persistente do Bling

## Objetivo

A retaguarda deixa de ser somente cache de respostas e passa a manter um espelho mínimo e persistente de domínio para produtos e estoque.

## Funcionamento

- `src/server/bling-domain-store.ts` guarda produto e estoque em objetos separados no R2.
- `GET /api/bling/product-detail?id=...` tenta primeiro o espelho persistente.
- Quando o espelho não existe ou está antigo, a rota consulta o Bling pelo gateway e persiste o retorno.
- O webhook do Bling grava alterações de Produto, Estoque e Estoque Virtual diretamente no espelho.
- Produto excluído vira tombstone lógico para não reaparecer como cadastro ativo.
- Estoque virtual recebido pelo webhook substitui os depósitos conhecidos; estoque por depósito atualiza somente o depósito informado.
- O produto é combinado com o snapshot de estoque mais recente antes da normalização para a interface.

## Benefício

Uma página de detalhe não precisa chamar o Bling repetidamente para o mesmo produto. Alterações que chegam por webhook atualizam a retaguarda sem polling contínuo.

## Limites

O espelho não assume ser uma segunda fonte de verdade comercial. O Bling continua sendo a origem oficial. Dados persistidos são usados para desempenho, disponibilidade e continuidade operacional; mutações comerciais continuam passando pelo fluxo operacional definido para o Bling.

## Próxima evolução

Aplicar o mesmo padrão a clientes e pedidos, criar índice de entidades para consultas administrativas e adicionar uma rotina de reconciliação pontual para corrigir qualquer divergência entre espelho e Bling sem polling permanente.

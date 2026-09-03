# Handoff técnico — Capitão Suplementos + Bling

**Data:** 03/09/2026  
**Projeto:** `augustusmacedo-chatgpt/ecommercecapitaosuplementos`  
**Branch:** `main`

## Estado entregue

A integração OAuth 2.0 do Bling já estava funcional em produção. Nesta etapa, a vitrine pública foi preparada para usar o catálogo real com menos trabalho manual e menor consumo de créditos.

A validação anterior confirmou `GET /api/bling/status` com HTTP 200, `configured: true` e `connected: true`. A rota de produtos também respondeu HTTP 200 com dados reais do catálogo.

## Implementações desta etapa

| Área | Implementação |
|---|---|
| Catálogo | A loja solicita até 100 produtos reais na primeira carga, em vez de apenas 12. |
| Busca | O campo de busca filtra por nome, categoria e código do produto sem nova chamada ao Bling. |
| Categorias | Categorias da vitrine agora aplicam filtro no catálogo carregado. |
| Estoque | O saldo virtual do Bling é exibido em cada card. Produtos com saldo zero aparecem como `ESGOTADO` e não permitem abrir o produto. |
| Produto | Produtos disponíveis recebem link `/produto/{id}` como ponto de entrada para a futura página de detalhe. |
| Imagens | Imagens passam a carregar com `loading="lazy"` para reduzir custo de carregamento. |
| Estados da UI | Foram adicionadas mensagens de carregamento, erro, quantidade encontrada e resultado vazio. |
| Duplicação visual | As seções continuam preservando a identidade do layout, mas usam chaves estáveis e o mesmo catálogo filtrado. |
| Documentação | Este arquivo registra decisões, limites e próximos passos para o MestreGPT. |

## Arquivos alterados

- `src/App.tsx`: busca, filtros, estoque, indisponibilidade, links e estados do catálogo.
- `src/styles.css`: estilos para produtos esgotados, badges, toolbar, mensagens e estado vazio.
- `HANDOFF_MESTREGPT_BLING.md`: este handoff.

## Validação executada

Os comandos abaixo foram executados com sucesso no commit de trabalho:

```bash
npm ci
npm run build
npm run typecheck
```

O build Vite terminou sem erros e o TypeScript terminou sem erros.

## Próxima sequência recomendada

A próxima implementação mais importante é criar a rota de detalhe do produto. Ela deve receber o ID numérico, consultar o Bling no servidor e retornar somente os campos necessários para a tela: nome, descrição, preço, imagens, categoria, código, situação e estoque. Não se deve expor access token, refresh token, Client Secret ou conteúdo do Blob.

Depois disso, implementar uma sacola local com `localStorage`, quantidade e bloqueio de itens sem estoque. O checkout ainda não deve ser criado sem decidir a operação comercial da Capitão: pagamento na entrega via WhatsApp, link de pagamento, checkout próprio ou outro provedor.

A paginação completa do Bling também permanece pendente. A implementação atual busca a primeira página com limite máximo de 100. Caso o catálogo ultrapasse esse limite, será necessário adicionar paginação server-side ou um botão “carregar mais”.

O botão de reconexão OAuth já existe. Ainda falta implementar desconexão segura: revogar ou limpar access token e refresh token sem apagar Client ID e Client Secret. Essa operação deve exigir uma confirmação explícita na interface porque encerra a conexão atual.

## Limites e decisões preservadas

O armazenamento atual usa o caminho fixo `bling/capitao-credentials.json`. A solução continua preparada para uma conta Bling por projeto. Multi-conta exige autenticação de administrador, identificador de loja e isolamento dos caminhos no Blob.

Não foram implementados webhooks, exportação de pedidos, sincronização periódica, pagamento, frete ou baixa de estoque. Essas funcionalidades dependem de decisões comerciais e de um modelo de pedido.

Não copiar credenciais, tokens ou o conteúdo do Blob para o GitHub, Markdown, logs ou mensagens.

## Deploy

Após revisar o diff, publicar com:

```bash
git add src/App.tsx src/styles.css HANDOFF_MESTREGPT_BLING.md
git commit -m "Improve Bling catalog browsing and stock states"
git push origin main
```

O Vercel deve iniciar o deploy automaticamente pela branch `main`. Depois, verificar:

```bash
curl -sS -w '\nHTTP:%{http_code}\n' https://ecommercecapitaosuplementos.vercel.app/api/bling/status
curl -sS -w '\nHTTP:%{http_code}\n' 'https://ecommercecapitaosuplementos.vercel.app/api/bling/products?pagina=1&limite=4'
```

## Referências

[1]: https://developer.bling.com.br/aplicativos "Bling Developer — Aplicativos e fluxo OAuth"  
[2]: https://developer.bling.com.br/referencia "Bling Developer — Referência da API v3"

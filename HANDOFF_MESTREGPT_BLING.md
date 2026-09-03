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
| Nitidez | A vitrine não amplia mais imagens abaixo da resolução original; a API de listagem do Bling forneceu uma miniatura real de 70×70 px para o produto testado. |
| Estados da UI | Foram adicionadas mensagens de carregamento, erro, quantidade encontrada e resultado vazio. |
| Atualização automática | Foi criado `POST /api/bling/webhook` com validação HMAC, proteção contra evento duplicado e registro seguro do último evento. |
| Duplicação visual | As seções continuam preservando a identidade do layout, mas usam chaves estáveis e o mesmo catálogo filtrado. |
| Documentação | Este arquivo registra decisões, limites e próximos passos para o MestreGPT. |

## Arquivos alterados

- `src/App.tsx`: busca, filtros, estoque, indisponibilidade, links e estados do catálogo.
- `src/styles.css`: estilos para produtos esgotados, badges, toolbar, mensagens e estado vazio.
- `api/bling/webhook.ts`: endpoint oficial para receber eventos de produto e estoque do Bling.
- `src/server/bling-store.ts`: metadados do último webhook, sem armazenar payload sensível.
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

## Atualização automática via webhook

O Bling envia eventos em tempo real quando um produto ou estoque é criado, atualizado ou removido. O endpoint publicado é `https://ecommercecapitaosuplementos.vercel.app/api/bling/webhook`. Ele valida o cabeçalho `X-Bling-Signature-256` com o Client Secret, aceita eventos repetidos sem erro e registra somente o ID e o horário do último evento no Blob privado.

Para ativar o envio, abrir o aplicativo da Capitão no painel de desenvolvedores do Bling, habilitar os escopos de produto e estoque, cadastrar o endpoint acima na aba Webhooks e selecionar os eventos `created`, `updated` e `deleted` para Produto e `updated` para Estoque/Estoque Virtual. Essa configuração externa ainda precisa ser feita manualmente no painel do Bling.

Mesmo sem webhook, a loja já busca o catálogo diretamente no Bling a cada carregamento e sem cache de navegador. Portanto, uma alteração feita no Bling aparece no próximo carregamento da loja. O webhook melhora a arquitetura para futuras rotinas de cache ou sincronização persistente; ele não precisa disparar uma nova consulta agora.

## Limites e decisões preservadas

O armazenamento atual usa o caminho fixo `bling/capitao-credentials.json`. A solução continua preparada para uma conta Bling por projeto. Multi-conta exige autenticação de administrador, identificador de loja e isolamento dos caminhos no Blob.

Não foram implementados exportação de pedidos, sincronização periódica, pagamento, frete ou baixa de estoque. O receptor de webhooks foi implementado, mas ainda não existe uma fila de processamento ou cache persistente de catálogo. Essas funcionalidades dependem de decisões comerciais e de um modelo de pedido.

Não copiar credenciais, tokens ou o conteúdo do Blob para o GitHub, Markdown, logs ou mensagens.

As imagens da listagem de produtos podem vir como miniaturas pequenas do Bling. O teste realizado encontrou uma imagem JPEG de 70×70 px. A vitrine usa `object-fit: contain` para ampliar proporcionalmente sem corte ou deformação, e `mix-blend-mode: multiply` para integrar visualmente fundos brancos ao card. Isso não substitui uma imagem original de alta resolução. A próxima evolução deve consultar a imagem original na rota de detalhe do produto ou armazenar uma versão de alta resolução autorizada pelo Bling; não aplicar remoção automática de fundo em miniaturas porque isso pode apagar detalhes do produto.

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
[3]: https://developer.bling.com.br/webhooks "Bling Developer — Webhooks"

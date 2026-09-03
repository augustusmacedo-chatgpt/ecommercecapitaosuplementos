# Relatório de implementação — 03/09/2026

## Concluído

A integração Bling foi validada em produção, com OAuth, catálogo real, estoque, webhook assinado por HMAC e atualização automática no carregamento da loja. A busca, os filtros, o contador de catálogo e o enquadramento de imagens foram ajustados.

Foi criada a base segura de clientes em Blob privado. Senhas são armazenadas com `scrypt` e salt aleatório. CPF/CNPJ, data de nascimento, endereço completo, complemento, telefone, e-mail e observação são validados no servidor. O endpoint `POST /api/customers/register` cria o contato no Bling e salva somente a referência `blingContactId` junto da conta interna.

## Próximo ciclo

Ainda é necessário criar a tela visual do cadastro, login e sessão. Também falta implementar o carrinho lateral persistente, a página individual do produto, checkout e criação de pedido vinculado ao contato do Bling. Essas partes não devem ser liberadas como prontas antes de testar a política comercial de pagamento e entrega.

## Segurança

Não registrar senhas, CPF/CNPJ, tokens OAuth ou Client Secret em logs, GitHub ou mensagens. O cadastro deve usar HTTPS e limitar tentativas de login quando a autenticação for implementada.

## Validação

Executar `npm ci`, `npm run build` e `npm run typecheck` após integrar a interface.

## Referências

[1]: https://developer.bling.com.br/referencia "Bling Developer — Referência da API v3"
[2]: https://developer.bling.com.br/webhooks "Bling Developer — Webhooks"

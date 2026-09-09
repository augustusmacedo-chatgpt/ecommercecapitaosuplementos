# Fase 2 — Gateway de comunicação com o Bling

Objetivo: garantir que as chamadas à API do Bling passem por uma camada única, com autenticação centralizada, intervalo mínimo entre requisições, timeout, retry controlado e recuperação de 401.

Regras de segurança:

- Nenhuma mudança de regra de negócio de Site, PDV, estoque ou checkout.
- OAuth/token permanece server-side.
- `429` nunca deve gerar loop agressivo.
- `401` deve provocar uma única recuperação de token e nova tentativa controlada.
- Respostas que não são retryable retornam ao chamador sem mascarar o status.
- A camada deve ser usada pelos módulos operacionais antes da liberação da fase.

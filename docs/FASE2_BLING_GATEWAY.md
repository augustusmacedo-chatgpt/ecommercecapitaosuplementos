# Fase 2 — Gateway de comunicação com o Bling

Objetivo: garantir que as chamadas à API do Bling passem por uma camada única, com autenticação centralizada, intervalo mínimo entre requisições, timeout, retry controlado e recuperação de 401.

Regras de segurança:

- Nenhuma mudança de regra de negócio de Site, PDV, estoque ou checkout.
- OAuth/token permanece server-side.
- `429` nunca deve gerar loop agressivo.
- O gateway trabalha com margem abaixo do limite de 3 requisições por segundo por processo/instância, reduzindo a chance de encostar no teto por pequenas oscilações de timing.
- Em `429`, um cooldown é salvo no R2 para que outras instâncias do Worker também reduzam chamadas durante a janela de contenção.
- Limite diário identificado explicitamente pelo Bling não sofre retry automático.
- `401` deve provocar uma única recuperação de token e nova tentativa controlada.
- GET/HEAD/OPTIONS/PUT/DELETE podem usar retry automático; POST não recebe retry transitório por padrão para evitar duplicação de operações.
- Respostas que não são retryable retornam ao chamador sem mascarar o status.
- A camada deve ser usada pelos módulos operacionais antes da liberação da fase.

Observação de arquitetura: o limite oficial do Bling é aplicado por conta, somando os módulos/endpoints utilizados. O controle local do gateway reduz a pressão por instância, enquanto o cooldown em R2 funciona como contenção compartilhada após um `429`; uma limitação global de taxa realmente coordenada entre todas as instâncias exigiria um coordenador distribuído dedicado.

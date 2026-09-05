# ⚓ Capitão Pontos — Regras de Negócio v1

## 1. Objetivo

O Capitão Pontos é o programa de fidelidade da Capitão Suplementos. O programa deve consolidar compras realizadas no site e no PDV, sempre vinculadas ao cadastro do cliente, usando CPF/CNPJ como identificador principal quando disponível.

## 2. Acúmulo

- Cada **R$ 1,00 em compra elegível = 1 ponto**.
- O valor de referência é o valor efetivamente elegível da venda, após regras comerciais que forem definidas para descontos, cancelamentos e estornos.
- Compras realizadas pelo **site** podem gerar pontos.
- Compras realizadas pelo **PDV** podem gerar pontos, desde que o cliente esteja identificado no cadastro.
- Compra sem identificação de cliente não participa do programa.
- A pontuação deve ser registrada como transação auditável; não depender apenas de um saldo sobrescrito.

## 3. Valor econômico do ponto

- **1 ponto = R$ 0,05 de benefício**.
- Portanto, o programa representa uma referência de 5% sobre o valor elegível acumulado.

| Pontos | Benefício equivalente |
|---:|---:|
| 100 | R$ 5,00 |
| 200 | R$ 10,00 |
| 400 | R$ 20,00 |
| 600 | R$ 30,00 |
| 800 | R$ 40,00 |
| 1.000 | R$ 50,00 |

## 4. Utilização antes do prêmio grande

- O cliente pode utilizar pontos a partir de **100 pontos**.
- O benefício decorrente dos pontos é destinado à **próxima compra**.
- A utilização inicial do benefício será feita **exclusivamente pelo site**.
- O benefício não é cumulativo com outros descontos ou promoções.
- O cliente pode optar por utilizar o benefício disponível ou continuar acumulando pontos.
- Utilizar pontos consome somente a quantidade efetivamente escolhida e deve gerar uma transação negativa no histórico.

### Exemplo

300 pontos = R$ 15,00 de benefício disponível.

O cliente pode:

- usar até 300 pontos na próxima compra, conforme as regras de utilização; ou
- guardar os 300 pontos e continuar acumulando para o prêmio grande.

## 5. Marcos de comunicação

Os marcos de 200, 400, 600 e 800 pontos são marcos de evolução e comunicação. Eles não liberam automaticamente o prêmio grande.

A comunicação deve ocorrer no máximo uma vez por marco dentro de cada ciclo.

Se uma única movimentação fizer o cliente ultrapassar vários marcos, o sistema deve evitar uma sequência de e-mails. A regra de implementação deverá consolidar a comunicação em uma única mensagem de evolução, registrando internamente os marcos ultrapassados.

## 6. Prêmio grande — 1.000 pontos

O prêmio grande somente existe quando o cliente **atinge efetivamente 1.000 pontos no ciclo atual**.

Ao atingir 1.000 pontos:

1. gerar **R$ 50,00 de bônus**;
2. liberar o benefício **PD10** para PIX/Dinheiro;
3. liberar o benefício **CD5** para Crédito/Débito;
4. encerrar o ciclo de 1.000 pontos;
5. iniciar um novo ciclo.

### PD10

- Forma de pagamento: PIX ou Dinheiro.
- Benefício: **10% de desconto + R$ 50,00 de bônus**, conforme regras de utilização definidas pelo programa.

### CD5

- Forma de pagamento: Crédito ou Débito.
- Benefício: **5% de desconto + R$ 50,00 de bônus**, conforme regras de utilização definidas pelo programa.

**PD10 e CD5 não são cumulativos entre si, com outros descontos ou com o benefício normal de pontos.**

## 7. Excedente ao fechar o ciclo

Se uma compra fizer o cliente ultrapassar 1.000 pontos, o sistema deve converter apenas o bloco de 1.000 pontos e preservar o excedente para o novo ciclo.

Exemplo:

- saldo: 850 pontos;
- nova compra elegível: +300 pontos;
- total: 1.150 pontos;
- gera R$ 50,00 de prêmio pelo ciclo concluído;
- novo ciclo começa com **150 pontos**.

## 8. Origem das compras

As compras participantes podem ter origem:

- `SITE`
- `PDV_BLING`
- futuramente `PDV_CAPITAO`

A origem deve ser armazenada na transação de pontos para permitir auditoria e relatórios.

## 9. Cancelamentos, devoluções e estornos

Pontos gerados por uma venda cancelada, devolvida ou estornada devem possuir uma transação de reversão correspondente. O sistema não deve simplesmente apagar o histórico.

As regras exatas de reversão e tratamento de benefícios já utilizados serão definidas antes da fase de produção.

## 10. Princípio de segurança

Toda alteração de pontos deve ser rastreável:

- cliente;
- origem;
- pedido/venda;
- tipo da movimentação;
- pontos;
- data/hora;
- ciclo;
- referência da operação;
- motivo quando for ajuste manual.

O saldo exibido ao cliente deve ser derivado de movimentações confiáveis, e não de valores fornecidos pelo navegador.

## 11. Status

Este documento representa a especificação da **Fase 1 — Fundação e Regras**. Regras de validade dos benefícios, compra mínima, produtos participantes, tratamento fiscal/contábil e demais restrições comerciais permanecem como decisões pendentes antes da produção.
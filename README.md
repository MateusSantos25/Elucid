![Testes](https://github.com/MateusSantos25/Elucid/actions/workflows/testes.yml/badge.svg)

# Elucid

*Turn your data into clear answers.*

**Análise de dados com assistente de IA, para quem não é programador.**

A pessoa arrasta uma planilha (Excel, CSV ou JSON), escolhe o que quer investigar (por exemplo, *por que os clientes estão cancelando*) e o Elucid mostra os números, os gráficos, os grupos de maior risco e um plano de ação. Tudo roda no navegador, em um único arquivo: não precisa instalar nada.

<!-- Coloque aqui 2 ou 3 prints. Dica: a aba "Actions" do GitHub guarda as capturas de tela dos testes (artefato "capturas").
![Tela de análise](docs/analise.png)
-->

## A origem

O Elucid nasceu da junção de dois projetos meus em Python:

1. Um notebook com **pandas** que analisava uma base de 50 mil clientes e encontrava as regras de cancelamento (contrato mensal, atraso acima de 20 dias, muitas ligações ao call center).
2. Um chatbot com **Streamlit** ligado ao **Gemini**.

A ideia foi transformar os dois em um produto que funciona com **qualquer base de dados**, não só com cancelamentos.

> **Sobre este projeto:** ele foi um treino de uso do **Claude Code**, a ferramenta de programação com IA que aprendi no curso. Eu defini o problema, as regras e as decisões e avaliei cada versão, e o código foi escrito com o Claude Code.

## Decisões de projeto

- **A IA não faz as contas.** O Gemini recebe só os nomes e os resumos das colunas e escolhe quais análises rodar. Quem calcula é o motor do próprio Elucid. Assim a IA não inventa números.
- **Os dados não saem do computador.** O arquivo é lido no navegador e as linhas da base nunca são enviadas para a IA.
- **Tudo funciona sem IA.** As análises, os gráficos e um plano de ação básico funcionam sem chave do Gemini.
- **Nenhuma dependência.** O motor de análise (portado do pandas), a leitura de Excel e os gráficos em SVG foram escritos do zero, sem bibliotecas nem CDN.
- **Números conferidos.** Os testes comparam os resultados do motor em JavaScript com os do pandas: precisam ser idênticos.

## O que ele faz

- Prévia da planilha com os dados vazios destacados e tratamento coluna a coluna (mediana, moda, remover linhas...).
- 8 análises: taxa por coluna, grupos de risco, ranking de fatores, médias, distribuição, evolução no tempo e outras.
- Perguntas em linguagem simples para o assistente.
- Comparação com o arquivo de outro período (o mês passado subiu ou caiu, e onde).
- Plano de ação com três cenários (conservador, realista e ambicioso), que dá para baixar.
- Painel com cartões arrastáveis, modo apresentação e exportação em HTML.

## Como usar

Baixe o projeto e dê dois cliques em `elucid.html`. Para usar o assistente, clique em **Chave do Gemini** e cole a sua chave (ela fica salva só no seu navegador). Mais detalhes em [`LEIA-ME.md`](LEIA-ME.md).

Também dá para publicar para uma equipe, com a chave guardada no servidor: veja [`publicar/PUBLICAR.md`](publicar/PUBLICAR.md).

## Como o código está organizado

```
dados.js → limpeza.js → analises.js → assistente.js (Gemini) → graficos.js → app.js
  lê         trata       calcula        escolhe e explica          desenha       telas
```

O código fica em `src/`. O `python construir.py` junta tudo no `elucid.html`.

## Testes

A cada envio, o GitHub Actions confere se o `elucid.html` está atualizado e roda:

- `testes/test_nucleo.js`: o motor de análise comparado com o pandas;
- `testes/test_servidor.mjs`: a função do servidor (Netlify);
- `testes/e2e_*.py`: testes de ponta a ponta no navegador, com Playwright e o Gemini simulado.

## Tecnologias

JavaScript (sem frameworks), HTML, CSS, SVG, Python (build e testes), Playwright, Gemini API, Netlify Functions e GitHub Actions.

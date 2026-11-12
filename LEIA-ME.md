# Elucid: análise de dados em linguagem simples

**Para usar:** dê dois cliques em `elucid.html`. Não precisa instalar nada nem abrir o prompt de comando.

1. Arraste uma planilha (Excel `.xlsx`, CSV ou JSON) para a tela.
2. Escolha o que investigar (por exemplo, `cancelou`) e confirme o tratamento dos dados vazios.
3. Clique em uma análise pronta ou escreva uma pergunta.
4. Adicione os gráficos que quiser ao **Painel**, apresente em tela cheia ou baixe o painel como um arquivo HTML.

## O assistente (Gemini)

Não tem uma chave? Veja o passo a passo em [`chave.html`](https://mateussantos25.github.io/Elucid/chave.html) (grátis, uns 2 minutos).

As análises prontas funcionam sem chave. Para conversar com o assistente e montar o plano de ação com texto da IA, há dois jeitos:

- **Na empresa (recomendado):** o Elucid é publicado uma vez com a função da Netlify (veja `publicar/PUBLICAR.md`). A chave fica no servidor e a equipe digita só a **senha da equipe**. Ninguém precisa criar token.
- **No seu computador:** dê dois cliques em `colocar_chave.py` (cole a chave ou tecle só Enter para usar a `GOOGLE_API_KEY` do seu `.streamlit/secrets.toml`) ou, se preferir, clique em **Chave do Gemini** no menu lateral e cole a sua chave (fica salva só neste navegador), ou escreva-a em `segredos.js`, ao lado do `elucid.html` (não envie esse arquivo a outras pessoas).

## O que o Elucid faz

- **Análise:** pergunte em linguagem simples ou use as análises prontas.
- **Comparar colunas:** na tabela de prévia, clique no nome de uma ou mais colunas (até 5) e use “Comparar”. O Elucid mostra como cada uma se relaciona com o que você investiga, e qual pesa mais.
- **Painel com apresentação:** o arquivo baixado em “Baixar HTML” já vem com o botão “Apresentar” (tela cheia, setas do teclado; tecla P também abre).
- **Prévia do arquivo:** logo depois de enviar, você vê as primeiras linhas com todas as colunas e pode **Expandir** para ver mais linhas e procurar uma coluna. Os dados vazios aparecem destacados.
- **Comparar com outro arquivo:** envie o arquivo do mês passado (ou de qualquer outro período, com as mesmas colunas) e veja se a taxa subiu ou caiu, em quais grupos e se a diferença é grande o bastante para não ser acaso. Use o botão “Comparar com outro arquivo” na tela de análise.
- **Plano de ação:** calcula onde estão as maiores oportunidades (grupos que concentram os cancelamentos, por exemplo), simula três cenários de melhora e a IA escreve as ações, os responsáveis, em quanto tempo aparecem os primeiros sinais e o resultado pleno, como medir e os próximos 30 dias. Dá para baixar o plano (arquivo para imprimir ou salvar em PDF) e levá-lo ao Painel. Sem a IA, aparece um plano básico com os mesmos números.
- **Painel:** reúna os gráficos, escreva as frases de destaque e **arraste os cartões para organizar a ordem** antes de apresentar ou baixar (também dá para usar as setas do teclado na alça de cada cartão).

## Privacidade

O arquivo é lido dentro do seu navegador e nunca é enviado a lugar nenhum. Quando você faz uma pergunta,
o Gemini recebe apenas os nomes das colunas e resumos, nunca as linhas da sua base. Ele não executa código:
todos os números vêm do motor de análise do próprio Elucid.

## Limites

- Precisa de internet para as fontes e para o Gemini (as análises prontas e os gráficos funcionam sem).
- Planilhas `.xls` antigas não são aceitas: salve como `.xlsx`.
- Limite de 150 MB por arquivo.

## Para quem for mexer no código

O código-fonte fica em `src/` (um arquivo por assunto). Depois de editar, rode `python construir.py`
para gerar de novo o `elucid.html`.

| Arquivo               | O que faz                                                    |
|-----------------------|--------------------------------------------------------------|
| `src/dados.js`        | Lê CSV, Excel e JSON e acerta os tipos das colunas           |
| `src/limpeza.js`      | Tratamento de dados vazios                                   |
| `src/analises.js`     | As 8 análises (e o catálogo que o assistente conhece)        |
| `src/assistente.js`   | Conversa com o Gemini (direto ou pelo servidor da empresa)   |
| `src/plano.js`        | Oportunidades, cenários e plano de ação (números sem IA, texto com IA) |
| `src/servico.js`      | Sessão local e dados de exemplo                              |
| `src/graficos.js`     | Gráficos em SVG (barras, ranking, linha, rosca, tabela...)   |
| `src/app.js`          | Telas, conversa, painel e apresentação                       |
| `src/estilo.css`      | Visual escuro                                                |

Nome do assistente, modelo e cores: `NOME` em `src/assistente.js`, `ELUCID_MODELO` em `segredos.js`,
cores em `src/estilo.css` (variáveis no topo).

## Testes

```
node testes/test_nucleo.js          # confere as análises com os números do pandas, lê CSV/Excel/JSON
node testes/test_servidor.mjs       # a função da Netlify (senha, limites, o que ela repassa), sem rede
python testes/e2e_navegador.py      # abre o elucid.html num navegador de verdade (playwright)
python testes/e2e_arrastar.py       # arrastar e soltar no painel
python testes/e2e_plano.py          # plano de ação, download, painel e apresentação
python testes/e2e_servidor.py       # modo servidor: só a senha da equipe
python testes/e2e_previa.py         # prévia do arquivo, expandir e buscar coluna
python testes/e2e_comparar.py       # comparar com o arquivo de outro período
python testes/e2e_v5.py             # logo, comparar colunas por clique, HTML exportado com apresentação
```

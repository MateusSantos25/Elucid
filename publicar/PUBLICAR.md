# Publicar o Elucid para a equipe (sem ninguém precisar de chave)

**Resultado:** a equipe abre um link, digita uma senha e usa o assistente. Ninguém cria nem cola chave do Gemini.
A chave fica guardada no servidor, em uma função da Netlify, e nunca chega ao navegador.

Isso é feito **uma vez**, por uma pessoa (de TI ou o administrador do Elucid). Depois, todo mundo só abre o link.

## O que há nesta pasta

```
publicar/
  netlify.toml                  diz à Netlify onde estão o site e a função
  site/index.html               o Elucid (é o mesmo elucid.html, gerado por construir.py)
  netlify/functions/gemini.mjs  a função que guarda a chave e confere a senha
```

A função fica **fora** da pasta `site` de propósito: a Netlify recomenda isso para que o código dela não seja publicado como parte do site.

## Antes de começar

1. Uma conta na Netlify (netlify.com).
2. Uma chave do Gemini, criada no Google AI Studio por quem vai administrar ([passo a passo](https://mateussantos25.github.io/Elucid/chave.html)). **Só essa pessoa vê a chave.**
3. O Node.js instalado no computador de quem vai publicar (nodejs.org, versão LTS).
4. Escolha uma **senha da equipe**. Use algo longo e que não seja a senha de nada pessoal.

## Passo a passo

Abra o terminal (prompt de comando) **dentro da pasta `publicar`** e rode, uma linha por vez:

```
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

No `netlify deploy`, ele pergunta se deve criar um site novo. Responda que sim e escolha um nome (por exemplo `elucid-suaempresa`).

Depois configure as duas variáveis. Pelo terminal:

```
netlify env:set GEMINI_API_KEY "cole-a-chave-aqui"
netlify env:set ELUCID_SENHA "a-senha-da-equipe"
```

(ou pelo site da Netlify: *Site configuration → Environment variables*. Atenção: o escopo da variável precisa incluir **Functions**.)

**Publique de novo**, porque a Netlify só aplica as variáveis em um deploy novo:

```
netlify deploy --prod
```

### Conferir

1. Abra `https://SEU-SITE.netlify.app/api/gemini` no navegador. Deve aparecer `{"elucid":"proxy","versao":1}`.
   Isso só confirma que a função está no ar; não mostra nada secreto.
2. Abra `https://SEU-SITE.netlify.app`, envie uma planilha, faça uma pergunta e digite a senha quando o Elucid pedir.

Pronto. Envie à equipe **o link e a senha**. A senha fica salva no navegador de cada pessoa depois da primeira vez.

## Variáveis (todas na Netlify, nunca no site)

| Variável         | Obrigatória | O que é                                                       |
|------------------|-------------|---------------------------------------------------------------|
| `GEMINI_API_KEY` | sim         | Chave do Gemini                                               |
| `ELUCID_SENHA`    | sim         | Senha da equipe. Sem ela o servidor recusa tudo               |
| `ELUCID_MODELO`   | não         | Modelo do Gemini (padrão `gemini-3.5-flash-lite`)             |
| `ELUCID_LIMITE`   | não         | Pedidos por minuto por pessoa (padrão 30)                     |
| `ELUCID_ORIGEM`   | não         | Só se alguém abrir o `elucid.html` fora do site: endereços liberados, separados por vírgula |

## Segurança, em linguagem simples

- A chave nunca vai para o navegador nem para o site. Só a função a conhece.
- A função só aceita pedidos com a senha certa. Depois de 8 tentativas erradas, a pessoa é bloqueada por alguns minutos.
- A função só repassa ao Gemini o que o Elucid usa (texto e configuração básica). Não deixa escolher outro modelo nem ligar ferramentas.
- O limite por minuto e o bloqueio valem por instância do servidor; é uma proteção prática, não absoluta. **Para limitar custo de verdade, defina uma cota ou limite de gastos no próprio Google AI Studio.**
- Trocar a senha: mude `ELUCID_SENHA` e publique de novo. Trocar a chave: mude `GEMINI_API_KEY` e publique de novo.
- A planilha continua sendo lida só no navegador de quem a abriu. O que passa pela função são os nomes das colunas, resumos e a pergunta, nunca as linhas.

## Importante: como publicar

A Netlify publica funções por **Git** ou pelo **CLI** (o passo a passo acima). A documentação da Netlify cita o Git e o CLI como formas de publicar funções ([Functions](https://docs.netlify.com/build/functions/get-started), [comando `netlify deploy`](https://cli.netlify.com/commands/deploy)). Já *arrastar a pasta para o site* (drag and drop) não aparece na documentação para funções, e em um fórum da comunidade a orientação foi que funções só funcionam por Git ou CLI ([discussão](https://answers.netlify.com/t/functions-not-working-after-manual-deployment/74542)). Por isso este guia usa o CLI.

> Observação de quem montou este pacote: o código da função e o funcionamento no navegador foram testados com simulações (sem uma conta Netlify de verdade). O primeiro deploy real é o teste final: se algo falhar, copie a mensagem de erro do terminal e peça ajuda.

## Quando alguém mexer no Elucid

Depois de editar o código em `src/`, rode `python construir.py` na pasta acima: ele gera o `elucid.html` e também atualiza `publicar/site/index.html`. Depois, `netlify deploy --prod` de novo.

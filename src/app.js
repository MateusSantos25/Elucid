/* Elucid: aplicativo (telas, conversa, painel e modo apresentação). */
(() => {
  "use strict";
  const Comum = window.Comum;
  const {
    h,
    esc,
    hoje,
    icone,
    marca,
    logoHero,
    desenharTodos,
    kpisEl,
    cartaoBase,
    cartaoPlano,
    elPlano,
    renderTexto,
    estatistica,
    elStat,
  } = window.Comum;
  const S = window.Elucid.servico,
    IA = window.Elucid.assistente,
    PL = window.Elucid.plano;
  const G = window.Graficos;
  const raiz = document.getElementById("app");
  const EXTENSOES = ["csv", "tsv", "txt", "xlsx", "xlsm", "xls", "json"];
  const rotulo = (c) => {
    const t = String(c).replace(/_/g, " ").trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  function lerPainel() {
    try {
      const p = JSON.parse(sessionStorage.getItem("elucid_painel"));
      if (p && Array.isArray(p.itens)) return p;
    } catch (e) {
      /* sem painel salvo */
    }
    return { titulo: "Resumo da análise", kpis: [], itens: [] };
  }
  const estado = {
    config: { nome: "Elucid", tem_exemplo: true },
    visao: "inicio",
    arquivo: null,
    preparo: null,
    escolha: { alvo: null, positivo: null, regras: {} },
    info: null,
    colsSel: [],
    mensagens: [],
    foco: -1,
    pensando: false,
    painel: lerPainel(),
    edicao: false,
    plano: null,
    planoForm: { contexto: "", periodo: null },
  };
  const salvarPainel = () => {
    try {
      sessionStorage.setItem("elucid_painel", JSON.stringify(estado.painel));
    } catch (e) {
      /* cheio */
    }
  };

  // ------------------------------------------------------------ avisos e rede
  let tempoAviso;
  function aviso(texto, erro) {
    let t = document.querySelector(".toast");
    if (!t) {
      t = h("div", { class: "toast", role: "status" });
      document.body.append(t);
    }
    t.textContent = texto;
    t.className = "toast mostrar" + (erro ? " erro" : "");
    clearTimeout(tempoAviso);
    tempoAviso = setTimeout(() => t.classList.remove("mostrar"), erro ? 5200 : 2600);
  }
  function carregando(texto) {
    const e = h("div", { class: "carregando", role: "alert" }, h("div", {}, h("span", { class: "roda" }), texto));
    document.body.append(e);
    return () => e.remove();
  }
  // ------------------------------------------------------------ chave do Gemini
  function abrirSenha() {
    const atual = IA.senhaSalva();
    const campo = h("input", {
      type: "password",
      id: "senha",
      placeholder: "Senha da equipe",
      autocomplete: "off",
      value: atual,
    });
    const fechar = () => {
      fundo.remove();
      render();
    };
    const salvar = () => {
      const v = campo.value.trim();
      IA.salvarSenha(v);
      fechar();
      aviso(v ? "Senha salva neste navegador" : "Senha removida");
    };
    campo.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") salvar();
      if (ev.key === "Escape") fechar();
    });
    const fundo = h(
      "div",
      { class: "modal", role: "dialog", "aria-label": "Senha da equipe" },
      h(
        "div",
        { class: "modal-cartao" },
        h("h2", { class: "serif" }, "Senha da equipe"),
        h(
          "p",
          {},
          "Digite a senha para liberar o assistente. Quem administra o Elucid na sua empresa informa a senha. Você não precisa criar nenhuma chave. As análises prontas funcionam sem a senha.",
        ),
        campo,
        h(
          "div",
          { class: "modal-acoes" },
          h("button", { class: "btn btn-fantasma", onclick: fechar }, "Cancelar"),
          atual
            ? h(
                "button",
                {
                  class: "btn",
                  onclick: () => {
                    campo.value = "";
                    salvar();
                  },
                },
                "Remover",
              )
            : null,
          h("button", { class: "btn btn-primario", onclick: salvar }, "Entrar"),
        ),
      ),
    );
    document.body.append(fundo);
    campo.focus();
  }
  function abrirChave() {
    if (IA.modoServidor()) return abrirSenha();
    const atual = localStorage.getItem("elucid_chave") || "";
    const campo = h("input", {
      type: "password",
      id: "chave",
      placeholder: "Cole aqui a sua chave do Gemini",
      autocomplete: "off",
      value: atual,
    });
    const fechar = () => {
      fundo.remove();
      render();
    };
    const salvar = () => {
      const v = campo.value.trim();
      if (v) localStorage.setItem("elucid_chave", v);
      else localStorage.removeItem("elucid_chave");
      fechar();
      aviso(v ? "Chave salva neste navegador" : "Chave removida");
    };
    campo.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") salvar();
      if (ev.key === "Escape") fechar();
    });
    const fundo = h(
      "div",
      { class: "modal", role: "dialog", "aria-label": "Chave do Gemini" },
      h(
        "div",
        { class: "modal-cartao" },
        h("h2", { class: "serif" }, "Chave do Gemini"),
        h(
          "p",
          {},
          "O assistente precisa da sua chave para entender as perguntas. Ela fica salva só neste navegador e é enviada apenas ao Google. As análises prontas funcionam sem chave.",
        ),
        h(
          "p",
          {},
          "Não tem uma chave? ",
          // endereço completo: funciona também quando o elucid.html é aberto sozinho, fora do site
          h(
            "a",
            {
              href: "https://mateussantos25.github.io/Elucid/chave.html",
              target: "_blank",
              rel: "noopener noreferrer",
              class: "modal-link",
            },
            "Veja como conseguir a sua (grátis, uns 2 minutos)",
          ),
          ".",
        ),
        h(
          "p",
          { class: "modal-dica" },
          "Dica: se preferir, escreva a chave no arquivo segredos.js, que fica ao lado do elucid.html.",
        ),
        campo,
        h(
          "div",
          { class: "modal-acoes" },
          h("button", { class: "btn btn-fantasma", onclick: fechar }, "Cancelar"),
          atual
            ? h(
                "button",
                {
                  class: "btn",
                  onclick: () => {
                    campo.value = "";
                    salvar();
                  },
                },
                "Remover",
              )
            : null,
          h("button", { class: "btn btn-primario", onclick: salvar }, "Salvar"),
        ),
      ),
    );
    document.body.append(fundo);
    campo.focus();
  }

  // ------------------------------------------------------------ estrutura
  function render() {
    document.title = estado.config.nome || "Elucid";
    raiz.innerHTML = "";
    G.esconderDica();
    const principal = h("main", { class: "principal", id: "principal" });
    raiz.append(h("div", { class: "app" }, barraLateral(), principal));
    ({
      inicio: telaInicio,
      abas: telaAbas,
      preparar: telaPreparar,
      analise: telaAnalise,
      plano: telaPlano,
      painel: telaPainel,
    })[estado.visao](principal);
    desenharTodos(principal);
  }
  function barraLateral() {
    const naAnalise = estado.visao !== "painel" && estado.visao !== "plano";
    const botao = (rot, ic, atual, aoClicar, selo, desligado) =>
      h(
        "button",
        {
          "aria-current": atual ? "page" : null,
          onclick: aoClicar,
          disabled: desligado ? true : null,
          title: desligado ? "Envie um arquivo para liberar" : null,
          "data-nav": ic,
        },
        icone(ic),
        rot,
        selo ? h("span", { class: "selo" }, selo) : null,
      );
    return h(
      "aside",
      { class: "lateral" },
      h(
        "div",
        { class: "marca" },
        marca(),
        h("div", {}, h("div", { class: "marca-nome" }, estado.config.nome || "Elucid")),
      ),
      h(
        "nav",
        { class: "nav", "aria-label": "Principal" },
        botao("Análise", "analise", naAnalise, () => {
          estado.visao = estado.info ? "analise" : estado.preparo ? "preparar" : "inicio";
          render();
        }),
        botao(
          "Plano de ação",
          "plano",
          estado.visao === "plano",
          () => {
            estado.visao = "plano";
            render();
          },
          null,
          !estado.info,
        ),
        botao(
          "Painel",
          "painel",
          estado.visao === "painel",
          () => {
            estado.visao = "painel";
            render();
          },
          estado.painel.itens.length || null,
        ),
      ),
      h(
        "div",
        { class: "lateral-pe" },
        estado.arquivo
          ? h(
              "div",
              { class: "arquivo" },
              h(
                "div",
                {},
                h("div", { class: "arquivo-nome" }, estado.arquivo.nome),
                h(
                  "div",
                  { class: "arquivo-meta" },
                  `${G.fmt(estado.arquivo.linhas, "n")} linhas, ${estado.arquivo.colunas} colunas`,
                ),
              ),
              h(
                "div",
                { class: "arquivo-acoes" },
                h(
                  "button",
                  {
                    class: "btn btn-pequeno",
                    onclick: () => {
                      estado.visao = "preparar";
                      render();
                    },
                  },
                  icone("ajustes", 15),
                  "Ajustar",
                ),
                h(
                  "button",
                  { class: "btn btn-pequeno", onclick: () => abrirDados() },
                  icone("tabela", 15),
                  "Ver dados",
                ),
                h(
                  "button",
                  { class: "btn btn-pequeno btn-fantasma", onclick: trocarArquivo },
                  icone("troca", 15),
                  "Trocar",
                ),
              ),
            )
          : null,
        h(
          "button",
          { class: "btn btn-fantasma chave-btn", onclick: abrirChave },
          icone("chave", 16),
          IA.modoServidor() ? "Senha da equipe" : "Chave do Gemini",
          h("span", {
            class: "ponto" + (IA.chaveConfigurada() ? " ok" : ""),
            title: IA.modoServidor()
              ? IA.chaveConfigurada()
                ? "Senha informada"
                : "Senha não informada"
              : IA.chaveConfigurada()
                ? "Chave configurada"
                : "Chave não configurada",
          }),
        ),
      ),
    );
  }
  function trocarArquivo() {
    S.limpar();
    Object.assign(estado, {
      arquivo: null,
      preparo: null,
      info: null,
      colsSel: [],
      mensagens: [],
      foco: -1,
      visao: "inicio",
      plano: null,
    });
    estado.escolha = { alvo: null, positivo: null, regras: {} };
    render();
  }
  // ------------------------------------------------------------ início e envio
  function telaInicio(p) {
    const entrada = h("input", {
      type: "file",
      hidden: true,
      accept: EXTENSOES.map((e) => "." + e).join(","),
      onchange: (ev) => ev.target.files[0] && enviar(ev.target.files[0]),
    });
    const abrir = () => entrada.click();
    const soltar = h(
      "div",
      {
        class: "soltar",
        tabindex: "0",
        role: "button",
        "aria-label": "Escolher um arquivo",
        onclick: abrir,
        onkeydown: (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            abrir();
          }
        },
        ondragover: (ev) => {
          ev.preventDefault();
          soltar.classList.add("sobre");
        },
        ondragleave: () => soltar.classList.remove("sobre"),
        ondrop: (ev) => {
          ev.preventDefault();
          soltar.classList.remove("sobre");
          if (ev.dataTransfer.files[0]) enviar(ev.dataTransfer.files[0]);
        },
      },
      icone("upload", 34),
      h("strong", {}, "Arraste um arquivo para cá ou clique para escolher"),
      h("span", {}, "Planilhas e tabelas de qualquer assunto"),
      h(
        "div",
        { class: "formatos" },
        ["Excel", "CSV", "JSON"].map((f) => h("span", { class: "formato" }, f)),
      ),
    );
    p.append(
      h(
        "div",
        { class: "centro" },
        h(
          "div",
          { class: "hero" },
          logoHero(estado.config.nome || "Elucid"),
          h("p", {}, "Envie uma planilha e descubra o que está por trás dos números. Sem fórmulas e sem código."),
          soltar,
          entrada,
          estado.config.tem_exemplo
            ? h("div", {}, h("button", { class: "btn", onclick: usarExemplo }, "Testar com dados de exemplo"))
            : null,
          h(
            "div",
            { class: "privacidade" },
            icone("escudo", 16),
            h(
              "span",
              {},
              "Seu arquivo é lido aqui mesmo, no seu navegador, e não é enviado a lugar nenhum. Ao fazer uma pergunta, o Gemini recebe apenas os nomes das colunas e resumos, nunca as linhas da sua base.",
            ),
          ),
        ),
      ),
    );
  }
  async function enviar(arquivo) {
    const ext = arquivo.name.split(".").pop().toLowerCase();
    if (!EXTENSOES.includes(ext)) return aviso(`Não consigo abrir arquivos .${ext}. Use Excel, CSV ou JSON.`, true);
    const fim = carregando("Lendo o arquivo…");
    try {
      receber(await S.abrirArquivo(arquivo));
    } catch (e) {
      aviso(e.message, true);
    } finally {
      fim();
    }
  }
  async function usarExemplo() {
    const fim = carregando("Abrindo os dados de exemplo…");
    try {
      receber(await S.abrirExemplo());
    } catch (e) {
      aviso(e.message, true);
    } finally {
      fim();
    }
  }
  function receber(r) {
    if (r.precisa_aba) {
      estado.preparo = { abas: r.abas, nome: r.nome };
      estado.visao = "abas";
      render();
      return;
    }
    estado.arquivo = { nome: r.nome, linhas: r.linhas, colunas: r.colunas };
    estado.preparo = r;
    estado.info = null;
    estado.colsSel = [];
    estado.mensagens = [];
    estado.foco = -1;
    const c = r.candidatos.find((x) => x.coluna === r.alvo_sugerido);
    estado.escolha = {
      alvo: r.alvo_sugerido,
      positivo: c ? c.sugerido : null,
      regras: Object.fromEntries(r.vazios.map((v) => [v.coluna, v.sugerida])),
    };
    estado.visao = "preparar";
    render();
  }
  function telaAbas(p) {
    const sel = h(
      "select",
      { id: "aba" },
      estado.preparo.abas.map((a) => h("option", { value: a }, a)),
    );
    p.append(
      h(
        "div",
        { class: "centro" },
        h(
          "div",
          { class: "passo" },
          h("h2", {}, "Qual aba você quer analisar?"),
          h("p", {}, "Esta planilha tem mais de uma aba."),
          sel,
          h(
            "div",
            {},
            h(
              "button",
              {
                class: "btn btn-primario",
                onclick: async () => {
                  const fim = carregando("Lendo a aba…");
                  try {
                    receber(await S.escolherAba(sel.value));
                  } catch (e) {
                    aviso(e.message, true);
                  } finally {
                    fim();
                  }
                },
              },
              "Abrir aba",
            ),
          ),
        ),
      ),
    );
  }

  // ------------------------------------------------------------ preparar os dados
  function telaPreparar(p) {
    const pr = estado.preparo,
      es = estado.escolha,
      cand = pr.candidatos;
    const selAlvo = h(
      "select",
      {
        id: "alvo",
        onchange: (ev) => {
          es.alvo = ev.target.value || null;
          const c = cand.find((x) => x.coluna === es.alvo);
          es.positivo = c ? c.sugerido : null;
          render();
        },
      },
      h("option", { value: "" }, "Nada em especial, só explorar os dados"),
      cand.map((c) => h("option", { value: c.coluna, selected: c.coluna === es.alvo }, rotulo(c.coluna))),
    );
    const atual = cand.find((c) => c.coluna === es.alvo);
    const campoValor = atual
      ? h(
          "div",
          { class: "campo" },
          h("label", {}, `Qual valor de “${atual.coluna}” significa que aconteceu?`),
          atual.valores.length <= 4
            ? h(
                "div",
                { class: "seg", role: "group" },
                atual.valores.map((v) =>
                  h(
                    "button",
                    {
                      "aria-pressed": String(es.positivo === v),
                      onclick: () => {
                        es.positivo = v;
                        render();
                      },
                    },
                    String(v),
                  ),
                ),
              )
            : h(
                "select",
                {
                  onchange: (ev) => {
                    es.positivo = atual.valores.find((v) => String(v) === ev.target.value);
                  },
                },
                atual.valores.map((v) => h("option", { value: String(v), selected: v === es.positivo }, String(v))),
              ),
        )
      : null;
    const vazios = pr.vazios.length
      ? h(
          "details",
          { class: "vazios" },
          h(
            "summary",
            {},
            `Dados vazios em ${pr.vazios.length} ${pr.vazios.length === 1 ? "coluna" : "colunas"}`,
            h("small", {}, "Já deixei uma sugestão para cada uma"),
          ),
          h(
            "div",
            { class: "vazios-lista" },
            pr.vazios.map((v) =>
              h(
                "div",
                { class: "vazio-linha" },
                h("span", {}, v.coluna, h("small", {}, `${G.fmt(v.pct, "%")} vazios`)),
                h(
                  "select",
                  {
                    "aria-label": `O que fazer com os vazios de ${v.coluna}`,
                    onchange: (ev) => {
                      es.regras[v.coluna] = ev.target.value;
                    },
                  },
                  v.opcoes.map((o) => h("option", { value: o.id, selected: o.id === es.regras[v.coluna] }, o.rotulo)),
                ),
              ),
            ),
          ),
        )
      : null;
    p.append(
      h(
        "div",
        { class: "preparar" },
        h(
          "div",
          { class: "preparar-topo" },
          h("span", { class: "plano-kicker" }, "Arquivo aberto"),
          h("h1", {}, estado.arquivo.nome),
          h(
            "p",
            {},
            `${G.fmt(estado.arquivo.linhas, "n")} linhas e ${estado.arquivo.colunas} colunas. Confira a prévia e diga o que você quer descobrir.`,
          ),
        ),
        h(
          "div",
          { class: "preparar-grade" },
          h(
            "div",
            { class: "passo" },
            h(
              "div",
              {},
              h("h2", {}, "O que você quer descobrir?"),
              h(
                "p",
                {},
                "Escolha a coluna que mostra se algo aconteceu, como cancelou, comprou ou atrasou. Assim consigo apontar os motivos.",
              ),
            ),
            h("div", { class: "campo" }, h("label", { for: "alvo" }, "Quero investigar"), selAlvo),
            campoValor,
            vazios,
            h("div", {}, h("button", { class: "btn btn-primario", onclick: confirmar }, "Começar análise")),
          ),
          cartaoPrevia(es.alvo),
        ),
      ),
    );
  }

  // ------------------------------------------------------------ prévia do arquivo
  const NOME_TIPO = { numero: "Número", texto: "Texto", data: "Data" };
  /** Tabela com todas as colunas. `filtro` esconde colunas pelo nome; `alvo` destaca a coluna investigada. */
  function tabelaPrevia(dados, { alvo = null, filtro = "" } = {}) {
    const f = String(filtro).trim().toLowerCase(),
      ids = dados.colunas.map((c, i) => i).filter((i) => !f || dados.colunas[i].nome.toLowerCase().includes(f));
    if (!ids.length) return h("p", { class: "previa-nada" }, "Nenhuma coluna com esse nome.");
    const cab = h(
      "tr",
      {},
      h("th", { class: "tp-n" }, "#"),
      ids.map((i) => {
        const c = dados.colunas[i];
        const marcada = estado.colsSel.includes(c.nome);
        return h(
          "th",
          {
            class: (c.nome === alvo ? "alvo " : "") + (c.tipo === "numero" ? "num " : "") + (marcada ? "sel" : ""),
            "data-col": c.nome,
            tabindex: "0",
            role: "button",
            "aria-pressed": String(marcada),
            title: `${c.nome}: ${NOME_TIPO[c.tipo]}, ${G.fmt(c.distintos, "n")} valores diferentes. Clique para comparar esta coluna.`,
            onclick: () => alternarColuna(c.nome),
            onkeydown: (ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                alternarColuna(c.nome);
              }
            },
          },
          h("span", { class: "tp-nome" }, c.nome),
          h(
            "span",
            { class: "tp-meta" },
            h("i", { class: "tipo-" + c.tipo }, NOME_TIPO[c.tipo]),
            c.vazios ? h("i", { class: "tp-vazios" }, `${G.fmt(c.pct_vazios, "%")} vazios`) : null,
          ),
        );
      }),
    );
    const corpo = dados.linhas.map((l, k) =>
      h(
        "tr",
        {},
        h("td", { class: "tp-n" }, k + 1),
        ids.map((i) => {
          const v = l[i],
            c = dados.colunas[i];
          const marc = estado.colsSel.includes(c.nome) ? " sel" : "";
          return v == null
            ? h("td", { class: "tp-vazio" + marc, "data-col": c.nome, title: "Dado vazio" }, "vazio")
            : h("td", { class: (c.tipo === "numero" ? "num" : "") + marc, "data-col": c.nome }, v);
        }),
      ),
    );
    return h("table", { class: "tp" }, h("thead", {}, cab), h("tbody", {}, corpo));
  }
  // ---- clicar nas colunas para compará-las com o que está sendo investigado
  function alternarColuna(nome) {
    if (estado.escolha.alvo === nome)
      return aviso("Essa é a coluna que você está investigando. Clique em outra para comparar.");
    const k = estado.colsSel.indexOf(nome);
    if (k >= 0) estado.colsSel.splice(k, 1);
    else {
      if (estado.colsSel.length >= 5) return aviso("Dá para comparar até 5 colunas de uma vez.", true);
      estado.colsSel.push(nome);
    }
    pintarSelecao();
  }
  function pintarSelecao() {
    document.querySelectorAll(".tp [data-col]").forEach((el) => {
      const on = estado.colsSel.includes(el.dataset.col);
      el.classList.toggle("sel", on);
      if (el.tagName === "TH") el.setAttribute("aria-pressed", String(on));
    });
    document.querySelectorAll(".barra-colunas").forEach((b) => b.replaceChildren(...conteudoBarra()));
  }
  function conteudoBarra() {
    const sel = estado.colsSel,
      alvo = estado.escolha.alvo;
    if (!sel.length)
      return [
        h(
          "span",
          { class: "bc-dica" },
          icone("comparar", 15),
          alvo
            ? `Clique nas colunas da tabela para compará-las com “${alvo}”.`
            : "Clique nas colunas da tabela para ver como cada uma se distribui.",
        ),
      ];
    return [
      h(
        "span",
        { class: "bc-sel" },
        sel.map((c) =>
          h(
            "button",
            { class: "bc-chip", title: "Tirar da comparação", onclick: () => alternarColuna(c) },
            c,
            icone("x", 12),
          ),
        ),
      ),
      h(
        "span",
        { class: "bc-acoes" },
        h(
          "button",
          {
            class: "btn btn-pequeno btn-fantasma",
            id: "btn-limpar-colunas",
            onclick: () => {
              estado.colsSel = [];
              pintarSelecao();
            },
          },
          "Limpar",
        ),
        h(
          "button",
          { class: "btn btn-pequeno btn-ouro", id: "btn-comparar-colunas", onclick: compararSelecionadas },
          icone("comparar", 15),
          sel.length === 1 ? "Comparar 1 coluna" : `Comparar ${sel.length} colunas`,
        ),
      ),
    ];
  }
  function barraColunas() {
    const b = h("div", { class: "barra-colunas" });
    b.replaceChildren(...conteudoBarra());
    return b;
  }
  let fecharDadosAtual = null;
  async function compararSelecionadas() {
    const cols = estado.colsSel.slice();
    if (!cols.length) return;
    if (fecharDadosAtual) fecharDadosAtual();
    if (estado.visao === "preparar" || !estado.info) {
      await confirmar();
      if (!estado.info) return;
    }
    const fim = carregando("Comparando as colunas…");
    try {
      const r = await S.compararColunas(cols);
      estado.mensagens.push({ papel: "user", texto: `Comparar ${r.colunas.join(", ")}`, resultados: [] });
      const resultados = r.resultados.map((x) => Object.assign(x, { tipo: x.tipo_padrao }));
      estado.mensagens.push({ papel: "ia", texto: r.texto, resultados });
      estado.foco = estado.mensagens.length - 1;
      estado.colsSel = [];
      estado.visao = "analise";
      render();
    } catch (e) {
      aviso(e.message, true);
    } finally {
      fim();
    }
  }
  function cartaoPrevia(alvo) {
    let dados;
    try {
      dados = S.previa(8);
    } catch (e) {
      return h("span");
    }
    const comVazios = dados.colunas.filter((c) => c.vazios).length;
    return h(
      "section",
      { class: "previa" },
      h(
        "div",
        { class: "previa-topo" },
        h(
          "div",
          {},
          h("h3", {}, "Prévia do arquivo"),
          h(
            "p",
            {},
            `Primeiras ${dados.mostrando} de ${G.fmt(dados.total_linhas, "n")} linhas. ${comVazios ? `${comVazios} ${comVazios === 1 ? "coluna tem" : "colunas têm"} dados vazios.` : "Nenhuma coluna tem dados vazios."}`,
          ),
        ),
        h(
          "button",
          { class: "btn btn-pequeno", onclick: () => abrirDados(), "aria-label": "Expandir a prévia" },
          icone("expandir", 15),
          "Expandir",
        ),
      ),
      barraColunas(),
      h("div", { class: "previa-rolagem" }, tabelaPrevia(dados, { alvo })),
    );
  }
  /** Janela grande com todas as colunas, mais linhas e busca por coluna. */
  function abrirDados() {
    let linhas = 100,
      filtro = "",
      dados;
    try {
      dados = S.previa(linhas);
    } catch (e) {
      return aviso(e.message, true);
    }
    const info = h("p", { class: "dados-info" }),
      tabela = h("div", { class: "previa-rolagem grande" });
    const resumo = h("div", { class: "dados-resumo" });
    const pintar = () => {
      dados = S.previa(linhas);
      info.textContent = `${dados.nome}: mostrando as primeiras ${G.fmt(dados.mostrando, "n")} de ${G.fmt(dados.total_linhas, "n")} linhas, ${dados.colunas.length} colunas.`;
      tabela.replaceChildren(tabelaPrevia(dados, { alvo: estado.escolha.alvo, filtro }));
      const v = dados.colunas.filter((c) => c.vazios);
      resumo.textContent = v.length
        ? "Com dados vazios: " + v.map((c) => `${c.nome} (${G.fmt(c.pct_vazios, "%")})`).join(", ") + "."
        : "Nenhuma coluna tem dados vazios.";
    };
    const busca = h("input", {
      type: "text",
      placeholder: "Procurar coluna",
      "aria-label": "Procurar coluna",
      oninput: (ev) => {
        filtro = ev.target.value;
        pintar();
      },
    });
    const qtd = h(
      "select",
      {
        "aria-label": "Quantas linhas mostrar",
        onchange: (ev) => {
          linhas = Number(ev.target.value);
          pintar();
        },
      },
      [25, 100, 500, 1000].map((n) => h("option", { value: String(n), selected: n === linhas }, `${n} linhas`)),
    );
    const fechar = () => {
      document.removeEventListener("keydown", tecla);
      fundo.remove();
      fecharDadosAtual = null;
    };
    fecharDadosAtual = fechar;
    function tecla(ev) {
      if (ev.key === "Escape") fechar();
    }
    document.addEventListener("keydown", tecla);
    const fundo = h(
      "div",
      { class: "modal modal-largo", role: "dialog", "aria-label": "Dados do arquivo" },
      h(
        "div",
        { class: "modal-cartao" },
        h(
          "div",
          { class: "dados-topo" },
          h("div", {}, h("h2", { class: "serif" }, "Dados do arquivo"), info),
          h("button", { class: "btn btn-fantasma", onclick: fechar, "aria-label": "Fechar" }, icone("x", 16), "Fechar"),
        ),
        h("div", { class: "dados-ferramentas" }, busca, qtd, resumo),
        barraColunas(),
        tabela,
      ),
    );
    document.body.append(fundo);
    pintar();
    busca.focus();
  }
  // ------------------------------------------------------------ comparar com outro período
  function aplicarComparacao(r) {
    estado.mensagens.push({ papel: "user", texto: `Comparar com ${r.nome}`, resultados: [] });
    const resultados = r.resultados.map((x) => Object.assign(x, { tipo: x.tipo_padrao }));
    estado.mensagens.push({ papel: "ia", texto: r.texto, resultados });
    if (resultados.length) estado.foco = estado.mensagens.length - 1;
    estado.visao = "analise";
    render();
  }
  function abrirComparar() {
    const atual = S.comparacaoAtual();
    const campoAtual = h("input", {
      type: "text",
      id: "rot-atual",
      maxlength: "24",
      placeholder: "Ex.: Outubro",
      value: atual ? atual.rotuloAtual : "",
      autocomplete: "off",
    });
    const campoAnt = h("input", {
      type: "text",
      id: "rot-ant",
      maxlength: "24",
      placeholder: "Ex.: Setembro",
      value: atual ? atual.rotulo : "",
      autocomplete: "off",
    });
    const erro = h("p", { class: "modal-erro", role: "alert", hidden: true });
    const abas = h("div", { class: "modal-abas", hidden: true });
    const rotulos = () => ({ rotuloAtual: campoAtual.value, rotuloAnterior: campoAnt.value });
    const fechar = () => {
      document.removeEventListener("keydown", tecla);
      fundo.remove();
    };
    function tecla(ev) {
      if (ev.key === "Escape") fechar();
    }
    document.addEventListener("keydown", tecla);
    const mostrarErro = (msg) => {
      erro.textContent = msg;
      erro.hidden = !msg;
    };
    async function concluir(trabalho) {
      mostrarErro("");
      const fim = carregando("Comparando os dois períodos…");
      try {
        const r = await trabalho();
        if (r.precisa_aba) {
          abas.hidden = false;
          abas.replaceChildren(
            h("p", {}, "Esse arquivo tem mais de uma aba. Qual delas é a do outro período?"),
            ...r.abas.map((a) =>
              h(
                "button",
                { class: "btn btn-pequeno", onclick: () => concluir(() => S.escolherAbaComparacao(a, rotulos())) },
                a,
              ),
            ),
          );
          return;
        }
        fechar();
        aplicarComparacao(r);
      } catch (e) {
        mostrarErro(e.message);
      } finally {
        fim();
      }
    }
    const entrada = h("input", {
      type: "file",
      hidden: true,
      accept: EXTENSOES.map((e) => "." + e).join(","),
      id: "arquivo-comparar",
      onchange: (ev) => {
        const a = ev.target.files[0];
        if (a) concluir(() => S.compararCom(a, rotulos()));
        ev.target.value = "";
      },
    });
    const fundo = h(
      "div",
      { class: "modal", role: "dialog", "aria-label": "Comparar com outro arquivo" },
      h(
        "div",
        { class: "modal-cartao" },
        h("h2", { class: "serif" }, "Comparar com outro período"),
        h(
          "p",
          {},
          "Envie o arquivo do período anterior, como o mês passado. Ele precisa ter as mesmas colunas do arquivo atual. Eu mostro se a taxa subiu ou caiu e em quais grupos. O arquivo também fica só no seu navegador.",
        ),
        h(
          "div",
          { class: "campo-duplo" },
          h("div", { class: "campo" }, h("label", { for: "rot-atual" }, "Nome do arquivo atual"), campoAtual),
          h("div", { class: "campo" }, h("label", { for: "rot-ant" }, "Nome do outro arquivo"), campoAnt),
        ),
        h(
          "p",
          { class: "modal-dica" },
          "Os nomes são opcionais. Eles aparecem nos gráficos, como “Setembro” e “Outubro”.",
        ),
        entrada,
        erro,
        abas,
        h(
          "div",
          { class: "modal-acoes" },
          h("button", { class: "btn btn-fantasma", onclick: fechar }, "Cancelar"),
          h(
            "button",
            { class: "btn btn-primario", onclick: () => entrada.click() },
            icone("upload", 16),
            "Escolher o outro arquivo",
          ),
        ),
      ),
    );
    document.body.append(fundo);
    campoAnt.focus();
  }
  function barraComparar() {
    const c = S.comparacaoAtual();
    if (!c)
      return h(
        "div",
        { class: "comparar-barra" },
        h(
          "button",
          { class: "btn btn-pequeno", id: "btn-comparar", onclick: abrirComparar },
          icone("comparar", 15),
          "Comparar com outro arquivo",
        ),
      );
    return h(
      "div",
      { class: "comparar-barra ativo" },
      h(
        "span",
        { class: "chip-comp" },
        icone("comparar", 15),
        h("span", {}, h("b", {}, c.rotuloAtual), " × ", h("b", {}, c.rotulo), ` · ${c.nome}`),
      ),
      h("button", { class: "btn btn-pequeno", onclick: abrirComparar }, "Trocar"),
      h(
        "button",
        {
          class: "btn btn-pequeno btn-fantasma",
          id: "btn-remover-comparacao",
          onclick: () => {
            S.removerComparacao();
            aviso("Comparação removida");
            atualizarMesa();
          },
        },
        "Remover",
      ),
    );
  }
  async function confirmar() {
    const es = estado.escolha,
      fim = carregando("Preparando a análise…");
    try {
      estado.info = S.configurar({ alvo: es.alvo, positivo: es.positivo, regras: es.regras });
      estado.mensagens = [];
      estado.foco = -1;
      estado.plano = null;
      estado.planoForm = { contexto: "", periodo: null };
      estado.visao = "analise";
      render();
    } catch (e) {
      aviso(e.message, true);
    } finally {
      fim();
    }
  }

  // ------------------------------------------------------------ análise (conversa + mesa)
  function telaAnalise(p) {
    const caixa = h("textarea", {
      rows: "1",
      placeholder: "Pergunte algo sobre os seus dados",
      "aria-label": "Sua pergunta",
      id: "pergunta",
    });
    const botao = h(
      "button",
      { class: "enviar", "aria-label": "Enviar pergunta", onclick: () => disparar() },
      icone("enviar", 20),
    );
    function disparar() {
      const t = caixa.value.trim();
      if (!t || estado.pensando) return;
      caixa.value = "";
      caixa.style.height = "";
      perguntar(t);
    }
    caixa.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        disparar();
      }
    });
    caixa.addEventListener("input", () => {
      caixa.style.height = "auto";
      caixa.style.height = Math.min(140, caixa.scrollHeight) + "px";
    });
    p.append(
      h(
        "div",
        { class: "analise" },
        h(
          "section",
          { class: "conversa" },
          h("div", { class: "conversa-topo" }, h("h2", {}, "Conversa"), h("p", {}, "Pergunte em linguagem simples.")),
          h("div", { class: "feed", id: "feed", "aria-live": "polite" }),
          h("div", { class: "compor" }, h("div", { class: "compor-caixa" }, caixa, botao)),
        ),
        h("section", { class: "mesa", id: "mesa" }),
      ),
    );
    atualizarFeed();
    atualizarMesa();
  }
  function atualizarFeed() {
    const feed = document.getElementById("feed");
    if (!feed) return;
    feed.innerHTML = "";
    if (!estado.mensagens.length)
      feed.append(
        h(
          "div",
          { class: "msg msg-ia" },
          h(
            "p",
            {},
            "Olá! Escolha uma análise pronta ao lado ou escreva sua pergunta. Eu calculo tudo com os seus dados e explico o que encontrei.",
          ),
        ),
      );
    estado.mensagens.forEach((m, i) => {
      if (m.papel === "user") feed.append(h("div", { class: "msg msg-user" }, m.texto));
      else
        feed.append(
          h(
            "div",
            { class: "msg msg-ia" + (i === estado.foco ? " foco" : "") },
            renderTexto(m.texto),
            m.resultados.length
              ? h(
                  "button",
                  {
                    class: "ver",
                    onclick: () => {
                      estado.foco = i;
                      atualizarFeed();
                      atualizarMesa();
                    },
                  },
                  `Ver ${m.resultados.length} ${m.resultados.length === 1 ? "gráfico" : "gráficos"}`,
                )
              : null,
          ),
        );
    });
    if (estado.pensando)
      feed.append(
        h(
          "div",
          { class: "msg msg-ia" },
          h("span", { class: "pensando", "aria-label": "Analisando" }, h("i"), h("i"), h("i")),
        ),
      );
    feed.scrollTop = feed.scrollHeight;
  }
  function atualizarMesa() {
    const mesa = document.getElementById("mesa");
    if (!mesa) return;
    mesa.innerHTML = "";
    const info = estado.info;
    mesa.append(kpisEl(info.kpis, info.tem_alvo));
    if (info.tem_alvo) mesa.append(barraComparar());
    if (info.notas.length)
      mesa.append(h("p", { class: "notas" }, "Tratamento aplicado: " + info.notas.join("; ") + "."));
    const msg = estado.mensagens[estado.foco];
    if (!msg || !msg.resultados.length) {
      mesa.append(
        h(
          "h2",
          { class: "titulo-vazio" },
          estado.mensagens.length ? "Sem gráficos nesta resposta" : "Por onde quer começar?",
        ),
        h(
          "p",
          { class: "sub-vazio" },
          "Escolha uma análise pronta ou escreva sua pergunta na conversa. Cada resultado pode virar um gráfico do seu painel.",
        ),
        h(
          "div",
          { class: "sugestoes" },
          info.sugestoes.map((s) =>
            h(
              "button",
              {
                class: "sugestao",
                onclick: () =>
                  s.acao === "plano"
                    ? irParaPlano()
                    : s.acao === "comparar"
                      ? abrirComparar()
                      : perguntar(s.pergunta || s.titulo, s.rapida),
              },
              h("b", {}, s.titulo),
              h("span", {}, s.texto),
            ),
          ),
        ),
      );
      return;
    }
    mesa.append(h("div", { class: "resultados" }, msg.resultados.map(cartaoMesa)));
    desenharTodos(mesa);
  }
  async function perguntar(texto, rapida) {
    if (estado.pensando) return;
    estado.mensagens.push({ papel: "user", texto, resultados: [] });
    estado.pensando = true;
    atualizarFeed();
    try {
      const r = await S.perguntar(texto, rapida);
      const resultados = r.resultados.map((x) => Object.assign(x, { tipo: x.tipo_padrao }));
      estado.mensagens.push({ papel: "ia", texto: r.texto, resultados });
      if (resultados.length) estado.foco = estado.mensagens.length - 1;
    } catch (e) {
      if (e.name === "ErroChave") {
        estado.mensagens.push({
          papel: "ia",
          texto: IA.modoServidor()
            ? `${e.message} Informe a senha da equipe e pergunte de novo. As análises prontas funcionam sem ela.`
            : "Para conversar comigo preciso da sua chave do Gemini. Informe a chave e pergunte de novo. As análises prontas funcionam sem ela.",
          resultados: [],
        });
        setTimeout(abrirChave, 150);
      } else estado.mensagens.push({ papel: "ia", texto: e.message, resultados: [] });
    } finally {
      estado.pensando = false;
      atualizarFeed();
      atualizarMesa();
    }
  }
  function chipsTipo(item, graf, aoMudar) {
    const caixa = h("div", { class: "tipos", role: "group", "aria-label": "Tipo de gráfico" });
    const pintar = () => {
      caixa.innerHTML = "";
      item.tipos.forEach((t) =>
        caixa.append(
          h(
            "button",
            {
              "aria-pressed": String(item.tipo === t),
              onclick: () => {
                item.tipo = t;
                pintar();
                if (graf) G.desenhar(graf, item);
                if (aoMudar) aoMudar();
              },
            },
            G.TIPOS[t],
          ),
        ),
      );
    };
    pintar();
    return caixa;
  }
  function noPainel(item) {
    return estado.painel.itens.some((x) => x.id === item.id && x.tipo === item.tipo);
  }
  function cartaoMesa(item) {
    const { el, graf } = cartaoBase(item);
    const botao = h("button", { class: "btn btn-pequeno" });
    const pintarBotao = () => {
      botao.className = "btn btn-pequeno" + (noPainel(item) ? "" : " btn-ouro");
      botao.replaceChildren(
        icone(noPainel(item) ? "ok" : "mais", 15),
        noPainel(item) ? "Está no painel" : "Adicionar ao painel",
      );
    };
    botao.addEventListener("click", () => {
      if (noPainel(item)) return aviso("Este gráfico já está no painel.");
      adicionar(item);
      pintarBotao();
    });
    pintarBotao();
    el.append(h("div", { class: "cartao-pe" }, chipsTipo(item, graf, pintarBotao), botao));
    return el;
  }
  function adicionar(item) {
    const copia = JSON.parse(JSON.stringify(item));
    copia.legenda = item.destaque;
    copia.largura =
      copia.tipo === "rosca" || (copia.tipo === "barras_h" && copia.tabela.categoria.length <= 6) ? "meia" : "inteira";
    estado.painel.itens.push(copia);
    if (estado.info) estado.painel.kpis = estado.info.kpis;
    salvarPainel();
    aviso("Adicionado ao painel");
    const selo = document.querySelector(".selo");
    if (selo) selo.textContent = estado.painel.itens.length;
    else render_selo();
  }
  function render_selo() {
    const b = document.querySelector('.nav button[data-nav="painel"]');
    if (b) b.append(h("span", { class: "selo" }, estado.painel.itens.length));
  }

  // ------------------------------------------------------------ plano de ação
  const PERIODOS = [
    [1, "1 mês"],
    [3, "3 meses"],
    [6, "6 meses"],
    [12, "12 meses"],
    [24, "2 anos"],
    [36, "3 anos"],
  ];
  function irParaPlano() {
    estado.visao = "plano";
    render();
  }
  function periodoPadrao() {
    const m = estado.info && estado.info.periodo_meses;
    if (!m) return "";
    return String(PERIODOS.reduce((a, b) => (Math.abs(b[0] - m) < Math.abs(a[0] - m) ? b : a))[0]);
  }
  async function montarPlano() {
    const f = estado.planoForm,
      fim = carregando("Montando o plano…");
    try {
      estado.plano = await S.gerarPlano({
        contexto: f.contexto,
        periodoMeses: f.periodo === null ? periodoPadrao() : f.periodo,
      });
    } catch (e) {
      aviso(e.message, true);
    } finally {
      fim();
    }
    render();
  }
  function baixarPlano() {
    const html = PL.documentoHtml(estado.plano, { arquivo: estado.arquivo ? estado.arquivo.nome : "", data: hoje() });
    const a = h("a", {
      href: URL.createObjectURL(new Blob([html], { type: "text/html" })),
      download: "plano_de_acao.html",
    });
    document.body.append(a);
    a.click();
    a.remove();
    aviso("Plano baixado. Abra o arquivo e use “Imprimir ou salvar em PDF”.");
  }
  function planoParaPainel() {
    const it = {
      id: "plano",
      ferramenta: "plano",
      tipo: "plano",
      tipos: [],
      titulo: "O que fazer e quando ver resultado",
      largura: "inteira",
      plano: JSON.parse(JSON.stringify(estado.plano)),
    };
    const k = estado.painel.itens.findIndex((x) => x.ferramenta === "plano");
    if (k >= 0) estado.painel.itens[k] = it;
    else estado.painel.itens.push(it);
    if (estado.info) estado.painel.kpis = estado.info.kpis;
    salvarPainel();
    aviso(k >= 0 ? "Plano atualizado no painel" : "Plano adicionado ao painel");
    render();
  }
  function telaPlano(p) {
    const info = estado.info;
    if (!info || !info.tem_alvo) {
      p.append(
        h(
          "div",
          { class: "centro" },
          h(
            "div",
            { class: "passo" },
            h("h2", {}, "Falta saber o que investigar"),
            h(
              "p",
              {},
              "O plano de ação parte de algo que você quer reduzir ou aumentar, como cancelamentos. Escolha isso em “Ajustar”.",
            ),
            h(
              "div",
              {},
              h(
                "button",
                {
                  class: "btn btn-primario",
                  onclick: () => {
                    estado.visao = estado.preparo ? "preparar" : "inicio";
                    render();
                  },
                },
                "Ajustar",
              ),
            ),
          ),
        ),
      );
      return;
    }
    const f = estado.planoForm,
      pl = estado.plano;
    const contexto = h("textarea", {
      id: "plano-contexto",
      rows: "3",
      placeholder:
        "Opcional. Ex.: Somos uma operadora de internet. O time de retenção tem 5 pessoas e já oferece desconto por telefone.",
    });
    contexto.value = f.contexto;
    contexto.addEventListener("input", () => {
      f.contexto = contexto.value;
    });
    const per = f.periodo === null ? periodoPadrao() : f.periodo;
    const periodo = h(
      "select",
      {
        id: "plano-periodo",
        onchange: (ev) => {
          f.periodo = ev.target.value;
        },
      },
      h("option", { value: "" }, "Não sei"),
      PERIODOS.map(([v, r]) => h("option", { value: String(v), selected: String(v) === per }, r)),
    );
    const form = h(
      "div",
      { class: "plano-form" },
      h(
        "div",
        { class: "campo" },
        h("label", { for: "plano-contexto" }, "Conte um pouco sobre o seu negócio"),
        contexto,
        h("small", {}, "Isso ajuda a adaptar as ações. Não coloque dados pessoais de clientes."),
      ),
      h(
        "div",
        { class: "campo" },
        h("label", { for: "plano-periodo" }, "Os dados cobrem quanto tempo?"),
        periodo,
        h("small", {}, "Com isso calculo em quantas semanas um teste já mostra resultado."),
      ),
      h(
        "div",
        {},
        h(
          "button",
          { class: "btn btn-primario", onclick: montarPlano },
          icone("plano", 16),
          pl ? "Refazer o plano" : "Montar o plano",
        ),
      ),
    );
    const cab = h(
      "div",
      {},
      h("span", { class: "plano-kicker" }, "Plano de ação"),
      h("h1", {}, "O que fazer e quando ver resultado"),
      h(
        "p",
        { class: "sub" },
        `Eu calculo onde estão as maiores oportunidades para reduzir ${info.rotulo_evento}, e a IA transforma isso em ações, prazos e próximos passos. Quem decide é você.`,
      ),
    );
    const pagina = h("div", { class: "plano-pagina" }, cab);
    if (pl) {
      if (pl.motivo_sem_ia)
        pagina.append(
          h(
            "div",
            { class: "plano-aviso" },
            h(
              "span",
              {},
              pl.motivo_sem_ia === "sem_chave"
                ? "Mostrei o plano básico porque a IA não está disponível. Com ela eu escrevo as ações, os prazos e os próximos passos em detalhe."
                : pl.motivo_sem_ia,
            ),
            pl.motivo_sem_ia === "sem_chave"
              ? h(
                  "button",
                  { class: "btn btn-pequeno", onclick: abrirChave },
                  icone("chave", 15),
                  IA.modoServidor() ? "Informar a senha" : "Informar a chave",
                )
              : h("button", { class: "btn btn-pequeno", onclick: montarPlano }, "Tentar de novo"),
          ),
        );
      const noPainelJa = estado.painel.itens.some((x) => x.ferramenta === "plano");
      pagina.append(
        h(
          "div",
          { class: "painel-acoes" },
          h("button", { class: "btn btn-primario", onclick: baixarPlano }, icone("baixar", 16), "Baixar plano"),
          h(
            "button",
            { class: "btn btn-ouro", onclick: planoParaPainel },
            icone(noPainelJa ? "ok" : "mais", 16),
            noPainelJa ? "Atualizar no painel" : "Adicionar ao painel",
          ),
        ),
        h("section", { class: "cartao inteira cartao-plano" }, elPlano(pl, {})),
        h(
          "details",
          { class: "vazios" },
          h("summary", {}, "Refazer com outras informações"),
          h("div", { class: "vazios-lista" }, form),
        ),
      );
    } else pagina.append(form);
    p.append(pagina);
  }

  // ------------------------------------------------------------ painel
  function semFormatacao(e) {
    e.addEventListener("paste", (ev) => {
      ev.preventDefault();
      document.execCommand("insertText", false, (ev.clipboardData || window.clipboardData).getData("text/plain"));
    });
  }
  function editavel(e, ativo, aoSalvar) {
    if (!ativo) return;
    e.setAttribute("contenteditable", "true");
    e.setAttribute("spellcheck", "true");
    semFormatacao(e);
    e.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        e.blur();
      }
    });
    e.addEventListener("blur", () => aoSalvar(e.textContent.trim()));
  }
  function cartaoPainel(item, i) {
    const ed = estado.edicao,
      itens = estado.painel.itens;
    const ehPlano = item.ferramenta === "plano";
    const { el, graf, titulo, sub } = ehPlano
      ? cartaoPlano(item)
      : cartaoBase(item, { editavel: ed, classeSub: "cartao-legenda", subtitulo: item.legenda });
    el.dataset.i = String(i);
    editavel(titulo, ed, (t) => {
      if (t) item.titulo = t;
      salvarPainel();
    });
    if (!ehPlano) {
      editavel(sub, ed, (t) => {
        item.legenda = t;
        salvarPainel();
      });
      if (!ed && !item.legenda) sub.remove();
    }
    const mover = (d) => {
      const j = i + d;
      if (j < 0 || j >= itens.length) return;
      [itens[i], itens[j]] = [itens[j], itens[i]];
      salvarPainel();
      render();
      const a = document.querySelector(`.cartao[data-i="${j}"] .alca`);
      if (a) a.focus();
    };
    if (ed) {
      const alca = h(
        "button",
        {
          class: "alca",
          title: "Segure e arraste para mudar de lugar",
          "aria-label": `Mudar a posição de “${item.titulo}”. Segure e arraste, ou use as setas do teclado.`,
        },
        icone("alca", 18),
        h("span", {}, "Arraste para mudar de lugar"),
      );
      alca.addEventListener("pointerdown", (ev) => iniciarArrasto(ev, el, alca));
      alca.addEventListener("keydown", (ev) => {
        const d = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[ev.key];
        if (d) {
          ev.preventDefault();
          mover(d);
        }
      });
      el.prepend(alca);
    }
    el.append(
      h(
        "div",
        { class: "edicao-barra" },
        ehPlano ? h("span") : chipsTipo(item, graf, salvarPainel),
        h(
          "div",
          { class: "tipos" },
          ehPlano
            ? null
            : h(
                "button",
                {
                  class: "btn btn-pequeno btn-fantasma",
                  onclick: () => {
                    item.largura = item.largura === "meia" ? "inteira" : "meia";
                    salvarPainel();
                    render();
                  },
                },
                icone("largura", 15),
                item.largura === "meia" ? "Alargar" : "Estreitar",
              ),
          h(
            "button",
            {
              class: "btn btn-pequeno btn-fantasma",
              "aria-label": "Mover para antes",
              disabled: i === 0,
              onclick: () => mover(-1),
            },
            icone("esq", 15),
          ),
          h(
            "button",
            {
              class: "btn btn-pequeno btn-fantasma",
              "aria-label": "Mover para depois",
              disabled: i === itens.length - 1,
              onclick: () => mover(1),
            },
            icone("dir", 15),
          ),
          h(
            "button",
            {
              class: "btn btn-pequeno btn-fantasma",
              onclick: () => {
                itens.splice(i, 1);
                salvarPainel();
                render();
              },
            },
            icone("lixo", 15),
            "Remover",
          ),
        ),
      ),
    );
    return el;
  }

  // Arrastar e soltar (mouse, caneta e toque). O cartão vai mudando de lugar na hora, para a pessoa ver como vai ficar.
  function animarMudanca(grade, mudar) {
    const antes = new Map([...grade.children].map((c) => [c, c.getBoundingClientRect()]));
    mudar();
    for (const c of grade.children) {
      const a = antes.get(c),
        d = c.getBoundingClientRect();
      if (!a || c.classList.contains("arrastando")) continue;
      const dx = a.left - d.left,
        dy = a.top - d.top;
      if (!dx && !dy) continue;
      c.style.transition = "none";
      c.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          c.style.transition = "transform .22s cubic-bezier(.2,.8,.2,1)";
          c.style.transform = "";
        }),
      );
      setTimeout(() => {
        c.style.transition = "";
      }, 320);
    }
  }
  function iniciarArrasto(ev, cartao, alca) {
    if (ev.button > 0) return;
    const grade = cartao.parentElement;
    if (!grade) return;
    ev.preventDefault();
    // Os cartões não saem do lugar no HTML: só a propriedade "order" muda. Assim a alça continua viva até soltar.
    const lista = [...grade.children],
      original = lista.slice();
    const colocar = () =>
      lista.forEach((c, k) => {
        c.style.order = String(k);
      });
    const fantasma = h(
      "div",
      { class: "fantasma" },
      icone("alca", 16),
      h("span", {}, cartao.querySelector(".cartao-titulo").textContent),
    );
    document.body.append(fantasma);
    cartao.classList.add("arrastando");
    grade.classList.add("arrastando-grade");
    document.body.classList.add("arrastando-corpo");
    try {
      alca.setPointerCapture(ev.pointerId);
    } catch (e) {
      /* sem captura */
    }
    let x = ev.clientX,
      y = ev.clientY,
      ultimo = { x, y },
      rolando = 0,
      fim = false;
    const posicionar = () => {
      fantasma.style.transform = `translate(${x + 14}px, ${y + 14}px)`;
    };
    posicionar();
    colocar();
    function alvoSob() {
      fantasma.style.visibility = "hidden";
      const e = document.elementFromPoint(x, y);
      fantasma.style.visibility = "";
      const c = e && e.closest ? e.closest(".cartao") : null;
      return c && c !== cartao && c.parentElement === grade ? c : null;
    }
    function ajustar() {
      if (Math.hypot(x - ultimo.x, y - ultimo.y) < 6) return;
      const alvo = alvoSob();
      if (!alvo) return;
      const r = alvo.getBoundingClientRect(),
        meia = r.width < grade.clientWidth * 0.75;
      const de = lista.indexOf(cartao),
        para = lista.indexOf(alvo),
        depois = para > de;
      const passou = depois
        ? y > r.top + r.height * 0.5 || (meia && x > r.left + r.width * 0.5)
        : y < r.top + r.height * 0.5 || (meia && x < r.left + r.width * 0.5);
      if (!passou) return;
      animarMudanca(grade, () => {
        lista.splice(de, 1);
        lista.splice(lista.indexOf(alvo) + (depois ? 1 : 0), 0, cartao);
        colocar();
      });
      ultimo = { x, y };
    }
    function rolar() {
      if (fim) return;
      const margem = 90,
        v =
          y < margem
            ? -Math.ceil((margem - y) / 5)
            : y > innerHeight - margem
              ? Math.ceil((y - (innerHeight - margem)) / 5)
              : 0;
      if (v) {
        window.scrollBy(0, v);
        ajustar();
      }
      rolando = requestAnimationFrame(rolar);
    }
    rolando = requestAnimationFrame(rolar);
    function mover(e) {
      if (e.pointerId !== ev.pointerId) return;
      x = e.clientX;
      y = e.clientY;
      posicionar();
      ajustar();
    }
    function terminar(cancelar) {
      if (fim) return;
      fim = true;
      cancelAnimationFrame(rolando);
      document.removeEventListener("pointermove", mover);
      document.removeEventListener("pointerup", soltou);
      document.removeEventListener("pointercancel", cancelou);
      document.removeEventListener("keydown", tecla);
      fantasma.remove();
      cartao.classList.remove("arrastando");
      grade.classList.remove("arrastando-grade");
      document.body.classList.remove("arrastando-corpo");
      original.forEach((c) => {
        c.style.order = "";
      });
      if (cancelar) return;
      const ordem = lista.map((c) => Number(c.dataset.i)),
        itens = estado.painel.itens;
      if (ordem.every((v, k) => v === k)) return;
      estado.painel.itens = ordem.map((k) => itens[k]);
      salvarPainel();
      render();
      const a = document.querySelector(`.cartao[data-i="${ordem.indexOf(Number(cartao.dataset.i))}"] .alca`);
      if (a) a.focus({ preventScroll: true });
      aviso("Nova ordem salva");
    }
    const soltou = (e) => {
        if (e.pointerId === ev.pointerId) terminar(false);
      },
      cancelou = (e) => {
        if (e.pointerId === ev.pointerId) terminar(true);
      };
    function tecla(e) {
      if (e.key === "Escape") terminar(true);
    }
    document.addEventListener("pointermove", mover);
    document.addEventListener("pointerup", soltou);
    document.addEventListener("pointercancel", cancelou);
    document.addEventListener("keydown", tecla);
  }

  function telaPainel(p) {
    const pn = estado.painel,
      ed = estado.edicao;
    const titulo = h("h1", { class: "painel-titulo" + (ed ? " editavel" : "") }, pn.titulo);
    editavel(titulo, ed, (t) => {
      if (t) pn.titulo = t;
      salvarPainel();
    });
    const tem = pn.itens.length > 0;
    const topo = h(
      "div",
      { class: "painel-topo" },
      h("div", {}, titulo, h("p", { class: "painel-data" }, hoje())),
      tem
        ? h(
            "div",
            { class: "painel-acoes" },
            h(
              "button",
              {
                class: "btn",
                onclick: () => {
                  estado.edicao = !estado.edicao;
                  render();
                },
              },
              icone(ed ? "ok" : "editar", 16),
              ed ? "Concluir edição" : "Editar",
            ),
            h("button", { class: "btn", onclick: baixarHTML }, icone("baixar", 16), "Baixar HTML"),
            h("button", { class: "btn btn-ouro", onclick: () => apresentar(0) }, icone("play", 16), "Apresentar"),
          )
        : null,
    );
    const corpo = tem
      ? [kpisEl(pn.kpis, true), h("div", { class: "grade" }, pn.itens.map(cartaoPainel))]
      : [
          h(
            "div",
            { class: "vazio-painel" },
            h("b", {}, "Seu painel está vazio"),
            h("span", {}, "Faça uma análise e use “Adicionar ao painel” nos gráficos que quiser mostrar na reunião."),
            h(
              "button",
              {
                class: "btn btn-primario",
                onclick: () => {
                  estado.visao = estado.info ? "analise" : "inicio";
                  render();
                },
              },
              "Ir para a análise",
            ),
          ),
        ];
    p.append(h("div", { class: "painel" + (ed ? " editando" : "") }, topo, ...corpo));
  }

  // ------------------------------------------------------------ apresentar em tela cheia
  const apresentar = (inicio) => Comum.apresentar(estado.painel.itens, estado.painel.titulo, inicio);

  // ------------------------------------------------------------ exportar o painel em um arquivo HTML
  async function baixarHTML() {
    const fim = carregando("Montando o arquivo…");
    try {
      const fonte = (id) => document.getElementById(id).textContent.replace(/<\/script/gi, "<\\/script");
      const css = document.getElementById("css-principal").textContent,
        graficos = fonte("js-graficos"),
        comum = fonte("js-comum");
      const pn = estado.painel;
      const dados = JSON.stringify({ titulo: pn.titulo, kpis: pn.kpis, itens: pn.itens, data: hoje() }).replace(
        /</g,
        "\\u003c",
      );
      const boot = `(function(){var D=${dados},C=window.Comum,h=C.h,r=document.getElementById("raiz");
        var ap=function(){C.apresentar(D.itens,D.titulo,0);};
        r.append(h("div",{class:"painel-topo"},h("div",{},h("h1",{class:"painel-titulo"},D.titulo),h("p",{class:"painel-data"},D.data)),
          h("div",{class:"painel-acoes"},h("button",{class:"btn btn-ouro",id:"btn-apresentar",onclick:ap},C.icone("play",16),"Apresentar"))));
        document.addEventListener("keydown",function(e){if((e.key==="p"||e.key==="P")&&!document.querySelector(".apresentar")&&!e.ctrlKey&&!e.metaKey)ap();});
        r.append(C.kpisEl(D.kpis,true));var g=h("div",{class:"grade"});
        D.itens.forEach(function(it){if(it.ferramenta==="plano"){g.append(C.cartaoPlano(it).el);return;}var c=C.cartaoBase(it,{classeSub:"cartao-legenda",subtitulo:it.legenda});if(!it.legenda)c.sub.remove();g.append(c.el);});
        r.append(g);C.desenharTodos(r);if(location.hash==='#apresentar')ap();})();`;
      const pagina = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(pn.titulo)}</title><link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet"><style>${css}.painel{padding-top:48px}</style></head><body><main class="painel" id="raiz"></main><script>${graficos}<\/script><script>${comum}<\/script><script>${boot}<\/script></body></html>`;
      const a = h("a", {
        href: URL.createObjectURL(new Blob([pagina], { type: "text/html" })),
        download: "painel.html",
      });
      document.body.append(a);
      a.click();
      a.remove();
      aviso("Arquivo baixado");
    } catch (e) {
      aviso("Não consegui montar o arquivo.", true);
    } finally {
      fim();
    }
  }

  // ------------------------------------------------------------ início
  function iniciar() {
    render();
    // Se o Elucid estiver publicado com a função da Netlify, ele usa o servidor e pede só a senha da equipe.
    IA.detectarServidor().then((ok) => {
      if (ok && !document.querySelector(".modal, .carregando")) render();
    });
  }
  iniciar();
})();

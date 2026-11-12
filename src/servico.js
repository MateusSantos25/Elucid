/* Elucid: sessão local. Tudo acontece no navegador: o arquivo nunca é enviado a lugar nenhum. */
(function () {
  const A = (globalThis.Elucid = globalThis.Elucid || {});
  const U = A.util || require("./util.js"),
    D = A.dados || require("./dados.js"),
    L = A.limpeza || require("./limpeza.js");
  const AN = A.analises || require("./analises.js"),
    AS = A.assistente || require("./assistente.js"),
    PL = A.plano || require("./plano.js"),
    CP = A.comparacao || require("./comparacao.js");
  const LIMITE_MB = 150;
  let sessao = null;
  const limpar = () => {
    sessao = null;
  };

  async function abrirArquivo(arquivo) {
    if (arquivo.size > LIMITE_MB * 1048576)
      throw new Error(`O arquivo passa de ${LIMITE_MB} MB. Envie uma versão menor.`);
    if (!arquivo.size) throw new Error("O arquivo está vazio.");
    const arq = await D.abrir(await arquivo.arrayBuffer(), arquivo.name);
    if (arq.abas.length > 1) {
      sessao = { nome: arquivo.name, arq };
      return { precisa_aba: true, abas: arq.abas, nome: arquivo.name };
    }
    return descrever(arquivo.name, await lerSeguro(arq, arq.abas[0]));
  }
  async function escolherAba(aba) {
    if (!sessao || !sessao.arq) throw new Error("Envie o arquivo novamente.");
    return descrever(sessao.nome, await lerSeguro(sessao.arq, aba));
  }
  async function lerSeguro(arq, aba) {
    try {
      return await arq.ler(aba);
    } catch (e) {
      throw new Error(`Não consegui abrir este arquivo. ${e.message}`);
    }
  }
  function descrever(nome, df) {
    sessao = { nome, df, ctx: null, historico: [] };
    const cand = AN.candidatosAlvo(df),
      alvo = cand.length && AN.PADRAO_ALVO.test(cand[0]) ? cand[0] : null,
      sug = L.recomendar(df, alvo);
    return {
      nome,
      linhas: df.n,
      colunas: df.nomes.length,
      alvo_sugerido: alvo,
      candidatos: cand.map((c) => ({
        coluna: c,
        sugerido: AN.sugerirPositivo(df.col[c]),
        valores: AN.ordenarValores([...AN.valoresUnicos(df.col[c])]),
      })),
      vazios: L.diagnostico(df).map((d) => ({
        coluna: d.coluna,
        faltantes: d.faltantes,
        pct: Math.round(d.pct * 10) / 10,
        tipo: d.tipo,
        opcoes: L.estrategiasPara(d.tipo).map((e) => ({ id: e, rotulo: L.ESTRATEGIAS[e] })),
        sugerida: sug[d.coluna],
      })),
    };
  }
  function sugestoes(ctx) {
    if (ctx.temAlvo)
      return [
        { titulo: "Visão geral", texto: `Quantos registros têm ${ctx.rotuloEvento}`, rapida: ["panorama_alvo"] },
        { titulo: "O que mais pesa", texto: `Fatores que mais diferenciam ${ctx.alvo}`, rapida: ["ranking_fatores"] },
        {
          titulo: "Grupos de maior risco",
          texto: "Onde a taxa é muito acima da média",
          rapida: ["segmentos_de_risco"],
        },
        { titulo: "Plano de ação", texto: "O que fazer primeiro e em quanto tempo ver resultado", acao: "plano" },
        { titulo: "Comparar com outro período", texto: "Veja o que mudou em relação ao mês passado", acao: "comparar" },
      ];
    const p = ctx.colunas()[0];
    return [
      {
        titulo: `Distribuição de ${p}`,
        texto: "Como os registros se distribuem",
        pergunta: `Mostre a distribuição de ${p}`,
      },
      {
        titulo: "Quantos por grupo",
        texto: "Contagem de registros por categoria",
        pergunta: "Quantos registros existem por grupo?",
      },
    ];
  }
  /** Quantos meses os dados cobrem, olhando a primeira coluna de data (ou null se não houver). */
  function periodoDosDados(ctx) {
    for (const nome of ctx.colunas()) {
      const c = ctx.df.col[nome];
      if (c.tipo !== "data") continue;
      let mn = Infinity,
        mx = -Infinity;
      for (const x of c.v)
        if (!Number.isNaN(x)) {
          if (x < mn) mn = x;
          if (x > mx) mx = x;
        }
      const meses = (mx - mn) / (30.4375 * 86400000);
      if (Number.isFinite(meses) && meses >= 1) return Math.round(meses);
    }
    return null;
  }
  function configurar({ alvo, positivo, regras }) {
    if (!sessao || !sessao.df) throw new Error("Envie o arquivo novamente.");
    const df = sessao.df;
    if (alvo) {
      if (!df.col[alvo]) throw new Error(`A coluna “${alvo}” não existe.`);
      if (!AN.valoresUnicos(df.col[alvo]).has(positivo)) throw new Error("Esse valor não existe na coluna escolhida.");
    } else {
      alvo = null;
      positivo = null;
    }
    const { df: limpo, notas } = L.aplicar(df, regras || {});
    const ctx = AN.construirContexto(limpo, alvo, positivo);
    if (!ctx.df.n) throw new Error("Depois do tratamento não sobrou nenhuma linha. Revise as opções de dados vazios.");
    sessao.ctx = ctx;
    sessao.historico = [];
    sessao.regras = Object.assign({}, regras || {});
    if (sessao.anteriorBruto) {
      // o arquivo do outro período continua valendo depois de “Ajustar”
      const b = sessao.anteriorBruto;
      try {
        const P = CP.prepararAnterior(ctx, b.df, sessao.regras);
        ctx.anterior = {
          ctx: P.ctx,
          nome: b.nome,
          linhas: b.df.n,
          rotulo: b.rotulo,
          rotuloAtual: b.rotuloAtual,
          avisos: P.avisos,
        };
      } catch (e) {
        sessao.anteriorBruto = null;
      }
    }
    const kpis = [["Registros analisados", U.fmtInt(ctx.df.n)]];
    if (ctx.temAlvo) kpis.push([`Taxa de ${ctx.rotuloEvento}`, U.fmtPct(ctx.taxaGeral)]);
    kpis.push(["Colunas na análise", String(ctx.colunas().length)]);
    return {
      kpis,
      notas,
      periodo_meses: periodoDosDados(ctx),
      tem_alvo: ctx.temAlvo,
      alvo: ctx.alvo,
      rotulo_evento: ctx.temAlvo ? ctx.rotuloEvento : null,
      sugestoes: sugestoes(ctx),
    };
  }
  async function perguntar(texto, rapida) {
    if (!sessao || !sessao.ctx) throw new Error("Confirme o que investigar antes de perguntar.");
    let resp;
    if (rapida && rapida.length) {
      const ruim = rapida.filter((n) => !AN.FERRAMENTAS[n]);
      if (ruim.length) throw new Error("Análise desconhecida.");
      resp = AS.analiseRapida(sessao.ctx, rapida);
    } else {
      texto = String(texto || "")
        .trim()
        .slice(0, 2000);
      if (!texto) throw new Error("Escreva uma pergunta.");
      try {
        resp = await AS.responder(sessao.ctx, sessao.historico, texto);
      } catch (e) {
        if (e instanceof AS.ErroChave) throw e;
        if (e instanceof AS.ErroGemini) resp = { texto: e.message, resultados: [] };
        else throw e;
      }
    }
    sessao.historico.push(
      { role: "user", content: texto || "(análise rápida)" },
      { role: "assistant", content: resp.texto },
    );
    sessao.historico = sessao.historico.slice(-40);
    return resp;
  }

  // ---- comparação com o arquivo de outro período
  const rotulosDe = (r) => ({
    rotuloAtual:
      String((r && r.rotuloAtual) || "")
        .trim()
        .slice(0, 24) || "Atual",
    rotulo:
      String((r && r.rotuloAnterior) || "")
        .trim()
        .slice(0, 24) || "Anterior",
  });
  async function compararCom(arquivo, rotulos) {
    if (!sessao || !sessao.ctx) throw new Error("Confirme o que investigar antes de comparar.");
    if (arquivo.size > LIMITE_MB * 1048576)
      throw new Error(`O arquivo passa de ${LIMITE_MB} MB. Envie uma versão menor.`);
    if (!arquivo.size) throw new Error("O arquivo está vazio.");
    const arq = await D.abrir(await arquivo.arrayBuffer(), arquivo.name);
    if (arq.abas.length > 1) {
      sessao.anteriorPendente = { nome: arquivo.name, arq };
      return { precisa_aba: true, abas: arq.abas };
    }
    return finalizarComparacao(arquivo.name, await lerSeguro(arq, arq.abas[0]), rotulos);
  }
  async function escolherAbaComparacao(aba, rotulos) {
    const p = sessao && sessao.anteriorPendente;
    if (!p) throw new Error("Escolha o arquivo novamente.");
    sessao.anteriorPendente = null;
    return finalizarComparacao(p.nome, await lerSeguro(p.arq, aba), rotulos);
  }
  async function finalizarComparacao(nome, df, rotulos) {
    const r = rotulosDe(rotulos);
    let P;
    try {
      P = CP.prepararAnterior(sessao.ctx, df, sessao.regras);
    } catch (e) {
      if (e instanceof AN.ErroAnalise) throw new Error(e.message);
      throw e;
    }
    sessao.ctx.anterior = {
      ctx: P.ctx,
      nome,
      linhas: df.n,
      rotulo: r.rotulo,
      rotuloAtual: r.rotuloAtual,
      avisos: P.avisos,
    };
    sessao.anteriorBruto = { nome, df, rotulo: r.rotulo, rotuloAtual: r.rotuloAtual };
    const c = CP.completa(sessao.ctx);
    let texto;
    try {
      texto =
        (await AS.explicar(
          `Compare ${r.rotuloAtual} com ${r.rotulo}: o que mudou na taxa de ${sessao.ctx.rotuloEvento} e onde?`,
          c.resultados,
        )) || "";
    } catch (e) {
      texto = "";
    }
    if (!texto)
      texto = c.resultados
        .map((x) => x.destaque)
        .filter(Boolean)
        .join("\n\n");
    if (c.semMudanca) texto += "\n\nNenhum grupo teve mudança grande o bastante para não ser variação normal.";
    if (c.avisos.length) texto += "\n\n" + c.avisos.join(" ");
    sessao.historico.push({ role: "user", content: `(comparação com ${nome})` }, { role: "assistant", content: texto });
    return { texto, resultados: c.resultados, nome };
  }
  const comparacaoAtual = () => {
    const a = sessao && sessao.ctx && sessao.ctx.anterior;
    return a ? { nome: a.nome, linhas: a.linhas, rotulo: a.rotulo, rotuloAtual: a.rotuloAtual } : null;
  };
  function removerComparacao() {
    if (sessao && sessao.ctx) delete sessao.ctx.anterior;
    if (sessao) {
      sessao.anteriorBruto = null;
      sessao.anteriorPendente = null;
    }
  }

  /** Clicou em colunas da tabela: compara cada uma com o que está sendo investigado (ou mostra a distribuição, se nada foi escolhido). */
  async function compararColunas(colunas) {
    if (!sessao || !sessao.ctx) throw new Error("Confirme o que investigar antes de comparar colunas.");
    const ctx = sessao.ctx,
      avisos = [];
    const sel = [...new Set((colunas || []).map(String))].filter((c) => ctx.df.col[c]);
    if (!sel.length) throw new Error("Clique em pelo menos uma coluna da tabela.");
    if (sel.length > 5) avisos.push("Comparei as 5 primeiras colunas que você clicou.");
    const plano = [],
      lista = sel.slice(0, 5);
    if (ctx.temAlvo) {
      if (lista.includes(ctx.alvo))
        avisos.push(`“${ctx.alvo}” é a coluna que você está investigando, então ela não entra na comparação.`);
      const comuns = lista.filter((c) => c !== ctx.alvo && ctx.df.col[c].tipo !== "data");
      if (comuns.length >= 2) plano.push({ nome: "ranking_fatores", parametros: { colunas: comuns, limite: 15 } });
      for (const c of lista) {
        if (c === ctx.alvo) continue;
        plano.push(
          ctx.df.col[c].tipo === "data"
            ? { nome: "evolucao_temporal", parametros: { coluna_data: c, metrica: "taxa_alvo", frequencia: "mes" } }
            : { nome: "taxa_por_coluna", parametros: { coluna: c } },
        );
      }
    } else {
      for (const c of lista)
        plano.push(
          ctx.df.col[c].tipo === "data"
            ? { nome: "evolucao_temporal", parametros: { coluna_data: c, metrica: "contagem", frequencia: "mes" } }
            : { nome: "distribuicao", parametros: { coluna: c } },
        );
    }
    const resultados = [];
    for (const p of plano) {
      try {
        resultados.push(AN.executar(ctx, p.nome, p.parametros));
      } catch (e) {
        if (e instanceof AN.ErroAnalise) avisos.push(e.message);
        else throw e;
      }
    }
    if (!resultados.length) throw new Error(avisos.join(" ") || "Não consegui comparar essas colunas.");
    const nomes = lista.filter((c) => c !== ctx.alvo).join(", ");
    let texto;
    try {
      texto =
        (await AS.explicar(
          ctx.temAlvo
            ? `Compare as colunas ${nomes} com a taxa de ${ctx.rotuloEvento}: qual pesa mais e onde está a diferença?`
            : `Descreva as colunas ${nomes}.`,
          resultados,
        )) || "";
    } catch (e) {
      texto = "";
    }
    if (!texto)
      texto = resultados
        .map((x) => x.destaque)
        .filter(Boolean)
        .join("\n\n");
    if (avisos.length) texto += "\n\n" + avisos.join(" ");
    sessao.historico.push(
      { role: "user", content: `(comparação das colunas ${nomes})` },
      { role: "assistant", content: texto },
    );
    return { texto, resultados, colunas: lista };
  }

  // ---- prévia do arquivo (as linhas ficam só no navegador; nada disso vai ao Gemini)
  const dataBr = (ms) => {
    const d = new Date(ms),
      p = (n) => String(n).padStart(2, "0");
    return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  };
  function celula(c, i) {
    if (D.ehNulo(c, i)) return null;
    const v = c.v[i];
    if (c.tipo === "data") return dataBr(v);
    if (c.tipo === "numero")
      return Number.isInteger(v) ? String(v) : U.fmtNum(v, Math.abs(v) < 1 ? 4 : 2).replace(/,?0+$/, "");
    const t = String(v);
    return t.length > 70 ? t.slice(0, 69) + "…" : t;
  }
  /** Resumo das colunas e as primeiras linhas do arquivo como foi lido (antes de qualquer tratamento). */
  function previa(maxLinhas = 8) {
    if (!sessao || !sessao.df) throw new Error("Envie o arquivo novamente.");
    const df = sessao.df;
    if (!sessao.resumo)
      sessao.resumo = df.nomes.map((nome) => {
        const c = df.col[nome];
        let vazios = 0;
        for (let i = 0; i < df.n; i++) if (D.ehNulo(c, i)) vazios++;
        const un = AN.valoresUnicos(c).size;
        let exemplo = "";
        for (let i = 0; i < df.n && !exemplo; i++) exemplo = celula(c, i) || "";
        return { nome, tipo: c.tipo, vazios, pct_vazios: df.n ? (vazios / df.n) * 100 : 0, distintos: un, exemplo };
      });
    const k = Math.max(1, Math.min(Number(maxLinhas) || 8, df.n, 1000));
    const linhas = [];
    for (let i = 0; i < k; i++) linhas.push(df.nomes.map((nome) => celula(df.col[nome], i)));
    return { nome: sessao.nome, total_linhas: df.n, mostrando: k, colunas: sessao.resumo, linhas };
  }

  async function gerarPlano({ contexto, periodoMeses, usarIa } = {}) {
    if (!sessao || !sessao.ctx) throw new Error("Confirme o que investigar antes de montar o plano.");
    const m = Number(periodoMeses);
    try {
      return await PL.gerar(sessao.ctx, {
        contexto,
        periodoMeses: m > 0 && m <= 600 ? Math.round(m) : null,
        usarIa: usarIa !== false,
      });
    } catch (e) {
      if (e instanceof AN.ErroAnalise) throw new Error(e.message);
      throw e;
    }
  }

  // ---- dados de exemplo (fictícios), gerados aqui mesmo
  function gerarExemplo(n = 4000) {
    let s = 42;
    const rnd = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const inteiro = (a, b) => a + Math.floor(rnd() * (b - a));
    const pesos = (p) => {
      let r = rnd() * p.reduce((x, y) => x + y, 0),
        i = 0;
      while (i < p.length - 1 && r >= p[i]) {
        r -= p[i];
        i++;
      }
      return i;
    };
    const normal = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
    const cab = [
      "CustomerID",
      "idade",
      "sexo",
      "tempo_como_cliente",
      "frequencia_uso",
      "ligacoes_callcenter",
      "dias_atraso",
      "assinatura",
      "duracao_contrato",
      "total_gasto",
      "meses_ultima_interacao",
      "cancelou",
    ];
    const linhas = [cab];
    for (let i = 1; i <= n; i++) {
      const lig = pesos([0.2, 0.2, 0.17, 0.14, 0.1, 0.07, 0.05, 0.03, 0.02, 0.02]),
        atraso = pesos(Array.from({ length: 31 }, (_, k) => (k < 21 ? 2 : 1))),
        contrato = ["Monthly", "Quarterly", "Annual"][pesos([0.3, 0.35, 0.35])];
      const ult = inteiro(1, 30);
      let cancela = rnd() < 0.12 + (ult > 20 ? 0.01 : 0);
      if (contrato === "Monthly" && rnd() < 0.97) cancela = true;
      if (lig > 4 || atraso > 20) cancela = true;
      const falta = (v, p) => (rnd() < p ? null : v);
      linhas.push([
        i,
        falta(inteiro(18, 70), 0.02),
        ["Male", "Female"][pesos([1, 1])],
        inteiro(1, 60),
        inteiro(1, 30),
        lig,
        atraso,
        falta(["Basic", "Standard", "Premium"][pesos([1, 1, 1])], 0.01),
        contrato,
        falta(Math.round((600 + 200 * normal()) * 100) / 100, 0.03),
        ult,
        cancela ? 1 : 0,
      ]);
    }
    return linhas;
  }
  async function abrirExemplo() {
    return descrever("cancelamentos_exemplo (fictício)", D.construirTabela(gerarExemplo()));
  }

  A.servico = {
    abrirArquivo,
    escolherAba,
    abrirExemplo,
    configurar,
    perguntar,
    gerarPlano,
    previa,
    compararColunas,
    compararCom,
    escolherAbaComparacao,
    comparacaoAtual,
    removerComparacao,
    limpar,
    gerarExemplo,
  };
  if (typeof module !== "undefined") module.exports = A.servico;
})();

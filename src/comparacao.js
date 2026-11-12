/* Elucid: comparação com um arquivo de outro período (por exemplo, o mês passado).
   Tudo é calculado aqui, no navegador. O Gemini só explica os números prontos, como nas outras análises. */
(function () {
  const A = (globalThis.Elucid = globalThis.Elucid || {});
  const U = A.util || require("./util.js"),
    D = A.dados || require("./dados.js"),
    L = A.limpeza || require("./limpeza.js");
  const AN = A.analises || require("./analises.js");
  const { rotulo, fmtNum, fmtInt, fmtPct } = U;
  const ErroAnalise = AN.ErroAnalise,
    MIN_GRUPO = 20,
    Z_RELEVANTE = 2;

  const norm = (s) => String(s).trim().toLowerCase();
  function acharNome(df, nome) {
    const k = norm(nome);
    return df.nomes.find((n) => n === nome) || df.nomes.find((n) => norm(n) === k) || null;
  }
  function casarPositivo(col, positivo) {
    const un = AN.valoresUnicos(col);
    if (un.has(positivo)) return positivo;
    for (const v of un) if (norm(v) === norm(positivo)) return v;
    const n = Number(positivo);
    if (!Number.isNaN(n)) for (const v of un) if (Number(v) === n) return v;
    return undefined;
  }
  /** Teste de duas proporções (z). Perto de 0 = diferença pequena; acima de 2 (ou abaixo de -2), difícil de ser acaso. */
  function zDuas(k1, n1, k2, n2) {
    if (!n1 || !n2) return 0;
    const p = (k1 + k2) / (n1 + n2),
      ep = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
    return ep ? (k1 / n1 - k2 / n2) / ep : 0;
  }

  /** Prepara o arquivo do período anterior no mesmo formato do atual: nomes das colunas, tratamento de vazios e evento. */
  function prepararAnterior(ctx, dfBruto, regrasEscolhidas) {
    if (!ctx.temAlvo) throw new ErroAnalise("Para comparar períodos, escolha primeiro o que investigar em “Ajustar”.");
    const alvoNome = acharNome(dfBruto, ctx.alvo);
    if (!alvoNome)
      throw new ErroAnalise(
        `O arquivo do outro período não tem a coluna “${ctx.alvo}”. Confira se é o mesmo tipo de arquivo.`,
      );
    // mesmos nomes de colunas do arquivo atual (ignora diferença de maiúsculas e espaços)
    const mapa = {};
    for (const n of ctx.df.nomes) {
      const a = acharNome(dfBruto, n);
      if (a) mapa[a] = n;
    }
    const nomes = dfBruto.nomes.map((n) => mapa[n] || n),
      col = {};
    dfBruto.nomes.forEach((n, i) => {
      col[nomes[i]] = dfBruto.col[n];
    });
    const df0 = { n: dfBruto.n, nomes, col };
    const regras = Object.assign(L.recomendar(df0, ctx.alvo), regrasEscolhidas || {});
    const { df, notas } = L.aplicar(df0, regras);
    const positivo = casarPositivo(df.col[ctx.alvo], ctx.positivo);
    const ctxP = AN.construirContexto(df, ctx.alvo, positivo === undefined ? Symbol("sem evento") : positivo);
    if (!ctxP.df.n) throw new ErroAnalise("O arquivo do outro período ficou sem linhas depois do tratamento.");
    const avisos = [];
    const soAtual = ctx.colunas().filter((c) => !ctxP.df.col[c]),
      soAntes = ctxP.df.nomes.filter((c) => !ctx.df.col[c] && !ctxP.ignoradas.includes(c));
    if (soAtual.length) avisos.push(`Colunas que só existem no arquivo atual: ${soAtual.join(", ")}.`);
    if (soAntes.length) avisos.push(`Colunas que só existem no outro período: ${soAntes.join(", ")}.`);
    const trocou = ctx.colunas().filter((c) => ctxP.df.col[c] && ctxP.df.col[c].tipo !== ctx.df.col[c].tipo);
    if (trocou.length)
      avisos.push(`Colunas com tipo diferente nos dois arquivos (ficaram de fora): ${trocou.join(", ")}.`);
    if (positivo === undefined)
      avisos.push(`O valor “${ctx.positivo}” não aparece em “${ctx.alvo}” no outro período; a taxa de lá é 0%.`);
    if (ctxP.taxaGeral === 0 && positivo !== undefined)
      avisos.push("Nenhum registro do outro período tem o evento investigado.");
    return { ctx: ctxP, notas, avisos };
  }

  // ------------------------------------------------------------ números
  const colunasComuns = (ctx, P) =>
    ctx
      .colunas()
      .filter((c) => P.df.col[c] && P.df.col[c].tipo === ctx.df.col[c].tipo && ctx.df.col[c].tipo !== "data");
  function combinar(cA, cP) {
    if (cA.tipo === "numero") {
      const v = new Float64Array(cA.v.length + cP.v.length);
      v.set(cA.v, 0);
      v.set(cP.v, cA.v.length);
      return { tipo: "numero", v };
    }
    return { tipo: "texto", v: cA.v.concat(cP.v) };
  }
  /** Taxa do evento em cada grupo, nos dois períodos, usando as mesmas faixas (calculadas com os dois arquivos juntos). */
  function porGrupo(ctx, P, coluna) {
    const nA = ctx.df.n,
      g = AN.grupos(combinar(ctx.df.col[coluna], P.df.col[coluna])),
      k = g.cats.length;
    const m = { nA: new Float64Array(k), kA: new Float64Array(k), nP: new Float64Array(k), kP: new Float64Array(k) };
    for (let i = 0; i < nA; i++) {
      const j = g.idx[i];
      if (j >= 0) {
        m.nA[j]++;
        m.kA[j] += ctx.y[i];
      }
    }
    for (let i = 0; i < P.df.n; i++) {
      const j = g.idx[nA + i];
      if (j >= 0) {
        m.nP[j]++;
        m.kP[j] += P.y[i];
      }
    }
    const r = [];
    for (let j = 0; j < k; j++) {
      if (m.nA[j] < MIN_GRUPO || m.nP[j] < MIN_GRUPO) continue;
      const pA = (m.kA[j] / m.nA[j]) * 100,
        pP = (m.kP[j] / m.nP[j]) * 100,
        delta = pA - pP;
      r.push({
        col: coluna,
        cat: g.cats[j],
        nA: m.nA[j],
        nP: m.nP[j],
        pA,
        pP,
        delta,
        z: zDuas(m.kA[j], m.nA[j], m.kP[j], m.nP[j]),
        extra: (delta / 100) * m.nA[j],
        ordenado: g.ordenado,
      });
    }
    return r;
  }
  function geral(ctx, P) {
    const nA = ctx.df.n,
      nP = P.df.n,
      kA = ctx.y.reduce((a, b) => a + b, 0),
      kP = P.y.reduce((a, b) => a + b, 0);
    const pA = (kA / nA) * 100,
      pP = (kP / nP) * 100,
      z = zDuas(kA, nA, kP, nP);
    return { nA, nP, kA, kP, pA, pP, delta: pA - pP, z, relevante: Math.abs(z) >= Z_RELEVANTE };
  }
  const rot = (x) => `${rotulo(x.col)}: ${x.cat}`;
  const sinal = (v, c = 1) => (v >= 0 ? "+" : "−") + fmtNum(Math.abs(v), c);
  const nomesRot = (ctx) => ({
    A: (ctx.anterior && ctx.anterior.rotuloAtual) || "Atual",
    P: (ctx.anterior && ctx.anterior.rotulo) || "Anterior",
  });
  function exigirAnterior(ctx) {
    if (!ctx.anterior)
      throw new ErroAnalise("Primeiro escolha o arquivo do outro período, em “Comparar com outro arquivo”.");
    return ctx.anterior.ctx;
  }

  // ------------------------------------------------------------ resultados (os mesmos objetos das outras análises)
  function resultadoGeral(ctx) {
    const P = exigirAnterior(ctx),
      r = nomesRot(ctx),
      g = geral(ctx, P),
      ev = ctx.rotuloEvento;
    const verbo = !g.relevante ? "ficou estável" : g.delta > 0 ? "subiu" : "caiu";
    const nota = g.relevante
      ? "Com esse volume de registros, a diferença é grande o bastante para não ser só acaso."
      : "A diferença é pequena para esse volume de registros e pode ser só variação normal.";
    const titulo = `A taxa de ${ev} ${verbo}: ${fmtPct(g.pP)} em ${r.P} e ${fmtPct(g.pA)} em ${r.A}`;
    const dest = `${r.P}: ${fmtPct(g.pP)} (${fmtInt(g.nP)} registros). ${r.A}: ${fmtPct(g.pA)} (${fmtInt(g.nA)} registros). Mudança de ${sinal(g.delta)} p.p. ${nota}`;
    const t = { categoria: [r.P, r.A], valor: [g.pP, g.pA], n: [g.nP, g.nA] };
    const res = AN.R("comparar_periodos", titulo, t, "%", "barras", false, dest, dest);
    res.estat = { valor: `${sinal(g.delta)} p.p.`, rotulo: `${r.A} contra ${r.P}`, delta: null };
    return res;
  }
  function mudancas(ctx, P) {
    const todas = colunasComuns(ctx, P).flatMap((c) => porGrupo(ctx, P, c));
    const pegar = (lista) => {
      const por = {};
      return lista.filter((x) => (por[x.col] = (por[x.col] || 0) + 1) <= 2).slice(0, 6);
    };
    return {
      todas,
      piora: pegar(todas.filter((x) => x.delta > 0 && x.z >= Z_RELEVANTE).sort((a, b) => b.extra - a.extra)),
      melhora: pegar(todas.filter((x) => x.delta < 0 && x.z <= -Z_RELEVANTE).sort((a, b) => a.extra - b.extra)),
    };
  }
  function resultadoMudancas(ctx, lista, piorou) {
    const r = nomesRot(ctx),
      ev = ctx.rotuloEvento;
    const t = { categoria: lista.map(rot), valor: lista.map((x) => Math.abs(x.delta)), n: lista.map((x) => x.nA) };
    const linhas = lista
      .map(
        (x) =>
          `- ${rot(x)}: ${fmtPct(x.pP)} em ${r.P} e ${fmtPct(x.pA)} em ${r.A} (${sinal(x.delta)} p.p., ${fmtInt(x.nA)} registros hoje)`,
      )
      .join("\n");
    const x = lista[0];
    const dest = `${piorou ? "Maior piora" : "Maior melhora"}: ${rot(x)}, de ${fmtPct(x.pP)} para ${fmtPct(x.pA)}.`;
    const titulo = piorou ? `Onde a taxa de ${ev} mais subiu` : `Onde a taxa de ${ev} mais caiu`;
    return AN.R(
      "comparar_periodos",
      titulo,
      t,
      "pp",
      "barras_h",
      false,
      dest,
      `${titulo}, em pontos percentuais (${r.P} contra ${r.A}):\n${linhas}`,
    );
  }
  function resultadoColuna(ctx, P, coluna, grupos) {
    const r = nomesRot(ctx),
      g = grupos || porGrupo(ctx, P, coluna);
    if (!g.length)
      throw new ErroAnalise(`A coluna “${coluna}” não tem grupos grandes o bastante nos dois períodos para comparar.`);
    const ordenados = g[0].ordenado ? g : g.slice().sort((a, b) => b.nA - a.nA);
    const t = { categoria: [], valor: [], serie: [], n: [] };
    for (const x of ordenados) {
      t.categoria.push(String(x.cat), String(x.cat));
      t.valor.push(x.pP, x.pA);
      t.serie.push(r.P, r.A);
      t.n.push(x.nP, x.nA);
    }
    const maior = g.slice().sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
    const dest = `Maior mudança em “${maior.cat}”: de ${fmtPct(maior.pP)} para ${fmtPct(maior.pA)} (${sinal(maior.delta)} p.p.).`;
    const linhas = ordenados
      .map(
        (x) =>
          `- ${x.cat}: ${fmtPct(x.pP)} em ${r.P} (${fmtInt(x.nP)} registros) e ${fmtPct(x.pA)} em ${r.A} (${fmtInt(x.nA)} registros)`,
      )
      .join("\n");
    return AN.R(
      "comparar_periodos",
      `${rotulo(coluna)}: taxa de ${ctx.rotuloEvento} em ${r.P} e em ${r.A}`,
      t,
      "%",
      "barras",
      false,
      dest,
      `${dest}\n${linhas}`,
    );
  }
  /** Resultado completo do botão “Comparar”: taxa geral, onde piorou, onde melhorou e as colunas que mais mudaram. */
  function completa(ctx) {
    const P = exigirAnterior(ctx),
      res = [resultadoGeral(ctx)],
      m = mudancas(ctx, P);
    if (m.piora.length) res.push(resultadoMudancas(ctx, m.piora, true));
    if (m.melhora.length) res.push(resultadoMudancas(ctx, m.melhora, false));
    const score = {};
    for (const x of m.todas) if (Math.abs(x.z) >= Z_RELEVANTE) score[x.col] = (score[x.col] || 0) + Math.abs(x.extra);
    for (const c of Object.keys(score)
      .sort((a, b) => score[b] - score[a])
      .slice(0, 2))
      res.push(
        resultadoColuna(
          ctx,
          P,
          c,
          m.todas.filter((x) => x.col === c),
        ),
      );
    const semMudanca = !m.piora.length && !m.melhora.length;
    return { resultados: res, semMudanca, avisos: ctx.anterior.avisos || [] };
  }
  function comparar_periodos(ctx, { coluna } = {}) {
    const P = exigirAnterior(ctx);
    if (coluna === undefined) return resultadoGeral(ctx);
    const c = colunasComuns(ctx, P).find((x) => norm(x) === norm(coluna));
    if (!c)
      throw new ErroAnalise(
        `A coluna “${coluna}” não existe nos dois arquivos (ou é uma data). Colunas comparáveis: ${colunasComuns(ctx, P).join(", ")}.`,
      );
    return resultadoColuna(ctx, P, c);
  }
  AN.FERRAMENTAS.comparar_periodos = [
    comparar_periodos,
    true,
    ["coluna"],
    "Compara o arquivo atual com o do período anterior (só existe depois que o gestor escolhe o outro arquivo). Sem parâmetros: mostra a taxa do evento nos dois períodos. Com coluna: taxa por grupo dessa coluna nos dois períodos.",
  ];

  A.comparacao = { prepararAnterior, completa, geral, zDuas };
  if (typeof module !== "undefined") module.exports = A.comparacao;
})();

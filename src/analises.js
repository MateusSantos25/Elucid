/* Elucid: ferramentas de análise (porte do motor em pandas para JavaScript).
   O assistente escolhe quais ferramentas usar; quem calcula é sempre este código. */
(function () {
  const A = (globalThis.Elucid = globalThis.Elucid || {});
  const U = A.util || require("./util.js");
  const D = A.dados || require("./dados.js");
  const { rotulo, fmtNum, fmtInt, fmtPct, fmtValor, fmtBorda, idCurto } = U;

  class ErroAnalise extends Error {}
  const PADRAO_ALVO = /cancel|churn|desist|evas|inadimpl|perd|abandon/i;
  const PADRAO_ID = /(^|[_\s])(id|cod|codigo|uuid)($|[_\s])|[a-z]id$/i;
  const SIM = new Set(["1", "1.0", "true", "sim", "s", "yes", "y", "verdadeiro"]);

  // ------------------------------------------------------------ preparação
  function valoresUnicos(c) {
    const s = new Set();
    for (let i = 0; i < c.v.length; i++) if (!D.ehNulo(c, i)) s.add(c.v[i]);
    return s;
  }
  function detectarIds(df) {
    const ids = [];
    for (const nome of df.nomes) {
      const c = df.col[nome];
      if (c.tipo === "data") continue;
      if (c.tipo === "numero") {
        let inteiro = true;
        for (const x of c.v)
          if (Number.isNaN(x) || !Number.isInteger(x)) {
            inteiro = false;
            break;
          }
        if (!inteiro) continue;
      }
      const u = valoresUnicos(c).size;
      if (df.n >= 30 && u === df.n) ids.push(nome);
      else if (df.n >= 30 && PADRAO_ID.test(nome) && u / df.n > 0.5) ids.push(nome);
    }
    return ids;
  }
  function ordenarValores(arr) {
    return arr
      .slice()
      .sort((a, b) => (typeof a === "number" && typeof b === "number" ? a - b : String(a) < String(b) ? -1 : 1));
  }
  function candidatosAlvo(df) {
    const ids = new Set(detectarIds(df));
    const c = df.nomes.filter((n) => !ids.has(n) && df.col[n].tipo !== "data" && valoresUnicos(df.col[n]).size === 2);
    return c.sort((a, b) => (PADRAO_ALVO.test(a) ? 0 : 1) - (PADRAO_ALVO.test(b) ? 0 : 1));
  }
  function sugerirPositivo(c) {
    const cont = new Map();
    for (let i = 0; i < c.v.length; i++) if (!D.ehNulo(c, i)) cont.set(c.v[i], (cont.get(c.v[i]) || 0) + 1);
    const valores = [...cont.keys()];
    for (const v of valores) if (SIM.has(String(v).trim().toLowerCase())) return v;
    for (const v of valores) if (PADRAO_ALVO.test(String(v))) return v;
    return valores.sort((a, b) => cont.get(a) - cont.get(b))[0];
  }
  function construirContexto(df, alvo, positivo) {
    const ignoradas = detectarIds(df);
    if (alvo != null && df.col[alvo]) {
      const c = df.col[alvo],
        idx = [];
      for (let i = 0; i < df.n; i++) if (!D.ehNulo(c, i)) idx.push(i);
      if (idx.length !== df.n) df = D.subconjunto(df, idx);
    } else {
      alvo = null;
      positivo = null;
    }
    const y = alvo ? Uint8Array.from(df.col[alvo].v, (x) => (x === positivo ? 1 : 0)) : null;
    const ctx = {
      df,
      alvo,
      positivo,
      ignoradas,
      y,
      get temAlvo() {
        return this.alvo != null;
      },
      get taxaGeral() {
        return this.temAlvo && this.df.n ? (this.y.reduce((a, b) => a + b, 0) / this.df.n) * 100 : 0;
      },
      get rotuloEvento() {
        return `${this.alvo} = ${this.positivo}`;
      },
      colunas() {
        return this.df.nomes.filter((c) => !this.ignoradas.includes(c) && c !== this.alvo);
      },
    };
    return ctx;
  }

  // ------------------------------------------------------------ utilidades
  const inteiro = (v, mn, mx, pad) => {
    const x = Math.trunc(parseFloat(v));
    return Number.isNaN(x) ? pad : Math.min(Math.max(x, mn), mx);
  };
  const numero = (v, mn, mx, pad) => {
    const x = parseFloat(v);
    return Number.isNaN(x) ? pad : Math.min(Math.max(x, mn), mx);
  };
  const booleano = (v) =>
    typeof v === "string" ? ["true", "sim", "1", "yes", "verdadeiro"].includes(v.trim().toLowerCase()) : !!v;
  function exigeAlvo(ctx) {
    if (!ctx.temAlvo)
      throw new ErroAnalise("Essa análise precisa saber o que investigar. Escolha em “Preparar os dados”.");
  }
  function achar(ctx, nome, exigir, permitirAlvo) {
    const cols = ctx.df.nomes.filter((c) => !ctx.ignoradas.includes(c) && (permitirAlvo || c !== ctx.alvo));
    let achada = cols.includes(nome) ? nome : null;
    if (achada == null) {
      const k = String(nome).toLowerCase().trim();
      achada = cols.find((c) => c.toLowerCase().trim() === k) || null;
    }
    if (achada == null)
      throw new ErroAnalise(`A coluna “${nome}” não existe. Colunas disponíveis: ${cols.join(", ")}.`);
    const t = ctx.df.col[achada].tipo;
    if (exigir === "numerica" && t !== "numero") throw new ErroAnalise(`A coluna “${achada}” não é numérica.`);
    if (exigir === "data" && t !== "data") throw new ErroAnalise(`A coluna “${achada}” não é uma data.`);
    return achada;
  }
  function quantil(ord, q) {
    const p = q * (ord.length - 1),
      lo = Math.floor(p),
      hi = Math.ceil(p);
    return ord[lo] + (ord[hi] - ord[lo]) * (p - lo);
  }
  const pad2 = (n) => String(n).padStart(2, "0");
  function periodo(ms, f) {
    const d = new Date(ms),
      y = d.getUTCFullYear(),
      m = d.getUTCMonth() + 1,
      dia = d.getUTCDate();
    if (f === "Y") return String(y);
    if (f === "M") return `${y}-${pad2(m)}`;
    if (f === "D") return `${y}-${pad2(m)}-${pad2(dia)}`;
    const base = Date.UTC(y, m - 1, dia),
      ini = base - ((d.getUTCDay() + 6) % 7) * 86400000,
      fim = ini + 6 * 86400000;
    const s = (x) => {
      const e = new Date(x);
      return `${e.getUTCFullYear()}-${pad2(e.getUTCMonth() + 1)}-${pad2(e.getUTCDate())}`;
    };
    return `${s(ini)}/${s(fim)}`;
  }
  function faixasDe(c, faixas, metodo) {
    const ord = Array.from(c.v)
        .filter((x) => !Number.isNaN(x))
        .sort((a, b) => a - b),
      mn = ord[0],
      mx = ord[ord.length - 1];
    const lin = (k) => Array.from({ length: k + 1 }, (_, i) => mn + ((mx - mn) * i) / k);
    let bordas =
      metodo === "largura"
        ? lin(faixas)
        : [...new Set(Array.from({ length: faixas + 1 }, (_, i) => quantil(ord, i / faixas)))];
    if (bordas.length < 3 && metodo !== "largura") bordas = [...new Set(lin(faixas))];
    const n = bordas.length - 1,
      rot = [];
    for (let i = 0; i < n; i++) {
      const a = fmtBorda(bordas[i]),
        b = fmtBorda(bordas[i + 1]);
      rot.push(
        metodo === "quantil" && n > 2 && i === 0
          ? `até ${b}`
          : metodo === "quantil" && n > 2 && i === n - 1
            ? `acima de ${a}`
            : `${a} a ${b}`,
      );
    }
    const cats = new Set(rot).size < rot.length ? rot.map((r, i) => `${i + 1}. ${r}`) : rot;
    const idx = new Int32Array(c.v.length).fill(-1);
    for (let i = 0; i < c.v.length; i++) {
      const x = c.v[i];
      if (Number.isNaN(x) || x < bordas[0] || x > bordas[n]) continue;
      let k = 0;
      while (k < n - 1 && x > bordas[k + 1]) k++;
      idx[i] = k;
    }
    return { idx, cats, ordenado: true };
  }
  /** Agrupa uma coluna em categorias legíveis: { idx (por linha, -1 = vazio), cats, ordenado }. */
  function grupos(c, { maxCats = 12, faixas = 5, metodo = "quantil" } = {}) {
    const n = c.v.length,
      idx = new Int32Array(n).fill(-1);
    if (c.tipo === "data") {
      let mn = Infinity,
        mx = -Infinity;
      for (const x of c.v)
        if (!Number.isNaN(x)) {
          mn = Math.min(mn, x);
          mx = Math.max(mx, x);
        }
      const f = (mx - mn) / 86400000 > 90 ? "M" : "D",
        rot = c.v.map((x) => (Number.isNaN(x) ? null : periodo(x, f)));
      const cats = [...new Set(rot.filter((x) => x != null))].sort(),
        pos = new Map(cats.map((k, i) => [k, i]));
      rot.forEach((k, i) => {
        if (k != null) idx[i] = pos.get(k);
      });
      return { idx, cats, ordenado: true };
    }
    if (c.tipo === "numero") {
      const valores = ordenarValores([...valoresUnicos(c)]);
      if (valores.length <= 10) {
        const pos = new Map(valores.map((v, i) => [v, i])),
          nomes = valores.map(fmtBorda),
          cats = [...new Set(nomes)];
        for (let i = 0; i < n; i++) if (!Number.isNaN(c.v[i])) idx[i] = cats.indexOf(nomes[pos.get(c.v[i])]);
        return { idx, cats, ordenado: true };
      }
      return faixasDe(c, faixas, metodo);
    }
    const cont = new Map();
    for (const x of c.v) if (x != null) cont.set(x, (cont.get(x) || 0) + 1);
    const ordem = [...cont.keys()].sort((a, b) => cont.get(b) - cont.get(a)),
      topo = ordem.slice(0, maxCats);
    const cats = topo.slice(),
      pos = new Map(topo.map((k, i) => [k, i]));
    const outros = ordem.length > maxCats;
    if (outros) cats.push("Outros");
    for (let i = 0; i < n; i++)
      if (c.v[i] != null) idx[i] = pos.has(c.v[i]) ? pos.get(c.v[i]) : outros ? cats.length - 1 : -1;
    return { idx, cats, ordenado: false };
  }
  function taxaPorGrupo(ctx, coluna, opc) {
    const g = grupos(ctx.df.col[coluna], opc),
      k = g.cats.length,
      soma = new Float64Array(k),
      cont = new Float64Array(k);
    for (let i = 0; i < ctx.df.n; i++) {
      const j = g.idx[i];
      if (j >= 0) {
        cont[j]++;
        soma[j] += ctx.y[i];
      }
    }
    const t = { categoria: [], valor: [], n: [] };
    for (let j = 0; j < k; j++)
      if (cont[j] > 0) {
        t.categoria.push(g.cats[j]);
        t.valor.push((soma[j] / cont[j]) * 100);
        t.n.push(cont[j]);
      }
    return { t, ordenado: g.ordenado };
  }
  function linhas(t, un, limite = 12) {
    const r = [];
    for (let i = 0; i < Math.min(limite, t.categoria.length); i++) {
      let s = `- ${t.categoria[i]}`;
      if (t.serie) s += ` / ${t.serie[i]}`;
      s += `: ${fmtValor(t.valor[i], un)}`;
      if (t.n) s += ` (${fmtInt(t.n[i])} registros)`;
      r.push(s);
    }
    return r.join("\n");
  }
  function tiposCompativeis(t, partes) {
    if (t.serie) return ["empilhadas", "barras", "linha", "tabela"];
    const n = t.categoria.length,
      tipos = ["barras", "barras_h"];
    if (n >= 3) tipos.push("linha");
    if (partes && n >= 2 && n <= 7 && t.valor.every((v) => v >= 0)) tipos.push("rosca");
    tipos.push("tabela");
    return tipos;
  }
  function R(ferramenta, titulo, tabela, unidade, tipoPadrao, partes, destaque, resumo, referencia = null) {
    const tipos = tiposCompativeis(tabela, partes);
    return {
      id: idCurto(),
      ferramenta,
      titulo,
      destaque,
      resumo,
      unidade,
      tipos,
      partes_do_todo: partes,
      tipo_padrao: tipos.includes(tipoPadrao) ? tipoPadrao : tipos[0],
      referencia,
      tabela,
    };
  }
  const argmax = (a) => a.indexOf(Math.max(...a)),
    argmin = (a) => a.indexOf(Math.min(...a));
  const soma = (a) => a.reduce((x, y) => x + y, 0);

  // ------------------------------------------------------------ ferramentas
  function panorama_alvo(ctx) {
    exigeAlvo(ctx);
    const n = ctx.df.n,
      k = ctx.y.reduce((a, b) => a + b, 0),
      taxa = n ? (k / n) * 100 : 0;
    const t = { categoria: ["Demais registros", ctx.rotuloEvento], valor: [n - k, k] };
    const dest = `${fmtInt(k)} de ${fmtInt(n)} registros (${fmtPct(taxa)}) têm ${ctx.rotuloEvento}.`;
    return R(
      "panorama_alvo",
      `${fmtPct(taxa)} dos registros têm ${ctx.rotuloEvento}`,
      t,
      "n",
      "rosca",
      true,
      dest,
      dest,
    );
  }
  function taxa_por_coluna(ctx, { coluna, faixas = 5 }) {
    exigeAlvo(ctx);
    const col = achar(ctx, coluna),
      { t } = taxaPorGrupo(ctx, col, { faixas: inteiro(faixas, 2, 10, 5) });
    if (!t.categoria.length) throw new ErroAnalise(`A coluna “${col}” não tem dados suficientes.`);
    const media = ctx.taxaGeral,
      a = argmax(t.valor),
      b = argmin(t.valor);
    const dest = `Taxa média de ${ctx.alvo}: ${fmtPct(media)}. Maior em “${t.categoria[a]}” (${fmtPct(t.valor[a])}, ${fmtInt(t.n[a])} registros); menor em “${t.categoria[b]}” (${fmtPct(t.valor[b])}).`;
    return R(
      "taxa_por_coluna",
      `${rotulo(col)}: maior taxa em “${t.categoria[a]}” (${fmtPct(t.valor[a])})`,
      t,
      "%",
      "barras",
      false,
      dest,
      `${dest}\n${linhas(t, "%")}`,
      media,
    );
  }
  /** Procura grupos/condições com taxa do evento bem acima da média. Cada candidato guarda a regra (`regra`) para poder virar uma máscara de linhas. */
  function candidatosRisco(ctx, lift, tam) {
    const N = ctx.df.n,
      media = ctx.taxaGeral;
    if (!N || media === 0) throw new ErroAnalise("Não há registros com o evento investigado.");
    const minN = Math.max(20, (N * tam) / 100),
      piso = Math.min(media * lift, media + (100 - media) / 2),
      cand = [],
      y = ctx.y;
    for (const col of ctx.colunas()) {
      const c = ctx.df.col[col];
      if (c.tipo === "data") continue;
      if (c.tipo === "numero" && valoresUnicos(c).size > 5) {
        const ord = Array.from(c.v)
            .filter((x) => !Number.isNaN(x))
            .sort((a, b) => a - b),
          un = [...new Set(ord)];
        const lims =
          un.length > 30
            ? [...new Set(Array.from({ length: 19 }, (_, i) => quantil(ord, 0.05 + i * 0.05)))]
            : un.slice(0, -1);
        const melhores = {};
        for (const lim of lims) {
          let nA = 0,
            sA = 0,
            nB = 0,
            sB = 0;
          for (let i = 0; i < N; i++) {
            const x = c.v[i];
            if (x > lim) {
              nA++;
              sA += y[i];
            } else if (x <= lim) {
              nB++;
              sB += y[i];
            }
          }
          for (const [op, n, s] of [
            [">", nA, sA],
            ["<=", nB, sB],
          ]) {
            if (n < minN) continue;
            const taxa = (s / n) * 100,
              exc = ((taxa - media) / 100) * n;
            if (taxa >= piso && exc > (melhores[op] ? melhores[op].exc : 0))
              melhores[op] = {
                exc,
                col,
                cat: `${rotulo(col)} ${op} ${fmtBorda(lim)}`,
                taxa,
                n,
                regra: { tipo: "num", op, lim },
              };
          }
        }
        cand.push(...Object.values(melhores));
      } else {
        const { t } = taxaPorGrupo(ctx, col);
        t.categoria.forEach((cat, i) => {
          if (t.n[i] >= minN && t.valor[i] >= piso)
            cand.push({
              exc: ((t.valor[i] - media) / 100) * t.n[i],
              col,
              cat: `${rotulo(col)} = ${cat}`,
              taxa: t.valor[i],
              n: t.n[i],
              regra: { tipo: "cat", rotulo: cat },
            });
        });
      }
    }
    cand.sort((a, b) => b.exc - a.exc);
    return { cand, media, piso, minN };
  }
  /** Transforma a regra de um candidato em uma máscara (Uint8Array, 1 = a linha pertence ao grupo). */
  function mascaraDe(ctx, cand) {
    const c = ctx.df.col[cand.col],
      m = new Uint8Array(ctx.df.n),
      r = cand.regra;
    if (r.tipo === "num") {
      for (let i = 0; i < m.length; i++) {
        const x = c.v[i];
        if (!Number.isNaN(x) && (r.op === ">" ? x > r.lim : x <= r.lim)) m[i] = 1;
      }
    } else {
      const g = grupos(c),
        k = g.cats.indexOf(r.rotulo);
      for (let i = 0; i < m.length; i++) if (g.idx[i] === k) m[i] = 1;
    }
    return m;
  }
  function segmentos_de_risco(ctx, { lift_minimo = 1.3, tamanho_minimo_pct = 3, limite = 8 } = {}) {
    exigeAlvo(ctx);
    const lift = numero(lift_minimo, 1.05, 10, 1.3),
      tam = numero(tamanho_minimo_pct, 0.5, 50, 3);
    limite = inteiro(limite, 2, 15, 8);
    const { cand, media, piso } = candidatosRisco(ctx, lift, tam);
    if (!cand.length)
      throw new ErroAnalise(
        `Não encontrei grupos com taxa a partir de ${fmtPct(piso)} (média geral: ${fmtPct(media)}) que reúnam ao menos ${fmtPct(tam)} dos registros.`,
      );
    const porCol = {},
      topo = cand.filter((x) => (porCol[x.col] = (porCol[x.col] || 0) + 1) <= 2).slice(0, limite);
    const t = { categoria: topo.map((x) => x.cat), valor: topo.map((x) => x.taxa), n: topo.map((x) => x.n) };
    const dest = `Maior impacto: ${t.categoria[0]} (${fmtPct(t.valor[0])}, ${fmtInt(t.n[0])} registros), contra média de ${fmtPct(media)}.`;
    return R(
      "segmentos_de_risco",
      `${topo.length} grupos com taxa muito acima da média (${fmtPct(media)})`,
      t,
      "%",
      "barras_h",
      false,
      dest,
      `Média geral: ${fmtPct(media)}. Grupos ordenados por impacto:\n${linhas(t, "%")}`,
      media,
    );
  }
  function ranking_fatores(ctx, { limite = 8, colunas } = {}) {
    exigeAlvo(ctx);
    limite = inteiro(limite, 2, 15, 8);
    const so = Array.isArray(colunas) && colunas.length ? new Set(colunas.map(String)) : null; // só estas colunas (clique na tabela)
    const media = ctx.taxaGeral,
      itens = [];
    for (const col of ctx.colunas()) {
      if (so && !so.has(col)) continue;
      if (ctx.df.col[col].tipo === "data") continue;
      const { t } = taxaPorGrupo(ctx, col);
      if (t.categoria.length < 2) continue;
      const tot = soma(t.n);
      itens.push([rotulo(col), t.valor.reduce((a, v, i) => a + (t.n[i] / tot) * Math.abs(v - media), 0)]);
    }
    if (!itens.length) throw new ErroAnalise("Não há colunas suficientes para comparar.");
    itens.sort((a, b) => b[1] - a[1]);
    const top = itens.slice(0, limite),
      t = { categoria: top.map((x) => x[0]), valor: top.map((x) => x[1]) };
    const dest = `Os fatores que mais diferenciam a taxa de ${ctx.alvo}: ${t.categoria.slice(0, 3).join(", ")}. Quanto maior o valor, mais a taxa muda de um grupo para outro (em pontos percentuais).`;
    return R(
      "ranking_fatores",
      `${t.categoria[0]} é o fator que mais diferencia a taxa de ${ctx.alvo}`,
      t,
      "pp",
      "barras_h",
      false,
      dest,
      `${dest}\nMedida: quanto a taxa de ${ctx.alvo} varia, em média, entre os grupos de cada coluna (em pontos percentuais; medida aproximada).\n${linhas(t, "pp")}`,
    );
  }
  function comparar_medias(ctx, { coluna }) {
    exigeAlvo(ctx);
    const col = achar(ctx, coluna, "numerica"),
      c = ctx.df.col[col];
    const med = (alvo) => {
      let s = 0,
        k = 0,
        tot = 0;
      for (let i = 0; i < c.v.length; i++) {
        if ((ctx.y[i] === 1) !== alvo) continue;
        tot++;
        if (!Number.isNaN(c.v[i])) {
          s += c.v[i];
          k++;
        }
      }
      return [k ? s / k : NaN, tot];
    };
    const [m1, n1] = med(true),
      [m0, n0] = med(false);
    const t = { categoria: ["Demais registros", ctx.rotuloEvento], valor: [m0, m1], n: [n0, n1] };
    const dest = `Média de ${col}: ${fmtValor(m1, "")} onde ${ctx.rotuloEvento}, contra ${fmtValor(m0, "")} nos demais registros.`;
    return R(
      "comparar_medias",
      `${rotulo(col)}: média ${fmtValor(m1, "")} onde ${ctx.rotuloEvento}, contra ${fmtValor(m0, "")}`,
      t,
      "",
      "barras",
      false,
      dest,
      dest,
    );
  }
  function distribuicao(ctx, { coluna, separar_por_alvo = false }) {
    const col = achar(ctx, coluna, null, true),
      g = grupos(ctx.df.col[col], { maxCats: 15, faixas: 10, metodo: "largura" }),
      k = g.cats.length;
    if (booleano(separar_por_alvo) && ctx.temAlvo && col !== ctx.alvo) {
      const cont = [new Float64Array(k), new Float64Array(k)];
      for (let i = 0; i < ctx.df.n; i++) if (g.idx[i] >= 0) cont[ctx.y[i]][g.idx[i]]++;
      const t = { categoria: [], valor: [], serie: [] },
        nomes = ["Demais registros", ctx.rotuloEvento];
      for (let j = 0; j < k; j++)
        for (let s = 0; s < 2; s++)
          if (cont[s][j] > 0) {
            t.categoria.push(g.cats[j]);
            t.valor.push(cont[s][j]);
            t.serie.push(nomes[s]);
          }
      const dest = `Distribuição de ${col} separada entre ${ctx.rotuloEvento} e os demais registros.`;
      return R(
        "distribuicao",
        `Distribuição de ${rotulo(col)} por ${ctx.alvo}`,
        t,
        "n",
        "empilhadas",
        false,
        dest,
        `${dest}\n${linhas(t, "n", 30)}`,
      );
    }
    const cont = new Float64Array(k);
    for (let i = 0; i < ctx.df.n; i++) if (g.idx[i] >= 0) cont[g.idx[i]]++;
    let pares = g.cats.map((c, j) => [c, cont[j]]).filter((p) => p[1] > 0);
    if (!g.ordenado) pares = pares.sort((a, b) => b[1] - a[1]);
    const t = { categoria: pares.map((p) => p[0]), valor: pares.map((p) => p[1]) },
      total = soma(t.valor),
      m = argmax(t.valor);
    const pct = fmtPct((t.valor[m] / total) * 100);
    const dest = `Mais frequente: “${t.categoria[m]}” (${pct} dos registros, ${fmtInt(t.valor[m])}).`;
    return R(
      "distribuicao",
      `${rotulo(col)}: “${t.categoria[m]}” é o mais frequente (${pct})`,
      t,
      "n",
      "barras",
      true,
      dest,
      `${dest}\n${linhas(t, "n", 20)}`,
    );
  }
  function evolucao_temporal(ctx, { coluna_data, metrica = "contagem", coluna_valor = null, frequencia = "mes" }) {
    const col = achar(ctx, coluna_data, "data"),
      c = ctx.df.col[col];
    const f = { dia: "D", sem: "W", mes: "M", mês: "M", ano: "Y" }[String(frequencia).toLowerCase().slice(0, 3)] || "M";
    const nomeF = { D: "dia", W: "semana", M: "mês", Y: "ano" }[f];
    metrica = String(metrica).toLowerCase();
    if (!["contagem", "soma", "media", "taxa_alvo"].includes(metrica))
      throw new ErroAnalise("A métrica deve ser contagem, soma, media ou taxa_alvo.");
    let vals = null,
      nome,
      unidade = "";
    if (metrica === "taxa_alvo") {
      exigeAlvo(ctx);
      nome = `Taxa de ${ctx.alvo}`;
      unidade = "%";
    } else if (metrica === "contagem") {
      nome = "Número de registros";
      unidade = "n";
    } else {
      const cv = achar(ctx, coluna_valor, "numerica", true);
      vals = ctx.df.col[cv].v;
      nome = `${metrica === "soma" ? "Soma" : "Média"} de ${rotulo(cv)}`;
    }
    const mapa = new Map();
    for (let i = 0; i < ctx.df.n; i++) {
      if (Number.isNaN(c.v[i])) continue;
      const p = periodo(c.v[i], f);
      const a = mapa.get(p) || mapa.set(p, { n: 0, s: 0, k: 0 }).get(p);
      a.n++;
      if (metrica === "taxa_alvo") {
        a.s += ctx.y[i];
        a.k++;
      } else if (vals && !Number.isNaN(vals[i])) {
        a.s += vals[i];
        a.k++;
      }
    }
    const chaves = [...mapa.keys()].sort().slice(-120);
    if (!chaves.length) throw new ErroAnalise(`A coluna “${col}” não tem datas válidas.`);
    const valor = chaves.map((k) => {
      const a = mapa.get(k);
      return metrica === "contagem"
        ? a.n
        : metrica === "soma"
          ? a.s
          : metrica === "taxa_alvo"
            ? (a.s / a.k) * 100
            : a.k
              ? a.s / a.k
              : NaN;
    });
    const t = { categoria: chaves, valor, n: chaves.map((k) => mapa.get(k).n) },
      p = argmax(valor),
      u = chaves.length - 1;
    const dest = `Pico em ${t.categoria[p]} (${fmtValor(valor[p], unidade)}); último período (${t.categoria[u]}): ${fmtValor(valor[u], unidade)}.`;
    return R(
      "evolucao_temporal",
      `${nome} por ${nomeF}`,
      t,
      unidade,
      "linha",
      false,
      dest,
      `${dest}\n${linhas(t, unidade, 40)}`,
      metrica === "taxa_alvo" ? ctx.taxaGeral : null,
    );
  }
  function agrupar(ctx, { coluna_grupo, metrica = "contagem", coluna_valor = null, top = 10 }) {
    const col = achar(ctx, coluna_grupo, null, true);
    metrica = String(metrica).toLowerCase();
    if (!["contagem", "soma", "media"].includes(metrica))
      throw new ErroAnalise("A métrica deve ser contagem, soma ou media.");
    top = inteiro(top, 3, 20, 10);
    const g = grupos(ctx.df.col[col], { maxCats: top, faixas: Math.min(top, 8) }),
      k = g.cats.length;
    let vals = null,
      nome = "Número de registros",
      unidade = "n";
    if (metrica !== "contagem") {
      const cv = achar(ctx, coluna_valor, "numerica", true);
      vals = ctx.df.col[cv].v;
      unidade = "";
      nome = `${metrica === "soma" ? "Soma" : "Média"} de ${rotulo(cv)}`;
    }
    const s = new Float64Array(k),
      q = new Float64Array(k);
    for (let i = 0; i < ctx.df.n; i++) {
      const j = g.idx[i];
      if (j < 0) continue;
      if (!vals) {
        s[j]++;
        q[j]++;
      } else if (!Number.isNaN(vals[i])) {
        s[j] += vals[i];
        q[j]++;
      }
    }
    let pares = g.cats
      .map((c, j) => [c, q[j] ? (metrica === "media" ? s[j] / q[j] : s[j]) : null])
      .filter((p) => p[1] != null);
    if (!g.ordenado) pares = pares.sort((a, b) => b[1] - a[1]);
    if (!pares.length) throw new ErroAnalise("Não há dados para agrupar.");
    const t = { categoria: pares.map((p) => p[0]), valor: pares.map((p) => p[1]) },
      m = argmax(t.valor);
    const dest = `Maior valor: “${t.categoria[m]}” (${fmtValor(t.valor[m], unidade)}).`;
    return R(
      "agrupar",
      `${nome} por ${rotulo(col)}: destaque para “${t.categoria[m]}”`,
      t,
      unidade,
      t.categoria.length > 6 && !g.ordenado ? "barras_h" : "barras",
      metrica !== "media",
      dest,
      `${dest}\n${linhas(t, unidade, 20)}`,
    );
  }

  // ------------------------------------------------------------ catálogo
  const FERRAMENTAS = {
    panorama_alvo: [
      panorama_alvo,
      true,
      [],
      "Mostra quantos registros têm o evento investigado e a taxa geral. Sem parâmetros.",
    ],
    taxa_por_coluna: [
      taxa_por_coluna,
      true,
      ["coluna", "faixas"],
      "Taxa do evento em cada grupo de uma coluna. Parâmetros: coluna (obrigatório); faixas (opcional, 2 a 10, para colunas numéricas).",
    ],
    segmentos_de_risco: [
      segmentos_de_risco,
      true,
      ["lift_minimo", "tamanho_minimo_pct", "limite"],
      "Procura grupos e condições (ex.: 'dias_atraso > 20') com taxa do evento muito acima da média. Parâmetros opcionais: lift_minimo (padrão 1.3), tamanho_minimo_pct (padrão 3), limite (padrão 8).",
    ],
    ranking_fatores: [
      ranking_fatores,
      true,
      ["limite", "colunas"],
      "Ordena as colunas pelo quanto diferenciam a taxa do evento. Parâmetros opcionais: limite; colunas (lista de nomes, para ordenar só essas).",
    ],
    comparar_medias: [
      comparar_medias,
      true,
      ["coluna"],
      "Compara a média de uma coluna numérica entre quem tem o evento e os demais. Parâmetro: coluna.",
    ],
    distribuicao: [
      distribuicao,
      false,
      ["coluna", "separar_por_alvo"],
      "Distribuição de uma coluna. Parâmetros: coluna (obrigatório); separar_por_alvo (true/false, opcional, separa entre evento e demais).",
    ],
    evolucao_temporal: [
      evolucao_temporal,
      false,
      ["coluna_data", "metrica", "coluna_valor", "frequencia"],
      "Evolução no tempo. Parâmetros: coluna_data (obrigatório, uma coluna de data); metrica (contagem, soma, media ou taxa_alvo); coluna_valor (para soma/media); frequencia (dia, semana, mes ou ano).",
    ],
    agrupar: [
      agrupar,
      false,
      ["coluna_grupo", "metrica", "coluna_valor", "top"],
      "Agrupa por uma coluna e conta, soma ou tira a média. Parâmetros: coluna_grupo (obrigatório); metrica (contagem, soma ou media); coluna_valor (para soma/media); top (padrão 10).",
    ],
  };
  const descricaoFerramentas = (ctx) =>
    Object.entries(FERRAMENTAS)
      .filter(([n, f]) => (ctx.temAlvo || !f[1]) && (n !== "comparar_periodos" || ctx.anterior))
      .map(([n, f]) => `- ${n}: ${f[3]}`)
      .join("\n");
  function executar(ctx, nome, parametros) {
    const f = FERRAMENTAS[nome];
    if (!f) throw new ErroAnalise(`Não conheço a análise “${nome}”.`);
    if (f[1]) exigeAlvo(ctx);
    const p = {};
    for (const k of f[2]) if (parametros && parametros[k] !== undefined && parametros[k] !== null) p[k] = parametros[k];
    for (const obrig of {
      taxa_por_coluna: ["coluna"],
      comparar_medias: ["coluna"],
      distribuicao: ["coluna"],
      evolucao_temporal: ["coluna_data"],
      agrupar: ["coluna_grupo"],
    }[nome] || [])
      if (p[obrig] === undefined) throw new ErroAnalise(`Faltou informar o parâmetro “${obrig}” da análise “${nome}”.`);
    return f[0](ctx, p);
  }
  A.analises = {
    ErroAnalise,
    R,
    grupos,
    candidatosRisco,
    mascaraDe,
    PADRAO_ALVO,
    detectarIds,
    candidatosAlvo,
    sugerirPositivo,
    construirContexto,
    ordenarValores,
    tiposCompativeis,
    FERRAMENTAS,
    descricaoFerramentas,
    executar,
    valoresUnicos,
  };
  if (typeof module !== "undefined") module.exports = A.analises;
})();

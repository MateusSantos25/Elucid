/* Elucid: tratamento de dados vazios (o usuário escolhe, coluna a coluna). */
(function () {
  const A = (globalThis.Elucid = globalThis.Elucid || {});
  const { fmtInt } = A.util || require("./util.js");
  const D = A.dados || require("./dados.js");
  const ESTRATEGIAS = {
    mediana: "Preencher com a mediana", media: "Preencher com a média", zero: "Preencher com zero",
    moda: "Preencher com o valor mais comum", nao_informado: "Preencher com “Não informado”",
    remover_linhas: "Remover as linhas com vazio", manter: "Deixar como está",
  };
  const POR_TIPO = {
    numero: ["mediana", "media", "zero", "remover_linhas", "manter"],
    texto: ["nao_informado", "moda", "remover_linhas", "manter"],
    data: ["remover_linhas", "manter"],
  };
  const estrategiasPara = (tipo) => POR_TIPO[tipo].slice();
  function contarVazios(c) { let k = 0; for (let i = 0; i < c.v.length; i++) if (D.ehNulo(c, i)) k++; return k; }
  function diagnostico(df) {
    const r = [];
    for (const nome of df.nomes) {
      const k = contarVazios(df.col[nome]);
      if (k > 0) r.push({ coluna: nome, faltantes: k, pct: (k / df.n) * 100, tipo: df.col[nome].tipo });
    }
    return r;
  }
  function recomendar(df, alvo) {
    const r = {};
    for (const d of diagnostico(df)) {
      if (d.coluna === alvo) r[d.coluna] = "remover_linhas";
      else if (d.pct > 50) r[d.coluna] = "manter";
      else if (d.tipo === "numero") r[d.coluna] = "mediana";
      else if (d.tipo === "texto") r[d.coluna] = "nao_informado";
      else r[d.coluna] = "manter";
    }
    return r;
  }
  const validos = (c) => Array.from(c.v).filter((x) => x != null && !Number.isNaN(x));
  function mediana(c) { const v = validos(c).sort((a, b) => a - b), n = v.length; return n ? (n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2) : NaN; }
  function media(c) { const v = validos(c); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; }
  function moda(c) {
    const cont = new Map();
    for (const x of c.v) if (x != null) cont.set(x, (cont.get(x) || 0) + 1);
    let melhor = null, mk = 0;
    for (const [k, n] of [...cont].sort((a, b) => (a[0] < b[0] ? -1 : 1))) if (n > mk) { melhor = k; mk = n; }
    return melhor;
  }
  function aplicar(df, regras) {
    const col = {}, notas = [], remover = new Uint8Array(df.n);
    for (const nome of df.nomes) col[nome] = df.col[nome];
    for (const [nome, est] of Object.entries(regras || {})) {
      const c = col[nome];
      if (!c || !ESTRATEGIAS[est] || est === "manter") continue;
      const n = contarVazios(c);
      if (!n || !POR_TIPO[c.tipo].includes(est)) continue;
      if (est === "remover_linhas") {
        for (let i = 0; i < df.n; i++) if (D.ehNulo(c, i)) remover[i] = 1;
        notas.push(`${fmtInt(n)} linhas sem “${nome}” removidas`); continue;
      }
      let valor, quem;
      if (est === "mediana") { valor = mediana(c); quem = "a mediana"; }
      else if (est === "media") { valor = media(c); quem = "a média"; }
      else if (est === "zero") { valor = 0; quem = "zero"; }
      else if (est === "moda") { valor = moda(c); quem = "o valor mais comum"; }
      else { valor = "Não informado"; quem = "“Não informado”"; }
      if (valor == null || (typeof valor === "number" && Number.isNaN(valor))) continue;
      const novo = c.tipo === "texto" ? c.v.map((x) => (x == null ? valor : x)) : Float64Array.from(c.v, (x) => (Number.isNaN(x) ? valor : x));
      col[nome] = { tipo: c.tipo, v: novo };
      notas.push(`${fmtInt(n)} vazios em “${nome}” preenchidos com ${quem}`);
    }
    let r = { n: df.n, nomes: df.nomes.slice(), col };
    if (remover.some((x) => x)) { const idx = []; for (let i = 0; i < df.n; i++) if (!remover[i]) idx.push(i); r = D.subconjunto(r, idx); }
    return { df: r, notas };
  }
  A.limpeza = { ESTRATEGIAS, estrategiasPara, diagnostico, recomendar, aplicar };
  if (typeof module !== "undefined") module.exports = A.limpeza;
})();

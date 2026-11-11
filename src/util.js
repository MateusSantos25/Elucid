/* Elucid: formatação no padrão brasileiro e nomes legíveis. */
(function () {
  const A = (globalThis.Elucid = globalThis.Elucid || {});
  const nfs = {};
  const nf = (c) => nfs[c] || (nfs[c] = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c }));
  const rotulo = (c) => { const t = String(c).replace(/_/g, " ").trim(); return t.charAt(0).toUpperCase() + t.slice(1); };
  const fmtNum = (x, c = 1) => (x == null || Number.isNaN(x) ? "-" : nf(c).format(x));
  const fmtInt = (x) => fmtNum(x, 0);
  const fmtPct = (x, c = 1) => fmtNum(x, c) + "%";
  function fmtValor(v, un) {
    if (un === "%") return fmtPct(v);
    if (un === "n") return fmtInt(v);
    if (un === "pp") return fmtNum(v) + " p.p.";
    const a = Math.abs(v);
    return fmtNum(v, a >= 1000 ? 0 : a >= 10 ? 1 : 2);
  }
  function fmtBorda(x) {
    if (Math.abs(x - Math.round(x)) < 1e-9) return fmtInt(x);
    return fmtNum(x, Math.abs(x) < 10 ? 2 : 1);
  }
  const idCurto = () => Math.random().toString(16).slice(2, 10).padEnd(8, "0");
  A.util = { rotulo, fmtNum, fmtInt, fmtPct, fmtValor, fmtBorda, idCurto };
  if (typeof module !== "undefined") module.exports = A.util;
})();

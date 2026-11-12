/* Elucid: gráficos em SVG puro (sem bibliotecas). Escuros, com gradientes, referência e dicas. */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const COR = {
    azul: "#6AA6FF",
    azul2: "#3C73E8",
    ouro: "#FFB547",
    ouro2: "#F08A24",
    teal: "#35D0BA",
    violeta: "#A28BFF",
    rosa: "#FF6F8E",
    cinza: "#7C88A6",
    texto: "#E8ECF6",
    mudo: "#8D99B5",
    tenue: "#5E6A87",
    grade: "rgba(141,153,181,.13)",
    trilho: "rgba(141,153,181,.10)",
  };
  const SERIES = [COR.azul, COR.ouro, COR.teal, COR.violeta, COR.rosa, COR.cinza];
  const TIPOS = {
    barras: "Barras",
    barras_h: "Ranking",
    empilhadas: "Empilhadas",
    linha: "Linha",
    rosca: "Rosca",
    tabela: "Tabela",
  };

  // ------------------------------------------------------------ formatação (pt-BR)
  const nfs = {};
  const nf = (c) =>
    nfs[c] || (nfs[c] = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c }));
  function fmt(v, un) {
    if (v == null || Number.isNaN(v)) return "-";
    if (un === "%") return nf(1).format(v) + "%";
    if (un === "n") return nf(0).format(v);
    if (un === "pp") return nf(1).format(v) + " p.p.";
    const a = Math.abs(v);
    return nf(a >= 1000 ? 0 : a >= 10 ? 1 : 2).format(v);
  }
  function fmtEixo(v, un) {
    if (un === "%") return nf(0).format(v) + "%";
    const a = Math.abs(v);
    if (a >= 1e6) return nf(1).format(v / 1e6) + " mi";
    if (a >= 1e4) return nf(0).format(v / 1e3) + " mil";
    return nf(Number.isInteger(v) ? 0 : a >= 10 ? 0 : 1).format(v);
  }

  // ------------------------------------------------------------ utilidades de desenho
  function el(tag, attrs, pai) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (pai) pai.appendChild(e);
    return e;
  }
  function txt(pai, x, y, texto, attrs) {
    const t = el("text", Object.assign({ x, y, fill: COR.mudo, "font-size": 12 }, attrs), pai);
    t.textContent = texto;
    return t;
  }
  function gradiente(defs, id, cima, base, opCima, opBase) {
    const g = el("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: "0%", "stop-color": cima, "stop-opacity": opCima == null ? 1 : opCima }, g);
    el("stop", { offset: "100%", "stop-color": base, "stop-opacity": opBase == null ? 1 : opBase }, g);
  }
  function escala(max, n) {
    n = n || 4;
    if (!(max > 0)) return { max: 1, passo: 0.25, ticks: [0, 0.25, 0.5, 0.75, 1] };
    const bruto = max / n,
      mag = Math.pow(10, Math.floor(Math.log10(bruto)));
    const f = bruto / mag,
      passo = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
    const teto = Math.ceil(max / passo - 1e-9) * passo,
      ticks = [];
    for (let v = 0; v <= teto + passo / 2; v += passo) ticks.push(+v.toFixed(10));
    return { max: teto, passo, ticks };
  }
  function escalaPct(max, un) {
    if (un === "%" && max <= 110) return max > 78 ? { max: 100, passo: 25, ticks: [0, 25, 50, 75, 100] } : escala(max);
    return escala(max);
  }
  function quebrar(texto, max) {
    texto = String(texto);
    if (texto.length <= max) return [texto];
    const palavras = texto.split(/\s+/),
      linhas = [""];
    for (const p of palavras) {
      const atual = linhas[linhas.length - 1];
      if ((atual + " " + p).trim().length <= max) linhas[linhas.length - 1] = (atual + " " + p).trim();
      else linhas.push(p);
    }
    let r = linhas.slice(0, 2);
    if (linhas.length > 2) r[1] = r[1].slice(0, Math.max(1, max - 1)) + "…";
    return r.map((l) => (l.length > max + 2 ? l.slice(0, max) + "…" : l));
  }
  function topoArredondado(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }
  function curva(pts) {
    // spline monotônica: suave, sem "estourar" nos picos
    const n = pts.length;
    if (n < 3) return pts.map((p, i) => (i ? "L" : "M") + p[0] + "," + p[1]).join("");
    const dx = [],
      m = [],
      t = [];
    for (let i = 0; i < n - 1; i++) {
      dx[i] = pts[i + 1][0] - pts[i][0];
      m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i];
    }
    t[0] = m[0];
    t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) {
        t[i] = t[i + 1] = 0;
        continue;
      }
      const a = t[i] / m[i],
        b = t[i + 1] / m[i],
        s = a * a + b * b;
      if (s > 9) {
        const k = 3 / Math.sqrt(s);
        t[i] = k * a * m[i];
        t[i + 1] = k * b * m[i];
      }
    }
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += `C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
    }
    return d;
  }

  // ------------------------------------------------------------ dica (tooltip)
  function dica() {
    let d = document.getElementById("dica");
    if (!d) {
      d = document.createElement("div");
      d.id = "dica";
      d.className = "dica";
      document.body.appendChild(d);
    }
    return d;
  }
  function mostrarDica(html, ev) {
    const d = dica();
    d.innerHTML = html;
    d.classList.add("visivel");
    const w = d.offsetWidth,
      h = d.offsetHeight;
    let x = ev.clientX + 16,
      y = ev.clientY - h - 14;
    if (x + w > innerWidth - 8) x = ev.clientX - w - 16;
    if (y < 8) y = ev.clientY + 18;
    d.style.transform = `translate(${Math.max(8, x)}px,${y}px)`;
  }
  function esconderDica() {
    dica().classList.remove("visivel");
  }
  const linhaDica = (cor, rot, val) =>
    `<div class="dica-linha"><i style="background:${cor}"></i><span>${rot}</span><b>${val}</b></div>`;
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  function base(c, w, h, anim) {
    const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: "img", class: anim ? "anima" : "" });
    const defs = el("defs", {}, svg);
    c.appendChild(svg);
    return { svg, defs };
  }
  function etiquetaRef(g, x, y, texto, lado) {
    const larg = texto.length * 6.6 + 16;
    const x0 = lado === "esq" ? x : x - larg;
    el(
      "rect",
      { x: x0, y: y - 11, width: larg, height: 22, rx: 11, fill: "#1B2640", stroke: "rgba(141,153,181,.35)" },
      g,
    );
    txt(g, x0 + larg / 2, y + 4, texto, {
      "text-anchor": "middle",
      fill: COR.texto,
      "font-size": 11.5,
      "font-weight": 600,
    });
  }

  // ------------------------------------------------------------ barras verticais
  function barras(c, it, w, anim) {
    const t = it.tabela,
      n = t.categoria.length,
      h = 360,
      un = it.unidade;
    const maxRot = Math.max(5, Math.floor((w - 70) / n / 7.2));
    const rot = t.categoria.map((k) => quebrar(k, maxRot));
    const lin = Math.max(...rot.map((r) => r.length));
    const m = { t: 34, r: 18, b: 24 + lin * 15, l: 46 };
    const topo = Math.max(...t.valor, it.referencia || 0),
      e = escalaPct(topo * 1.06, un);
    const iw = w - m.l - m.r,
      ih = h - m.t - m.b,
      faixa = iw / n,
      bw = Math.min(70, faixa * 0.56);
    const { svg, defs } = base(c, w, h, anim);
    gradiente(defs, "gAzul", COR.azul, COR.azul2, 1, 0.35);
    gradiente(defs, "gOuro", "#FFC766", COR.ouro2, 1, 0.45);
    const Y = (v) => m.t + ih * (1 - v / e.max);
    const g = el("g", {}, svg);
    e.ticks.forEach((tk) => {
      el("line", { x1: m.l, x2: w - m.r, y1: Y(tk), y2: Y(tk), stroke: COR.grade }, g);
      txt(g, m.l - 10, Y(tk) + 4, fmtEixo(tk, un), { "text-anchor": "end", fill: COR.tenue, "font-size": 11.5 });
    });
    const maxIdx = n >= 3 ? t.valor.indexOf(Math.max(...t.valor)) : -1;
    const barrasEl = [];
    t.valor.forEach((v, i) => {
      const x = m.l + faixa * i + (faixa - bw) / 2,
        y = Y(v),
        alt = Math.max(2, m.t + ih - y);
      const dest = i === maxIdx;
      const p = el(
        "path",
        {
          d: topoArredondado(x, m.t + ih - alt, bw, alt, 9),
          fill: `url(#${dest ? "gOuro" : "gAzul"})`,
          class: "barra",
          style: `animation-delay:${i * 45}ms`,
        },
        g,
      );
      if (dest) p.setAttribute("filter", "drop-shadow(0 6px 14px rgba(255,181,71,.28))");
      barrasEl.push(p);
      if (faixa > 36 || dest)
        txt(g, x + bw / 2, y - 9, fmt(v, un), {
          "text-anchor": "middle",
          fill: dest ? COR.ouro : COR.texto,
          "font-size": 12.5,
          "font-weight": 700,
        });
      rot[i].forEach((linha, k) =>
        txt(g, x + bw / 2, m.t + ih + 20 + k * 15, linha, { "text-anchor": "middle", fill: COR.mudo, "font-size": 12 }),
      );
    });
    if (it.referencia != null) {
      const y = Y(it.referencia);
      el(
        "line",
        {
          x1: m.l,
          x2: w - m.r,
          y1: y,
          y2: y,
          stroke: COR.ouro,
          "stroke-dasharray": "5 5",
          "stroke-width": 1.4,
          opacity: 0.85,
        },
        g,
      );
      const naEsq = t.valor[0] <= t.valor[n - 1];
      etiquetaRef(
        g,
        naEsq ? m.l + 6 : w - m.r,
        y - 14 < m.t ? y + 16 : y - 14,
        "Média geral " + fmt(it.referencia, un),
        naEsq ? "esq" : "dir",
      );
    }
    t.categoria.forEach((k, i) => {
      const x = m.l + faixa * i;
      const zona = el("rect", { x, y: m.t, width: faixa, height: ih + 30, fill: "transparent" }, svg);
      zona.addEventListener("mousemove", (ev) => {
        barrasEl.forEach((b, j) => (b.style.opacity = j === i ? 1 : 0.55));
        const dif =
          it.referencia != null
            ? `<div class="dica-sub">${t.valor[i] >= it.referencia ? "+" : ""}${fmt(t.valor[i] - it.referencia, "pp")} vs média geral</div>`
            : "";
        const reg = t.n ? `<div class="dica-sub">${fmt(t.n[i], "n")} registros</div>` : "";
        mostrarDica(
          `<div class="dica-titulo">${esc(k)}</div>${linhaDica(i === maxIdx ? COR.ouro : COR.azul, "Valor", fmt(t.valor[i], un))}${dif}${reg}`,
          ev,
        );
      });
      zona.addEventListener("mouseleave", () => {
        barrasEl.forEach((b) => (b.style.opacity = 1));
        esconderDica();
      });
    });
  }

  // ------------------------------------------------------------ ranking (barras horizontais)
  function ranking(c, it, w, anim) {
    const t = it.tabela,
      n = t.categoria.length,
      un = it.unidade,
      linhaH = 40;
    const rotMax = Math.min(34, Math.max(...t.categoria.map((k) => String(k).length)));
    const rotW = Math.min(w * 0.42, Math.max(110, rotMax * 7.4));
    const valW = un === "%" ? 64 : 84,
      topoRef = it.referencia != null ? 30 : 8;
    const h = n * linhaH + topoRef + 10,
      x0 = rotW + 14,
      x1 = w - valW - 6,
      tw = Math.max(40, x1 - x0);
    const maior = Math.max(...t.valor, it.referencia || 0);
    const topo = Math.max(un === "%" ? Math.min(100, maior * 1.05) : maior * 1.04, Math.max(...t.valor), 1e-9);
    const { svg, defs } = base(c, w, h, anim);
    const gh = (id, a, b) => {
      const g = el("linearGradient", { id, x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
      el("stop", { offset: "0%", "stop-color": a, "stop-opacity": 0.55 }, g);
      el("stop", { offset: "100%", "stop-color": b }, g);
    };
    gh("hAzul", COR.azul2, COR.azul);
    gh("hOuro", COR.ouro2, "#FFC766");
    const g = el("g", {}, svg),
      preenchimentos = [];
    const ordem = t.valor.map((v, i) => i),
      maxIdx = t.valor.indexOf(Math.max(...t.valor));
    ordem.forEach((i) => {
      const y = topoRef + i * linhaH,
        v = t.valor[i],
        e = i === maxIdx && n >= 3;
      el("rect", { x: x0, y: y + 11, width: tw, height: 14, rx: 7, fill: COR.trilho }, g);
      const f = el(
        "rect",
        {
          x: x0,
          y: y + 11,
          width: Math.max(6, (tw * v) / topo),
          height: 14,
          rx: 7,
          fill: `url(#${e ? "hOuro" : "hAzul"})`,
          class: "faixa",
          style: `animation-delay:${i * 50}ms`,
        },
        g,
      );
      if (e) f.setAttribute("filter", "drop-shadow(0 0 8px rgba(255,181,71,.35))");
      preenchimentos.push(f);
      const partes = quebrar(t.categoria[i], Math.floor(rotW / 7.2));
      txt(g, 0, y + 22 - (partes.length - 1) * 7, partes[0], {
        fill: e ? COR.texto : "#C9D2E6",
        "font-size": 13,
        "font-weight": e ? 700 : 500,
      });
      if (partes[1]) txt(g, 0, y + 36 - 7, partes[1], { fill: COR.mudo, "font-size": 11.5 });
      txt(g, w - 4, y + 23, fmt(v, un), {
        "text-anchor": "end",
        fill: e ? COR.ouro : COR.texto,
        "font-size": 13.5,
        "font-weight": 700,
      });
      const zona = el("rect", { x: 0, y, width: w, height: linhaH, fill: "transparent" }, svg);
      zona.addEventListener("mousemove", (ev) => {
        preenchimentos.forEach((p, j) => (p.style.opacity = j === i ? 1 : 0.5));
        const reg = t.n ? `<div class="dica-sub">${fmt(t.n[i], "n")} registros</div>` : "";
        const dif =
          it.referencia != null
            ? `<div class="dica-sub">${t.valor[i] >= it.referencia ? "+" : ""}${fmt(t.valor[i] - it.referencia, "pp")} vs média geral</div>`
            : "";
        mostrarDica(
          `<div class="dica-titulo">${esc(t.categoria[i])}</div>${linhaDica(e ? COR.ouro : COR.azul, "Valor", fmt(v, un))}${dif}${reg}`,
          ev,
        );
      });
      zona.addEventListener("mouseleave", () => {
        preenchimentos.forEach((p) => (p.style.opacity = 1));
        esconderDica();
      });
    });
    if (it.referencia != null) {
      const x = x0 + (tw * it.referencia) / topo;
      el(
        "line",
        {
          x1: x,
          x2: x,
          y1: topoRef - 6,
          y2: h - 6,
          stroke: COR.ouro,
          "stroke-dasharray": "5 5",
          "stroke-width": 1.4,
          opacity: 0.85,
        },
        g,
      );
      etiquetaRef(g, Math.min(Math.max(x, x0 + 70), w - valW - 50), 11, "Média " + fmt(it.referencia, un), "meio");
    }
  }

  // ------------------------------------------------------------ linha / área
  function linha(c, it, w, anim) {
    const t = it.tabela,
      un = it.unidade;
    if (t.serie) return linhaSerie(c, it, w, anim);
    const n = t.categoria.length,
      h = 360,
      m = { t: 40, r: 26, b: 38, l: 50 };
    const min = Math.min(...t.valor),
      max = Math.max(...t.valor, it.referencia || 0);
    const e = escalaPct(max * 1.06, un);
    const iw = w - m.l - m.r,
      ih = h - m.t - m.b;
    const X = (i) => m.l + (n === 1 ? iw / 2 : (iw * i) / (n - 1)),
      Y = (v) => m.t + ih * (1 - v / e.max);
    const { svg, defs } = base(c, w, h, anim);
    gradiente(defs, "gArea", COR.azul, COR.azul, 0.34, 0);
    const g = el("g", {}, svg);
    e.ticks.forEach((tk) => {
      el("line", { x1: m.l, x2: w - m.r, y1: Y(tk), y2: Y(tk), stroke: COR.grade }, g);
      txt(g, m.l - 10, Y(tk) + 4, fmtEixo(tk, un), { "text-anchor": "end", fill: COR.tenue, "font-size": 11.5 });
    });
    const pts = t.valor.map((v, i) => [X(i), Y(v)]);
    const d = curva(pts);
    el(
      "path",
      { d: d + `L${pts[n - 1][0]},${m.t + ih}L${pts[0][0]},${m.t + ih}Z`, fill: "url(#gArea)", class: "area" },
      g,
    );
    el("path", { d, fill: "none", stroke: COR.azul, "stroke-width": 7, opacity: 0.16, "stroke-linecap": "round" }, g);
    const tr = el(
      "path",
      {
        d,
        fill: "none",
        stroke: COR.azul,
        "stroke-width": 2.8,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        class: "tracado",
        pathLength: 1,
      },
      g,
    );
    if (it.referencia != null) {
      const y = Y(it.referencia);
      el("line", { x1: m.l, x2: w - m.r, y1: y, y2: y, stroke: COR.ouro, "stroke-dasharray": "5 5", opacity: 0.8 }, g);
      etiquetaRef(g, m.l + 6, y - 15 < m.t ? y + 16 : y - 15, "Média geral " + fmt(it.referencia, un), "esq");
    }
    const passo = Math.ceil(n / Math.max(2, Math.floor(iw / 90)));
    t.categoria.forEach((k, i) => {
      if (i % passo === 0 || i === n - 1)
        txt(g, X(i), h - 12, String(k).slice(0, 12), {
          "text-anchor": i === 0 ? "start" : i === n - 1 ? "end" : "middle",
          fill: COR.mudo,
          "font-size": 11.5,
        });
    });
    const iMax = t.valor.indexOf(Math.max(...t.valor)),
      ult = n - 1;
    [
      [iMax, COR.ouro, "Pico"],
      [ult, COR.azul, null],
    ].forEach(([i, cor, rot]) => {
      if (i === ult && i === iMax) return;
      el("circle", { cx: X(i), cy: Y(t.valor[i]), r: 9, fill: cor, opacity: 0.2 }, g);
      el("circle", { cx: X(i), cy: Y(t.valor[i]), r: 4.5, fill: cor, stroke: "#0D1322", "stroke-width": 2 }, g);
      txt(g, X(i), Y(t.valor[i]) - 16, (rot ? rot + " " : "") + fmt(t.valor[i], un), {
        "text-anchor": i === ult ? "end" : "middle",
        fill: cor,
        "font-size": 12.5,
        "font-weight": 700,
      });
    });
    if (iMax === ult) {
      el(
        "circle",
        { cx: X(ult), cy: Y(t.valor[ult]), r: 4.5, fill: COR.ouro, stroke: "#0D1322", "stroke-width": 2 },
        g,
      );
      txt(g, X(ult), Y(t.valor[ult]) - 16, "Pico " + fmt(t.valor[ult], un), {
        "text-anchor": "end",
        fill: COR.ouro,
        "font-size": 12.5,
        "font-weight": 700,
      });
    }
    const guia = el("line", { y1: m.t, y2: m.t + ih, stroke: COR.tenue, "stroke-dasharray": "3 4", opacity: 0 }, svg);
    const ponto = el("circle", { r: 5, fill: "#fff", stroke: COR.azul, "stroke-width": 2.5, opacity: 0 }, svg);
    const zona = el("rect", { x: m.l, y: m.t - 10, width: iw, height: ih + 20, fill: "transparent" }, svg);
    zona.addEventListener("mousemove", (ev) => {
      const r = svg.getBoundingClientRect(),
        px = (ev.clientX - r.left) * (w / r.width);
      const i = Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / iw) * (n - 1))));
      guia.setAttribute("x1", X(i));
      guia.setAttribute("x2", X(i));
      guia.setAttribute("opacity", 1);
      ponto.setAttribute("cx", X(i));
      ponto.setAttribute("cy", Y(t.valor[i]));
      ponto.setAttribute("opacity", 1);
      const reg = t.n ? `<div class="dica-sub">${fmt(t.n[i], "n")} registros</div>` : "";
      mostrarDica(
        `<div class="dica-titulo">${esc(t.categoria[i])}</div>${linhaDica(COR.azul, "Valor", fmt(t.valor[i], un))}${reg}`,
        ev,
      );
    });
    zona.addEventListener("mouseleave", () => {
      guia.setAttribute("opacity", 0);
      ponto.setAttribute("opacity", 0);
      esconderDica();
    });
  }

  // ------------------------------------------------------------ séries (empilhadas, agrupadas, linhas)
  function legenda(svgPai, nomes, x, y) {
    let cx = x;
    nomes.forEach((nm, i) => {
      el("circle", { cx: cx + 5, cy: y - 4, r: 5, fill: SERIES[i % SERIES.length] }, svgPai);
      const t = txt(svgPai, cx + 16, y, nm, { fill: COR.texto, "font-size": 12.5 });
      cx += 16 + nm.length * 7 + 22;
    });
  }
  function agrupar(it) {
    const t = it.tabela,
      cats = [...new Set(t.categoria)],
      sers = [...new Set(t.serie)];
    const val = {};
    t.categoria.forEach((k, i) => {
      val[k + "||" + t.serie[i]] = t.valor[i];
    });
    return { cats, sers, v: (k, s) => val[k + "||" + s] || 0 };
  }
  function empilhadas(c, it, w, anim, modo) {
    const { cats, sers, v } = agrupar(it),
      un = it.unidade,
      n = cats.length,
      h = 370;
    const m = { t: 52, r: 18, b: 40, l: 50 };
    const tot = cats.map((k) => sers.reduce((a, s) => a + v(k, s), 0));
    const topo = modo === "empilhadas" ? Math.max(...tot) : Math.max(...cats.flatMap((k) => sers.map((s) => v(k, s))));
    const e = escala(topo * 1.08),
      iw = w - m.l - m.r,
      ih = h - m.t - m.b,
      faixa = iw / n;
    const { svg, defs } = base(c, w, h, anim);
    sers.forEach((s, i) => {
      const cor = SERIES[i % SERIES.length];
      gradiente(defs, "gs" + i, cor, cor, 1, 0.55);
    });
    const g = el("g", {}, svg),
      Y = (val) => m.t + ih * (1 - val / e.max);
    legenda(g, sers, m.l, 22);
    e.ticks.forEach((tk) => {
      el("line", { x1: m.l, x2: w - m.r, y1: Y(tk), y2: Y(tk), stroke: COR.grade }, g);
      txt(g, m.l - 10, Y(tk) + 4, fmtEixo(tk, un), { "text-anchor": "end", fill: COR.tenue, "font-size": 11.5 });
    });
    const passo = Math.ceil(n / Math.max(2, Math.floor(iw / 62)));
    cats.forEach((k, i) => {
      const x0 = m.l + faixa * i,
        bw = Math.min(54, faixa * 0.62);
      if (i % passo === 0)
        txt(g, x0 + faixa / 2, h - 14, String(k).slice(0, 14), {
          "text-anchor": "middle",
          fill: COR.mudo,
          "font-size": 11.5,
        });
      let acc = 0;
      sers.forEach((s, j) => {
        const val = v(k, s);
        if (modo === "empilhadas") {
          const y = Y(acc + val),
            alt = Math.max(0, Y(acc) - y);
          acc += val;
          if (alt > 0)
            el(
              "rect",
              {
                x: x0 + (faixa - bw) / 2,
                y,
                width: bw,
                height: alt,
                rx: j === sers.length - 1 ? 5 : 1,
                fill: `url(#gs${j})`,
                class: "barra",
                style: `animation-delay:${i * 30}ms`,
              },
              g,
            );
        } else {
          const bw2 = Math.min(30, (faixa * 0.7) / sers.length),
            xx = x0 + faixa / 2 - (bw2 * sers.length) / 2 + bw2 * j,
            y = Y(val);
          el(
            "path",
            {
              d: topoArredondado(xx + 1, y, bw2 - 2, Math.max(2, m.t + ih - y), 6),
              fill: `url(#gs${j})`,
              class: "barra",
              style: `animation-delay:${i * 30}ms`,
            },
            g,
          );
        }
      });
      const zona = el("rect", { x: x0, y: m.t, width: faixa, height: ih, fill: "transparent" }, svg);
      zona.addEventListener("mousemove", (ev) =>
        mostrarDica(
          `<div class="dica-titulo">${esc(k)}</div>` +
            sers.map((s, j) => linhaDica(SERIES[j % SERIES.length], esc(s), fmt(v(k, s), un))).join(""),
          ev,
        ),
      );
      zona.addEventListener("mouseleave", esconderDica);
    });
  }
  function linhaSerie(c, it, w, anim) {
    const { cats, sers, v } = agrupar(it),
      un = it.unidade,
      n = cats.length,
      h = 360,
      m = { t: 52, r: 24, b: 38, l: 50 };
    const e = escala(Math.max(...cats.flatMap((k) => sers.map((s) => v(k, s)))) * 1.1),
      iw = w - m.l - m.r,
      ih = h - m.t - m.b;
    const X = (i) => m.l + (n === 1 ? iw / 2 : (iw * i) / (n - 1)),
      Y = (val) => m.t + ih * (1 - val / e.max);
    const { svg } = base(c, w, h, anim),
      g = el("g", {}, svg);
    legenda(g, sers, m.l, 22);
    e.ticks.forEach((tk) => {
      el("line", { x1: m.l, x2: w - m.r, y1: Y(tk), y2: Y(tk), stroke: COR.grade }, g);
      txt(g, m.l - 10, Y(tk) + 4, fmtEixo(tk, un), { "text-anchor": "end", fill: COR.tenue, "font-size": 11.5 });
    });
    sers.forEach((s, j) =>
      el(
        "path",
        {
          d: curva(cats.map((k, i) => [X(i), Y(v(k, s))])),
          fill: "none",
          stroke: SERIES[j % SERIES.length],
          "stroke-width": 2.8,
          "stroke-linecap": "round",
          class: "tracado",
          pathLength: 1,
        },
        g,
      ),
    );
    const passo = Math.ceil(n / Math.max(2, Math.floor(iw / 90)));
    cats.forEach((k, i) => {
      if (i % passo === 0)
        txt(g, X(i), h - 12, String(k).slice(0, 12), { "text-anchor": "middle", fill: COR.mudo, "font-size": 11.5 });
    });
  }

  // ------------------------------------------------------------ rosca
  function rosca(c, it, w, anim) {
    const t = it.tabela,
      un = it.unidade,
      n = t.valor.length,
      total = t.valor.reduce((a, b) => a + b, 0) || 1;
    const lado = w >= 520,
      tam = lado ? 280 : 250,
      h = lado ? 290 : tam + 30 + n * 30;
    const { svg } = base(c, w, h, anim),
      g = el("g", {}, svg);
    const cx = lado ? tam / 2 + 14 : w / 2,
      cy = tam / 2 + 6,
      r = tam / 2 - 26,
      circ = 2 * Math.PI * r,
      folga = n > 1 ? 4 : 0;
    el("circle", { cx, cy, r, fill: "none", stroke: COR.trilho, "stroke-width": 26 }, g);
    const maxIdx = t.valor.indexOf(Math.max(...t.valor));
    const centroGrande = txt(g, cx, cy + 8, nf(1).format((t.valor[maxIdx] / total) * 100) + "%", {
      "text-anchor": "middle",
      fill: COR.texto,
      "font-size": 40,
      "font-family": "var(--serif)",
    });
    const centroPeq = txt(g, cx, cy + 32, String(t.categoria[maxIdx]).slice(0, 24), {
      "text-anchor": "middle",
      fill: COR.mudo,
      "font-size": 12.5,
    });
    let acc = 0;
    const arcos = [];
    t.valor.forEach((v, i) => {
      const len = (v / total) * circ,
        cor = SERIES[i % SERIES.length];
      const a = el(
        "circle",
        {
          cx,
          cy,
          r,
          fill: "none",
          stroke: cor,
          "stroke-width": 26,
          "stroke-dasharray": `${Math.max(0, len - folga)} ${circ}`,
          "stroke-dashoffset": -acc,
          transform: `rotate(-90 ${cx} ${cy})`,
          class: "arco",
          style: `animation-delay:${i * 90}ms`,
          "stroke-linecap": "butt",
        },
        g,
      );
      arcos.push(a);
      acc += len;
      a.addEventListener("mousemove", (ev) => {
        arcos.forEach((o, j) => (o.style.opacity = j === i ? 1 : 0.45));
        centroGrande.textContent = nf(1).format((v / total) * 100) + "%";
        centroPeq.textContent = String(t.categoria[i]).slice(0, 24);
        mostrarDica(`<div class="dica-titulo">${esc(t.categoria[i])}</div>${linhaDica(cor, "Valor", fmt(v, un))}`, ev);
      });
      a.addEventListener("mouseleave", () => {
        arcos.forEach((o) => (o.style.opacity = 1));
        centroGrande.textContent = nf(1).format((t.valor[maxIdx] / total) * 100) + "%";
        centroPeq.textContent = String(t.categoria[maxIdx]).slice(0, 24);
        esconderDica();
      });
    });
    const lx = lado ? tam + 54 : 24,
      ly0 = lado ? Math.max(30, cy - (n * 34) / 2 + 10) : tam + 24;
    t.valor.forEach((v, i) => {
      const y = ly0 + i * 34,
        cor = SERIES[i % SERIES.length];
      el("rect", { x: lx, y: y - 11, width: 10, height: 10, rx: 3, fill: cor }, g);
      txt(g, lx + 20, y - 1, String(t.categoria[i]).slice(0, lado ? 30 : 34), {
        fill: COR.texto,
        "font-size": 13.5,
        "font-weight": 600,
      });
      txt(g, lx + 20, y + 15, fmt(v, un) + "  (" + nf(1).format((v / total) * 100) + "%)", {
        fill: COR.mudo,
        "font-size": 12,
      });
    });
  }

  // ------------------------------------------------------------ tabela
  function tabela(c, it) {
    const t = it.tabela,
      un = it.unidade,
      temSerie = !!t.serie,
      temN = !!t.n;
    const cab = ["Grupo"].concat(temSerie ? ["Categoria"] : [], ["Valor"], temN ? ["Registros"] : []);
    let html = `<div class="tabela-rolagem"><table class="tabela"><thead><tr>${cab.map((x, i) => `<th class="${i >= cab.length - (temN ? 2 : 1) ? "num" : ""}">${x}</th>`).join("")}</tr></thead><tbody>`;
    t.categoria.forEach((k, i) => {
      html += `<tr><td>${esc(k)}</td>${temSerie ? `<td>${esc(t.serie[i])}</td>` : ""}<td class="num">${fmt(t.valor[i], un)}</td>${temN ? `<td class="num">${fmt(t.n[i], "n")}</td>` : ""}</tr>`;
    });
    c.innerHTML = html + "</tbody></table></div>";
  }

  // ------------------------------------------------------------ entrada principal
  function desenhar(container, item, opcoes) {
    opcoes = opcoes || {};
    if (container._obs) container._obs.disconnect();
    let primeiro = opcoes.animar !== false,
      ultimaLargura = 0;
    const pintar = () => {
      const w = Math.max(300, Math.floor(container.clientWidth));
      if (!container.clientWidth) return;
      ultimaLargura = w;
      container.innerHTML = "";
      if (!item.tabela || !item.tabela.categoria.length) {
        container.textContent = "Sem dados para mostrar.";
        return;
      }
      const tipo = item.tipo,
        serie = !!item.tabela.serie;
      if (tipo === "tabela") tabela(container, item);
      else if (serie && tipo === "linha") linha(container, item, w, primeiro);
      else if (serie) empilhadas(container, item, w, primeiro, tipo === "barras" ? "agrupadas" : "empilhadas");
      else if (tipo === "rosca") rosca(container, item, w, primeiro);
      else if (tipo === "linha") linha(container, item, w, primeiro);
      else if (tipo === "barras_h") ranking(container, item, w, primeiro);
      else barras(container, item, w, primeiro);
      primeiro = false;
    };
    pintar();
    if (window.ResizeObserver) {
      let espera;
      container._obs = new ResizeObserver(() => {
        if (Math.abs(container.clientWidth - ultimaLargura) < 4) return;
        clearTimeout(espera);
        espera = setTimeout(pintar, 120);
      });
      container._obs.observe(container);
    }
  }

  window.Graficos = { desenhar, fmt, TIPOS, COR, esconderDica };
})();

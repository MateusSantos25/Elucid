/* Elucid: peças de interface compartilhadas entre o aplicativo e o painel exportado. */
(function () {
  const G = window.Graficos;

  function h(tag, props, ...filhos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "html") e.innerHTML = v; // somente textos fixos do próprio código
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const f of filhos.flat(Infinity)) if (f != null && f !== false) e.append(f.nodeType ? f : document.createTextNode(String(f)));
    return e;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const hoje = () => new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

  const CAMINHOS = {
    analise: '<path d="M4 18V11M10 18V5M16 18v-9M22 18v-5" transform="translate(-1 1)"/>',
    painel: '<rect x="3" y="3" width="8" height="10" rx="2"/><rect x="13" y="3" width="8" height="6" rx="2"/><rect x="13" y="11" width="8" height="10" rx="2"/><rect x="3" y="15" width="8" height="6" rx="2"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    escudo: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    baixar: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 20h16"/>',
    editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    mais: '<path d="M12 5v14M5 12h14"/>',
    ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    lixo: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
    esq: '<path d="M15 5l-7 7 7 7"/>', dir: '<path d="M9 5l7 7-7 7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>', enviar: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    troca: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>', ajustes: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    chave: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
    plano: '<path d="M5 4h14v16H5z"/><path d="M9 9h6M9 13h6M9 17h3"/>',
    expandir: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    tabela: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
    comparar: '<path d="M7 4v16M7 4L4 7M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3"/>',
    largura: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 12h8"/>',
    alca: '<g fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></g>',
  };
  function icone(nome, tam) {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", tam || 18); s.setAttribute("height", tam || 18);
    s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "1.9");
    s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round"); s.setAttribute("aria-hidden", "true");
    s.innerHTML = CAMINHOS[nome] || "";
    return s;
  }
  function marca() {
    return h("span", { html: '<svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="10" fill="#18223A"/><path d="M7 21.5l6-7.5 5 4 7-9" stroke="#6AA6FF" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="25" cy="9" r="3.2" fill="#FFB547"/></svg>' });
  }

  /** Logo grande da tela inicial: símbolo com brilho, nome e uma linha de apoio. */
  function logoHero(nome) {
    return h("div", { class: "logo-hero", role: "img", "aria-label": nome },
      h("span", { class: "logo-simbolo", html: '<svg width="112" height="112" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="lg-fundo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1F2C4D"/><stop offset="1" stop-color="#121B33"/></linearGradient><linearGradient id="lg-linha" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#6AA6FF"/><stop offset="1" stop-color="#A9CBFF"/></linearGradient></defs><rect x=".5" y=".5" width="31" height="31" rx="10" fill="url(#lg-fundo)" stroke="rgba(160,190,255,.28)"/><path class="logo-linha" d="M7 21.5l6-7.5 5 4 7-9" stroke="url(#lg-linha)" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/><circle class="logo-ponto" cx="25" cy="9" r="3.2" fill="#FFB547"/></svg>' }),
      h("span", { class: "logo-nome" }, nome),
      h("span", { class: "logo-sub" }, "Análise de dados em linguagem simples"));
  }

  // ---------- números em destaque
  function estatistica(it) {
    if (it.estat) return it.estat;
    const t = it.tabela;
    if (!t || t.serie || it.tipo === "tabela" || !t.valor.length) return null;
    if (it.ferramenta === "panorama_alvo" && t.valor.length === 2) {
      const total = t.valor[0] + t.valor[1];
      return { valor: G.fmt((t.valor[1] / total) * 100, "%"), rotulo: t.categoria[1], delta: null };
    }
    const i = t.valor.indexOf(Math.max(...t.valor)), v = t.valor[i];
    let delta = null;
    if (it.referencia != null && (it.unidade === "%" || it.unidade === "")) {
      const d = v - it.referencia;
      delta = (d >= 0 ? "+" : "") + G.fmt(d, it.unidade === "%" ? "pp" : "") + (it.unidade === "%" ? " da média" : "");
    }
    return { valor: G.fmt(v, it.unidade), rotulo: String(t.categoria[i]).slice(0, 34), delta };
  }
  function elStat(e) {
    if (!e) return null;
    return h("div", { class: "estat" }, h("div", { class: "estat-valor" }, e.valor), h("div", { class: "estat-rot" }, e.rotulo),
      e.delta ? h("span", { class: "estat-delta" }, e.delta) : null);
  }
  function kpisEl(kpis, destacarSegundo) {
    return h("div", { class: "kpis" }, (kpis || []).map((k, i) =>
      h("div", { class: "kpi" + (destacarSegundo && i === 1 ? " kpi-destaque" : "") }, h("div", { class: "kpi-valor" }, k[1]), h("div", { class: "kpi-rotulo" }, k[0]))));
  }

  // ---------- cartão de gráfico (base)
  function cartaoBase(it, opc) {
    opc = opc || {};
    const titulo = h("h3", { class: "cartao-titulo" + (opc.editavel ? " editavel" : "") }, it.titulo);
    const sub = h("p", { class: (opc.classeSub || "cartao-destaque") + (opc.editavel ? " editavel" : "") }, opc.subtitulo != null ? opc.subtitulo : it.destaque);
    const graf = h("div", { class: "grafico" });
    graf._item = it;
    const el = h("article", { class: "cartao" + (it.largura === "meia" ? "" : it.largura ? " inteira" : "") },
      h("div", { class: "cartao-topo" }, h("div", {}, titulo, sub), elStat(estatistica(it))), graf);
    return { el, graf, titulo, sub };
  }
  function desenharTodos(raiz) {
    raiz.querySelectorAll(".grafico").forEach((g) => { if (g._item) G.desenhar(g, g._item); });
  }


  // ---------- plano de ação (na tela, no painel, na apresentação e no arquivo exportado)
  const CEN = [["conservador", "Conservador", 15], ["realista", "Realista", 30], ["ambicioso", "Ambicioso", 50]];
  const ROT_ESFORCO = { baixo: "Esforço baixo", medio: "Esforço médio", alto: "Esforço alto" };
  function elCenarios(pl) {
    return h("div", { class: "plano-cens" }, CEN.map(([id, nome, parte]) => {
      const c = pl.combinado[id];
      return h("div", { class: "plano-cen" + (id === "realista" ? " destaque" : "") },
        h("span", { class: "plano-cen-nome" }, nome), h("span", { class: "plano-cen-valor" }, G.fmt(c.taxa_final, "%")),
        h("span", { class: "plano-cen-txt" }, `queda de ${G.fmt(c.queda_pp, "pp")}, cerca de ${G.fmt(Math.round(c.evitados), "n")} registros a menos`),
        h("span", { class: "plano-cen-premissa" }, `se evitar ${parte}% do excesso`));
    }));
  }
  /** `compacto`: só resumo, cenários e as ações com prazos (painel e apresentação). */
  function elPlano(pl, opc) {
    const compacto = !!(opc && opc.compacto), ia = pl.ia, ops = new Map(pl.itens.map((it) => [it.i, it]));
    const linha = (rot, txt) => (txt ? h("div", { class: "plano-linha" }, h("b", {}, rot), h("span", {}, txt)) : null);
    const acoes = ia.acoes.slice(0, compacto ? 4 : 99).map((a, k) => {
      const it = ops.get(a.oportunidade);
      const leitura = it && it.leitura_semanas ? `cerca de ${it.leitura_semanas} ${it.leitura_semanas === 1 ? "semana" : "semanas"} de piloto para ter dados suficientes` : "";
      return h("article", { class: "plano-acao" + (a.acionavel ? "" : " nao") },
        h("div", { class: "plano-acao-topo" }, h("span", { class: "plano-num" }, k + 1),
          h("div", {}, h("h4", {}, a.titulo || (it ? it.descricao : "Ação")),
            it ? h("p", { class: "plano-grupo" }, `${it.descricao} · ${G.fmt(it.n_total, "n")} registros · ${G.fmt(it.taxa_total, "%")} · ${G.fmt(it.pct_eventos, "%")} de todas as ocorrências`) : null),
          h("span", { class: "plano-tag" }, a.acionavel ? ROT_ESFORCO[a.esforco] : "Fora do controle da empresa")),
        compacto ? null : h("div", { class: "plano-detalhe" }, linha("O que fazer", a.o_que_fazer), linha("Por quê", a.por_que)),
        h("div", { class: "plano-prazos" },
          h("div", {}, h("small", {}, "Primeiros sinais"), h("b", {}, a.primeiros_sinais || "defina com a equipe")),
          h("div", {}, h("small", {}, "Resultado pleno"), h("b", {}, a.resultado_pleno || "defina com a equipe")),
          leitura && !compacto ? h("div", {}, h("small", {}, "Leitura do teste"), h("b", {}, leitura)) : null),
        compacto ? null : h("div", { class: "plano-detalhe" }, linha("Como medir", a.como_medir), linha("Responsável sugerido", a.responsavel), linha("Cuidados", a.riscos)));
    });
    const lista = (tit, arr) => (arr && arr.length ? h("section", { class: "plano-bloco" }, h("h5", {}, tit), h("ul", {}, arr.map((x) => h("li", {}, x)))) : null);
    return h("div", { class: "plano" + (compacto ? " compacto" : "") },
      h("p", { class: "plano-resumo" }, ia.resumo),
      h("p", { class: "plano-nota" }, `Hoje a taxa é de ${G.fmt(pl.taxa, "%")}. Fora dos grupos abaixo ela é de ${G.fmt(pl.baseline, "%")}. Cenários combinados, se todas as ações forem feitas:`),
      elCenarios(pl), h("p", { class: "plano-nota" }, "Os cenários são premissas, não previsões. Os prazos são estimativas para validar com a equipe."),
      h("div", { class: "plano-acoes" }, acoes),
      compacto ? null : [lista("Próximos 30 dias", ia.proximos_30_dias), lista("Premissas a confirmar", ia.premissas), lista("Perguntas para a equipe", ia.perguntas_para_equipe)]);
  }
  function cartaoPlano(it, opc) {
    opc = opc || {};
    const el = h("article", { class: "cartao inteira cartao-plano" }, h("div", { class: "cartao-topo" }, h("div", {}, h("span", { class: "plano-kicker" }, "Plano de ação"), h("h3", { class: "cartao-titulo" }, it.titulo || "O que fazer e quando ver resultado"))), elPlano(it.plano, { compacto: true }));
    return { el, graf: null, titulo: el.querySelector(".cartao-titulo"), sub: h("span") };
  }

  // ---------- texto do assistente (negrito e listas simples, sempre escapado)
  function renderTexto(texto) {
    const frag = document.createDocumentFragment();
    String(texto).split(/\n{2,}/).forEach((bloco) => {
      const p = h("p", {});
      bloco.split("\n").forEach((linha, i) => {
        if (i) p.append(document.createElement("br"));
        linha.replace(/^\s*[-*]\s+/, "• ").split(/(\*\*[^*]+\*\*)/).forEach((parte) => {
          if (/^\*\*[^*]+\*\*$/.test(parte)) p.append(h("strong", {}, parte.slice(2, -2)));
          else if (parte) p.append(parte);
        });
      });
      frag.append(p);
    });
    return frag;
  }

  // ---------- apresentação em tela cheia (no Elucid e também no arquivo exportado do painel)
  function apresentar(itens, tituloPainel, inicio) {
    if (!itens || !itens.length) return;
    let i = Math.max(0, Math.min(itens.length - 1, inicio || 0));
    const tela = h("div", { class: "apresentar", role: "dialog", "aria-label": "Apresentação" });
    document.body.append(tela);
    if (tela.requestFullscreen) tela.requestFullscreen().catch(() => {});
    const sair = () => { document.removeEventListener("keydown", tecla); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); G.esconderDica(); tela.remove(); };
    const ir = (d) => { i = Math.max(0, Math.min(itens.length - 1, i + d)); desenhar(); };
    function tecla(ev) { if (ev.key === "Escape") sair(); else if (ev.key === "ArrowRight" || ev.key === " " || ev.key === "PageDown") { ev.preventDefault(); ir(1); } else if (ev.key === "ArrowLeft" || ev.key === "PageUp") ir(-1); }
    document.addEventListener("keydown", tecla);
    document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && document.body.contains(tela)) sair(); }, { once: true });
    function desenhar() {
      const it = itens[i], graf = h("div", { class: "grafico" }); graf._item = it;
      const ehPlano = it.ferramenta === "plano", stat = elStat(estatistica(it));
      tela.replaceChildren(
        h("div", { class: "apresentar-topo" }, h("span", {}, `${tituloPainel}  ${i + 1} de ${itens.length}`), h("button", { class: "btn btn-fantasma btn-pequeno", onclick: sair }, icone("x", 16), "Sair (Esc)")),
        h("div", { class: "apresentar-palco" },
          h("div", { class: "cartao-topo" }, h("h2", { class: "apresentar-titulo" }, it.titulo), stat),
          h("div", { class: "apresentar-grafico" }, ehPlano ? elPlano(it.plano, { compacto: true }) : graf),
          it.legenda && !ehPlano ? h("p", { class: "apresentar-legenda" }, it.legenda) : h("span")),
        h("div", { class: "apresentar-pe" },
          h("div", { class: "pontos" }, itens.map((_, k) => h("i", { class: k === i ? "ativo" : "" }))),
          h("div", { class: "painel-acoes" },
            h("button", { class: "btn", "aria-label": "Anterior", disabled: i === 0, onclick: () => ir(-1) }, icone("esq", 16)),
            h("button", { class: "btn btn-primario", "aria-label": "Próximo", disabled: i === itens.length - 1, onclick: () => ir(1) }, icone("dir", 16)))));
      if (!ehPlano) G.desenhar(graf, it);
    }
    desenhar();
  }

  window.Comum = { h, esc, hoje, icone, marca, logoHero, apresentar, estatistica, elStat, kpisEl, cartaoBase, cartaoPlano, elPlano, desenharTodos, renderTexto };
})();

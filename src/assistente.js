/* Elucid: conversa com o Gemini direto do navegador.
   O Gemini recebe só o ESQUEMA da base (nomes e resumos das colunas, nunca as linhas), escolhe as
   análises em um plano JSON, este código as executa e o Gemini explica os números calculados. */
(function () {
  const A = (globalThis.Elucid = globalThis.Elucid || {});
  const U = A.util || require("./util.js");
  const AN = A.analises || require("./analises.js");
  const D = A.dados || require("./dados.js");
  const { fmtInt, fmtNum, fmtPct } = U;
  const NOME = "Elucid", MAX_FERRAMENTAS = 3, MAX_HISTORICO = 6;
  const URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";

  class ErroChave extends Error { constructor(m) { super(m || "Falta a chave do Gemini."); this.name = "ErroChave"; } }
  class ErroGemini extends Error { constructor(m) { super(m); this.name = "ErroGemini"; } }
  let fetchImpl = (...a) => globalThis.fetch(...a);
  const modelo = () => globalThis.ELUCID_MODELO || "gemini-3.5-flash-lite";
  // Modo servidor: quando o Elucid está publicado com a função da Netlify, a chave fica lá e a equipe só digita uma senha.
  let proxy = null;
  const senha = () => String((globalThis.localStorage && globalThis.localStorage.getItem("elucid_senha")) || "").trim();
  async function detectarServidor() {
    proxy = null;
    if (chave()) return false; // quem já tem a própria chave usa a chave
    const url = globalThis.ELUCID_PROXY || "/api/gemini";
    if (!globalThis.ELUCID_PROXY && !/^https?:$/.test((globalThis.location && globalThis.location.protocol) || "")) return false;
    try {
      const r = await fetchImpl(url, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(3500) });
      if (!r.ok) return false;
      const j = await r.json();
      if (j && j.elucid === "proxy") { proxy = { url }; return true; }
    } catch (e) { /* sem servidor: segue no modo da chave */ }
    return false;
  }
  function chave() {
    const c = globalThis.ELUCID_CHAVE || (globalThis.localStorage && globalThis.localStorage.getItem("elucid_chave")) || "";
    return String(c).trim();
  }

  // ------------------------------------------------------------ esquema e prompts
  function descreverEsquema(ctx) {
    const df = ctx.df, L = [`A base tem ${fmtInt(df.n)} linhas e ${df.nomes.length} colunas.`];
    L.push(ctx.temAlvo
      ? `Coluna investigada: "${ctx.alvo}". O evento é ${ctx.rotuloEvento} (taxa geral: ${fmtPct(ctx.taxaGeral)}).`
      : "Nenhuma coluna a investigar foi escolhida: análises de causa não estão disponíveis.");
    for (const nome of df.nomes) {
      const c = df.col[nome], un = AN.valoresUnicos(c), vazios = (c.tipo === "texto" ? c.v.filter((x) => x == null).length : c.v.filter((x) => Number.isNaN(x)).length) / df.n * 100;
      let desc;
      if (ctx.ignoradas.includes(nome)) desc = "identificador (ignorada nas análises)";
      else if (c.tipo === "data") {
        const v = Array.from(c.v).filter((x) => !Number.isNaN(x)), f = (ms) => new Date(ms).toISOString().slice(0, 10).split("-").reverse().join("/");
        desc = `data, de ${f(Math.min(...v))} a ${f(Math.max(...v))}`;
      } else if (c.tipo === "numero") {
        const v = Array.from(c.v).filter((x) => !Number.isNaN(x)).sort((a, b) => a - b);
        desc = un.size <= 5 ? "número, valores: " + AN.ordenarValores([...un]).map((x) => fmtNum(x, Number.isInteger(x) ? 0 : 2)).join(", ")
          : `número, de ${fmtNum(v[0], 2)} a ${fmtNum(v[v.length - 1], 2)}, mediana ${fmtNum(v[Math.floor((v.length - 1) / 2)], 2)}`;
      } else { desc = `texto, ${un.size} valores distintos`; if (un.size <= 12) desc += ": " + [...un].join(", "); }
      if (vazios > 0) desc += `; ${Math.round(vazios)}% vazios`;
      L.push(`- "${nome}": ${desc}`);
    }
    return L.join("\n");
  }
  const PROMPT_PLANO = `Você é @@NOME@@, analista de dados que ajuda gestores a entender uma base em linguagem simples.
Você não vê as linhas da base, só o esquema abaixo. Para responder, escolha ferramentas de análise: elas fazem todos os cálculos.

ESQUEMA DA BASE
@@ESQUEMA@@

FERRAMENTAS
@@FERRAMENTAS@@

Responda SOMENTE com um JSON válido, sem texto antes ou depois, neste formato:
{"resposta_direta": null, "ferramentas": [{"nome": "taxa_por_coluna", "parametros": {"coluna": "exemplo"}}]}

Regras:
- Use de 1 a @@MAX@@ ferramentas e escreva os nomes das colunas exatamente como no esquema.
- Para perguntas do tipo "por que" ou "o que está acontecendo", combine ranking_fatores, segmentos_de_risco e taxa_por_coluna da coluna mais relevante.
- Se for só uma saudação, uma dúvida sobre o que você consegue fazer, ou se faltar informação para analisar, escreva a resposta curta em português em "resposta_direta" e deixe "ferramentas" vazio.
- Se a ferramenta comparar_periodos estiver na lista, use-a para perguntas sobre o que mudou em relação ao período anterior.
- Nunca invente números.`;
  const PROMPT_EXPLICACAO = `Você é @@NOME@@, analista de dados. Explique os resultados abaixo para um gestor, em português claro, em no máximo 5 frases curtas.
Use SOMENTE os números fornecidos. Destaque o que merece atenção e, se fizer sentido, sugira uma ação prática.
Não use tabelas nem listas longas: os gráficos já aparecem na tela. Não mencione ferramentas, JSON nem detalhes técnicos.`;
  const promptPlano = (ctx) => PROMPT_PLANO.replace("@@NOME@@", NOME).replace("@@ESQUEMA@@", descreverEsquema(ctx)).replace("@@FERRAMENTAS@@", AN.descricaoFerramentas(ctx)).replace("@@MAX@@", String(MAX_FERRAMENTAS));

  // ------------------------------------------------------------ Gemini
  async function pedir(corpo, k) {
    let r;
    try {
      r = proxy
        ? await fetchImpl(proxy.url, { method: "POST", headers: { "Content-Type": "application/json", "x-elucid-senha": senha() }, body: JSON.stringify(corpo) })
        : await fetchImpl(`${URL_BASE}${encodeURIComponent(modelo())}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": k }, body: JSON.stringify(corpo) });
    } catch (e) { throw new ErroGemini("Não consegui falar com o Gemini. Confira a conexão com a internet e tente de novo."); }
    if (r.ok) return r.json();
    let msg = ""; try { msg = (await r.json()).error.message || ""; } catch (e) { /* sem corpo */ }
    if (proxy) { // as mensagens do servidor já vêm em português simples
      if (r.status === 401) throw new ErroChave("A senha da equipe não confere.");
      const e = new ErroGemini(msg || "O assistente não conseguiu responder agora. Tente novamente em instantes."); e.status = r.status; throw e;
    }
    const falhaChave = r.status === 401 || r.status === 403 || /api key|API_KEY/i.test(msg);
    if (falhaChave) throw new ErroGemini("O Gemini não aceitou a chave. Confira se ela está correta no botão “Chave do Gemini”.");
    if (r.status === 404) throw new ErroGemini(`O modelo “${modelo()}” não foi encontrado. Troque o nome em segredos.js (ELUCID_MODELO).`);
    if (r.status === 429) throw new ErroGemini("O Gemini recebeu pedidos demais agora. Espere um instante e tente de novo.");
    const erro = new ErroGemini("O Gemini não conseguiu responder agora. Tente novamente em instantes."); erro.status = r.status; throw erro;
  }
  async function chamar(mensagens, temperatura, json) {
    const k = proxy ? "servidor" : chave();
    if (proxy ? !senha() : !k) throw new ErroChave(proxy ? "Falta a senha da equipe." : undefined);
    const sistema = mensagens.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const corpo = { contents: mensagens.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })), generationConfig: { temperature: temperatura } };
    if (sistema) corpo.systemInstruction = { parts: [{ text: sistema }] };
    let dado;
    if (json) {
      corpo.generationConfig.responseMimeType = "application/json";
      try { dado = await pedir(corpo, k); }
      catch (e) { if (e.status !== 400) throw e; delete corpo.generationConfig.responseMimeType; dado = await pedir(corpo, k); }
    } else dado = await pedir(corpo, k);
    const partes = (((dado.candidates || [])[0] || {}).content || {}).parts || [];
    return partes.map((p) => p.text || "").join("").trim();
  }
  function extrairJson(texto) {
    texto = String(texto).trim().replace(/^```(?:json)?|```$/gm, "").trim();
    const a = texto.indexOf("{"), b = texto.lastIndexOf("}");
    if (a < 0 || b <= a) return null;
    try { const d = JSON.parse(texto.slice(a, b + 1)); return d && typeof d === "object" && !Array.isArray(d) ? d : null; } catch (e) { return null; }
  }
  async function planejar(ctx, historico, pergunta) {
    const msgs = [{ role: "system", content: promptPlano(ctx) }, ...historico, { role: "user", content: pergunta }];
    for (let t = 0; t < 2; t++) {
      const texto = await chamar(msgs, 0.1, true), plano = extrairJson(texto);
      if (plano) return plano;
      msgs.push({ role: "assistant", content: texto || "(vazio)" }, { role: "user", content: "Responda somente com o JSON, sem mais nada." });
    }
    return null;
  }
  async function explicar(pergunta, resultados) {
    const blocos = resultados.map((r) => `### ${r.titulo}\n${r.resumo}`).join("\n\n").slice(0, 7000);
    return chamar([{ role: "system", content: PROMPT_EXPLICACAO.replace("@@NOME@@", NOME) },
      { role: "user", content: `Pergunta do gestor: ${pergunta}\n\nResultados calculados:\n${blocos}` }], 0.3, false);
  }

  // ------------------------------------------------------------ interface com o app
  function executarPlano(ctx, ferramentas) {
    const resultados = [], avisos = [];
    for (const p of (Array.isArray(ferramentas) ? ferramentas : []).slice(0, MAX_FERRAMENTAS)) {
      if (!p || typeof p !== "object") continue;
      try { resultados.push(AN.executar(ctx, String(p.nome || ""), p.parametros && typeof p.parametros === "object" ? p.parametros : {})); }
      catch (e) { if (e instanceof AN.ErroAnalise) avisos.push(e.message); else throw e; }
    }
    return { resultados, avisos };
  }
  const textoSemIa = (rs) => rs.map((r) => r.destaque).filter(Boolean).join("\n\n") || "Aqui estão os resultados.";
  async function responder(ctx, historico, pergunta) {
    const plano = await planejar(ctx, historico.slice(-MAX_HISTORICO), pergunta);
    if (!plano) return { texto: "Não consegui entender o pedido. Pode reformular a pergunta?", resultados: [] };
    const ferr = Array.isArray(plano.ferramentas) ? plano.ferramentas : [];
    if (!ferr.length) return { texto: String(plano.resposta_direta || "Pode me dizer um pouco mais sobre o que quer saber?"), resultados: [] };
    const { resultados, avisos } = executarPlano(ctx, ferr);
    if (!resultados.length) return { texto: "Não consegui montar essa análise. " + avisos.join(" "), resultados: [] };
    let texto;
    try { texto = (await explicar(pergunta, resultados)) || textoSemIa(resultados); }
    catch (e) { if (e instanceof ErroChave) throw e; texto = textoSemIa(resultados); }
    if (avisos.length) texto += "\n\n" + avisos.join(" ");
    return { texto, resultados };
  }
  function analiseRapida(ctx, nomes) {
    const { resultados, avisos } = executarPlano(ctx, nomes.map((n) => ({ nome: n, parametros: {} })));
    if (!resultados.length) return { texto: avisos.join(" ") || "Não consegui montar essa análise.", resultados: [] };
    return { texto: textoSemIa(resultados) + (avisos.length ? "\n\n" + avisos.join(" ") : ""), resultados };
  }
  A.assistente = { NOME, MAX_HISTORICO, chamar, extrairJson, explicar, ErroChave, ErroGemini, chaveConfigurada: () => (proxy ? !!senha() : !!chave()), modoServidor: () => !!proxy, detectarServidor, salvarSenha: (v) => { try { v ? globalThis.localStorage.setItem("elucid_senha", String(v).trim()) : globalThis.localStorage.removeItem("elucid_senha"); } catch (e) { /* sem armazenamento */ } }, senhaSalva: senha, descreverEsquema, extrairJson, responder, analiseRapida, definirFetch: (f) => { fetchImpl = f; } };
  if (typeof module !== "undefined") module.exports = A.assistente;
})();

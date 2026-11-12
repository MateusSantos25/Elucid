/* Elucid: leitura de arquivos (CSV, Excel .xlsx, JSON) no próprio navegador e ajuste de tipos.
   Tabela interna: { n, nomes: [...], col: { nome: { tipo: "numero"|"texto"|"data", v } } }
   numero e data usam Float64Array (NaN = vazio); texto usa Array (null = vazio). */
(function () {
  const A = (globalThis.Elucid = globalThis.Elucid || {});
  const EXTENSOES = ["csv", "tsv", "txt", "xlsx", "xlsm", "json"];
  const NAS = new Set([
    "",
    "#N/A",
    "#N/A N/A",
    "#NA",
    "-1.#IND",
    "-1.#QNAN",
    "-NaN",
    "-nan",
    "1.#IND",
    "1.#QNAN",
    "<NA>",
    "N/A",
    "NA",
    "NULL",
    "NaN",
    "None",
    "n/a",
    "nan",
    "null",
  ]);
  const REGEX_DATA = /^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

  const ext = (nome) => (nome.includes(".") ? nome.toLowerCase().split(".").pop() : "");
  const ehNulo = (c, i) => (c.tipo === "texto" ? c.v[i] == null : Number.isNaN(c.v[i]));

  // ------------------------------------------------------------ CSV
  function decodificar(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(u8).replace(/^\uFEFF/, "");
    } catch (e) {
      return new TextDecoder("windows-1252").decode(u8);
    }
  }
  function detectarSeparador(texto) {
    const linhas = texto
      .split("\n", 6)
      .slice(0, 5)
      .filter((l) => l.trim());
    let melhor = ",",
      pontos = -1;
    for (const sep of [",", ";", "\t", "|"]) {
      const cont = linhas.map((l) => l.split(sep).length - 1);
      if (cont.length && Math.min(...cont) > 0 && new Set(cont).size === 1 && cont[0] > pontos) {
        melhor = sep;
        pontos = cont[0];
      }
    }
    return melhor;
  }
  function lerCsv(texto) {
    const sep = detectarSeparador(texto),
      linhas = [],
      n = texto.length;
    let linha = [],
      i = 0;
    while (i < n) {
      let campo;
      if (texto[i] === '"') {
        let j = i + 1;
        campo = "";
        for (;;) {
          const k = texto.indexOf('"', j);
          if (k < 0) {
            campo += texto.slice(j);
            j = n;
            break;
          }
          campo += texto.slice(j, k);
          if (texto[k + 1] === '"') {
            campo += '"';
            j = k + 2;
          } else {
            j = k + 1;
            break;
          }
        }
        i = j;
        while (i < n && texto[i] !== sep && texto[i] !== "\n") i++;
      } else {
        let j = i;
        while (j < n && texto[j] !== sep && texto[j] !== "\n") j++;
        campo = texto.slice(i, j);
        i = j;
        if (campo.endsWith("\r")) campo = campo.slice(0, -1);
      }
      linha.push(campo);
      if (i >= n || texto[i] === "\n") {
        linhas.push(linha);
        linha = [];
      }
      i++;
    }
    if (linha.length) linhas.push(linha);
    return linhas;
  }

  // ------------------------------------------------------------ ZIP e XLSX
  async function inflar(bytes) {
    const resp = new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw")));
    return new Uint8Array(await resp.arrayBuffer());
  }
  function lerZip(buf) {
    const u8 = new Uint8Array(buf),
      dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength),
      entradas = new Map();
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--)
      if (dv.getUint32(i, true) === 0x06054b50) {
        eocd = i;
        break;
      }
    if (eocd < 0) throw new Error("Este arquivo não parece ser uma planilha .xlsx válida.");
    let p = dv.getUint32(eocd + 16, true);
    const total = dv.getUint16(eocd + 10, true),
      dec = new TextDecoder();
    for (let k = 0; k < total; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const metodo = dv.getUint16(p + 10, true),
        comp = dv.getUint32(p + 20, true);
      const nl = dv.getUint16(p + 28, true),
        el = dv.getUint16(p + 30, true),
        cl = dv.getUint16(p + 32, true),
        off = dv.getUint32(p + 42, true);
      entradas.set(dec.decode(u8.subarray(p + 46, p + 46 + nl)), { metodo, comp, off });
      p += 46 + nl + el + cl;
    }
    const ler = async (nome) => {
      const e = entradas.get(nome);
      if (!e) return null;
      const nl = dv.getUint16(e.off + 26, true),
        el = dv.getUint16(e.off + 28, true),
        ini = e.off + 30 + nl + el;
      const dados = u8.subarray(ini, ini + e.comp);
      return dec.decode(e.metodo === 0 ? dados : await inflar(dados));
    };
    return { ler, tem: (n) => entradas.has(n), nomes: [...entradas.keys()] };
  }
  const ENT = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
  const xmlTexto = (s) =>
    s.replace(/&(amp|lt|gt|quot|apos);|&#(\d+);|&#x([0-9a-f]+);/gi, (m, a, d, x) =>
      a ? ENT[m] : String.fromCodePoint(d ? +d : parseInt(x, 16)),
    );
  const colunaIdx = (ref) => {
    let n = 0;
    for (const c of ref.replace(/\d+/g, "")) n = n * 26 + c.charCodeAt(0) - 64;
    return n - 1;
  };
  const attr = (s, nome) => {
    const m = new RegExp(`\\b${nome}="([^"]*)"`).exec(s);
    return m ? m[1] : null;
  };
  function formatoEhData(id, codigo) {
    if ((id >= 14 && id <= 22) || (id >= 27 && id <= 36) || (id >= 45 && id <= 47) || (id >= 50 && id <= 58))
      return true;
    if (!codigo) return false;
    const limpo = codigo
      .toLowerCase()
      .replace(/"[^"]*"/g, "")
      .replace(/\[[^\]]*\]/g, "")
      .replace(/\\./g, "");
    return /[ymdhs]/.test(limpo) && !/general/.test(limpo);
  }
  async function abrirXlsx(buf) {
    const zip = lerZip(buf);
    const wb = await zip.ler("xl/workbook.xml");
    if (!wb) throw new Error("Este arquivo não parece ser uma planilha .xlsx válida.");
    const rels = (await zip.ler("xl/_rels/workbook.xml.rels")) || "",
      alvos = {};
    for (const m of rels.matchAll(/<Relationship\b([^>]*)>/g)) alvos[attr(m[1], "Id")] = attr(m[1], "Target");
    const abas = [];
    for (const m of wb.matchAll(/<sheet\b([^>]*)>/g)) {
      let alvo = alvos[attr(m[1], "r:id")] || "";
      alvo = alvo.startsWith("/") ? alvo.slice(1) : "xl/" + alvo;
      abas.push({ nome: xmlTexto(attr(m[1], "name") || "Planilha"), arquivo: alvo });
    }
    if (!abas.length) throw new Error("Não encontrei nenhuma aba nesta planilha.");
    return {
      abas: abas.map((a) => a.nome),
      async ler(nomeAba) {
        const aba = abas.find((a) => a.nome === nomeAba) || abas[0];
        const ss = [],
          xmlSS = await zip.ler("xl/sharedStrings.xml");
        if (xmlSS)
          for (const si of xmlSS.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
            let t = "";
            for (const m of si[1].replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))
              t += m[1];
            ss.push(xmlTexto(t));
          }
        const datas = [],
          xmlEst = await zip.ler("xl/styles.xml");
        if (xmlEst) {
          const fmts = {};
          for (const m of xmlEst.matchAll(/<numFmt\b([^>]*)\/?>/g))
            fmts[attr(m[1], "numFmtId")] = xmlTexto(attr(m[1], "formatCode") || "");
          const bloco = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xmlEst);
          if (bloco)
            for (const m of bloco[1].matchAll(/<xf\b([^>]*)/g)) {
              const id = +attr(m[1], "numFmtId");
              datas.push(formatoEhData(id, fmts[id]));
            }
        }
        const xml = await zip.ler(aba.arquivo);
        if (!xml) throw new Error("Não consegui ler esta aba da planilha.");
        const linhas = [];
        for (const lm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
          const ri = (+attr(lm[1], "r") || linhas.length + 1) - 1,
            linha = [];
          for (const cm of (lm[2] || "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
            const a = cm[1],
              corpo = cm[2] || "",
              tipo = attr(a, "t"),
              ref = attr(a, "r"),
              est = attr(a, "s");
            const ci = ref ? colunaIdx(ref) : linha.length;
            const v = /<v>([\s\S]*?)<\/v>/.exec(corpo);
            let val = null;
            if (tipo === "s" && v) val = ss[+v[1]];
            else if (tipo === "inlineStr") {
              let t = "";
              for (const m of corpo.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) t += m[1];
              val = xmlTexto(t);
            } else if (tipo === "str" && v) val = xmlTexto(v[1]);
            else if (tipo === "b" && v) val = v[1] === "1" ? "true" : "false";
            else if (tipo === "e") val = null;
            else if (v && v[1] !== "") {
              const num = parseFloat(v[1]);
              val = Number.isNaN(num) ? null : datas[+est] ? new Date(Math.round((num - 25569) * 86400000)) : num;
            }
            linha[ci] = val === undefined ? null : val;
          }
          linhas[ri] = linha;
        }
        return Array.from(linhas, (l) => l || []);
      },
    };
  }

  // ------------------------------------------------------------ inferência de tipos
  function comoNumero(txt) {
    if (/^0\d+$/.test(txt)) return null;
    let s = txt.replace(/[R$\s%]/g, "");
    const v = s.lastIndexOf(","),
      p = s.lastIndexOf(".");
    if (v >= 0 && p >= 0) s = v > p ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
    else if (v >= 0) s = s.replace(",", ".");
    return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s) ? parseFloat(s) : null;
  }
  function comoData(txt) {
    const m = REGEX_DATA.exec(txt);
    if (!m) return NaN;
    let a = +m[1],
      b = +m[2],
      c = +m[3],
      ano,
      mes,
      dia;
    if (m[1].length === 4) {
      ano = a;
      mes = b;
      dia = c;
    } else {
      dia = a;
      mes = b;
      ano = c < 100 ? 2000 + c : c;
      if (mes > 12 && dia <= 12) {
        [dia, mes] = [mes, dia];
      }
    }
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return NaN;
    return Date.UTC(ano, mes - 1, dia, +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  }
  function inferirColuna(brutos) {
    const n = brutos.length,
      limpos = new Array(n);
    let numeros = 0,
      datas = 0,
      textos = 0;
    for (let i = 0; i < n; i++) {
      let v = brutos[i];
      if (typeof v === "string") {
        v = v.trim();
        if (NAS.has(v)) v = null;
      } else if (typeof v === "number" && Number.isNaN(v)) v = null;
      else if (typeof v === "boolean") v = String(v);
      limpos[i] = v;
      if (v == null) continue;
      if (typeof v === "number") numeros++;
      else if (v instanceof Date) datas++;
      else textos++;
    }
    const naoNulos = numeros + datas + textos;
    if (naoNulos === 0) return null;
    if (numeros === naoNulos) return { tipo: "numero", v: Float64Array.from(limpos, (x) => (x == null ? NaN : x)) };
    if (datas === naoNulos)
      return { tipo: "data", v: Float64Array.from(limpos, (x) => (x == null ? NaN : x.getTime())) };
    const txt = limpos.map((x) =>
      x == null ? null : x instanceof Date ? x.toISOString().slice(0, 10) : String(x).trim(),
    );
    const amostra = txt.filter((x) => x != null).slice(0, 200);
    if (amostra.filter((x) => REGEX_DATA.test(x)).length >= 0.9 * amostra.length) {
      const d = Float64Array.from(txt, (x) => (x == null ? NaN : comoData(x)));
      let ok = 0;
      for (const x of d) if (!Number.isNaN(x)) ok++;
      if (ok >= 0.9 * naoNulos) return { tipo: "data", v: d };
    }
    const nums = new Float64Array(n);
    let ok = 0;
    for (let i = 0; i < n; i++) {
      if (txt[i] == null) {
        nums[i] = NaN;
        continue;
      }
      const x = comoNumero(txt[i]);
      if (x == null) {
        nums[i] = NaN;
        if (/^0\d+$/.test(txt[i])) {
          ok = -1e12;
        }
      } else {
        nums[i] = x;
        ok++;
      }
    }
    if (ok >= 0.95 * naoNulos) return { tipo: "numero", v: nums };
    return { tipo: "texto", v: txt };
  }
  function nomesUnicos(cab) {
    const usados = new Map();
    return cab.map((c, i) => {
      let nome = (c == null ? "" : String(c)).trim() || `coluna_${i + 1}`;
      const k = usados.get(nome) || 0;
      usados.set(nome, k + 1);
      return k ? `${nome}_${k + 1}` : nome;
    });
  }
  function construirTabela(linhas) {
    if (!linhas.length) throw new Error("O arquivo está vazio.");
    const nomes0 = nomesUnicos(linhas[0].length ? linhas[0] : []),
      dados = linhas.slice(1);
    const largura = Math.max(nomes0.length, ...dados.slice(0, 2000).map((l) => l.length));
    const nomes = nomes0.concat(
      Array.from({ length: largura - nomes0.length }, (_, k) => `coluna_${nomes0.length + k + 1}`),
    );
    const cols = nomes.map((_, j) => inferirColuna(dados.map((l) => l[j])));
    const vivas = nomes.map((_, j) => j).filter((j) => cols[j]);
    const n = dados.length,
      manter = [];
    for (let i = 0; i < n; i++) {
      let vazio = true;
      for (const j of vivas)
        if (!ehNulo(cols[j], i)) {
          vazio = false;
          break;
        }
      if (!vazio) manter.push(i);
    }
    if (!manter.length || !vivas.length) throw new Error("O arquivo está vazio.");
    const t = { n: manter.length, nomes: vivas.map((j) => nomes[j]), col: {} };
    for (const j of vivas) {
      const c = cols[j],
        sub =
          manter.length === n
            ? c.v
            : c.tipo === "texto"
              ? manter.map((i) => c.v[i])
              : Float64Array.from(manter, (i) => c.v[i]);
      t.col[nomes[j]] = { tipo: c.tipo, v: sub };
    }
    return t;
  }
  function subconjunto(t, idx) {
    const r = { n: idx.length, nomes: t.nomes.slice(), col: {} };
    for (const nome of t.nomes) {
      const c = t.col[nome];
      r.col[nome] = {
        tipo: c.tipo,
        v: c.tipo === "texto" ? idx.map((i) => c.v[i]) : Float64Array.from(idx, (i) => c.v[i]),
      };
    }
    return r;
  }

  // ------------------------------------------------------------ entrada pública
  async function abrir(buffer, nome) {
    const e = ext(nome);
    if (e === "xls") throw new Error("Arquivos .xls antigos não são aceitos. Abra no Excel e salve como .xlsx.");
    if (!EXTENSOES.includes(e)) throw new Error(`O formato “.${e}” não é suportado. Use: Excel (.xlsx), CSV ou JSON.`);
    if (e === "xlsx" || e === "xlsm") {
      const wb = await abrirXlsx(buffer);
      return { abas: wb.abas, ler: async (aba) => construirTabela(await wb.ler(aba)) };
    }
    if (e === "json") {
      return {
        abas: [],
        ler: async () => {
          let dado = JSON.parse(decodificar(buffer));
          if (!Array.isArray(dado)) dado = Object.values(dado).find(Array.isArray) || [dado];
          const cab = [...new Set(dado.flatMap((o) => Object.keys(o || {})))];
          return construirTabela([
            cab,
            ...dado.map((o) =>
              cab.map((k) => {
                const v = o ? o[k] : null;
                return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
              }),
            ),
          ]);
        },
      };
    }
    return { abas: [], ler: async () => construirTabela(lerCsv(decodificar(buffer))) };
  }
  A.dados = { EXTENSOES, abrir, construirTabela, subconjunto, ehNulo, lerCsv, comoNumero, comoData };
  if (typeof module !== "undefined") module.exports = A.dados;
})();

// Elucid: ponte entre o navegador da equipe e o Gemini.
// A chave do Gemini fica SÓ aqui, no servidor (variável de ambiente GEMINI_API_KEY). Quem usa o Elucid digita
// apenas a senha da equipe (ELUCID_SENHA) e nunca vê nem precisa criar uma chave.
//
// Variáveis de ambiente (painel da Netlify, escopo "Functions"):
//   GEMINI_API_KEY   obrigatória  chave do Gemini (Google AI Studio)
//   ELUCID_SENHA      obrigatória  senha que a equipe digita no Elucid
//   ELUCID_MODELO     opcional     padrão: gemini-3.5-flash-lite
//   ELUCID_LIMITE     opcional     pedidos por minuto, por pessoa (padrão 30)
//   ELUCID_ORIGEM     opcional     só se o elucid.html for aberto fora do site: endereços permitidos, separados por vírgula
import { createHash, timingSafeEqual } from "node:crypto";

const JSON_HDR = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
const MAX_CORPO = 300_000, MAX_TEXTO = 160_000, MAX_SISTEMA = 60_000;
const memoria = (globalThis.__elucidMemoria ??= { pedidos: new Map(), falhas: new Map() });

const resposta = (status, corpo, extra = {}) => new Response(JSON.stringify(corpo), { status, headers: { ...JSON_HDR, ...extra } });
const erro = (status, mensagem, extra) => resposta(status, { error: { message: mensagem } }, extra);
const hash = (s) => createHash("sha256").update(String(s)).digest();
const senhaConfere = (dada, certa) => timingSafeEqual(hash(dada), hash(certa));

function cors(req) {
  const permitidas = (process.env.ELUCID_ORIGEM || "").split(",").map((x) => x.trim()).filter(Boolean), origem = req.headers.get("origin");
  if (!origem || !permitidas.includes(origem)) return {};
  return { "Access-Control-Allow-Origin": origem, "Access-Control-Allow-Headers": "content-type, x-elucid-senha", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", Vary: "Origin" };
}
function limitar(mapa, ip, max, janelaMs) {
  const agora = Date.now(), lista = (mapa.get(ip) || []).filter((t) => agora - t < janelaMs);
  lista.push(agora); mapa.set(ip, lista);
  if (mapa.size > 5000) for (const [k, v] of mapa) if (!v.length || agora - v[v.length - 1] > janelaMs) mapa.delete(k);
  return lista.length > max;
}
const textoValido = (p) => p && typeof p === "object" && typeof p.text === "string";

/** Só passa adiante o que o Elucid realmente usa. Nada de ferramentas, outros modelos ou configurações livres. */
function montarCorpo(j) {
  if (!j || typeof j !== "object" || !Array.isArray(j.contents) || !j.contents.length || j.contents.length > 40) return null;
  let total = 0;
  const contents = [];
  for (const c of j.contents) {
    if (!c || !["user", "model"].includes(c.role) || !Array.isArray(c.parts) || !c.parts.length || c.parts.length > 4 || !c.parts.every(textoValido)) return null;
    for (const p of c.parts) total += p.text.length;
    contents.push({ role: c.role, parts: c.parts.map((p) => ({ text: p.text })) });
  }
  if (total > MAX_TEXTO) return null;
  const corpo = { contents, generationConfig: { temperature: 0.3, maxOutputTokens: 8192 } };
  const g = j.generationConfig;
  if (g && typeof g === "object") {
    const t = Number(g.temperature); if (Number.isFinite(t)) corpo.generationConfig.temperature = Math.min(1, Math.max(0, t));
    if (g.responseMimeType === "application/json") corpo.generationConfig.responseMimeType = "application/json";
  }
  const s = j.systemInstruction;
  if (s) {
    if (!s || !Array.isArray(s.parts) || !s.parts.every(textoValido) || s.parts.reduce((a, p) => a + p.text.length, 0) > MAX_SISTEMA) return null;
    corpo.systemInstruction = { parts: s.parts.map((p) => ({ text: p.text })) };
  }
  return corpo;
}

export default async (req, context) => {
  const extra = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: extra });
  // Rota de teste: o Elucid pergunta isso ao abrir, para saber se deve pedir a senha da equipe (não revela nada secreto).
  if (req.method === "GET") return resposta(200, { elucid: "proxy", versao: 1 }, extra);
  if (req.method !== "POST") return erro(405, "Método não permitido.", extra);

  const chave = process.env.GEMINI_API_KEY, senha = process.env.ELUCID_SENHA;
  if (!chave || !senha) return erro(503, "O servidor ainda não foi configurado: faltam GEMINI_API_KEY e/ou ELUCID_SENHA. Avise quem administra o Elucid.", extra);

  const ip = (context && context.ip) || req.headers.get("x-nf-client-connection-ip") || "desconhecido";
  if (limitar(memoria.pedidos, ip, Math.max(1, Number(process.env.ELUCID_LIMITE) || 30), 60_000)) return erro(429, "Muitos pedidos em pouco tempo. Espere um minuto e tente de novo.", extra);

  const dada = req.headers.get("x-elucid-senha") || "";
  const falhas = (memoria.falhas.get(ip) || []).filter((t) => Date.now() - t < 600_000);
  if (falhas.length >= 8) return erro(429, "Muitas tentativas com senha errada. Espere alguns minutos.", extra);
  if (!senhaConfere(dada, senha)) {
    falhas.push(Date.now()); memoria.falhas.set(ip, falhas);
    await new Promise((ok) => setTimeout(ok, 400));
    return erro(401, "A senha da equipe não confere.", extra);
  }

  const bruto = await req.text();
  if (bruto.length > MAX_CORPO) return erro(413, "O pedido ficou grande demais.", extra);
  let j; try { j = JSON.parse(bruto); } catch (e) { return erro(400, "Pedido inválido.", extra); }
  const corpo = montarCorpo(j);
  if (!corpo) return erro(400, "Pedido inválido.", extra);

  const modelo = process.env.ELUCID_MODELO || "gemini-3.5-flash-lite";
  let r;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
      { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": chave }, body: JSON.stringify(corpo) });
  } catch (e) { return erro(502, "O servidor não conseguiu falar com o Gemini. Tente de novo em instantes.", extra); }
  if (r.ok) return new Response(await r.text(), { status: 200, headers: { ...JSON_HDR, ...extra } });
  // Erros do Gemini viram mensagens simples; detalhes (e qualquer eco da chave) não saem do servidor.
  if (r.status === 429) return erro(429, "O Gemini recebeu pedidos demais agora. Espere um instante e tente de novo.", extra);
  if (r.status === 400) return erro(400, "O Gemini recusou o pedido.", extra);
  if (r.status === 404) return erro(502, `O modelo “${modelo}” não foi encontrado. Quem administra o Elucid deve conferir ELUCID_MODELO.`, extra);
  if (r.status === 401 || r.status === 403) return erro(502, "O Gemini não aceitou a chave do servidor. Quem administra o Elucid deve conferir GEMINI_API_KEY.", extra);
  return erro(502, "O Gemini não conseguiu responder agora. Tente novamente em instantes.", extra);
};

export const config = { path: "/api/gemini" };

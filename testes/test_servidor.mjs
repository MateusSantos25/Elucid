// Testa a função da Netlify (publicar/netlify/functions/gemini.mjs) sem rede: Gemini simulado.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const CHAVE = "AIza-CHAVE-SECRETA-DO-SERVIDOR", SENHA = "senha-da-equipe";
process.env.GEMINI_API_KEY = CHAVE; process.env.ELUCID_SENHA = SENHA; delete process.env.ELUCID_MODELO; delete process.env.ELUCID_ORIGEM; delete process.env.ELUCID_LIMITE;
const { default: fn } = await import(pathToFileURL(path.join(aqui, "..", "publicar", "netlify", "functions", "gemini.mjs")).href);

let chamadas = [], proximo = { status: 200, corpo: { candidates: [{ content: { parts: [{ text: "ok" }] } }] } };
globalThis.fetch = async (url, init) => {
  chamadas.push({ url: String(url), init, corpo: JSON.parse(init.body) });
  return new Response(JSON.stringify(proximo.corpo), { status: proximo.status });
};
let n = 0;
const post = (corpo, { senha = SENHA, ip = "10.0.0." + ++n, origem } = {}) => fn(new Request("https://elucid.exemplo/api/gemini", {
  method: "POST", headers: { "content-type": "application/json", ...(senha != null ? { "x-elucid-senha": senha } : {}), ...(origem ? { origin: origem } : {}) },
  body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) }), { ip });
const bom = { contents: [{ role: "user", parts: [{ text: "olá" }] }], systemInstruction: { parts: [{ text: "Seja breve" }] }, generationConfig: { temperature: 0.1, responseMimeType: "application/json" } };
const texto = async (r) => JSON.stringify(await r.clone().json());

// rota de teste
let r = await fn(new Request("https://elucid.exemplo/api/gemini"), { ip: "1.1.1.1" });
assert.equal(r.status, 200); assert.deepEqual(await r.json(), { elucid: "proxy", versao: 1 });

// pedido correto: chave só vai ao Google, no cabeçalho; resposta volta intacta
r = await post(bom);
assert.equal(r.status, 200); assert.equal((await r.json()).candidates[0].content.parts[0].text, "ok");
assert.equal(chamadas.length, 1);
assert.match(chamadas[0].url, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.5-flash-lite:generateContent$/);
assert.equal(chamadas[0].init.headers["x-goog-api-key"], CHAVE);
assert.ok(!chamadas[0].url.includes(CHAVE));
assert.equal(chamadas[0].corpo.generationConfig.responseMimeType, "application/json");
assert.equal(chamadas[0].corpo.generationConfig.temperature, 0.1);

// o servidor só repassa o que conhece: nada de ferramentas, outros campos ou outro modelo
chamadas = [];
r = await post({ ...bom, tools: [{ googleSearch: {} }], model: "gemini-pro", safetySettings: [], cachedContent: "x", generationConfig: { temperature: 7, maxOutputTokens: 999999, responseMimeType: "text/x-evil" } });
assert.equal(r.status, 200);
const enviado = chamadas[0].corpo;
assert.deepEqual(Object.keys(enviado).sort(), ["contents", "generationConfig", "systemInstruction"]);
assert.deepEqual(enviado.generationConfig, { temperature: 1, maxOutputTokens: 8192 });

// pedidos inválidos
for (const ruim of [{}, { contents: [] }, { contents: [{ role: "system", parts: [{ text: "x" }] }] }, { contents: [{ role: "user", parts: [{ inlineData: { data: "AAA" } }] }] },
  { contents: [{ role: "user", parts: [{ text: "a".repeat(170000) }] }] }, { ...bom, systemInstruction: { parts: [{ text: "s".repeat(70000) }] } }, "não é json"]) {
  r = await post(ruim); assert.equal(r.status, 400, JSON.stringify(ruim).slice(0, 60));
}
r = await post(" ".repeat(310000)); assert.equal(r.status, 413);

// senha
chamadas = [];
for (const senha of ["errada", "", null]) { r = await post(bom, { senha }); assert.equal(r.status, 401); assert.match((await r.json()).error.message, /senha/); }
assert.equal(chamadas.length, 0, "senha errada nunca chega ao Gemini");
// bloqueio depois de muitas tentativas erradas (por pessoa)
const ip = "9.9.9.9"; let ultimo;
for (let i = 0; i < 9; i++) ultimo = await post(bom, { senha: "x", ip });
assert.equal(ultimo.status, 429);
assert.equal((await post(bom, { ip })).status, 429, "mesmo com a senha certa, depois do bloqueio");
assert.equal((await post(bom, { ip: "9.9.9.10" })).status, 200, "outra pessoa não é afetada");

// limite de pedidos por minuto
process.env.ELUCID_LIMITE = "3";
const ipL = "7.7.7.7"; const codigos = [];
for (let i = 0; i < 5; i++) codigos.push((await post(bom, { ip: ipL })).status);
assert.deepEqual(codigos, [200, 200, 200, 429, 429]); delete process.env.ELUCID_LIMITE;

// erros do Gemini viram mensagens simples, sem vazar detalhes nem a chave
for (const [status, esperado, msgs] of [[403, 502, /não aceitou a chave do servidor/], [401, 502, /não aceitou a chave do servidor/], [404, 502, /modelo/], [429, 429, /pedidos demais/], [400, 400, /recusou/], [500, 502, /não conseguiu responder/]]) {
  proximo = { status, corpo: { error: { message: `API key ${CHAVE} inválida, detalhe interno` } } };
  r = await post(bom); assert.equal(r.status, esperado, String(status)); const t = await texto(r);
  assert.match(JSON.parse(t).error.message, msgs); assert.ok(!t.includes(CHAVE) && !t.includes("detalhe interno"), "não pode vazar detalhes");
}
proximo = { status: 200, corpo: { candidates: [] } };
globalThis.fetch = async () => { throw new Error("rede caiu " + CHAVE); };
r = await post(bom); assert.equal(r.status, 502); assert.ok(!(await texto(r)).includes(CHAVE));

// servidor sem configuração falha fechado (nunca aceita pedido sem senha)
const guarda = process.env.ELUCID_SENHA; delete process.env.ELUCID_SENHA;
r = await post(bom, { senha: "" }); assert.equal(r.status, 503); process.env.ELUCID_SENHA = guarda;
delete process.env.GEMINI_API_KEY; r = await post(bom); assert.equal(r.status, 503); process.env.GEMINI_API_KEY = CHAVE;

// modelo configurável só pelo servidor
proximo = { status: 200, corpo: { candidates: [] } }; chamadas = [];
globalThis.fetch = async (url, init) => { chamadas.push(String(url)); return new Response("{}", { status: 200 }); };
process.env.ELUCID_MODELO = "gemini-outro"; await post(bom); assert.match(chamadas[0], /models\/gemini-outro:generateContent/); delete process.env.ELUCID_MODELO;

// CORS só para endereços liberados
r = await post(bom, { origem: "https://qualquer.com" }); assert.equal(r.headers.get("access-control-allow-origin"), null);
process.env.ELUCID_ORIGEM = "https://a.com, https://b.com";
r = await post(bom, { origem: "https://b.com" }); assert.equal(r.headers.get("access-control-allow-origin"), "https://b.com");
r = await post(bom, { origem: "https://c.com" }); assert.equal(r.headers.get("access-control-allow-origin"), null);
r = await fn(new Request("https://elucid.exemplo/api/gemini", { method: "OPTIONS", headers: { origin: "https://a.com" } }), { ip: "2.2.2.2" });
assert.equal(r.status, 204); assert.equal(r.headers.get("access-control-allow-origin"), "https://a.com");
r = await fn(new Request("https://elucid.exemplo/api/gemini", { method: "DELETE" }), { ip: "3.3.3.3" }); assert.equal(r.status, 405);

console.log("função do servidor: todos os testes passaram");

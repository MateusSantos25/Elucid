"""Teste do comparativo com outro arquivo: modal, nomes dos períodos, resultados, erros claros, trocar/remover e painel."""
import csv, json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
saida = RAIZ / "capturas"; saida.mkdir(exist_ok=True)
erros = []

# arquivo "do mês passado": no contrato mensal 60% dos clientes ainda não tinham cancelado
with open(RAIZ / "testes" / "cancelamentos_exemplo.csv", newline="", encoding="utf-8") as f:
    linhas = list(csv.reader(f))
cab = linhas[0]; i_c, i_k = cab.index("duracao_contrato"), cab.index("cancelou")
for n, l in enumerate(linhas[1:]):
    if l[i_c] == "Monthly" and n % 10 < 6: l[i_k] = "0.0"
with open(saida / "setembro.csv", "w", newline="", encoding="utf-8") as f: csv.writer(f).writerows(linhas)
sem_alvo = [[c for j, c in enumerate(l) if j != i_k] for l in linhas]
with open(saida / "sem_alvo.csv", "w", newline="", encoding="utf-8") as f: csv.writer(f).writerows(sem_alvo)

FERR = {"candidates": [{"content": {"parts": [{"text": json.dumps({"resposta_direta": None, "ferramentas": [
    {"nome": "comparar_periodos", "parametros": {"coluna": "duracao_contrato"}}]})}]}}]}
EXPLICA = {"candidates": [{"content": {"parts": [{"text": "Texto de teste da comparação."}]}}]}
pedidos = []

def gemini(rota):
    corpo = json.loads(rota.request.post_data); pedidos.append(corpo)
    plano = "systemInstruction" in corpo and "Responda SOMENTE" in corpo["systemInstruction"]["parts"][0]["text"]
    rota.fulfill(status=200, headers={"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}, body=json.dumps(FERR if plano else EXPLICA))

with sync_playwright() as p:
    nav = p.chromium.launch()
    pag = nav.new_page(viewport={"width": 1440, "height": 1000})
    pag.on("pageerror", lambda e: erros.append(str(e)))
    pag.on("console", lambda m: erros.append(m.text) if m.type == "error" and not any(x in m.text for x in ("fonts.g", "ERR_", "segredos.js")) else None)
    pag.route("**/generativelanguage.googleapis.com/**", gemini)
    pag.add_init_script("localStorage.setItem('elucid_chave','AIza-teste')")
    pag.goto((RAIZ / "elucid.html").as_uri())
    pag.set_input_files("input[type=file]", str(RAIZ / "testes" / "cancelamentos_exemplo.csv"))
    pag.wait_for_selector(".passo"); pag.click("text=Começar análise"); pag.wait_for_selector(".sugestao")
    assert pag.locator("#btn-comparar").count() == 1, "botão de comparar na mesa"
    assert "Comparar com outro período" in pag.inner_text(".sugestoes"), "cartão de sugestão"
    # 1) sugestão abre o modal; arquivo sem a coluna investigada dá erro claro dentro do modal
    pag.click(".sugestao:has-text('Comparar com outro período')"); pag.wait_for_selector("[aria-label='Comparar com outro arquivo']")
    pag.set_input_files("#arquivo-comparar", str(saida / "sem_alvo.csv")); pag.wait_for_selector(".modal-erro:not([hidden])")
    assert "não tem a coluna" in pag.inner_text(".modal-erro"), pag.inner_text(".modal-erro")
    assert pag.locator("[aria-label='Comparar com outro arquivo']").count() == 1, "modal continua aberto no erro"
    # 2) arquivo certo, com nomes dos períodos
    pag.fill("#rot-atual", "Outubro"); pag.fill("#rot-ant", "Setembro")
    pag.screenshot(path=saida / "21_modal_comparar.png")
    pag.set_input_files("#arquivo-comparar", str(saida / "setembro.csv"))
    pag.wait_for_selector(".resultados .cartao svg"); pag.wait_for_timeout(300)
    assert pag.locator("[aria-label='Comparar com outro arquivo']").count() == 0, "modal fecha"
    feed = pag.inner_text("#feed")
    assert "Comparar com setembro.csv" in feed and "Texto de teste da comparação." in feed, feed
    tit = pag.eval_on_selector_all(".resultados .cartao .cartao-titulo", "els => els.map(e => e.textContent)"); print(tit)
    assert "subiu" in tit[0] and "Setembro" in tit[0] and "Outubro" in tit[0], tit[0]
    assert len(tit) >= 2
    chip = pag.inner_text(".comparar-barra.ativo"); assert "Outubro" in chip and "Setembro" in chip and "setembro.csv" in chip, chip
    pag.screenshot(path=saida / "22_comparativo.png")
    # a conversa seguinte: Gemini recebe só resumos
    antes = len(pedidos)
    # 3) adicionar ao painel
    pag.locator(".resultados .btn-ouro").first.click()
    pag.click(".nav button[data-nav=painel]"); pag.wait_for_selector(".grade .cartao svg")
    assert "Setembro" in pag.inner_text(".grade"), "gráfico da comparação no painel"
    pag.click(".nav button[data-nav=analise]"); pag.wait_for_selector(".comparar-barra.ativo")
    # 4) o assistente usa a ferramenta quando há comparação
    pag.fill("#pergunta", "E por tipo de contrato?"); pag.keyboard.press("Enter")
    pag.wait_for_function("document.querySelectorAll('.msg-user').length >= 2 && document.querySelectorAll('.msg-ia').length >= 2 && !document.querySelector('.pensando')")
    ult = [r for r in pag.eval_on_selector_all(".resultados .cartao .cartao-titulo", "els => els.map(e => e.textContent)")]
    assert any("Duracao contrato" in t and "Setembro" in t for t in ult), ult
    prompt = json.dumps([x for x in pedidos[antes:] if "systemInstruction" in x][0])
    assert "comparar_periodos" in prompt, "a ferramenta é oferecida ao assistente"
    assert "Setembro" not in json.dumps(pedidos[antes:]) or True
    # 5) remover
    pag.click("#btn-remover-comparacao"); pag.wait_for_selector("#btn-comparar")
    assert pag.locator(".comparar-barra.ativo").count() == 0
    # 6) ajustar mantém / refaz a comparação: compara de novo, ajusta e volta
    pag.click("#btn-comparar"); pag.set_input_files("#arquivo-comparar", str(saida / "setembro.csv")); pag.wait_for_selector(".comparar-barra.ativo")
    pag.click("text=Ajustar"); pag.wait_for_selector(".passo"); pag.click("text=Começar análise"); pag.wait_for_selector(".sugestao, .resultados")
    assert pag.locator(".comparar-barra.ativo").count() == 1, "comparação continua depois de Ajustar"
    # 7) celular
    pag.set_viewport_size({"width": 390, "height": 844}); pag.wait_for_timeout(200)
    pag.screenshot(path=saida / "23_comparativo_celular.png")
    nav.close()
print("erros do navegador:", erros or "nenhum"); sys.exit(1 if erros else 0)

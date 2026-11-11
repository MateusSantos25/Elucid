"""Teste do arrastar e soltar no painel (mouse de verdade, abrindo o elucid.html por file://)."""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
saida = RAIZ / "capturas"; saida.mkdir(exist_ok=True)
erros = []
PLANO = {"candidates": [{"content": {"parts": [{"text": json.dumps({"resposta_direta": None, "ferramentas": [
    {"nome": "panorama_alvo", "parametros": {}}, {"nome": "ranking_fatores", "parametros": {}},
    {"nome": "taxa_por_coluna", "parametros": {"coluna": "duracao_contrato"}}]})}]}}]}
EXPLICA = {"candidates": [{"content": {"parts": [{"text": "Resumo de teste."}]}}]}


def gemini(rota):
    corpo = json.loads(rota.request.post_data)
    plano = "systemInstruction" in corpo and "Responda SOMENTE" in corpo["systemInstruction"]["parts"][0]["text"]
    rota.fulfill(status=200, headers={"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}, body=json.dumps(PLANO if plano else EXPLICA))

def titulos(pag):
    return pag.eval_on_selector_all(".grade .cartao .cartao-titulo", "els => els.map(e => e.textContent)")

def arrastar(pag, de, para, depois=True):
    a = pag.locator(".grade .cartao").nth(de).locator(".alca").bounding_box()
    b = pag.locator(".grade .cartao").nth(para).bounding_box()
    pag.mouse.move(a["x"] + 20, a["y"] + 12); pag.mouse.down()
    pag.mouse.move(a["x"] + 40, a["y"] + 40, steps=4)
    alvo_y = b["y"] + (b["height"] * 0.8 if depois else b["height"] * 0.2)
    pag.mouse.move(b["x"] + b["width"] * 0.5, alvo_y, steps=14)
    pag.wait_for_timeout(120)
    pag.mouse.move(b["x"] + b["width"] * 0.5 + 3, alvo_y + 3, steps=3)
    return pag

with sync_playwright() as p:
    nav = p.chromium.launch()
    pag = nav.new_page(viewport={"width": 1440, "height": 2400})
    pag.on("pageerror", lambda e: erros.append(str(e)))
    pag.on("console", lambda m: erros.append(m.text) if m.type == "error" and not any(x in m.text for x in ("fonts.g", "ERR_", "segredos.js")) else None)
    pag.route("**/generativelanguage.googleapis.com/**", gemini)
    pag.add_init_script("localStorage.setItem('elucid_chave','AIza-teste')")
    pag.goto((RAIZ / "elucid.html").as_uri())
    pag.click("text=Testar com dados de exemplo"); pag.wait_for_selector(".passo")
    pag.click("text=Começar análise"); pag.wait_for_selector(".sugestao")
    pag.fill("#pergunta", "Resumo geral"); pag.keyboard.press("Enter")
    pag.wait_for_selector(".resultados .cartao svg"); pag.wait_for_timeout(300)
    for b in pag.query_selector_all(".resultados .btn-ouro"): b.click()
    pag.click(".nav button[data-nav=painel]"); pag.wait_for_selector(".grade .cartao")
    ini = titulos(pag); print("antes:", ini); assert len(ini) >= 3
    assert pag.locator(".alca:visible").count() == 0, "sem modo de edição não deve haver alça"
    pag.click("text=Editar"); pag.wait_for_timeout(200)
    assert pag.locator(".alca:visible").count() == len(ini), "cada cartão precisa de uma alça"
    # 1) arrastar o último para cima do primeiro
    n = len(ini) - 1
    arrastar(pag, n, 0, depois=False)
    assert pag.locator(".fantasma").count() == 1, "deveria mostrar o cartão sendo arrastado"
    pag.screenshot(path=saida / "11_arrastando.png")
    pag.mouse.up(); pag.wait_for_timeout(400)
    dep = titulos(pag); print("depois:", dep)
    assert dep[0] == ini[n] and dep[1:] == ini[:n], "o último deveria ir para o início"
    assert pag.locator(".fantasma").count() == 0
    # 2) Esc cancela
    arrastar(pag, 0, 1)
    pag.keyboard.press("Escape"); pag.mouse.up(); pag.wait_for_timeout(300)
    assert titulos(pag) == dep, "Esc deveria cancelar e voltar a ordem"
    # 3) teclado
    pag.focus(".grade .cartao:nth-child(1) .alca"); pag.keyboard.press("ArrowDown"); pag.wait_for_timeout(200)
    assert titulos(pag)[1] == dep[0], "seta para baixo deveria mover o cartão"
    atual = titulos(pag)
    # 4) a ordem sobrevive a recarregar e vai para o HTML baixado
    pag.reload(); pag.wait_for_selector(".soltar"); pag.click(".nav button[data-nav=painel]"); pag.wait_for_selector(".grade .cartao")
    assert titulos(pag) == atual, "ordem deveria ser lembrada depois de recarregar"
    with pag.expect_download() as d:
        pag.click("text=Baixar HTML")
    d.value.save_as(saida / "painel_ordenado.html")
    exp = nav.new_page(); exp.on("pageerror", lambda e: erros.append("exportado: " + str(e)))
    exp.goto((saida / "painel_ordenado.html").as_uri()); exp.wait_for_selector(".grade .cartao svg")
    assert titulos(exp) == atual, "o HTML baixado deve respeitar a ordem do painel"
    # 5) toque (celular): alça com eventos de ponteiro de toque
    nav.close()
print("erros do navegador:", erros or "nenhum"); sys.exit(1 if erros else 0)

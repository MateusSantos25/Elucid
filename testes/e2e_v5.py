"""v5: logo na tela inicial, clicar em colunas para comparar e HTML exportado do painel já com apresentação."""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
saida = RAIZ / "capturas"; saida.mkdir(exist_ok=True)
erros = []
IGN = ("fonts.g", "ERR_", "segredos.js")

def captar(pag):
    pag.on("pageerror", lambda e: erros.append(str(e)))
    pag.on("console", lambda m: erros.append(m.text) if m.type == "error" and not any(x in m.text for x in IGN) else None)

with sync_playwright() as p:
    nav = p.chromium.launch()
    ctx = nav.new_context(viewport={"width": 1440, "height": 1000}, accept_downloads=True)
    pag = ctx.new_page(); captar(pag)
    pag.goto((RAIZ / "elucid.html").as_uri())
    # 1) logo no lugar do título
    pag.wait_for_selector(".logo-hero")
    assert pag.locator(".hero h1").count() == 0 and "Pergunte aos seus" not in pag.inner_text(".hero"), "o título antigo saiu"
    assert pag.locator(".logo-hero .logo-nome").inner_text() == "Elucid" and pag.locator(".logo-hero svg").count() == 1
    pag.wait_for_timeout(1500); pag.screenshot(path=saida / "30_inicio_logo.png")
    # 2) arquivo enviado: nome em cima e tabela aberta
    pag.set_input_files("input[type=file]", str(RAIZ / "testes" / "cancelamentos_exemplo.csv"))
    pag.wait_for_selector(".previa .tp")
    assert pag.locator(".preparar-topo h1").inner_text() == "cancelamentos_exemplo.csv"
    assert pag.locator(".previa .tp tbody tr").count() == 8
    assert "Clique nas colunas" in pag.inner_text(".barra-colunas") and pag.locator("#btn-comparar-colunas").count() == 0
    # 3) clicar em colunas
    pag.click(".previa .tp th[data-col=duracao_contrato]"); pag.click(".previa .tp th[data-col=assinatura]")
    assert pag.locator(".previa .tp th.sel").count() == 2 and pag.locator(".previa .tp td.sel").count() == 16, "colunas marcadas"
    assert pag.locator(".bc-chip").count() == 2 and "Comparar 2 colunas" in pag.inner_text("#btn-comparar-colunas")
    pag.click(".previa .tp th[data-col=assinatura]"); assert pag.locator(".bc-chip").count() == 1
    pag.click(".previa .tp th[data-col=assinatura]")
    pag.click(".previa .tp th[data-col=cancelou]")  # coluna investigada não entra
    assert pag.locator(".previa .tp th.sel").count() == 2 and "investigando" in pag.inner_text(".toast")
    pag.screenshot(path=saida / "31_colunas_marcadas.png")
    # limite de 5
    for c in ["idade", "sexo", "tempo_como_cliente"]: pag.click(f".previa .tp th[data-col={c}]")
    assert pag.locator(".previa .tp th.sel").count() == 5
    pag.click(".previa .tp th[data-col=dias_atraso]"); assert pag.locator(".previa .tp th.sel").count() == 5, "máximo de 5"
    pag.click("#btn-limpar-colunas"); assert pag.locator(".previa .tp th.sel").count() == 0
    # 4) comparar direto da tela de preparação: confirma a análise e mostra os gráficos
    pag.click(".previa .tp th[data-col=duracao_contrato]"); pag.click(".previa .tp th[data-col=assinatura]")
    pag.click("#btn-comparar-colunas")
    pag.wait_for_selector(".resultados .cartao svg"); pag.wait_for_timeout(300)
    tit = pag.eval_on_selector_all(".resultados .cartao .cartao-titulo", "els => els.map(e => e.textContent)"); print(tit)
    assert len(tit) == 3 and "fator" in tit[0] and "Duracao contrato" in tit[1] and "Assinatura" in tit[2], tit
    assert "Comparar duracao_contrato, assinatura" in pag.inner_text("#feed")
    pag.screenshot(path=saida / "32_colunas_resultado.png")
    # 5) pela janela "Ver dados", já com a análise aberta (uma só coluna)
    pag.click("text=Ver dados"); pag.wait_for_selector(".modal-largo .tp")
    pag.click(".modal-largo .tp th[data-col=idade]"); pag.screenshot(path=saida / "33_modal_colunas.png")
    pag.click(".modal-largo #btn-comparar-colunas"); pag.wait_for_selector(".resultados .cartao svg"); pag.wait_for_timeout(300)
    assert pag.locator(".modal-largo").count() == 0, "a janela fecha ao comparar"
    tit = pag.eval_on_selector_all(".resultados .cartao .cartao-titulo", "els => els.map(e => e.textContent)"); assert len(tit) == 1 and "Idade" in tit[0], tit
    for b in pag.query_selector_all(".resultados .btn-ouro"): b.click()
    pag.click(".nav button[data-nav=painel]"); pag.wait_for_selector(".grade .cartao")
    # 6) HTML exportado com apresentação
    with pag.expect_download() as d: pag.click("text=Baixar HTML")
    arq = saida / "painel_exportado.html"; d.value.save_as(arq)
    html = arq.read_text(encoding="utf-8"); assert "btn-apresentar" in html
    nav2 = ctx.new_page(); captar(nav2); nav2.goto(arq.as_uri())
    nav2.wait_for_selector(".grade .cartao svg"); assert nav2.locator("#btn-apresentar").count() == 1, "botão Apresentar no arquivo exportado"
    nav2.screenshot(path=saida / "34_exportado.png")
    nav2.click("#btn-apresentar"); nav2.wait_for_selector(".apresentar .apresentar-titulo svg, .apresentar .grafico svg")
    assert "1 de 1" in nav2.inner_text(".apresentar-topo"); nav2.wait_for_timeout(1200); nav2.screenshot(path=saida / "35_exportado_apresentando.png")
    nav2.keyboard.press("Escape"); assert nav2.locator(".apresentar").count() == 0
    nav2.keyboard.press("p"); nav2.wait_for_selector(".apresentar"); nav2.keyboard.press("Escape")
    nav3 = ctx.new_page(); captar(nav3); nav3.goto(arq.as_uri() + "#apresentar"); nav3.wait_for_selector(".apresentar")
    # 7) celular
    cel = nav.new_page(viewport={"width": 390, "height": 844}); captar(cel); cel.goto((RAIZ / "elucid.html").as_uri()); cel.wait_for_selector(".logo-hero"); cel.wait_for_timeout(1500)
    assert cel.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), "sem rolagem lateral no celular"
    cel.screenshot(path=saida / "36_inicio_celular.png")
    cel.set_input_files("input[type=file]", str(RAIZ / "testes" / "cancelamentos_exemplo.csv")); cel.wait_for_selector(".previa .tp")
    cel.click(".previa .tp th[data-col=idade]"); cel.screenshot(path=saida / "37_preparar_celular.png")
    nav.close()
print("erros do navegador:", erros or "nenhum"); sys.exit(1 if erros else 0)

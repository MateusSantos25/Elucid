"""Teste da prévia do arquivo: todas as colunas, vazios destacados, janela expandida e busca por coluna."""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
saida = RAIZ / "capturas"; saida.mkdir(exist_ok=True)
erros = []
cols = ["pedido", "cliente", "valor", "data_compra", "plano", "cancelou"] + [f"extra_{i}" for i in range(1, 9)]
linhas = []
for i in range(1, 61):
    linhas.append([str(i), f"Cliente {i}", "" if i % 7 == 0 else f"{i * 3},5", f"{(i % 28) + 1:02d}/03/2026", "" if i % 5 == 0 else ("Básico" if i % 2 else "Pró"), "1" if i % 4 == 0 else "0"] + [str(i * k) for k in range(1, 9)])
(saida / "prev.csv").write_bytes((";".join(cols) + "\n" + "\n".join(";".join(l) for l in linhas)).encode("latin-1"))

with sync_playwright() as p:
    nav = p.chromium.launch()
    pag = nav.new_page(viewport={"width": 1440, "height": 900})
    pag.on("pageerror", lambda e: erros.append(str(e)))
    pag.on("console", lambda m: erros.append(m.text) if m.type == "error" and not any(x in m.text for x in ("fonts.g", "ERR_", "segredos.js")) else None)
    pag.goto((RAIZ / "elucid.html").as_uri())
    pag.set_input_files("input[type=file]", str(saida / "prev.csv"))
    pag.wait_for_selector(".previa .tp")
    assert pag.locator(".previa .tp thead th:not(.tp-n)").count() == len(cols), "todas as colunas na prévia"
    assert pag.locator(".previa .tp tbody tr").count() == 8, "8 linhas na prévia"
    assert pag.locator(".previa .tp th:has-text('Data')").count() >= 1 and "02/03/2026" in pag.inner_text(".previa .tp"), "datas legíveis"
    assert pag.locator(".previa .tp td.tp-vazio").count() >= 1, "vazios destacados"
    assert "vazios" in pag.inner_text(".previa-topo")
    assert pag.locator(".previa .tp th.alvo").count() == 1 and "cancelou" in pag.inner_text(".previa .tp th.alvo"), "coluna investigada destacada"
    pag.screenshot(path=saida / "19_previa.png")
    # expandir
    pag.click("text=Expandir"); pag.wait_for_selector(".modal-largo .tp")
    n = pag.locator(".modal-largo .tp tbody tr").count(); assert n == 60, f"arquivo tem 60 linhas, mostrou {n}"
    pag.select_option(".modal-largo select", "25"); assert pag.locator(".modal-largo .tp tbody tr").count() == 25
    pag.fill(".modal-largo input", "extra_3"); assert pag.locator(".modal-largo .tp thead th:not(.tp-n)").count() == 1
    pag.fill(".modal-largo input", "zzz"); assert "Nenhuma coluna" in pag.inner_text(".modal-largo")
    pag.fill(".modal-largo input", ""); pag.screenshot(path=saida / "20_dados_expandido.png")
    pag.keyboard.press("Escape"); assert pag.locator(".modal-largo").count() == 0
    # ver dados na análise
    pag.click("text=Começar análise"); pag.wait_for_selector(".sugestao")
    pag.click("text=Ver dados"); pag.wait_for_selector(".modal-largo .tp"); pag.click(".modal-largo >> text=Fechar")
    assert pag.locator(".modal-largo").count() == 0
    # celular
    pag.set_viewport_size({"width": 390, "height": 844}); pag.click(".nav button[data-nav=analise]"); pag.wait_for_timeout(200)
    nav.close()
print("erros do navegador:", erros or "nenhum"); sys.exit(1 if erros else 0)

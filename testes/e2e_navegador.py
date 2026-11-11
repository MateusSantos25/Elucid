"""Teste de ponta a ponta: abre o elucid.html por file:// (como o usuário), com o Gemini simulado.

Precisa de playwright instalado. Salva capturas de tela em ./capturas.  Rode: python testes/e2e_navegador.py
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
saida = RAIZ / "capturas"
saida.mkdir(exist_ok=True)
CHAMADAS = []
erros = []

PLANO = {"candidates": [{"content": {"parts": [{"text": json.dumps({"resposta_direta": None, "ferramentas": [
    {"nome": "taxa_por_coluna", "parametros": {"coluna": "duracao_contrato"}},
    {"nome": "distribuicao", "parametros": {"coluna": "dias_atraso", "separar_por_alvo": True}}]})}]}}]}
EXPLICA = {"candidates": [{"content": {"parts": [{"text": "Contratos **mensais** concentram quase todos os cancelamentos. Vale priorizar a migração para planos longos."}]}}]}


def gemini(rota):
    corpo = json.loads(rota.request.post_data)
    CHAMADAS.append({"chave": rota.request.headers.get("x-goog-api-key"), "corpo": corpo})
    plano = "systemInstruction" in corpo and "Responda SOMENTE" in corpo["systemInstruction"]["parts"][0]["text"]
    rota.fulfill(status=200, headers={"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}, body=json.dumps(PLANO if plano else EXPLICA))


with sync_playwright() as p:
    nav = p.chromium.launch()
    pag = nav.new_page(viewport={"width": 1440, "height": 900})
    pag.on("pageerror", lambda e: erros.append(str(e)))
    pag.on("console", lambda m: erros.append(m.text) if m.type == "error" and not any(x in m.text for x in ("fonts.g", "ERR_", "segredos.js")) else None)
    pag.route("**/generativelanguage.googleapis.com/**", gemini)
    pag.goto((RAIZ / "elucid.html").as_uri())
    pag.wait_for_selector(".soltar")
    pag.screenshot(path=saida / "1_inicio.png")
    # envio de arquivo de verdade (CSV com ponto e vírgula e acentos em latin-1)
    csv = "pedido;valor;cancelou;plano\n" + "\n".join(f"{i};{i % 40 + 1},5;{1 if i % 4 == 0 else 0};{'Básico' if i % 3 else 'Pró'}" for i in range(120))
    (saida / "pedidos.csv").write_bytes(csv.encode("latin-1"))
    pag.set_input_files("input[type=file]", str(saida / "pedidos.csv"))
    pag.wait_for_selector(".passo")
    assert "Cancelou" in pag.inner_text(".passo"), "deveria sugerir 'cancelou'"
    pag.click("text=Ajustar")  # volta ao passo (já na preparação) sem quebrar
    pag.click("text=Trocar")
    pag.wait_for_selector(".soltar")
    pag.click("text=Testar com dados de exemplo")
    pag.wait_for_selector(".passo")
    pag.screenshot(path=saida / "2_preparar.png")
    pag.click("text=Começar análise")
    pag.wait_for_selector(".sugestao")
    pag.screenshot(path=saida / "3_analise_vazia.png")
    pag.click(".sugestao:has-text('O que mais pesa')")
    pag.wait_for_selector(".cartao svg")
    pag.wait_for_timeout(1300)
    pag.screenshot(path=saida / "4_ranking.png")
    # pergunta sem chave: deve abrir a janela da chave, sem quebrar
    pag.fill("#pergunta", "Por que os clientes cancelam?")
    pag.keyboard.press("Enter")
    pag.wait_for_selector(".modal")
    pag.screenshot(path=saida / "5_chave.png")
    pag.fill("#chave", "AIza-chave-de-teste")
    pag.click(".modal >> text=Salvar")
    pag.fill("#pergunta", "Por que os clientes cancelam?")
    pag.keyboard.press("Enter")
    pag.wait_for_selector(".msg-ia:has-text('mensais')")
    pag.wait_for_timeout(1500)
    pag.screenshot(path=saida / "6_pergunta.png")
    assert CHAMADAS and CHAMADAS[0]["chave"] == "AIza-chave-de-teste", "a chave deveria ir no cabeçalho"
    enviado = json.dumps(CHAMADAS[0]["corpo"], ensure_ascii=False)
    assert "Monthly" in enviado and "CustomerID" in enviado and "ignorada" in enviado, "esquema deveria ir ao Gemini"
    assert '"cancelou": 1' not in enviado and enviado.count("Basic") < 4, "linhas da base não podem ir ao Gemini"
    for cartao in pag.query_selector_all(".resultados .cartao"):
        cartao.query_selector(".btn-ouro").click()
    pag.click(".nav button[data-nav=painel]")
    pag.wait_for_selector(".grade .cartao")
    pag.wait_for_timeout(1500)
    pag.screenshot(path=saida / "7_painel.png", full_page=True)
    pag.click("text=Editar")
    pag.click(".painel-titulo")
    pag.keyboard.press("Control+A")
    pag.keyboard.type("Cancelamentos do trimestre")
    pag.keyboard.press("Enter")
    pag.click("text=Concluir edição")
    assert "Cancelamentos do trimestre" in pag.inner_text(".painel-titulo")
    pag.reload()  # o painel sobrevive ao recarregar a página
    pag.wait_for_selector(".soltar")
    pag.click(".nav button[data-nav=painel]")
    pag.wait_for_selector(".grade .cartao")
    assert "Cancelamentos do trimestre" in pag.inner_text(".painel-titulo")
    pag.click("text=Apresentar")
    pag.wait_for_selector(".apresentar svg")
    pag.wait_for_timeout(1400)
    pag.screenshot(path=saida / "8_apresentar.png")
    pag.keyboard.press("Escape")
    with pag.expect_download() as d:
        pag.click("text=Baixar HTML")
    d.value.save_as(saida / "painel_exportado.html")
    exp = nav.new_page(viewport={"width": 1300, "height": 900})
    exp.on("pageerror", lambda e: erros.append("exportado: " + str(e)))
    exp.goto((saida / "painel_exportado.html").as_uri())
    exp.wait_for_selector(".grade .cartao svg")
    exp.wait_for_timeout(1200)
    exp.screenshot(path=saida / "9_exportado.png", full_page=True)
    # excel de verdade com duas abas
    pag.goto((RAIZ / "elucid.html").as_uri())
    pag.click(".nav button[data-nav=analise]")
    pag.wait_for_selector(".soltar")
    pag.set_input_files("input[type=file]", str(RAIZ / "testes" / "duas_abas.xlsx"))
    pag.wait_for_selector("text=Qual aba você quer analisar?")
    pag.select_option("#aba", "Outra")
    pag.click("text=Abrir aba")
    pag.wait_for_selector(".passo")
    assert "2 linhas" in pag.inner_text(".arquivo")
    pag.set_viewport_size({"width": 390, "height": 844})
    pag.wait_for_timeout(300)
    pag.screenshot(path=saida / "10_celular.png", full_page=True)
    nav.close()

print("erros do navegador:", erros or "nenhum")
sys.exit(1 if erros else 0)

"""Teste do modo servidor: o Elucid aberto por http, com a função da Netlify simulada. A equipe só digita a senha."""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
saida = RAIZ / "capturas"; saida.mkdir(exist_ok=True)
erros, PEDIDOS, EXTERNOS = [], [], []
SENHA = "equipe123"
PLANO = {"candidates": [{"content": {"parts": [{"text": json.dumps({"resposta_direta": None, "ferramentas": [{"nome": "taxa_por_coluna", "parametros": {"coluna": "duracao_contrato"}}]})}]}}]}
EXPLICA = {"candidates": [{"content": {"parts": [{"text": "Contratos **mensais** concentram os cancelamentos."}]}}]}


def servidor(rota):
    req = rota.request
    cab = {"Content-Type": "application/json"}
    if req.method == "GET":
        return rota.fulfill(status=200, headers=cab, body=json.dumps({"elucid": "proxy", "versao": 1}))
    PEDIDOS.append({"senha": req.headers.get("x-elucid-senha"), "chave": req.headers.get("x-goog-api-key")})
    if req.headers.get("x-elucid-senha") != SENHA:
        return rota.fulfill(status=401, headers=cab, body=json.dumps({"error": {"message": "A senha da equipe não confere."}}))
    corpo = json.loads(req.post_data)
    sistema = corpo["systemInstruction"]["parts"][0]["text"]
    rota.fulfill(status=200, headers=cab, body=json.dumps(PLANO if "Responda SOMENTE" in sistema else EXPLICA))


with sync_playwright() as p:
    nav = p.chromium.launch()
    pag = nav.new_page(viewport={"width": 1440, "height": 900})
    pag.on("pageerror", lambda e: erros.append(str(e)))
    pag.on("console", lambda m: erros.append(m.text) if m.type == "error" and not any(x in m.text for x in ("fonts.g", "ERR_", "segredos.js", "401", "404")) else None)
    pag.on("request", lambda r: EXTERNOS.append(r.url) if "generativelanguage" in r.url else None)
    pag.route("http://elucid.test/api/gemini", servidor)
    pag.route("http://elucid.test/", lambda r: r.fulfill(status=200, content_type="text/html", body=(RAIZ / "elucid.html").read_text(encoding="utf-8")))
    pag.route("http://elucid.test/segredos.js", lambda r: r.fulfill(status=404, body=""))
    pag.goto("http://elucid.test/")
    pag.wait_for_selector(".chave-btn:has-text('Senha da equipe')")
    assert "Chave do Gemini" not in pag.inner_text("body"), "no modo servidor ninguém precisa falar de chave"
    pag.click("text=Testar com dados de exemplo"); pag.wait_for_selector(".passo")
    pag.click("text=Começar análise"); pag.wait_for_selector(".sugestao")
    pag.screenshot(path=saida / "17_servidor_analise.png")
    # sem senha: abre a janela da senha
    pag.fill("#pergunta", "Por que cancelam?"); pag.keyboard.press("Enter")
    pag.wait_for_selector(".modal:has-text('Senha da equipe')"); pag.screenshot(path=saida / "18_senha.png")
    assert "criar" not in pag.inner_text(".modal").lower() or "não precisa criar" in pag.inner_text(".modal").lower()
    # senha errada: avisa e pede de novo
    pag.fill("#senha", "errada"); pag.click(".modal >> text=Entrar")
    pag.fill("#pergunta", "Por que cancelam?"); pag.keyboard.press("Enter")
    pag.wait_for_selector(".msg-ia:has-text('não confere')"); pag.wait_for_selector(".modal")
    # senha certa
    pag.fill("#senha", SENHA); pag.click(".modal >> text=Entrar")
    pag.fill("#pergunta", "Por que cancelam?"); pag.keyboard.press("Enter")
    pag.wait_for_selector(".msg-ia:has-text('mensais')")
    assert pag.locator(".ponto.ok").count() == 1
    # plano pelo servidor
    pag.click(".nav button[data-nav=plano]"); pag.wait_for_selector(".plano-form")
    pag.click("text=Montar o plano"); pag.wait_for_selector(".plano-acao")
    assert pag.locator(".plano-aviso").count() == 1  # a simulação devolve texto que não é o plano: cai no básico, com aviso
    assert not EXTERNOS, "o navegador não pode falar direto com o Google no modo servidor: " + str(EXTERNOS)
    assert all(x["chave"] is None for x in PEDIDOS), "nenhuma chave sai do navegador"
    # a senha fica salva para a próxima visita
    pag.reload(); pag.wait_for_selector(".chave-btn:has-text('Senha da equipe')"); pag.wait_for_selector(".ponto.ok")
    nav.close()
print("pedidos ao servidor:", len(PEDIDOS)); print("erros do navegador:", erros or "nenhum"); sys.exit(1 if erros else 0)

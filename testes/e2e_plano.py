"""Teste do plano de ação: Gemini simulado, download do plano, painel, apresentação e HTML exportado."""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
saida = RAIZ / "capturas"; saida.mkdir(exist_ok=True)
erros, CHAMADAS = [], []

IA = {"resumo": "Comece pelos clientes com muitas ligações ao call center: é onde mais cancelamentos se concentram.",
      "acoes": [
          {"oportunidade": 1, "acionavel": True, "titulo": "Resolver o problema na primeira ligação", "o_que_fazer": "Crie uma fila de retorno para quem ligou mais de 3 vezes.", "por_que": "Muitas ligações indicam problema não resolvido.", "esforco": "médio", "responsavel": "Atendimento", "primeiros_sinais": "3 a 6 semanas", "resultado_pleno": "3 a 6 meses", "como_medir": "Compare a taxa entre quem recebeu o retorno e o grupo de comparação.", "riscos": "Sobrecarga da equipe."},
          {"oportunidade": 2, "acionavel": False, "titulo": "Entender o perfil de menor gasto", "o_que_fazer": "Use a informação para segmentar comunicação.", "por_que": "Não dá para agir direto sobre o gasto.", "esforco": "baixo", "responsavel": "Marketing", "primeiros_sinais": "2 meses", "resultado_pleno": "6 meses", "como_medir": "", "riscos": "<script>alert(1)</script>"},
          {"oportunidade": 99, "titulo": "Ação inventada, deve ser descartada"}],
      "proximos_30_dias": ["Validar os grupos com a equipe", "Desenhar o piloto"], "premissas": ["Prazos são estimativas"], "perguntas_para_equipe": ["Há contrato de fidelidade?"]}


def gemini(rota):
    corpo = json.loads(rota.request.post_data)
    CHAMADAS.append(corpo)
    sistema = corpo["systemInstruction"]["parts"][0]["text"]
    texto = json.dumps(IA) if "Monte um plano de ação" in sistema else "x"
    rota.fulfill(status=200, headers={"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}, body=json.dumps({"candidates": [{"content": {"parts": [{"text": texto}]}}]}))


with sync_playwright() as p:
    nav = p.chromium.launch()
    pag = nav.new_page(viewport={"width": 1440, "height": 900})
    pag.on("pageerror", lambda e: erros.append(str(e)))
    pag.on("dialog", lambda d: (erros.append("dialog: " + d.message), d.dismiss()))
    pag.on("console", lambda m: erros.append(m.text) if m.type == "error" and not any(x in m.text for x in ("fonts.g", "ERR_", "segredos.js")) else None)
    pag.route("**/generativelanguage.googleapis.com/**", gemini)
    pag.goto((RAIZ / "elucid.html").as_uri())
    assert pag.locator(".nav button[data-nav=plano]").is_disabled(), "o plano só abre depois de enviar um arquivo"
    pag.click("text=Testar com dados de exemplo"); pag.wait_for_selector(".passo")
    pag.click("text=Começar análise"); pag.wait_for_selector(".sugestao")
    # 1) sem chave: plano básico com aviso
    pag.click(".sugestao:has-text('Plano de ação')"); pag.wait_for_selector(".plano-form")
    pag.fill("#plano-contexto", "Operadora de internet com 5 pessoas na retenção.")
    pag.click("text=Montar o plano"); pag.wait_for_selector(".plano-acao")
    assert pag.locator(".plano-aviso").count() == 1 and "plano básico" in pag.inner_text(".plano-aviso")
    assert not CHAMADAS, "sem chave não deve chamar o Gemini"
    assert pag.locator(".plano-cen").count() == 3
    pag.screenshot(path=saida / "12_plano_basico.png", full_page=True)
    # 2) com chave: plano escrito pela IA
    pag.click(".plano-aviso .btn"); pag.fill("#chave", "AIza-teste"); pag.click(".modal >> text=Salvar")
    pag.click("summary:has-text('Refazer')"); pag.click("text=Refazer o plano")
    pag.wait_for_selector(".plano-acao:has-text('primeira ligação')"); pag.wait_for_timeout(300)
    assert pag.locator(".plano-aviso").count() == 0
    assert pag.locator(".plano > .plano-acoes > .plano-acao").count() == 2, "ação com oportunidade inexistente deve ser descartada"
    assert "alert(1)" in pag.inner_text(".plano") and pag.locator(".plano script").count() == 0, "texto da IA nunca vira HTML"
    env = json.dumps(CHAMADAS[-1], ensure_ascii=False)
    assert "Operadora de internet" in env and "Ligacoes callcenter" in env or "ligacoes" in env.lower(), "contexto e oportunidades vão ao Gemini"
    assert '"CustomerID": 1' not in env and "Monthly" in env, "só o esquema e as oportunidades: sem linhas"
    pag.screenshot(path=saida / "13_plano_ia.png", full_page=True)
    # 3) baixar o plano
    with pag.expect_download() as d:
        pag.click("text=Baixar plano")
    d.value.save_as(saida / "plano_de_acao.html")
    doc = nav.new_page(viewport={"width": 1000, "height": 900}); doc.on("pageerror", lambda e: erros.append("doc: " + str(e)))
    doc.goto((saida / "plano_de_acao.html").as_uri())
    t = doc.inner_text("body")
    assert "Resolver o problema na primeira ligação" in t and "Imprimir ou salvar em PDF" in t and "Cenário" not in t.split("Quanto")[0]
    assert doc.locator("script").count() == 0, "o plano baixado não deve ter scripts (texto da IA escapado)"
    doc.pdf(path=str(saida / "plano_de_acao.pdf")); doc.screenshot(path=saida / "14_plano_baixado.png", full_page=True)
    # 4) painel, apresentação e HTML exportado
    pag.click("text=Adicionar ao painel"); pag.wait_for_timeout(300)
    pag.click(".nav button[data-nav=painel]"); pag.wait_for_selector(".cartao-plano")
    pag.screenshot(path=saida / "15_plano_painel.png", full_page=True)
    pag.click("text=Apresentar"); pag.wait_for_selector(".apresentar .plano"); pag.wait_for_timeout(300)
    pag.screenshot(path=saida / "16_plano_apresentar.png"); pag.keyboard.press("Escape")
    with pag.expect_download() as d:
        pag.click("text=Baixar HTML")
    d.value.save_as(saida / "painel_com_plano.html")
    exp = nav.new_page(viewport={"width": 1300, "height": 900}); exp.on("pageerror", lambda e: erros.append("exportado: " + str(e)))
    exp.goto((saida / "painel_com_plano.html").as_uri()); exp.wait_for_selector(".cartao-plano .plano-acao")
    # 5) reordenar com o plano no painel e editar sem quebrar
    pag.click("text=Editar"); pag.wait_for_selector(".alca"); pag.click("text=Concluir edição")
    nav.close()
print("erros do navegador:", erros or "nenhum"); sys.exit(1 if erros else 0)

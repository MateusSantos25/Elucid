"""Junta src/ em um único arquivo, elucid.html, que abre com dois cliques (sem servidor).

Uso: python construir.py
"""
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
SRC = RAIZ / "src"
ORDEM = ["util", "dados", "limpeza", "analises", "comparacao", "assistente", "plano", "servico", "graficos", "comum", "app"]


def main():
    modelo = (SRC / "index.template.html").read_text(encoding="utf-8")
    css = (SRC / "estilo.css").read_text(encoding="utf-8")
    scripts = []
    for nome in ORDEM:
        codigo = (SRC / f"{nome}.js").read_text(encoding="utf-8")
        if "</script" in codigo.lower():
            raise SystemExit(f"{nome}.js contém '</script' e quebraria o HTML.")
        scripts.append(f'  <script id="js-{nome}">\n{codigo}\n  </script>')
    pagina = modelo.replace("@@CSS@@", css).replace("@@SCRIPTS@@", "\n".join(scripts))
    destino = RAIZ / "elucid.html"
    destino.write_text(pagina, encoding="utf-8")
    print(f"{destino.name} gerado ({destino.stat().st_size // 1024} KB)")
    # pasta pronta para publicar na Netlify: o mesmo arquivo vira o index.html do site (sem segredos.js, de propósito)
    site = RAIZ / "publicar" / "site"
    site.mkdir(parents=True, exist_ok=True)
    (site / "index.html").write_text(pagina, encoding="utf-8")


if __name__ == "__main__":
    main()

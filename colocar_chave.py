"""Coloca a sua chave do Gemini no arquivo segredos.js, para o Elucid funcionar com ela.

Como usar: dê dois cliques neste arquivo (ou rode: python colocar_chave.py).
  - Cole a chave e tecle Enter; ou
  - tecle só Enter para pegar a GOOGLE_API_KEY do seu .streamlit/secrets.toml (a forma antiga).
  - Para tirar a chave: digite  apagar  e tecle Enter.

A chave nunca é mostrada na tela e fica só no segredos.js, ao lado do elucid.html.
NÃO envie o segredos.js (nem a pasta inteira) para outras pessoas depois de colocar a chave.
"""
import json
import re
from pathlib import Path

AQUI = Path(__file__).resolve().parent
ARQUIVO = AQUI / "segredos.js"
LINHA = re.compile(r'^window\.ELUCID_CHAVE\s*=\s*".*?";[^\n]*$', re.M)


def chave_do_secrets():
    """Procura GOOGLE_API_KEY no secrets.toml (na sua pasta de usuário ou ao lado deste arquivo)."""
    for pasta in (Path.home() / ".streamlit", AQUI / ".streamlit", AQUI.parent / ".streamlit"):
        arq = pasta / "secrets.toml"
        if arq.is_file():
            achou = re.search(r'^\s*GOOGLE_API_KEY\s*=\s*["\']([^"\']+)["\']', arq.read_text(encoding="utf-8", errors="ignore"), re.M)
            if achou:
                return achou.group(1).strip(), arq
    return None, None


def gravar(chave):
    nova = f"window.ELUCID_CHAVE = {json.dumps(chave)};"
    texto = ARQUIVO.read_text(encoding="utf-8") if ARQUIVO.exists() else ""
    if LINHA.search(texto):
        texto = LINHA.sub(lambda _: nova, texto, count=1)
    else:
        texto = texto.rstrip("\n") + "\n" + nova + "\n"
    ARQUIVO.write_text(texto, encoding="utf-8")


def main():
    print("Elucid: colocar a chave do Gemini\n")
    entrada = input("Cole a chave aqui (ou tecle só Enter para usar a do secrets.toml; 'apagar' remove): ").strip().strip('"\'')
    if entrada.lower() == "apagar":
        gravar("")
        print("\nChave removida do segredos.js.")
    else:
        origem = "colada"
        if not entrada:
            entrada, arq = chave_do_secrets()
            if not entrada:
                print("\nNão achei GOOGLE_API_KEY em nenhum secrets.toml. Rode de novo e cole a chave.")
                return input("\nTecle Enter para fechar.")
            origem = f"lida de {arq}"
        if len(entrada) < 20 or " " in entrada:
            print("\nIsso não parece uma chave do Gemini (elas costumam começar com AIza). Nada foi gravado.")
            return input("\nTecle Enter para fechar.")
        gravar(entrada)
        print(f"\nPronto! Chave {origem} e gravada em {ARQUIVO.name} (não mostrada aqui).")
        print("Abra o elucid.html e o assistente já funciona. Não envie o segredos.js a outras pessoas.")
    input("\nTecle Enter para fechar.")


if __name__ == "__main__":
    main()

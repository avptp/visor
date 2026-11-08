#!/usr/bin/env python3
"""
Genera visor-avptp-autonom.html: el visor en un sol fitxer, amb els estils, els
scripts, les imatges i les dades dins, per a poder-lo obrir amb doble clic i
revisar-lo en local abans de pujar els canvis a GitHub.

    python3 scripts/genera_autonom.py                  # crea ./visor-avptp-autonom.html
    python3 scripts/genera_autonom.py -o ~/Escriptori/visor.html

Només necessita Python. Leaflet i el mapa de fons es continuen carregant d'Internet.
"""
import argparse
import base64
import json
import mimetypes
import re
from pathlib import Path

AQUI = Path(__file__).resolve().parent
VISOR = AQUI.parent
MIME = {".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg"}

# Les dades es servixen des de memòria: fetch('dades/…') torna el fitxer inclòs
SHIM = ("(function(){var f=window.fetch.bind(window);window.fetch=function(u,o){var k=String(u);"
        "if(Object.prototype.hasOwnProperty.call(window.VISOR_FITXERS,k)){return Promise.resolve("
        "new Response(window.VISOR_FITXERS[k],{status:200}));}return f(u,o);};})();")


def data_uri(cami):
    tipus = MIME.get(cami.suffix.lower()) or mimetypes.guess_type(cami.name)[0] or "application/octet-stream"
    return f"data:{tipus};base64,{base64.b64encode(cami.read_bytes()).decode()}"


def imatges_a_data(text):
    """Substituïx les rutes img/… per data: URI."""
    return re.sub(r"(?<![\w/.])img/[\w./-]+\.(?:svg|webp|png|jpe?g)",
                  lambda m: data_uri(VISOR / m.group(0)) if (VISOR / m.group(0)).exists() else m.group(0), text)


def segur_script(text):
    return text.replace("</script", "<\\/script")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-o", "--sortida", default="visor-avptp-autonom.html")
    args = ap.parse_args()

    cfg = json.loads((VISOR / "dades" / "config.json").read_text(encoding="utf-8"))
    rutes = ["dades/config.json", *cfg.get("fitxers", []), cfg.get("metadades"),
             *[d for d in cfg.get("documentacio", []) if not re.match(r"https?://", d)],
             (cfg.get("limit") or {}).get("fitxer")]
    fitxers = {}
    for r in filter(None, rutes):
        cami = VISOR / r
        if not cami.exists():
            print(f"avís: no es troba {r}")
            continue
        text = cami.read_text(encoding="utf-8")
        fitxers[r] = imatges_a_data(text) if r == "dades/config.json" else text

    html = (VISOR / "index.html").read_text(encoding="utf-8")
    # Sense la correcció de <base> (només té sentit servit com a /visor)
    html = re.sub(r"\s*<!-- Si s'obri com a /visor.*?-->\s*<script>.*?</script>", "\n", html, flags=re.S)
    css = (VISOR / "css" / "visor.css").read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="css/visor.css">', f"<style>\n{css}\n</style>")
    html = imatges_a_data(html)
    dades = "window.VISOR_FITXERS = " + json.dumps(fitxers, ensure_ascii=False) + ";\n" + SHIM
    for js in ("i18n", "visor"):
        codi = (VISOR / "js" / f"{js}.js").read_text(encoding="utf-8")
        bloc = f"<script>\n{segur_script(codi)}\n</script>"
        if js == "i18n":
            bloc = f"<script>\n{segur_script(dades)}\n</script>\n  " + bloc
        html = html.replace(f'<script src="js/{js}.js"></script>', bloc)

    sortida = Path(args.sortida).expanduser()
    sortida.write_text(html, encoding="utf-8")
    print(f"{sortida}: {sortida.stat().st_size / 1024:.0f} kB")


if __name__ == "__main__":
    main()

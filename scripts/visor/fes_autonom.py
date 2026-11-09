#!/usr/bin/env python3
"""
Genera una còpia autònoma del visor en un sol fitxer HTML (dades, estils, logotips i codi dins),
per a obrir-la sense servidor o compartir-la: visor-avptp-autonom.html

    python3 scripts/visor/fes_autonom.py [--eixida visor-avptp-autonom.html]
"""
import argparse
import base64
import json
import mimetypes
import re
from pathlib import Path

AQUI = Path(__file__).resolve().parent
VISOR = AQUI.parent.parent / 'public' / 'visor'
TIPUS = {'.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.gif': 'image/gif'}


def data_uri(cami):
    cami = Path(cami)
    tipus = TIPUS.get(cami.suffix.lower()) or mimetypes.guess_type(cami.name)[0] or 'application/octet-stream'
    return f'data:{tipus};base64,' + base64.b64encode(cami.read_bytes()).decode()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--eixida', default=str(AQUI.parent.parent / 'visor-avptp-autonom.html'))
    args = ap.parse_args()

    cfg = json.loads((VISOR / 'dades' / 'config.json').read_text(encoding='utf-8'))
    for s in cfg['serveis'].values():
        for camp in ('logo', 'logoFitxa'):
            if s.get(camp) and not s[camp].startswith('data:'):
                s[camp] = data_uri(VISOR / s[camp])
    fitxers = {'dades/config.json': json.dumps(cfg, ensure_ascii=False, indent=2)}
    extra = [cfg.get('metadades'), (cfg.get('limit') or {}).get('fitxer')] + list(cfg.get('documentacio') or [])
    for f in list(cfg.get('fitxers', [])) + [e for e in extra if e]:
        fitxers[f] = (VISOR / f).read_text(encoding='utf-8')

    html = (VISOR / 'index.html').read_text(encoding='utf-8')
    # Sense la redirecció de <base>: el fitxer s'obri directament
    html = re.sub(r'\s*<!-- Si s\'obri com a /visor.*?</script>', '', html, flags=re.S)
    html = re.sub(r'(src|href)="(img/[^"]+)"', lambda m: f'{m.group(1)}="{data_uri(VISOR / m.group(2))}"', html)
    css = (VISOR / 'css' / 'visor.css').read_text(encoding='utf-8')
    html = html.replace('<link rel="stylesheet" href="css/visor.css">', f'<style>\n{css}</style>')
    capa = ('window.VISOR_FITXERS = ' + json.dumps(fitxers, ensure_ascii=False) + ';\n'
            '(function(){var f=window.fetch.bind(window);window.fetch=function(u,o){var k=String(u);'
            'if(Object.prototype.hasOwnProperty.call(window.VISOR_FITXERS,k)){return Promise.resolve(new Response(window.VISOR_FITXERS[k],{status:200}));}'
            'return f(u,o);};})();\n')
    i18n = (VISOR / 'js' / 'i18n.js').read_text(encoding='utf-8')
    js = (VISOR / 'js' / 'visor.js').read_text(encoding='utf-8')
    html = html.replace('<script src="js/i18n.js"></script>', f'<script>\n{capa}</script>\n  <script>\n{i18n}</script>')
    html = html.replace('<script src="js/visor.js"></script>', f'<script>\n{js}</script>')
    Path(args.eixida).write_text(html, encoding='utf-8')
    print(f'{args.eixida}: {len(html) / 1024 / 1024:.1f} MB')


if __name__ == '__main__':
    main()

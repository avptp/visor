#!/usr/bin/env python3
"""
Completa les dades del visor (public/visor/dades) amb les capes i correccions que no venen
dels GTFS del NAP. S'ha d'executar després de actualitza_dades.py:

    python3 scripts/actualitza_dades.py --carpeta-gtfs ~/Baixades/nap
    python3 scripts/completa_dades.py

No necessita cap llibreria externa. Tot el que aplica és a scripts/fonts/:

  estatals.geojson                 Línies estatals d'autobús (mapa concessional del MITMS, en projecte),
                                   retallades al límit de la Comunitat i amb el recorregut sencer.
  atmv.geojson                     Concessions de l'ATMV (Met Go).
  tram_castello.geojson            TRAM de Castelló (línia actual i parades).
  tracats_renfe.json               Traçats de Regionals i Mitja distància sobre la xarxa ferroviària de l'ICV.
  correccions_metrovalencia.json   Traçats, parades i colors de les línies 4, 6, 8 i 9 de Metrovalència.
  codis_concessions.json           Codi de contracte de les concessions d'autobús de la Generalitat.

Les capes estàtiques es copien tal qual; les correccions es tornen a aplicar damunt dels fitxers
que genera actualitza_dades.py, així que es pot executar tantes vegades com calga.
"""
import argparse
import json
from pathlib import Path

AQUI = Path(__file__).resolve().parent
ARREL = AQUI.parent
FONTS = AQUI / 'fonts'


def llig(cami):
    return json.loads(Path(cami).read_text(encoding='utf-8'))


def desa(cami, gj):
    Path(cami).write_text(json.dumps(gj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'  {Path(cami).name}: {len(gj.get("features", []))} elements')


def per_id(gj):
    return {f['properties']['id']: f for f in gj['features']}


def metrovalencia(dades):
    cfg = FONTS / 'correccions_metrovalencia.json'
    if not cfg.exists():
        return
    c = llig(cfg)
    mv = llig(dades / 'metrovalencia.geojson')
    est = llig(dades / 'estacions.geojson')
    linies = per_id(mv)
    estacions = per_id(est)
    for i in c.get('elimina_estacions', []):
        estacions.pop(i, None)
    for i, d in c.get('reanomena', {}).items():
        if i in estacions:
            estacions[i]['properties']['nom'] = d['nom']
            estacions[i]['geometry']['coordinates'] = d['coord']
    for i, d in c.get('estacions_noves', {}).items():
        if i not in estacions:
            estacions[i] = {'type': 'Feature', 'properties': {'id': i, 'tipus': 'estacio', 'nom': d['nom'],
                                                                'serveis': ['metrovalencia'], 'linies': []},
                            'geometry': {'type': 'Point', 'coordinates': d['coord']}}
    for lid, d in c['linies'].items():
        f = linies.get(lid)
        if not f:
            continue
        p = f['properties']
        if d.get('nom'):
            p['nom'] = d['nom']
            p.pop('nom_es', None)
        if d.get('color'):
            p['color'] = d['color']
        if d.get('geom'):
            f['geometry'] = {'type': 'MultiLineString', 'coordinates': d['geom']}
        if d.get('parades'):
            p['parades'] = d['parades']
        if d.get('ramals'):
            p['ramals'] = [{'nom': r['nom'], 'parades': r['parades']} for r in d['ramals']]
    # Línies que paren a cada estació, a partir dels recorreguts corregits
    for e in estacions.values():
        if 'metrovalencia' in e['properties'].get('serveis', []):
            e['properties']['linies'] = [l for l in e['properties'].get('linies', []) if not l.startswith('metrovalencia:')]
    for lid, f in linies.items():
        ps = list(f['properties'].get('parades', []))
        for r in f['properties'].get('ramals', []):
            ps += r['parades']
        for i in ps:
            if i in estacions and lid not in estacions[i]['properties']['linies']:
                estacions[i]['properties']['linies'].append(lid)
    est['features'] = list(estacions.values())
    desa(dades / 'metrovalencia.geojson', mv)
    desa(dades / 'estacions.geojson', est)


def renfe(dades):
    cfg = FONTS / 'tracats_renfe.json'
    if not cfg.exists():
        return
    c = llig(cfg)['linies']
    for fitxer in ('regionals', 'md'):
        gj = llig(dades / f'{fitxer}.geojson')
        for f in gj['features']:
            d = c.get(f['properties']['id'])
            if d:
                f['geometry'] = {'type': 'MultiLineString', 'coordinates': d['geom']}
        desa(dades / f'{fitxer}.geojson', gj)


def codis(dades):
    cfg = FONTS / 'codis_concessions.json'
    if not cfg.exists():
        return
    c = llig(cfg)['codis']
    gj = llig(dades / 'bus_interurba.geojson')
    for f in gj['features']:
        p = f['properties']
        codi = c.get(p['id']) or c.get(p['nom'])
        if codi:
            p['codi'] = codi
    desa(dades / 'bus_interurba.geojson', gj)


def copia(dades, nom):
    origen = FONTS / nom
    if origen.exists():
        desa(dades / nom, llig(origen))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--dades', default=str(ARREL / 'dades'))
    args = ap.parse_args()
    dades = Path(args.dades)
    print('Completant les dades:')
    metrovalencia(dades)
    renfe(dades)
    codis(dades)
    for nom in ('estatals.geojson', 'atmv.geojson', 'tram_castello.geojson', 'emt_valencia.geojson', 'urba_alacant.geojson'):
        copia(dades, nom)
    copia_limit = AQUI / 'limit_cv.geojson'
    if copia_limit.exists():
        (dades / 'limit_cv.geojson').write_text(copia_limit.read_text(encoding='utf-8'), encoding='utf-8')
    print('Fet.')


if __name__ == '__main__':
    main()

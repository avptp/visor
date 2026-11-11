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
  correccions_ferrocarril.json     Correccions de línies de Renfe (la C1 d'Alacant comença a Alacant Terminal).
  brt_xirivella.geojson            BRT València – Xirivella – Aldaia/Alaquàs (en projecte), dels plànols de l'estudi informatiu.
  avant.geojson                    Servicis AVANT de Renfe per la LAV (Múrcia – Alacant i València – Requena-Utiel), amb les parades.
  ferrocarril_fora_cv.json         Parades i traçat de fora de la Comunitat de les línies de ferrocarril que en
                                   ixen (C1 fins a Múrcia, Vinaròs–Tortosa, Albacete, Terol–Saragossa).
  bus_projectes.geojson            Concessions interurbanes en projecte (CV-207, CV-210, CV-213, CV-303),
                                   modelades a partir dels annexos de parades dels projectes de servici.

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


def correccions_ferrocarril(dades):
    cfg = FONTS / 'correccions_ferrocarril.json'
    if not cfg.exists():
        return
    import math
    cfg = llig(cfg)
    c = cfg['linies']
    trams = cfg.get('trams', {})
    est = per_id(llig(dades / 'estacions.geojson'))
    for i, info in cfg.get('estacions', {}).items():
        if i not in est:
            est[i] = {'type': 'Feature', 'properties': {'id': i, 'tipus': 'estacio', 'nom': info['nom'], 'serveis': [], 'linies': []},
                      'geometry': {'type': 'Point', 'coordinates': info['coord']}}
        est[i]['geometry']['coordinates'] = info['coord']
    canvis_est = bool(cfg.get('estacions'))
    km = lambda a, b: math.hypot((a[0] - b[0]) * 86.0, (a[1] - b[1]) * 111.0)
    for fitxer in ('rodalies', 'regionals', 'md'):
        gj = llig(dades / f'{fitxer}.geojson')
        linies = per_id(gj)
        canvi = False
        for lid, d in c.items():
            f = linies.get(lid)
            if not f:
                continue
            p = f['properties']
            if d.get('nom'):
                p['nom'] = d['nom']
            treu = set(d.get('treu_parades', []))
            p['parades'] = [i for i in p.get('parades', []) if i not in treu]
            for i in treu:
                if i in est and lid in est[i]['properties'].get('linies', []):
                    est[i]['properties']['linies'].remove(lid)
                    canvis_est = True
            noves = d.get('afegeix_parades_inici', []) + d.get('afegeix_parades_final', [])
            if noves:
                resta = [i for i in p['parades'] if i not in noves]
                p['parades'] = d.get('afegeix_parades_inici', []) + resta + d.get('afegeix_parades_final', [])
                servei = lid.split(':')[0]
                for i in noves:
                    ep = est[i]['properties']
                    if servei not in ep['serveis']:
                        ep['serveis'].append(servei)
                    if lid not in ep['linies']:
                        ep['linies'].append(lid)
                canvis_est = True
            tram = trams.get(d.get('substitueix_tram'))
            if tram:
                g = f['geometry']
                parts = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
                for k, part in enumerate(parts):
                    ia = min(range(len(part)), key=lambda n: km(part[n], tram[0]))
                    ib = min(range(len(part)), key=lambda n: km(part[n], tram[-1]))
                    if km(part[ia], tram[0]) > 2 or km(part[ib], tram[-1]) > 2 or ia == ib:
                        continue
                    t = tram if ia < ib else tram[::-1]
                    a, b = sorted((ia, ib))
                    parts[k] = part[:a] + t + part[b + 1:]
                if g['type'] == 'MultiLineString':
                    g['coordinates'] = parts
                else:
                    g['coordinates'] = parts[0]
            altra = linies.get(d.get('treu_tram_de'))
            if altra:
                ref = [q for t in altra['geometry']['coordinates'] for q in t]
                centre = est.get(d.get('conserva_prop_de'), {}).get('geometry', {}).get('coordinates')
                nous = []
                for tram in f['geometry']['coordinates']:
                    cur = []
                    for q in tram:
                        sobra = min(km(q, r) for r in ref) < 0.04 and not (centre and km(q, centre) < 0.4)
                        if sobra:
                            if len(cur) >= 2:
                                nous.append(cur)
                            cur = []
                        else:
                            cur.append(q)
                    if len(cur) >= 2:
                        nous.append(cur)
                f['geometry']['coordinates'] = nous
            canvi = True
        if canvi:
            desa(dades / f'{fitxer}.geojson', gj)
    if canvis_est:
        e = llig(dades / 'estacions.geojson')
        e['features'] = list(est.values())
        desa(dades / 'estacions.geojson', e)


def avant(dades):
    """Copia les línies AVANT a dades/avant.geojson i n'afig les parades a estacions.geojson."""
    cfg = FONTS / 'avant.geojson'
    if not cfg.exists():
        return
    gj = llig(cfg)
    linies = [f for f in gj['features'] if f['properties']['tipus'] != 'estacio']
    desa(dades / 'avant.geojson', {'type': 'FeatureCollection', 'features': linies})
    e = llig(dades / 'estacions.geojson')
    est = per_id(e)
    for f in gj['features']:
        p = f['properties']
        if p['tipus'] != 'estacio':
            continue
        if p['id'] not in est:
            est[p['id']] = f
            continue
        ep = est[p['id']]['properties']
        for k in ('serveis', 'linies'):
            ep.setdefault(k, [])
            for v in p[k]:
                if v not in ep[k]:
                    ep[k].append(v)
    e['features'] = list(est.values())
    desa(dades / 'estacions.geojson', e)


def fora_cv(dades):
    """Línies de ferrocarril que ixen de la Comunitat: el traçat es queda retallat, però s'hi afig el
    recorregut sencer (`complet`, que el visor dibuixa difuminat) i les parades de fora (`fora_cv`)."""
    cfg = FONTS / 'ferrocarril_fora_cv.json'
    if not cfg.exists():
        return
    c = llig(cfg)
    est = llig(dades / 'estacions.geojson')
    estacions = per_id(est)
    for fitxer in ('rodalies', 'regionals', 'md'):
        gj = llig(dades / f'{fitxer}.geojson')
        canvi = False
        for f in gj['features']:
            p = f['properties']
            d = c['linies'].get(p['id'])
            if not d:
                continue
            fora = set(d['abans']) | set(d['despres'])
            dins = [i for i in p.get('parades', []) if i not in fora]
            p['parades'] = d['abans'] + dins + d['despres']
            g = f['geometry']
            trams = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
            p['complet'] = {'type': 'MultiLineString', 'coordinates': trams + [d['tracat_fora']]}
            for i in d['abans'] + d['despres']:
                e = estacions.get(i)
                if not e:
                    info = c['estacions'][i]
                    e = estacions[i] = {'type': 'Feature', 'properties': {'id': i, 'tipus': 'estacio', 'nom': info['nom'],
                                                                         'serveis': [], 'linies': [], 'fora_cv': True},
                                        'geometry': {'type': 'Point', 'coordinates': info['coord']}}
                ep = e['properties']
                if d['servei'] not in ep['serveis']:
                    ep['serveis'].append(d['servei'])
                if p['id'] not in ep['linies']:
                    ep['linies'].append(p['id'])
            canvi = True
        if canvi:
            desa(dades / f'{fitxer}.geojson', gj)
    est['features'] = list(estacions.values())
    desa(dades / 'estacions.geojson', est)


def projectes(dades):
    """Afig a bus_interurba.geojson les concessions en projecte (substituint les que ja hi haguera)."""
    cfg = FONTS / 'bus_projectes.geojson'
    if not cfg.exists():
        return
    nous = llig(cfg)['features']
    ids = {f['properties']['id'] for f in nous}
    gj = llig(dades / 'bus_interurba.geojson')
    gj['features'] = [f for f in gj['features'] if f['properties']['id'] not in ids] + nous
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
    correccions_ferrocarril(dades)
    fora_cv(dades)
    avant(dades)
    codis(dades)
    projectes(dades)
    for nom in ('estatals.geojson', 'atmv.geojson', 'tram_castello.geojson', 'emt_valencia.geojson', 'urba_alacant.geojson', 'brt_xirivella.geojson'):
        copia(dades, nom)
    copia_limit = AQUI / 'limit_cv.geojson'
    if copia_limit.exists():
        (dades / 'limit_cv.geojson').write_text(copia_limit.read_text(encoding='utf-8'), encoding='utf-8')
    print('Fet.')


if __name__ == '__main__':
    main()

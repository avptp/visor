#!/usr/bin/env python3
"""
Línies urbanes: convertix el GTFS d'una xarxa municipal d'autobusos en una sola entrada del visor,
amb totes les línies i cada carrer dibuixat una única vegada.

    python3 scripts/xarxa_urbana.py CARPETA_GTFS scripts/fonts/emt_valencia.geojson
    python3 scripts/xarxa_urbana.py CARPETA_GTFS scripts/fonts/urba_alacant.geojson \\
        --id urba_alacant --codi Urbà --nom "Autobús urbà d'Alacant" \\
        --nom-es "Autobús urbano de Alicante" --web https://alicante.vectalia.es/ --articles-majuscula

CARPETA_GTFS és el zip del GTFS descomprimit. Després cal executar completa_dades.py.
"""
import csv
import json
import math
import re
import sys
from collections import Counter, defaultdict

import argparse
ap = argparse.ArgumentParser()
ap.add_argument('gtfs'); ap.add_argument('sortida')
ap.add_argument('--id', default='emt_valencia'); ap.add_argument('--codi', default='EMT')
ap.add_argument('--nom', default='EMT València'); ap.add_argument('--nom-es', default='EMT Valencia')
ap.add_argument('--web', default='https://www.emtvalencia.es'); ap.add_argument('--articles-majuscula', action='store_true'); ap.add_argument('--servei', default='urbans')
A = ap.parse_args()
D = A.gtfs
SORTIDA = A.sortida
rd = lambda f: list(csv.DictReader(open(f'{D}/{f}', encoding='utf-8-sig')))
routes = rd('routes.txt')
trips = rd('trips.txt')
stops = {s['stop_id']: s for s in rd('stops.txt')}

# Recorreguts per línia: els traçats amb almenys un 5 % dels viatges de la línia (s'ometen variants puntuals)
viatges = defaultdict(Counter)
for t in trips:
    viatges[t['route_id']][t['shape_id']] += 1
formes = set()
for r, c in viatges.items():
    tot = sum(c.values())
    for s, n in c.items():
        if n / tot >= 0.05:
            formes.add(s)
pts = defaultdict(list)
for row in csv.DictReader(open(f'{D}/shapes.txt', encoding='utf-8-sig')):
    if row['shape_id'] in formes:
        pts[row['shape_id']].append((int(row['shape_pt_sequence']), float(row['shape_pt_lon']), float(row['shape_pt_lat'])))
linies = [[(x, y) for _, x, y in sorted(v)] for v in pts.values()]

# Parades amb servici
usades = set()
trip_forma = {t['trip_id'] for t in trips}
with open(f'{D}/stop_times.txt', encoding='utf-8-sig') as fh:
    for row in csv.DictReader(fh):
        usades.add(row['stop_id'])


def dp(pts, tol):
    """Douglas-Peucker iteratiu."""
    n = len(pts)
    if n < 3:
        return list(pts)
    keep = bytearray(n)
    keep[0] = keep[-1] = 1
    pila = [(0, n - 1)]
    t2 = tol * tol
    while pila:
        a, b = pila.pop()
        x1, y1 = pts[a]
        x2, y2 = pts[b]
        dx, dy = x2 - x1, y2 - y1
        L = dx * dx + dy * dy
        md, mi = -1, -1
        for i in range(a + 1, b):
            x, y = pts[i]
            t = ((x - x1) * dx + (y - y1) * dy) / L if L else 0
            t = 0 if t < 0 else 1 if t > 1 else t
            ex, ey = x1 + t * dx - x, y1 + t * dy - y
            d = ex * ex + ey * ey
            if d > md:
                md, mi = d, i
        if md > t2:
            keep[mi] = 1
            pila += [(a, mi), (mi, b)]
    return [p for p, k in zip(pts, keep) if k]


KX = math.cos(math.radians(39.47)) * 111320
KY = 110540
CEL = 0.0002


def k(p):
    return (int(p[0] // CEL), int(p[1] // CEL))


def coberta(p, idx, radi=12):
    kk = k(p)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for q in idx.get((kk[0] + dx, kk[1] + dy), ()):
                if math.hypot((p[0] - q[0]) * KX, (p[1] - q[1]) * KY) < radi:
                    return True
    return False


def dens(l, pas=CEL / 2):
    res = [l[0]]
    for a, b in zip(l, l[1:]):
        n = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / pas))
        for j in range(1, n + 1):
            res.append((a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n))
    return res


linies.sort(key=lambda l: -len(l))
idx, trossos = {}, []
for l in linies:
    dl = dens(l)
    tros = []
    for i, p in enumerate(dl):
        if not coberta(p, idx):
            if not tros and i > 0:
                tros.append(dl[i - 1])
            tros.append(p)
        elif tros:
            tros.append(p)
            if len(tros) >= 3:
                trossos.append(tros)
            tros = []
    if len(tros) >= 2:
        trossos.append(tros)
    for p in dl:
        idx.setdefault(k(p), []).append(p)
geom = [[[round(x, 5), round(y, 5)] for x, y in dp(t, 0.00003)] for t in trossos]
geom = [g for g in geom if len(g) >= 2]

PETITES = {'de', 'del', 'la', 'les', 'el', 'els', 'i', 'a', 'dels', 'per', 'y', 'las', 'los'}


ARTICLES = {'la', 'les', 'el', 'els', 'las', 'los'}


def nom(s, codi=''):
    if codi and s.strip().upper().startswith(codi.upper() + ' - '):
        s = s.strip()[len(codi) + 3:]
    s = re.sub(r'\s+', ' ', s).strip()
    paraules = []
    for i, w in enumerate(s.lower().split(' ')):
        if re.fullmatch(r'[ivxl]+', w) and len(w) > 1:
            paraules.append(w.upper())
        elif i and w in PETITES and not (A.articles_majuscula and w in ARTICLES):
            paraules.append(w)
        elif w.startswith("l'") or w.startswith("d'"):
            paraules.append(w[:2] + w[2:3].upper() + w[3:])
        else:
            paraules.append('/'.join('-'.join(y[:1].upper() + y[1:] for y in x.split('-')) for x in w.split('/')))
    s = re.sub(r'\((\w)', lambda m: '(' + m.group(1).upper(), ' '.join(paraules))
    s = s.replace(' - ', ' – ').replace('Marcel.li', 'Marcel·lí').replace('Ffcc', 'FFCC')
    return re.sub(r'([A-Za-zÀ-ÿ])\.([A-Za-zÀ-ÿ])', lambda m: m.group(1) + '. ' + m.group(2).upper(), s)


vist = {}
for r in routes:
    vist.setdefault(r['route_short_name'], nom(r['route_long_name'], r['route_short_name']))
ordre = lambda c: (0 if c[0].isdigit() else 1, int(re.sub(r'\D', '', c) or 0), c)
llista = [f'{c} {vist[c]}' for c in sorted(vist, key=ordre)]
f = {'type': 'Feature', 'properties': {
    'tipus': 'concessio', 'servei': A.servei, 'id': A.id, 'codi': A.codi, 'nom': A.nom, 'nom_es': A.nom_es,
    'estat': 'servei', 'web': A.web, 'linies_bus': llista, 'n_parades': len(usades)},
    'geometry': {'type': 'MultiLineString', 'coordinates': geom}}
s = json.dumps({'type': 'FeatureCollection', 'features': [f]}, ensure_ascii=False, separators=(',', ':'))
open(SORTIDA, 'w', encoding='utf-8').write(s)
print(len(vist), 'línies', len(formes), 'traçats', len(geom), 'trams', sum(map(len, geom)), 'punts', len(s) // 1024, 'kB', len(usades), 'parades')
print(llista[:8])

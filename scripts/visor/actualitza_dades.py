#!/usr/bin/env python3
"""
Actualitza les dades del visor de l'AVPTP (public/visor/dades) a partir dels
fitxers GTFS del Punt d'Accés Nacional (NAP) del Ministeri de Transports
(https://nap.transportes.gob.es) i dels traçats propis de l'associació
(scripts/visor/fonts/AVPTP_xarxa.gpkg).

L'actualització és manual:
  1. Descarrega del NAP els fitxers GTFS en una carpeta (sense canviar-los el nom).
  2. Executa:
         python3 scripts/visor/actualitza_dades.py --carpeta-gtfs ~/Baixades/nap
  3. Revisa el visor en local i puja els canvis de public/visor/dades.

Per a cada font s'agafa el fitxer més recent de la carpeta el nom del qual
coincidix amb el patró «fitxer» de serveis.json. També es pot indicar a mà:
         --local renfe_ld=~/Baixades/20261108_010008_RENFE_AVLD_MD_REG.zip

Quines rutes s'agafen i com s'agrupen es defineix a scripts/visor/serveis.json.
Dependències: pip install -r scripts/visor/requirements.txt
"""
import argparse
import csv
import sqlite3
import datetime as dt
import io
import json
import math
import os
import re
import sys
import urllib.request
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

try:
    from shapely.geometry import LineString, MultiLineString, Point, mapping, shape
    from shapely.ops import linemerge, substring, unary_union
    from shapely import wkb
except ImportError:
    sys.exit("Falta shapely: pip install -r scripts/visor/requirements.txt")

AQUI = Path(__file__).resolve().parent
ARREL = AQUI.parent.parent
NAP_URL = "https://nap.transportes.gob.es/api/Fichero/download/{id}"
SIMPLIFICA = 0.00003      # graus (~3 m)
TOL_PRESTEC = 0.003       # graus (~300 m) per a aprofitar traçats d'una altra font


def avis(text):
    print(f"  ! {text}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Lectura de GTFS
# ---------------------------------------------------------------------------

def files_csv(z, nom):
    """Llig un fitxer del GTFS i retorna diccionaris amb claus i valors nets."""
    candidats = [n for n in z.namelist() if n.rsplit("/", 1)[-1] == nom]
    if not candidats:
        return
    text = io.TextIOWrapper(z.open(candidats[0]), encoding="utf-8-sig", errors="replace", newline="")
    lector = csv.reader(text)
    try:
        cap = [c.strip() for c in next(lector)]
    except StopIteration:
        return
    for fila in lector:
        if fila:
            yield {c: (fila[i].strip() if i < len(fila) else "") for i, c in enumerate(cap)}


class Feed:
    def __init__(self, clau, cami, prefix):
        self.clau, self.prefix, self.cami = clau, prefix, Path(cami)
        self.z = zipfile.ZipFile(cami)
        self.agencies = {a.get("agency_id", ""): a for a in files_csv(self.z, "agency.txt")}
        self.rutes = {r["route_id"]: r for r in files_csv(self.z, "routes.txt")}
        unica = next(iter(self.agencies)) if len(self.agencies) == 1 else ""
        for r in self.rutes.values():
            r["agency_id"] = r.get("agency_id") or unica
        self.viatges = {t["trip_id"]: t for t in files_csv(self.z, "trips.txt")}
        self.parades = {s["stop_id"]: s for s in files_csv(self.z, "stops.txt")}
        self.seq = {}            # trip_id -> tupla d'estacions (ordenada)
        self._shapes = None

    def estacio(self, stop_id):
        s = self.parades.get(stop_id)
        if not s:
            return None
        pare = s.get("parent_station", "")
        return pare if pare in self.parades else stop_id

    def coord(self, stop_id):
        s = self.parades.get(stop_id)
        try:
            return (float(s["stop_lon"]), float(s["stop_lat"]))
        except (TypeError, KeyError, ValueError):
            return None

    def nom_parada(self, stop_id):
        return (self.parades.get(stop_id) or {}).get("stop_name", stop_id)

    def llig_seqs(self, trips):
        """Una sola passada per stop_times.txt per als viatges indicats."""
        if not trips:
            return
        candidats = [n for n in self.z.namelist() if n.rsplit("/", 1)[-1] == "stop_times.txt"]
        if not candidats:
            return
        text = io.TextIOWrapper(self.z.open(candidats[0]), encoding="utf-8-sig", errors="replace", newline="")
        lector = csv.reader(text)
        cap = [c.strip() for c in next(lector)]
        it, ist, iseq = cap.index("trip_id"), cap.index("stop_id"), cap.index("stop_sequence")
        brut = defaultdict(list)
        for fila in lector:
            if len(fila) <= max(it, ist, iseq):
                continue
            t = fila[it].strip()
            if t in trips:
                try:
                    brut[t].append((int(float(fila[iseq])), fila[ist].strip()))
                except ValueError:
                    pass
        cache = {}
        for t, llista in brut.items():
            ids = []
            for _, sid in sorted(llista):
                e = self.estacio(sid)
                if e and (not ids or ids[-1] != e):
                    ids.append(e)
            tup = tuple(ids)
            self.seq[t] = cache.setdefault(tup, tup)

    def shapes(self):
        if self._shapes is None:
            brut = defaultdict(list)
            for p in files_csv(self.z, "shapes.txt") or []:
                try:
                    brut[p["shape_id"]].append((float(p["shape_pt_sequence"]),
                                                float(p["shape_pt_lon"]), float(p["shape_pt_lat"])))
                except (KeyError, ValueError):
                    pass
            self._shapes = {k: [(x, y) for _, x, y in sorted(v)] for k, v in brut.items()}
        return self._shapes

    def periode(self):
        dates = []
        for c in files_csv(self.z, "calendar.txt") or []:
            dates += [c.get("start_date", ""), c.get("end_date", "")]
        for c in files_csv(self.z, "calendar_dates.txt") or []:
            dates.append(c.get("date", ""))
        dates = sorted(d for d in dates if re.fullmatch(r"\d{8}", d))
        fmt = lambda d: f"{d[:4]}-{d[4:6]}-{d[6:]}"
        return [fmt(dates[0]), fmt(dates[-1])] if dates else None


# ---------------------------------------------------------------------------
# Obtenció dels fitxers
# ---------------------------------------------------------------------------

def descarrega(clau, cfg, desti, api_key):
    url = cfg.get("url") or NAP_URL.format(id=cfg["nap"])
    capcaleres = {"User-Agent": "avptp-visor/1.0"}
    if api_key and "nap.transportes.gob.es" in url:
        capcaleres["ApiKey"] = api_key
    with urllib.request.urlopen(urllib.request.Request(url, headers=capcaleres), timeout=300) as r:
        dades = r.read()
    if not dades.startswith(b"PK"):
        # Alguns fitxers del NAP es descarreguen en dues passes: primer torna un enllaç
        m = re.search(rb"https?://[^\s\"'}]+", dades)
        if not m:
            raise RuntimeError(f"la resposta no és un zip ({dades[:120]!r})")
        with urllib.request.urlopen(urllib.request.Request(m.group(0).decode(), headers=capcaleres), timeout=300) as r:
            dades = r.read()
    if not dades.startswith(b"PK"):
        raise RuntimeError("la resposta no és un zip")
    desti.write_bytes(dades)


def data_fitxer(feed):
    """Data dels fitxers dins del zip (o, si no és vàlida, la del zip)."""
    try:
        return dt.datetime(*max(i.date_time for i in feed.z.infolist())).date().isoformat()
    except ValueError:
        return dt.date.fromtimestamp(feed.cami.stat().st_mtime).isoformat()


def obte_fonts(cfg_fonts, args, necessaries):
    locals_ = dict(v.split("=", 1) for v in args.local)
    carpeta = Path(args.carpeta_gtfs) if args.carpeta_gtfs else None
    cache = Path(args.cache)
    cache.mkdir(parents=True, exist_ok=True)
    api_key = os.environ.get("NAP_API_KEY", "")
    feeds, origens = {}, {}
    for clau in sorted(necessaries):
        cfg = cfg_fonts[clau]
        cami = None
        if clau in locals_:
            cami = Path(locals_[clau]).expanduser()
        elif carpeta and (carpeta / f"{clau}.zip").exists():
            cami = carpeta / f"{clau}.zip"
        elif carpeta and cfg.get("fitxer") and sorted(
                p for p in carpeta.glob("*.zip") if re.search(cfg["fitxer"], p.name)):
            cami = sorted(p for p in carpeta.glob("*.zip") if re.search(cfg["fitxer"], p.name))[-1]
        elif api_key or cfg.get("url"):
            cami = cache / f"{clau}.zip"
            print(f"Descarregant {clau} (NAP {cfg.get('nap', '-')})…")
            try:
                descarrega(clau, cfg, cami, api_key)
            except Exception as e:  # noqa: BLE001
                avis(f"no s'ha pogut descarregar {clau}: {e}")
                cami = None
        if not cami or not cami.exists():
            avis(f"sense fitxer per a «{clau}»: els servicis que en depenen quedaran buits")
            continue
        print(f"Llegint {clau}: {cami}")
        feeds[clau] = Feed(clau, cami, cfg["prefix"])
        origens[clau] = {"nap": cfg.get("nap"), "nom": cfg.get("nom", clau),
                         "periode": feeds[clau].periode(),
                         "fitxer": data_fitxer(feeds[clau])}
    return feeds, origens


# ---------------------------------------------------------------------------
# Geometria
# ---------------------------------------------------------------------------

def neteja_nom(nom):
    nom = re.sub(r"\s+", " ", nom or "").strip()
    return re.sub(r"\s+-\s*|\s*-\s+", " – ", nom)


def ordre_natural(text):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", str(text or ""))]


def distancia_m(a, b):
    dx = (a[0] - b[0]) * 111320 * math.cos(math.radians((a[1] + b[1]) / 2))
    dy = (a[1] - b[1]) * 110540
    return math.hypot(dx, dy)


def encadena(base, patrons):
    """Allarga un recorregut amb els patrons que comencen on acaba (o acaben on comença)."""
    res = list(base)
    canvi = True
    while canvi:
        canvi = False
        for pat, _ in patrons.most_common():
            for p in (pat, pat[::-1]):
                if p[0] == res[-1] and not set(p[1:]) & set(res):
                    res += p[1:]
                    canvi = True
                elif p[-1] == res[0] and not set(p[:-1]) & set(res):
                    res = list(p[:-1]) + res
                    canvi = True
    return tuple(res)


class Prestec:
    """Traçats d'una altra font per a dibuixar trams que no tenen shapes."""

    def __init__(self, linies):
        self.linies = [(l, l.bounds) for l in linies if l.length > 0]

    def tram(self, a, b):
        pa, pb = Point(a), Point(b)
        recta = pa.distance(pb)
        millor = None
        t = TOL_PRESTEC
        for l, (x0, y0, x1, y1) in self.linies:
            if not (x0 - t <= a[0] <= x1 + t and y0 - t <= a[1] <= y1 + t
                    and x0 - t <= b[0] <= x1 + t and y0 - t <= b[1] <= y1 + t):
                continue
            da, db = l.distance(pa), l.distance(pb)
            if da > t or db > t:
                continue
            sa, sb = l.project(pa), l.project(pb)
            if abs(sb - sa) < 1e-7:
                continue
            seg = substring(l, min(sa, sb), max(sa, sb))
            if seg.length > 2.5 * recta + 0.005:
                continue
            coords = list(seg.coords)
            if sa > sb:
                coords.reverse()
            if millor is None or da + db < millor[0]:
                millor = (da + db, coords)
        return [a] + millor[1] + [b] if millor else [a, b]


def a_multilinia(geom, tol=SIMPLIFICA):
    """Converteix a MultiLineString simplificada, amb coordenades arrodonides."""
    if geom is None or geom.is_empty:
        return None
    if geom.geom_type == "GeometryCollection":
        parts = [g for g in geom.geoms if g.geom_type in ("LineString", "MultiLineString")]
        geom = unary_union(parts) if parts else None
        if geom is None or geom.is_empty:
            return None
    if geom.geom_type == "MultiLineString":
        geom = linemerge(geom)
    geom = geom.simplify(tol, preserve_topology=False)
    parts = list(geom.geoms) if geom.geom_type == "MultiLineString" else [geom]
    sortida = []
    for p in parts:
        cs = []
        for x, y in p.coords:
            c = [round(x, 5), round(y, 5)]
            if not cs or cs[-1] != c:
                cs.append(c)
        if len(cs) >= 2:
            sortida.append(cs)
    return {"type": "MultiLineString", "coordinates": sortida} if sortida else None


# ---------------------------------------------------------------------------
# Construcció
# ---------------------------------------------------------------------------

class Constructor:
    def __init__(self, cfg, feeds, limit):
        self.cfg, self.feeds = cfg, feeds
        # Les línies es retallen amb un marge de ~400 m; les estacions, amb el límit exacte
        self.estricte = limit
        self.limit = limit.buffer(0.004) if limit is not None else None
        self.estacions = {}                       # id -> dades de l'estació
        self.concessions_parada = defaultdict(set)  # (font, stop_id) -> concessions
        self.productes_parada = defaultdict(set)   # stop_id (adif) -> productes Renfe
        self.prestecs = {}

    # --- selecció --------------------------------------------------------
    def rutes_servei(self, s, feed):
        f = s.get("filtre", {})
        res = []
        for rid, r in feed.rutes.items():
            ag = feed.agencies.get(r.get("agency_id", ""), {}).get("agency_name", "")
            if "route_type" in f and r.get("route_type") not in f["route_type"]:
                continue
            if "route_id_prefix" in f and not any(rid.startswith(p) for p in f["route_id_prefix"]):
                continue
            if "agencia_nom" in f and not re.search(f["agencia_nom"], ag, re.I):
                continue
            if "agencia_nom_exclou" in f and re.search(f["agencia_nom_exclou"], ag, re.I):
                continue
            if "productes" in s and r.get("route_short_name") not in s["productes"]:
                continue
            res.append(rid)
        return set(res)

    def viatges_de(self, feed, rutes):
        return {t for t, v in feed.viatges.items() if v.get("route_id") in rutes}

    # --- estacions -------------------------------------------------------
    def dins(self, c):
        return c is not None and (self.estricte is None or self.estricte.contains(Point(c)))

    def registra_estacio(self, feed, sid, servei, linia_id):
        gid = f"{feed.prefix}:{sid}"
        e = self.estacions.get(gid)
        if not e:
            c = feed.coord(sid)
            e = self.estacions[gid] = {"id": gid, "nom": feed.nom_parada(sid), "coord": c,
                                       "serveis": [], "linies": []}
        if servei not in e["serveis"]:
            e["serveis"].append(servei)
        if linia_id not in e["linies"]:
            e["linies"].append(linia_id)
        return gid

    # --- geometria de grup -----------------------------------------------
    def geometria(self, s, feed, trips, patrons):
        shapes = Counter(feed.viatges[t].get("shape_id") for t in trips if feed.viatges[t].get("shape_id"))
        linies = []
        if shapes:
            disp = feed.shapes()
            candidats = [LineString(disp[sid]) for sid in shapes if len(disp.get(sid, ())) >= 2]
            # Del traçat més llarg al més curt: les variants que ja queden cobertes
            # per un traçat dibuixat (a menys de ~30 m) no s'hi tornen a afegir
            cobert = None
            for l in sorted(candidats, key=lambda l: l.length, reverse=True):
                if cobert is not None and l.difference(cobert).length < 0.05 * l.length:
                    continue
                linies.append(l)
                zona = l.buffer(0.0003, resolution=2)
                cobert = zona if cobert is None else cobert.union(zona)
        if not linies:
            prestec = self.prestec(s)
            segments, cobertes = set(), set()
            # Del patró més llarg al més curt: els trens semidirectes que salten
            # estacions ja dibuixades no afegeixen trams rectes per damunt de la via
            for pat in sorted(patrons, key=len, reverse=True):
                for a_id, b_id in zip(pat, pat[1:]):
                    if a_id in cobertes and b_id in cobertes:
                        continue
                    a, b = feed.coord(a_id), feed.coord(b_id)
                    if a and b and a != b:
                        segments.add((a, b) if a < b else (b, a))
                cobertes.update(pat)
            for a, b in segments:
                pts = prestec.tram(a, b) if prestec else [a, b]
                linies.append(LineString(pts))
            if not linies:
                return None
            geom = unary_union(linies)
        else:
            geom = MultiLineString(linies)
        if s.get("retalla_cv") and self.limit is not None:
            geom = geom.intersection(self.limit)
        return a_multilinia(geom, s.get("simplifica", SIMPLIFICA))

    def prestec(self, s):
        fonts = [f for f in s.get("geometria_de", []) if f in self.feeds]
        if not fonts:
            return None
        clau = tuple(fonts)
        if clau not in self.prestecs:
            ls = []
            for f in fonts:
                for pts in self.feeds[f].shapes().values():
                    if len(pts) >= 2 and (self.limit is None or self.limit.intersects(LineString(pts))):
                        ls.append(LineString(pts))
            self.prestecs[clau] = Prestec(ls)
        return self.prestecs[clau]

    # --- servicis --------------------------------------------------------
    def grups(self, s, feed, rutes):
        """Retorna {clau: {"trips": set, "def": dict}} segons el mode d'agrupació."""
        trips = self.viatges_de(feed, rutes)
        grups = defaultdict(lambda: {"trips": set(), "def": {}})
        mode = s.get("agrupa", "codi")
        if mode == "patrons":
            defs = s.get("linies", [])
            for t in trips:
                noms = [feed.nom_parada(e) for e in feed.seq.get(t, ())]
                for d in defs:
                    totes = all(any(re.search(p, n) for n in noms) for p in d.get("parades_totes", []))
                    alguna = not d.get("parades_alguna") or any(
                        re.search(p, n) for p in d["parades_alguna"] for n in noms)
                    if totes and alguna:
                        grups[d["id"]]["trips"].add(t)
                        grups[d["id"]]["def"] = d
                        break
            return grups
        for t in trips:
            r = feed.rutes[feed.viatges[t]["route_id"]]
            if mode == "agencia":
                clau = r.get("agency_id", "")
            else:
                clau = s.get("clau", "{short}").format(
                    short=r.get("route_short_name", ""), rid3=r["route_id"][:3], agency=r.get("agency_id", ""))
                if clau in s.get("exclou_claus", []):
                    continue
            grups[clau]["trips"].add(t)
        return grups

    def servei(self, s):
        feed = self.feeds.get(s["font"])
        if not feed:
            return []
        rutes = self.rutes_servei(s, feed)
        grups = self.grups(s, feed, rutes)
        features = []
        for clau, g in grups.items():
            trips = [t for t in g["trips"] if feed.seq.get(t)]
            if not trips:
                continue
            patrons = Counter(feed.seq[t] for t in trips)
            # Recorregut: el patró amb més parades (i, a igualtat, el més freqüent),
            # allargat amb els patrons que hi enllacen pels extrems
            principal = encadena(max(patrons, key=lambda p: (len(p), patrons[p])), patrons)
            encadenat = principal != max(patrons, key=lambda p: (len(p), patrons[p]))
            rutes_grup = Counter(feed.viatges[t]["route_id"] for t in trips)
            llarg_ruta = defaultdict(int)
            for t in trips:
                r = feed.viatges[t]["route_id"]
                llarg_ruta[r] = max(llarg_ruta[r], len(feed.seq[t]))
            r0 = feed.rutes[max(rutes_grup, key=lambda r: (llarg_ruta[r], rutes_grup[r]))]
            props = {"tipus": s["tipus"], "servei": s["id"]}
            if s.get("agrupa") == "patrons":
                d = g["def"]
                props.update(id=d["id"], codi=d.get("codi", ""), nom=d.get("nom_ca", clau))
                if d.get("nom_es"):
                    props["nom_es"] = d["nom_es"]
                if d.get("color"):
                    props["color"] = d["color"]
            elif s.get("agrupa") == "agencia":
                ag = feed.agencies.get(clau, {})
                props.update(id=f"bus:{clau}", nom=ag.get("agency_name", clau),
                             codi=s.get("codis", {}).get(clau, ""))
                if ag.get("agency_url"):
                    props["web"] = ag["agency_url"]
                linies_bus = set()
                for r in rutes_grup:
                    curt = feed.rutes[r].get("route_short_name", "")
                    llarg = feed.rutes[r].get("route_long_name", "")
                    if curt and llarg.startswith(curt):
                        llarg = re.sub(r"^[_\s\-–]+", "", llarg[len(curt):])
                    linies_bus.add((curt, neteja_nom(llarg)))
                linies_bus = sorted(linies_bus, key=lambda x: ordre_natural(x[0]))
                props["linies_bus"] = [f"{c} {n}".strip() for c, n in linies_bus]
                props["n_parades"] = len({e for p in patrons for e in p})
            else:
                codi = r0.get("route_short_name", "")
                nom = neteja_nom(r0.get("route_long_name", "")) or f"{codi}"
                if s.get("treu_prefix_nom") and codi:
                    nom = re.sub(rf"^{re.escape(codi)}\s*–\s*", "", nom)
                sist = s.get("sistemes", {}).get(r0["route_id"][:3])
                lid = f"{s['id']}:{sist['slug']}:{codi}" if sist else f"{s['id']}:{codi}"
                if encadenat:
                    nom = f"{feed.nom_parada(principal[0])} – {feed.nom_parada(principal[-1])}"
                props.update(id=lid, codi=codi, nom=nom)
                if sist:
                    props["sistema"], props["sistema_es"] = sist["nom_ca"], sist["nom_es"]
                colors = Counter()
                for r, n in rutes_grup.items():
                    c = feed.rutes[r].get("route_color", "")
                    if re.fullmatch(r"[0-9A-Fa-f]{6}", c):
                        colors["#" + c.upper()] += n
                if colors:
                    props["color"] = colors.most_common(1)[0][0]
            geom = self.geometria(s, feed, trips, patrons)
            if not geom:
                continue
            if s["tipus"] == "linia":
                parades = [e for e in principal if not s.get("retalla_cv") or self.dins(feed.coord(e))]
                totes = {e for p in patrons for e in p}
                for e in totes:
                    if not s.get("retalla_cv") or self.dins(feed.coord(e)):
                        self.registra_estacio(feed, e, s["id"], props["id"])
                props["parades"] = [f"{feed.prefix}:{e}" for e in parades]
            else:
                for p in patrons:
                    for e in p:
                        self.concessions_parada[(feed.clau, e)].add(props["id"])
            features.append({"type": "Feature", "properties": props, "geometry": geom})
        features.sort(key=lambda f: ordre_natural(f["properties"].get("codi") or f["properties"]["nom"]))
        return features

    # --- nodes -----------------------------------------------------------
    def productes_renfe(self):
        feed = self.feeds.get("renfe_ld")
        if not feed:
            return
        for t, seq in feed.seq.items():
            prod = feed.rutes.get(feed.viatges[t]["route_id"], {}).get("route_short_name", "")
            for e in seq:
                if prod:
                    self.productes_parada[e].add(prod)

    def nodes(self):
        cfg = self.cfg.get("nodes", {})
        radi = cfg.get("radi_connexions_m", 300)
        nodes = []
        gva = self.feeds.get("gva_bus")
        for n in cfg.get("bus", []):
            if not gva:
                break
            ids = [sid for sid, s in gva.parades.items() if re.search(n["parada"], s.get("stop_name", ""))]
            coords = [gva.coord(i) for i in ids if gva.coord(i)]
            if not coords:
                avis(f"node {n['id']}: cap parada coincideix amb «{n['parada']}»")
                continue
            c = (sum(x for x, _ in coords) / len(coords), sum(y for _, y in coords) / len(coords))
            conc = set()
            for i in ids:
                conc |= self.concessions_parada.get(("gva_bus", gva.estacio(i)), set())
            nodes.append(self.node(n, "bus", c, {"concessions": sorted(conc)}))
        for n in cfg.get("ferrocarril", []):
            c = None
            for clau in ("renfe_cercanias", "renfe_ld"):
                f = self.feeds.get(clau)
                if f and f.coord(n["adif"]):
                    c = f.coord(n["adif"])
                    break
            if not c:
                avis(f"node {n['id']}: no es troba l'estació ADIF {n['adif']}")
                continue
            extra = {"productes": sorted(self.productes_parada.get(n["adif"], set()))}
            nodes.append(self.node(n, "ferrocarril", c, extra))
        # Connexions: estacions i altres nodes a prop
        for nd in nodes:
            c = nd["geometry"]["coordinates"]
            p = nd["properties"]
            p["estacions"] = sorted(
                (e["id"] for e in self.estacions.values() if e["coord"] and distancia_m(c, e["coord"]) <= radi),
                key=lambda i: distancia_m(c, self.estacions[i]["coord"]))
            p["nodes"] = [o["properties"]["id"] for o in nodes
                          if o is not nd and distancia_m(c, o["geometry"]["coordinates"]) <= radi]
        return nodes

    def node(self, n, subtipus, c, extra):
        props = {"id": n["id"], "tipus": "node", "subtipus": subtipus,
                 "nom": n.get("nom_ca", n["id"]), "nom_es": n.get("nom_es", "")}
        props.update(extra)
        return {"type": "Feature", "properties": props,
                "geometry": {"type": "Point", "coordinates": [round(c[0], 6), round(c[1], 6)]}}

    def features_estacions(self):
        res = []
        for e in sorted(self.estacions.values(), key=lambda e: e["nom"]):
            if not e["coord"]:
                continue
            res.append({"type": "Feature",
                        "properties": {"id": e["id"], "tipus": "estacio", "nom": e["nom"],
                                       "serveis": e["serveis"], "linies": e["linies"]},
                        "geometry": {"type": "Point", "coordinates": [round(e["coord"][0], 6), round(e["coord"][1], 6)]}})
        return res


def geom_gpkg(blob):
    """Geometria d'un GeoPackage (capçalera GP + WKB) a shapely."""
    b = bytes(blob)
    sobre = (b[3] >> 1) & 7
    return wkb.loads(b[8 + {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}.get(sobre, 0):])


def llig_geometries(cfg, base):
    """Llig els traçats propis de l'AVPTP i els passa a WGS84."""
    if not cfg:
        return []
    cami = (base / cfg["fitxer"]) if not Path(cfg["fitxer"]).is_absolute() else Path(cfg["fitxer"])
    if not cami.exists():
        avis(f"no es troba {cami}: s'usaran només els traçats dels GTFS")
        return []
    con = sqlite3.connect(cami)
    col, srs = con.execute("select column_name, srs_id from gpkg_geometry_columns where table_name = ?",
                           (cfg["capa"],)).fetchone()
    canvi = None
    if srs not in (4326, 0, -1):
        from pyproj import Transformer
        trans = Transformer.from_crs(srs, 4326, always_xy=True)

        def canvi(coords):
            import numpy as np
            x, y = trans.transform(coords[:, 0], coords[:, 1])
            return np.column_stack([x, y])
    res = []
    for g, ide, nom, xarxa in con.execute(
            f'select "{col}", "{cfg["camp_id"]}", "{cfg["camp_nom"]}", "{cfg["camp_xarxa"]}" from "{cfg["capa"]}"'):
        if g is None:
            continue
        geom = geom_gpkg(g)
        if canvi:
            import shapely
            geom = shapely.transform(geom, canvi)
        res.append({"id": ide, "nom": (nom or "").strip(), "xarxa": (xarxa or "").strip(), "geom": geom})
    print(f"Traçats propis: {len(res)} línies de {cami.name}")
    return res


def aplica_geometries(feats, servei, propies, cfg):
    """Substituïx el traçat de les línies que l'AVPTP té dibuixades i afegix les que falten."""
    for g in propies:
        xc = cfg.get("xarxes", {}).get(g["xarxa"])
        if not xc or xc["servei"] != servei:
            continue
        # «L1», «1» i «l1» es consideren el mateix codi
        clau = lambda c: re.sub(r"^L(?=\d)", "", str(c or "").strip().upper())
        objectiu = None
        for f in feats:
            p = f["properties"]
            if clau(p.get("codi")) == clau(g["nom"]) and (not xc.get("sistema") or f":{xc['sistema']}:" in p["id"]):
                objectiu = f
                break
        geom = a_multilinia(g["geom"])
        if not geom:
            continue
        if objectiu:
            objectiu["geometry"] = geom
            objectiu["properties"]["id_avptp"] = g["id"]
            objectiu["properties"]["codi"] = g["nom"]
        else:
            extra = cfg.get("linies", {}).get(g["id"], {})
            props = {"id": f"{servei}:{g['nom']}", "id_avptp": g["id"], "tipus": "linia", "servei": servei,
                     "codi": extra.get("codi", g["nom"]), "nom": extra.get("nom_ca", g["nom"]), "parades": []}
            if extra.get("nom_es"):
                props["nom_es"] = extra["nom_es"]
            if extra.get("color"):
                props["color"] = extra["color"]
            feats.append({"type": "Feature", "properties": props, "geometry": geom})
    feats.sort(key=lambda f: ordre_natural(f["properties"].get("codi") or f["properties"]["nom"]))
    return feats


def desa(cami, features):
    with open(cami, "w", encoding="utf-8") as fh:
        json.dump({"type": "FeatureCollection", "features": features}, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"  {cami.relative_to(ARREL) if cami.is_relative_to(ARREL) else cami}: "
          f"{len(features)} elements, {cami.stat().st_size / 1024:.0f} kB")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default=str(AQUI / "serveis.json"))
    ap.add_argument("--sortida", default=str(ARREL / "public" / "visor" / "dades"))
    ap.add_argument("--cache", default=str(AQUI / ".gtfs"), help="carpeta on es guarden les descàrregues")
    ap.add_argument("--carpeta-gtfs", help="carpeta amb fitxers <font>.zip ja descarregats")
    ap.add_argument("--local", action="append", default=[], metavar="FONT=FITXER",
                    help="fitxer GTFS local per a una font (es pot repetir)")
    ap.add_argument("--limit", default=str(AQUI / "limit_cv.geojson"),
                    help="polígon per a retallar les línies que ixen de la Comunitat Valenciana")
    args = ap.parse_args()

    cfg = json.loads(Path(args.config).read_text(encoding="utf-8"))
    necessaries = {s["font"] for s in cfg["serveis"]} | {"renfe_ld", "renfe_cercanias", "gva_bus"}
    feeds, origens = obte_fonts(cfg["fonts"], args, necessaries & set(cfg["fonts"]))

    limit = None
    if args.limit and Path(args.limit).exists():
        gj = json.loads(Path(args.limit).read_text(encoding="utf-8"))
        limit = unary_union([shape(f["geometry"]) for f in gj["features"]])

    c = Constructor(cfg, feeds, limit)
    propies = llig_geometries(cfg.get("geometries_propies"), Path(args.config).resolve().parent)

    # Una sola lectura de stop_times per font amb tots els viatges necessaris
    necessaris = defaultdict(set)
    for s in cfg["serveis"]:
        f = feeds.get(s["font"])
        if f:
            necessaris[s["font"]] |= c.viatges_de(f, c.rutes_servei(s, f))
    if "renfe_ld" in feeds:
        necessaris["renfe_ld"] |= set(feeds["renfe_ld"].viatges)   # per als productes de cada node
    for clau, trips in necessaris.items():
        print(f"Llegint horaris de {clau} ({len(trips)} viatges)…")
        feeds[clau].llig_seqs(trips)
    c.productes_renfe()

    sortida = Path(args.sortida)
    sortida.mkdir(parents=True, exist_ok=True)
    resum = {}
    print("Generant capes:")
    for s in cfg["serveis"]:
        feats = aplica_geometries(c.servei(s), s["id"], propies, cfg.get("geometries_propies", {}))
        desa(sortida / f"{s['id']}.geojson", feats)
        resum[s["id"]] = {"elements": len(feats), "font": s["font"], "gtfs": s["font"] in feeds}
    desa(sortida / "estacions.geojson", c.features_estacions())
    desa(sortida / "nodes.geojson", c.nodes())

    meta = {"generat": dt.datetime.now().replace(microsecond=0).isoformat(),
            "fonts": origens, "serveis": resum,
            "llicencia": "Dades del NAP (Ministeri de Transports i Mobilitat Sostenible). Powered by MITRAMS."}
    (sortida / "metadades.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print("Fet.")


if __name__ == "__main__":
    main()

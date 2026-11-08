# Visor de la xarxa de transport públic

Visor interactiu de la xarxa de transport públic de la Comunitat Valenciana per a la web de l'AVPTP. Mostra els servicis ferroviaris, les concessions d'autobús interurbà i els nodes de transport principals. Cada servici es pot mostrar o amagar sencer o línia a línia. En seleccionar una línia, una concessió o un node s'obri una fitxa amb el recorregut (les parades), les dades i la documentació associada.

El visor és estàtic: no té base de dades ni processos automàtics. Les dades s'actualitzen a mà quan es vulga (vegeu «Actualitzar les dades»).

## Què hi ha i on va

```
index.html
css/visor.css               colors corporatius i aparença
js/visor.js                 funcionament
js/i18n.js                  textos en valencià i castellà
img/                        logotip i isotip de l'AVPTP
img/logos/                  logotips dels servicis (Metrovalència, Rodalies, TRAM, Renfe, GVA)
dades/config.json           servicis, logotips, colors, mapes de fons i fonts de documentació
dades/*.geojson             capes generades (no s'editen a mà)
dades/limit_cv.geojson      límit de la Comunitat (delimitació i vel del mapa)
dades/metadades.json        data i origen de les dades
dades/documentacio.csv      documentació associada a cada element
scripts/                    preparació de les dades (no es publica)
  actualitza_dades.py       genera dades/ a partir dels GTFS del NAP
  genera_autonom.py         crea visor-avptp-autonom.html per a revisar-lo en local
  serveis.json              quines rutes s'agafen i com s'agrupen
  fonts/AVPTP_xarxa.gpkg    traçats propis de l'AVPTP
  limit_cv.geojson          límit de la Comunitat (per a retallar les línies que ixen)
  requirements.txt
```

## Publicació

Cada canvi a la branca `master` es publica automàticament a GitHub Pages (`.github/workflows/publica.yml`). Només es publiquen `index.html`, `css/`, `js/`, `img/` i `dades/`; els scripts es queden al repositori.

El visor queda a `https://visor.avptp.org` (o, mentre no hi haja subdomini, a `https://avptp.github.io/visor/`).

Configuració, una sola vegada:

1. *Settings → Pages → Build and deployment → Source:* **GitHub Actions**.
2. Subdomini: al DNS d'avptp.org, un registre `CNAME` de `visor` a `avptp.github.io`. Després, a *Settings → Pages → Custom domain*, `visor.avptp.org` i activeu *Enforce HTTPS*.

### Enllaçar-lo i incrustar-lo des de la web

La web principal ([avptp/face](https://github.com/avptp/face)) l'enllaça des del menú i té la pàgina `avptp.org/visor`, que l'incrusta a pantalla completa. Per a incrustar-lo en una altra pàgina:

```html
<iframe src="https://visor.avptp.org/?sense-titol&hl=ca"
        title="Visor de la xarxa de transport públic"
        style="width:100%; height:80vh; min-height:540px; border:0"
        loading="lazy" allow="clipboard-write"></iframe>
```

- `?sense-titol` amaga el títol, si la pàgina ja en té un.
- `?hl=ca` o `?hl=es` fixa l'idioma. Com que el visor està en un altre domini que la web, és la manera de mantindre'ls en el mateix idioma.
- `?editor` mostra a cada fitxa l'identificador per a lligar-hi documentació (vegeu «Documentació»). El públic no el veu.
- `#identificador` obri directament la fitxa d'una línia, concessió o node, per exemple `#rodalies:valencia:C1`. La barra d'adreces s'actualitza en seleccionar elements, així que es poden copiar i compartir enllaços.

### Idioma

El visor tria l'idioma en este ordre:

1. El paràmetre `hl` de l'adreça.
2. La galeta `language` de la web de l'AVPTP (només si el visor es servix des del mateix domini).
3. L'última tria feta al visor.
4. L'idioma del navegador.

Quan l'usuari canvia l'idioma des del visor, també s'actualitza la galeta `language`, de manera que la web i el visor queden sincronitzats. Els textos de la interfície són a `js/i18n.js`.

### Provar-lo en local

La manera més ràpida és generar la versió autònoma, que es pot obrir amb doble clic:

```
python3 scripts/genera_autonom.py
```

Crea `visor-avptp-autonom.html` amb els estils, les imatges i les dades dins (Leaflet i el mapa de fons es continuen baixant d'Internet). Cal tornar-lo a generar després de cada canvi.

També es pot servir la carpeta tal qual:

```
python3 -m http.server
```

i obrir `http://localhost:8000`. Obrir `index.html` amb doble clic no funciona perquè el navegador no deixa llegir les dades.

## Capes del mapa

Les capes s'organitzen en grups (`grups` de `config.json`) i, dins de cada grup, en servicis. Cada servici té una casella per a mostrar-lo o amagar-lo sencer i un desplegable amb cadascuna de les seues línies (o concessions, o estacions principals). Si només se'n mostren algunes, la casella del servici queda a mitges.

Un servici del visor no ha de coincidir necessàriament amb un fitxer de dades. Amb `origen` es pot:

- **Dividir** un fitxer: Rodalies València i Rodalies Alacant-Murcia agafen les línies de `rodalies.geojson` segons el prefix de l'identificador (`rodalies:valencia:`, `rodalies:alacant-murcia:`).
- **Ajuntar** fitxers: «Regionals i Mitja distància» agafa `regionals.geojson` i `md.geojson`. Cada `origen` porta una `etiqueta` (el subapartat de la llista) i un `color` per a les línies que no en tenen.

El `logo` de cada servici és una imatge de `img/logos/` (es mostra a 34 × 26 px). Les estacions no són una capa: només apareixen en seleccionar una línia, al mapa i a l'apartat «Recorregut». En triar-ne una del recorregut, el mapa s'hi centra.

### Colors de les línies

El color de cada línia ve de les dades. Per a Metrovalència i el TRAM es fixa a `scripts/serveis.json`, dins de `geometries_propies.linies` (per identificador AVPTP, per exemple `FER_FGV_V04`), i té prioritat sobre el color del GTFS, que no sempre és el del plànol oficial. Per a provar un color sense regenerar les dades, es pot posar a `colorsLinies` de `config.json` (per exemple `{ "metrovalencia:2": "#E4007C" }`).

## Actualitzar les dades

1. Entreu al NAP (https://nap.transportes.gob.es) amb el compte de l'associació i descarregueu, sense canviar-los el nom, els GTFS d'estos fitxers:

   | Font | Fitxer del NAP |
   |---|---|
   | Renfe Cercanías | 1130 |
   | Renfe Alta Velocidad, Larga y Media Distancia | 1098 |
   | Generalitat Valenciana, autobús interurbà | 1526 |
   | FGV Metrovalencia | 1168 |
   | FGV TRAM d'Alacant | 1167 |

2. Instal·leu les dependències (només la primera vegada):

   ```
   pip install -r scripts/requirements.txt
   ```

3. Executeu el procés indicant la carpeta de les descàrregues:

   ```
   python3 scripts/actualitza_dades.py --carpeta-gtfs ~/Baixades/nap
   ```

   Per a cada font s'agafa el fitxer més recent de la carpeta. El nom del fitxer ha de coincidir amb el patró `fitxer` de `serveis.json`. Si algun no es troba, es pot indicar a mà:

   ```
   --local tram_alacant=~/Baixades/fitxer_del_tram.zip
   ```

4. Reviseu el visor en local i pugeu els canvis de `dades/`. En arribar a `master`, es publiquen sols.

Si falta el GTFS d'una font, el procés ho avisa. Els servicis que en depenen queden buits o es construeixen només amb els traçats propis.

### Traçats propis (GeoPackage)

Les línies de `fonts/AVPTP_xarxa.gpkg` (capa `ferrocarril_linies`) tenen prioritat sobre el traçat dels GTFS. El GTFS continua aportant les estacions, el recorregut i el color. Cada línia del GeoPackage es relaciona amb la del GTFS pel camp `xarxa` (segons la taula `geometries_propies.xarxes` de `serveis.json`) i pel codi (`nom`: «L1», «C3»…).

L'identificador del GeoPackage (`id_element`, per exemple `FER_FGV_V01`) es guarda com a identificador AVPTP de la línia. Es pot fer servir igual que l'identificador del visor per a associar-hi documentació i per a enllaçar-la.

Per a afegir o corregir traçats, n'hi ha prou amb editar el GeoPackage (per exemple, amb QGIS) i tornar a executar el procés.

### Com es construeix cada servici

| Servici | Font | Criteri |
|---|---|---|
| Metrovalència | GTFS 1168 + GeoPackage | totes les línies de metro i tramvia |
| Rodalies | GTFS 1130 | núcleu de València (excepte C4) i núcleu d'Alacant-Murcia, retallat al límit de la Comunitat |
| TRAM d'Alacant | GTFS 1167 + GeoPackage | totes les línies; el recorregut és la variant més llarga d'entre les que fan almenys el 10% dels viatges |
| Regionals | GTFS 1098 | trens Regional i Regional Exprés d'Alcoi, Alacant–València i València–Vinaròs/Tortosa, retallats al límit |
| Mitja distància | GTFS 1098 | trens cap a Albacete i Saragossa, retallats al límit |
| Línies interurbanes | GTFS 1526 | una entrada per concessió (agrupades per operador del GTFS) |
| Nodes | GTFS 1526 i Renfe | estacions d'autobusos i estacions principals d'Adif definides a `serveis.json` |

Les regles (quines línies, quines parades identifiquen cada regional, quins nodes…) són a `scripts/serveis.json`. Altres opcions útils: `noms_parades` (dins d'una font) corregix noms de parada del GTFS, `prefix_codi` afig un prefix al codi de línia (el TRAM numera «1», «2»… i així es manté `tram_alacant:L1`) i `quota_recorregut` evita que el recorregut agafe variants esporàdiques. El GTFS de la Generalitat no inclou el codi de contracte de cada concessió. Es pot afegir a mà a `codis`, dins del servei `bus_interurba`, per exemple `{ "5102": "CV-303" }`; el codi apareixerà al distintiu de la concessió.

## Documentació

`dades/documentacio.csv` té una fila per document, amb separador `;` i codificació UTF-8. A Excel, cal guardar-lo amb *Desa com a → CSV UTF-8*.

| Columna | Contingut |
|---|---|
| `id` | Identificador de l'element. Si el document afecta diversos elements, es separen amb `\|`. |
| `tipus` | `pdf`, `enllac`, `imatge` o `text` |
| `titol_ca`, `titol_es` | Títol en cada idioma. Si en falta un, es mostra l'altre. |
| `url` | Adreça del document (per exemple, `https://cdn.avptp.org/documents/…`) |
| `idioma` | Idioma del document (`ca` o `es`). Quan no coincidix amb el de la interfície, es mostra l'avís «En castellà» o «En valencià». |
| `data` | Data del document (AAAA-MM-DD), opcional |
| `descripcio_ca`, `descripcio_es` | Text breu, opcional |

La columna `id` diu a quina línia, concessió o node es mostra el document. És el mateix identificador que apareix a l'adreça en seleccionar l'element (`…#metrovalencia:1`) i, en mode d'edició (`index.html?editor`), al final de la fitxa amb un botó per a copiar-lo. Per a les línies amb traçat propi també val l'identificador AVPTP del GeoPackage (`FER_FGV_V01`), que no canvia encara que canvie el GTFS.

Els documents no s'importen: el visor enllaça directament a on estiguen (el servidor de l'associació, GitHub…). A `config.json`, `documentacio` és una llista de fonts. S'hi poden afegir més fulls CSV o fitxers JSON amb les mateixes columnes, locals o remots. Un full remot, d'un altre domini, ha de permetre CORS. Els fitxers de `raw.githubusercontent.com` ja el permeten.

## Mapa de fons

Hi ha quatre mapes de fons (`mapesBase` de `config.json`). El primer és el predeterminat i es recorda l'última tria de cada usuari.

| Opció | Proveïdor | Notes |
|---|---|---|
| Gris | [OpenFreeMap](https://openfreemap.org), estil Positron, sobre OpenStreetMap | Predeterminat. Vectorial: els noms es mostren en valencià. Gratuït, sense clau ni límits. |
| Color | OpenFreeMap, estil Bright | Igual que l'anterior, amb colors. |
| Gris (IGN) | Mapa base gris de l'Institut Geogràfic Nacional | CC BY 4.0. Imatge fixa: els noms són els oficials de l'IGN. |
| Ortofoto | PNOA de l'IGN | CC BY 4.0. |

Els mapes **vectorials** (`"tipus": "vectorial"`, amb un `estil` de MapLibre) es dibuixen amb [MapLibre GL](https://maplibre.org) i el connector per a Leaflet, que només es baixen si es tria un mapa d'este tipus (adreces a `maplibre`). Si el navegador no els pot mostrar, el visor avisa i passa al primer mapa raster de la llista.

### Idioma dels noms del mapa

A `etiquetesMapa` de `config.json`:

- `idioma`: els noms es prenen del camp `name:ca` d'OpenStreetMap («Alacant», «Castelló de la Plana», «Oriola») i, si una població no en té, del nom oficial.
- `substitucions`: per a canviar un nom concret, per exemple `{ "País Valencià": "Comunitat Valenciana" }`.

Si algun nom ix malament, la correcció de fons és editar-lo a OpenStreetMap: OpenFreeMap actualitza les dades cada setmana.

### Delimitació de la Comunitat

`limit` de `config.json` dibuixa el contorn de la Comunitat Valenciana i cobrix la resta del mapa amb un vel blanc semitransparent. `opacitatFora` regula el vel (0 el lleva, 1 amaga del tot l'exterior) i `vora`, `gruixVora` i `opacitatVora`, la línia del contorn. El fitxer `dades/limit_cv.geojson` el copia `actualitza_dades.py` des de `scripts/limit_cv.geojson`.

## Llicències i atribucions

- **Dades de transport:** NAP del Ministeri de Transports i Mobilitat Sostenible. La llicència obliga a citar «Powered by MITRAMS» amb un enllaç a https://www.transportes.gob.es. El visor ho mostra en l'atribució del mapa.
- **Mapa de fons:** OpenFreeMap, © OpenMapTiles, © col·laboradors d'OpenStreetMap (ODbL); © IGN (CC BY 4.0, mapa base gris i PNOA). Llibreria MapLibre GL (BSD-3).
- **Límit de la Comunitat:** IGN, Equipamiento Geográfico de Referencia Nacional, simplificat (paquet es-atlas).
- **Llibreria de mapes:** Leaflet 1.9.4 (BSD-2).
- **Codi:** llicència MIT (vegeu `LICENSE`). Les dades i els logotips tenen les llicències indicades ací damunt.
- **Logotips:** el de l'AVPTP és propietat de l'associació; els dels servicis, de FGV, Renfe i la Generalitat Valenciana, i s'usen només per a identificar cada servici.

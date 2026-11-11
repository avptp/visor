# Visor de la xarxa de transport públic

Visor interactiu de la xarxa de transport públic de la Comunitat Valenciana per a la web de l'AVPTP. Mostra:

- els servicis ferroviaris (Metrovalència, Rodalies, TRAM d'Alacant, Regionals i Mitja distància);
- els autobusos: TRAM de Castelló, BRT, línies urbanes, Metrobús (ATMV), línies interurbanes de la Generalitat i línies estatals;
- els nodes de transport principals (estacions d'autobusos i d'Adif).

Cada servici es pot mostrar o amagar sencer o element a element. En seleccionar una línia, una concessió, una xarxa urbana, un corredor o un node s'obri una fitxa amb el recorregut, la documentació de l'associació i les seues aparicions als mitjans.

El visor és estàtic: no té base de dades ni processos automàtics. Les dades s'actualitzen a mà quan es vulga (vegeu «Actualitzar les dades»).

## Què hi ha i on va

```
index.html
css/visor.css                    colors corporatius i aparença
js/visor.js                      funcionament
js/i18n.js                       textos en valencià i castellà
img/                             logotip i isotip de l'AVPTP
img/logos/                       logotips dels servicis
dades/config.json                grups, servicis, logotips, colors, mapes de fons i fonts de documentació
dades/*.geojson                  capes del mapa (no s'editen a mà)
dades/limit_cv.geojson           límit de la Comunitat (delimitació i vel del mapa)
dades/metadades.json             data i origen de les dades
dades/documentacio.csv           documentació i aparicions als mitjans de cada element
scripts/                         preparació de les dades (no es publica)
  actualitza_dades.py            genera dades/ a partir dels GTFS del NAP
  completa_dades.py              afig les capes i correccions que no venen del NAP
  xarxa_urbana.py                prepara una xarxa d'autobús urbà a partir del seu GTFS
  genera_autonom.py              crea visor-avptp-autonom.html per a revisar-lo en local
  fes_autonom.py                 àlies de genera_autonom.py
  serveis.json                   quines rutes s'agafen i com s'agrupen
  limit_cv.geojson               límit de la Comunitat (ICV)
  requirements.txt
  fonts/
    AVPTP_xarxa.gpkg             traçats propis de l'AVPTP
    estatals.geojson             línies estatals, per corredor
    estatals_rutes.geojson       línies estatals, ruta a ruta (traçat i parades)
    atmv.geojson                 concessions de l'ATMV (Metrobús)
    emt_valencia.geojson         EMT València
    urba_alacant.geojson         autobús urbà d'Alacant
    tram_castello.geojson        TRAM de Castelló
    tracats_renfe.json           traçats de Regionals i Mitja distància
    correccions_metrovalencia.json
    codis_concessions.json       codis de contracte de les concessions de la Generalitat
    bus_projectes.geojson        concessions interurbanes en projecte (CV-207, CV-210, CV-213, CV-303)
    ferrocarril_fora_cv.json     parades i traçat de fora de la Comunitat de les línies de tren que en ixen
    correccions_ferrocarril.json correccions de línies de Renfe (la C1 d'Alacant comença a Alacant Terminal)
    brt_xirivella.geojson        BRT València – Xirivella – Aldaia/Alaquàs (en projecte)
```

## Publicació

Cada canvi a la branca `main` es publica automàticament a GitHub Pages (`.github/workflows/publica.yml`). Només es publiquen `index.html`, `css/`, `js/`, `img/` i `dades/`; els scripts es queden al repositori. Abans de publicar, l'acció comprova que tots els fitxers de `dades/` són JSON vàlid.

El visor queda a `https://visor.avptp.org` (o, mentre no hi haja subdomini, a `https://avptp.github.io/visor/`).

Configuració, una sola vegada:

1. *Settings → Pages → Build and deployment → Source:* **GitHub Actions**.
2. Subdomini: al DNS d'avptp.org, un registre `CNAME` de `visor` a `avptp.github.io`. Després, a *Settings → Pages → Custom domain*, `visor.avptp.org` i activeu *Enforce HTTPS*.

### Pujar canvis des de la web de GitHub

*Add file → Upload files* a l'arrel del repositori i arrossegueu-hi el **contingut** de la carpeta (`index.html`, `css`, `js`, `img`, `dades`, `scripts`…), no la carpeta en si. Els fitxers amb el mateix nom se sobreescriuen. Per a esborrar una carpeta, el més còmode és l'editor web: amb el repositori obert, premeu `.`, feu clic dret sobre la carpeta → *Delete Permanently* i, al panell de control de codi font, *Commit & Push*.

### Enllaçar-lo i incrustar-lo des de la web

La web principal ([avptp/face](https://github.com/avptp/face)) té un botó que obri el visor en la mateixa finestra, directament a `visor.avptp.org`. El logotip de la capçalera del visor torna a `avptp.org`. Perquè el visor s'obriga en el mateix idioma que la web, l'enllaç porta `?hl=ca` o `?hl=es`:

```html
<a href="https://visor.avptp.org/?hl=ca">Visor de la xarxa</a>   <!-- versió en castellà: ?hl=es -->
```

Per a incrustar-lo en una altra pàgina:

```html
<iframe src="https://visor.avptp.org/?sense-titol&hl=ca"
        title="Visor de la xarxa de transport públic"
        style="width:100%; height:80vh; min-height:540px; border:0"
        loading="lazy" allow="clipboard-write"></iframe>
```

- `?sense-titol` amaga el títol, si la pàgina ja en té un.
- `?hl=ca` o `?hl=es` fixa l'idioma. Com que el visor està en un altre domini que la web, és la manera de mantindre'ls en el mateix idioma.
- `?editor` mostra a cada fitxa l'identificador per a lligar-hi documentació (vegeu «Documentació i mitjans»). El públic no el veu.
- `#identificador` obri directament la fitxa d'un element, per exemple `#rodalies:valencia:C1` o `#emt_valencia`. La barra d'adreces s'actualitza en seleccionar elements, així que es poden copiar i compartir enllaços.

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

Les capes s'organitzen en grups (`grups` de `config.json`) i, dins de cada grup, en servicis:

| Grup | Servicis |
|---|---|
| Ferrocarril | Metrovalència, Rodalies València, Rodalies Alacant-Murcia, TRAM d'Alacant, Regionals i Mitja distància |
| Autobús | TRAM de Castelló, BRT, Línies urbanes, Metrobús (ATMV), Línies interurbanes, Línies estatals |
| Nodes de transport | Estacions d'autobusos, Estacions principals d'Adif |

Cada grup té també una casella per a mostrar-ne o amagar-ne tots els servicis d'una vegada (a mitges si només se'n mostra una part). Cada servici té una casella per a mostrar-lo o amagar-lo sencer i un desplegable amb els seus elements. Si només se'n mostren alguns, la casella del servici queda a mitges. A la llegenda, els elements van ordenats pel codi (els que encara no en tenen, al principi) i després pel nom.

Hi ha dues menes d'element amb traçat:

- **Línia** (`tipus: linia`): un servici amb recorregut i parades (ferrocarril, TRAM de Castelló). La fitxa mostra el recorregut, i en triar-ne una parada el mapa s'hi centra.
- **Agrupació** (`tipus: concessio`): un conjunt de línies que es tracten juntes, perquè les al·legacions van en grup. És el cas de les concessions interurbanes i de l'ATMV, de les xarxes urbanes i dels corredors estatals. La fitxa mostra la llista de línies o rutes.

Les estacions no són una capa: només apareixen en seleccionar una línia.

### Opcions de cada servici (`serveis` de `config.json`)

| Camp | Per a què serveix |
|---|---|
| `nom`, `detall` | Nom i subtítol a la llegenda (en `ca` i `es`) |
| `logo` | Imatge de `img/logos/` (es mostra a 34 × 26 px). Sense logo, es mostra una mostra del color. |
| `logoFitxa`, `textLogoFitxa` | Logotip gran (i text alternatiu) al principi del cos de la fitxa. Ara no l'usa cap servici. |
| `color`, `gruix` | Color i gruix per defecte de les línies |
| `origen` | Agafa les línies d'un altre servici de les dades, o només les que comencen per un `prefix`. Servix per a **dividir** un fitxer (Rodalies València i Rodalies Alacant-Murcia agafen `rodalies.geojson` per prefix) o **ajuntar-ne** diversos (Regionals i Mitja distància; els tres corredors estatals amb un color cadascun). Amb `etiqueta`, la llista es dividix en subapartats. |
| `recompte` | Text del recompte a la dreta de la llegenda: `corredors_n`, `xarxes_n`… (per defecte, línies o concessions) |
| `textTipus`, `textLinies` | Textos propis de la fitxa: el tipus d'element («Corredor estatal», «Xarxa urbana») i el títol de la llista («Rutes del corredor») |
| `codiLlegenda` | `false` perquè la llegenda no mostre el codi entre claudàtors (xarxes urbanes) |
| `senseDades` | `true` per a amagar l'apartat «Dades» de la fitxa (corredors estatals) |

### Colors

El color de cada línia ve de les dades. Per a Metrovalència i el TRAM d'Alacant es fixa a `scripts/serveis.json`, dins de `geometries_propies.linies` (per identificador AVPTP, per exemple `FER_FGV_V04`), i té prioritat sobre el color del GTFS. Les línies 4, 6, 8 i 9 de Metrovalència es corregixen a `correccions_metrovalencia.json`. Per a fixar el color de qualsevol element sense regenerar les dades, es pot posar a `colorsLinies` de `config.json`, per exemple `{ "metrovalencia:2": "#E4007C", "urba_alacant": "#1F6FB5" }`.

### Estat: en servici o en projecte

Cada element pot portar el camp `estat`: `servei` (per defecte) o `projecte`. Els elements en projecte es dibuixen amb línia discontínua i porten l'etiqueta «En projecte» a la capçalera de la fitxa. A la llegenda, el bloc «Estat» permet mostrar o amagar cada estat. Per a una ampliació en projecte d'una línia en servici, s'ha d'afegir com a element separat amb `estat: projecte`, de manera que la línia actual continue sencera «En servici».

### Recorregut sencer i ramals

- `complet`: recorregut sencer d'un element retallat al límit de la Comunitat. En seleccionar-lo, la part de fora es mostra difuminada (corredors estatals i les línies de tren que ixen de la Comunitat: C1 de Rodalies Alacant-Murcia fins a Múrcia, Regional València – Vinaròs/Tortosa, Mitja distància a Albacete i a Terol – Saragossa). Les parades de fora de la Comunitat porten `fora_cv: true`: surten en gris al recorregut i més suaus al mapa, i també es poden triar per a centrar-s'hi.
- `ramals`: llista de ramals d'una línia (`[{nom, parades}]`), que es mostren davall del recorregut. La L4 de Metrovalència té els de Lloma Llarga – Terramelar i Fira València.

### Etiquetes de codi

A partir del zoom `zoomEtiquetes` de `config.json` (13), cada element visible que té codi porta sobre el traçat uns requadres del seu color amb el codi (L4, C6, CE-920, CV-103, EMT…). Es reparteixen per la pantalla sense trepitjar-se ni quedar davall dels panells. En fer-hi clic s'obri la fitxa.

## Actualitzar les dades

### 1. Dades del NAP

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

Si falta el GTFS d'una font, el procés ho avisa. Els servicis que en depenen queden buits o es construeixen només amb els traçats propis.

### 2. Capes i correccions pròpies (sempre després del pas 1)

```
python3 scripts/completa_dades.py
```

No necessita cap llibreria. `actualitza_dades.py` torna a generar els fitxers del NAP des de zero, i este pas hi torna a aplicar tot el que no ve del NAP:

- copia a `dades/` les capes de `scripts/fonts/`: línies estatals, ATMV, xarxes urbanes i TRAM de Castelló;
- corregix Metrovalència (`correccions_metrovalencia.json`): traçats, parades i colors de les línies 4, 6, 8 i 9 i els ramals de la L4;
- substituïx els traçats de Regionals i Mitja distància (`tracats_renfe.json`), perquè el GTFS de Renfe no en porta i, sense ells, les línies anirien en recte d'estació a estació;
- posa el codi de contracte a les concessions de la Generalitat (`codis_concessions.json`);
- afig a `bus_interurba.geojson` les concessions en projecte (`bus_projectes.geojson`);
- corregix línies de Renfe que el GTFS no porta bé (`correccions_ferrocarril.json`): la C1 de Rodalies Alacant-Murcia es queda entre Alacant Terminal i Múrcia, sense Sant Vicent Centre, que és només de la C3;
- copia el BRT (`brt_xirivella.geojson`);
- allarga les línies de tren que ixen de la Comunitat (`ferrocarril_fora_cv.json`): hi afig les parades de fora i el recorregut sencer;
- copia el límit de la Comunitat.

Es pot executar tantes vegades com calga. Després, reviseu el visor en local i pugeu els canvis de `dades/`. En arribar a `main`, es publiquen sols.

### 3. Xarxes d'autobús urbà

Cada xarxa urbana és una sola entrada del visor amb totes les seues línies, perquè les al·legacions van en conjunt. Perquè la xarxa no quede massa densa, cada carrer es dibuixa una única vegada encara que hi passen diverses línies. Quan l'operador publique un GTFS nou:

```
python3 scripts/xarxa_urbana.py ~/Baixades/emt scripts/fonts/emt_valencia.geojson
python3 scripts/xarxa_urbana.py ~/Baixades/vectalia scripts/fonts/urba_alacant.geojson \
    --id urba_alacant --codi Urbà --nom "Autobús urbà d'Alacant" \
    --nom-es "Autobús urbano de Alicante" --web https://alicante.vectalia.es/ --articles-majuscula
python3 scripts/completa_dades.py
```

La carpeta és el GTFS descomprimit. Per a afegir una altra ciutat: el mateix ordre amb un `--id` nou, afegir el fitxer a `fitxers` de `config.json` i a la llista de `completa_dades.py`, i posar-li un color a `colorsLinies`.

### Com es construeix cada servici

| Servici | Font | Criteri |
|---|---|---|
| Metrovalència | GTFS 1168 + GeoPackage + correccions | totes les línies de metro i tramvia |
| Rodalies | GTFS 1130 | núcleu de València (excepte C4) i núcleu d'Alacant-Murcia, retallat al límit de la Comunitat |
| TRAM d'Alacant | GTFS 1167 + GeoPackage | totes les línies; el recorregut és la variant més llarga d'entre les que fan almenys el 10 % dels viatges |
| Regionals | GTFS 1098 + xarxa ferroviària de l'ICV | trens Regional i Regional Exprés d'Alcoi, Alacant–València i València–Vinaròs/Tortosa, retallats al límit. El traçat és de la xarxa ferroviària d'interés general de l'ICV. |
| Mitja distància | GTFS 1098 + xarxa ferroviària de l'ICV | trens cap a Albacete i Saragossa, retallats al límit |
| Tram de fora de la Comunitat (tren) | GTFS de Renfe + BRouter (perfil ferroviari d'OpenStreetMap) | parades i traçat de fora per a la C1 fins a Múrcia, Vinaròs – Tortosa, Albacete i Terol – Saragossa (`ferrocarril_fora_cv.json`). Si Renfe canvia les parades d'eixos trens, cal actualitzar el fitxer. |
| TRAM de Castelló | OpenStreetMap | línia actual (Universitat Jaume I – el Grau), sense les ampliacions en projecte |
| BRT | Estudi informatiu de la plataforma reservada per al transport públic entre València i Xirivella (plànols de planta, juny 2024) | **en projecte**. Una línia Nou d'Octubre – Xirivella – Aldaia amb el ramal d'Alaquàs. El traçat s'ha digitalitzat sobre els plànols a escala 1:2.000 (amb la quadrícula UTM de cada full) i les parades són les «parada bus» dels plànols. El tros d'enllaç del ramal d'Alaquàs i l'avinguda de Blasco Ibáñez d'Alaquàs són d'OpenStreetMap. |
| Línies urbanes | GTFS de cada operador | EMT València i autobús urbà d'Alacant (Vectalia), una entrada per xarxa |
| Metrobús (ATMV) | Dades públiques del visor de Metrobús (Met Go) | les sis concessions de l'àrea metropolitana de València (CV-102, CV-103, CV-106, CV-107, CV-108 i CV-109), amb totes les línies de cada una |
| Línies interurbanes | GTFS 1526 + `codis_concessions.json` | una entrada per concessió, amb el codi de contracte de la Conselleria («Datos_concesiones_2025») |
| Línies interurbanes en projecte | Projectes de servici públic de la Conselleria | CV-207 Alacant Metropolità, CV-210 Vinalopó Alt i Mitjà, CV-213 Vega Baixa – Alacant i CV-303 Castelló – Vila-real – València, **en projecte**. Les línies i les parades són les de l'annex de parades de cada projecte. Els projectes no porten coordenades: les parades es van geocodificar amb OpenStreetMap (adreça i municipi) i el traçat va per carretera de parada a parada, de manera que és aproximat, sobretot dins de les ciutats. Cada carrer es dibuixa una sola vegada. |
| Línies estatals | Nou mapa concessional del Ministeri | una entrada per corredor (València – Alacant – Múrcia; Terol – Castelló – Barcelona; Sevilla – Màlaga – Barcelona) amb les rutes que tenen alguna parada a la Comunitat. Estan **en projecte**. Les parades i el seu ordre són els de l'annex II (itinerari); el traçat va per carretera de parada a parada i s'ha comprovat amb les distàncies parcials de l'annex. |
| Nodes | GTFS 1526 i Renfe | estacions d'autobusos i estacions principals d'Adif definides a `serveis.json` |

Les capes de Metrobús, línies estatals, concessions en projecte i TRAM de Castelló no tenen un procés automàtic: es van preparar una vegada a partir de les fonts indicades. Si canvien, cal tornar a preparar el fitxer corresponent de `scripts/fonts/`.

Les regles dels servicis del NAP (quines línies, quines parades identifiquen cada regional, quins nodes…) són a `scripts/serveis.json`. Altres opcions útils: `noms_parades` (dins d'una font) corregix noms de parada del GTFS, `prefix_codi` afig un prefix al codi de línia (el TRAM numera «1», «2»… i així es manté `tram_alacant:L1`) i `quota_recorregut` evita que el recorregut agafe variants esporàdiques.

### Codis de les concessions

El GTFS de la Generalitat no inclou el codi de contracte de cada concessió. Es posa a `scripts/fonts/codis_concessions.json`, per identificador de concessió del visor, i apareix al distintiu de la fitxa, a les etiquetes del mapa i a la llegenda, en la forma «[CE-920] Alberic – Alzira – València». CE vol dir contracte d'emergència. Les concessions que encara no tenen codi segur hi estan anotades.

### Traçats propis (GeoPackage)

Les línies de `scripts/fonts/AVPTP_xarxa.gpkg` (capa `ferrocarril_linies`) tenen prioritat sobre el traçat dels GTFS. El GTFS continua aportant les estacions, el recorregut i el color. Cada línia del GeoPackage es relaciona amb la del GTFS pel camp `xarxa` (segons la taula `geometries_propies.xarxes` de `serveis.json`) i pel codi (`nom`: «L1», «C3»…).

L'identificador del GeoPackage (`id_element`, per exemple `FER_FGV_V01`) es guarda com a identificador AVPTP de la línia. Es pot fer servir igual que l'identificador del visor per a associar-hi documentació i per a enllaçar-la.

Per a afegir o corregir traçats, n'hi ha prou amb editar el GeoPackage (per exemple, amb QGIS) i tornar a executar el procés.

## Comentaris sobre el visor

El botó «Comentaris» (a baix a la dreta) obri un menú amb tres opcions: **Millora**, **Error** i **Altres**. Cada una obri el programa de correu amb un missatge a l'adreça de `comentaris.correu` de `config.json` (`contacte@avptp.org`), amb l'assumpte «[Visor] Millora», «[Visor] Error»… i, al cos, l'adreça del visor en eixe moment (amb l'element seleccionat) i el navegador. El menú avisa que és només per al funcionament del visor, no per a propostes de transport públic. Si s'esborra `comentaris` de `config.json`, el botó no apareix.

## Documentació i mitjans

`dades/documentacio.csv` té una fila per document o aparició als mitjans, amb separador `;` i codificació UTF-8. A Excel, cal guardar-lo amb *Desa com a → CSV UTF-8*.

| Columna | Contingut |
|---|---|
| `id` | Identificador de l'element. Si afecta diversos elements, es separen amb `\|`. |
| `tipus` | `pdf`, `enllac`, `imatge` o `text` per a documents de l'associació; `premsa` per a aparicions als mitjans (notícies, entrevistes…) |
| `titol_ca`, `titol_es` | Títol en cada idioma. Si en falta un, es mostra l'altre. |
| `url` | Adreça del document o de la notícia |
| `idioma` | Idioma del document (`ca` o `es`). Quan no coincidix amb el de la interfície, es mostra l'avís «En castellà» o «En valencià». |
| `data` | Data (AAAA-MM-DD), opcional |
| `descripcio_ca`, `descripcio_es` | Text breu, opcional |
| `mitja` | Només per a `premsa`: nom del mitjà (per exemple, *València Extra*) |

Les files de tipus `premsa` es mostren a la fitxa en un apartat propi, «Als mitjans», de la més recent a la més antiga, amb el nom del mitjà i la data. La resta van a «Documentació».

La columna `id` diu a quin element es mostra. És el mateix identificador que apareix a l'adreça en seleccionar l'element (`…#metrovalencia:10`) i, en mode d'edició (`index.html?editor`), al final de la fitxa amb un botó per a copiar-lo. Per a les línies amb traçat propi també val l'identificador AVPTP del GeoPackage (`FER_FGV_V01`), que no canvia encara que canvie el GTFS.

Els documents no s'importen: el visor enllaça directament a on estiguen (el servidor de l'associació, el mitjà…). A `config.json`, `documentacio` és una llista de fonts. S'hi poden afegir més fulls CSV o fitxers JSON amb les mateixes columnes, locals o remots. Un full remot, d'un altre domini, ha de permetre CORS. Els fitxers de `raw.githubusercontent.com` ja el permeten.

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

`limit` de `config.json` dibuixa el contorn de la Comunitat Valenciana i cobrix la resta del mapa amb un vel blanc semitransparent. `opacitatFora` regula el vel (0 el lleva, 1 amaga del tot l'exterior) i `vora`, `gruixVora` i `opacitatVora`, la línia del contorn. El límit és el oficial de l'Institut Cartogràfic Valencià, simplificat a uns 10 m, i també servix per a retallar les línies que ixen de la Comunitat. El fitxer `dades/limit_cv.geojson` es copia des de `scripts/limit_cv.geojson`.

## Llicències i atribucions

El peu del mapa i el panell de capes citen les administracions d'on venen les dades: Ministeri de Transports i Mobilitat Sostenible, Generalitat Valenciana, Autoritat de Transport Metropolità de València i Institut Cartogràfic Valencià (camps `atribucioDades` i `fonts` de `config.json`).

- **Dades de transport del NAP:** la llicència obliga a citar «Powered by MITRAMS» amb un enllaç a https://www.transportes.gob.es. Es manté al peu del mapa.
- **Línies estatals:** annexos II i III del nou mapa concessional del Ministeri. Els traçats s'han calculat per carretera (OSRM, dades © col·laboradors d'OpenStreetMap) entre les parades de l'itinerari.
- **Metrobús (ATMV):** dades públiques del visor de Metrobús (Met Go).
- **Línies urbanes:** GTFS de l'EMT València i de Vectalia (autobús urbà d'Alacant).
- **TRAM de Castelló:** traçat i parades d'OpenStreetMap (ODbL).
- **Trams de tren de fora de la Comunitat:** parades del GTFS de Renfe; traçat calculat amb BRouter sobre dades © col·laboradors d'OpenStreetMap (ODbL).
- **Concessions interurbanes en projecte:** projectes de servici públic de la Generalitat; parades geocodificades amb CartoCiudad (© IGN) i OpenStreetMap, i traçat per carretera amb OSRM.
- **Límit de la Comunitat i xarxa ferroviària:** Institut Cartogràfic Valencià.
- **Mapa de fons:** OpenFreeMap, © OpenMapTiles, © col·laboradors d'OpenStreetMap (ODbL); © IGN (CC BY 4.0, mapa base gris i PNOA). Llibreria MapLibre GL (BSD-3).
- **Llibreria de mapes:** Leaflet 1.9.4 (BSD-2).
- **Codi:** llicència MIT (vegeu `LICENSE`). Les dades i els logotips tenen les llicències indicades ací damunt.
- **Logotips:** el de l'AVPTP és propietat de l'associació; els dels servicis, dels seus titulars (FGV, Renfe, Generalitat Valenciana, Ministeri de Transports, Metrobús, TRAM de Castelló), i s'usen només per a identificar cada servici.

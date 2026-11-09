# Visor de la xarxa de transport públic

Visor interactiu de la xarxa de transport públic de la Comunitat Valenciana per a la web de l'AVPTP. Mostra els servicis ferroviaris, les concessions d'autobús interurbà i els nodes de transport principals. En seleccionar qualsevol element s'obri una fitxa amb les seues dades, les connexions amb la resta de la xarxa i la documentació associada.

El visor és estàtic: no té base de dades ni processos automàtics. Les dades s'actualitzen a mà quan es vulga (vegeu «Actualitzar les dades»).

## Què hi ha i on va

Les carpetes segueixen l'estructura del repositori `avptp/face`, de manera que es poden copiar directament a l'arrel:

```
                 ← el visor (Next.js el servix tal qual)
  index.html
  css/visor.css               colors corporatius i aparença
  js/visor.js                 funcionament
  js/i18n.js                  textos en valencià i castellà
  img/                        logotip i isotip de l'AVPTP
  dades/config.json           servicis, colors, mapes de fons i fonts de documentació
  dades/*.geojson             capes generades (no s'editen a mà)
  dades/metadades.json        data i origen de les dades
  dades/documentacio.csv      documentació associada a cada element
scripts/                ← preparació de les dades (no es publica)
  actualitza_dades.py         genera dades a partir dels GTFS del NAP
  serveis.json                quines rutes s'agafen i com s'agrupen
  fonts/AVPTP_xarxa.gpkg      traçats propis de l'AVPTP
  limit_cv.geojson            límit de la Comunitat (per a retallar les línies que ixen)
  requirements.txt
```

Una vegada desplegat, el visor queda a `https://avptp.org/visor/index.html`.

Per a tindre també l'adreça curta `https://avptp.org/visor`, afegiu una reescriptura a `next.config.js`:

```js
module.exports = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  async rewrites() {
    return [{ source: "/visor", destination: "/visor/index.html" }];
  },
};
```

### Incrustar-lo en una pàgina

```html
<iframe src="/visor/index.html?sense-titol"
        title="Visor de la xarxa de transport públic"
        style="width:100%; height:80vh; min-height:540px; border:0"
        loading="lazy" allow="clipboard-write"></iframe>
```

- `?sense-titol` amaga el títol, si la pàgina ja en té un.
- `?hl=ca` o `?hl=es` fixa l'idioma. És el mateix paràmetre que fa servir la web.
- `#identificador` obri directament la fitxa d'un element, per exemple `#rodalies:valencia:C1`. La barra d'adreces s'actualitza en seleccionar elements, així que es poden copiar i compartir enllaços.

### Idioma

El visor tria l'idioma en este ordre:

1. El paràmetre `hl` de l'adreça.
2. La galeta `language` de la web de l'AVPTP.
3. L'última tria feta al visor.
4. L'idioma del navegador.

Quan l'usuari canvia l'idioma des del visor, també s'actualitza la galeta `language`, de manera que la web i el visor queden sincronitzats. Els textos de la interfície són a `js/i18n.js`.

### Provar-lo en local

```
cd public/visor
python3 -m http.server
```

i obriu `http://localhost:8000`. Obrir `index.html` amb doble clic no funciona perquè el navegador no deixa llegir les dades.

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

4. Reviseu el visor en local i pugeu els canvis de `dades`.

Si falta el GTFS d'una font, el procés ho avisa. Els servicis que en depenen queden buits o es construeixen només amb els traçats propis.

### Traçats propis (GeoPackage)

Les línies de `fonts/AVPTP_xarxa.gpkg` (capa `ferrocarril_linies`) tenen prioritat sobre el traçat dels GTFS. El GTFS continua aportant les estacions, el recorregut i el color. Cada línia del GeoPackage es relaciona amb la del GTFS pel camp `xarxa` (segons la taula `geometries_propies.xarxes` de `serveis.json`) i pel codi (`nom`: «L1», «C3»…).

L'identificador del GeoPackage (`id_element`, per exemple `FER_FGV_V01`) es guarda com a identificador AVPTP de la línia. Es pot fer servir igual que l'identificador del visor per a associar-hi documentació i per a enllaçar-la.

Per a afegir o corregir traçats, n'hi ha prou amb editar el GeoPackage (per exemple, amb QGIS) i tornar a executar el procés.

### Com es construeix cada servici

| Servici | Font | Criteri |
|---|---|---|
| Metrovalència | GTFS 1168 + GeoPackage + correccions | totes les línies de metro i tramvia; les línies 4 (amb els ramals de Lloma Llarga i Fira València), 6, 8 i 9 es corregixen amb `completa_dades.py` |
| Rodalies | GTFS 1130 | núcleu de València (excepte C4) i núcleu d'Alacant-Múrcia, retallat al límit de la Comunitat |
| TRAM d'Alacant | GTFS 1167 + GeoPackage | totes les línies |
| Regionals i Mitja distància | GTFS 1098 + xarxa ferroviària de l'ICV | les estacions i el recorregut venen del GTFS; el traçat, de la xarxa ferroviària d'interés general de l'ICV (el GTFS de Renfe no en porta) |
| Línies interurbanes | GTFS 1526 + `codis_concessions.json` | una entrada per concessió, amb el codi de contracte de la Conselleria |
| Metrobús (ATMV) | `fonts/atmv.geojson` | les sis concessions de l'àrea metropolitana de València (Met Go), amb les línies de cada una |
| Línies estatals | `fonts/estatals.geojson` | una entrada per corredor del nou mapa concessional del Ministeri (annex III), amb les rutes que tenen alguna parada a la Comunitat. Estan **en projecte**. El detall de cada ruta (traçat i parades) és a `fonts/estatals_rutes.geojson` |
| TRAM de Castelló | `fonts/tram_castello.geojson` | línia actual (Universitat Jaume I – el Grau) |
| Nodes | GTFS 1526 i Renfe | estacions d'autobusos i estacions principals d'Adif definides a `serveis.json` |

Les regles (quines línies, quines parades identifiquen cada regional, quins nodes…) són a `scripts/serveis.json`.

### Capes i correccions que no venen del NAP

Després de `actualitza_dades.py` s'ha d'executar sempre:

```
python3 scripts/completa_dades.py
```

No necessita cap llibreria. Copia les capes estàtiques (`estatals`, `atmv`, `tram_castello`), posa el límit de la Comunitat i torna a aplicar les correccions de `scripts/fonts/`:

| Fitxer | Què fa |
|---|---|
| `correccions_metrovalencia.json` | Traçat, parades i color de les línies 4 (amb el ramal de Fira València), 6, 8 (Marítim – Neptú, `#40B2CB`) i 9 (`#AD7D4F`). Els traçats són de la xarxa de ferrocarrils de la Generalitat de l'ICV. |
| `tracats_renfe.json` | Traçat de les línies regionals i de mitja distància sobre la xarxa ferroviària de l'Estat de l'ICV. |
| `codis_concessions.json` | Codi de contracte de cada concessió de la Generalitat (full «Datos_concesiones_2025»). Les concessions que encara no tenen codi segur hi apareixen anotades. A la llegenda es mostren com a «[CODI] Nom». |

### Estat de les línies

Cada línia o concessió pot portar el camp `estat`: `servei` (per defecte) o `projecte`. Les línies en projecte es dibuixen discontínues, porten l'etiqueta «En projecte» a la fitxa i a la llegenda, i el panell de capes permet mostrar o amagar cada estat. Per a una ampliació en projecte d'una línia en servici, cal afegir-la com a element separat amb `estat: projecte`, de manera que la línia actual continue sencera «En servici».

Les línies retallades al límit de la Comunitat poden portar `complet` (el recorregut sencer): en seleccionar-les, la part de fora es mostra difuminada. Les parades de fora de la Comunitat porten `fora_cv: true` i surten en gris al recorregut.

### Visor autònom

`python3 scripts/fes_autonom.py` genera `visor-avptp-autonom.html`, un sol fitxer amb tot dins que es pot obrir sense servidor.

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

L'identificador de cada element apareix al final de la seua fitxa, amb un botó per a copiar-lo.

Els documents no s'importen: el visor enllaça directament a on estiguen (el servidor de l'associació, GitHub…). A `config.json`, `documentacio` és una llista de fonts. S'hi poden afegir més fulls CSV o fitxers JSON amb les mateixes columnes, locals o remots. Un full remot, d'un altre domini, ha de permetre CORS. Els fitxers de `raw.githubusercontent.com` ja el permeten.

## Mapa de fons

Els mapes de fons es configuren a `mapesBase` de `config.json`: dos mapes vectorials d'OpenFreeMap (dades d'OpenStreetMap) i el mapa gris i l'ortofoto de l'IGN.

## Llicències i atribucions

El peu del mapa i el panell de capes citen només les administracions d'on venen les dades: Ministeri de Transports i Mobilitat Sostenible, Generalitat Valenciana, Autoritat de Transport Metropolità de València i Institut Cartogràfic Valencià (camps `atribucioDades` i `fonts` de `config.json`).

- **Dades de transport del NAP:** la llicència obliga a citar «Powered by MITRAMS» amb un enllaç a https://www.transportes.gob.es. Es manté al peu del mapa.
- **Línies estatals:** mapes de l'annex III del nou mapa concessional del Ministeri. Els traçats s'han digitalitzat a partir d'eixos plànols.
- **Metrobús (ATMV):** dades públiques del visor de Metrobús (Met Go).
- **TRAM de Castelló:** traçat i parades d'OpenStreetMap (ODbL).
- **Límit de la Comunitat i xarxa ferroviària:** Institut Cartogràfic Valencià.
- **Mapes de fons:** OpenFreeMap, © OpenMapTiles, © col·laboradors d'OpenStreetMap; © IGN (CC BY 4.0).
- **Llibreria de mapes:** Leaflet 1.9.4 (BSD-2).
- **Logotips:** de l'AVPTP i, per a cada servici, del seu titular.

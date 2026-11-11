/* Fitxes d'incidència de l'AVPTP (al·legacions i presència als mitjans) per a imprimir o desar en PDF.
 *
 * visor.js prepara les fitxes (una per element, o una per servici en el cas del ferrocarril) i crida
 * VisorInforme.genera(api, finestra). Ací es dibuixen els mapes sobre el mapa de fons «Gris» i es compon un
 * document HTML amb l'estil de les fitxes de l'associació, que s'obri en una finestra nova i s'imprimix
 * (el navegador ofereix «Desa com a PDF»).
 */
(function () {
  'use strict';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const TXT = {
    ca: {
      banda: 'Fitxa d’incidència · Al·legacions i mitjans', linies_servici: 'Línies del servici', documentada: 'Documentada',
      linies: 'línies', parades: 'parades', longitud: 'longitud', h_linies: 'Línies', h_parades: 'Parades', ramal: 'Ramal',
      s1: 'Al·legacions i observacions', s2: 'Presència als mitjans', buit1: 'No hi ha al·legacions ni observacions registrades.',
      buit2: 'No hi ha aparicions registrades als mitjans.', afecta: 'Afecta', en_resum: 'En resum:', posicio: 'Posició de l’AVPTP:',
      id1: 'Identificador', idn: 'Identificadors', docs: ['document', 'documents'], premsa: ['aparició als mitjans', 'aparicions als mitjans'],
      peu: 'Associació Valenciana pel Transport Públic · Fitxa generada el {avui} a partir del visor de la xarxa (dades del {generat}). Els resums són orientatius; el text vàlid és el del document original.',
      titol: 'Fitxes AVPTP · Al·legacions i mitjans · {avui}', mitja: 'Premsa',
      portada: 'Al·legacions i presència als mitjans', portada_sub: 'Fitxes d’incidència generades des del visor de la xarxa de transport públic el {avui}.',
      index: 'Fitxes', imprimix: 'Desa en PDF o imprimix', preparant: 'Preparant les fitxes…',
      ajuda: 'Per a desar-les en PDF, tria «Desa com a PDF» com a destinació a la finestra d’impressió.',
    },
    es: {
      banda: 'Ficha de incidencia · Alegaciones y medios', linies_servici: 'Líneas del servicio', documentada: 'Documentada',
      linies: 'líneas', parades: 'paradas', longitud: 'longitud', h_linies: 'Líneas', h_parades: 'Paradas', ramal: 'Ramal',
      s1: 'Alegaciones y observaciones', s2: 'Presencia en los medios', buit1: 'No hay alegaciones ni observaciones registradas.',
      buit2: 'No hay apariciones registradas en los medios.', afecta: 'Afecta', en_resum: 'En resumen:', posicio: 'Posición de la AVPTP:',
      id1: 'Identificador', idn: 'Identificadores', docs: ['documento', 'documentos'], premsa: ['aparición en los medios', 'apariciones en los medios'],
      peu: 'Associació Valenciana pel Transport Públic · Ficha generada el {avui} a partir del visor de la red (datos del {generat}). Los resúmenes son orientativos; el texto válido es el del documento original.',
      titol: 'Fichas AVPTP · Alegaciones y medios · {avui}', mitja: 'Prensa',
      portada: 'Alegaciones y presencia en los medios', portada_sub: 'Fichas de incidencia generadas desde el visor de la red de transporte público el {avui}.',
      index: 'Fichas', imprimix: 'Guardar en PDF o imprimir', preparant: 'Preparando las fichas…',
      ajuda: 'Para guardarlas en PDF, elige «Guardar como PDF» como destino en la ventana de impresión.',
    },
  };

  /* ---------- Mapes ---------- */

  const MW = 1040, MH = 600; // píxels de cada mapa (520 × 300 a la fitxa)

  const merc = ([lon, lat]) => {
    const s = Math.sin(lat * Math.PI / 180);
    return [(lon + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)];
  };

  function caixa(capes, punts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const afig = ([x, y]) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
    for (const c of capes) if (!c.fora) for (const l of c.linies) l.forEach(afig);
    punts.forEach(afig);
    if (!isFinite(x0)) return null;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const dx = Math.max((x1 - x0) * 1.1, 0.03), dy = Math.max((y1 - y0) * 1.1, 0.02);
    return [[cx - dx / 2, cy - dy / 2], [cx + dx / 2, cy + dy / 2]];
  }

  function projeccioPropia(bb) {
    const a = merc(bb[0]), b = merc(bb[1]);
    const w = Math.abs(b[0] - a[0]), h = Math.abs(b[1] - a[1]);
    const k = Math.min((MW - 60) / w, (MH - 60) / h);
    const ox = (MW - w * k) / 2, oy = (MH - h * k) / 2;
    const minx = Math.min(a[0], b[0]), miny = Math.min(a[1], b[1]);
    return (ll) => { const m = merc(ll); return [ox + (m[0] - minx) * k, oy + (m[1] - miny) * k]; };
  }

  function esperaIdle(map, ms) {
    return new Promise((res) => {
      let fet = false;
      const fi = () => { if (!fet) { fet = true; res(); } };
      map.once('idle', fi);
      setTimeout(fi, ms);
    });
  }

  async function mapaFons(api) {
    const m = api.mapaGris;
    if (!m || m.tipus !== 'vectorial') return null;
    try {
      await api.carregaMaplibre();
      if (!window.maplibregl) return null;
      const div = document.createElement('div');
      div.style.cssText = `position:fixed;left:-${MW + 200}px;top:0;width:${MW}px;height:${MH}px;`;
      document.body.appendChild(div);
      const map = new maplibregl.Map({
        container: div, style: m.estil, interactive: false, attributionControl: false,
        preserveDrawingBuffer: true, pixelRatio: 1, fadeDuration: 0, center: [-0.6, 39.3], zoom: 7,
      });
      await esperaIdle(map, 15000);
      return { map, div };
    } catch (e) {
      return null;
    }
  }

  async function dibuixaMapa(api, fx, fons) {
    const bb = caixa(fx.capes, fx.punts);
    if (!bb) return '';
    const cv = document.createElement('canvas');
    cv.width = MW; cv.height = MH;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#eef3f4';
    ctx.fillRect(0, 0, MW, MH);
    let proj = projeccioPropia(bb);
    let ambFons = false;
    if (fons) {
      try {
        fons.map.fitBounds(bb, { padding: 30, animate: false, duration: 0 });
        await esperaIdle(fons.map, 12000);
        ctx.drawImage(fons.map.getCanvas(), 0, 0, MW, MH);
        proj = (ll) => { const p = fons.map.project(ll); return [p.x, p.y]; };
        ambFons = true;
      } catch (e) { /* sense fons */ }
    }
    const cami = (l) => { ctx.beginPath(); l.forEach((ll, i) => { const [x, y] = proj(ll); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); };
    // La Comunitat: blanca sense fons; amb fons, vel suau fora i vora
    if (api.limit?.length) {
      if (ambFons) {
        ctx.beginPath(); ctx.rect(0, 0, MW, MH);
        for (const a of api.limit) a.forEach((ll, i) => { const [x, y] = proj(ll); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill('evenodd');
      } else {
        ctx.fillStyle = '#ffffff';
        for (const a of api.limit) { cami(a); ctx.fill(); }
      }
      ctx.strokeStyle = ambFons ? 'rgba(48,54,75,0.55)' : '#c9d3d6'; ctx.lineWidth = 2;
      for (const a of api.limit) { cami(a); ctx.stroke(); }
    }
    for (const c of fx.capes) {
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.globalAlpha = c.alpha ?? 1;
      ctx.setLineDash([]);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = c.gruix * 2 + 5;
      for (const l of c.linies) { cami(l); ctx.stroke(); }
      ctx.strokeStyle = c.color; ctx.lineWidth = c.gruix * 2;
      if (c.guions) ctx.setLineDash(c.guions);
      for (const l of c.linies) { cami(l); ctx.stroke(); }
      ctx.restore();
    }
    for (const ll of fx.punts) {
      const [x, y] = proj(ll);
      ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = fx.color; ctx.stroke();
    }
    if (ambFons) {
      ctx.font = '15px "Inter", Helvetica, Arial, sans-serif';
      const credit = '© OpenFreeMap · OpenMapTiles · col·laboradors d’OpenStreetMap';
      const w = ctx.measureText(credit).width + 12;
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(MW - w, MH - 22, w, 22);
      ctx.fillStyle = '#555'; ctx.fillText(credit, MW - w + 6, MH - 6);
    }
    return cv.toDataURL('image/jpeg', 0.88);
  }

  /* ---------- HTML de les fitxes ---------- */

  const CSS = `
@page { size: A4; margin: 14mm 15mm 16mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Inter, -apple-system, "Segoe UI", Roboto, "DejaVu Sans", Arial, sans-serif; color: #30364b; font-size: 9.6pt; line-height: 1.45; margin: 0; }
a { color: #1f7d85; text-decoration: none; word-break: break-all; }
.fitxa { break-after: page; }
.fitxa:last-child { break-after: auto; }
.cap { border-radius: 8px; overflow: hidden; border: 1px solid #e1e4e8; margin-bottom: 12px; }
.banda { background: #30364b; color: #cfd3dc; display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; font-size: 8pt; letter-spacing: .02em; }
.banda img { height: 20px; width: auto; display: block; }
.titol { display: flex; gap: 14px; align-items: center; padding: 14px 16px; border-left: 6px solid var(--c); }
.logo-servei { width: 46px; height: 46px; object-fit: contain; border-radius: 6px; }
.grup { margin: 0; text-transform: uppercase; font-size: 7.5pt; letter-spacing: .08em; color: #586069; font-weight: 600; }
h1 { margin: 2px 0 6px; font-size: 19pt; line-height: 1.15; letter-spacing: -.01em; }
.xips { display: flex; flex-wrap: wrap; gap: 5px; }
.xip-cap { background: #f1f3f5; border-radius: 99px; padding: 2px 9px; font-size: 7.8pt; font-weight: 600; }
.resum { display: grid; grid-template-columns: 1.15fr 1fr; gap: 14px; margin-bottom: 6px; break-inside: avoid; }
.mapa { width: 100%; height: auto; border-radius: 6px; border: 1px solid #e1e4e8; display: block; }
.dades h4 { margin: 0 0 5px; font-size: 8pt; text-transform: uppercase; letter-spacing: .06em; color: #586069; }
.linies { list-style: none; margin: 0; padding: 0; }
.linies li { display: flex; align-items: center; gap: 7px; padding: 2px 0; font-size: 8.4pt; color: #6a7280; }
.linies li.afectada { color: #30364b; font-weight: 600; }
.cl { min-width: 26px; text-align: center; color: #fff; border-radius: 3px; font-size: 7.4pt; font-weight: 700; padding: 1px 4px; text-shadow: 0 0 2px rgba(0,0,0,.35); }
.marca { margin-left: auto; background: #ffb75e; color: #30364b; border-radius: 3px; font-size: 6.8pt; padding: 0 5px; white-space: nowrap; }
.xifres { display: flex; gap: 8px; margin-bottom: 10px; }
.xifres div { flex: 1; background: #f6f6f6; border-radius: 6px; padding: 7px 9px; }
.xifres b { display: block; font-size: 15pt; line-height: 1.1; }
.xifres span { font-size: 7.6pt; color: #586069; }
.linies-bus { margin: 0; padding: 0; list-style: none; font-size: 7.8pt; }
.linies-bus.dues { columns: 2; column-gap: 18px; }
.linies-bus li { break-inside: avoid; padding: 1px 0; border-bottom: 1px dotted #e1e4e8; }
.sota { margin-top: 8px; }
.nums span { display: inline-block; background: #f1f3f5; border-radius: 3px; padding: 0 5px; margin: 0 2px 3px 0; font-size: 7.6pt; font-weight: 600; }
.recorregut { font-size: 8.2pt; margin: 0 0 5px; }
h2 { font-size: 12.5pt; margin: 16px 0 8px; padding-bottom: 5px; border-bottom: 2px solid #5fc1c8; display: flex; align-items: center; gap: 8px; break-after: avoid; }
h2 .n { background: #5fc1c8; color: #fff; width: 20px; height: 20px; border-radius: 50%; font-size: 9pt; display: inline-flex; align-items: center; justify-content: center; }
.doc { border: 1px solid #e1e4e8; border-radius: 7px; padding: 10px 13px; margin-bottom: 9px; }
.doc-cap { display: flex; gap: 6px; align-items: center; margin-bottom: 4px; }
.tipus { background: #30364b; color: #fff; border-radius: 3px; font-size: 6.8pt; font-weight: 700; padding: 1px 6px; letter-spacing: .04em; }
.tipus.mitja { background: #e8eefb; color: #2b4c9a; }
.xip { background: #fff1de; color: #8a5a10; border-radius: 3px; font-size: 7pt; font-weight: 600; padding: 1px 6px; }
.doc h3 { font-size: 10.4pt; margin: 2px 0 3px; line-height: 1.3; break-after: avoid; }
.meta { color: #586069; font-size: 8pt; margin: 0 0 5px; }
.context { color: #586069; font-style: italic; margin: 0 0 4px; }
.doc p { margin: 0 0 5px; }
.punts { margin: 6px 0 6px; padding-left: 18px; }
.punts li { margin-bottom: 4px; break-inside: avoid; }
.punts li::marker { color: #1f7d85; font-weight: 700; }
.conclusio, .posicio { background: #eef7f8; border-left: 3px solid #5fc1c8; padding: 6px 9px; border-radius: 0 4px 4px 0; }
.enllac { font-size: 7.4pt; margin-top: 6px !important; }
.buit { color: #586069; font-style: italic; }
footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #e1e4e8; font-size: 7.4pt; color: #586069; break-inside: avoid; }
footer p { margin: 0 0 2px; }
.portada .titol { border-left-color: #5fc1c8; }
.portada .index { list-style: none; margin: 0; padding: 0; }
.portada .index li { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px dotted #e1e4e8; }
.portada .index .q { width: 10px; height: 10px; border-radius: 2px; flex: none; }
.portada .index small { margin-left: auto; color: #586069; }
.barra { position: sticky; top: 0; z-index: 2; display: flex; gap: 12px; align-items: center; justify-content: center; padding: 10px; background: #30364b; color: #fff; font-size: 10pt; }
.barra button { font: inherit; font-weight: 600; border: 0; border-radius: 99px; padding: 6px 16px; background: #5fc1c8; color: #30364b; cursor: pointer; }
@media screen { body { background: #e9ecef; } .full { background: #fff; max-width: 210mm; margin: 14px auto; padding: 14mm 15mm 16mm; box-shadow: 0 1px 6px rgba(0,0,0,.15); } }
@media print { .barra { display: none; } .full { padding: 0; } }
`;

  function compon(api, fitxes, mapes, T) {
    const pl = (arr, n) => `${n} ${arr[n === 1 ? 0 : 1]}`;
    const omple = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
    const banda = `<div class="banda"><img src="${esc(api.logo)}" alt="AVPTP"><span>${esc(T.banda)}</span></div>`;

    const pintaDoc = (d) => {
      const r = d.resum || {};
      const h = [`<article class="doc"><div class="doc-cap"><span class="tipus">${esc(d.tipus)}</span>${d.afecta ? `<span class="xip">${esc(T.afecta)}: ${esc(d.afecta)}</span>` : ''}</div>`,
        `<h3>${esc(d.titol)}</h3>`];
      const meta = [d.data, d.idioma].filter(Boolean).join(' · ');
      if (meta) h.push(`<p class="meta">${esc(meta)}</p>`);
      if (r.context) h.push(`<p class="context">${esc(r.context)}</p>`);
      if (r.objecte) h.push(`<p>${esc(r.objecte)}</p>`);
      else if (d.desc) h.push(`<p>${esc(d.desc)}</p>`);
      if (r.punts?.length) h.push(`<ol class="punts">${r.punts.map(([a, b]) => `<li><b>${esc(a)}.</b> ${esc(b)}</li>`).join('')}</ol>`);
      if (r.conclusio) h.push(`<p class="conclusio"><b>${esc(T.en_resum)}</b> ${esc(r.conclusio)}</p>`);
      if (d.url) h.push(`<p class="enllac"><a href="${esc(d.url)}">${esc(d.url)}</a></p>`);
      return h.join('') + '</article>';
    };
    const pintaPremsa = (d) => {
      const r = d.resum || {};
      const h = [`<article class="doc premsa"><div class="doc-cap"><span class="tipus mitja">${esc(d.mitja || T.mitja)}</span>`
        + `<span class="meta">${esc([d.data, d.afecta].filter(Boolean).join(' · '))}</span></div>`, `<h3>${esc(d.titol)}</h3>`];
      if (r.resum) h.push(`<p>${esc(r.resum)}</p>`);
      else if (d.desc) h.push(`<p>${esc(d.desc)}</p>`);
      if (r.posicio) h.push(`<p class="posicio"><b>${esc(T.posicio)}</b> ${esc(r.posicio)}</p>`);
      if (d.url) h.push(`<p class="enllac"><a href="${esc(d.url)}">${esc(d.url)}</a></p>`);
      return h.join('') + '</article>';
    };

    const pintaFitxa = (fx, i) => {
      let dades = '', sota = '';
      if (fx.ferro) {
        dades = `<h4>${esc(T.linies_servici)}</h4><ul class="linies">${fx.membres.map((m) => `<li class="${m.doc ? 'afectada' : ''}">`
          + `<span class="cl" style="background:${esc(m.color)}">${esc(m.codi)}</span><span>${esc(m.nom)}</span>`
          + `${m.doc ? `<span class="marca">${esc(T.documentada)}</span>` : ''}</li>`).join('')}</ul>`;
      } else {
        const fets = [];
        if (fx.linies.length) fets.push(`<div><b>${fx.linies.length}</b><span>${esc(T.linies)}</span></div>`);
        if (fx.nParades) fets.push(`<div><b>${fx.nParades}</b><span>${esc(T.parades)}</span></div>`);
        if (fx.longitud) fets.push(`<div><b>${esc(fx.longitud)}</b><span>${esc(T.longitud)}</span></div>`);
        if (fets.length) dades += `<div class="xifres">${fets.join('')}</div>`;
        const ll = fx.linies;
        if (ll.length && ll.length <= 6) dades += `<h4>${esc(T.h_linies)}</h4><ul class="linies-bus">${ll.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
        else if (ll.length && ll.length <= 30) sota = `<h4>${esc(T.h_linies)}</h4><ul class="linies-bus dues">${ll.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
        else if (ll.length) dades += `<h4>${esc(T.h_linies)}</h4><p class="nums">${ll.map((x) => `<span>${esc(x.split(' ')[0])}</span>`).join(' ')}</p>`;
        else if (fx.parades.length) {
          dades += `<h4>${esc(T.h_parades)}</h4><p class="recorregut">${fx.parades.map(esc).join(' · ')}</p>`;
          for (const r of fx.ramals) dades += `<p class="recorregut"><b>${esc(T.ramal)} ${esc(r.nom)}:</b> ${r.parades.map(esc).join(' · ')}</p>`;
        }
      }
      const docs = fx.docs.filter((d) => !d.premsa);
      const premsa = fx.docs.filter((d) => d.premsa);
      const xips = [fx.codi, fx.estat].filter(Boolean).map((x) => `<span class="xip-cap">${esc(x)}</span>`);
      if (docs.length) xips.push(`<span class="xip-cap">${esc(pl(T.docs, docs.length))}</span>`);
      if (premsa.length) xips.push(`<span class="xip-cap">${esc(pl(T.premsa, premsa.length))}</span>`);
      return `<div class="fitxa full" id="f${i}">
<header class="cap" style="--c:${esc(fx.color)}">${banda}
  <div class="titol">${fx.logo ? `<img class="logo-servei" src="${esc(fx.logo)}" alt="">` : ''}
    <div><p class="grup">${esc(fx.grup)}${fx.sub ? ' · ' + esc(fx.sub) : ''}</p><h1>${esc(fx.titol)}</h1><div class="xips">${xips.join('')}</div></div>
  </div>
</header>
<section class="resum"><div class="mapa-wrap">${mapes[i] ? `<img class="mapa" src="${mapes[i]}" alt="">` : ''}</div><div class="dades">${dades}</div></section>
${sota ? `<section class="sota dades">${sota}</section>` : ''}
<section><h2><span class="n">1</span>${esc(T.s1)}</h2>${docs.map(pintaDoc).join('') || `<p class="buit">${esc(T.buit1)}</p>`}</section>
<section><h2><span class="n">2</span>${esc(T.s2)}</h2>${premsa.map(pintaPremsa).join('') || `<p class="buit">${esc(T.buit2)}</p>`}</section>
<footer>
  <p><b>${esc(fx.ids.length > 1 ? T.idn : T.id1)}:</b> ${esc(fx.ids.join(' | '))}</p>
  <p>${fx.ids.map((id) => `<a href="${esc(api.urlVisor)}#${esc(id)}">${esc(api.urlVisor.replace(/^https?:\/\//, ''))}#${esc(id)}</a>`).join(' · ')}</p>
  <p>${esc(omple(T.peu, { avui: api.avui, generat: api.generat }))}</p>
</footer></div>`;
    };

    const nDocs = fitxes.reduce((a, f) => a + f.docs.filter((d) => !d.premsa).length, 0);
    const nPremsa = fitxes.reduce((a, f) => a + f.docs.filter((d) => d.premsa).length, 0);
    const portada = `<div class="fitxa full portada">
<header class="cap" style="--c:#5fc1c8">${banda}
  <div class="titol"><div><p class="grup">Associació Valenciana pel Transport Públic</p><h1>${esc(T.portada)}</h1>
  <div class="xips"><span class="xip-cap">${fitxes.length} ${esc(T.index.toLowerCase())}</span><span class="xip-cap">${esc(pl(T.docs, nDocs))}</span><span class="xip-cap">${esc(pl(T.premsa, nPremsa))}</span></div></div></div>
</header>
<p class="meta">${esc(omple(T.portada_sub, { avui: api.avui }))}</p>
<h2><span class="n">·</span>${esc(T.index)}</h2>
<ul class="index">${fitxes.map((f, i) => `<li><span class="q" style="background:${esc(f.color)}"></span><a href="#f${i}"><b>${esc(f.codi ? f.codi + ' · ' : '')}</b>${esc(f.titol)}</a><small>${esc(f.grup)}</small></li>`).join('')}</ul>
</div>`;

    return `<!doctype html><html lang="${esc(api.idioma)}"><head><meta charset="utf-8">
<title>${esc(omple(T.titol, { avui: api.avui }))}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>
<div class="barra"><span>${esc(T.ajuda)}</span><button type="button" onclick="print()">${esc(T.imprimix)}</button></div>
${portada}
${fitxes.map(pintaFitxa).join('\n')}
</body></html>`;
  }

  // finestra: una finestra ja oberta (en el moment del clic, per a evitar el bloqueig de finestres emergents)
  async function genera(api, finestra, avanc = () => {}) {
    const T = TXT[api.idioma] || TXT.ca;
    if (finestra) {
      finestra.document.open();
      finestra.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(T.preparant)}</title><p style="font:16px sans-serif;padding:2em">${esc(T.preparant)}</p>`);
      finestra.document.close();
    }
    const fons = await mapaFons(api);
    const mapes = [];
    try {
      for (const [i, fx] of api.fitxes.entries()) {
        avanc(i + 1, api.fitxes.length);
        mapes.push(await dibuixaMapa(api, fx, fons));
      }
    } finally {
      if (fons) { try { fons.map.remove(); } catch (e) { /* */ } fons.div.remove(); }
    }
    const html = compon(api, api.fitxes, mapes, T);
    if (!finestra) return html;
    finestra.document.open();
    finestra.document.write(html);
    finestra.document.close();
    // Espera les imatges i la font abans d'obrir el diàleg d'impressió
    const doc = finestra.document;
    await Promise.race([
      Promise.all([...doc.images].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; })))).then(() => doc.fonts?.ready),
      new Promise((r) => setTimeout(r, 6000)),
    ]);
    finestra.focus();
    finestra.print();
    return html;
  }

  window.VisorInforme = { genera };
})();

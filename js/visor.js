/* Visor de la xarxa de transport públic · AVPTP
 *
 * Llig dades/config.json, els GeoJSON que s'hi indiquen i la documentació,
 * i mostra la fitxa de cada element en seleccionar-lo. Tipus d'element:
 *   linia      línia de ferrocarril (servei, codi, color, parades)
 *   concessio  concessió d'autobús interurbà (servei, linies_bus)
 *   node       estació principal d'autobusos o d'Adif (subtipus, estacions)
 * Les estacions (tipus «estacio») no es poden seleccionar: només es mostren com a
 * parades de la línia seleccionada i al seu recorregut.
 */
'use strict';

(() => {
  const TEXTOS = window.VISOR_TEXTOS;
  const E = {
    cfg: null, meta: null, idioma: 'ca', editor: false,
    mapa: null, renderer: null, base: null, etiquetesBase: null, idBase: null,
    objectes: new Map(), alies: new Map(), estacions: new Map(), docs: new Map(), index: [],
    perServei: new Map(), regles: [],
    actius: new Set(), ocults: new Set(), desplegats: new Set(),
    sel: null, halo: null, parades: null, radi: 0,
  };
  const INTERNES = new Set(['id', 'id_avptp', 'tipus', 'servei', 'serveis', 'nom', 'nom_ca', 'nom_es', 'codi', 'color',
    'parades', 'linies', 'sistema', 'sistema_es', 'subtipus', 'estacions', 'nodes', 'productes', 'concessions',
    'linies_bus', 'n_parades', 'web']);

  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const esMobil = () => matchMedia('(max-width: 700px)').matches;
  const ordre = (a, b) => String(a).localeCompare(String(b), 'ca', { numeric: true });

  const SVG_TANCA = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5 5 15" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  const SVG_FLETXA = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const SVG_BUS = '<svg viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" d="M5 2.5h10a2 2 0 0 1 2 2V14a1.5 1.5 0 0 1-1 1.4V17a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1.5H7V17a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-1.6A1.5 1.5 0 0 1 3 14V4.5a2 2 0 0 1 2-2Zm0 3v4.5h10V5.5H5Zm1 6.6a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Zm8 0a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Z"/></svg>';
  const SVG_NODE = {
    ferrocarril: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#fff" stroke="#30364b" stroke-width="4"/><circle cx="12" cy="12" r="3" fill="#5fc1c8"/></svg>',
    bus: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="#30364b" stroke="#fff" stroke-width="1.5"/><g transform="translate(4.4 4.2) scale(.76)" color="#fff">' +
      SVG_BUS.replace(/^<svg[^>]*>|<\/svg>$/g, '') + '</g></svg>',
  };

  /* ---------- Idioma ---------- */

  function t(clau, vars = {}) {
    let s = TEXTOS[E.idioma][clau] ?? TEXTOS.ca[clau] ?? clau;
    if (Array.isArray(s)) s = s[(vars.n ?? 2) === 1 ? 0 : 1];
    return String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  }
  const tx = (obj) => (obj && typeof obj === 'object' ? (obj[E.idioma] ?? obj.ca ?? '') : (obj ?? ''));
  const nomDe = (p) => (E.idioma === 'es' ? (p.nom_es || p.nom) : (p.nom_ca || p.nom)) || p.id;
  const sistemaDe = (p) => (E.idioma === 'es' ? (p.sistema_es || p.sistema) : p.sistema) || '';
  const nomServei = (s) => tx(E.cfg.serveis[s]?.nom) || s;

  function normIdioma(v) {
    if (!v) return null;
    v = String(v).toLowerCase();
    if (/^(ca|va|val)/.test(v)) return 'ca';
    if (/^es/.test(v)) return 'es';
    return null;
  }
  function galeta(nom) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + nom + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function idiomaInicial() {
    const q = new URLSearchParams(location.search).get('hl');
    let desat = null;
    try { desat = localStorage.getItem('visor-idioma'); } catch { /* sense emmagatzematge */ }
    return normIdioma(q) || normIdioma(galeta('language')) || normIdioma(desat) ||
      (normIdioma(navigator.language) === 'es' ? 'es' : 'ca');
  }

  function posaIdioma(idioma, desa = false) {
    E.idioma = idioma;
    document.documentElement.lang = idioma === 'ca' ? 'ca' : 'es';
    if (desa) {
      // Mateixa galeta i paràmetre que la web de l'AVPTP, perquè l'idioma es mantinga
      const segura = location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `language=${idioma}; Path=/; Max-Age=31536000; SameSite=Lax${segura}`;
      try { localStorage.setItem('visor-idioma', idioma); } catch { /* res */ }
      const u = new URL(location.href);
      u.searchParams.set('hl', idioma);
      history.replaceState(null, '', u);
    }
    document.querySelectorAll('.idiomes button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.idioma === idioma)));
    document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
    const titol = tx(E.cfg?.titol) || 'Visor';
    $('#titol').textContent = titol;
    document.title = `${titol} · AVPTP`;
    $('#cerca').placeholder = t('cerca');
    $('#cerca').setAttribute('aria-label', t('cerca'));
    $('#resultats').setAttribute('aria-label', t('cerca_resultats'));
    if (!E.mapa) return;
    for (const o of E.objectes.values()) o.capa.setTooltipContent?.(esc(nomDe(o.f.properties)));
    for (const o of E.objectes.values()) if (o.tipus === 'node') o.capa.getElement()?.setAttribute('aria-label', nomDe(o.f.properties));
    construeixIndex();
    pintaCapes();
    if (E.sel) pintaFitxa(E.sel);
  }

  /* ---------- Utilitats ---------- */

  const colorValid = (c) => typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim());

  function colorText(hex) {
    let h = String(hex).replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) return '#fff';
    const l = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    // Blanc sempre que tinga prou contrast (≥ 3,5:1, text gros i en negreta), com als plànols oficials
    const lum = 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
    return 1.05 / (lum + 0.05) >= 3.5 ? '#fff' : '#000';
  }

  function colorObjecte(o) {
    const p = o.f.properties;
    if (o.tipus === 'node') return '#30364B';
    const forcat = E.cfg.colorsLinies?.[o.id] || (p.id_avptp && E.cfg.colorsLinies?.[p.id_avptp]);
    if (colorValid(forcat)) return forcat.trim();
    if (o.tipus === 'linia' && colorValid(p.color)) return p.color.trim();
    return o.origen?.color || E.cfg.serveis[o.servei]?.color || '#30364B';
  }

  function textTipus(o) {
    if (o.tipus === 'node') return t(o.f.properties.subtipus === 'bus' ? 'tipus_node_bus' : 'tipus_node_ferrocarril');
    return t(`tipus_${o.tipus}`);
  }

  function urlSegura(u) {
    if (!u) return null;
    try {
      const x = new URL(String(u).trim(), location.href);
      return ['http:', 'https:'].includes(x.protocol) ? x.href : null;
    } catch { return null; }
  }

  function avis(text) {
    const d = document.createElement('div');
    d.className = 'avis';
    d.setAttribute('role', 'alert');
    d.innerHTML = `<p>${esc(text)}</p><button type="button" aria-label="${esc(t('tanca_avis'))}">×</button>`;
    d.querySelector('button').addEventListener('click', () => d.remove());
    $('#avisos').append(d);
  }

  function distintiu(o) {
    const c = colorObjecte(o);
    const estil = `style="--c:${esc(c)};--ct:${colorText(c)}"`;
    const p = o.f.properties;
    if (o.tipus === 'linia') return `<span class="bala" ${estil}>${esc(p.codi || '·')}</span>`;
    if (o.tipus === 'concessio') return `<span class="bala" ${estil}>${p.codi ? esc(p.codi) : SVG_BUS}</span>`;
    return `<span class="icona-node">${SVG_NODE[p.subtipus] || SVG_NODE.ferrocarril}</span>`;
  }

  function botoLinia(id) {
    const o = E.objectes.get(id);
    if (!o) return '';
    const p = o.f.properties;
    const c = colorObjecte(o);
    const nom = nomDe(p);
    return `<button type="button" class="bala" data-id="${esc(id)}" style="--c:${esc(c)};--ct:${colorText(c)}"
      title="${esc(nom)}" aria-label="${esc(`${p.codi || ''} ${nom}`)}">${o.tipus === 'concessio' && !p.codi ? SVG_BUS : esc(p.codi || '·')}</button>`;
  }

  function botoElement(o) {
    return `<li>${distintiu(o)}<button type="button" class="boto-text" data-id="${esc(o.id)}">${esc(nomDe(o.f.properties))}</button></li>`;
  }

  /* ---------- CSV / JSON de documentació ---------- */

  function llegeixCSV(text) {
    text = text.replace(/^﻿/, '');
    const primera = text.split(/\r?\n/, 1)[0];
    const sep = (primera.match(/;/g) || []).length >= (primera.match(/,/g) || []).length ? ';' : ',';
    const files = [];
    let fila = [], camp = '', cometes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (cometes) {
        if (ch === '"') { if (text[i + 1] === '"') { camp += '"'; i++; } else cometes = false; } else camp += ch;
      } else if (ch === '"') cometes = true;
      else if (ch === sep) { fila.push(camp); camp = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        fila.push(camp); files.push(fila); fila = []; camp = '';
      } else camp += ch;
    }
    if (camp !== '' || fila.length) { fila.push(camp); files.push(fila); }
    const cap = (files.shift() || []).map((h) => norm(h).trim());
    return files.filter((f) => f.some((v) => v.trim() !== ''))
      .map((f) => Object.fromEntries(cap.map((h, i) => [h, (f[i] || '').trim()])));
  }

  async function carregaDocs(fonts) {
    for (const url of [].concat(fonts || [])) {
      try {
        const r = await fetch(url, { cache: 'no-cache' });
        if (!r.ok) throw new Error(String(r.status));
        const files = /\.json($|\?)/i.test(url) ? await r.json() : llegeixCSV(await r.text());
        for (const fila of files) {
          const ids = String(fila.id || fila.ids || '').split(/[|\s]+/).filter(Boolean);
          for (const id of ids) {
            if (!E.docs.has(id)) E.docs.set(id, []);
            E.docs.get(id).push(fila);
          }
        }
      } catch (e) {
        avis(t('err_docs', { f: url, e: e.message }));
      }
    }
  }

  /* ---------- Mapa ---------- */

  function creaMapa() {
    E.mapa = L.map('mapa', { zoomControl: false, minZoom: 6, maxZoom: 19 });
    // Ordre de dibuix: teselles (200) < etiquetes del mapa base < vel fora de la Comunitat < xarxa (400)
    E.mapa.createPane('etiquetesBase').style.zIndex = 210;
    const pm = E.mapa.createPane('mascara');
    pm.style.zIndex = 250;
    pm.style.pointerEvents = 'none';
    const m = marges();
    E.mapa.fitBounds(E.cfg.limits, { paddingTopLeft: m.tl, paddingBottomRight: m.br });
    L.control.zoom({ position: 'bottomright', zoomInTitle: '+', zoomOutTitle: '−' }).addTo(E.mapa);
    E.mapa.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
    if (E.cfg.atribucioDades) E.mapa.attributionControl.addAttribution(E.cfg.atribucioDades);
    E.renderer = L.canvas({ padding: 0.5, tolerance: 6 });
    let desat = null;
    try { desat = localStorage.getItem('visor-mapa'); } catch { /* res */ }
    posaMapaBase(E.cfg.mapesBase.some((x) => x.id === desat) ? desat : E.cfg.mapesBase[0].id);
    E.mapa.on('zoomend', ajustaRadis);
    E.mapa.on('click', () => { if (E.sel) tancaFitxa(); });
  }

  function posaMapaBase(id) {
    const m = E.cfg.mapesBase.find((x) => x.id === id) || E.cfg.mapesBase[0];
    if (E.base) E.base.remove();
    if (E.etiquetesBase) { E.etiquetesBase.remove(); E.etiquetesBase = null; }
    const opc = {
      maxZoom: 19, attribution: m.atribucio, crossOrigin: true,
      subdomains: m.subdominis || 'abc', detectRetina: false,
      ...(m.maxNativeZoom ? { maxNativeZoom: m.maxNativeZoom } : {}),
    };
    E.base = L.tileLayer(m.url, opc).addTo(E.mapa);
    if (m.etiquetes) E.etiquetesBase = L.tileLayer(m.etiquetes, { ...opc, attribution: '', pane: 'etiquetesBase' }).addTo(E.mapa);
    E.idBase = m.id;
    try { localStorage.setItem('visor-mapa', m.id); } catch { /* res */ }
  }

  // Delimitació de la Comunitat: el que queda fora es cobrix amb un vel semitransparent
  async function carregaLimit() {
    const c = E.cfg.limit;
    if (!c?.fitxer) return;
    try {
      const r = await fetch(c.fitxer, { cache: 'no-cache' });
      if (!r.ok) throw new Error(String(r.status));
      const gj = await r.json();
      const anells = [];
      for (const f of gj.features || []) {
        const g = f.geometry;
        const pols = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
        for (const pol of pols) anells.push(pol[0].map(([x, y]) => [y, x]));
      }
      if (!anells.length) return;
      const mon = [[-89.9, -179.9], [89.9, -179.9], [89.9, 179.9], [-89.9, 179.9]];
      L.polygon([mon, ...anells], {
        pane: 'mascara', interactive: false,
        stroke: false, fillColor: c.colorFora || '#fff', fillOpacity: c.opacitatFora ?? 0.6,
      }).addTo(E.mapa);
      L.polygon(anells, {
        pane: 'mascara', interactive: false, fill: false,
        color: c.vora || '#30364B', weight: c.gruixVora ?? 1.5, opacity: c.opacitatVora ?? 0.7,
      }).addTo(E.mapa);
    } catch (e) {
      avis(t('err_fitxer', { f: c.fitxer, e: e.message }));
    }
  }

  const radiActual = () => { const z = E.mapa.getZoom(); return z <= 10 ? 3 : z <= 13 ? 4.5 : 6; };

  function estilLinia(o, hover = false) {
    const g = Number(E.cfg.serveis[o.servei]?.gruix) || 3;
    return { color: colorObjecte(o), weight: hover ? g + 2.5 : g, opacity: o.tipus === 'concessio' ? 0.85 : 0.95, lineCap: 'round', lineJoin: 'round' };
  }

  function estilParada(color) {
    return { radius: E.radi, color, weight: E.radi < 4 ? 2 : 2.5, fillColor: '#ffffff', fillOpacity: 1, opacity: 1 };
  }

  function ajustaRadis() {
    const r = radiActual();
    if (r === E.radi) return;
    E.radi = r;
    if (E.parades) { const c = colorObjecte(E.sel); E.parades.eachLayer((m) => m.setStyle(estilParada(c))); }
  }

  /* ---------- Càrrega de dades ---------- */

  // Regles «origen» de config.json: un servei del visor pot agafar les línies d'un altre
  // servei de les dades (o només les que comencen per un prefix), com Rodalies o Renfe
  function preparaRegles() {
    E.regles = [];
    for (const [id, s] of Object.entries(E.cfg.serveis)) {
      for (const r of [].concat(s.origen || [])) E.regles.push({ ...r, desti: id });
    }
    // Els prefixos més llargs primer
    E.regles.sort((a, b) => (b.prefix || '').length - (a.prefix || '').length);
  }

  async function carregaGeojson(url) {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(t('err_fitxer', { f: url, e: r.status }));
    let gj;
    try { gj = await r.json(); } catch { throw new Error(t('err_geojson', { f: url })); }
    for (const f of gj.features || []) afegeixObjecte(f);
  }

  function afegeixObjecte(f) {
    const p = f?.properties;
    const g = f?.geometry;
    if (!p || !g || !p.id || !['linia', 'concessio', 'estacio', 'node'].includes(p.tipus)) return;
    const id = String(p.id);

    if (p.tipus === 'estacio') {
      if (g.type !== 'Point' || E.estacions.has(id)) return;
      const [lon, lat] = g.coordinates;
      E.estacions.set(id, { id, f, latlng: L.latLng(lat, lon) });
      return;
    }
    if (E.objectes.has(id)) return;
    const o = { id, f, tipus: p.tipus, capa: null };
    const comu = { renderer: E.renderer, bubblingMouseEvents: false };

    if (o.tipus === 'node') {
      o.servei = p.subtipus === 'bus' ? 'nodes_bus' : 'nodes_adif';
      const [lon, lat] = g.coordinates;
      o.capa = L.marker([lat, lon], {
        icon: L.divIcon({ className: 'node-marca', html: SVG_NODE[p.subtipus] || SVG_NODE.ferrocarril, iconSize: [22, 22], iconAnchor: [11, 11] }),
        keyboard: true, riseOnHover: true, bubblingMouseEvents: false,
      });
      o.capa.on('add', () => {
        const el = o.capa.getElement();
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', nomDe(p));
        if (E.sel === o) el.classList.add('seleccionat');
      });
    } else {
      const regla = E.regles.find((r) => r.servei === p.servei && (!r.prefix || id.startsWith(r.prefix)));
      o.servei = regla ? regla.desti : p.servei;
      o.origen = regla || null;
      const prof = { LineString: 0, MultiLineString: 1 }[g.type];
      if (prof === undefined) return;
      o.capa = L.polyline(L.GeoJSON.coordsToLatLngs(g.coordinates, prof), { ...comu });
      o.capa.on('mouseover', () => { if (E.sel !== o) o.capa.setStyle(estilLinia(o, true)); });
      o.capa.on('mouseout', () => o.capa.setStyle(estilLinia(o, false)));
    }

    o.capa.on('click', (e) => { L.DomEvent.stopPropagation(e); selecciona(id); });
    o.capa.bindTooltip(esc(nomDe(p)), {
      sticky: o.tipus !== 'node', direction: 'top', className: 'etiqueta',
      offset: o.tipus === 'node' ? [0, -12] : [0, -4],
    });

    if (!E.perServei.has(o.servei)) E.perServei.set(o.servei, []);
    E.perServei.get(o.servei).push(o);
    E.objectes.set(id, o);
    if (p.id_avptp) E.alies.set(String(p.id_avptp), id);
  }

  // Ordre de les línies dins de cada servei, per a la llista de capes
  function ordenaServeis() {
    for (const [s, ls] of E.perServei) {
      const origens = [].concat(E.cfg.serveis[s]?.origen || []).map((r) => r.servei);
      ls.sort((a, b) => {
        const oa = origens.indexOf(a.origen?.servei), ob = origens.indexOf(b.origen?.servei);
        if (oa !== ob) return oa - ob;
        if (a.tipus === 'linia') return ordre(a.f.properties.codi || '', b.f.properties.codi || '') || ordre(nomDe(a.f.properties), nomDe(b.f.properties));
        return ordre(nomDe(a.f.properties), nomDe(b.f.properties));
      });
    }
  }

  /* ---------- Visibilitat i ordre ---------- */

  const esVisible = (o) => E.actius.has(o.servei) && !E.ocults.has(o.id);

  function aplicaVisibilitat() {
    let afegit = false;
    for (const o of E.objectes.values()) {
      const vis = esVisible(o);
      const hi = E.mapa.hasLayer(o.capa);
      if (vis && !hi) { o.capa.addTo(E.mapa); afegit = true; } else if (!vis && hi) o.capa.remove();
    }
    if (E.sel && !esVisible(E.sel)) tancaFitxa();
    if (afegit) reordena();
  }

  // Concessions d'autobús al fons, línies de ferrocarril al mig i la selecció a sobre
  function reordena() {
    for (const o of E.objectes.values()) if (o.tipus === 'linia' && E.mapa.hasLayer(o.capa)) o.capa.bringToBack();
    if (E.halo && E.mapa.hasLayer(E.halo)) E.halo.bringToBack();
    for (const o of E.objectes.values()) if (o.tipus === 'concessio' && E.mapa.hasLayer(o.capa)) o.capa.bringToBack();
    if (E.sel) ordenaSeleccio(E.sel);
  }

  function ordenaSeleccio(o) {
    if (o.tipus === 'node') return;
    if (E.halo) E.halo.bringToFront();
    if (E.mapa.hasLayer(o.capa)) o.capa.bringToFront();
    if (E.parades) E.parades.eachLayer((c) => c.bringToFront());
  }

  // Parades de la línia seleccionada: només informatives (nom en passar-hi per damunt)
  function mostraParades(o) {
    if (E.parades) { E.parades.remove(); E.parades = null; }
    if (!o || o.tipus !== 'linia') return;
    const color = colorObjecte(o);
    const marques = [];
    for (const id of o.f.properties.parades || []) {
      const e = E.estacions.get(id);
      if (!e) continue;
      const c = L.circleMarker(e.latlng, { renderer: E.renderer, bubblingMouseEvents: false, ...estilParada(color) });
      c.on('click', (ev) => { L.DomEvent.stopPropagation(ev); c.openTooltip(); });
      c.bindTooltip(esc(nomDe(e.f.properties)), { direction: 'top', className: 'etiqueta', offset: [0, -6] });
      c.estacio = id;
      marques.push(c);
    }
    if (marques.length) E.parades = L.layerGroup(marques).addTo(E.mapa);
  }

  function dibuixaHalo(o) {
    if (E.halo) { E.halo.remove(); E.halo = null; }
    document.querySelectorAll('.node-marca.seleccionat').forEach((el) => el.classList.remove('seleccionat'));
    if (o.tipus === 'node') { o.capa.getElement()?.classList.add('seleccionat'); return; }
    const g = Number(E.cfg.serveis[o.servei]?.gruix) || 3;
    E.halo = L.polyline(o.capa.getLatLngs(), {
      renderer: E.renderer, interactive: false,
      color: '#ffb75e', weight: g + 10, opacity: 0.8, lineCap: 'round', lineJoin: 'round',
    }).addTo(E.mapa);
    ordenaSeleccio(o);
  }

  /* ---------- Selecció ---------- */

  function resol(id) {
    if (E.objectes.has(id)) return E.objectes.get(id);
    return E.objectes.get(E.alies.get(id));
  }

  function selecciona(id, opcions = {}) {
    const o = resol(id);
    if (!o) {
      if (opcions.desDeEnllac) avis(t('err_enllac', { id }));
      return;
    }
    // Si l'element estava ocult a les capes, es torna a mostrar
    if (!esVisible(o)) {
      if (!E.actius.has(o.servei)) {
        E.actius.add(o.servei);
        for (const x of E.perServei.get(o.servei) || []) if (x !== o) E.ocults.add(x.id);
      }
      E.ocults.delete(o.id);
      aplicaVisibilitat();
      actualitzaChecks();
    }

    if (E.sel && E.sel !== o && E.sel.tipus !== 'node') E.sel.capa.setStyle(estilLinia(E.sel, false));
    E.sel = o;
    mostraParades(o);
    dibuixaHalo(o);
    pintaFitxa(o);
    if (opcions.enfoca) enfoca(o);
    const hash = '#' + encodeURIComponent(o.id);
    if (location.hash !== hash) history.replaceState(null, '', location.pathname + location.search + hash);
    if (opcions.focus) $('#fitxa-titol')?.focus({ preventScroll: true });
  }

  function tancaFitxa() {
    const fitxa = $('#fitxa');
    fitxa.classList.remove('obert');
    fitxa.setAttribute('aria-hidden', 'true');
    if (E.halo) { E.halo.remove(); E.halo = null; }
    if (E.parades) { E.parades.remove(); E.parades = null; }
    document.querySelectorAll('.node-marca.seleccionat').forEach((el) => el.classList.remove('seleccionat'));
    E.sel = null;
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }

  function marges() {
    const fitxa = $('#fitxa').getBoundingClientRect();
    const col = $('.columna').getBoundingClientRect();
    const obert = $('#fitxa').classList.contains('obert');
    if (esMobil()) return { tl: [16, col.bottom + 12], br: [16, (obert ? fitxa.height : 0) + 16] };
    return { tl: [col.right + 16, 24], br: [(obert ? fitxa.width + 14 : 0) + 24, 24] };
  }

  function centra(latlng, zMin) {
    const m = marges();
    const z = Math.max(E.mapa.getZoom(), zMin);
    const p = E.mapa.project(latlng, z).add([(m.br[0] - m.tl[0]) / 2, (m.br[1] - m.tl[1]) / 2]);
    E.mapa.setView(E.mapa.unproject(p, z), z);
  }

  function enfoca(o) {
    if (o.tipus === 'node') { centra(o.capa.getLatLng(), 15); return; }
    const m = marges();
    E.mapa.fitBounds(o.capa.getBounds(), { paddingTopLeft: m.tl, paddingBottomRight: m.br, maxZoom: 15 });
  }

  // En triar una parada del recorregut, el mapa s'hi centra i en mostra el nom
  function enfocaParada(id) {
    const e = E.estacions.get(id);
    if (!e) return;
    centra(e.latlng, 14);
    E.parades?.eachLayer((c) => { if (c.estacio === id) c.openTooltip(); });
  }

  /* ---------- Fitxa ---------- */

  function etiquetaLinia(o) {
    const p = o.f.properties;
    return sistemaDe(p) || tx(o.origen?.etiqueta) || nomServei(o.servei);
  }

  function pintaFitxa(o) {
    const p = o.f.properties;
    const color = colorObjecte(o);
    const fitxa = $('#fitxa');
    fitxa.style.setProperty('--c', color);
    fitxa.style.setProperty('--ct', colorText(color));

    let etiqueta = '';
    if (o.tipus === 'linia') etiqueta = etiquetaLinia(o);
    else if (o.tipus === 'concessio') etiqueta = nomServei(o.servei);

    let cos = '';
    if (o.tipus === 'linia') cos += seccioRecorregut(o);
    if (o.tipus === 'concessio') cos += seccioConcessio(o);
    if (o.tipus === 'node') cos += seccioNode(o);
    cos += seccioDocumentacio(o);
    cos += seccioDades(o);

    fitxa.innerHTML = `
      <header class="fitxa-cap">
        <div class="fitxa-cap-fila">
          ${distintiu(o)}
          <div>
            <p class="fitxa-tipus">${esc(textTipus(o))}${etiqueta ? `<span class="fitxa-sistema">${esc(etiqueta)}</span>` : ''}</p>
            <h2 id="fitxa-titol" tabindex="-1">${esc(nomDe(p))}</h2>
          </div>
        </div>
        <button type="button" class="tanca" aria-label="${esc(t('tanca'))}">${SVG_TANCA}</button>
      </header>
      <div class="fitxa-cos">${cos}</div>`;
    fitxa.classList.add('obert');
    fitxa.setAttribute('aria-hidden', 'false');
    $('.fitxa-cos', fitxa).scrollTop = 0;
  }

  // El recorregut es mostra en el sentit del nom de la línia («Luceros – Benidorm» comença a Luceros)
  function orientaParades(o, parades) {
    if (parades.length < 2) return parades;
    const primer = norm(String(nomDe(o.f.properties)).split(/\s+[–-]\s+/)[0]).trim();
    if (!primer) return parades;
    const coincidix = (e) => { const n = norm(nomDe(e.f.properties)); return n.includes(primer) || primer.includes(n); };
    return !coincidix(parades[0]) && coincidix(parades[parades.length - 1]) ? [...parades].reverse() : parades;
  }

  function seccioRecorregut(o) {
    const parades = orientaParades(o, (o.f.properties.parades || []).map((id) => E.estacions.get(id)).filter(Boolean));
    if (!parades.length) return `<section><h3>${esc(t('recorregut'))}</h3><p class="buit">${esc(t('sense_parades'))}</p></section>`;
    const items = parades.map((e) => `<li><button type="button" class="boto-text" data-parada="${esc(e.id)}">${esc(nomDe(e.f.properties))}</button></li>`).join('');
    return `<section><h3>${esc(t('recorregut'))} <span class="n">${esc(t('parades_n', { n: parades.length }))}</span></h3>
      <ol class="recorregut">${items}</ol></section>`;
  }

  function seccioConcessio(o) {
    const p = o.f.properties;
    const c = colorObjecte(o);
    const linies = (p.linies_bus || []).map((l) => {
      const [codi, ...resta] = String(l).split(' ');
      return `<li><span class="bala" style="--c:${esc(c)};--ct:${colorText(c)}">${esc(codi)}</span><span>${esc(resta.join(' '))}</span></li>`;
    }).join('');
    let html = linies ? `<section><h3>${esc(t('linies_concessio'))} <span class="n">${p.linies_bus.length}</span></h3>
      <ul class="llista-simple llista-bus">${linies}</ul></section>` : '';
    const extra = [];
    if (p.n_parades) extra.push(`<p class="buit">${esc(t('parades_n', { n: p.n_parades }))}</p>`);
    const web = urlSegura(p.web);
    if (web) extra.push(`<p><a class="enllac-extern" href="${esc(web)}" target="_blank" rel="noopener">${esc(t('web_operador'))}</a></p>`);
    if (extra.length) html += `<section>${extra.join('')}</section>`;
    return html;
  }

  function liniesAgrupades(ids) {
    const perServei = new Map();
    for (const id of ids) {
      const l = E.objectes.get(id);
      if (!l) continue;
      if (!perServei.has(l.servei)) perServei.set(l.servei, []);
      perServei.get(l.servei).push(l);
    }
    const ordreServeis = E.cfg.grups.flatMap((g) => g.serveis);
    return [...perServei.entries()]
      .sort((a, b) => ordreServeis.indexOf(a[0]) - ordreServeis.indexOf(b[0]))
      .map(([s, ls]) => `<h4>${esc(nomServei(s))}</h4><div class="chips">${ls.sort((a, b) => ordre(a.f.properties.codi, b.f.properties.codi)).map((l) => botoLinia(l.id)).join('')}</div>`)
      .join('');
  }

  function seccioNode(o) {
    const p = o.f.properties;
    let html = '';
    if (p.productes?.length) {
      const noms = E.cfg.productesRenfe || {};
      html += `<section><h3>${esc(t('productes_renfe'))}</h3><div class="chips">${p.productes.map((x) => `<span class="etiqueta-producte">${esc(noms[x] || x)}</span>`).join('')}</div></section>`;
    }
    const ids = new Set();
    for (const e of p.estacions || []) for (const l of E.estacions.get(e)?.f.properties.linies || []) ids.add(l);
    const linies = liniesAgrupades([...ids]);
    if (linies) html += `<section><h3>${esc(t('linies'))}</h3>${linies}</section>`;
    const conc = (p.concessions || []).map((id) => E.objectes.get(id)).filter(Boolean);
    if (conc.length) {
      html += `<section><h3>${esc(t('concessions_node'))} <span class="n">${conc.length}</span></h3>
        <ul class="llista-simple">${conc.sort((a, b) => ordre(nomDe(a.f.properties), nomDe(b.f.properties))).map(botoElement).join('')}</ul></section>`;
    }
    const nodes = (p.nodes || []).map((id) => E.objectes.get(id)).filter(Boolean);
    if (nodes.length) html += `<section><h3>${esc(t('connexions'))}</h3><ul class="llista-simple">${nodes.map(botoElement).join('')}</ul></section>`;
    return html;
  }

  function seccioDocumentacio(o) {
    const p = o.f.properties;
    const docs = [...(E.docs.get(o.id) || []), ...(p.id_avptp ? E.docs.get(String(p.id_avptp)) || [] : [])];
    if (!docs.length) return `<section><h3>${esc(t('documentacio'))}</h3><p class="buit">${esc(t('sense_docs'))}</p></section>`;
    return `<section><h3>${esc(t('documentacio'))}</h3><div class="docs">${docs.map(pintaDoc).join('')}</div></section>`;
  }

  function pintaDoc(d) {
    const tipus = norm(d.tipus);
    const altre = E.idioma === 'es' ? 'ca' : 'es';
    const titol = d[`titol_${E.idioma}`] || d.titol || d[`titol_${altre}`] || '';
    const desc = d[`descripcio_${E.idioma}`] || d.descripcio || d[`descripcio_${altre}`] || '';
    const idiomaDoc = normIdioma(d.idioma);
    const meta = [];
    if (d.data) {
      const m = String(d.data).match(/^(\d{4})-(\d{2})-(\d{2})/);
      meta.push(`<span>${esc(m ? `${m[3]}/${m[2]}/${m[1]}` : d.data)}</span>`);
    }
    if (idiomaDoc && idiomaDoc !== E.idioma) meta.push(`<span class="doc-idioma">${esc(TEXTOS[E.idioma].doc_en[idiomaDoc])}</span>`);
    const metaHtml = meta.length ? `<span class="doc-meta">${meta.join('')}</span>` : '';
    const url = urlSegura(d.url);
    if (tipus === 'text') return `<div class="doc-text">${titol ? `<h4>${esc(titol)}</h4>` : ''}<p>${esc(desc)}</p></div>`;
    if (!url) return '';
    if (['imatge', 'imagen', 'image'].includes(tipus)) {
      return `<figure class="doc-imatge"><a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" alt="${esc(titol || desc)}" loading="lazy"></a>
        ${titol ? `<figcaption>${esc(titol)}</figcaption>` : ''}</figure>`;
    }
    const esPdf = tipus === 'pdf' || /\.pdf($|[?#])/i.test(url);
    const format = esPdf ? 'PDF' : 'Web';
    return `<a class="doc-enllac" href="${esc(url)}" target="_blank" rel="noopener">
      <span class="doc-format ${esPdf ? 'pdf' : ''}" aria-hidden="true">${format}</span>
      <span><strong>${esc(titol || url)}</strong>${metaHtml}${desc ? `<small>${esc(desc)}</small>` : ''}</span></a>`;
  }

  // Dades addicionals de l'element. L'identificador (per a lligar-hi documentació al
  // full documentacio.csv) només es mostra en mode d'edició: index.html?editor
  function seccioDades(o) {
    const p = o.f.properties;
    const etiquetes = tx(E.cfg.etiquetesCamps) || {};
    const files = [];
    for (const [k, v] of Object.entries(p)) {
      if (INTERNES.has(k) || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
      files.push([etiquetes[k] || (k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ')), v]);
    }
    const valor = (v) => {
      if (Array.isArray(v)) return esc(v.join(', '));
      if (typeof v === 'object') return esc(JSON.stringify(v));
      const u = typeof v === 'string' && /^https?:\/\//i.test(v) ? urlSegura(v) : null;
      return u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(v)}</a>` : esc(v);
    };
    let html = files.length ? `<h3>${esc(t('dades'))}</h3><dl class="dades">${files.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${valor(v)}</dd>`).join('')}</dl>` : '';
    if (E.editor) {
      const ids = [o.id, p.id_avptp].filter(Boolean);
      html += `<p class="identificador">${esc(t('identificador'))}:
        ${ids.map((i) => `<code>${esc(i)}</code><button type="button" class="copia" data-copia="${esc(i)}">${esc(t('copia'))}</button>`).join('')}</p>`;
    }
    return html ? `<section>${html}</section>` : '';
  }

  /* ---------- Cerca ---------- */

  const ORDRE_CERCA = { node: 0, linia: 1, concessio: 2 };

  function construeixIndex() {
    E.index = [...E.objectes.values()].map((o) => {
      const p = o.f.properties;
      const extra = [p.codi, sistemaDe(p), tx(o.origen?.etiqueta), nomServei(o.servei), p.nom, p.nom_es, E.editor ? p.id_avptp : ''].filter(Boolean).join(' ');
      return { o, n: norm(nomDe(p)), t: norm(`${nomDe(p)} ${extra}`) };
    });
  }

  function cerca(q) {
    const nq = norm(q).trim();
    const toks = nq.split(/\s+/).filter(Boolean);
    if (!toks.length) return [];
    const res = [];
    for (const it of E.index) {
      if (!toks.every((tk) => it.t.includes(tk))) continue;
      let s = ORDRE_CERCA[it.o.tipus];
      if (it.n.startsWith(toks[0])) s -= 10;
      else if (it.n.split(/[\s\-'’()/–]+/).some((w) => w.startsWith(toks[0]))) s -= 5;
      if (it.n === nq || norm(it.o.f.properties.codi) === nq) s -= 20;
      res.push([s, it]);
    }
    res.sort((a, b) => a[0] - b[0] || a[1].n.localeCompare(b[1].n, 'ca'));
    return res.slice(0, 12).map((r) => r[1].o);
  }

  function detallCerca(o) {
    if (o.tipus === 'linia') return t('detall_linia', { s: etiquetaLinia(o) });
    return textTipus(o);
  }

  function iniciaCerca() {
    const input = $('#cerca');
    const llista = $('#resultats');
    let actius = [], actiu = -1;
    const tanca = () => {
      llista.hidden = true; llista.innerHTML = ''; actius = []; actiu = -1;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    };
    const marca = (i) => {
      actiu = i;
      [...llista.children].forEach((li, k) => li.setAttribute('aria-selected', String(k === i)));
      if (i >= 0 && llista.children[i]) {
        input.setAttribute('aria-activedescendant', llista.children[i].id);
        llista.children[i].scrollIntoView({ block: 'nearest' });
      }
    };
    const tria = (o) => { tanca(); input.value = ''; input.blur(); selecciona(o.id, { enfoca: true, focus: true }); };

    input.addEventListener('input', () => {
      if (!input.value.trim()) { tanca(); return; }
      actius = cerca(input.value);
      llista.innerHTML = actius.length
        ? actius.map((o, i) => `<li id="res-${i}" role="option" aria-selected="false" data-i="${i}">
            <span class="distintiu">${distintiu(o)}</span><span class="res-text"><span class="res-nom">${esc(nomDe(o.f.properties))}</span>
            <span class="res-detall">${esc(detallCerca(o))}</span></span></li>`).join('')
        : `<li class="res-buit" role="option" aria-disabled="true">${esc(t('cap_resultat'))}</li>`;
      llista.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      marca(actius.length ? 0 : -1);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' && actius.length) { e.preventDefault(); marca((actiu + 1) % actius.length); }
      else if (e.key === 'ArrowUp' && actius.length) { e.preventDefault(); marca((actiu - 1 + actius.length) % actius.length); }
      else if (e.key === 'Enter' && actius[actiu]) { e.preventDefault(); tria(actius[actiu]); }
      else if (e.key === 'Escape') { input.value = ''; tanca(); }
    });
    llista.addEventListener('mousedown', (e) => e.preventDefault());
    llista.addEventListener('click', (e) => {
      const li = e.target.closest('li[data-i]');
      if (li) tria(actius[Number(li.dataset.i)]);
    });
    input.addEventListener('blur', () => setTimeout(tanca, 150));
  }

  /* ---------- Capes ---------- */

  function iconaServei(s) {
    const logo = E.cfg.serveis[s]?.logo;   // ruta relativa (img/logos/…) o, al visor autònom, data:
    if (logo) return `<span class="logo-servei"><img src="${esc(logo)}" alt="" loading="lazy"></span>`;
    if (s === 'nodes_bus' || s === 'nodes_adif') return `<span class="logo-servei">${SVG_NODE[s === 'nodes_bus' ? 'bus' : 'ferrocarril']}</span>`;
    return `<span class="logo-servei"><span class="mostra" style="--c:${esc(E.cfg.serveis[s]?.color || '#999')}"></span></span>`;
  }

  function recompte(s) {
    const n = (E.perServei.get(s) || []).length;
    if (!n) return t('pendent');
    if (s.startsWith('nodes_')) return t('nodes_n', { n });
    if (s === 'bus_interurba') return t('concessions_n', { n });
    return t('linies_n', { n });
  }

  function itemLinia(o) {
    const p = o.f.properties;
    const marca = o.tipus === 'node' ? distintiu(o) : o.tipus === 'concessio'
      ? `<span class="punt-linia" style="--c:${esc(colorObjecte(o))}" aria-hidden="true"></span>` : distintiu(o);
    return `<li><label><input type="checkbox" data-linia="${esc(o.id)}">${marca}<span class="nom-linia">${esc(nomDe(p))}</span></label></li>`;
  }

  function llistaLinies(s) {
    const ls = E.perServei.get(s) || [];
    const origens = [].concat(E.cfg.serveis[s]?.origen || []).filter((r) => r.etiqueta);
    if (origens.length < 2) return `<ul>${ls.map(itemLinia).join('')}</ul>`;
    // Servei que n'agrupa diversos (Renfe): un subapartat per a cadascun
    return origens.map((r) => {
      const sub = ls.filter((o) => o.origen?.servei === r.servei);
      return sub.length ? `<p class="subgrup">${esc(tx(r.etiqueta))}</p><ul>${sub.map(itemLinia).join('')}</ul>` : '';
    }).join('');
  }

  function pintaCapes() {
    const grups = E.cfg.grups.map((g) => `<section class="grup"><h3>${esc(tx(g.nom))}</h3><ul class="serveis">${g.serveis.map((s) => {
      const te = (E.perServei.get(s) || []).length > 0;
      const detall = tx(E.cfg.serveis[s]?.detall);
      const obert = E.desplegats.has(s);
      return `<li class="servei ${te ? '' : 'buida'}" data-servei="${esc(s)}">
        <div class="fila-servei">
          <label><input type="checkbox" data-servei="${esc(s)}" ${te ? '' : 'disabled'}>
            ${iconaServei(s)}<span class="nom-servei">${esc(nomServei(s))}${detall ? `<small>${esc(detall)}</small>` : ''}</span></label>
          ${te ? `<button type="button" class="desplega" data-desplega="${esc(s)}" aria-expanded="${obert}" aria-controls="linies-${esc(s)}"
              aria-label="${esc(t('mostra_linies', { s: nomServei(s) }))}"><span class="recompte">${esc(recompte(s))}</span>${SVG_FLETXA}</button>`
            : `<span class="recompte">${esc(recompte(s))}</span>`}
        </div>
        ${te ? `<div class="linies-servei" id="linies-${esc(s)}" ${obert ? '' : 'hidden'}>${llistaLinies(s)}</div>` : ''}
      </li>`;
    }).join('')}</ul></section>`).join('');

    const mapes = E.cfg.mapesBase.map((m) => `<label><input type="radio" name="mapa-base" value="${esc(m.id)}" ${m.id === E.idBase ? 'checked' : ''}>${esc(tx(m.nom))}</label>`).join('');

    let credits = `<p>${esc(t('font_dades'))}</p>`;
    if (E.meta?.generat) {
      const [a, m, d] = E.meta.generat.slice(0, 10).split('-');
      credits = `<p>${esc(t('dades_actualitzades', { data: `${d}/${m}/${a}` }))}</p>` + credits;
    }

    $('#capes-cos').innerHTML = `${grups}
      <div class="bloc"><h3>${esc(t('mapa_fons'))}</h3><div class="mapes-base" role="radiogroup" aria-label="${esc(t('mapa_fons'))}">${mapes}</div></div>
      <div class="credits">${credits}</div>`;
    actualitzaChecks();
  }

  // Estat de les caselles: el servei queda a mitges si només se'n mostren algunes línies
  function actualitzaChecks() {
    const cos = $('#capes-cos');
    for (const [s, ls] of E.perServei) {
      const actiu = E.actius.has(s);
      const visibles = actiu ? ls.filter((o) => !E.ocults.has(o.id)).length : 0;
      const chk = cos.querySelector(`input[data-servei="${CSS.escape(s)}"]`);
      if (chk) {
        chk.checked = visibles > 0;
        chk.indeterminate = visibles > 0 && visibles < ls.length;
      }
      for (const o of ls) {
        const c = cos.querySelector(`input[data-linia="${CSS.escape(o.id)}"]`);
        if (c) c.checked = actiu && !E.ocults.has(o.id);
      }
    }
  }

  function canviaServei(s, mostra) {
    const ls = E.perServei.get(s) || [];
    if (mostra) { E.actius.add(s); ls.forEach((o) => E.ocults.delete(o.id)); }
    else E.actius.delete(s);
  }

  function canviaLinia(id, mostra) {
    const o = E.objectes.get(id);
    if (!o) return;
    const ls = E.perServei.get(o.servei) || [];
    if (mostra) {
      // Si el servei estava desactivat, només es mostra la línia triada
      if (!E.actius.has(o.servei)) { E.actius.add(o.servei); ls.forEach((x) => E.ocults.add(x.id)); }
      E.ocults.delete(id);
    } else {
      E.ocults.add(id);
      if (ls.every((x) => E.ocults.has(x.id))) canviaServei(o.servei, false);
    }
  }

  function iniciaCapes() {
    const cos = $('#capes-cos');
    cos.addEventListener('change', (e) => {
      const el = e.target;
      if (el.dataset.servei) canviaServei(el.dataset.servei, el.checked);
      else if (el.dataset.linia) canviaLinia(el.dataset.linia, el.checked);
      else if (el.name === 'mapa-base') { posaMapaBase(el.value); return; }
      else return;
      aplicaVisibilitat();
      actualitzaChecks();
    });
    cos.addEventListener('click', (e) => {
      const b = e.target.closest('[data-desplega]');
      if (!b) return;
      const s = b.dataset.desplega;
      const obert = b.getAttribute('aria-expanded') !== 'true';
      b.setAttribute('aria-expanded', String(obert));
      $(`#linies-${CSS.escape(s)}`).hidden = !obert;
      if (obert) E.desplegats.add(s); else E.desplegats.delete(s);
    });
  }

  /* ---------- Inici ---------- */

  async function inici() {
    const q = new URLSearchParams(location.search);
    if (q.has('sense-titol')) document.documentElement.classList.add('sense-titol');
    E.editor = q.has('editor');
    E.idioma = idiomaInicial();
    posaIdioma(E.idioma);
    if (location.protocol === 'file:' && !window.VISOR_FITXERS) { $('#carregant').hidden = true; avis(t('err_file')); return; }
    try {
      const r = await fetch('dades/config.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error();
      E.cfg = await r.json();
    } catch {
      $('#carregant').hidden = true;
      avis(t('err_config'));
      return;
    }
    posaIdioma(E.idioma);
    preparaRegles();
    creaMapa();
    E.radi = radiActual();

    const [resultats] = await Promise.all([
      Promise.allSettled((E.cfg.fitxers || []).map(carregaGeojson)),
      carregaDocs(E.cfg.documentacio),
      carregaLimit(),
      E.cfg.metadades ? fetch(E.cfg.metadades, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((m) => { E.meta = m; }).catch(() => {}) : null,
    ]);
    resultats.filter((r) => r.status === 'rejected').forEach((r) => avis(r.reason.message));

    ordenaServeis();
    for (const s of E.perServei.keys()) if (E.cfg.serveis[s]?.actiu !== false) E.actius.add(s);
    for (const o of E.objectes.values()) if (o.tipus !== 'node') o.capa.setStyle(estilLinia(o));
    construeixIndex();
    pintaCapes();
    iniciaCapes();
    iniciaCerca();
    aplicaVisibilitat();
    reordena();
    $('#capes').open = !esMobil();
    $('#carregant').hidden = true;

    document.querySelectorAll('.idiomes button').forEach((b) => b.addEventListener('click', () => posaIdioma(b.dataset.idioma, true)));
    $('#fitxa').addEventListener('click', (e) => {
      if (e.target.closest('.tanca')) { tancaFitxa(); return; }
      const copia = e.target.closest('[data-copia]');
      if (copia) {
        navigator.clipboard?.writeText(copia.dataset.copia).then(() => {
          copia.textContent = t('copiat');
          setTimeout(() => { copia.textContent = t('copia'); }, 1500);
        });
        return;
      }
      const parada = e.target.closest('[data-parada]');
      if (parada) { enfocaParada(parada.dataset.parada); return; }
      const b = e.target.closest('[data-id]');
      if (b) selecciona(b.dataset.id, { enfoca: true });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && E.sel && document.activeElement !== $('#cerca')) tancaFitxa();
    });
    const obreHash = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (id) selecciona(id, { enfoca: true, desDeEnllac: true });
    };
    window.addEventListener('hashchange', obreHash);
    obreHash();
  }

  inici();
})();

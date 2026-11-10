
/* Visor de la xarxa de transport públic · AVPTP
 *
 * Llig dades/config.json, els GeoJSON que s'hi indiquen i la documentació,
 * i mostra la fitxa de cada element en seleccionar-lo. Tipus d'element:
 *   linia      línia de ferrocarril (servei, codi, color, parades)
 *   concessio  concessió d'autobús interurbà (servei, linies_bus)
 *   node       estació principal d'autobusos o d'Adif (subtipus, estacions)
 * Camps opcionals de les línies i concessions:
 *   estat      «servei» (per defecte) o «projecte»: les línies en projecte es dibuixen discontínues
 *   complet    recorregut sencer (MultiLineString) quan la geometria està retallada al límit de la
 *              Comunitat: es mostra difuminat en seleccionar la línia
 *   ramals     [{nom, parades}] per a les línies amb ramals (es mostren davall del recorregut)
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
    sel: null, halo: null, parades: null, complet: null, radi: 0,
    estatsOcults: new Set(),
  };
  const INTERNES = new Set(['id', 'id_avptp', 'tipus', 'servei', 'serveis', 'nom', 'nom_ca', 'nom_es', 'codi', 'color',
    'parades', 'linies', 'sistema', 'sistema_es', 'subtipus', 'estacions', 'nodes', 'productes', 'concessions',
    'linies_bus', 'linies_bus_es', 'n_parades', 'web', 'estat', 'complet', 'ramals', 'corredor', 'fora_cv']);
  const ESTATS = ['servei', 'projecte'];
  const estatDe = (o) => (o.f.properties.estat === 'projecte' ? 'projecte' : 'servei');

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
    document.querySelectorAll('[data-t-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.tAria)); el.title = t(el.dataset.tAria); });
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
    const propi = tx(E.cfg.serveis[o.servei]?.textTipus);
    return propi || t(`tipus_${o.tipus}`);
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

  /* ---------- Comentaris sobre el visor (correu a l'associació) ---------- */

  function controlComentaris(correu) {
    const TIPUS = ['millora', 'error', 'altres'];
    const C = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd() {
        const div = L.DomUtil.create('div', 'comentaris');
        div.innerHTML = `
          <button type="button" class="comentaris-boto" aria-expanded="false" aria-controls="comentaris-panell" data-t-aria="comentaris_obri">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 8h8M8 11.5h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            <span data-t="comentaris"></span>
          </button>
          <div class="comentaris-panell" id="comentaris-panell" role="dialog" aria-labelledby="comentaris-titol" hidden>
            <p class="comentaris-titol" id="comentaris-titol" data-t="comentaris_titol"></p>
            <p class="comentaris-avis" data-t="comentaris_avis"></p>
            <div class="comentaris-opcions">
              ${TIPUS.map((k) => `<a class="comentaris-opcio" data-tipus="${k}" href="#"><strong data-t="comentaris_${k}"></strong><span data-t="comentaris_${k}_detall"></span></a>`).join('')}
            </div>
            <p class="comentaris-peu"><span data-t="comentaris_peu"></span> <a href="mailto:${esc(correu)}">${esc(correu)}</a></p>
          </div>`;
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);
        const boto = div.querySelector('.comentaris-boto');
        const panell = div.querySelector('.comentaris-panell');
        const obri = (v) => {
          panell.hidden = !v;
          boto.setAttribute('aria-expanded', String(v));
          if (v) panell.querySelector('.comentaris-opcio')?.focus();
        };
        boto.addEventListener('click', () => obri(panell.hidden));
        div.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && !panell.hidden) { e.stopPropagation(); obri(false); boto.focus(); }
        });
        document.addEventListener('click', (e) => { if (!panell.hidden && !div.contains(e.target)) obri(false); });
        // L'enllaç es genera en el moment del clic: inclou l'idioma i l'adreça actual del visor
        div.querySelectorAll('.comentaris-opcio').forEach((a) => {
          a.addEventListener('click', () => {
            const k = a.dataset.tipus;
            const assumpte = `[${t('comentaris_assumpte')}] ${t('comentaris_' + k)}`;
            const cos = t('comentaris_cos', { url: location.href, nav: navigator.userAgent });
            a.href = `mailto:${correu}?subject=${encodeURIComponent(assumpte)}&body=${encodeURIComponent(cos)}`;
            setTimeout(() => obri(false), 0);
          });
        });
        div.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
        boto.setAttribute('aria-label', t('comentaris_obri'));
        boto.title = t('comentaris_obri');
        return div;
      },
    });
    return new C();
  }

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
    if (E.cfg.comentaris?.correu) controlComentaris(E.cfg.comentaris.correu).addTo(E.mapa);
    E.mapa.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
    if (E.cfg.atribucioDades) E.mapa.attributionControl.addAttribution(E.cfg.atribucioDades);
    E.renderer = L.canvas({ padding: 0.5, tolerance: 6 });
    let desat = null;
    try { desat = localStorage.getItem('visor-mapa'); } catch { /* res */ }
    posaMapaBase(E.cfg.mapesBase.some((x) => x.id === desat) ? desat : E.cfg.mapesBase[0].id);
    E.mapa.on('zoomend', ajustaRadis);
    // Etiquetes amb el codi de cada línia o concessió sobre el traçat, a partir d'un cert zoom
    const pe = E.mapa.createPane('etiquetesCodi');
    pe.style.zIndex = 450;
    E.etiquetes = L.layerGroup().addTo(E.mapa);
    E.mapa.on('moveend', programaEtiquetes);
    E.mapa.on('click', () => { if (E.sel) tancaFitxa(); });
  }

  // Carrega MapLibre i el connector per a Leaflet només la primera vegada que cal un mapa vectorial
  let promesaMaplibre = null;
  function carregaMaplibre() {
    if (window.L?.maplibreGL) return Promise.resolve();
    if (promesaMaplibre) return promesaMaplibre;
    const c = E.cfg.maplibre || {};
    const script = (src) => new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = () => ko(new Error(src));
      document.head.append(s);
    });
    if (c.css) {
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = c.css;
      document.head.append(l);
    }
    promesaMaplibre = script(c.js).then(() => script(c.leaflet)).catch((e) => { promesaMaplibre = null; throw e; });
    return promesaMaplibre;
  }

  // Noms del mapa vectorial en l'idioma configurat (name:ca), amb el nom oficial si no n'hi ha
  function idiomaEtiquetes(gl) {
    const cfg = E.cfg.etiquetesMapa || {};
    const nom = ['coalesce', ['get', `name:${cfg.idioma || 'ca'}`], ['get', 'name']];
    const subs = Object.entries(cfg.substitucions || {}).filter(([k]) => !k.startsWith('_'));
    const text = subs.length ? ['match', nom, ...subs.flat(), nom] : nom;
    for (const capa of gl.getStyle().layers || []) {
      if (capa.type !== 'symbol') continue;
      const actual = gl.getLayoutProperty(capa.id, 'text-field');
      // Només les etiquetes amb nom (no els números de carretera)
      if (actual && /name/.test(JSON.stringify(actual))) gl.setLayoutProperty(capa.id, 'text-field', text);
    }
  }

  function capaRaster(m) {
    const opc = {
      maxZoom: 19, attribution: m.atribucio, crossOrigin: true,
      subdomains: m.subdominis || 'abc', detectRetina: false,
      ...(m.maxNativeZoom ? { maxNativeZoom: m.maxNativeZoom } : {}),
    };
    if (m.etiquetes) E.etiquetesBase = L.tileLayer(m.etiquetes, { ...opc, attribution: '', pane: 'etiquetesBase' }).addTo(E.mapa);
    return L.tileLayer(m.url, opc);
  }

  let tornBase = 0;
  async function posaMapaBase(id, desa = true) {
    const m = E.cfg.mapesBase.find((x) => x.id === id) || E.cfg.mapesBase[0];
    const torn = ++tornBase;   // si es canvia de mapa mentre se'n carrega un, només val l'últim
    if (E.base) { E.base.remove(); E.base = null; }
    if (E.etiquetesBase) { E.etiquetesBase.remove(); E.etiquetesBase = null; }
    E.idBase = m.id;
    if (desa) try { localStorage.setItem('visor-mapa', m.id); } catch { /* res */ }

    let capa;
    if (m.tipus === 'vectorial') {
      try {
        await carregaMaplibre();
        if (torn !== tornBase) return;
        capa = L.maplibreGL({ style: m.estil, interactive: false, attribution: m.atribucio });
        capa.addTo(E.mapa);
        const gl = capa.getMaplibreMap();
        const aplica = () => { try { idiomaEtiquetes(gl); } catch { /* estil encara no llest */ } };
        gl.on('style.load', aplica);
        if (gl.isStyleLoaded()) aplica();
      } catch {
        if (torn !== tornBase) return;
        capa?.remove();
        // Sense WebGL o sense accés a les llibreries: es passa al primer mapa raster
        const alternatiu = E.cfg.mapesBase.find((x) => x.tipus !== 'vectorial');
        avis(t('err_mapa_vectorial'));
        if (alternatiu) { posaMapaBase(alternatiu.id, false); pintaCapesSiCal(); }
        return;
      }
    } else {
      capa = capaRaster(m).addTo(E.mapa);
    }
    E.base = capa;
  }

  // Actualitza el selector de mapa de fons si ja està dibuixat
  function pintaCapesSiCal() {
    const r = document.querySelector(`input[name="mapa-base"][value="${CSS.escape(E.idBase)}"]`);
    if (r) r.checked = true;
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
    const projecte = estatDe(o) === 'projecte';
    return {
      color: colorObjecte(o), weight: hover ? g + 2.5 : g, opacity: o.tipus === 'concessio' ? 0.85 : 0.95,
      lineCap: projecte ? 'butt' : 'round', lineJoin: 'round', dashArray: projecte ? `${g * 2.6} ${g * 1.6}` : null,
    };
  }

  // Les parades de fora de la Comunitat es mostren més suaus, com el tros de recorregut que hi va
  function estilParada(color, fora = false) {
    return { radius: E.radi, color, weight: E.radi < 4 ? 2 : 2.5, fillColor: '#ffffff', fillOpacity: fora ? 0.8 : 1, opacity: fora ? 0.5 : 1 };
  }

  function ajustaRadis() {
    const r = radiActual();
    if (r === E.radi) return;
    E.radi = r;
    if (E.parades) { const c = colorObjecte(E.sel); E.parades.eachLayer((m) => m.setStyle(estilParada(c, m.fora))); }
  }

  /* ---------- Etiquetes de codi sobre els traçats ---------- */

  let tempsEtiquetes = null;
  function programaEtiquetes() {
    clearTimeout(tempsEtiquetes);
    tempsEtiquetes = setTimeout(actualitzaEtiquetes, 60);
  }

  // A partir de «zoomEtiquetes» (config.json), cada línia o concessió visible porta, cada cert tros,
  // un requadre del seu color amb el codi. Es reparteixen per la pantalla sense trepitjar-se.
  function actualitzaEtiquetes() {
    if (!E.etiquetes) return;
    E.etiquetes.clearLayers();
    const zMin = Number(E.cfg.zoomEtiquetes) || 13;
    if (E.mapa.getZoom() < zMin) return;
    const vista = E.mapa.getBounds().pad(0.05);
    const mida = E.mapa.getSize();
    const PAS = 300; // píxels entre etiquetes d'un mateix traçat
    const MAX = 4; // etiquetes per element i pantalla
    const ocupat = new Set();
    // Ni davall del panell de capes ni de la fitxa
    const tapats = [$('.columna'), $('#fitxa.obert')].filter(Boolean).map((el) => el.getBoundingClientRect());
    const mapaR = E.mapa.getContainer().getBoundingClientRect();
    const tapat = (q) => tapats.some((r) => q.x + mapaR.left > r.left - 30 && q.x + mapaR.left < r.right + 30 && q.y + mapaR.top > r.top - 14 && q.y + mapaR.top < r.bottom + 14);
    const lliure = (pt) => {
      if (tapat(pt)) return false;
      const cx = Math.floor(pt.x / 56), cy = Math.floor(pt.y / 26);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (ocupat.has(`${cx + dx},${cy + dy}`)) return false;
      ocupat.add(`${cx},${cy}`);
      return true;
    };
    const objs = [...E.objectes.values()].filter((o) => o.tipus !== 'node' && o.f.properties.codi && esVisible(o) && o.capa.getBounds().intersects(vista));
    // Primer la selecció, després el ferrocarril i al final les concessions d'autobús
    objs.sort((a, b) => (b === E.sel) - (a === E.sel) || (a.tipus === 'linia' ? 0 : 1) - (b.tipus === 'linia' ? 0 : 1));
    for (const o of objs) {
      const c = colorObjecte(o);
      const html = `<span style="background:${c};color:${colorText(c)}">${esc(o.f.properties.codi)}</span>`;
      let n = 0;
      const parts = o.capa.getLatLngs();
      for (const part of (Array.isArray(parts[0]) ? parts : [parts])) {
        let acc = PAS / 2, prev = null;
        for (const ll of part) {
          const pt = E.mapa.latLngToContainerPoint(ll);
          if (prev) {
            const d = prev.distanceTo(pt);
            let r = acc;
            while (r <= d && n < MAX) {
              const t = r / d;
              const q = L.point(prev.x + (pt.x - prev.x) * t, prev.y + (pt.y - prev.y) * t);
              if (q.x > 20 && q.y > 12 && q.x < mida.x - 20 && q.y < mida.y - 12 && lliure(q)) {
                const m = L.marker(E.mapa.containerPointToLatLng(q), {
                  icon: L.divIcon({ className: 'etiqueta-codi', html, iconSize: null }),
                  pane: 'etiquetesCodi', keyboard: false, bubblingMouseEvents: false,
                });
                m.on('click', (e) => { L.DomEvent.stopPropagation(e); selecciona(o.id); });
                m.bindTooltip(esc(nomDe(o.f.properties)), { direction: 'top', className: 'etiqueta', offset: [0, -10] });
                E.etiquetes.addLayer(m);
                n++;
              }
              r += PAS;
            }
            acc = r - d;
          }
          prev = pt;
          if (n >= MAX) break;
        }
        if (n >= MAX) break;
      }
    }
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
        // Línies i concessions per codi (les que encara no en tenen, al principi) i després pel nom
        return ordre(a.f.properties.codi || '', b.f.properties.codi || '') || ordre(nomDe(a.f.properties), nomDe(b.f.properties));
      });
    }
  }

  /* ---------- Visibilitat i ordre ---------- */

  const esVisible = (o) => E.actius.has(o.servei) && !E.ocults.has(o.id) && (o.tipus === 'node' || !E.estatsOcults.has(estatDe(o)));

  function aplicaVisibilitat() {
    let afegit = false;
    for (const o of E.objectes.values()) {
      const vis = esVisible(o);
      const hi = E.mapa.hasLayer(o.capa);
      if (vis && !hi) { o.capa.addTo(E.mapa); afegit = true; } else if (!vis && hi) o.capa.remove();
    }
    if (E.sel && !esVisible(E.sel)) tancaFitxa();
    if (afegit) reordena();
    programaEtiquetes();
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
      const fora = !!e.f.properties.fora_cv;
      const c = L.circleMarker(e.latlng, { renderer: E.renderer, bubblingMouseEvents: false, ...estilParada(color, fora) });
      c.fora = fora;
      c.on('click', (ev) => { L.DomEvent.stopPropagation(ev); c.openTooltip(); });
      c.bindTooltip(esc(nomDe(e.f.properties)), { direction: 'top', className: 'etiqueta', offset: [0, -6] });
      c.estacio = id;
      marques.push(c);
    }
    if (marques.length) E.parades = L.layerGroup(marques).addTo(E.mapa);
  }

  // Recorregut sencer d'una línia retallada al límit de la Comunitat (p. ex. les línies estatals)
  function mostraComplet(o) {
    if (E.complet) { E.complet.remove(); E.complet = null; }
    const g = o?.f.properties.complet;
    if (!g || !['LineString', 'MultiLineString'].includes(g.type)) return;
    const gr = Number(E.cfg.serveis[o.servei]?.gruix) || 3;
    E.complet = L.polyline(L.GeoJSON.coordsToLatLngs(g.coordinates, g.type === 'LineString' ? 0 : 1), {
      renderer: E.renderer, interactive: false, color: colorObjecte(o), weight: gr, opacity: 0.35,
      lineCap: 'butt', lineJoin: 'round', dashArray: estatDe(o) === 'projecte' ? `${gr * 2.6} ${gr * 1.6}` : null,
    }).addTo(E.mapa);
    E.complet.bringToBack();
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
      if (o.tipus !== 'node') E.estatsOcults.delete(estatDe(o));
      aplicaVisibilitat();
      actualitzaChecks();
      const ce = $(`#capes-cos input[data-estat="${estatDe(o)}"]`);
      if (ce) ce.checked = true;
    }

    if (E.sel && E.sel !== o && E.sel.tipus !== 'node') E.sel.capa.setStyle(estilLinia(E.sel, false));
    E.sel = o;
    mostraComplet(o);
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
    if (E.complet) { E.complet.remove(); E.complet = null; }
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

  function etiquetaEstat(o) {
    if (o.tipus === 'node') return '';
    const e = estatDe(o);
    return `<span class="estat estat-${e}">${esc(t(`estat_${e}`))}</span>`;
  }

  function codiLlegenda(o) {
    const p = o.f.properties;
    if (E.cfg.serveis[o.servei]?.codiLlegenda === false) return '';
    return o.tipus === 'concessio' && p.codi ? `[${p.codi}] ` : '';
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
    const sc = E.cfg.serveis[o.servei] || {};
    if (sc.logoFitxa) {
      cos += `<section class="marca-servei"><img src="${esc(sc.logoFitxa)}" alt="${esc(tx(sc.textLogoFitxa) || nomServei(o.servei))}">${sc.textFitxa ? `<p>${esc(tx(sc.textFitxa))}</p>` : ''}</section>`;
    }
    if (o.tipus === 'linia') cos += seccioRecorregut(o);
    if (o.tipus === 'concessio') cos += seccioConcessio(o);
    if (o.tipus === 'node') cos += seccioNode(o);
    cos += seccioDocumentacio(o);
    if (!E.cfg.serveis[o.servei]?.senseDades) cos += seccioDades(o);

    fitxa.innerHTML = `
      <header class="fitxa-cap">
        <div class="fitxa-cap-fila">
          ${distintiu(o)}
          <div>
            <p class="fitxa-tipus">${esc(textTipus(o))}${etiqueta ? `<span class="fitxa-sistema">${esc(etiqueta)}</span>` : ''}${etiquetaEstat(o)}</p>
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
    const item = (e) => `<li class="${e.f.properties.fora_cv ? 'fora-cv' : ''}"><button type="button" class="boto-text" data-parada="${esc(e.id)}">${esc(nomDe(e.f.properties))}</button></li>`;
    let ramals = '';
    for (const r of o.f.properties.ramals || []) {
      const ps = (r.parades || []).map((id) => E.estacions.get(id)).filter(Boolean);
      if (ps.length) ramals += `<h4>${esc(t('ramal', { s: r.nom_es && E.idioma === 'es' ? r.nom_es : r.nom }))}</h4><ol class="recorregut">${ps.map(item).join('')}</ol>`;
    }
    const nota = parades.some((e) => e.f.properties.fora_cv) ? `<p class="nota-fora">${esc(t('parades_fora'))}</p>` : '';
    return `<section><h3>${esc(t('recorregut'))} <span class="n">${esc(t('parades_n', { n: parades.length }))}</span></h3>
      <ol class="recorregut">${parades.map(item).join('')}</ol>${ramals}${nota}</section>`;
  }

  function seccioConcessio(o) {
    const p = o.f.properties;
    const c = colorObjecte(o);
    const llista = (E.idioma === 'es' && p.linies_bus_es) || p.linies_bus || [];
    const linies = llista.map((l) => {
      const [codi, ...resta] = String(l).split(' ');
      return `<li><span class="bala" style="--c:${esc(c)};--ct:${colorText(c)}">${esc(codi)}</span><span>${esc(resta.join(' '))}</span></li>`;
    }).join('');
    let html = linies ? `<section><h3>${esc(tx(E.cfg.serveis[o.servei]?.textLinies) || t('linies_concessio'))} <span class="n">${llista.length}</span></h3>
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

  // Tipus de fila de documentacio.csv que són aparicions als mitjans de comunicació
  const TIPUS_PREMSA = new Set(['premsa', 'prensa', 'mitjans', 'medios', 'noticia', 'notícia', 'entrevista', 'radio', 'ràdio', 'televisio', 'televisió', 'television', 'televisión']);
  const esPremsa = (d) => TIPUS_PREMSA.has(norm(d.tipus));

  function seccioDocumentacio(o) {
    const p = o.f.properties;
    const tots = [...(E.docs.get(o.id) || []), ...(p.id_avptp ? E.docs.get(String(p.id_avptp)) || [] : [])];
    const docs = tots.filter((d) => !esPremsa(d));
    // Als mitjans: de la més recent a la més antiga
    const premsa = tots.filter(esPremsa).sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
    let html = docs.length
      ? `<section><h3>${esc(t('documentacio'))}</h3><div class="docs">${docs.map(pintaDoc).join('')}</div></section>`
      : `<section><h3>${esc(t('documentacio'))}</h3><p class="buit">${esc(t('sense_docs'))}</p></section>`;
    if (premsa.length) html += `<section><h3>${esc(t('premsa'))} <span class="n">${premsa.length}</span></h3><div class="docs">${premsa.map(pintaDoc).join('')}</div></section>`;
    return html;
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
    if (d.mitja) meta.unshift(`<span class="doc-mitja">${esc(d.mitja)}</span>`);
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
    const premsa = esPremsa(d);
    const format = premsa ? t('format_premsa') : esPdf ? 'PDF' : 'Web';
    return `<a class="doc-enllac" href="${esc(url)}" target="_blank" rel="noopener">
      <span class="doc-format ${premsa ? 'premsa' : esPdf ? 'pdf' : ''}" aria-hidden="true">${esc(format)}</span>
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
      // (el codi de la concessió ja forma part del text de cerca)
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
    if (E.cfg.serveis[s]?.recompte) return t(E.cfg.serveis[s].recompte, { n });
    if ((E.perServei.get(s) || [])[0]?.tipus === 'concessio') return t('concessions_n', { n });
    return t('linies_n', { n });
  }

  function itemLinia(o) {
    const p = o.f.properties;
    const marca = o.tipus === 'node' ? distintiu(o) : o.tipus === 'concessio'
      ? `<span class="punt-linia" style="--c:${esc(colorObjecte(o))}" aria-hidden="true"></span>` : distintiu(o);
    const proj = '';
    return `<li><label><input type="checkbox" data-linia="${esc(o.id)}">${marca}<span class="nom-linia">${esc(codiLlegenda(o) + nomDe(p))}${proj}</span></label></li>`;
  }

  // Un servei amb totes les línies en projecte porta l'etiqueta al nom, no a cada línia
  function serveiEnProjecte(s) {
    const ls = (E.perServei.get(s) || []).filter((o) => o.tipus !== 'node');
    return ls.length > 0 && ls.every((o) => estatDe(o) === 'projecte');
  }

  function llistaLinies(s) {
    const ls = E.perServei.get(s) || [];
    const origens = [].concat(E.cfg.serveis[s]?.origen || []).filter((r) => r.etiqueta);
    if (origens.length < 2) return `<ul>${ls.map(itemLinia).join('')}</ul>`;
    // Servei que n'agrupa diversos (Renfe): un subapartat per a cadascun
    return origens.map((r) => {
      const sub = ls.filter((o) => o.origen?.servei === r.servei && (o.origen?.prefix || '') === (r.prefix || ''));
      return sub.length ? `<p class="subgrup">${esc(tx(r.etiqueta))}</p><ul>${sub.map(itemLinia).join('')}</ul>` : '';
    }).join('');
  }

  function pintaCapes() {
    const grups = E.cfg.grups.map((g, gi) => `<section class="grup"><h3><label class="casella-grup"><input type="checkbox" data-grup="${gi}"
      aria-label="${esc(t('mostra_grup', { g: tx(g.nom) }))}">${esc(tx(g.nom))}</label></h3><ul class="serveis">${g.serveis.map((s) => {
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

    const fonts = (E.cfg.fonts || []).map((f) => (f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(tx(f.nom))}</a>` : esc(tx(f.nom)))).join(' · ');
    let credits = fonts ? `<p>${esc(t('fonts'))}: ${fonts}</p>` : '';
    if (E.meta?.generat) {
      const [a, m, d] = E.meta.generat.slice(0, 10).split('-');
      credits = `<p>${esc(t('dades_actualitzades', { data: `${d}/${m}/${a}` }))}</p>` + credits;
    }
    const estats = ESTATS.map((e) => `<label><input type="checkbox" data-estat="${e}" ${E.estatsOcults.has(e) ? '' : 'checked'}>
      <span class="mostra-estat mostra-${e}" aria-hidden="true"></span>${esc(t(`estat_${e}`))}</label>`).join('');

    $('#capes-cos').innerHTML = `${grups}
      <div class="bloc"><h3>${esc(t('estat'))}</h3><div class="estats">${estats}</div></div>
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
    // Casella del grup: marcada si se'n mostra alguna cosa, a mitges si no es mostra tot
    E.cfg.grups.forEach((g, gi) => {
      const chk = cos.querySelector(`input[data-grup="${gi}"]`);
      if (!chk) return;
      let total = 0, vis = 0;
      for (const s of g.serveis) {
        const ls = E.perServei.get(s) || [];
        total += ls.length;
        if (E.actius.has(s)) vis += ls.filter((o) => !E.ocults.has(o.id)).length;
      }
      chk.disabled = total === 0;
      chk.checked = vis > 0;
      chk.indeterminate = vis > 0 && vis < total;
    });
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
      if (el.dataset.estat) { if (el.checked) E.estatsOcults.delete(el.dataset.estat); else E.estatsOcults.add(el.dataset.estat); }
      else if (el.dataset.grup) E.cfg.grups[+el.dataset.grup].serveis.forEach((s) => { if ((E.perServei.get(s) || []).length) canviaServei(s, el.checked); });
      else if (el.dataset.servei) canviaServei(el.dataset.servei, el.checked);
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


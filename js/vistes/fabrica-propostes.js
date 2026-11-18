/* Vista «Fàbrica de propostes» (en proves)
 *
 * S'obri amb ?vista=fabrica-propostes. Permet dibuixar sobre el mapa una proposta
 * (línies, parades i zones), associar-la a un element del visor o presentar-la com a
 * proposta nova, i enviar-la per correu a l'associació amb una imatge del dibuix.
 * La configuració de l'enviament és a dades/fabrica_propostes.json.
 */
'use strict';

(() => {
  const TXT = {
    ca: {
      titol: 'Fàbrica de propostes',
      proves: 'En proves',
      sub: 'Dibuixa sobre el mapa la teua proposta per a la xarxa de transport públic i envia-la a l’AVPTP.',
      pas1: 'Què proposes?',
      tipus_mod: 'Un canvi en un element del visor',
      tipus_mod_det: 'Per exemple, allargar una línia, afegir una parada o una línia nova dins d’una concessió que ja existix.',
      tipus_nova: 'Una proposta nova',
      tipus_nova_det: 'Un servici, una infraestructura o una connexió que encara no existix al visor.',
      element: 'Element afectat',
      element_busca: 'Busca una línia, concessió o estació',
      element_cap: 'No s’ha trobat cap element.',
      element_canvia: 'Canvia',
      pas2: 'Dibuixa-la al mapa',
      eina_linia: 'Línia', eina_parada: 'Parades', eina_zona: 'Zona',
      ajuda_linia: 'Toca el mapa per a afegir els punts del recorregut. Acaba amb «Fet» o fent doble clic.',
      ajuda_parada: 'Toca el mapa allà on vols cada parada. Acaba amb «Fet».',
      ajuda_zona: 'Toca el mapa per a marcar els vèrtexs de la zona. Acaba amb «Fet» o fent doble clic.',
      fet: 'Fet', desfes: 'Desfés', esborra: 'Esborra-ho tot',
      resum_buit: 'Encara no has dibuixat res.',
      resum: '{l} línies · {p} parades · {z} zones',
      punts: 'Dibuixant: {n} punts',
      pas3: 'Explica-la',
      f_titol: 'Títol', f_titol_ph: 'Per exemple: Línia de bus entre Alzira i Xàtiva per Carcaixent',
      f_desc: 'Descripció', f_desc_ph: 'Què proposes, per què i a qui beneficiaria. Pots indicar horaris, freqüències o parades.',
      pas4: 'Les teues dades',
      f_nom: 'Nom i cognoms', f_correu: 'Correu electrònic', f_correu_det: 'Rebràs una còpia de la proposta en este correu.',
      f_accepta: 'Accepte que l’AVPTP reba estes dades per a estudiar la proposta i contactar amb mi. L’enviament es fa a través del servici FormSubmit.',
      envia: 'Envia la proposta',
      enviant: 'Preparant la imatge i enviant…',
      err_element: 'Tria l’element que vols canviar.',
      err_dibuix: 'Dibuixa almenys una línia, una parada o una zona.',
      err_camps: 'Revisa els camps marcats.',
      err_accepta: 'Cal acceptar l’enviament de les dades.',
      err_envia: 'No s’ha pogut enviar. Descarrega la imatge i envia-la a {c}.',
      ok_titol: 'Proposta enviada!',
      ok_text: 'Gràcies. Hem enviat la proposta a l’AVPTP i en rebràs una còpia a {c}.',
      ok_avis: 'Si no t’arriba la còpia en uns minuts, mira la carpeta de correu brossa.',
      nova: 'Fes una altra proposta',
      descarrega: 'Descarrega la imatge',
      tipus_mail_mod: 'Canvi en un element del visor',
      tipus_mail_nova: 'Proposta nova',
      assumpte: 'Fàbrica de propostes',
      obligatori: 'obligatori',
    },
    es: {
      titol: 'Fábrica de propuestas',
      proves: 'En pruebas',
      sub: 'Dibuja sobre el mapa tu propuesta para la red de transporte público y envíala a la AVPTP.',
      pas1: '¿Qué propones?',
      tipus_mod: 'Un cambio en un elemento del visor',
      tipus_mod_det: 'Por ejemplo, alargar una línea, añadir una parada o una línea nueva dentro de una concesión que ya existe.',
      tipus_nova: 'Una propuesta nueva',
      tipus_nova_det: 'Un servicio, una infraestructura o una conexión que todavía no existe en el visor.',
      element: 'Elemento afectado',
      element_busca: 'Busca una línea, concesión o estación',
      element_cap: 'No se ha encontrado ningún elemento.',
      element_canvia: 'Cambiar',
      pas2: 'Dibújala en el mapa',
      eina_linia: 'Línea', eina_parada: 'Paradas', eina_zona: 'Zona',
      ajuda_linia: 'Toca el mapa para añadir los puntos del recorrido. Termina con «Hecho» o con doble clic.',
      ajuda_parada: 'Toca el mapa donde quieras cada parada. Termina con «Hecho».',
      ajuda_zona: 'Toca el mapa para marcar los vértices de la zona. Termina con «Hecho» o con doble clic.',
      fet: 'Hecho', desfes: 'Deshacer', esborra: 'Borrarlo todo',
      resum_buit: 'Todavía no has dibujado nada.',
      resum: '{l} líneas · {p} paradas · {z} zonas',
      punts: 'Dibujando: {n} puntos',
      pas3: 'Explícala',
      f_titol: 'Título', f_titol_ph: 'Por ejemplo: Línea de bus entre Alzira y Xàtiva por Carcaixent',
      f_desc: 'Descripción', f_desc_ph: 'Qué propones, por qué y a quién beneficiaría. Puedes indicar horarios, frecuencias o paradas.',
      pas4: 'Tus datos',
      f_nom: 'Nombre y apellidos', f_correu: 'Correo electrónico', f_correu_det: 'Recibirás una copia de la propuesta en este correo.',
      f_accepta: 'Acepto que la AVPTP reciba estos datos para estudiar la propuesta y contactar conmigo. El envío se hace a través del servicio FormSubmit.',
      envia: 'Enviar la propuesta',
      enviant: 'Preparando la imagen y enviando…',
      err_element: 'Elige el elemento que quieres cambiar.',
      err_dibuix: 'Dibuja al menos una línea, una parada o una zona.',
      err_camps: 'Revisa los campos marcados.',
      err_accepta: 'Hay que aceptar el envío de los datos.',
      err_envia: 'No se ha podido enviar. Descarga la imagen y envíala a {c}.',
      ok_titol: '¡Propuesta enviada!',
      ok_text: 'Gracias. Hemos enviado la propuesta a la AVPTP y recibirás una copia en {c}.',
      ok_avis: 'Si no te llega la copia en unos minutos, mira la carpeta de correo no deseado.',
      nova: 'Hacer otra propuesta',
      descarrega: 'Descargar la imagen',
      tipus_mail_mod: 'Cambio en un elemento del visor',
      tipus_mail_nova: 'Propuesta nueva',
      assumpte: 'Fábrica de propuestas',
      obligatori: 'obligatorio',
    },
  };

  const COLOR = '#D6336C';
  const EINES = ['linia', 'parada', 'zona'];
  const ICONES = {
    linia: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 15 8 7l4 6 5-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    parada: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="5" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>',
    zona: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6l7-3 6 6-3 8-9-2z" fill="currentColor" fill-opacity=".25" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  };

  function crea(api, dades) {
    const { esc } = api;
    const tt = (k, v = {}) => String(TXT[api.idioma()]?.[k] ?? TXT.ca[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => v[n] ?? '');
    const correu = dades.correu || api.correu;
    const st = {
      tipus: 'mod', element: null, eina: null, actual: null, dibuix: [], estat: '', enviant: false, enviada: null,
      form: { titol: '', descripcio: '', nom: '', correu: '', accepta: false },
    };
    let el = null;
    const mapa = api.mapa;
    const capa = L.layerGroup().addTo(mapa);

    /* ---------- Dibuix sobre el mapa ---------- */

    const ll = (p) => [p[1], p[0]];
    function repintaDibuix() {
      capa.clearLayers();
      const opc = { color: COLOR, weight: 5, opacity: 0.95, interactive: false, lineCap: 'round', lineJoin: 'round' };
      const items = [...st.dibuix];
      if (st.actual && st.actual.coords.length) items.push({ ...st.actual, enCurs: true });
      for (const it of items) {
        if (it.tipus === 'parada') {
          L.circleMarker(ll(it.coords), { radius: 7, color: COLOR, weight: 3, fillColor: '#fff', fillOpacity: 1, interactive: false }).addTo(capa);
        } else if (it.tipus === 'linia') {
          L.polyline(it.coords.map(ll), { ...opc, dashArray: it.enCurs ? '8 8' : null }).addTo(capa);
        } else if (it.tipus === 'zona') {
          if (it.coords.length >= 3) L.polygon(it.coords.map(ll), { ...opc, weight: 3, fillColor: COLOR, fillOpacity: 0.15, dashArray: it.enCurs ? '8 8' : null }).addTo(capa);
          else L.polyline(it.coords.map(ll), { ...opc, weight: 3, dashArray: '8 8' }).addTo(capa);
        }
        if (it.enCurs && it.tipus !== 'parada') {
          for (const c of it.coords) L.circleMarker(ll(c), { radius: 4, color: COLOR, weight: 2, fillColor: '#fff', fillOpacity: 1, interactive: false }).addTo(capa);
        }
      }
    }

    function triaEina(e) {
      if (st.eina) acaba();
      if (!e) return;
      st.eina = e;
      st.actual = e === 'parada' ? null : { tipus: e, coords: [] };
      api.bloquejaSeleccio(true);
      mapa.doubleClickZoom.disable();
      // En mòbil es plega el panell perquè es veja el mapa mentre es dibuixa
      if (window.matchMedia('(max-width: 700px)').matches) {
        const capes = document.querySelector('#capes');
        if (capes) capes.open = false;
      }
      actualitza();
    }

    function acaba() {
      if (st.actual) {
        const n = st.actual.coords.length;
        if ((st.actual.tipus === 'linia' && n >= 2) || (st.actual.tipus === 'zona' && n >= 3)) st.dibuix.push(st.actual);
      }
      st.actual = null;
      st.eina = null;
      api.bloquejaSeleccio(false);
      mapa.doubleClickZoom.enable();
      actualitza();
    }

    function desfes() {
      if (st.actual && st.actual.coords.length) st.actual.coords.pop();
      else st.dibuix.pop();
      actualitza();
    }

    function esborra() {
      st.dibuix = [];
      if (st.actual) st.actual.coords = [];
      actualitza();
    }

    mapa.on('click', (e) => {
      if (!st.eina) return;
      const c = [+e.latlng.lng.toFixed(6), +e.latlng.lat.toFixed(6)];
      if (st.eina === 'parada') st.dibuix.push({ tipus: 'parada', coords: c });
      else st.actual.coords.push(c);
      actualitza();
    });
    mapa.on('dblclick', () => { if (st.eina && st.eina !== 'parada') acaba(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && st.eina) acaba(); });

    // Barra flotant sobre el mapa mentre hi ha una eina activa
    const barra = document.createElement('div');
    barra.className = 'fp-barra';
    barra.hidden = true;
    mapa.getContainer().appendChild(barra);
    L.DomEvent.disableClickPropagation(barra);
    barra.addEventListener('click', (e) => {
      const b = e.target.closest('[data-fp]');
      if (!b) return;
      if (b.dataset.fp === 'fet') acaba();
      if (b.dataset.fp === 'desfes') desfes();
    });
    function pintaBarra() {
      barra.hidden = !st.eina;
      if (!st.eina) return;
      barra.innerHTML = `<p>${esc(tt(`ajuda_${st.eina}`))}</p>
        <div><button type="button" data-fp="desfes">${esc(tt('desfes'))}</button>
        <button type="button" data-fp="fet" class="principal">${esc(tt('fet'))}</button></div>`;
    }

    /* ---------- Panell ---------- */

    const compte = (t) => st.dibuix.filter((d) => d.tipus === t).length;

    function htmlElement() {
      if (st.tipus !== 'mod') return '';
      const o = st.element && api.objecte(st.element);
      if (o) {
        return `<div class="fp-element-triat"><span class="fp-color" style="--c:${esc(api.color(o))}"></span>
          <span class="fp-element-nom">${api.codi(o) ? `<strong>${esc(api.codi(o))}</strong> ` : ''}${esc(api.nom(o))}<small>${esc(api.tipusText(o))}</small></span>
          <button type="button" class="fp-link" data-fp="element-canvia">${esc(tt('element_canvia'))}</button></div>`;
      }
      return `<label class="fp-camp"><span>${esc(tt('element'))}</span>
        <input type="search" class="fp-cerca" data-fp-camp="cerca" autocomplete="off" placeholder="${esc(tt('element_busca'))}"></label>
        <ul class="fp-resultats" role="listbox"></ul>`;
    }

    function htmlEines() {
      const botons = EINES.map((e) => `<button type="button" class="fp-eina" data-fp-eina="${e}" aria-pressed="${st.eina === e}">${ICONES[e]}<span>${esc(tt(`eina_${e}`))}</span></button>`).join('');
      const n = st.dibuix.length;
      return `<div class="fp-eines">${botons}</div>
        ${st.eina ? `<p class="fp-ajuda">${esc(tt(`ajuda_${st.eina}`))}</p>` : ''}
        <p class="fp-resum">${n ? esc(tt('resum', { l: compte('linia'), p: compte('parada'), z: compte('zona') })) : st.actual?.coords.length ? '' : esc(tt('resum_buit'))}${st.actual?.coords.length ? `${n ? ' · ' : ''}${esc(tt('punts', { n: st.actual.coords.length }))}` : ''}</p>
        <div class="fp-accions">
          ${st.eina ? `<button type="button" class="fp-boto principal" data-fp="fet">${esc(tt('fet'))}</button>` : ''}
          <button type="button" class="fp-boto" data-fp="desfes" ${n || st.actual?.coords.length ? '' : 'disabled'}>${esc(tt('desfes'))}</button>
          <button type="button" class="fp-boto" data-fp="esborra" ${n || st.actual?.coords.length ? '' : 'disabled'}>${esc(tt('esborra'))}</button>
        </div>`;
    }

    function pinta(cont) {
      if (cont) el = cont;
      if (!el) return;
      if (!el.dataset.fpEscolta) {
        el.dataset.fpEscolta = '1';
        el.addEventListener('input', entrada);
        el.addEventListener('change', entrada);
      }
      if (st.enviada) {
        el.innerHTML = `<div class="fp"><div class="fp-ok" role="status">
          <h3>${esc(tt('ok_titol'))}</h3><p>${esc(tt('ok_text', { c: st.enviada.correu }))}</p>
          <img src="${st.enviada.img}" alt="">
          <p class="fp-nota">${esc(tt('ok_avis'))}</p>
          <div class="fp-accions"><button type="button" class="fp-boto principal" data-fp="nova">${esc(tt('nova'))}</button>
          <a class="fp-boto" href="${st.enviada.img}" download="proposta-avptp.jpg">${esc(tt('descarrega'))}</a></div></div></div>`;
        return;
      }
      const f = st.form;
      const req = `<span class="fp-req" aria-hidden="true">*</span>`;
      el.innerHTML = `<div class="fp">
        <p class="vc-proves">${esc(tt('proves'))}</p>
        <p class="fp-sub">${esc(tt('sub'))}</p>
        <section><h3><span class="fp-n">1</span>${esc(tt('pas1'))}</h3>
          <div class="fp-tipus" role="radiogroup">
            ${['mod', 'nova'].map((k) => `<label class="fp-opcio"><input type="radio" name="fp-tipus" value="${k}" ${st.tipus === k ? 'checked' : ''}>
              <span><strong>${esc(tt(`tipus_${k}`))}</strong><small>${esc(tt(`tipus_${k}_det`))}</small></span></label>`).join('')}
          </div>
          <div class="fp-element">${htmlElement()}</div></section>
        <section><h3><span class="fp-n">2</span>${esc(tt('pas2'))}</h3><div class="fp-dibuix">${htmlEines()}</div></section>
        <section><h3><span class="fp-n">3</span>${esc(tt('pas3'))}</h3>
          <label class="fp-camp"><span>${esc(tt('f_titol'))}${req}</span>
            <input type="text" data-fp-camp="titol" maxlength="140" required value="${esc(f.titol)}" placeholder="${esc(tt('f_titol_ph'))}"></label>
          <label class="fp-camp"><span>${esc(tt('f_desc'))}${req}</span>
            <textarea data-fp-camp="descripcio" rows="5" maxlength="5000" required placeholder="${esc(tt('f_desc_ph'))}">${esc(f.descripcio)}</textarea></label></section>
        <section><h3><span class="fp-n">4</span>${esc(tt('pas4'))}</h3>
          <label class="fp-camp"><span>${esc(tt('f_nom'))}${req}</span>
            <input type="text" data-fp-camp="nom" maxlength="120" required autocomplete="name" value="${esc(f.nom)}"></label>
          <label class="fp-camp"><span>${esc(tt('f_correu'))}${req}</span>
            <input type="email" data-fp-camp="correu" maxlength="160" required autocomplete="email" value="${esc(f.correu)}">
            <small>${esc(tt('f_correu_det'))}</small></label>
          <label class="fp-accepta"><input type="checkbox" data-fp-camp="accepta" ${f.accepta ? 'checked' : ''}>
            <span>${esc(tt('f_accepta'))}</span></label></section>
        <button type="button" class="fp-envia" data-fp="envia" ${st.enviant ? 'disabled aria-busy="true"' : ''}>${esc(st.enviant ? tt('enviant') : tt('envia'))}</button>
        <p class="fp-estat" aria-live="polite">${esc(st.estat)}</p>
      </div>`;
    }

    // Actualitza només les parts que canvien, per a no perdre el que s'està escrivint
    function actualitza() {
      repintaDibuix();
      pintaBarra();
      if (!el) return;
      const d = el.querySelector('.fp-dibuix');
      if (d) d.innerHTML = htmlEines();
      const est = el.querySelector('.fp-estat');
      if (est) est.textContent = st.estat;
    }

    function pintaElement() {
      const c = el?.querySelector('.fp-element');
      if (c) c.innerHTML = htmlElement();
    }

    function entrada(e) {
      const t = e.target;
      if (t.name === 'fp-tipus') {
        st.tipus = t.value;
        pintaElement();
        return;
      }
      const camp = t.dataset.fpCamp;
      if (!camp) return;
      if (camp === 'cerca') {
        // (només amb «input»: en perdre el focus, «change» refaria la llista i es perdria el clic)
        if (e.type !== 'input') return;
        const ul = el.querySelector('.fp-resultats');
        const q = t.value.trim();
        const res = q.length >= 2 ? api.cerca(q).slice(0, 8) : [];
        ul.innerHTML = q.length < 2 ? '' : res.length ? res.map((o) => `<li><button type="button" data-fp-tria="${esc(o.id)}">
          <span class="fp-color" style="--c:${esc(api.color(o))}"></span>
          <span>${api.codi(o) ? `<strong>${esc(api.codi(o))}</strong> ` : ''}${esc(api.nom(o))}<small>${esc(api.tipusText(o))}</small></span></button></li>`).join('')
          : `<li class="fp-cap">${esc(tt('element_cap'))}</li>`;
        return;
      }
      if (camp === 'accepta') st.form.accepta = t.checked;
      else st.form[camp] = t.value;
      t.classList.remove('fp-error');
    }

    /* ---------- Enviament ---------- */

    function geojson() {
      return {
        type: 'FeatureCollection',
        features: st.dibuix.map((d) => ({
          type: 'Feature', properties: { tipus: d.tipus },
          geometry: d.tipus === 'parada' ? { type: 'Point', coordinates: d.coords }
            : d.tipus === 'linia' ? { type: 'LineString', coordinates: d.coords }
              : { type: 'Polygon', coordinates: [[...d.coords, d.coords[0]]] },
        })),
      };
    }

    async function imatge() {
      const capes = [];
      const o = st.tipus === 'mod' && st.element ? api.objecte(st.element) : null;
      const punts = st.dibuix.filter((d) => d.tipus === 'parada').map((d) => d.coords);
      if (o) {
        const ls = api.linies(o);
        if (ls.length) capes.push({ linies: ls, color: api.color(o), gruix: 2, alpha: 0.8 });
        const p = api.punt(o);
        if (p && !st.dibuix.length) punts.push(p);
      }
      const zones = st.dibuix.filter((d) => d.tipus === 'zona').map((d) => [...d.coords, d.coords[0]]);
      if (zones.length) capes.push({ linies: zones, color: COLOR, gruix: 2, guions: [10, 7] });
      const linies = st.dibuix.filter((d) => d.tipus === 'linia').map((d) => d.coords);
      if (linies.length) capes.push({ linies, color: COLOR, gruix: 3 });
      return api.imatge({ capes, punts, color: COLOR });
    }

    function valida() {
      let ok = true;
      const marca = (camp) => { el.querySelector(`[data-fp-camp="${camp}"]`)?.classList.add('fp-error'); ok = false; };
      if (st.tipus === 'mod' && !st.element) return tt('err_element');
      if (!st.dibuix.length) return tt('err_dibuix');
      if (!st.form.titol.trim()) marca('titol');
      if (!st.form.descripcio.trim()) marca('descripcio');
      if (!st.form.nom.trim()) marca('nom');
      const c = el.querySelector('[data-fp-camp="correu"]');
      if (!st.form.correu.trim() || (c && !c.checkValidity())) marca('correu');
      if (!ok) return tt('err_camps');
      if (!st.form.accepta) return tt('err_accepta');
      return '';
    }

    async function envia() {
      if (st.eina) acaba();
      const err = valida();
      if (err) { st.estat = err; actualitza(); return; }
      st.enviant = true; st.estat = '';
      pinta();
      let img = '';
      try {
        img = await imatge();
        const o = st.tipus === 'mod' && st.element ? api.objecte(st.element) : null;
        const f = st.form;
        const camps = {
          _subject: `[${tt('assumpte')}] ${f.titol.trim()}`,
          _cc: f.correu.trim(),
          _replyto: f.correu.trim(),
          _template: 'table',
          _captcha: 'false',
          _honey: '',
          [tt('pas1')]: tt(st.tipus === 'mod' ? 'tipus_mail_mod' : 'tipus_mail_nova'),
          [tt('element')]: o ? `${api.codi(o) ? api.codi(o) + ' ' : ''}${api.nom(o)} (${api.tipusText(o)}) · ${o.id}` : '—',
          [tt('f_titol')]: f.titol.trim(),
          [tt('f_desc')]: f.descripcio.trim(),
          [tt('f_nom')]: f.nom.trim(),
          [tt('f_correu')]: f.correu.trim(),
          Visor: api.url(),
          GeoJSON: JSON.stringify(geojson()),
        };
        await enviaFormulari(camps, img);
        st.enviada = { correu: f.correu.trim(), img };
        st.dibuix = []; st.actual = null; st.element = null;
        st.form = { titol: '', descripcio: '', nom: f.nom, correu: f.correu, accepta: f.accepta };
        repintaDibuix();
      } catch (e) {
        st.estat = tt('err_envia', { c: correu });
        if (img) st.enviada = null;
      } finally {
        st.enviant = false;
        pinta();
        if (st.estat && img) {
          const est = el.querySelector('.fp-estat');
          if (est) est.insertAdjacentHTML('beforeend', ` <a href="${img}" download="proposta-avptp.jpg">${esc(tt('descarrega'))}</a>`);
        }
      }
    }

    // Enviament amb un formulari normal (multipart) dins d'un iframe ocult, perquè el servici
    // d'enviament (FormSubmit) accepta així els adjunts. La imatge va com a fitxer adjunt.
    function enviaFormulari(camps, img) {
      return new Promise((ok, ko) => {
        const nom = `fp-${Date.now()}`;
        const ifr = document.createElement('iframe');
        ifr.name = nom; ifr.hidden = true; ifr.title = 'enviament';
        const form = document.createElement('form');
        form.method = 'POST'; form.enctype = 'multipart/form-data'; form.target = nom; form.acceptCharset = 'UTF-8'; form.hidden = true;
        form.action = (dades.enviament || 'https://formsubmit.co/{correu}').replace('{correu}', correu);
        for (const [k, v] of Object.entries(camps)) {
          const i = document.createElement(k === 'GeoJSON' ? 'textarea' : 'input');
          i.name = k; i.value = v;
          form.appendChild(i);
        }
        if (img) {
          try {
            const [cap, b64] = img.split(',');
            const bin = atob(b64);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            const fitxer = new File([arr], 'proposta-avptp.jpg', { type: (cap.match(/data:([^;]+)/) || [])[1] || 'image/jpeg' });
            const dt = new DataTransfer();
            dt.items.add(fitxer);
            const inp = document.createElement('input');
            inp.type = 'file'; inp.name = 'attachment';
            inp.files = dt.files;
            form.appendChild(inp);
          } catch (e) { /* sense adjunt: el GeoJSON permet refer el dibuix */ }
        }
        let fet = false;
        const temps = setTimeout(() => { if (!fet) { fet = true; neteja(); ko(new Error('temps')); } }, 30000);
        const neteja = () => setTimeout(() => { ifr.remove(); form.remove(); }, 1000);
        ifr.addEventListener('load', () => { if (fet) return; fet = true; clearTimeout(temps); neteja(); ok(); });
        document.body.append(ifr, form);
        form.submit();
      });
    }

    function clic(e) {
      const b = e.target.closest('[data-fp], [data-fp-eina], [data-fp-tria]');
      if (!b || !el?.contains(b)) return false;
      if (b.dataset.fpEina) { if (st.eina === b.dataset.fpEina) acaba(); else triaEina(b.dataset.fpEina); return true; }
      if (b.dataset.fpTria) { st.element = b.dataset.fpTria; pintaElement(); api.selecciona(st.element); return true; }
      switch (b.dataset.fp) {
        case 'fet': acaba(); break;
        case 'desfes': desfes(); break;
        case 'esborra': esborra(); break;
        case 'element-canvia': st.element = null; pintaElement(); el.querySelector('.fp-cerca')?.focus(); break;
        case 'envia': envia(); break;
        case 'nova': st.enviada = null; st.estat = ''; pinta(); break;
        default: return false;
      }
      return true;
    }

    return {
      titol: () => tt('titol'),
      pinta, clic,
      enfoca: () => {},
    };
  }

  (window.VISOR_VISTES = window.VISOR_VISTES || {})['fabrica-propostes'] = { crea };
})();

/* Vista «Nou mapa concessional GVA» (en proves)
 *
 * S'obri amb ?vista=mapa-concessional. Mostra només les concessions interurbanes del
 * nou mapa de la Generalitat, pintades segons l'estat (en servici, en projecte), i un
 * panell amb el grau d'implantació i la llista de concessions.
 * Les dades són a dades/mapa_concessional.json.
 */
'use strict';

(() => {
  const TXT = {
    ca: {
      titol: 'Nou mapa concessional GVA',
      proves: 'En proves',
      sub: 'Implantació de les concessions interurbanes d’autobús de la Generalitat',
      kpi: 'de les concessions ja funcionen amb el nou mapa',
      kpi_detall: '{n} de {total} concessions',
      servei: 'En servici', aprovada: 'Aprovació definitiva', projecte: 'Aprovació inicial', pendent: 'Sense informació',
      aprovada_llarg: 'Aprovada definitivament, sense licitar', projecte_llarg: 'Aprovada inicialment',
      amaga: 'Amaga «{e}» al mapa', mostra: 'Mostra «{e}» al mapa',
      arees: 'Per àrees', concessions: 'Concessions',
      data_inici: 'Entrada en servici: {d}',
      data_aprovacio: 'Aprovació definitiva: {d}',
      sense_tracat: 'Encara sense traçat al visor',
      font: 'font',
      nota: 'Vista en proves. L’estat de cada concessió és el de les dades que té el visor; les que hi apareixen «sense informació» encara no s’han revisat.',
      actualitzat: 'Dades revisades el {d}',
      enfoca: 'Mostra-les totes al mapa',
    },
    es: {
      titol: 'Nuevo mapa concesional GVA',
      proves: 'En pruebas',
      sub: 'Implantación de las concesiones interurbanas de autobús de la Generalitat',
      kpi: 'de las concesiones ya funcionan con el nuevo mapa',
      kpi_detall: '{n} de {total} concesiones',
      servei: 'En servicio', aprovada: 'Aprobación definitiva', projecte: 'Aprobación inicial', pendent: 'Sin información',
      aprovada_llarg: 'Aprobada definitivamente, sin licitar', projecte_llarg: 'Aprobada inicialmente',
      amaga: 'Ocultar «{e}» en el mapa', mostra: 'Mostrar «{e}» en el mapa',
      arees: 'Por áreas', concessions: 'Concesiones',
      data_inici: 'Entrada en servicio: {d}',
      data_aprovacio: 'Aprobación definitiva: {d}',
      sense_tracat: 'Aún sin trazado en el visor',
      font: 'fuente',
      nota: 'Vista en pruebas. El estado de cada concesión es el de los datos que tiene el visor; las que aparecen «sin información» aún no se han revisado.',
      actualitzat: 'Datos revisados el {d}',
      enfoca: 'Mostrarlas todas en el mapa',
    },
  };
  const ESTATS = ['servei', 'aprovada', 'projecte', 'pendent'];
  const COLORS = { servei: '#2E7D32', aprovada: '#C62828', projecte: '#D97706', pendent: '#A3ABB1' };

  function crea(api, dades) {
    const { esc } = api;
    const tt = (k, v = {}) => String(TXT[api.idioma()]?.[k] ?? TXT.ca[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => v[n] ?? '');
    const tx = (o) => (o && typeof o === 'object' ? (o[api.idioma()] ?? o.ca ?? '') : (o ?? ''));
    const data = (s) => {
      const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `${+m[3]}/${+m[2]}/${m[1]}` : String(s || '');
    };

    const concs = (dades.concessions || []).map((c) => {
      const obj = c.element ? api.objecte(c.element) : null;
      // L'estat indicat a les dades mana; si no n'hi ha, es pren de l'element del visor
      const estat = ESTATS.includes(c.estat) ? c.estat : (obj ? api.estat(obj) : 'pendent');
      return { ...c, obj, estat };
    });
    const perObj = new Map(concs.filter((c) => c.obj).map((c) => [c.obj, c]));
    const ocults = new Set();
    let el = null;

    const nom = (c) => (api.idioma() === 'es' ? c.nom_es || c.nom : c.nom);
    const compte = (llista, e) => llista.filter((c) => c.estat === e).length;

    function barra(llista, gran = false) {
      return `<div class="vc-barra${gran ? ' gran' : ''}" aria-hidden="true">${ESTATS.map((e) => {
        const n = compte(llista, e);
        return n ? `<span style="--c:${COLORS[e]};flex:${n}"></span>` : '';
      }).join('')}</div>`;
    }

    // Data que acompanya el nom: l'entrada en servici o, si encara no hi està, l'aprovació definitiva
    const dataConc = (c) => (c.dates?.inici ? ['inici', c.dates.inici] : c.dates?.aprovacio ? ['aprovacio', c.dates.aprovacio] : null);

    function pinta(cont) {
      if (cont) el = cont;
      if (!el) return;
      const total = concs.length;
      const enServei = compte(concs, 'servei');
      const pct = total ? Math.round((enServei / total) * 100) : 0;
      const estats = ESTATS.map((e) => {
        const n = compte(concs, e);
        const pot = e !== 'pendent' && n > 0;
        const amagat = ocults.has(e);
        return `<li><button type="button" class="vc-estat" ${pot ? `data-vc-estat="${e}" aria-pressed="${!amagat}"
          aria-label="${esc(tt(amagat ? 'mostra' : 'amaga', { e: tt(e) }))}"` : 'disabled'}>
          <span class="vc-mostra vc-${e}" style="--c:${COLORS[e]}"></span><span>${esc(tt(e))}</span><strong>${n}</strong></button></li>`;
      }).join('');
      const arees = (dades.arees || []).map((a) => {
        const ll = concs.filter((c) => c.codi.startsWith(a.prefix));
        if (!ll.length) return '';
        return `<li><span class="vc-area">${esc(tx(a))}</span>${barra(ll)}<span class="vc-n">${compte(ll, 'servei')}/${ll.length}</span></li>`;
      }).join('');
      const llista = (dades.arees || []).map((a) => {
        const ll = concs.filter((c) => c.codi.startsWith(a.prefix));
        if (!ll.length) return '';
        return `<li class="vc-subgrup">${esc(tx(a))}</li>${ll.map((c) => {
          const dc = dataConc(c);
          const d = dc && dc[1];
          const llarg = TXT.ca[`${c.estat}_llarg`] ? tt(`${c.estat}_llarg`) : tt(c.estat);
          const detall = [llarg, !c.obj && c.estat !== 'pendent' ? tt('sense_tracat') : ''].filter(Boolean).join(' · ');
          const cos = `<span class="vc-codi" style="--c:${COLORS[c.estat]}">${esc(c.codi)}</span>
            <span class="vc-nom">${esc(nom(c))}<small>${esc(detall)}</small></span>
            ${d ? `<time class="vc-data" datetime="${esc(d)}" title="${esc(tt(`data_${dc[0]}`, { d: data(d) }))}">${esc(data(d))}</time>` : ''}`;
          return `<li>${c.obj ? `<button type="button" class="vc-conc" data-vc-id="${esc(c.obj.id)}">${cos}</button>`
            : `<div class="vc-conc sense">${cos}</div>`}</li>`;
        }).join('')}`;
      }).join('');

      el.innerHTML = `<div class="vc">
        <p class="vc-proves">${esc(tt('proves'))}</p>
        <p class="vc-sub">${esc(tt('sub'))}</p>
        <div class="vc-kpi"><strong>${pct}<small>%</small></strong>
          <span>${esc(tt('kpi'))}<small>${esc(tt('kpi_detall', { n: enServei, total }))}</small></span></div>
        ${barra(concs, true)}
        <ul class="vc-estats">${estats}</ul>
        <button type="button" class="vc-enfoca" data-vc-enfoca>${esc(tt('enfoca'))}</button>
        <h3>${esc(tt('arees'))}</h3><ul class="vc-arees">${arees}</ul>
        <h3>${esc(tt('concessions'))}</h3><ul class="vc-llista">${llista}</ul>
        <p class="vc-nota">${esc(tt('nota'))}${dades.actualitzat ? ` ${esc(tt('actualitzat', { d: data(dades.actualitzat) }))}.` : ''}</p>
      </div>`;
    }

    function enfoca() {
      const capes = concs.filter((c) => c.obj && !ocults.has(c.estat)).map((c) => c.obj.capa);
      if (capes.length) api.enfocaCapes(capes);
    }

    function clic(e) {
      const b = e.target.closest('[data-vc-estat]');
      if (b) {
        const s = b.dataset.vcEstat;
        if (ocults.has(s)) ocults.delete(s); else ocults.add(s);
        api.actualitza();
        pinta();
        return true;
      }
      const c = e.target.closest('[data-vc-id]');
      if (c) { api.selecciona(c.dataset.vcId); return true; }
      if (e.target.closest('[data-vc-enfoca]')) { enfoca(); return true; }
      return false;
    }

    return {
      titol: () => tt('titol'),
      visible: (o) => { const c = perObj.get(o); return !!c && !ocults.has(c.estat); },
      color: (o) => { const c = perObj.get(o); return c ? COLORS[c.estat] : null; },
      pinta, clic, enfoca,
    };
  }

  (window.VISOR_VISTES = window.VISOR_VISTES || {})['mapa-concessional'] = { crea };
})();

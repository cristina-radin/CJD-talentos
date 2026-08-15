import { supabase } from './supabaseClient.js';
import { ESTILOS, ASOCIACIONES, COCHE_OPCIONES, AREAS_TITULACION } from './config.js';
import { estiloLabel, formatIdiomaEntry, toSentenceCase, asociacionLabel } from './format.js';
import { openLightbox } from './lightbox.js';

let allMembers = [];
const activeEstilos = new Set();

function distinctValues(rows, field) {
  return [...new Set(rows.map((r) => r[field]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'es')
  );
}

function buildSelect(id, labelText, values, labelFn = (v) => v) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const label = document.createElement('label');
  label.textContent = labelText;
  label.setAttribute('for', id);
  const select = document.createElement('select');
  select.id = id;
  select.innerHTML =
    `<option value="">Todas</option>` +
    values.map((v) => `<option value="${v}">${labelFn(v)}</option>`).join('');
  wrap.appendChild(label);
  wrap.appendChild(select);
  return { wrap, select };
}

function renderFilters() {
  const filtersEl = document.getElementById('search-filters');
  filtersEl.innerHTML = '';

  const nombreWrap = document.createElement('div');
  nombreWrap.className = 'field';
  nombreWrap.innerHTML = `
    <label for="f-nombre">Nombre</label>
    <input type="text" id="f-nombre" placeholder="Buscar por nombre…" />
  `;

  const { wrap: ciudadWrap, select: ciudadSelect } = buildSelect(
    'f-ciudad',
    'Ciudad',
    distinctValues(allMembers, 'ciudad')
  );
  const { wrap: areaWrap, select: areaSelect } = buildSelect(
    'f-area',
    'Área de titulación',
    AREAS_TITULACION
  );
  const { wrap: cocheWrap, select: cocheSelect } = buildSelect(
    'f-coche',
    'Coche',
    COCHE_OPCIONES,
    toSentenceCase
  );
  const { wrap: asociacionWrap, select: asociacionSelect } = buildSelect(
    'f-asociacion',
    'Asociación',
    ASOCIACIONES,
    asociacionLabel
  );

  const idiomaWrap = document.createElement('div');
  idiomaWrap.className = 'field';
  idiomaWrap.innerHTML = `
    <label for="f-idioma">Idioma</label>
    <input type="text" id="f-idioma" placeholder="p.ej. inglés" />
  `;

  const estilosWrap = document.createElement('div');
  estilosWrap.className = 'field';
  estilosWrap.style.gridColumn = '1 / -1';
  estilosWrap.innerHTML = `<label>Estilo de pensamiento</label>`;
  const checkRow = document.createElement('div');
  checkRow.className = 'checkbox-row';
  ESTILOS.forEach((estilo) => {
    const id = 'estilo-' + estilo;
    const lbl = document.createElement('label');
    lbl.innerHTML = `<input type="checkbox" id="${id}" value="${estilo}" /> ${estiloLabel(estilo)}`;
    lbl.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) activeEstilos.add(estilo);
      else activeEstilos.delete(estilo);
      applyFilters();
    });
    checkRow.appendChild(lbl);
  });
  estilosWrap.appendChild(checkRow);

  filtersEl.appendChild(nombreWrap);
  filtersEl.appendChild(ciudadWrap);
  filtersEl.appendChild(areaWrap);
  filtersEl.appendChild(cocheWrap);
  filtersEl.appendChild(asociacionWrap);
  filtersEl.appendChild(idiomaWrap);
  filtersEl.appendChild(estilosWrap);

  [ciudadSelect, areaSelect, cocheSelect, asociacionSelect].forEach((sel) =>
    sel.addEventListener('change', applyFilters)
  );
  document.getElementById('f-idioma').addEventListener('input', applyFilters);
  document.getElementById('f-nombre').addEventListener('input', applyFilters);
}

function applyFilters() {
  const nombre = document.getElementById('f-nombre').value.trim().toLowerCase();
  const ciudad = document.getElementById('f-ciudad').value;
  const area = document.getElementById('f-area').value;
  const coche = document.getElementById('f-coche').value;
  const asociacion = document.getElementById('f-asociacion').value;
  const idioma = document.getElementById('f-idioma').value.trim().toLowerCase();

  const filtered = allMembers.filter((m) => {
    if (nombre && !`${m.nombre ?? ''} ${m.apellidos ?? ''}`.toLowerCase().includes(nombre)) return false;
    if (ciudad && m.ciudad !== ciudad) return false;
    if (area && m.area_titulacion !== area) return false;
    if (coche && m.coche !== coche) return false;
    if (asociacion && m.asociacion !== asociacion) return false;

    if (idioma) {
      const idiomas = Array.isArray(m.idiomas) ? m.idiomas : [];
      if (!idiomas.some((i) => formatIdiomaEntry(i).toLowerCase().includes(idioma))) return false;
    }

    if (activeEstilos.size > 0) {
      const estilos = Array.isArray(m.estilos) ? m.estilos : [];
      if (![...activeEstilos].some((e) => estilos.includes(e))) return false;
    }

    return true;
  });

  renderResults(filtered);
}

function lugarYFormacion(m) {
  const titulaciones = m.titulacion ? m.titulacion.split(',').map((t) => t.trim()).filter(Boolean) : [];
  const lugar = [m.ciudad, m.asociacion ? asociacionLabel(m.asociacion) : null].filter(Boolean).join(' · ');
  const formacion = [m.area_titulacion, titulaciones.join(', ') || null].filter(Boolean).join(' · ');
  return { lugar, formacion };
}

function renderResults(members) {
  const grid = document.getElementById('search-results');
  const countLine = document.getElementById('search-count');
  countLine.textContent = `${members.length} persona${members.length === 1 ? '' : 's'} encontrada${members.length === 1 ? '' : 's'}`;

  if (members.length === 0) {
    grid.innerHTML = '<div class="empty-state">Nadie coincide con estos filtros.</div>';
    return;
  }

  grid.innerHTML = members
    .map((m) => {
      const estilos = Array.isArray(m.estilos) ? m.estilos : [];
      const { lugar, formacion } = lugarYFormacion(m);

      return `
        <div class="member-card" data-id="${m.id}">
          ${m.foto_url ? `<img class="member-photo" src="${m.foto_url}" alt="Foto de ${m.nombre ?? ''}" data-full="${m.foto_url}" />` : ''}
          <h3>${m.nombre ?? ''} ${m.apellidos ?? ''}</h3>
          ${lugar ? `<div class="meta">${lugar}</div>` : ''}
          ${formacion ? `<div class="meta">${formacion}</div>` : ''}
          ${m.coche ? `<div class="meta">${toSentenceCase(m.coche)}</div>` : ''}
          ${estilos.length ? `<div class="tag-list">${estilos.map((e) => `<span class="tag">${estiloLabel(e)}</span>`).join('')}</div>` : ''}
        </div>
      `;
    })
    .join('');

  grid.querySelectorAll('.member-photo').forEach((img) => {
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      openLightbox(img.dataset.full);
    });
  });

  grid.querySelectorAll('.member-card').forEach((card) => {
    card.addEventListener('click', () => {
      const member = members.find((m) => m.id === card.dataset.id);
      if (member) openDetail(member);
    });
  });
}

function renderFullDetail(m) {
  const idiomas = Array.isArray(m.idiomas) ? m.idiomas : [];
  const estilos = Array.isArray(m.estilos) ? m.estilos : [];
  const { lugar, formacion } = lugarYFormacion(m);

  return `
    ${m.foto_url ? `<img class="detail-photo" src="${m.foto_url}" alt="" data-full="${m.foto_url}" />` : ''}
    <h2 style="margin:0 0 4px">${m.nombre ?? ''} ${m.apellidos ?? ''}</h2>
    ${lugar ? `<div class="meta">${lugar}</div>` : ''}
    ${formacion ? `<div class="meta">${formacion}</div>` : ''}
    ${m.coche ? `<div class="meta">${toSentenceCase(m.coche)}</div>` : ''}
    ${estilos.length ? `<div class="tag-list">${estilos.map((e) => `<span class="tag">${estiloLabel(e)}</span>`).join('')}</div>` : ''}
    ${idiomas.length ? `<div class="meta">${idiomas.map(formatIdiomaEntry).join(', ')}</div>` : ''}
    ${m.experiencia ? `<div class="card-section"><span class="card-label">Experiencia</span><p>${m.experiencia}</p></div>` : ''}
    ${m.hobbies ? `<div class="card-section"><span class="card-label">Hobbies</span><p>${m.hobbies}</p></div>` : ''}
    ${m.disponibilidad ? `<div class="card-section"><span class="card-label">Disponibilidad</span><p>${m.disponibilidad}</p></div>` : ''}
    ${m.habilidades_humanas ? `<div class="card-section"><span class="card-label">Habilidades humanas</span><p>${m.habilidades_humanas}</p></div>` : ''}
    ${m.habilidades_cristianas ? `<div class="card-section"><span class="card-label">Habilidades cristianas</span><p>${m.habilidades_cristianas}</p></div>` : ''}
  `;
}

let dialogEl = null;

function ensureDialog() {
  if (dialogEl) return dialogEl;
  dialogEl = document.createElement('dialog');
  dialogEl.className = 'member-dialog';
  dialogEl.innerHTML = `
    <button type="button" class="btn secondary member-dialog-close">Cerrar</button>
    <div class="member-dialog-body"></div>
  `;
  document.body.appendChild(dialogEl);
  dialogEl.querySelector('.member-dialog-close').addEventListener('click', () => dialogEl.close());
  dialogEl.addEventListener('click', (e) => {
    if (e.target === dialogEl) dialogEl.close();
  });
  return dialogEl;
}

function openDetail(m) {
  const dialog = ensureDialog();
  const body = dialog.querySelector('.member-dialog-body');
  body.innerHTML = renderFullDetail(m);
  const photo = body.querySelector('.detail-photo');
  if (photo) photo.addEventListener('click', () => openLightbox(photo.dataset.full));
  dialog.showModal();
}

export async function initSearch() {
  const { data, error } = await supabase.rpc('get_directory');

  if (error) {
    document.getElementById('search-results').innerHTML =
      `<div class="empty-state">Error al cargar: ${error.message}</div>`;
    return;
  }

  allMembers = data ?? [];
  renderFilters();
  renderResults(allMembers);
}

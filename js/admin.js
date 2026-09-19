import { supabase } from './supabaseClient.js';
import { estiloLabel, formatIdiomaEntry, toSentenceCase, grupoLabel, normalizeText } from './format.js';
import { openLightbox } from './lightbox.js';
import { initProfile } from './profile.js';

let allMembers = [];
let dialogEl = null;
let adminSessionPromise = null;

function getAdminSession() {
  if (!adminSessionPromise) {
    adminSessionPromise = supabase.auth.getSession().then(({ data }) => data.session);
  }
  return adminSessionPromise;
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

const SENSITIVE_COLUMNS = [
  { key: 'nacimiento', label: 'Nacimiento', sortKey: 'nacimiento' },
  { key: 'es_menor', label: 'Menor de edad', format: (v) => (v ? 'Sí' : 'No'), sortKey: 'es_menor' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'nif', label: 'DNI' },
  { key: 'domicilio', label: 'Domicilio' },
  { key: 'alergias', label: 'Alergias' },
  { key: 'observaciones', label: 'Observaciones privadas' },
];

let sortState = { key: 'nombre', dir: 'asc' };

function compareRows(a, b, key) {
  if (key === 'es_menor') {
    return (a.es_menor ? 1 : 0) - (b.es_menor ? 1 : 0);
  }
  if (key === 'nacimiento') {
    const av = a.nacimiento ? new Date(a.nacimiento).getTime() : -Infinity;
    const bv = b.nacimiento ? new Date(b.nacimiento).getTime() : -Infinity;
    return av - bv;
  }
  const an = `${a.apellidos ?? ''} ${a.nombre ?? ''}`.trim();
  const bn = `${b.apellidos ?? ''} ${b.nombre ?? ''}`.trim();
  return an.localeCompare(bn, 'es', { sensitivity: 'base' });
}

function sortHeader(key, label) {
  const active = sortState.key === key;
  const arrow = active ? `<span class="sort-arrow">${sortState.dir === 'asc' ? '▲' : '▼'}</span>` : '';
  return `<th><button type="button" class="admin-sort-btn" data-sort="${key}">${label}${arrow}</button></th>`;
}

function distinctValues(rows, field) {
  return [...new Set(rows.map((r) => r[field]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'es')
  );
}

function matchesText(row, q) {
  const haystack = [
    row.nombre,
    row.apellidos,
    row.email,
    row.ciudad,
    row.area_titulacion,
    row.titulacion,
    row.coche,
    row.experiencia,
    row.hobbies,
    row.disponibilidad,
    row.habilidades_humanas,
    row.habilidades_cristianas,
    row.telefono,
    row.nif,
    row.domicilio,
    row.alergias,
    row.observaciones,
    row.observaciones_publicas,
    ...(Array.isArray(row.estilos) ? row.estilos : []),
    ...(Array.isArray(row.idiomas) ? row.idiomas.map(formatIdiomaEntry) : []),
  ]
    .filter(Boolean)
    .join(' ');
  return normalizeText(haystack).includes(normalizeText(q));
}

function detailField(label, value) {
  if (!value) return '';
  return `<div><label>${label}</label><p>${value}</p></div>`;
}

function renderDetail(row) {
  const estilos = Array.isArray(row.estilos) ? row.estilos : [];
  const idiomas = Array.isArray(row.idiomas) ? row.idiomas : [];

  return `
    ${row.foto_url ? `<img class="detail-photo" src="${row.foto_url}" alt="" data-full="${row.foto_url}" />` : ''}
    <h2 style="margin:0 0 4px">${row.nombre ?? ''} ${row.apellidos ?? ''}</h2>
    <p class="count-line">${row.email ?? ''}</p>

    <fieldset>
      <legend>Datos del directorio</legend>
      <div class="form-grid">
        ${detailField('Ciudad de residencia', row.ciudad)}
        ${detailField('Grupo', row.grupo ? grupoLabel(row.grupo) : '')}
        ${detailField('Área de titulación', row.area_titulacion)}
        ${detailField('Titulación', row.titulacion)}
        ${detailField('Coche', row.coche ? toSentenceCase(row.coche) : '')}
        ${detailField('OCD', row.ocd ? 'Sí' : 'No')}
        <div class="full">${detailField('Experiencia', row.experiencia)}</div>
        <div class="full">${detailField('Hobbies', row.hobbies)}</div>
        <div class="full">${detailField('Disponibilidad', row.disponibilidad)}</div>
        <div class="full">${detailField('Habilidades humanas', row.habilidades_humanas)}</div>
        <div class="full">${detailField('Habilidades cristianas/carmelitanas', row.habilidades_cristianas)}</div>
        <div class="full">${detailField('Observaciones públicas', row.observaciones_publicas)}</div>
        ${
          estilos.length
            ? `<div class="full"><label>Estilo de pensamiento</label><div class="tag-list">${estilos.map((e) => `<span class="tag">${estiloLabel(e)}</span>`).join('')}</div></div>`
            : ''
        }
        ${
          idiomas.length
            ? `<div class="full"><label>Idiomas</label><div class="tag-list">${idiomas.map((i) => `<span class="tag tag-outline">${formatIdiomaEntry(i)}</span>`).join('')}</div></div>`
            : ''
        }
      </div>
    </fieldset>

    <fieldset class="sensitive">
      <legend>Datos sensibles</legend>
      <div class="form-grid">
        ${detailField('Teléfono', row.telefono)}
        ${detailField('DNI', row.nif)}
        ${detailField('Fecha de nacimiento', row.nacimiento)}
        ${detailField('Menor de edad', row.es_menor ? 'Sí' : 'No')}
        <div class="full">${detailField('Domicilio', row.domicilio)}</div>
        <div class="full">${detailField('Alergias', row.alergias)}</div>
        <div class="full">${detailField('Observaciones privadas', row.observaciones)}</div>
      </div>
    </fieldset>
  `;
}

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

function showDetailView(body, row) {
  body.innerHTML = `
    <button type="button" class="btn secondary admin-edit-btn">Editar ficha</button>
    ${renderDetail(row)}
  `;
  const photo = body.querySelector('.detail-photo');
  if (photo) photo.addEventListener('click', () => openLightbox(photo.dataset.full));

  body.querySelector('.admin-edit-btn').addEventListener('click', async () => {
    body.innerHTML = `
      <button type="button" class="btn secondary admin-back-btn">← Volver</button>
      <div id="admin-edit-form"></div>
    `;
    body.querySelector('.admin-back-btn').addEventListener('click', () => showDetailView(body, row));

    const session = await getAdminSession();
    initProfile(session, {
      targetEmail: row.email,
      containerId: 'admin-edit-form',
      isAdminEditing: true,
      onSaved: () => {
        supabase
          .from('members')
          .select('*')
          .eq('email', row.email)
          .maybeSingle()
          .then(({ data }) => {
            if (data) Object.assign(row, data);
          });
      },
    });
  });
}

function openDetail(row) {
  const dialog = ensureDialog();
  const body = dialog.querySelector('.member-dialog-body');
  showDetailView(body, row);
  dialog.showModal();
}

function renderTable(rows) {
  if (rows.length === 0) {
    return '<div class="empty-state">Nadie coincide con estos filtros.</div>';
  }
  const head = `
    <tr>
      ${sortHeader('nombre', 'Nombre')}
      <th>Email</th>
      <th>Grupo</th>
      ${SENSITIVE_COLUMNS.map((c) => (c.sortKey ? sortHeader(c.sortKey, c.label) : `<th>${c.label}</th>`)).join('')}
    </tr>`;
  const body = rows
    .map((row) => {
      return `
    <tr>
      <td><button type="button" class="admin-name-link" data-id="${row.id}">${row.apellidos ?? ''}, ${row.nombre ?? ''}</button></td>
      <td>${row.email ?? ''}</td>
      <td>${row.grupo ? grupoLabel(row.grupo) : ''}</td>
      ${SENSITIVE_COLUMNS.map((c) => `<td class="sensitive">${c.format ? c.format(row[c.key]) : (row[c.key] ?? '')}</td>`).join('')}
    </tr>`;
    })
    .join('');
  return `
    <div class="table-wrap">
      <table class="admin-table">
        <thead>${head}</thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

function applyFilters() {
  const q = document.getElementById('admin-search').value.trim().toLowerCase();
  const grupo = document.getElementById('admin-grupo').value;

  const filtered = allMembers.filter((row) => {
    if (grupo && row.grupo !== grupo) return false;
    if (q && !matchesText(row, q)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const cmp = compareRows(a, b, sortState.key);
    return sortState.dir === 'asc' ? cmp : -cmp;
  });

  const tableBox = document.getElementById('admin-table-box');
  const prevScroll = tableBox.querySelector('.table-wrap')?.scrollLeft ?? 0;
  tableBox.innerHTML = renderTable(filtered);
  const newWrap = tableBox.querySelector('.table-wrap');
  if (newWrap) newWrap.scrollLeft = prevScroll;
  document.getElementById('admin-count').textContent = `${filtered.length} fichas`;

  document.querySelectorAll('.admin-name-link').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = allMembers.find((r) => r.id === btn.dataset.id);
      if (row) openDetail(row);
    });
  });

  document.querySelectorAll('.admin-sort-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.sort;
      sortState = sortState.key === key ? { key, dir: sortState.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' };
      applyFilters();
    });
  });
}

async function renderFichasPanel(panel) {
  const { data, error } = await supabase.from('members').select('*').order('apellidos');

  if (error) {
    panel.innerHTML = `<div class="empty-state">Error al cargar: ${error.message}</div>`;
    return;
  }

  allMembers = data ?? [];

  const grupoOptions = distinctValues(allMembers, 'grupo')
    .map((g) => `<option value="${g}">${grupoLabel(g)}</option>`)
    .join('');

  panel.innerHTML = `
    <div class="filters">
      <div class="field">
        <label for="admin-search">Buscar</label>
        <input type="text" id="admin-search" placeholder="Nombre, ciudad, idioma…" />
      </div>
      <div class="field">
        <label for="admin-grupo">Grupo</label>
        <select id="admin-grupo"><option value="">Todos</option>${grupoOptions}</select>
      </div>
    </div>
    <div id="admin-table-box"></div>
    <div class="count-line" id="admin-count"></div>
  `;

  document.getElementById('admin-search').addEventListener('input', applyFilters);
  document.getElementById('admin-grupo').addEventListener('change', applyFilters);

  applyFilters();
}

async function renderSignupsPanel(panel) {
  panel.innerHTML = '<p class="empty-state">Cargando…</p>';

  const { data, error } = await supabase.rpc('list_signups');

  if (error) {
    panel.innerHTML = `<div class="empty-state">Error al cargar: ${error.message}</div>`;
    return;
  }

  const rows = data ?? [];
  const sinFicha = rows.filter((r) => !r.tiene_ficha).length;

  if (rows.length === 0) {
    panel.innerHTML = '<div class="empty-state">Todavía no se ha registrado nadie.</div>';
    return;
  }

  panel.innerHTML = `
    <div class="count-line">
      ${rows.length} cuenta${rows.length === 1 ? '' : 's'} registrada${rows.length === 1 ? '' : 's'}
      ${sinFicha ? ` · <strong>${sinFicha} sin ficha</strong>` : ''}
    </div>
    <div class="table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Registrado</th>
            <th>Email confirmado</th>
            <th>Tiene ficha</th>
            <th>Última modificación de la ficha</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) => `
            <tr>
              <td>${r.email ?? ''}</td>
              <td>${formatDate(r.created_at)}</td>
              <td>${r.confirmado ? 'Sí' : 'No'}</td>
              <td class="${r.tiene_ficha ? '' : 'sensitive'}">${r.tiene_ficha ? 'Sí' : 'No'}</td>
              <td>${formatDate(r.ficha_actualizada_en) || '—'}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

export async function initAdmin() {
  const content = document.getElementById('admin-content');
  content.innerHTML = `
    <div class="tabs">
      <button type="button" class="tab-btn active" data-subview="fichas">Fichas</button>
      <button type="button" class="tab-btn" data-subview="signups">Cuentas registradas</button>
    </div>
    <div id="admin-panel-fichas"></div>
    <div id="admin-panel-signups" style="display:none"></div>
  `;

  const panels = {
    fichas: document.getElementById('admin-panel-fichas'),
    signups: document.getElementById('admin-panel-signups'),
  };
  const subtabButtons = content.querySelectorAll('.tab-btn');

  subtabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      subtabButtons.forEach((b) => b.classList.toggle('active', b === btn));
      const target = btn.dataset.subview;
      Object.entries(panels).forEach(([key, el]) => {
        el.style.display = key === target ? '' : 'none';
      });
      if (target === 'signups' && !panels.signups.dataset.loaded) {
        panels.signups.dataset.loaded = 'true';
        renderSignupsPanel(panels.signups);
      }
    });
  });

  panels.fichas.innerHTML = '<p class="empty-state">Cargando…</p>';
  await renderFichasPanel(panels.fichas);
}

import { supabase } from './supabaseClient.js';
import { estiloLabel, formatIdiomaEntry, toSentenceCase, asociacionLabel } from './format.js';
import { openLightbox } from './lightbox.js';

let allMembers = [];
let dialogEl = null;

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

const SENSITIVE_COLUMNS = [
  { key: 'telefono', label: 'Teléfono' },
  { key: 'nif', label: 'DNI' },
  { key: 'domicilio', label: 'Domicilio' },
  { key: 'nacimiento', label: 'Nacimiento' },
  { key: 'alergias', label: 'Alergias' },
];

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
    row.telefono,
    row.nif,
    row.domicilio,
    row.alergias,
    ...(Array.isArray(row.estilos) ? row.estilos : []),
    ...(Array.isArray(row.idiomas) ? row.idiomas.map(formatIdiomaEntry) : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
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
        ${detailField('Ciudad', row.ciudad)}
        ${detailField('Asociación', row.asociacion ? asociacionLabel(row.asociacion) : '')}
        ${detailField('Área de titulación', row.area_titulacion)}
        ${detailField('Titulación', row.titulacion)}
        ${detailField('Coche', row.coche ? toSentenceCase(row.coche) : '')}
        <div class="full">${detailField('Experiencia', row.experiencia)}</div>
        <div class="full">${detailField('Hobbies', row.hobbies)}</div>
        ${
          estilos.length
            ? `<div class="full"><label>Estilo de pensamiento</label><div class="tag-list">${estilos.map((e) => `<span class="tag">${estiloLabel(e)}</span>`).join('')}</div></div>`
            : ''
        }
        ${
          idiomas.length
            ? `<div class="full"><label>Idiomas</label><div class="tag-list">${idiomas.map((i) => `<span class="tag">${formatIdiomaEntry(i)}</span>`).join('')}</div></div>`
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
        <div class="full">${detailField('Domicilio', row.domicilio)}</div>
        <div class="full">${detailField('Alergias', row.alergias)}</div>
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

function openDetail(row) {
  const dialog = ensureDialog();
  const body = dialog.querySelector('.member-dialog-body');
  body.innerHTML = renderDetail(row);
  const photo = body.querySelector('.detail-photo');
  if (photo) photo.addEventListener('click', () => openLightbox(photo.dataset.full));
  dialog.showModal();
}

function renderTable(rows) {
  if (rows.length === 0) {
    return '<div class="empty-state">Nadie coincide con estos filtros.</div>';
  }
  const head = `
    <tr>
      <th>Nombre</th>
      <th>Email</th>
      <th>Asociación</th>
      ${SENSITIVE_COLUMNS.map((c) => `<th>${c.label}</th>`).join('')}
    </tr>`;
  const body = rows
    .map(
      (row) => `
    <tr>
      <td><button type="button" class="admin-name-link" data-id="${row.id}">${row.apellidos ?? ''}, ${row.nombre ?? ''}</button></td>
      <td>${row.email ?? ''}</td>
      <td>${row.asociacion ? asociacionLabel(row.asociacion) : ''}</td>
      ${SENSITIVE_COLUMNS.map((c) => `<td class="sensitive">${row[c.key] ?? ''}</td>`).join('')}
    </tr>`
    )
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
  const ciudad = document.getElementById('admin-ciudad').value;
  const asociacion = document.getElementById('admin-asociacion').value;

  const filtered = allMembers.filter((row) => {
    if (ciudad && row.ciudad !== ciudad) return false;
    if (asociacion && row.asociacion !== asociacion) return false;
    if (q && !matchesText(row, q)) return false;
    return true;
  });

  document.getElementById('admin-table-box').innerHTML = renderTable(filtered);
  document.getElementById('admin-count').textContent = `${filtered.length} fichas`;

  document.querySelectorAll('.admin-name-link').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = allMembers.find((r) => r.id === btn.dataset.id);
      if (row) openDetail(row);
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

  const ciudadOptions = distinctValues(allMembers, 'ciudad')
    .map((c) => `<option value="${c}">${c}</option>`)
    .join('');
  const asociacionOptions = distinctValues(allMembers, 'asociacion')
    .map((a) => `<option value="${a}">${asociacionLabel(a)}</option>`)
    .join('');

  panel.innerHTML = `
    <div class="filters">
      <div class="field">
        <label for="admin-search">Buscar</label>
        <input type="text" id="admin-search" placeholder="Nombre, ciudad, idioma…" />
      </div>
      <div class="field">
        <label for="admin-ciudad">Ciudad</label>
        <select id="admin-ciudad"><option value="">Todas</option>${ciudadOptions}</select>
      </div>
      <div class="field">
        <label for="admin-asociacion">Asociación</label>
        <select id="admin-asociacion"><option value="">Todas</option>${asociacionOptions}</select>
      </div>
    </div>
    <div id="admin-table-box"></div>
    <div class="count-line" id="admin-count"></div>
  `;

  document.getElementById('admin-search').addEventListener('input', applyFilters);
  document.getElementById('admin-ciudad').addEventListener('change', applyFilters);
  document.getElementById('admin-asociacion').addEventListener('change', applyFilters);

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
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

const CORREGIBLES = [
  { field: 'ciudad', label: 'Ciudad' },
  { field: 'titulacion', label: 'Titulación' },
  { field: 'alergias', label: 'Alergias' },
];

function renderFixValues(panel, field) {
  const counts = new Map();
  allMembers.forEach((row) => {
    const v = row[field];
    if (!v) return;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  });

  const rows = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
  const listBox = panel.querySelector('#admin-fix-list');

  if (rows.length === 0) {
    listBox.innerHTML = '<div class="empty-state">Nadie tiene ese campo relleno todavía.</div>';
    return;
  }

  listBox.innerHTML = `
    <div class="table-wrap">
      <table class="admin-table">
        <thead><tr><th>Valor</th><th>Personas</th><th></th></tr></thead>
        <tbody>
          ${rows
            .map(
              ([value, count]) => `
            <tr>
              <td>${value}</td>
              <td>${count}</td>
              <td><button type="button" class="btn secondary admin-fix-edit" data-value="${value}">Editar</button></td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  listBox.querySelectorAll('.admin-fix-edit').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const oldValue = btn.dataset.value;
      const newValue = prompt(`Nuevo valor para reemplazar "${oldValue}":`, oldValue);
      if (newValue === null) return;
      const trimmed = newValue.trim();
      if (!trimmed || trimmed === oldValue) return;
      if (!confirm(`Se cambiará "${oldValue}" por "${trimmed}" en todas las fichas que lo tengan. ¿Continuar?`)) return;

      const { data: affected, error } = await supabase.rpc('admin_rename_value', {
        field_name: field,
        old_value: oldValue,
        new_value: trimmed,
      });

      if (error) {
        alert('No se pudo corregir: ' + error.message);
        return;
      }

      allMembers.forEach((row) => {
        if (row[field] === oldValue) row[field] = trimmed;
      });

      renderFixValues(panel, field);
      alert(`Corregido en ${affected} ficha${affected === 1 ? '' : 's'}.`);
    });
  });
}

function renderFixPanel(panel) {
  panel.innerHTML = `
    <div class="field" style="max-width:280px;margin-bottom:14px">
      <label for="admin-fix-field">Campo a corregir</label>
      <select id="admin-fix-field">
        ${CORREGIBLES.map((c) => `<option value="${c.field}">${c.label}</option>`).join('')}
      </select>
    </div>
    <div id="admin-fix-list"></div>
  `;

  const select = document.getElementById('admin-fix-field');
  select.addEventListener('change', () => renderFixValues(panel, select.value));
  renderFixValues(panel, select.value);
}

export async function initAdmin() {
  const content = document.getElementById('admin-content');
  content.innerHTML = `
    <div class="tabs">
      <button type="button" class="tab-btn active" data-subview="fichas">Fichas</button>
      <button type="button" class="tab-btn" data-subview="signups">Cuentas registradas</button>
      <button type="button" class="tab-btn" data-subview="fix">Corregir valores</button>
    </div>
    <div id="admin-panel-fichas"></div>
    <div id="admin-panel-signups" style="display:none"></div>
    <div id="admin-panel-fix" style="display:none"></div>
  `;

  const panels = {
    fichas: document.getElementById('admin-panel-fichas'),
    signups: document.getElementById('admin-panel-signups'),
    fix: document.getElementById('admin-panel-fix'),
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
      if (target === 'fix') renderFixPanel(panels.fix);
    });
  });

  panels.fichas.innerHTML = '<p class="empty-state">Cargando…</p>';
  await renderFichasPanel(panels.fichas);
}

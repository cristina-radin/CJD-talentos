import { supabase } from './supabaseClient.js';
import { estiloLabel, formatIdiomaEntry, toSentenceCase } from './format.js';

let allMembers = [];

function matchesQuery(row, q) {
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
    <button type="button" class="btn secondary" id="admin-back-btn">← Volver a la lista</button>
    <h2 style="margin:16px 0 4px">${row.nombre ?? ''} ${row.apellidos ?? ''}</h2>
    <p class="count-line">${row.email ?? ''}</p>

    <fieldset>
      <legend>Datos del directorio</legend>
      <div class="form-grid">
        ${detailField('Ciudad', row.ciudad)}
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
        ${detailField('NIF', row.nif)}
        ${detailField('Fecha de nacimiento', row.nacimiento)}
        <div class="full">${detailField('Domicilio', row.domicilio)}</div>
        <div class="full">${detailField('Alergias', row.alergias)}</div>
      </div>
    </fieldset>
  `;
}

function renderList(rows) {
  if (rows.length === 0) {
    return '<div class="empty-state">Nadie coincide con la búsqueda.</div>';
  }
  return `
    <ul class="admin-name-list">
      ${rows
        .map(
          (row) => `
        <li>
          <button type="button" class="admin-name-btn" data-id="${row.id}">
            ${row.apellidos ?? ''}, ${row.nombre ?? ''}
          </button>
        </li>`
        )
        .join('')}
    </ul>
  `;
}

function showListView(content, rows) {
  content.innerHTML = `
    <div class="field" style="max-width:280px;margin-bottom:14px">
      <label for="admin-search">Buscar</label>
      <input type="text" id="admin-search" placeholder="Nombre, ciudad, idioma…" />
    </div>
    <div class="count-line" id="admin-count">${rows.length} fichas</div>
    <div id="admin-list-box">${renderList(rows)}</div>
  `;

  document.getElementById('admin-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = !q ? rows : rows.filter((row) => matchesQuery(row, q));
    document.getElementById('admin-count').textContent = `${filtered.length} fichas`;
    document.getElementById('admin-list-box').innerHTML = renderList(filtered);
    attachListHandlers(content, rows);
  });

  attachListHandlers(content, rows);
}

function attachListHandlers(content, rows) {
  content.querySelectorAll('.admin-name-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = rows.find((r) => r.id === btn.dataset.id);
      if (!row) return;
      content.innerHTML = renderDetail(row);
      document.getElementById('admin-back-btn').addEventListener('click', () => {
        showListView(content, rows);
      });
    });
  });
}

export async function initAdmin() {
  const content = document.getElementById('admin-content');
  content.innerHTML = '<p class="empty-state">Cargando…</p>';

  const { data, error } = await supabase.from('members').select('*').order('apellidos');

  if (error) {
    content.innerHTML = `<div class="empty-state">Error al cargar: ${error.message}</div>`;
    return;
  }

  allMembers = data ?? [];
  showListView(content, allMembers);
}

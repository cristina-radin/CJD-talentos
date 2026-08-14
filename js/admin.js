import { supabase } from './supabaseClient.js';

const COLUMNS = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'apellidos', label: 'Apellidos' },
  { key: 'email', label: 'Email' },
  { key: 'ciudad', label: 'Ciudad' },
  { key: 'area_titulacion', label: 'Área titulación' },
  { key: 'titulacion', label: 'Titulación' },
  { key: 'estilos', label: 'Estilos' },
  { key: 'idiomas', label: 'Idiomas' },
  { key: 'coche', label: 'Coche' },
  { key: 'experiencia', label: 'Experiencia' },
  { key: 'hobbies', label: 'Hobbies' },
  { key: 'telefono', label: 'Teléfono', sensitive: true },
  { key: 'nif', label: 'NIF', sensitive: true },
  { key: 'domicilio', label: 'Domicilio', sensitive: true },
  { key: 'nacimiento', label: 'Nacimiento', sensitive: true },
  { key: 'alergias', label: 'Alergias', sensitive: true },
];

function cellValue(row, key) {
  const v = row[key];
  if (Array.isArray(v)) return v.join(', ');
  return v ?? '';
}

function renderTable(rows) {
  const head = `<tr>${COLUMNS.map((c) => `<th>${c.label}</th>`).join('')}</tr>`;
  const body = rows
    .map(
      (row) =>
        `<tr>${COLUMNS.map((c) => `<td class="${c.sensitive ? 'sensitive' : ''}">${cellValue(row, c.key)}</td>`).join('')}</tr>`
    )
    .join('');
  return `
    <div class="table-wrap">
      <table class="admin-table">
        <thead>${head}</thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

export async function initAdmin() {
  const content = document.getElementById('admin-content');
  content.innerHTML = '<p class="empty-state">Cargando…</p>';

  const { data, error } = await supabase.from('members').select('*').order('apellidos');

  if (error) {
    content.innerHTML = `<div class="empty-state">Error al cargar: ${error.message}</div>`;
    return;
  }

  const rows = data ?? [];

  content.innerHTML = `
    <div class="field" style="max-width:280px;margin-bottom:14px">
      <label for="admin-search">Buscar en la tabla</label>
      <input type="text" id="admin-search" placeholder="Filtrar por cualquier campo…" />
    </div>
    <div class="count-line" id="admin-count">${rows.length} fichas</div>
    <div id="admin-table-box">${renderTable(rows)}</div>
  `;

  document.getElementById('admin-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = !q
      ? rows
      : rows.filter((row) => COLUMNS.some((c) => cellValue(row, c.key).toString().toLowerCase().includes(q)));
    document.getElementById('admin-count').textContent = `${filtered.length} fichas`;
    document.getElementById('admin-table-box').innerHTML = renderTable(filtered);
  });
}

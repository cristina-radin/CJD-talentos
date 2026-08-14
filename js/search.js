import { supabase } from './supabaseClient.js';
import { ESTILOS } from './config.js';
import { estiloLabel, formatIdiomaEntry, toSentenceCase } from './format.js';

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

  const { wrap: ciudadWrap, select: ciudadSelect } = buildSelect(
    'f-ciudad',
    'Ciudad',
    distinctValues(allMembers, 'ciudad')
  );
  const { wrap: areaWrap, select: areaSelect } = buildSelect(
    'f-area',
    'Área de titulación',
    distinctValues(allMembers, 'area_titulacion')
  );
  const { wrap: cocheWrap, select: cocheSelect } = buildSelect(
    'f-coche',
    'Coche',
    distinctValues(allMembers, 'coche'),
    toSentenceCase
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

  filtersEl.appendChild(ciudadWrap);
  filtersEl.appendChild(areaWrap);
  filtersEl.appendChild(cocheWrap);
  filtersEl.appendChild(idiomaWrap);
  filtersEl.appendChild(estilosWrap);

  [ciudadSelect, areaSelect, cocheSelect].forEach((sel) =>
    sel.addEventListener('change', applyFilters)
  );
  document.getElementById('f-idioma').addEventListener('input', applyFilters);
}

function applyFilters() {
  const ciudad = document.getElementById('f-ciudad').value;
  const area = document.getElementById('f-area').value;
  const coche = document.getElementById('f-coche').value;
  const idioma = document.getElementById('f-idioma').value.trim().toLowerCase();

  const filtered = allMembers.filter((m) => {
    if (ciudad && m.ciudad !== ciudad) return false;
    if (area && m.area_titulacion !== area) return false;
    if (coche && m.coche !== coche) return false;

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
      const idiomas = Array.isArray(m.idiomas) ? m.idiomas : [];
      const estilos = Array.isArray(m.estilos) ? m.estilos : [];
      return `
        <div class="member-card">
          <h3>${m.nombre ?? ''} ${m.apellidos ?? ''}</h3>
          <div class="meta">
            ${[m.ciudad, m.titulacion, m.area_titulacion].filter(Boolean).join(' · ')}
          </div>
          ${estilos.length ? `<div class="tag-list">${estilos.map((e) => `<span class="tag">${estiloLabel(e)}</span>`).join('')}</div>` : ''}
          ${idiomas.length ? `<div class="tag-list">${idiomas.map((i) => `<span class="tag">${formatIdiomaEntry(i)}</span>`).join('')}</div>` : ''}
          ${m.coche ? `<div class="meta">Coche: ${toSentenceCase(m.coche)}</div>` : ''}
          ${m.experiencia ? `<p>${m.experiencia}</p>` : ''}
          ${m.hobbies ? `<p><em>${m.hobbies}</em></p>` : ''}
        </div>
      `;
    })
    .join('');
}

export async function initSearch() {
  const { data, error } = await supabase.from('members_public').select('*');

  if (error) {
    document.getElementById('search-results').innerHTML =
      `<div class="empty-state">Error al cargar: ${error.message}</div>`;
    return;
  }

  allMembers = data ?? [];
  renderFilters();
  renderResults(allMembers);
}

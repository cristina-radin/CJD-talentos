import { supabase } from './supabaseClient.js';
import { ESTILOS, ASOCIACIONES, NIVELES_IDIOMA, COCHE_OPCIONES, AREAS_TITULACION } from './config.js';
import { estiloLabel, formatIdiomaEntry, asociacionLabel, toSentenceCase } from './format.js';

let idiomasList = [];
let alergiasList = [];
let titulacionesList = [];

// Campo "combo": desplegable con los valores ya existentes en la base de
// datos + una opción "Otra…" que revela un campo de texto libre. Evita que
// cada quien escriba la misma ciudad/coche/área de formas distintas
// (acentos, mayúsculas, erratas) mientras sigue permitiendo dar de alta
// valores nuevos que aún no existan.
function comboFieldHtml(id, labelText, options, currentValue, { labelFn = (v) => v, multiline = false, wrapClass = '', allowBlank = true } = {}) {
  const isKnown = currentValue && options.includes(currentValue);
  const isOtro = Boolean(currentValue) && !isKnown;
  const optsHtml = options
    .map((v) => `<option value="${v}" ${currentValue === v ? 'selected' : ''}>${labelFn(v)}</option>`)
    .join('');
  const otroTag = multiline
    ? `<textarea id="${id}-otro" placeholder="Escribe el valor" style="margin-top:6px; ${isOtro ? '' : 'display:none'}">${isOtro ? currentValue : ''}</textarea>`
    : `<input type="text" id="${id}-otro" placeholder="Escribe el valor" value="${isOtro ? currentValue : ''}" style="margin-top:6px; ${isOtro ? '' : 'display:none'}" />`;

  return `
    <div class="${wrapClass}">
      <label for="${id}">${labelText}</label>
      <select id="${id}">
        ${allowBlank ? '<option value="">Sin especificar</option>' : ''}
        ${optsHtml}
        <option value="__otro__" ${isOtro ? 'selected' : ''}>Otra… (escribir)</option>
      </select>
      ${otroTag}
    </div>
  `;
}

function wireComboField(id) {
  const select = document.getElementById(id);
  const otro = document.getElementById(`${id}-otro`);
  select.addEventListener('change', () => {
    const showOtro = select.value === '__otro__';
    otro.style.display = showOtro ? '' : 'none';
    if (showOtro) otro.focus();
  });
}

function comboFieldValue(id) {
  const select = document.getElementById(id);
  if (select.value === '__otro__') {
    return document.getElementById(`${id}-otro`).value.trim() || null;
  }
  return select.value || null;
}

const ALERGIAS_RAPIDAS = ['Ninguna'];

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// nacimiento se guarda como texto "DD/MM/AAAA". Estos helpers convierten
// entre ese formato y los tres desplegables (día/mes/año) del formulario.
function parseNacimiento(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value ?? '');
  if (!match) return { dia: '', mes: '', anio: '' };
  return { dia: match[1], mes: match[2], anio: match[3] };
}

function nacimientoFieldsHtml(value) {
  const { dia, mes, anio } = parseNacimiento(value);
  const currentYear = new Date().getFullYear();

  const diaOpts = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))
    .map((d) => `<option value="${d}" ${dia === d ? 'selected' : ''}>${d}</option>`)
    .join('');
  const mesOpts = MESES.map(
    (nombre, i) => `<option value="${String(i + 1).padStart(2, '0')}" ${mes === String(i + 1).padStart(2, '0') ? 'selected' : ''}>${nombre}</option>`
  ).join('');
  // No se permiten años futuros: estamos hablando de una fecha de nacimiento.
  const anioOpts = Array.from({ length: 100 }, (_, i) => String(currentYear - i))
    .map((a) => `<option value="${a}" ${anio === a ? 'selected' : ''}>${a}</option>`)
    .join('');

  return `
    <div class="tag-input-row">
      <select id="p-nacimiento-dia"><option value="">Día</option>${diaOpts}</select>
      <select id="p-nacimiento-mes"><option value="">Mes</option>${mesOpts}</select>
      <select id="p-nacimiento-anio"><option value="">Año</option>${anioOpts}</select>
    </div>
  `;
}

function nacimientoValue() {
  const dia = document.getElementById('p-nacimiento-dia').value;
  const mes = document.getElementById('p-nacimiento-mes').value;
  const anio = document.getElementById('p-nacimiento-anio').value;
  if (!dia || !mes || !anio) return null;
  return `${dia}/${mes}/${anio}`;
}

// Calcula si alguien es menor de edad a partir de su fecha de nacimiento en
// lugar de fiarse de una casilla marcada a mano, que se puede olvidar.
function calcEsMenor(nacimientoStr) {
  const { dia, mes, anio } = parseNacimiento(nacimientoStr);
  if (!dia || !mes || !anio) return false;
  const nacimiento = new Date(Number(anio), Number(mes) - 1, Number(dia));
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const cumpleEsteAnio = new Date(hoy.getFullYear(), nacimiento.getMonth(), nacimiento.getDate());
  if (hoy < cumpleEsteAnio) edad--;
  return edad < 18;
}

function esMenorIndicatorHtml(nacimientoStr) {
  return calcEsMenor(nacimientoStr) ? 'Sí' : 'No';
}

function renderTagList(boxId, list, labelFn, rerender) {
  const box = document.getElementById(boxId);
  box.innerHTML = '';
  list.forEach((entry, idx) => {
    const chip = document.createElement('span');
    chip.className = 'tag';
    chip.textContent = labelFn(entry);
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      list.splice(idx, 1);
      rerender();
    });
    chip.appendChild(removeBtn);
    box.appendChild(chip);
  });
}

function renderIdiomasTags() {
  renderTagList('p-idiomas-tags', idiomasList, formatIdiomaEntry, renderIdiomasTags);
}

function renderAlergiasTags() {
  renderTagList('p-alergias-tags', alergiasList, (v) => v, renderAlergiasTags);
}

function renderTitulacionesTags() {
  renderTagList('p-titulaciones-tags', titulacionesList, (v) => v, renderTitulacionesTags);
}

function formHtml(m, options, isAdminEditing) {
  const estilosActuales = Array.isArray(m.estilos) ? m.estilos : [];
  const estilosHtml = isAdminEditing
    ? ESTILOS.map(
        (estilo) => `
        <label>
          <input type="checkbox" class="p-estilo" value="${estilo}" ${estilosActuales.includes(estilo) ? 'checked' : ''} />
          ${estiloLabel(estilo)}
        </label>`
      ).join('')
    : estilosActuales.length
      ? estilosActuales.map((e) => `<span class="tag">${estiloLabel(e)}</span>`).join('')
      : '<span class="empty-state" style="padding:0">Sin asignar</span>';

  const asociacionOptions = ASOCIACIONES.map(
    (a) => `<option value="${a}" ${m.asociacion === a ? 'selected' : ''}>${asociacionLabel(a)}</option>`
  ).join('');

  return `
    <form id="profile-form">
      <p class="form-hint">Escribe con la letra inicial en mayúscula y usa los acentos correspondientes (á, é, í, ó, ú, ñ). Fíjate en las fichas ya completadas y en las opciones que ya aparecen en los desplegables para escribir de forma parecida: así tu ficha será más fácil de leer y de buscar.</p>
      <fieldset>
        <legend>Datos del directorio</legend>
        <div class="form-grid">
          <div class="full">
            <label>Foto</label>
            <div class="photo-upload-row">
              <img id="p-foto-preview" class="photo-preview" src="${m.foto_url ?? ''}" alt="" style="${m.foto_url ? '' : 'display:none'}" />
              ${isAdminEditing ? '' : '<input type="file" id="p-foto-input" accept="image/*" />'}
            </div>
            <div class="msg" id="p-foto-msg"></div>
          </div>
          <div>
            <label for="p-nombre">Nombre</label>
            <input type="text" id="p-nombre" required value="${m.nombre ?? ''}" />
          </div>
          <div>
            <label for="p-apellidos">Apellidos</label>
            <input type="text" id="p-apellidos" required value="${m.apellidos ?? ''}" />
          </div>
          ${comboFieldHtml('p-ciudad', 'Ciudad', options.ciudad, m.ciudad)}
          <div>
            <label for="p-coche">Coche</label>
            <select id="p-coche" required>
              ${COCHE_OPCIONES.map((c) => `<option value="${c}" ${m.coche === c ? 'selected' : ''}>${toSentenceCase(c)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label for="p-asociacion">Asociación</label>
            <select id="p-asociacion">
              <option value="">Sin especificar</option>
              ${asociacionOptions}
            </select>
          </div>
          <div>
            <label for="p-area">Área de titulación</label>
            <select id="p-area">
              <option value="">Sin especificar</option>
              ${AREAS_TITULACION.map((a) => `<option value="${a}" ${m.area_titulacion === a ? 'selected' : ''}>${a}</option>`).join('')}
            </select>
          </div>
          <div class="full">
            <label>Titulación</label>
            <div class="tag-list" id="p-titulaciones-tags"></div>
            <div class="tag-input-row">
              <select id="p-titulacion-select">
                <option value="">Elige o añade…</option>
                ${options.titulacion.map((t) => `<option value="${t}">${t}</option>`).join('')}
                <option value="__otro__">Otra… (escribir)</option>
              </select>
              <input type="text" id="p-titulacion-otro" placeholder="Escribe la titulación" style="display:none" />
              <button type="button" class="btn secondary" id="p-titulacion-add">Añadir</button>
            </div>
          </div>
          <div class="full">
            <label for="p-experiencia">Experiencia</label>
            <textarea id="p-experiencia" placeholder="Separa cada elemento con un punto y empieza el siguiente en mayúscula. Ej: Diseño gráfico. Gestión de equipos. Marketing.">${m.experiencia ?? ''}</textarea>
          </div>
          <div class="full">
            <label for="p-hobbies">Hobbies</label>
            <textarea id="p-hobbies" placeholder="Separa cada elemento con un punto y empieza el siguiente en mayúscula. Ej: Fútbol. Lectura. Viajar.">${m.hobbies ?? ''}</textarea>
          </div>
          <div class="full">
            <label for="p-disponibilidad">Disponibilidad</label>
            <textarea id="p-disponibilidad" placeholder="Separa cada elemento con un punto y empieza el siguiente en mayúscula. Ej: Fines de semana. Tardes entre semana.">${m.disponibilidad ?? ''}</textarea>
          </div>
          <div class="full">
            <label for="p-habilidades-humanas">Habilidades y competencias humanas</label>
            <textarea id="p-habilidades-humanas" placeholder="Separa cada elemento con un punto y empieza el siguiente en mayúscula. Ej: Trabajo en equipo. Escucha activa. Liderazgo.">${m.habilidades_humanas ?? ''}</textarea>
          </div>
          <div class="full">
            <label for="p-habilidades-cristianas">Habilidades y competencias cristianas/carmelitanas</label>
            <textarea id="p-habilidades-cristianas" placeholder="Separa cada elemento con un punto y empieza el siguiente en mayúscula. Ej: Catequesis. Animación de retiros. Oración en grupo.">${m.habilidades_cristianas ?? ''}</textarea>
          </div>
          <div class="full">
            <label for="p-observaciones-publicas">Observaciones públicas</label>
            <textarea id="p-observaciones-publicas" placeholder="Cualquier comentario que quieras que vea el resto del grupo.">${m.observaciones_publicas ?? ''}</textarea>
          </div>
          <div class="full">
            <label>Estilo de pensamiento${isAdminEditing ? '' : ' (no editable)'}</label>
            <div class="${isAdminEditing ? 'checkbox-row' : 'tag-list'}">${estilosHtml}</div>
          </div>
          <div class="checkbox-row">
            <label for="p-ocd">
              <input type="checkbox" id="p-ocd" ${m.ocd ? 'checked' : ''} />
              OCD
            </label>
          </div>
          <div class="full">
            <label>Idiomas</label>
            <div class="tag-list" id="p-idiomas-tags"></div>
            <div class="tag-input-row">
              <select id="p-idioma-select">
                <option value="">Elige idioma…</option>
                ${options.idiomas.map((n) => `<option value="${n}">${n}</option>`).join('')}
                <option value="__otro__">Otro… (escribir)</option>
              </select>
              <input type="text" id="p-idioma-nombre-otro" placeholder="Escribe el idioma" style="display:none" />
              <select id="p-idioma-nivel">
                <option value="">Elige nivel…</option>
                ${NIVELES_IDIOMA.map((n) => `<option value="${n}">${n}</option>`).join('')}
              </select>
              <button type="button" class="btn secondary" id="p-idioma-add">Añadir</button>
            </div>
            <div class="msg" id="p-idioma-msg"></div>
          </div>
        </div>
      </fieldset>

      <fieldset class="sensitive">
        <legend>Datos sensibles (solo tú y los admins los ven)</legend>
        <div class="form-grid">
          <div>
            <label for="p-telefono">Teléfono</label>
            <input type="text" id="p-telefono" value="${m.telefono ?? ''}" />
          </div>
          <div>
            <label for="p-nif">DNI</label>
            <input type="text" id="p-nif" value="${m.nif ?? ''}" />
          </div>
          <div>
            <label for="p-nacimiento-dia">Fecha de nacimiento</label>
            ${nacimientoFieldsHtml(m.nacimiento)}
          </div>
          <div>
            <label>Es menor de edad</label>
            <p id="p-es-menor-info" style="margin:0; font-size:0.9rem;">${esMenorIndicatorHtml(m.nacimiento)}</p>
          </div>
          <div class="full">
            <label for="p-domicilio">Domicilio</label>
            <input type="text" id="p-domicilio" placeholder="C/ Mayor 12, 3ºB, Valencia" value="${m.domicilio ?? ''}" />
          </div>
          <div class="full">
            <label>Alergias</label>
            <p class="field-hint">Añádelas una a una: elige o escribe cada alergia y pulsa "Añadir".</p>
            <div class="tag-list" id="p-alergias-tags"></div>
            <div class="tag-input-row">
              <select id="p-alergia-select">
                <option value="">Elige o añade…</option>
                ${options.alergias.map((a) => `<option value="${a}">${a}</option>`).join('')}
                <option value="__otro__">Otra… (escribir)</option>
              </select>
              <input type="text" id="p-alergia-otro" placeholder="Escribe la alergia" style="display:none" />
              <button type="button" class="btn secondary" id="p-alergia-add">Añadir</button>
            </div>
          </div>
          <div class="full">
            <label for="p-observaciones">Observaciones privadas</label>
            <textarea id="p-observaciones" placeholder="Solo lo ven los admins.">${m.observaciones ?? ''}</textarea>
          </div>
        </div>
      </fieldset>

      <div class="msg" id="profile-msg"></div>
      <button type="submit" class="btn" id="profile-submit">Guardar cambios</button>
    </form>
  `;
}

function showMsg(text, isError) {
  const el = document.getElementById('profile-msg');
  el.textContent = text;
  el.className = 'msg show ' + (isError ? 'error' : 'ok');
}

export async function initProfile(session, opts = {}) {
  const { targetEmail = null, containerId = 'profile-content', isAdminEditing = false, onSaved = null } = opts;
  const content = document.getElementById(containerId);
  content.innerHTML = '<p class="empty-state">Cargando ficha…</p>';

  const email = targetEmail ?? session.user.email;
  const { data: member, error } = await supabase
    .from('members')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    content.innerHTML = `<div class="empty-state">Error al cargar la ficha: ${error.message}</div>`;
    return;
  }

  if (!member) {
    content.innerHTML = isAdminEditing
      ? `<div class="empty-state">No se encontró ninguna ficha con el email <strong>${email}</strong>.</div>`
      : `
      <div class="empty-state">
        No hemos encontrado ninguna ficha en la bolsa de talentos con el email
        <strong>${email}</strong>. Pide a un administrador que te dé de alta con ese
        mismo email.
      </div>`;
    return;
  }

  idiomasList = Array.isArray(member.idiomas) ? [...member.idiomas] : [];
  alergiasList = (member.alergias ?? '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
  titulacionesList = (member.titulacion ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const [{ data: allMembers }, { data: alergiasExistentes }] = await Promise.all([
    supabase.rpc('get_directory'),
    supabase.rpc('get_distinct_alergias'),
  ]);

  const distinct = (field) =>
    [...new Set((allMembers ?? []).map((r) => r[field]).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'es')
    );

  // Para campos que ahora admiten varios valores separados por comas en el
  // mismo texto (titulacion), hay que separar antes de sacar la lista de
  // sugerencias, si no cada combinación completa saldría como una opción.
  const distinctTokens = (field) =>
    [
      ...new Set(
        (allMembers ?? [])
          .flatMap((r) => (r[field] ?? '').split(','))
          .map((v) => v.trim())
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b, 'es'));

  const idiomaNombres = [
    ...new Set(
      (allMembers ?? [])
        .flatMap((m) => (Array.isArray(m.idiomas) ? m.idiomas : []))
        .map((i) => (typeof i === 'object' && i ? i.n : i))
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b, 'es'));

  const options = {
    ciudad: distinct('ciudad'),
    titulacion: distinctTokens('titulacion'),
    idiomas: idiomaNombres,
    alergias: [...new Set([...ALERGIAS_RAPIDAS, ...(alergiasExistentes ?? [])])],
  };

  content.innerHTML = formHtml(member, options, isAdminEditing);
  renderIdiomasTags();
  renderAlergiasTags();
  renderTitulacionesTags();
  ['p-ciudad'].forEach(wireComboField);

  ['p-nacimiento-dia', 'p-nacimiento-mes', 'p-nacimiento-anio'].forEach((id) => {
    document.getElementById(id).addEventListener('change', () => {
      document.getElementById('p-es-menor-info').innerHTML = esMenorIndicatorHtml(nacimientoValue());
    });
  });

  document.getElementById('p-idioma-select').addEventListener('change', (e) => {
    const otro = document.getElementById('p-idioma-nombre-otro');
    const showOtro = e.target.value === '__otro__';
    otro.style.display = showOtro ? '' : 'none';
    if (showOtro) otro.focus();
  });

  document.getElementById('p-alergia-select').addEventListener('change', (e) => {
    const otro = document.getElementById('p-alergia-otro');
    const showOtro = e.target.value === '__otro__';
    otro.style.display = showOtro ? '' : 'none';
    if (showOtro) otro.focus();
  });

  document.getElementById('p-alergia-add').addEventListener('click', () => {
    const select = document.getElementById('p-alergia-select');
    const otroInput = document.getElementById('p-alergia-otro');

    const value = select.value === '__otro__' ? otroInput.value.trim() : select.value;
    if (!value || alergiasList.includes(value)) return;

    alergiasList.push(value);

    select.value = '';
    otroInput.value = '';
    otroInput.style.display = 'none';
    renderAlergiasTags();
  });

  document.getElementById('p-titulacion-select').addEventListener('change', (e) => {
    const otro = document.getElementById('p-titulacion-otro');
    const showOtro = e.target.value === '__otro__';
    otro.style.display = showOtro ? '' : 'none';
    if (showOtro) otro.focus();
  });

  document.getElementById('p-titulacion-add').addEventListener('click', () => {
    const select = document.getElementById('p-titulacion-select');
    const otroInput = document.getElementById('p-titulacion-otro');

    const value = select.value === '__otro__' ? otroInput.value.trim() : select.value;
    if (!value || titulacionesList.includes(value)) return;

    titulacionesList.push(value);

    select.value = '';
    otroInput.value = '';
    otroInput.style.display = 'none';
    renderTitulacionesTags();
  });

  document.getElementById('p-foto-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fotoMsg = document.getElementById('p-foto-msg');
    fotoMsg.className = 'msg show';
    fotoMsg.textContent = 'Subiendo foto…';

    const ext = file.name.split('.').pop();
    const path = `${session.user.id}/foto.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('fotos_perfil')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      fotoMsg.className = 'msg show error';
      fotoMsg.textContent = 'No se pudo subir la foto: ' + uploadError.message;
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('fotos_perfil').getPublicUrl(path);
    const fotoUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

    const { error: saveError } = await supabase.from('members').update({ foto_url: fotoUrl }).eq('email', email);

    if (saveError) {
      fotoMsg.className = 'msg show error';
      fotoMsg.textContent = 'La foto se subió pero no se pudo guardar: ' + saveError.message;
      return;
    }

    const preview = document.getElementById('p-foto-preview');
    preview.src = fotoUrl;
    preview.style.display = '';

    fotoMsg.className = 'msg show ok';
    fotoMsg.textContent = 'Foto actualizada.';
  });

  document.getElementById('p-idioma-add').addEventListener('click', () => {
    const select = document.getElementById('p-idioma-select');
    const otroInput = document.getElementById('p-idioma-nombre-otro');
    const nivelSelect = document.getElementById('p-idioma-nivel');
    const idiomaMsg = document.getElementById('p-idioma-msg');

    const idioma = select.value === '__otro__' ? otroInput.value.trim() : select.value;
    const nivel = nivelSelect.value;

    if (!idioma || !nivel) {
      idiomaMsg.className = 'msg show error';
      idiomaMsg.textContent = 'Elige idioma y nivel antes de añadir.';
      return;
    }
    idiomaMsg.className = 'msg';

    idiomasList.push({ n: idioma, nivel });

    select.value = '';
    otroInput.value = '';
    otroInput.style.display = 'none';
    nivelSelect.value = '';
    renderIdiomasTags();
  });

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('profile-submit');
    submitBtn.disabled = true;

    const updates = {
      nombre: document.getElementById('p-nombre').value.trim(),
      apellidos: document.getElementById('p-apellidos').value.trim(),
      ciudad: comboFieldValue('p-ciudad'),
      coche: document.getElementById('p-coche').value || null,
      asociacion: document.getElementById('p-asociacion').value || null,
      area_titulacion: document.getElementById('p-area').value || null,
      titulacion: titulacionesList.length ? titulacionesList.join(', ') : null,
      experiencia: document.getElementById('p-experiencia').value.trim() || null,
      hobbies: document.getElementById('p-hobbies').value.trim() || null,
      disponibilidad: document.getElementById('p-disponibilidad').value.trim() || null,
      habilidades_humanas: document.getElementById('p-habilidades-humanas').value.trim() || null,
      habilidades_cristianas: document.getElementById('p-habilidades-cristianas').value.trim() || null,
      observaciones_publicas: document.getElementById('p-observaciones-publicas').value.trim() || null,
      idiomas: idiomasList,
      telefono: document.getElementById('p-telefono').value.trim() || null,
      nif: document.getElementById('p-nif').value.trim() || null,
      nacimiento: nacimientoValue(),
      domicilio: document.getElementById('p-domicilio').value.trim() || null,
      alergias: alergiasList.length ? alergiasList.join(', ') : null,
      observaciones: document.getElementById('p-observaciones').value.trim() || null,
      es_menor: calcEsMenor(nacimientoValue()),
      ocd: document.getElementById('p-ocd').checked,
    };

    if (isAdminEditing) {
      updates.estilos = [...document.querySelectorAll('.p-estilo:checked')].map((el) => el.value);
    }

    const { error: updateError } = await supabase.from('members').update(updates).eq('email', email);

    if (updateError) {
      submitBtn.disabled = false;
      showMsg('No se pudo guardar: ' + updateError.message, true);
      return;
    }

    // Vuelve a cargar la ficha (y las opciones de los desplegables, por si
    // se añadió un valor nuevo) para que se vea todo actualizado al momento.
    await initProfile(session, opts);
    showMsg('Cambios guardados.', false);
    onSaved?.();
  });
}

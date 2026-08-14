import { supabase } from './supabaseClient.js';
import { ESTILOS, ASOCIACIONES, NIVELES_IDIOMA } from './config.js';
import { estiloLabel, formatIdiomaEntry, asociacionLabel, toSentenceCase } from './format.js';

let idiomasList = [];

// Campo "combo": desplegable con los valores ya existentes en la base de
// datos + una opción "Otra…" que revela un campo de texto libre. Evita que
// cada quien escriba la misma ciudad/coche/área de formas distintas
// (acentos, mayúsculas, erratas) mientras sigue permitiendo dar de alta
// valores nuevos que aún no existan.
function comboFieldHtml(id, labelText, options, currentValue, { labelFn = (v) => v, multiline = false, wrapClass = '' } = {}) {
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
        <option value="">Sin especificar</option>
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

const ALERGIAS_RAPIDAS = ['Ninguna', 'Ninguna conocida'];

function renderIdiomasTags() {
  const box = document.getElementById('p-idiomas-tags');
  box.innerHTML = '';
  idiomasList.forEach((entry, idx) => {
    const chip = document.createElement('span');
    chip.className = 'tag';
    chip.textContent = formatIdiomaEntry(entry);
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      idiomasList.splice(idx, 1);
      renderIdiomasTags();
    });
    chip.appendChild(removeBtn);
    box.appendChild(chip);
  });
}

function formHtml(m, options) {
  const estilosActuales = Array.isArray(m.estilos) ? m.estilos : [];
  const estilosHtml = ESTILOS.map(
    (estilo) => `
      <label>
        <input type="checkbox" class="p-estilo" value="${estilo}" ${estilosActuales.includes(estilo) ? 'checked' : ''} />
        ${estiloLabel(estilo)}
      </label>`
  ).join('');

  const asociacionOptions = ASOCIACIONES.map(
    (a) => `<option value="${a}" ${m.asociacion === a ? 'selected' : ''}>${asociacionLabel(a)}</option>`
  ).join('');

  return `
    <form id="profile-form">
      <fieldset>
        <legend>Datos del directorio</legend>
        <div class="form-grid">
          <div class="full">
            <label>Foto</label>
            <div class="photo-upload-row">
              <img id="p-foto-preview" class="photo-preview" src="${m.foto_url ?? ''}" alt="" style="${m.foto_url ? '' : 'display:none'}" />
              <input type="file" id="p-foto-input" accept="image/*" />
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
          ${comboFieldHtml('p-coche', 'Coche', options.coche, m.coche, { labelFn: toSentenceCase })}
          <div>
            <label for="p-asociacion">Asociación</label>
            <select id="p-asociacion">
              <option value="">Sin especificar</option>
              ${asociacionOptions}
            </select>
          </div>
          ${comboFieldHtml('p-area', 'Área de titulación', options.area_titulacion, m.area_titulacion)}
          ${comboFieldHtml('p-titulacion', 'Titulación', options.titulacion, m.titulacion)}
          <div class="full">
            <label for="p-experiencia">Experiencia</label>
            <textarea id="p-experiencia">${m.experiencia ?? ''}</textarea>
          </div>
          <div class="full">
            <label for="p-hobbies">Hobbies</label>
            <textarea id="p-hobbies">${m.hobbies ?? ''}</textarea>
          </div>
          <div class="full">
            <label>Estilo de pensamiento</label>
            <div class="checkbox-row">${estilosHtml}</div>
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
                <option value="">Nivel (opcional)</option>
                ${NIVELES_IDIOMA.map((n) => `<option value="${n}">${n}</option>`).join('')}
              </select>
              <button type="button" class="btn secondary" id="p-idioma-add">Añadir</button>
            </div>
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
            <label for="p-nif">NIF</label>
            <input type="text" id="p-nif" value="${m.nif ?? ''}" />
          </div>
          <div>
            <label for="p-nacimiento">Fecha de nacimiento</label>
            <input type="date" id="p-nacimiento" value="${m.nacimiento ?? ''}" />
          </div>
          <div class="full">
            <label for="p-domicilio">Domicilio</label>
            <input type="text" id="p-domicilio" value="${m.domicilio ?? ''}" />
          </div>
          ${comboFieldHtml('p-alergias', 'Alergias', options.alergias, m.alergias, { multiline: true, wrapClass: 'full' })}
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

export async function initProfile(session) {
  const content = document.getElementById('profile-content');
  content.innerHTML = '<p class="empty-state">Cargando tu ficha…</p>';

  const email = session.user.email;
  const { data: member, error } = await supabase
    .from('members')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    content.innerHTML = `<div class="empty-state">Error al cargar tu ficha: ${error.message}</div>`;
    return;
  }

  if (!member) {
    content.innerHTML = `
      <div class="empty-state">
        No hemos encontrado ninguna ficha en la bolsa de talentos con el email
        <strong>${email}</strong>. Pide a un administrador que te dé de alta con ese
        mismo email.
      </div>`;
    return;
  }

  idiomasList = Array.isArray(member.idiomas) ? [...member.idiomas] : [];

  const [{ data: allMembers }, { data: alergiasExistentes }] = await Promise.all([
    supabase.rpc('get_directory'),
    supabase.rpc('get_distinct_alergias'),
  ]);

  const distinct = (field) =>
    [...new Set((allMembers ?? []).map((r) => r[field]).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'es')
    );

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
    area_titulacion: distinct('area_titulacion'),
    coche: distinct('coche'),
    titulacion: distinct('titulacion'),
    idiomas: idiomaNombres,
    alergias: [...new Set([...ALERGIAS_RAPIDAS, ...(alergiasExistentes ?? [])])],
  };

  content.innerHTML = formHtml(member, options);
  renderIdiomasTags();
  ['p-ciudad', 'p-coche', 'p-area', 'p-titulacion', 'p-alergias'].forEach(wireComboField);

  document.getElementById('p-idioma-select').addEventListener('change', (e) => {
    const otro = document.getElementById('p-idioma-nombre-otro');
    const showOtro = e.target.value === '__otro__';
    otro.style.display = showOtro ? '' : 'none';
    if (showOtro) otro.focus();
  });

  document.getElementById('p-foto-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fotoMsg = document.getElementById('p-foto-msg');
    fotoMsg.className = 'msg show';
    fotoMsg.textContent = 'Subiendo foto…';

    const ext = file.name.split('.').pop();
    const path = `${session.user.id}/foto.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('fotos')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      fotoMsg.className = 'msg show error';
      fotoMsg.textContent = 'No se pudo subir la foto: ' + uploadError.message;
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('fotos').getPublicUrl(path);
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

    const idioma = select.value === '__otro__' ? otroInput.value.trim() : select.value;
    const nivel = nivelSelect.value;
    if (!idioma) return;

    idiomasList.push(nivel ? { n: idioma, nivel } : { n: idioma });

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

    const estilos = [...document.querySelectorAll('.p-estilo:checked')].map((el) => el.value);

    const updates = {
      nombre: document.getElementById('p-nombre').value.trim(),
      apellidos: document.getElementById('p-apellidos').value.trim(),
      ciudad: comboFieldValue('p-ciudad'),
      coche: comboFieldValue('p-coche')?.toUpperCase() || null,
      asociacion: document.getElementById('p-asociacion').value || null,
      area_titulacion: comboFieldValue('p-area'),
      titulacion: comboFieldValue('p-titulacion'),
      experiencia: document.getElementById('p-experiencia').value.trim() || null,
      hobbies: document.getElementById('p-hobbies').value.trim() || null,
      estilos,
      idiomas: idiomasList,
      telefono: document.getElementById('p-telefono').value.trim() || null,
      nif: document.getElementById('p-nif').value.trim() || null,
      nacimiento: document.getElementById('p-nacimiento').value || null,
      domicilio: document.getElementById('p-domicilio').value.trim() || null,
      alergias: comboFieldValue('p-alergias'),
    };

    const { error: updateError } = await supabase.from('members').update(updates).eq('email', email);

    submitBtn.disabled = false;

    if (updateError) {
      showMsg('No se pudo guardar: ' + updateError.message, true);
      return;
    }
    showMsg('Cambios guardados.', false);
  });
}

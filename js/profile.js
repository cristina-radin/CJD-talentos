import { supabase } from './supabaseClient.js';
import { ESTILOS, ASOCIACIONES } from './config.js';
import { estiloLabel, formatIdiomaEntry, asociacionLabel } from './format.js';

let idiomasList = [];

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

function formHtml(m) {
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
          <div>
            <label for="p-ciudad">Ciudad</label>
            <input type="text" id="p-ciudad" value="${m.ciudad ?? ''}" />
          </div>
          <div>
            <label for="p-coche">Coche</label>
            <input type="text" id="p-coche" value="${m.coche ?? ''}" />
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
            <input type="text" id="p-area" value="${m.area_titulacion ?? ''}" />
          </div>
          <div>
            <label for="p-titulacion">Titulación</label>
            <input type="text" id="p-titulacion" value="${m.titulacion ?? ''}" />
          </div>
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
              <input type="text" id="p-idioma-nombre" placeholder="Idioma, p.ej. Inglés" />
              <input type="text" id="p-idioma-nivel" placeholder="Nivel, p.ej. Avanzado" />
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
            <input type="text" id="p-nacimiento" value="${m.nacimiento ?? ''}" />
          </div>
          <div class="full">
            <label for="p-domicilio">Domicilio</label>
            <input type="text" id="p-domicilio" value="${m.domicilio ?? ''}" />
          </div>
          <div class="full">
            <label for="p-alergias">Alergias</label>
            <textarea id="p-alergias">${m.alergias ?? ''}</textarea>
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

  content.innerHTML = formHtml(member);
  renderIdiomasTags();

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
    const nombreInput = document.getElementById('p-idioma-nombre');
    const nivelInput = document.getElementById('p-idioma-nivel');
    const idioma = nombreInput.value.trim();
    const nivel = nivelInput.value.trim();
    if (!idioma) return;
    idiomasList.push(nivel ? { n: idioma, nivel } : { n: idioma });
    nombreInput.value = '';
    nivelInput.value = '';
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
      ciudad: document.getElementById('p-ciudad').value.trim() || null,
      coche: document.getElementById('p-coche').value.trim() || null,
      asociacion: document.getElementById('p-asociacion').value || null,
      area_titulacion: document.getElementById('p-area').value.trim() || null,
      titulacion: document.getElementById('p-titulacion').value.trim() || null,
      experiencia: document.getElementById('p-experiencia').value.trim() || null,
      hobbies: document.getElementById('p-hobbies').value.trim() || null,
      estilos,
      idiomas: idiomasList,
      telefono: document.getElementById('p-telefono').value.trim() || null,
      nif: document.getElementById('p-nif').value.trim() || null,
      nacimiento: document.getElementById('p-nacimiento').value.trim() || null,
      domicilio: document.getElementById('p-domicilio').value.trim() || null,
      alergias: document.getElementById('p-alergias').value.trim() || null,
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

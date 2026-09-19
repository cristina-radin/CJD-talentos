import { supabase } from './supabaseClient.js';

const CONSENT_TEXT =
  'Para poder ver tu ficha y que el resto de miembros la encuentren, necesitamos tu ' +
  'consentimiento para tratar los datos que rellenes (nombre, formación, idiomas, foto, etc.) ' +
  'y mostrarlos dentro de esta bolsa de talentos al resto de miembros del Carmelo Joven Descalzo. ' +
  'Los datos sensibles (teléfono, DNI, domicilio, alergias, observaciones privadas) solo los ve el equipo de administración. ' +
  'Puedes leer el detalle completo en la <a href="privacidad.html" target="_blank" rel="noopener">política de privacidad</a>, ' +
  'y retirar este consentimiento cuando quieras desde "Mi ficha".';

let dialogEl = null;

function ensureDialog() {
  if (dialogEl) return dialogEl;
  dialogEl = document.createElement('dialog');
  dialogEl.className = 'consent-dialog';
  dialogEl.innerHTML = `
    <h2>Antes de continuar</h2>
    <p>${CONSENT_TEXT}</p>
    <label class="consent-checkbox">
      <input type="checkbox" id="consent-checkbox" />
      Acepto el uso de mis datos en la bolsa de talentos.
    </label>
    <div class="msg" id="consent-msg"></div>
    <button type="button" class="btn" id="consent-accept-btn" disabled>Aceptar y continuar</button>
  `;
  document.body.appendChild(dialogEl);
  // No se puede cerrar con Esc ni haciendo clic fuera: hay que aceptar para seguir.
  dialogEl.addEventListener('cancel', (e) => e.preventDefault());
  return dialogEl;
}

// Comprueba si esta cuenta ya aceptó el uso de datos (y no lo ha retirado
// después) y, si no, bloquea la app con un diálogo hasta que lo haga. Se
// llama al principio de app.js, antes de enseñar cualquier vista.
export async function ensureConsent(session) {
  const { data, error } = await supabase
    .from('consentimientos')
    .select('user_id, revocado_en')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error) {
    console.error('No se pudo comprobar el consentimiento de datos:', error.message);
    return;
  }
  if (data && !data.revocado_en) return;

  const dialog = ensureDialog();
  const checkbox = dialog.querySelector('#consent-checkbox');
  const acceptBtn = dialog.querySelector('#consent-accept-btn');
  const msg = dialog.querySelector('#consent-msg');
  checkbox.checked = false;
  acceptBtn.disabled = true;
  msg.textContent = '';
  msg.className = 'msg';

  await new Promise((resolve) => {
    checkbox.onchange = () => {
      acceptBtn.disabled = !checkbox.checked;
    };
    acceptBtn.onclick = async () => {
      acceptBtn.disabled = true;
      // upsert: si ya existía una fila (p.ej. de un consentimiento retirado),
      // se reactiva en vez de chocar con la clave primaria.
      const { error: upsertError } = await supabase
        .from('consentimientos')
        .upsert({ user_id: session.user.id, email: session.user.email, aceptado_en: new Date().toISOString(), revocado_en: null });

      if (upsertError) {
        msg.textContent = 'No se pudo guardar: ' + upsertError.message;
        msg.className = 'msg show error';
        acceptBtn.disabled = false;
        return;
      }
      dialog.close();
      resolve();
    };
    dialog.showModal();
  });
}

// Retira el consentimiento de la cuenta actual: a partir de ahora su ficha
// deja de aparecer en el directorio y, la próxima vez que inicie sesión,
// se le volverá a pedir que acepte.
export async function withdrawConsent(session) {
  const { error } = await supabase
    .from('consentimientos')
    .update({ revocado_en: new Date().toISOString() })
    .eq('user_id', session.user.id);

  return { error };
}

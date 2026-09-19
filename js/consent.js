import { supabase } from './supabaseClient.js';

const CONSENT_TEXT =
  'Para poder ver tu ficha y que el resto de miembros la encuentren, necesitamos tu ' +
  'consentimiento para tratar los datos que rellenes (nombre, formación, idiomas, foto, etc.) ' +
  'y mostrarlos dentro de esta bolsa de talentos al resto de miembros del Carmelo Joven Descalzo. ' +
  'Los datos sensibles (teléfono, DNI, domicilio, alergias, observaciones privadas) solo los ve el equipo de administración.';

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

// Comprueba si esta cuenta ya aceptó el uso de datos y, si no, bloquea la
// app con un diálogo hasta que lo haga. Se llama al principio de app.js,
// antes de enseñar cualquier vista.
export async function ensureConsent(session) {
  const { data, error } = await supabase
    .from('consentimientos')
    .select('user_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error) {
    console.error('No se pudo comprobar el consentimiento de datos:', error.message);
    return;
  }
  if (data) return;

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
      const { error: insertError } = await supabase
        .from('consentimientos')
        .insert({ user_id: session.user.id, email: session.user.email });

      if (insertError) {
        msg.textContent = 'No se pudo guardar: ' + insertError.message;
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

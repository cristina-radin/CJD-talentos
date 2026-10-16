import { logout } from './auth.js';
import { IDLE_LOGOUT_MINUTES } from './config.js';

const LAST_ACTIVITY_KEY = 'ultimaActividad';
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];

function readLastActivity() {
  try {
    return Number(sessionStorage.getItem(LAST_ACTIVITY_KEY)) || Date.now();
  } catch {
    return Date.now();
  }
}

function writeLastActivity(time) {
  try {
    sessionStorage.setItem(LAST_ACTIVITY_KEY, String(time));
  } catch {
    // Sin sessionStorage solo se pierde el recuerdo entre recargas.
  }
}

// Cierra la sesión tras IDLE_LOGOUT_MINUTES sin tocar la página. Se compara
// contra la hora guardada en vez de fiarse de un único setTimeout, porque
// los navegadores congelan los temporizadores en pestañas en segundo plano
// o con el portátil suspendido. La hora vive en sessionStorage para que
// recargar la página no reinicie la cuenta.
export function startIdleLogout() {
  const limitMs = IDLE_LOGOUT_MINUTES * 60 * 1000;
  let lastActivity = readLastActivity();
  let loggingOut = false;

  const check = () => {
    if (loggingOut || Date.now() - lastActivity < limitMs) return;
    loggingOut = true;
    logout('inactividad');
  };

  // Comprobar antes de nada: si la pestaña llevaba abierta y quieta más del
  // límite y se recarga, debe salir en vez de contar como actividad nueva.
  check();
  if (loggingOut) return;

  let lastWrite = 0;
  const markActivity = () => {
    lastActivity = Date.now();
    // Escribir como mucho cada 5 s: `scroll` y similares se disparan sin parar.
    if (lastActivity - lastWrite > 5000) {
      lastWrite = lastActivity;
      writeLastActivity(lastActivity);
    }
  };

  writeLastActivity(lastActivity);
  ACTIVITY_EVENTS.forEach((type) =>
    window.addEventListener(type, markActivity, { passive: true, capture: true })
  );
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  setInterval(check, 30 * 1000);
}

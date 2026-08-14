import { ESTILOS_LABELS } from './config.js';

// "CON COCHE" -> "Con coche"
export function toSentenceCase(str) {
  if (!str) return '';
  const lower = String(str).toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function estiloLabel(estilo) {
  return ESTILOS_LABELS[estilo] ?? toSentenceCase(estilo);
}

// `idiomas` es JSONB y puede venir como string suelto ("Inglés") o como
// objeto ({ idioma: "Inglés", nivel: "Avanzado" }, o claves parecidas).
// Se intenta primero el par idioma/nivel más habitual y, si no encaja,
// se cae a mostrar los valores de texto que tenga el objeto en vez de
// "[object Object]".
export function formatIdiomaEntry(entry) {
  if (entry == null) return '';
  if (typeof entry === 'string') return entry;
  if (typeof entry !== 'object') return String(entry);

  const idioma = entry.idioma ?? entry.lenguaje ?? entry.nombre ?? entry.language ?? null;
  const nivel = entry.nivel ?? entry.level ?? null;

  if (idioma && nivel) return `${idioma} · ${nivel}`;
  if (idioma) return idioma;

  const textValues = Object.values(entry).filter((v) => typeof v === 'string' && v.trim());
  return textValues.length ? textValues.join(' · ') : '';
}

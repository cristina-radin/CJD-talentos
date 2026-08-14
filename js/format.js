import { ESTILOS_LABELS, ASOCIACION_LABELS } from './config.js';

// "CON COCHE" -> "Con coche"
export function toSentenceCase(str) {
  if (!str) return '';
  const lower = String(str).toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function estiloLabel(estilo) {
  return ESTILOS_LABELS[estilo] ?? toSentenceCase(estilo);
}

export function asociacionLabel(asociacion) {
  return ASOCIACION_LABELS[asociacion] ?? toSentenceCase(asociacion);
}

// `idiomas` es JSONB: cada entrada es { n: "Inglés", nivel: "Avanzado" }.
// Se admite también texto suelto o claves parecidas por si algún dato
// antiguo no sigue exactamente ese formato.
export function formatIdiomaEntry(entry) {
  if (entry == null) return '';
  if (typeof entry === 'string') return entry;
  if (typeof entry !== 'object') return String(entry);

  const idioma = entry.n ?? entry.idioma ?? entry.lenguaje ?? entry.nombre ?? entry.language ?? null;
  const nivel = entry.nivel ?? entry.level ?? null;

  if (idioma && nivel) return `${idioma} · ${nivel}`;
  if (idioma) return idioma;

  const textValues = Object.values(entry).filter((v) => typeof v === 'string' && v.trim());
  return textValues.length ? textValues.join(' · ') : '';
}

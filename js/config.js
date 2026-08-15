// Estos valores son públicos: la clave "publishable" está protegida por las
// políticas de RLS de Supabase, no por estar oculta. Es seguro que estén en
// un repositorio público y en el navegador del usuario.
export const SUPABASE_URL = 'https://wramkbrxxgtauosvhynt.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_K07kJgH4bRwsD6FeYH95RA_FCW0AMiF';

// Los 4 estilos de pensamiento fijos usados en el formulario y en la búsqueda.
// El valor (clave del objeto) es el que se guarda en la base de datos tal cual;
// la etiqueta es solo para mostrar.
export const ESTILOS = ['CREATIVO', 'EMPATICO', 'LOGICO-MATEMATICO', 'ORGANIZADO'];

export const ESTILOS_LABELS = {
  CREATIVO: 'Creativo',
  EMPATICO: 'Empático',
  'LOGICO-MATEMATICO': 'Lógico-matemático',
  ORGANIZADO: 'Organizado',
};

// Asociación regional. Igual que ESTILOS: el valor se guarda tal cual en la
// base de datos, la etiqueta es solo para mostrar.
export const ASOCIACIONES = ['LEVANTE', 'ANDALUCIA', 'MADRID'];

export const ASOCIACION_LABELS = {
  LEVANTE: 'Levante',
  ANDALUCIA: 'Andalucía',
  MADRID: 'Madrid',
};

// Niveles fijos de idioma, para que el filtro de búsqueda pueda comparar
// niveles de forma fiable en vez de depender de texto libre.
export const NIVELES_IDIOMA = ['Básico', 'Intermedio', 'Avanzado'];

// Coche: lista cerrada, sin opción de "otra". Cada valor ya se basta solo
// como frase (por eso no se le pone la etiqueta "Coche:" delante al mostrarlo).
export const COCHE_OPCIONES = ['CON CARNÉ, SIN COCHE', 'CON CARNÉ CON COCHE', 'SIN CARNÉ'];

// Área de titulación: las 5 ramas de conocimiento oficiales usadas en las
// universidades españolas. Lista cerrada, sin "otra" — si a alguien no le
// encaja del todo, es la más parecida.
export const AREAS_TITULACION = [
  'Artes y Humanidades',
  'Ciencias',
  'Ciencias de la Salud',
  'Ciencias Sociales y Jurídicas',
  'Ingeniería y Arquitectura',
];

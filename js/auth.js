import { supabase } from './supabaseClient.js';

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Llamar al principio de app.html: si no hay sesión, manda a login.
export async function requireSession() {
  const session = await getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  return session;
}

// Llamar al principio de index.html: si ya hay sesión, entra directo a la app.
export async function redirectIfLoggedIn() {
  const session = await getSession();
  if (session) window.location.href = 'app.html';
}

export async function logout() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}

// Comprueba si el email está en la tabla `admins`. La tabla admins necesita
// una política RLS que permita SELECT a usuarios autenticados, si no esta
// consulta siempre devolverá "no admin" aunque el email esté en la tabla.
export async function checkIsAdmin(email) {
  const { data, error } = await supabase
    .from('admins')
    .select('email')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('No se pudo comprobar el rol de admin:', error.message);
    return false;
  }
  return !!data;
}

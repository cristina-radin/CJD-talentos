import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// sessionStorage en vez del localStorage por defecto: la sesión sobrevive a
// navegar entre páginas de la app, pero desaparece al cerrar la pestaña,
// obligando a iniciar sesión de nuevo la próxima vez.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: window.sessionStorage,
  },
});

# CJD-talentos

Bolsa de talentos interna de Carmelo Joven Descalzo: directorio buscable de
miembros (formación, idiomas, hobbies…) conectado a Supabase, sin frameworks,
pensado para desplegarse en GitHub Pages.

## Estructura

```
index.html      Login + registro (Supabase Auth)
app.html        App principal: Buscar / Mi ficha / Admin
css/style.css   Estilos
js/config.js    URL y clave pública de Supabase, lista de estilos fijos
js/supabaseClient.js  Cliente de supabase-js
js/auth.js      Helpers de sesión, logout y comprobación de admin
js/login.js     Lógica de index.html
js/app.js       Coordinador de app.html (pestañas)
js/search.js    Vista "Buscar" sobre members_public
js/profile.js   Vista "Mi ficha" sobre members (propia fila)
js/admin.js     Vista "Admin" sobre members (tabla completa)
```

No hay build ni `npm install`: son ficheros estáticos que importan
`supabase-js` directamente desde un CDN (`esm.sh`), así que basta con
servirlos tal cual.

## Configuración pendiente en Supabase

1. **Política de lectura de `admins`.** La app necesita poder comprobar si el
   email logueado está en `admins` para mostrar la pestaña de admin. Si no
   existe ya, añade en el SQL Editor:
   ```sql
   alter table admins enable row level security;
   create policy "authenticated can read admins"
     on admins for select
     to authenticated
     using (true);
   ```

2. **Importante: visibilidad de `members_public` para usuarios no admin.**
   Como `members_public` tiene `security_invoker` activado, las políticas RLS
   de la tabla `members` se aplican también al consultar la vista, con el
   usuario que hace la consulta. Si la única política de `SELECT` en
   `members` es "solo admins", un usuario normal autenticado verá `members_public`
   vacía y la pantalla de "Buscar" no mostrará a nadie salvo a los admins.
   Para que cualquier miembro autenticado pueda buscar en el directorio,
   añade una política adicional de `SELECT` en `members` para usuarios
   autenticados en general (la restricción de columnas sensibles ya la da la
   vista, no hace falta repetirla en la política):
   ```sql
   create policy "authenticated can read members for directory"
     on members for select
     to authenticated
     using (true);
   ```
   Comprueba tus políticas actuales con:
   ```sql
   select * from pg_policies where tablename = 'members';
   ```
   Pruébalo dado de alta como usuario normal (no admin): entra a "Buscar" y
   confirma que aparecen otros miembros, no solo tu propia ficha.

3. **Confirmación de email al registrarse.** Por defecto Supabase Auth exige
   confirmar el email antes de poder iniciar sesión. Para un grupo interno
   pequeño puedes dejarlo activado (cada persona confirma desde su correo) o
   desactivarlo en **Authentication → Providers → Email → Confirm email**
   para simplificar el alta. La app ya contempla ambos casos.

4. El registro (`signUp`) no comprueba en el navegador que el email ya
   exista en `members`, porque `members` solo es legible por admins vía RLS
   (no se puede validar sin autenticar primero). Cualquiera puede crear una
   cuenta, pero sin una fila en `members` con ese email, "Mi ficha" mostrará
   un aviso de que no se ha encontrado ninguna ficha, y no aparecerá en las
   búsquedas de nadie. El control real de quién importa lo da la tabla
   `members`, no el registro.

## Desplegar en GitHub Pages

1. Sube estos cambios a la rama `main` del repo
   `cristina-radin/CJD-talentos`.
2. En GitHub: **Settings → Pages**.
3. En "Build and deployment" elige **Source: Deploy from a branch**, rama
   `main`, carpeta `/ (root)`.
4. Guarda. GitHub te dará una URL tipo
   `https://cristina-radin.github.io/CJD-talentos/`. Tarda uno o dos minutos
   en publicarse la primera vez.
5. Cada vez que hagas `git push` a `main` con cambios en estos ficheros, la
   página se actualiza sola.

No hace falta ningún secreto adicional en GitHub: la clave de Supabase usada
en el frontend es la clave pública ("publishable"), protegida por RLS, así
que es segura de tener en un repo aunque sea privado o público.

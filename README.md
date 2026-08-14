# CJD-talentos

Internal talent directory for Carmelo Joven Descalzo: a searchable directory
of members (education, languages, hobbies…) backed by Supabase, no build
step, deployed on GitHub Pages.

The app itself is in Spanish (its audience is a Spanish-speaking group);
this README and commit history are in English.

## Structure

```
index.html            Login + sign-up (Supabase Auth)
app.html               Main app shell: Search / My profile / Admin
css/style.css           Styles (brand colors, fonts, layout)
js/config.js            Supabase URL/key, fixed option lists (estilos, asociaciones, niveles)
js/supabaseClient.js    supabase-js client (session stored in sessionStorage, cleared on tab close)
js/auth.js              Session helpers, logout, admin check
js/format.js            Display formatting (idiomas, estilos, coche, asociación)
js/lightbox.js          Shared click-to-enlarge photo viewer
js/login.js             Logic for index.html
js/app.js               Coordinator for app.html (tab switching)
js/search.js            "Search" view, reads via the get_directory() RPC
js/profile.js           "My profile" view, edits the user's own members row
js/admin.js             "Admin" view: full member table + registered-accounts list
assets/                 Logo (assets/logo.png, not committed by this session)
```

No build, no `npm install`: these are static files that import `supabase-js`
from a CDN (`esm.sh`), so they can be served as-is.

## Required Supabase setup

This project relies on several SQL objects and a couple of dashboard steps
that live in Supabase, not in this repo. In order:

1. **`admins` table** must allow authenticated read access (so the app can
   check whether the logged-in email is an admin):
   ```sql
   alter table admins enable row level security;
   create policy "authenticated can read admins"
     on admins for select
     to authenticated
     using (true);
   ```

2. **`is_member()` helper** — used to gate directory access to people who
   already have a row in `members` (not just anyone who signed up):
   ```sql
   create or replace function is_member(user_email text)
   returns boolean
   language sql
   security definer
   set search_path = public
   as $$
     select exists (select 1 from members where email = user_email);
   $$;

   grant execute on function is_member(text) to authenticated;
   ```

3. **`get_directory()`** — the only way regular (non-admin) members read the
   directory. Returns non-sensitive columns only, and only to members or
   admins. Do NOT grant `authenticated` direct `select` on `members` or
   `members_public` — RLS only filters rows, not columns, so a broad grant
   plus a permissive policy would let any signed-up account read everyone's
   phone/NIF/address directly. This function is the safe path:
   ```sql
   create or replace function get_directory()
   returns table (
     id uuid, nombre text, apellidos text, ciudad text, area_titulacion text,
     titulacion text, estilos text[], idiomas jsonb, coche text,
     experiencia text, hobbies text, asociacion text, foto_url text
   )
   language sql
   security definer
   set search_path = public
   as $$
     select id, nombre, apellidos, ciudad, area_titulacion, titulacion,
            estilos, idiomas, coche, experiencia, hobbies, asociacion, foto_url
     from members
     where is_member(auth.jwt() ->> 'email')
        or exists (select 1 from admins where admins.email = auth.jwt() ->> 'email');
   $$;

   grant execute on function get_directory() to authenticated;
   ```

4. **`get_distinct_alergias()`** — anonymized list of allergy values already
   in use (no id/email attached), used to populate a quick-pick dropdown in
   the profile form:
   ```sql
   create or replace function get_distinct_alergias()
   returns setof text
   language sql
   security definer
   set search_path = public
   as $$
     select distinct alergias
     from members
     where alergias is not null and alergias <> ''
     order by alergias;
   $$;

   grant execute on function get_distinct_alergias() to authenticated;
   ```

5. **Base table grants** — `authenticated` needs `select`/`update` on
   `members` itself (for admins reading everything, and for each user
   updating their own row), plus `select` on `admins`:
   ```sql
   grant select, update on members to authenticated;
   grant select on admins to authenticated;
   ```

   You also need a policy letting each user read (not just update) their own
   row — `js/profile.js` queries `members` directly, not through
   `get_directory()`, so without this a non-admin's own profile page shows
   up as "not found" even though their row exists:
   ```sql
   create policy "puedes leer tu propia ficha"
     on members for select
     to authenticated
     using (auth.jwt() ->> 'email' = email);
   ```

6. **Group signup password** — a lightweight gate on account creation,
   checked server-side so the real value never reaches the browser or the
   (public) repo:
   ```sql
   create table if not exists app_settings (
     key text primary key,
     value text not null
   );

   insert into app_settings (key, value)
   values ('signup_password', 'CHANGE_ME')
   on conflict (key) do update set value = excluded.value;

   alter table app_settings enable row level security;
   -- No select policies on purpose: nobody can read this table directly.

   create or replace function check_signup_password(candidate text)
   returns boolean
   language sql
   security definer
   set search_path = public
   as $$
     select exists (
       select 1 from app_settings
       where key = 'signup_password' and value = candidate
     );
   $$;

   grant execute on function check_signup_password(text) to anon, authenticated;
   ```

7. **`list_signups()`** — admin-only listing of Auth accounts (used by the
   "Cuentas registradas" tab), flags accounts with no matching `members` row:
   ```sql
   create or replace function list_signups()
   returns table (email text, created_at timestamptz, confirmado boolean, tiene_ficha boolean)
   language plpgsql
   security definer
   set search_path = public, auth
   as $$
   begin
     if not exists (select 1 from admins where admins.email = auth.jwt() ->> 'email') then
       raise exception 'Not authorized';
     end if;

     return query
     select u.email::text, u.created_at, (u.confirmed_at is not null) as confirmado,
            exists (select 1 from members m where m.email = u.email) as tiene_ficha
     from auth.users u
     order by u.created_at desc;
   end;
   $$;

   grant execute on function list_signups() to authenticated;
   ```

8. **Photo storage** — Storage → Create bucket named `fotos`, marked
   **public**. Then:
   ```sql
   alter table members add column foto_url text;

   create policy "users upload their own photo"
   on storage.objects for insert
   to authenticated
   with check (
     bucket_id = 'fotos'
     and (storage.foldername(name))[1] = auth.uid()::text
   );

   create policy "users update their own photo"
   on storage.objects for update
   to authenticated
   using (
     bucket_id = 'fotos'
     and (storage.foldername(name))[1] = auth.uid()::text
   );
   ```

9. **`asociacion` column** (regional chapter: Levante / Andalucía / Madrid):
   ```sql
   alter table members
     add column asociacion text check (asociacion in ('LEVANTE', 'ANDALUCIA', 'MADRID'));
   ```

10. **Email confirmation on sign-up.** Supabase Auth requires email
    confirmation by default. For a small internal group you can leave it on
    (each person confirms from their inbox) or turn it off under
    **Authentication → Providers → Email → Confirm email**. The app handles
    either case.

Sanity check anytime with:
```sql
select policyname, cmd, qual from pg_policies where tablename in ('members', 'admins', 'app_settings');
select grantee, table_name, privilege_type from information_schema.role_table_grants
  where table_schema = 'public' and table_name in ('members', 'admins');
```

## Deploying to GitHub Pages

1. Push changes to `main` on `cristina-radin/CJD-talentos`.
2. GitHub → **Settings → Pages**.
3. Under "Build and deployment": **Source: Deploy from a branch**, branch
   `main`, folder `/ (root)`.
4. Save. GitHub publishes at `https://cristina-radin.github.io/CJD-talentos/`
   (first deploy takes a minute or two).
5. Every `git push` to `main` redeploys automatically.

GitHub Pages on the free plan requires the repo to be **public**. That's
fine here: the repo only contains app code and the Supabase *publishable*
key, which is meant to be public and is protected by RLS — no member data
or secrets live in the repo.

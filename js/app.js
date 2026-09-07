import { requireSession, checkIsAdmin, logout } from './auth.js';
import { initSearch } from './search.js';
import { initProfile } from './profile.js';
import { initAdmin } from './admin.js';
import { initThemeToggle } from './theme.js';
import { supabase } from './supabaseClient.js';

initThemeToggle('theme-toggle-btn');

async function loadWelcomeImages() {
  const bucket = supabase.storage.from('fotos_inicio');
  const { data: files, error: listError } = await bucket.list('', {
    limit: 20,
    sortBy: { column: 'name', order: 'asc' },
  });

  if (listError) {
    console.error('No se pudieron listar las fotos de inicio:', listError.message);
    return;
  }

  const imagePaths = (files ?? [])
    .filter(({ name, id }) => id && /\.(jpe?g|png|webp|gif)$/i.test(name))
    .slice(0, 5)
    .map(({ name }) => name);
  const { data, error } = await bucket.createSignedUrls(imagePaths, 3600);

  if (error) {
    console.error('No se pudieron cargar las fotos de inicio:', error.message);
    return;
  }

  document.querySelectorAll('[data-welcome-image]').forEach((image, index) => {
    const signedUrl = data?.[index]?.signedUrl;
    if (image && signedUrl) {
      image.src = signedUrl;
      image.hidden = false;
    }
  });
}

const viewButtons = document.querySelectorAll('.tab-view-btn');
const views = {
  welcome: document.getElementById('view-welcome'),
  search: document.getElementById('view-search'),
  profile: document.getElementById('view-profile'),
  admin: document.getElementById('view-admin'),
};

function showView(name) {
  Object.entries(views).forEach(([key, el]) => el.classList.toggle('active', key === name));
  viewButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === name));
}

async function main() {
  const session = await requireSession();
  if (!session) return;

  await loadWelcomeImages();

  document.getElementById('user-email').textContent = session.user.email;
  document.getElementById('logout-btn').addEventListener('click', logout);

  const admin = await checkIsAdmin(session.user.email);
  if (admin) document.getElementById('tab-admin-btn').hidden = false;

  // Cada pestaña vuelve a pedir sus datos cada vez que se abre, para no
  // enseñar información desactualizada tras guardar cambios en otra pestaña.
  const refreshers = {
    search: initSearch,
    profile: () => initProfile(session),
    admin: admin ? initAdmin : null,
  };

  viewButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      showView(btn.dataset.view);
      refreshers[btn.dataset.view]?.();
    });
  });

  const goToWelcome = () => {
    showView('welcome');
  };
  const goToSearch = () => {
    showView('search');
    refreshers.search();
  };
  const brandHomeLink = document.getElementById('brand-home-link');
  brandHomeLink.addEventListener('click', goToWelcome);
  brandHomeLink.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      goToWelcome();
    }
  });
  document.getElementById('welcome-search-btn').addEventListener('click', goToSearch);

  initProfile(session);
  if (admin) initAdmin();
}

main();

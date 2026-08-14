import { requireSession, checkIsAdmin, logout } from './auth.js';
import { initSearch } from './search.js';
import { initProfile } from './profile.js';
import { initAdmin } from './admin.js';

const viewButtons = document.querySelectorAll('.tab-view-btn');
const views = {
  search: document.getElementById('view-search'),
  profile: document.getElementById('view-profile'),
  admin: document.getElementById('view-admin'),
};

function showView(name) {
  Object.entries(views).forEach(([key, el]) => el.classList.toggle('active', key === name));
  viewButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === name));
}

viewButtons.forEach((btn) => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

async function main() {
  const session = await requireSession();
  if (!session) return;

  document.getElementById('user-email').textContent = session.user.email;
  document.getElementById('logout-btn').addEventListener('click', logout);

  const admin = await checkIsAdmin(session.user.email);
  if (admin) {
    document.getElementById('tab-admin-btn').hidden = false;
    initAdmin();
  }

  initSearch();
  initProfile(session);
}

main();

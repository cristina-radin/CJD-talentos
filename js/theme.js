const STORAGE_KEY = 'cjd-theme';

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

export function initThemeToggle(buttonId) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  const updateIcon = () => {
    const isDark = currentTheme() === 'dark';
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  };

  updateIcon();

  btn.addEventListener('click', () => {
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    updateIcon();
  });
}

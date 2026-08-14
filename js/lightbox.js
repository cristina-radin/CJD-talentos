let dialogEl = null;

function ensureDialog() {
  if (dialogEl) return dialogEl;
  dialogEl = document.createElement('dialog');
  dialogEl.className = 'lightbox';
  dialogEl.innerHTML = '<img />';
  document.body.appendChild(dialogEl);
  dialogEl.addEventListener('click', () => dialogEl.close());
  return dialogEl;
}

export function openLightbox(url) {
  const dialog = ensureDialog();
  dialog.querySelector('img').src = url;
  dialog.showModal();
}

import { supabase } from './supabaseClient.js';
import { redirectIfLoggedIn } from './auth.js';

redirectIfLoggedIn();

const tabLoginBtn = document.getElementById('tab-login-btn');
const tabSignupBtn = document.getElementById('tab-signup-btn');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');

tabLoginBtn.addEventListener('click', () => {
  tabLoginBtn.classList.add('active');
  tabSignupBtn.classList.remove('active');
  loginForm.style.display = '';
  signupForm.style.display = 'none';
});

tabSignupBtn.addEventListener('click', () => {
  tabSignupBtn.classList.add('active');
  tabLoginBtn.classList.remove('active');
  signupForm.style.display = '';
  loginForm.style.display = 'none';
});

function showMsg(el, text, isError) {
  el.textContent = text;
  el.className = 'msg show ' + (isError ? 'error' : 'ok');
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const msg = document.getElementById('login-msg');
  const submitBtn = document.getElementById('login-submit');

  submitBtn.disabled = true;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  submitBtn.disabled = false;

  if (error) {
    showMsg(msg, 'No se pudo iniciar sesión: ' + error.message, true);
    return;
  }
  window.location.href = 'app.html';
});

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const password2 = document.getElementById('signup-password2').value;
  const groupPassword = document.getElementById('signup-group-password').value;
  const msg = document.getElementById('signup-msg');
  const submitBtn = document.getElementById('signup-submit');

  if (password !== password2) {
    showMsg(msg, 'Las contraseñas no coinciden.', true);
    return;
  }

  submitBtn.disabled = true;

  const { data: groupOk, error: groupError } = await supabase.rpc('check_signup_password', {
    candidate: groupPassword,
  });

  if (groupError || !groupOk) {
    submitBtn.disabled = false;
    showMsg(msg, 'Clave de grupo incorrecta.', true);
    return;
  }

  const { data, error } = await supabase.auth.signUp({ email, password });
  submitBtn.disabled = false;

  if (error) {
    showMsg(msg, 'No se pudo crear la cuenta: ' + error.message, true);
    return;
  }

  if (data.session) {
    // Confirmación de email desactivada en el proyecto: entra directamente.
    window.location.href = 'app.html';
    return;
  }

  showMsg(
    msg,
    'Cuenta creada. Revisa tu correo para confirmar la cuenta antes de iniciar sesión.',
    false
  );
});

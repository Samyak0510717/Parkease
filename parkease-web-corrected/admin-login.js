const form = document.getElementById('loginForm');
const forgotForm = document.getElementById('forgotForm');
const emailInput = document.getElementById('adminEmail');
const passInput = document.getElementById('password');
const toggleBtn = document.getElementById('toggleVisibility');
const submitBtn = document.getElementById('submitBtn');
const statusBanner = document.getElementById('statusBanner');
const emailError = document.getElementById('emailError');
const passError = document.getElementById('passError');

function setError(input, errorEl, message) {
  input.classList.add('err');
  errorEl.textContent = message;
  errorEl.classList.add('show');
}
function clearError(input, errorEl) {
  input.classList.remove('err');
  errorEl.classList.remove('show');
}
function showBanner(type, message) {
  statusBanner.className = `status-banner show ${type}`;
  statusBanner.textContent = message;
}
function clearBanner() {
  statusBanner.className = 'status-banner';
}
function isValidGmail(value) {
  const clean = value.trim().toLowerCase();
  return clean === 'admin' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(clean);
}
function validate() {
  let valid = true;
  if (!isValidGmail(emailInput.value)) {
    setError(emailInput, emailError, 'Enter a valid Gmail address.');
    valid = false;
  } else clearError(emailInput, emailError);
  if (passInput.value.length < 6) {
    setError(passInput, passError, 'Password must be at least 6 characters.');
    valid = false;
  } else clearError(passInput, passError);
  return valid;
}
function isValidNepaliPhone(value) {
  return /^(97|98)\d{8}$/.test(value.trim());
}

toggleBtn.addEventListener('click', () => {
  passInput.type = passInput.type === 'password' ? 'text' : 'password';
  toggleBtn.textContent = passInput.type === 'password' ? 'Show' : 'Hide';
});
emailInput.addEventListener('input', () => clearError(emailInput, emailError));
passInput.addEventListener('input', () => clearError(passInput, passError));
document.getElementById('forgotLink').addEventListener('click', (event) => {
  event.preventDefault();
  form.hidden = true;
  forgotForm.hidden = false;
  clearBanner();
  document.getElementById('forgotPhoneInput').focus();
});
document.getElementById('backToLoginBtn').addEventListener('click', () => {
  forgotForm.hidden = true;
  form.hidden = false;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearBanner();
  if (!validate()) {
    showBanner('error', 'Please fix the highlighted fields.');
    return;
  }
  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Signing in…';
  let res;
  try {
    res = await ParkEaseAPI.adminLogin(emailInput.value.trim().toLowerCase(), passInput.value);
  } catch {
    res = { success: false, message: 'Unable to connect. Please try again.' };
  }
  submitBtn.disabled = false;
  submitBtn.innerHTML = 'Log in <span>→</span>';
  if (!res.success) {
    showBanner('error', res.message || 'Incorrect Gmail address or password.');
    return;
  }
  localStorage.setItem('parkease_admin_token', res.token);
  if (document.getElementById('rememberMe').checked) localStorage.setItem('parkease_admin_remember', '1');
  window.location.href = 'admin-dashboard.html';
});

forgotForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.getElementById('forgotPhoneInput');
  const error = document.getElementById('forgotPhoneError');
  error.classList.remove('show');
  input.classList.remove('err');
  if (!isValidNepaliPhone(input.value)) {
    input.classList.add('err');
    error.textContent = 'Use a valid 10-digit number starting with 97 or 98.';
    error.classList.add('show');
    return;
  }
  const button = document.getElementById('forgotSubmitBtn');
  const forgotStatusBanner = document.getElementById('forgotStatusBanner');
  button.disabled = true;
  button.textContent = 'Sending request…';
  const res = await ParkEaseAPI.requestPasswordReset(input.value.trim());
  button.disabled = false;
  button.textContent = 'Request reset';
  forgotStatusBanner.className = `status-banner show ${res.success ? 'info' : 'error'}`;
  forgotStatusBanner.textContent = res.message || 'Unable to send the reset request.';
});
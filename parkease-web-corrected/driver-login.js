const form = document.getElementById('userAuthForm');
const forgotForm = document.getElementById('forgotForm');
const loginModeBtn = document.getElementById('loginModeBtn');
const registerModeBtn = document.getElementById('registerModeBtn');
const registerNameField = document.getElementById('registerNameField');
const registerPhoneField = document.getElementById('registerPhoneField');
const confirmPasswordField = document.getElementById('confirmPasswordField');
const fullNameInput = document.getElementById('fullNameInput');
const emailInput = document.getElementById('emailInput');
const phoneInput = document.getElementById('phoneInput');
const passwordInput = document.getElementById('passwordInput');
const confirmPasswordInput = document.getElementById('confirmPasswordInput');
const submitBtn = document.getElementById('submitBtn');
const statusBanner = document.getElementById('statusBanner');
const authTitle = document.getElementById('authTitle');
const authLede = document.getElementById('authLede');
let isRegistering = false;

const fields = {
  name: [fullNameInput, document.getElementById('nameError')],
  email: [emailInput, document.getElementById('emailError')],
  phone: [phoneInput, document.getElementById('phoneError')],
  password: [passwordInput, document.getElementById('passwordError')],
  confirm: [confirmPasswordInput, document.getElementById('confirmPasswordError')],
};

function showError(key, message) {
  const [input, error] = fields[key];
  input.classList.add('err');
  error.textContent = message;
  error.classList.add('show');
}
function clearError(key) {
  const [input, error] = fields[key];
  input.classList.remove('err');
  error.classList.remove('show');
}
function showBanner(type, message) {
  statusBanner.className = `status-banner show ${type}`;
  statusBanner.textContent = message;
}
function clearBanner() {
  statusBanner.className = 'status-banner';
}
function setMode(register) {
  isRegistering = register;
  loginModeBtn.classList.toggle('active', !register);
  registerModeBtn.classList.toggle('active', register);
  loginModeBtn.setAttribute('aria-selected', String(!register));
  registerModeBtn.setAttribute('aria-selected', String(register));
  registerNameField.hidden = !register;
  registerPhoneField.hidden = !register;
  confirmPasswordField.hidden = !register;
  authTitle.textContent = register ? 'Create your account' : 'Welcome back';
  authLede.textContent = register
    ? 'Start your account and find a parking space in under a minute.'
    : 'Sign in with Gmail to find parking and manage bookings.';
  submitBtn.innerHTML = `${register ? 'Create account' : 'Log in'} <span>→</span>`;
  ['name', 'email', 'phone', 'password', 'confirm'].forEach(clearError);
  clearBanner();
}
function isValidGmail(value) {
  return /^[^\s@]+@gmail\.com$/i.test(value.trim());
}
function isValidNepaliPhone(value) {
  return /^(97|98)\d{8}$/.test(value.trim());
}
function validate() {
  let valid = true;
  if (isRegistering && fullNameInput.value.trim().length < 2) {
    showError('name', 'Enter your full name.');
    valid = false;
  } else clearError('name');
  if (!isValidGmail(emailInput.value)) {
    showError('email', 'Enter a valid Gmail address.');
    valid = false;
  } else clearError('email');
  if (isRegistering && !isValidNepaliPhone(phoneInput.value)) {
    showError('phone', 'Use a valid 10-digit number starting with 97 or 98.');
    valid = false;
  } else clearError('phone');
  if (passwordInput.value.length < 6) {
    showError('password', 'Password must be at least 6 characters.');
    valid = false;
  } else clearError('password');
  if (isRegistering && confirmPasswordInput.value !== passwordInput.value) {
    showError('confirm', 'Passwords do not match.');
    valid = false;
  } else clearError('confirm');
  return valid;
}
function togglePassword(input, button) {
  input.type = input.type === 'password' ? 'text' : 'password';
  button.textContent = input.type === 'password' ? 'Show' : 'Hide';
}

loginModeBtn.addEventListener('click', () => setMode(false));
registerModeBtn.addEventListener('click', () => setMode(true));
Object.entries(fields).forEach(([key, [input]]) => input.addEventListener('input', () => clearError(key)));
document.getElementById('togglePassword').addEventListener('click', (event) => togglePassword(passwordInput, event.currentTarget));
document.getElementById('toggleConfirmPassword').addEventListener('click', (event) => togglePassword(confirmPasswordInput, event.currentTarget));
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
  submitBtn.innerHTML = `${isRegistering ? 'Creating account' : 'Signing in'}…`;
  let res;
  try {
    res = isRegistering
      ? await ParkEaseAPI.userRegister(fullNameInput.value.trim(), emailInput.value.trim().toLowerCase(), phoneInput.value.trim(), passwordInput.value)
      : await ParkEaseAPI.userLogin(emailInput.value.trim().toLowerCase(), passwordInput.value);
  } catch {
    res = { success: false, message: 'Unable to connect. Please try again.' };
  }
  submitBtn.disabled = false;
  submitBtn.innerHTML = `${isRegistering ? 'Create account' : 'Log in'} <span>→</span>`;
  if (!res.success) {
    showBanner('error', res.message || 'Unable to complete this request.');
    return;
  }
  localStorage.setItem('parkease_token', res.token);
  localStorage.setItem('parkease_email', res.user.email);
  localStorage.setItem('parkease_phone', res.user.phone || '');
  if (res.user.name) localStorage.setItem('parkease_name', res.user.name);
  window.location.href = 'driver-dashboard.html';
});

document.getElementById('forgotForm').addEventListener('submit', async (event) => {
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
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
  if (input && error) {
    input.classList.add('err');
    error.textContent = message;
    error.classList.add('show');
  }
}

function clearError(key) {
  const [input, error] = fields[key];
  if (input && error) {
    input.classList.remove('err');
    error.classList.remove('show');
  }
}

function showBanner(type, message) {
  statusBanner.className = `status-banner show ${type}`;
  statusBanner.textContent = message;
}

function clearBanner() {
  statusBanner.className = 'status-banner';
}

const registerOtpField = document.getElementById('registerOtpField');
const registerOtpInput = document.getElementById('registerOtpInput');
const resendRegisterOtpLink = document.getElementById('resendRegisterOtpLink');
let otpSentForEmail = '';

const redirectTarget = new URLSearchParams(window.location.search).get('redirect') || 'driver-dashboard.html';

fields.otp = [registerOtpInput, document.getElementById('otpError')];

function setMode(register) {
  isRegistering = register;
  loginModeBtn.classList.toggle('active', !register);
  registerModeBtn.classList.toggle('active', register);
  loginModeBtn.setAttribute('aria-selected', String(!register));
  registerModeBtn.setAttribute('aria-selected', String(register));
  registerNameField.hidden = !register;
  registerPhoneField.hidden = !register;
  confirmPasswordField.hidden = !register;
  if (registerOtpField) registerOtpField.hidden = true;
  otpSentForEmail = '';

  authTitle.textContent = register ? 'Create your account' : 'Welcome back';
  authLede.textContent = register
    ? 'Register with your real Gmail address to reserve slots and receive tokens.'
    : 'Sign in with your Gmail to find parking and manage bookings.';
  submitBtn.innerHTML = `${register ? 'Send OTP & Register' : 'Log in'} <span>→</span>`;
  ['name', 'email', 'phone', 'password', 'confirm', 'otp'].forEach(clearError);
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
    showError('email', 'Enter a valid Gmail address (must end with @gmail.com).');
    valid = false;
  } else clearError('email');

  if (isRegistering && !isValidNepaliPhone(phoneInput.value)) {
    showError('phone', 'Use a valid 10-digit mobile number starting with 97 or 98.');
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

  if (isRegistering && registerOtpField && !registerOtpField.hidden) {
    if (!registerOtpInput.value || registerOtpInput.value.trim().length < 6) {
      showError('otp', 'Enter the 6-digit OTP code sent to your Gmail.');
      valid = false;
    } else clearError('otp');
  }

  return valid;
}

if (resendRegisterOtpLink) {
  resendRegisterOtpLink.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim().toLowerCase();
    if (!isValidGmail(email)) {
      showError('email', 'Enter a valid Gmail address first.');
      return;
    }
    showBanner('success', 'Sending new OTP to ' + email + '…');
    const res = await ParkEaseAPI.sendGmailOTP(email, 'register');
    if (res.success) {
      otpSentForEmail = email;
      showBanner('success', res.message || 'OTP resent successfully to ' + email);
    } else {
      showBanner('error', res.message || 'Could not send OTP.');
    }
  });
}

function togglePassword(input, button) {
  input.type = input.type === 'password' ? 'text' : 'password';
  button.textContent = input.type === 'password' ? 'Show' : 'Hide';
}

loginModeBtn.addEventListener('click', () => setMode(false));
registerModeBtn.addEventListener('click', () => setMode(true));
Object.entries(fields).forEach(([key, [input]]) => {
  if (input) input.addEventListener('input', () => clearError(key));
});

document.getElementById('togglePassword').addEventListener('click', (event) => togglePassword(passwordInput, event.currentTarget));
document.getElementById('toggleConfirmPassword').addEventListener('click', (event) => togglePassword(confirmPasswordInput, event.currentTarget));

document.getElementById('forgotLink').addEventListener('click', (event) => {
  event.preventDefault();
  form.hidden = true;
  forgotForm.hidden = false;
  clearBanner();
  document.getElementById('forgotEmailInput').focus();
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

  const email = emailInput.value.trim().toLowerCase();

  // If registering and OTP hasn't been sent yet, request OTP first
  if (isRegistering && registerOtpField && registerOtpField.hidden) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Sending OTP to Gmail…';
    try {
      const otpRes = await ParkEaseAPI.sendGmailOTP(email, 'register');
      submitBtn.disabled = false;
      if (!otpRes.success) {
        showBanner('error', otpRes.message || 'Could not send OTP to your Gmail. Please try again.');
        submitBtn.innerHTML = 'Send OTP & Register <span>→</span>';
        return;
      }
      otpSentForEmail = email;
      registerOtpField.hidden = false;
      registerOtpInput.focus();
      submitBtn.innerHTML = 'Verify OTP & Complete Registration <span>→</span>';
      showBanner('success', otpRes.message || `A 6-digit verification code was sent to ${email}.`);
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Send OTP & Register <span>→</span>';
      showBanner('error', 'Failed to send OTP. Please check your connection.');
    }
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `${isRegistering ? 'Verifying & creating account' : 'Signing in'}…`;
  let res;
  try {
    const otpCode = registerOtpInput ? registerOtpInput.value.trim() : '';
    res = isRegistering
      ? await ParkEaseAPI.userRegister(
          fullNameInput.value.trim(),
          email,
          phoneInput.value.trim(),
          passwordInput.value,
          otpCode
        )
      : await ParkEaseAPI.userLogin(email, passwordInput.value);
  } catch {
    res = { success: false, message: 'Unable to connect. Please try again.' };
  }
  submitBtn.disabled = false;
  submitBtn.innerHTML = `${isRegistering ? 'Complete Registration' : 'Log in'} <span>→</span>`;
  if (!res.success) {
    showBanner('error', res.message || 'Unable to complete this request.');
    return;
  }
  localStorage.setItem('parkease_token', res.token);
  localStorage.setItem('parkease_email', res.user.email);
  localStorage.setItem('parkease_phone', res.user.phone || '');
  if (res.user.name) localStorage.setItem('parkease_name', res.user.name);
  window.location.href = redirectTarget;
});

// Forgot Password Flow
const forgotEmailInput = document.getElementById('forgotEmailInput');
const sendForgotOtpBtn = document.getElementById('sendForgotOtpBtn');
const forgotOtpStep = document.getElementById('forgotOtpStep');
const forgotOtpInput = document.getElementById('forgotOtpInput');
const forgotNewPasswordInput = document.getElementById('forgotNewPasswordInput');
const forgotSubmitBtn = document.getElementById('forgotSubmitBtn');
const forgotStatusBanner = document.getElementById('forgotStatusBanner');
const toggleForgotNewPassword = document.getElementById('toggleForgotNewPassword');

if (toggleForgotNewPassword) {
  toggleForgotNewPassword.addEventListener('click', (event) => togglePassword(forgotNewPasswordInput, event.currentTarget));
}

sendForgotOtpBtn.addEventListener('click', async () => {
  forgotStatusBanner.className = 'status-banner';
  const email = forgotEmailInput.value.trim();
  if (!isValidGmail(email)) {
    document.getElementById('forgotEmailError').textContent = 'Enter a valid Gmail address.';
    document.getElementById('forgotEmailError').classList.add('show');
    forgotEmailInput.classList.add('err');
    return;
  }
  document.getElementById('forgotEmailError').classList.remove('show');
  forgotEmailInput.classList.remove('err');

  sendForgotOtpBtn.disabled = true;
  sendForgotOtpBtn.textContent = 'Sending OTP…';
  const res = await ParkEaseAPI.sendGmailOTP(email.toLowerCase(), 'reset_password');
  sendForgotOtpBtn.disabled = false;
  sendForgotOtpBtn.textContent = 'Send Gmail OTP';

  if (res.success) {
    forgotStatusBanner.className = 'status-banner show info';
    forgotStatusBanner.textContent = res.message;
    forgotOtpStep.hidden = false;
    sendForgotOtpBtn.hidden = true;
    forgotSubmitBtn.hidden = false;
  } else {
    forgotStatusBanner.className = 'status-banner show error';
    forgotStatusBanner.textContent = res.message || 'Failed to send OTP code.';
  }
});

document.getElementById('resendForgotOtpLink').addEventListener('click', async (e) => {
  e.preventDefault();
  sendForgotOtpBtn.click();
});

forgotForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  forgotStatusBanner.className = 'status-banner';
  const email = forgotEmailInput.value.trim().toLowerCase();
  const code = forgotOtpInput.value.trim();
  const newPassword = forgotNewPasswordInput.value;

  if (!/^\d{6}$/.test(code)) {
    document.getElementById('forgotOtpError').textContent = 'Enter the 6-digit OTP code.';
    document.getElementById('forgotOtpError').classList.add('show');
    return;
  }
  document.getElementById('forgotOtpError').classList.remove('show');

  if (newPassword.length < 6) {
    document.getElementById('forgotNewPasswordError').textContent = 'Password must be at least 6 characters.';
    document.getElementById('forgotNewPasswordError').classList.add('show');
    return;
  }
  document.getElementById('forgotNewPasswordError').classList.remove('show');

  forgotSubmitBtn.disabled = true;
  forgotSubmitBtn.textContent = 'Resetting password…';

  const res = await ParkEaseAPI.requestPasswordReset(email, code, newPassword);

  forgotSubmitBtn.disabled = false;
  forgotSubmitBtn.textContent = 'Reset Password';

  if (res.success) {
    forgotStatusBanner.className = 'status-banner show info';
    forgotStatusBanner.textContent = res.message;
    setTimeout(() => {
      forgotForm.hidden = true;
      form.hidden = false;
      setMode(false);
    }, 2000);
  } else {
    forgotStatusBanner.className = 'status-banner show error';
    forgotStatusBanner.textContent = res.message || 'Password reset failed.';
  }
});
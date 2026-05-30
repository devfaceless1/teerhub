const stepPages = document.querySelectorAll('.step-page');
const stepIndicators = document.querySelectorAll('.step-indicator .step');
const roleNextBtn = document.getElementById('roleNextBtn');
const detailsForm = document.getElementById('detailsForm');
const detailsHint = document.getElementById('detailsHint');
const goLoginBtn = document.getElementById('goLoginBtn');
const backButtons = document.querySelectorAll('.step-back');
const passwordRequirementsEl = document.getElementById('passwordRequirements');
const confirmFeedback = document.getElementById('confirmFeedback');

const passwordRules = [
  { key: 'length', label: '8 символів', test: value => value.length >= 8 },
  { key: 'uppercase', label: 'одну велику літеру', test: value => /[A-ZА-ЯІЇЄ]/.test(value) },
  { key: 'lowercase', label: 'одну малу літеру', test: value => /[a-zа-яіїє]/.test(value) },
  { key: 'digit', label: 'одну цифру', test: value => /[0-9]/.test(value) },
  { key: 'symbol', label: 'один спецсимвол', test: value => /[!@#\$%\^&*(),.?":{}|<>]/.test(value) },
];

function updatePasswordRequirements() {
  const passwordInput = detailsForm?.querySelector('input[name="password"]');
  const confirmPasswordInput = detailsForm?.querySelector('input[name="confirmPassword"]');
  const submitButton = detailsForm?.querySelector('button[type="submit"]');
  const passwordValue = passwordInput?.value || '';
  const confirmValue = confirmPasswordInput?.value || '';

  if (!passwordRequirementsEl) return;
  let allValid = true;

  passwordRules.forEach(rule => {
    const item = passwordRequirementsEl.querySelector(`li[data-key="${rule.key}"]`);
    const valid = rule.test(passwordValue);
    if (item) {
      item.classList.toggle('valid', valid);
      item.classList.toggle('invalid', !valid);
      item.querySelector('span')?.setAttribute('aria-hidden', 'true');
    }
    if (!valid) allValid = false;
  });

  if (confirmFeedback) {
    if (!confirmValue) {
      confirmFeedback.textContent = '';
      confirmFeedback.classList.remove('valid', 'invalid');
    } else if (passwordValue === confirmValue) {
      confirmFeedback.textContent = 'Паролі збігаються';
      confirmFeedback.classList.add('valid');
      confirmFeedback.classList.remove('invalid');
    } else {
      confirmFeedback.textContent = 'Паролі не збігаються';
      confirmFeedback.classList.add('invalid');
      confirmFeedback.classList.remove('valid');
    }
  }

  if (submitButton) {
    submitButton.disabled = !allValid || !passwordValue || !confirmValue || passwordValue !== confirmValue;
  }
}

function passwordMeetsRequirements(password) {
  return passwordRules.every(rule => rule.test(password));
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let currentStep = 0;
let registrationData = {};

function setRolePlaceholders(role) {
  const nameInput = detailsForm.querySelector('input[name="name"]');
  const phoneInput = detailsForm.querySelector('input[name="phone"]');
  const motivationTextarea = detailsForm.querySelector('textarea[name="motivation"]');

  if (role === 'organization') {
    nameInput.placeholder = 'Назва організації або компанії';
    phoneInput.placeholder = 'Контактний телефон організації (опційно)';
    motivationTextarea.placeholder = 'Коротко про діяльність або потреби організації (опційно)';
    detailsHint.textContent = 'Вкажіть назву, email, пароль і контактні дані для організації.';
  } else {
    nameInput.placeholder = 'Ваше ім’я та прізвище';
    phoneInput.placeholder = 'Ваш контактний телефон (опційно)';
    motivationTextarea.placeholder = 'Розкажіть, чому хочете допомагати і в чому ваша сила (опційно)';
    detailsHint.textContent = 'Вкажіть свої дані, щоб ми допомогли підібрати відповідні волонтерські можливості.';
  }
}

function showStep(index) {
  currentStep = index;
  stepPages.forEach((page, idx) => page.classList.toggle('active', idx === index));
  stepIndicators.forEach((indicator, idx) => indicator.classList.toggle('active', idx === index));
}

function getToastContainer() {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

function showToast(message, type = 'success', title = '') {
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;

  if (title) {
    const titleEl = document.createElement('div');
    titleEl.className = 'toast__title';
    titleEl.textContent = escapeHtml(title);
    toast.appendChild(titleEl);
  }

  const messageEl = document.createElement('div');
  messageEl.className = 'toast__message';
  messageEl.textContent = escapeHtml(message);
  toast.appendChild(messageEl);

  container.appendChild(toast);

  const removeToast = () => {
    if (toast.classList.contains('hide')) return;
    toast.classList.add('hide');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  toast.addEventListener('click', removeToast);
  setTimeout(removeToast, 4000);
}

function handleBack(event) {
  const backTarget = Number(event.currentTarget.dataset.back);
  showStep(backTarget);
}

if (roleNextBtn) {
  roleNextBtn.addEventListener('click', () => {
    const selectedRole = document.querySelector('input[name="role"]:checked');
    if (!selectedRole) return showToast('Оберіть тип облікового запису', 'error', 'Увага');
    registrationData.role = selectedRole.value;
    setRolePlaceholders(selectedRole.value);
    showStep(1);
  });
}

if (detailsForm) {
  detailsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(detailsForm));
    const email = values.email && values.email.trim().toLowerCase();
    const password = values.password;
    const confirmPassword = values.confirmPassword;

    if (!values.name || !email || !password || !confirmPassword) {
      return showToast('Заповніть усі обов’язкові поля', 'error', 'Увага');
    }
    if (!passwordMeetsRequirements(password)) {
      return showToast('Пароль не відповідає вимогам безпеки', 'error', 'Увага');
    }
    if (password !== confirmPassword) {
      return showToast('Паролі не співпадаються', 'error', 'Увага');
    }

    registrationData = {
      ...registrationData,
      name: values.name,
      email,
      password,
      phone: values.phone || undefined,
      motivation: values.motivation || undefined,
    };

    try {
      const res = await fetch('/api/auth/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationData)
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Не вдалося завершити реєстрацію', 'error', 'Помилка');
        return;
      }
      showToast(data.message || 'Реєстрацію успішно створено', 'success', 'Готово');
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (loginRes.ok) {
        const loginData = await loginRes.json();
        if (loginData.token) {
          localStorage.setItem('teerhub_token', loginData.token);
          window.location.href = '/dashboard';
          return;
        }
      }
      showStep(2);
      showToast('Реєстрація пройшла, але автоматичний вхід не вдалося виконати', 'error', 'Увага');
    } catch (err) {
      console.error(err);
      showToast('Серверна помилка при створенні аккаунту', 'error', 'Помилка');
    }
  });

  const passwordInput = detailsForm.querySelector('input[name="password"]');
  const confirmPasswordInput = detailsForm.querySelector('input[name="confirmPassword"]');

  passwordInput?.addEventListener('input', updatePasswordRequirements);
  confirmPasswordInput?.addEventListener('input', updatePasswordRequirements);
  updatePasswordRequirements();
}

// Verification step removed — registration completes directly after details form.

// resend code not used

backButtons.forEach(button => button.addEventListener('click', handleBack));

if (goLoginBtn) {
  goLoginBtn.addEventListener('click', () => {
    window.location.href = '/login';
  });
}

const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(loginForm));
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const body = await res.json();
      if (res.ok) {
        if (body.token) localStorage.setItem('teerhub_token', body.token);
        showToast('Успішно увійшли', 'success', 'Вітаємо');
        window.location.href = '/dashboard';
      } else {
        showToast(body.message || 'Невірні дані', 'error', 'Помилка');
      }
    } catch (err) {
      console.error(err);
      showToast('Серверна помилка', 'error', 'Помилка');
    }
  });
}

showStep(0);

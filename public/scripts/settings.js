let token = localStorage.getItem('teerhub_token');

// =========================
// AUTH REDIRECT
// =========================

function redirectToLogin() {
  logoutAndDestroySession();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
    titleEl.textContent = title;
    toast.appendChild(titleEl);
  }

  const messageEl = document.createElement('div');
  messageEl.className = 'toast__message';
  messageEl.textContent = message;
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

// Check session if no token
(async () => {
  if (!token) {
    const session = await checkSessionAndRestoreToken();
    if (!session.loggedIn) {
      redirectToLogin();
    } else {
      token = session.token;
    }
  }
})();

const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const profileCreatedAt = document.getElementById('profileCreatedAt');
const roleBadge = document.getElementById('roleBadge');
const editNameBtn = document.getElementById('editNameBtn');
const toggleEmailBtn = document.getElementById('toggleEmailBtn');
const settingsActions = document.getElementById('settingsActions');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const discardSettingsBtn = document.getElementById('discardSettingsBtn');
const settingsSaveMsg = document.getElementById('settingsSaveMsg');

let originalName = '';
let originalShowEmail = true;
let originalEmail = '';
let currentName = '';
let currentShowEmail = true;
let editingInput = null;
let unsaved = false;

function updateEmailToggleIcon(show) {
  if (!toggleEmailBtn) return;
  const icon = show
    ? `<svg viewBox="0 0 24 24" class="icon icon-eye" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`
    : `<svg viewBox="0 0 24 24" class="icon icon-eye-off" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 8l8 8M16 8l-8 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  toggleEmailBtn.innerHTML = icon;
  toggleEmailBtn.setAttribute('aria-label', show ? 'Приховати email від інших користувачів' : 'Показати email іншим користувачам');
  const statusLabel = document.getElementById('emailStatusLabel');
  if (statusLabel) statusLabel.textContent = show ? 'Публічно видно' : 'Публічно приховано';
}

const vacanciesList = document.getElementById('vacanciesList');
const openVacancyModalBtn = document.getElementById('openVacancyModalBtn');
const closeVacancyModalBtn = document.getElementById('closeVacancyModalBtn');
const vacancyModal = document.getElementById('vacancyModal');
const confirmModal = document.getElementById('confirmModal');
const confirmMessageEl = document.getElementById('confirmMessage');
const confirmOkBtn = document.getElementById('confirmOkBtn');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
const vacancyWizard = document.getElementById('vacancyWizard');
const wizardBackBtn = document.getElementById('wizardBackBtn');
const wizardNextBtn = document.getElementById('wizardNextBtn');
const wizardSubmitBtn = document.getElementById('wizardSubmitBtn');
const selectedTagsContainer = document.getElementById('selectedTagsContainer');
const popularTagButtons = Array.from(document.querySelectorAll('.tag-chip'));
const customTagInput = document.getElementById('customTagInput');
const addCustomTagBtn = document.getElementById('addCustomTagBtn');
const vacancyError = document.getElementById('vacancyError');

const logoutBtn = document.getElementById('logoutBtn');

// =========================
// API WRAPPER
// =========================

async function requestApi(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    if (res.status === 401) redirectToLogin();

    let errMessage = 'Помилка запиту';
    try {
      const errBody = await res.json();
      if (errBody && errBody.message) errMessage = errBody.message;
    } catch (jsonErr) {
      const text = await res.text().catch(() => '');
      if (text) errMessage = text;
    }

    throw new Error(errMessage || `Помилка запиту (${res.status})`);
  }

  return res.json();
}

// =========================
// FORMAT DATE
// =========================

function formatDate(dateString) {
  return new Intl.DateTimeFormat('uk-UA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dateString));
}

// =========================
// PROFILE
// =========================

function updateProgramState(user) {
  // Set text and add a role-specific class for styling (volunteer=green, organization/company=blue)
  // Clear existing role classes first
  roleBadge.classList.remove('organization', 'company', 'volunteer');
  if (user.role === 'volunteer') {
    roleBadge.textContent = 'Волонтер';
    roleBadge.classList.add('volunteer');
  } else if (user.role === 'organization') {
    roleBadge.textContent = 'Організація';
    roleBadge.classList.add('organization');
  } else if (user.role === 'company') {
    roleBadge.textContent = 'Компанія';
    roleBadge.classList.add('company');
  } else {
    roleBadge.textContent = user.role;
  }

    // initialize local state for inline editing
    originalName = user.name || '';
    originalShowEmail = typeof user.showEmail === 'undefined' ? true : !!user.showEmail;
    currentName = originalName;
    currentShowEmail = originalShowEmail;
    // render email visibility icon and values
    updateEmailToggleIcon(currentShowEmail);
    originalEmail = user.email || '';
    if (profileEmail) profileEmail.textContent = currentShowEmail ? (originalEmail || '–') : 'Приховано';

  // Update page header to reflect role
  const heroH1 = document.querySelector('.hero-copy h1');
  if (heroH1) {
    if (user.role === 'volunteer') heroH1.textContent = 'Ваш кабінет волонтера у сучасному вигляді';
    else heroH1.textContent = 'Кабінет організації — керуйте оголошеннями та контактами';
  }
}

// =========================
// RENDER VACANCIES
// =========================

function renderVacancies(vacancies = []) {
  if (!vacanciesList) return;

  if (!vacancies.length) {
    vacanciesList.innerHTML = '<p class="empty-state">Поки що немає вакансій.</p>';
    return;
  }

  vacanciesList.innerHTML = vacancies.map(v => {
    const creatorClass = (v.creatorRole === 'organization' || v.creatorRole === 'company') ? 'org' : 'vol';
    const creatorLabel = creatorClass === 'org' ? 'Організація' : 'Волонтер';
    const safeTitle = escapeHtml(v.title || '');
    const safeDescription = escapeHtml(v.description || '');
    const safeLocation = escapeHtml(v.location || '');
    const safeStatus = v.status === 'open' ? 'open' : 'closed';
    const safeStatusLabel = v.status === 'open' ? 'Відкрита' : 'Закрита';
    const safeTags = (v.tags || []).map(tag => `<span>${escapeHtml(tag)}</span>`).join('');
    const safeId = encodeURIComponent(v._id || '');
    const previewText = safeDescription.length > 80 ? `${safeDescription.slice(0, 80)}…` : safeDescription;

    return `
    <article class="vacancy-card">
      <div class="vacancy-summary">
        <div>
          <strong>${safeTitle}</strong>
          <div class="vacancy-summary-meta">
            <span class="status-badge ${safeStatus}">${escapeHtml(safeStatusLabel)}</span>
            ${v.location ? `<span class="vacancy-meta">📍 ${safeLocation}</span>` : ''}
          </div>
          <p class="vacancy-snippet">${previewText || 'Опис відсутній.'}</p>
        </div>
        <button type="button" class="btn btn-secondary btn-expand" data-id="${safeId}" aria-expanded="false" aria-controls="vacancy-details-${safeId}">
          <span class="expand-text">Відкрити більше</span>
          <span class="expand-arrow">›</span>
        </button>
      </div>
      <div class="vacancy-details" id="vacancy-details-${safeId}">
        <p class="vacancy-full-description">${safeDescription || 'Опис відсутній.'}</p>
        ${v.location ? `<p class="vacancy-meta">📍 ${safeLocation}</p>` : ''}
        <small>${formatDate(v.createdAt)}</small>
        ${v.tags?.length ? `<div class="vacancy-tags">${safeTags}</div>` : ''}
        <div class="vacancy-actions">
          <button type="button" class="btn btn-secondary btn-edit" data-id="${safeId}">Редагувати</button>
          <button type="button" class="btn btn-primary btn-toggle" data-id="${safeId}" data-status="${escapeHtml(v.status || '')}">${escapeHtml(v.status === 'open' ? 'Закрити вакансію' : 'Відкрити вакансію')}</button>
          <button type="button" class="btn btn-ghost btn-delete" data-id="${safeId}">Видалити</button>
        </div>
      </div>
    </article>
  `}).join('');

  attachVacancyButtons();
}

function attachVacancyButtons() {
  // Edit
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = btn.dataset.id;
      try {
        const res = await requestApi(`/api/user/vacancies`);
        const list = res.vacancies || [];
        const vacancy = list.find(x => x._id === id || x.id === id);
        if (!vacancy) {
          // try fetching single vacancy from public endpoint
          showToast('Вакансію не знайдено', 'error', 'Увага');
          return;
        }
        openVacancyModal(vacancy);
      } catch (err) {
        showToast(err.message || 'Помилка', 'error', 'Увага');
      }
    });
  });

  // Delete
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = btn.dataset.id;
      const ok = await showConfirm('Ви впевнені, що хочете видалити цю вакансію?');
      if (!ok) return;
      try {
        await requestApi(`/api/user/vacancies/${id}`, { method: 'DELETE' });
        loadProfile();
      } catch (err) {
        showToast(err.message || 'Помилка', 'error', 'Увага');
      }
    });
  });

  document.querySelectorAll('.btn-expand').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.vacancy-card');
      if (!card) return;

      const expanded = card.classList.toggle('expanded');
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      btn.querySelector('.expand-text').textContent = expanded ? 'Закрити' : 'Відкрити більше';

      if (expanded) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  });

  // Toggle open/closed
  document.querySelectorAll('.btn-toggle').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = btn.dataset.id;
      if (!id) return;

      const originalText = btn.textContent;
      const currentStatus = btn.dataset.status;
      const card = btn.closest('.vacancy-card');
      const statusBadge = card?.querySelector('.status-badge');

      btn.disabled = true;
      btn.textContent = 'Зачекайте...';

      try {
        await requestApi(`/api/user/vacancies/${id}/toggle`, { method: 'POST' });

        const newStatus = currentStatus === 'open' ? 'closed' : 'open';
        btn.dataset.status = newStatus;
        btn.textContent = newStatus === 'open' ? 'Закрити вакансію' : 'Відкрити вакансію';

        if (statusBadge) {
          statusBadge.textContent = newStatus === 'open' ? 'Відкрита' : 'Закрита';
          statusBadge.className = `status-badge ${newStatus === 'open' ? 'open' : 'closed'}`;
        }
      } catch (err) {
        showToast(err.message || 'Помилка', 'error', 'Увага');
        btn.textContent = originalText;
      } finally {
        btn.disabled = false;
      }
    });
  });
}

// Confirmation modal helper
function showConfirm(message) {
  return new Promise((resolve) => {
    if (!confirmModal) return resolve(false);
    confirmMessageEl.textContent = message;
    confirmModal.classList.remove('hidden');
    confirmModal.setAttribute('aria-hidden', 'false');

    const clean = () => {
      confirmModal.classList.add('hidden');
      confirmModal.setAttribute('aria-hidden', 'true');
      confirmOkBtn.classList.remove('danger');
      confirmOkBtn.removeEventListener('click', onOk);
      confirmCancelBtn.removeEventListener('click', onCancel);
      confirmModal.removeEventListener('click', onOverlayClick);
      document.removeEventListener('keydown', onKey);
    };

    const onOk = () => {
      clean();
      resolve(true);
    };

    const onCancel = () => {
      clean();
      resolve(false);
    };

    const onOverlayClick = (e) => {
      if (e.target === confirmModal) onCancel();
    };

    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onOk();
    };

    // style ok button as danger
    confirmOkBtn.classList.add('danger');
    confirmOkBtn.addEventListener('click', onOk);
    confirmCancelBtn.addEventListener('click', onCancel);
    confirmModal.addEventListener('click', onOverlayClick);
    document.addEventListener('keydown', onKey);
  });
}

// =========================
// LOAD PROFILE
// =========================

async function loadProfile() {
  try {
    const { user } = await requestApi('/api/user/me');

    profileName.textContent = user.name || 'Не вказано';
    // createdAt may be missing for some API responses; guard formatting
    if (user.createdAt) {
      try {
        profileCreatedAt.textContent = formatDate(user.createdAt);
      } catch (e) {
        profileCreatedAt.textContent = '–';
      }
    } else {
      profileCreatedAt.textContent = '–';
    }

    updateProgramState(user);

    const vacancies = await requestApi('/api/user/vacancies');
    renderVacancies(vacancies.vacancies || []);
    
      // Load saved vacancies
      try {
        const savedRes = await requestApi('/api/user/saved');
        const saved = savedRes.saved || [];
        const savedListEl = document.getElementById('savedList');
        if (savedListEl) {
          if (!saved.length) {
            savedListEl.innerHTML = '<p class="empty-state">Немає збережених вакансій.</p>';
          } else {
            savedListEl.innerHTML = saved.map(v => {
              const safeTitle = escapeHtml(v.title || '');
              const safeLocation = escapeHtml(v.location || '');
              const safeId = encodeURIComponent(v._id || '');
              const savedMeta = [];
              if (v.location) savedMeta.push(`📍 ${safeLocation}`);
              if (v.createdAt) savedMeta.push(`• ${escapeHtml(formatDate(v.createdAt))}`);
              return `
              <div class="saved-item">
                <a class="saved-link" href="/vacancy.html?id=${safeId}">${safeTitle}</a>
                <div class="saved-meta">${savedMeta.join(' ')}</div>
              </div>
            `;
            }).join('');
          }
        }
      } catch (e) {
        console.warn('Cannot load saved vacancies', e.message || e);
      }
  } catch (err) {
    console.error(err);
    // Preserve existing vacancy list if it is already displayed.
    if (!vacanciesList?.innerHTML?.trim()) {
      vacanciesList.innerHTML = '<p class="empty-state">Не вдалося завантажити вакансії</p>';
    }
  }
}

// Inline edit handlers
function setUnsaved(val) {
  unsaved = !!val;
  if (settingsActions) settingsActions.style.display = unsaved ? 'flex' : 'none';
}

editNameBtn?.addEventListener('click', (e) => {
  if (!profileName) return;
  if (editingInput) {
    editingInput.focus();
    return;
  }
  // create input inside the strong element
  editingInput = document.createElement('input');
  editingInput.type = 'text';
  editingInput.value = currentName || originalName || '';
  editingInput.className = 'inline-input';
  profileName.innerHTML = '';
  profileName.appendChild(editingInput);
  editingInput.focus();
  editingInput.addEventListener('input', () => {
    currentName = editingInput.value;
    setUnsaved(currentName !== originalName || currentShowEmail !== originalShowEmail);
  });
  editingInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      // cancel editing
      editingInput.value = originalName;
      currentName = originalName;
      profileName.textContent = originalName || 'Не вказано';
      editingInput.remove();
      editingInput = null;
      setUnsaved(false);
    }
    if (ev.key === 'Enter') {
      editingInput.blur();
    }
  });
});

toggleEmailBtn?.addEventListener('click', (e) => {
  currentShowEmail = !currentShowEmail;
  updateEmailToggleIcon(currentShowEmail);
  if (profileEmail) profileEmail.textContent = currentShowEmail ? (originalEmail || '–') : 'Приховано';
  setUnsaved(currentName !== originalName || currentShowEmail !== originalShowEmail);
});

saveSettingsBtn?.addEventListener('click', async () => {
  try {
    saveSettingsBtn.disabled = true;
    const payload = { name: (currentName || '').trim(), showEmail: !!currentShowEmail };
    await requestApi('/api/user/me', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    // commit
    originalName = payload.name;
    originalShowEmail = payload.showEmail;
    currentName = originalName;
    currentShowEmail = originalShowEmail;
    // update UI
    if (editingInput) {
      editingInput.remove();
      editingInput = null;
    }
    profileName.textContent = originalName || 'Не вказано';
    profileEmail.textContent = originalShowEmail ? (originalEmail || '–') : 'Приховано';
    setUnsaved(false);
    if (settingsSaveMsg) { settingsSaveMsg.style.display = 'block'; settingsSaveMsg.style.color = 'green'; settingsSaveMsg.textContent = 'Збережено'; }
  } catch (err) {
    if (settingsSaveMsg) { settingsSaveMsg.style.display = 'block'; settingsSaveMsg.style.color = 'crimson'; settingsSaveMsg.textContent = err.message || 'Помилка запиту'; }
  } finally {
    saveSettingsBtn.disabled = false;
    setTimeout(() => { if (settingsSaveMsg) settingsSaveMsg.style.display = 'none'; }, 3000);
  }
});

discardSettingsBtn?.addEventListener('click', () => {
  // revert
  currentName = originalName;
  currentShowEmail = originalShowEmail;
  if (editingInput) { editingInput.remove(); editingInput = null; }
  profileName.textContent = originalName || 'Не вказано';
  profileEmail.textContent = originalShowEmail ? (originalEmail || '–') : 'Приховано';
  updateEmailToggleIcon(originalShowEmail);
  setUnsaved(false);
});

// =========================
// CREATE VACANCY
// =========================

let wizardStep = 1;
let selectedTags = [];

function openVacancyModal(vacancy) {
  // If vacancy provided, open in edit mode and populate fields
  vacancyModal.classList.remove('hidden');
  vacancyModal.setAttribute('aria-hidden', 'false');
  setWizardStep(1);

  // clear previous editing id
  delete vacancyModal.dataset.editingId;
  wizardSubmitBtn.textContent = 'Опублікувати вакансію';

  if (vacancy) {
    const vacancyId = vacancy._id || vacancy.id;
    if (vacancyId) {
      vacancyModal.dataset.editingId = vacancyId;
    }
    // populate form fields
    vacancyWizard.elements['title'].value = vacancy.title || '';
    vacancyWizard.elements['description'].value = vacancy.description || '';
    vacancyWizard.elements['location'].value = vacancy.location || '';
    vacancyWizard.elements['contactName'].value = vacancy.contactName || '';
    vacancyWizard.elements['contactEmail'].value = vacancy.contactEmail || '';
    vacancyWizard.elements['contactPhone'].value = vacancy.contactPhone || '';
    selectedTags = vacancy.tags ? [...vacancy.tags] : [];
    renderSelectedTags();
    updateTagChips();
    wizardSubmitBtn.textContent = 'Зберегти зміни';
  } else {
    vacancyWizard.reset();
    selectedTags = [];
    renderSelectedTags();
    updateTagChips();
  }
}

function closeVacancyModal() {
  vacancyModal.classList.add('hidden');
  vacancyModal.setAttribute('aria-hidden', 'true');
  vacancyWizard.reset();
  selectedTags = [];
  renderSelectedTags();
  updateTagChips();
  setWizardStep(1);
  hideVacancyError();
  delete vacancyModal.dataset.editingId;
}

function setWizardStep(step) {
  wizardStep = step;
  document.querySelectorAll('.wizard-step').forEach((stepEl) => {
    stepEl.classList.toggle('hidden', Number(stepEl.dataset.step) !== step);
  });
  document.getElementById('vacancyModalTitle').textContent = `Крок ${step} з 2`;
  document.getElementById('vacancyStepDescription').textContent =
    step === 1
      ? 'Введіть заголовок, опис та контактні дані — це допоможе волонтерам швидко зрозуміти ваш запит.'
      : 'Оберіть до 3 тегів, щоб зробити вакансію більш релевантною для пошуку.';
  wizardBackBtn.classList.toggle('hidden', step === 1);
  wizardNextBtn.classList.toggle('hidden', step === 2);
  wizardSubmitBtn.classList.toggle('hidden', step === 1);
  document.querySelectorAll('.step-pill').forEach((pill) => {
    pill.classList.toggle('active', Number(pill.dataset.step) === step);
  });
  hideVacancyError();
}

function showVacancyError(message) {
  if (!vacancyError) return;
  vacancyError.textContent = message;
  vacancyError.classList.remove('hidden');
}

function hideVacancyError() {
  if (!vacancyError) return;
  vacancyError.textContent = '';
  vacancyError.classList.add('hidden');
}

function updateTagChips() {
  popularTagButtons.forEach((btn) => {
    btn.classList.toggle('active', selectedTags.includes(btn.dataset.tag));
  });
}

function renderSelectedTags() {
  if (!selectedTagsContainer) return;
  if (!selectedTags.length) {
    selectedTagsContainer.innerHTML = '<p class="empty-state">Поки що нема вибраних тегів.</p>';
    return;
  }

  selectedTagsContainer.innerHTML = selectedTags
    .map((tag) => `
      <button type="button" class="selected-tag" data-tag="${escapeHtml(tag)}">
        ${escapeHtml(tag)} <span aria-hidden="true">✕</span>
      </button>
    `)
    .join('');
}

function addTag(tag) {
  if (!tag) return;
  const normalized = tag.trim();
  if (!normalized) return;
  if (selectedTags.includes(normalized)) return;
  if (selectedTags.length >= 3) {
    showVacancyError('Можна додати не більше 3 тегів.');
    return;
  }
  selectedTags.push(normalized);
  renderSelectedTags();
  updateTagChips();
  hideVacancyError();
}

function removeTag(tag) {
  selectedTags = selectedTags.filter((value) => value !== tag);
  renderSelectedTags();
  updateTagChips();
}

function handleTagChipClick(event) {
  const tag = event.currentTarget.dataset.tag;
  addTag(tag);
}

function handleCustomTagAdd() {
  addTag(customTagInput?.value || '');
  if (customTagInput) {
    customTagInput.value = '';
  }
}

function validateStep1() {
  const data = new FormData(vacancyWizard);
  const title = data.get('title')?.trim();
  const description = data.get('description')?.trim();
  if (!title || !description) {
    showVacancyError('Заповніть назву вакансії та опис.');
    return false;
  }
  hideVacancyError();
  return true;
}

function goToNextStep() {
  if (!validateStep1()) return;
  setWizardStep(2);
}

function goToPreviousStep() {
  setWizardStep(1);
}

async function handleVacancySubmit(e) {
  e.preventDefault();

  const data = new FormData(vacancyWizard);
  const title = data.get('title')?.trim();
  const description = data.get('description')?.trim();
  const location = data.get('location')?.trim();
  const contactName = data.get('contactName')?.trim();
  const contactEmail = data.get('contactEmail')?.trim();
  const contactPhone = data.get('contactPhone')?.trim();

  if (!title || !description) {
    showVacancyError('Заповніть назву вакансії та опис.');
    return;
  }

  if (selectedTags.length > 3) {
    showVacancyError('Можна додати не більше 3 тегів.');
    return;
  }

  try {
    const editingId = vacancyModal.dataset.editingId;
    const isEditing = editingId && editingId !== 'undefined';
    if (isEditing) {
      await requestApi(`/api/user/vacancies/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          location,
          contactName,
          contactEmail,
          contactPhone,
          tags: selectedTags,
        }),
      });
    } else {
      await requestApi('/api/user/vacancies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          location,
          contactName,
          contactEmail,
          contactPhone,
          tags: selectedTags,
        }),
      });
    }

    closeVacancyModal();
    loadProfile();
  } catch (err) {
    showVacancyError(err.message);
  }
}

// =========================
// LOGOUT
// =========================

function handleLogout(e) {
  localStorage.removeItem('teerhub_token');

  if (e.currentTarget.tagName === 'A') {
    // Use the browser-native logout link to ensure the server invalidates the session cookie.
    return;
  }

  e.preventDefault();
  logoutAndDestroySession();
}

logoutBtn?.addEventListener('click', handleLogout);

// =========================
// EVENTS
// =========================

openVacancyModalBtn?.addEventListener('click', openVacancyModal);
closeVacancyModalBtn?.addEventListener('click', closeVacancyModal);
vacancyModal?.addEventListener('click', (event) => {
  if (event.target === vacancyModal) {
    closeVacancyModal();
  }
});
wizardNextBtn?.addEventListener('click', goToNextStep);
wizardBackBtn?.addEventListener('click', goToPreviousStep);
vacancyWizard?.addEventListener('submit', handleVacancySubmit);
popularTagButtons.forEach((btn) => btn.addEventListener('click', handleTagChipClick));
addCustomTagBtn?.addEventListener('click', handleCustomTagAdd);
selectedTagsContainer?.addEventListener('click', (event) => {
  const button = event.target.closest('.selected-tag');
  if (button) {
    removeTag(button.dataset.tag);
  }
});

// =========================
// INIT
// =========================

loadProfile();
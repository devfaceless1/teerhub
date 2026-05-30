// =========================
// AUTH
// =========================

let token = localStorage.getItem("teerhub_token");

// Check session if no token in localStorage
(async () => {
  if (!token) {
    const session = await checkSessionAndRestoreToken();
    if (!session.loggedIn) {
      window.location.href = "/login";
    } else {
      token = session.token;
    }
  }
})();

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// =========================
// ELEMENTS
// =========================

const jobsGrid = document.getElementById("jobsGrid");
const searchForm = document.getElementById("searchForm");
const resultCount = document.getElementById("resultCount");
const searchInput = document.getElementById("searchInput");
const locationInput = document.getElementById("locationInput");
const searchBtn = document.getElementById("searchBtn");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const openFiltersBtn = document.getElementById("openFiltersBtn");
const filterModal = document.getElementById("filterModal");
const filterModalClose = document.getElementById("filterModalClose");
const clearFiltersBtnModal = document.getElementById("clearFiltersBtnModal");
const applyFiltersBtn = document.getElementById("applyFiltersBtn");
const filterModalBackdrop = document.querySelector("[data-close-filter-modal]");
const logoutBtn = document.getElementById("logoutBtn");
const filterButtons = Array.from(document.querySelectorAll('.filter-chip'));

let selectedMessageRecipientId = null;
let messageModal = null;
let messageModalClose = null;
let messageModalBackdrop = null;
let cancelMessageBtn = null;
let messageForm = null;
let messageBodyInput = null;
let messageFormMessage = null;

// =========================
// STATE
// =========================

let jobs = [];
let currentQuery = "";
let currentLocation = "";
let appliedFilter = "";
let activeFilters = {
  remote: false,
  recent: false,
  saved: false,
};

const tagButtons = Array.from(document.querySelectorAll('.tag-btn'));

// =========================
// LOAD JOBS FROM API
// =========================

async function loadJobs() {
  try {
    const res = await fetch("/api/vacancies");
    const data = await res.json();

    jobs = (data.vacancies || []).map((v) => {
      const rawLocation = (v.location || "Онлайн").trim();
      const locationText = rawLocation || "Онлайн";
      const remote = /online|remote|віддалено|онлайн/i.test(locationText);
      const createdAt = new Date(v.createdAt);
      const daysAgo = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 86400000));

      const creatorRole = v.creatorRole || v.createdBy?.role || 'volunteer';
      const creatorClass = (creatorRole === 'organization' || creatorRole === 'company') ? 'org' : 'vol';

      return {
        id: v._id,
        title: v.title,
        organization: v.createdBy?.name || "Організація",
        createdById: v.createdBy?._id || v.createdBy?.id || null,
        creatorRole,
        creatorClass,
        creatorLabel: (creatorRole === 'organization' || creatorRole === 'company') ? 'Організація' : 'Волонтер',
        location: locationText,
        locationTag: remote ? 'Онлайн' : locationText,
        remoteTag: remote ? 'Віддалено' : 'Офлайн',
        remote,
        isRecent: daysAgo <= 7,
        daysAgo,
        createdAt: createdAt.toLocaleDateString("uk-UA", { day: 'numeric', month: 'short' }),
        status: v.status || 'open',
        statusClass: (v.status === 'open' || !v.status) ? 'open' : 'closed',
        statusLabel: (v.status === 'open' || !v.status) ? 'Відкрита' : 'Закрита',
        description: v.description,
        contactName: v.contactName || v.createdBy?.name || "Контакт",
        contactEmail: v.contactEmail,
        contactPhone: v.contactPhone,
        tags: v.tags && v.tags.length ? v.tags : ["Волонтерство"],
      };
    });

    // If user is logged in, fetch saved vacancy ids to mark saved state
    try {
      if (token) {
        const savedRes = await fetch('/api/user/saved', { headers: { Authorization: `Bearer ${token}` } });
        if (savedRes.ok) {
          const savedData = await savedRes.json();
          const savedIds = (savedData.saved || []).map(s => s._id ? s._id.toString() : s.id);
          jobs = jobs.map(j => ({ ...j, saved: savedIds.includes(j.id) }));
        }
      }
    } catch (e) {
      // ignore saved fetch errors
    }

    filterJobs();
  } catch (err) {
    console.error("Jobs load error:", err);
  }
}

function renderJobs(list) {
  if (!jobsGrid) return;

  const total = jobs.length;
  if (resultCount) {
    if (!total) {
      resultCount.textContent = 'Поки що немає жодної вакансії';
    } else if (!list.length) {
      resultCount.textContent = `За вашим запитом нічого не знайдено із ${total} вакансій`;
    } else if (list.length < total) {
      resultCount.textContent = `Показано ${list.length} з ${total} вакансій`;
    } else {
      resultCount.textContent = `Показано всі ${total} актуальних вакансій`;
    }
  }

  if (!list.length) {
    jobsGrid.innerHTML = `
      <div class="empty-state">
        <h3>Нічого не знайдено</h3>
      </div>
    `;
    return;
  }

  jobsGrid.innerHTML = list.map(job => {
    const safeId = encodeURIComponent(job.id || '');
    const safeTitle = escapeHtml(job.title || '');
    const safeOrganization = escapeHtml(job.organization || '');
    const safeCreatorLabel = escapeHtml(job.creatorLabel || '');
    const safeLocationTag = escapeHtml(job.locationTag || '');
    const safeDescription = escapeHtml(job.description || '');
    const safeContactName = escapeHtml(job.contactName || '');
    const safeContactEmail = escapeHtml(job.contactEmail || '');
    const safeContactPhone = escapeHtml(job.contactPhone || '');
    const safeTags = job.tags.map(t => `<span class="job-tag" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`).join('');

    return `
    <article class="job-card">
      <div class="job-card-top">
        <div>
          <h3><a href="/vacancy.html?id=${safeId}" class="job-title-link">${safeTitle}</a></h3>
          <p class="company">${job.createdById ? `<a href="/profile.html?id=${encodeURIComponent(job.createdById)}" class="org-link">${safeOrganization}</a>` : safeOrganization} <span class="creator-badge ${escapeHtml(job.creatorClass || '')}">${safeCreatorLabel}</span></p>
        </div>
        <div class="card-right">
          <span class="verified">${safeLocationTag}</span>
        </div>
      </div>

      <p class="job-description">${safeDescription}</p>

      <div class="job-contact">
        ${job.contactName ? `<span class="contact-label">Контакт:</span> ${safeContactName}` : ''}
        ${job.contactEmail ? `<a href="mailto:${encodeURIComponent(job.contactEmail)}">${safeContactEmail}</a>` : ''}
        ${job.contactPhone ? `<span>${safeContactPhone}</span>` : ''}
      </div>

      <div class="job-tags">
        ${safeTags}
      </div>

      <div class="job-footer">
        ${job.createdById ? `
        <button class="message-btn" data-recipient="${encodeURIComponent(job.createdById)}">
          Написати
        </button>
        ` : ''}
        <button class="save-btn ${job.saved ? 'active' : ''}" data-id="${safeId}">
          <svg class="heart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span>${job.saved ? 'Збережено' : 'Зберегти'}</span>
        </button>
      </div>
    </article>
  `;
  }).join("");

  attachButtons();
}

// =========================
// FILTER
// =========================

function normalize(str) {
  return (str || '').toString().toLowerCase();
}

function filterJobs() {
  const query = normalize(currentQuery);
  const locationQuery = normalize(currentLocation);
  const filterTag = normalize(appliedFilter);

  const filtered = jobs.filter((job) => {
    const text = normalize(`${job.title} ${job.description} ${job.organization} ${job.tags.join(' ')} ${job.location}`);
    const matchesKeyword = query ? text.includes(query) : true;
    const matchesLocation = locationQuery
      ? normalize(job.location).includes(locationQuery)
      : true;
    const matchesTag = filterTag
      ? job.tags.some((t) => normalize(t).includes(filterTag))
      : true;
    const matchesRemote = activeFilters.remote ? job.remote : true;
    const matchesRecent = activeFilters.recent ? job.isRecent : true;
    const matchesSaved = activeFilters.saved ? !!job.saved : true;

    return matchesKeyword && matchesLocation && matchesTag && matchesRemote && matchesRecent && matchesSaved;
  });

  renderJobs(filtered);
}

function setActiveTag(tag) {
  if (appliedFilter === tag) {
    appliedFilter = '';
  } else {
    appliedFilter = tag;
  }

  tagButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tag === appliedFilter);
  });

  document.querySelectorAll('.job-tag').forEach((tagNode) => {
    tagNode.classList.toggle('active', tagNode.dataset.tag === appliedFilter);
  });

  filterJobs();
}

function setActiveFilter(filter) {
  activeFilters[filter] = !activeFilters[filter];
  filterButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter && activeFilters[btn.dataset.filter]);
  });
  filterJobs();
}

function resetFilters() {
  currentQuery = '';
  currentLocation = '';
  appliedFilter = '';
  activeFilters = { remote: false, recent: false, saved: false };
  searchInput.value = '';
  locationInput.value = '';
  tagButtons.forEach((btn) => btn.classList.remove('active'));
  filterButtons.forEach((btn) => btn.classList.remove('active'));
  filterJobs();
}

// =========================
// BUTTONS
// =========================

function attachButtons() {
  document.querySelectorAll(".save-btn").forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (!id) return;
      try {
        if (!token) {
          return window.location.href = '/login';
        }
        if (btn.classList.contains('active') || btn.querySelector('span').textContent.includes('Збережено')) {
          // unsave
          const res = await fetch(`/api/user/saved/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) throw new Error('Не вдалося видалити збереження');
          btn.classList.remove('active');
          btn.querySelector('span').textContent = 'Зберегти';
        } else {
          const res = await fetch(`/api/user/saved/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) throw new Error('Не вдалося зберегти вакансію');
          btn.classList.add('active');
          btn.querySelector('span').textContent = 'Збережено';
        }
      } catch (err) {
        console.error(err);
        // if not authenticated, redirect
        if (err.message && err.message.includes('401')) {
          window.location.href = '/login';
        } else {
          alert(err.message || 'Помилка при збереженні');
        }
      }
    });
  });

  document.querySelectorAll('.message-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!token) {
        return window.location.href = '/login';
      }
      selectedMessageRecipientId = btn.dataset.recipient || null;
      if (!selectedMessageRecipientId) {
        alert('Не вдалося знайти автора вакансії для повідомлення');
        return;
      }
      toggleMessageModal(true);
    });
  });
}

jobsGrid?.addEventListener('click', (event) => {
  const tagNode = event.target.closest('.job-tag');
  if (!tagNode) return;
  setActiveTag(tagNode.dataset.tag);
});

// =========================
// SEARCH
// =========================

searchForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  currentQuery = searchInput.value || "";
  currentLocation = locationInput.value || "";
  filterJobs();
});

clearFiltersBtn?.addEventListener("click", () => {
  resetFilters();
});

clearFiltersBtnModal?.addEventListener("click", () => {
  resetFilters();
});

function openFilterModal() {
  if (!filterModal) return;
  filterModal.classList.add('open');
  filterModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeFilterModal() {
  if (!filterModal) return;
  filterModal.classList.remove('open');
  filterModal.setAttribute('aria-hidden', 'true');
  const mobileMenu = document.getElementById('mobileMenu');
  if (!mobileMenu || !mobileMenu.classList.contains('open')) {
    document.body.style.overflow = '';
  }
}

function toggleMessageModal(show) {
  if (!messageModal) return;
  messageModal.classList.toggle('open', show);
  messageModal.setAttribute('aria-hidden', show ? 'false' : 'true');
  document.body.style.overflow = show ? 'hidden' : '';
  if (show && messageBodyInput) {
    setTimeout(() => messageBodyInput.focus(), 50);
  }
  if (!show) {
    selectedMessageRecipientId = null;
    if (messageBodyInput) {
      messageBodyInput.value = '';
    }
    if (messageFormMessage) {
      messageFormMessage.textContent = '';
      messageFormMessage.className = 'form-message';
    }
  }
}

function showMessageFormMessage(message, type = 'error') {
  if (!messageFormMessage) return;
  messageFormMessage.textContent = message;
  messageFormMessage.className = `form-message ${type}`;
  setTimeout(() => {
    messageFormMessage.textContent = '';
    messageFormMessage.className = 'form-message';
  }, 4000);
}

function initMessageModal() {
  messageModal = document.getElementById('messageModal');
  messageModalClose = document.getElementById('messageModalClose');
  messageModalBackdrop = document.querySelector('[data-close-message-modal]');
  cancelMessageBtn = document.getElementById('cancelMessageBtn');
  messageForm = document.getElementById('messageForm');
  messageBodyInput = document.getElementById('messageBody');
  messageFormMessage = document.getElementById('messageFormMessage');

  messageModalClose?.addEventListener('click', () => toggleMessageModal(false));
  cancelMessageBtn?.addEventListener('click', () => toggleMessageModal(false));
  messageModalBackdrop?.addEventListener('click', () => toggleMessageModal(false));

  messageForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!token) {
      return window.location.href = '/login';
    }
    if (!selectedMessageRecipientId) {
      return showMessageFormMessage('Не обрано одержувача', 'error');
    }
    const body = messageBodyInput?.value.trim();
    if (!body) {
      return showMessageFormMessage('Введіть текст повідомлення', 'error');
    }

    try {
      const res = await fetch(`/api/user/${selectedMessageRecipientId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ body })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Не вдалося надіслати повідомлення');
      }
      showMessageFormMessage('Повідомлення надіслано', 'success');
      if (messageBodyInput) messageBodyInput.value = '';
      setTimeout(() => toggleMessageModal(false), 1200);
    } catch (err) {
      console.error(err);
      showMessageFormMessage(err.message || 'Не вдалося відправити повідомлення', 'error');
    }
  });
}

openFiltersBtn?.addEventListener('click', openFilterModal);
filterModalClose?.addEventListener('click', closeFilterModal);
filterModalBackdrop?.addEventListener('click', closeFilterModal);
applyFiltersBtn?.addEventListener('click', closeFilterModal);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeFilterModal();
  }
});

searchInput?.addEventListener("input", () => {
  currentQuery = searchInput.value || "";
  filterJobs();
});

locationInput?.addEventListener("input", () => {
  currentLocation = locationInput.value || "";
  filterJobs();
});

filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const filter = btn.dataset.filter;
    setActiveFilter(filter);
  });
});

tagButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const tag = btn.dataset.tag || btn.textContent.trim();
    setActiveTag(tag);
  });
});
// =========================
// LOGOUT
// =========================

logoutBtn?.addEventListener("click", () => {
  logoutAndDestroySession();
});

// =========================
// INIT
// =========================

// INIT (bind after DOM ready)

document.addEventListener('DOMContentLoaded', () => {
  console.log('dashboard: DOMContentLoaded');
  // Re-query elements that may be injected after script include
  const openFiltersBtnLocal = document.getElementById("openFiltersBtn");
  const filterModalLocal = document.getElementById("filterModal");
  const filterModalCloseLocal = document.getElementById("filterModalClose");
  const clearFiltersBtnModalLocal = document.getElementById("clearFiltersBtnModal");
  const applyFiltersBtnLocal = document.getElementById("applyFiltersBtn");
  const filterModalBackdropLocal = document.querySelector("[data-close-filter-modal]");

  function bindFilterControls() {
    console.log('dashboard: bindFilterControls');
    // Find all filter buttons both in sidebar and modal
    const allFilterButtons = Array.from(document.querySelectorAll('.filter-chip'));
    const allTagButtons = Array.from(document.querySelectorAll('.tag-btn'));

    allFilterButtons.forEach((btn) => {
      if (btn._filterListener) btn.removeEventListener('click', btn._filterListener);
      const listener = () => {
        console.log('dashboard: filter-chip clicked', btn.dataset.filter);
        const filter = btn.dataset.filter;
        setActiveFilter(filter);
      };
      btn.addEventListener('click', listener);
      btn._filterListener = listener;
    });

    allTagButtons.forEach((btn) => {
      if (btn._tagListener) btn.removeEventListener('click', btn._tagListener);
      const listener = () => {
        console.log('dashboard: tag-btn clicked', btn.dataset.tag || btn.textContent.trim());
        const tag = btn.dataset.tag || btn.textContent.trim();
        setActiveTag(tag);
      };
      btn.addEventListener('click', listener);
      btn._tagListener = listener;
    });
  }

  // Modal open/close helpers
  function openFilterModalLocal() {
    if (!filterModalLocal) return;
    console.log('dashboard: openFilterModalLocal called');
    filterModalLocal.classList.add('open');
    filterModalLocal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeFilterModalLocal() {
    if (!filterModalLocal) return;
    filterModalLocal.classList.remove('open');
    filterModalLocal.setAttribute('aria-hidden', 'true');
    const mobileMenu = document.getElementById('mobileMenu');
    if (!mobileMenu || !mobileMenu.classList.contains('open')) {
      document.body.style.overflow = '';
    }
  }

  // Wire modal controls
  openFiltersBtnLocal?.addEventListener('click', () => {
    console.log('dashboard: openFiltersBtnLocal click');
    bindFilterControls();
    openFilterModalLocal();
  });
  filterModalCloseLocal?.addEventListener('click', closeFilterModalLocal);
  filterModalBackdropLocal?.addEventListener('click', closeFilterModalLocal);
  applyFiltersBtnLocal?.addEventListener('click', () => {
    // ensure filter controls are bound (they already modify global filter state)
    bindFilterControls();
    closeFilterModalLocal();
  });
  clearFiltersBtnModalLocal?.addEventListener('click', () => {
    resetFilters();
  });

  // Also bind filter controls on initial load for sidebar buttons
  console.log('dashboard: initial bindFilterControls call');
  bindFilterControls();
  initMessageModal();

  // Start loading jobs after DOM is ready
  loadJobs();
  setInterval(loadJobs, 8000);
});

// Failsafe: delegated click handler in case button wasn't bound
document.addEventListener('click', (event) => {
  const btn = event.target.closest && event.target.closest('#openFiltersBtn');
  if (btn) {
    const modal = document.getElementById('filterModal');
    if (modal) {
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      // bind controls inside modal
      const allFilterButtons = Array.from(document.querySelectorAll('.filter-chip'));
      const allTagButtons = Array.from(document.querySelectorAll('.tag-btn'));
      allFilterButtons.forEach((b) => b.addEventListener('click', () => setActiveFilter(b.dataset.filter)));
      allTagButtons.forEach((b) => b.addEventListener('click', () => setActiveTag(b.dataset.tag || b.textContent.trim())));
    }
  }
});

// Delegated close handler (works even if direct listeners weren't attached)
document.addEventListener('click', (event) => {
  const closeEl = event.target.closest && (event.target.closest('#filterModalClose') || event.target.closest('[data-close-filter-modal]'));
  if (closeEl) {
    const modal = document.getElementById('filterModal');
    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      const mobileMenu = document.getElementById('mobileMenu');
      if (!mobileMenu || !mobileMenu.classList.contains('open')) {
        document.body.style.overflow = '';
      }
    }
  }
});

// Ensure Escape closes modal and restores scroll
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    const filter = document.getElementById('filterModal');
    const message = document.getElementById('messageModal');

    if (message && message.classList.contains('open')) {
      toggleMessageModal(false);
      return;
    }

    if (filter && filter.classList.contains('open')) {
      filter.classList.remove('open');
      filter.setAttribute('aria-hidden', 'true');
      const mobileMenu = document.getElementById('mobileMenu');
      if (!mobileMenu || !mobileMenu.classList.contains('open')) {
        document.body.style.overflow = '';
      }
    }
  }
});
const params = new URLSearchParams(window.location.search);
const profileId = params.get('id');
const createdVacanciesEl = document.getElementById('createdVacancies');
const profileNameEl = document.getElementById('profileName');
const profileBioEl = document.getElementById('profileBio');
const profileAvatarEl = document.getElementById('profileAvatar');
const profileRoleEl = document.getElementById('profileRole');
const profileEmailEl = document.getElementById('profileEmail');
const profileRegisteredEl = document.getElementById('profileRegistered');
const ratingAverageEl = document.getElementById('ratingAverage');
const ratingStarsEl = document.getElementById('ratingStars');
const ratingCountEl = document.getElementById('ratingCount');
const ratingForm = document.getElementById('ratingForm');
const starsSelector = document.getElementById('starsSelector');
const selectedRatingInput = document.getElementById('selectedRating');
const ratingCommentEl = document.getElementById('ratingComment');
const commentCountEl = document.getElementById('commentCharCount');
const ratingFormMessageEl = document.getElementById('ratingFormMessage');
const reviewsListEl = document.getElementById('reviewsList');
const openMessageBtn = document.getElementById('openMessageBtn');
const messageModal = document.getElementById('messageModal');
const messageModalClose = document.getElementById('messageModalClose');
const messageModalBackdrop = document.querySelector('[data-close-message-modal]');
const cancelMessageBtn = document.getElementById('cancelMessageBtn');
const messageForm = document.getElementById('messageForm');
const messageBodyEl = document.getElementById('messageBody');
const messageFormMessageEl = document.getElementById('messageFormMessage');

const COMMENT_MAX_LENGTH = 500;

let currentProfileId = null;
let currentUserToken = localStorage.getItem('teerhub_token');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// =========================
// RATING FUNCTIONS
// =========================

const STAR_PATH = 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21z';

function getRatingStar(type, id) {
  if (type === 'half') {
    return `
      <svg aria-hidden="true" viewBox="0 0 24 24" class="star-icon star-icon--half">
        <defs>
          <clipPath id="clip-${id}">
            <rect x="0" y="0" width="12" height="24" />
          </clipPath>
        </defs>
        <path d="${STAR_PATH}" class="star-outline" />
        <path d="${STAR_PATH}" class="star-fill" clip-path="url(#clip-${id})" />
      </svg>
    `;
  }

  return `
    <svg aria-hidden="true" viewBox="0 0 24 24" class="star-icon star-icon--${type}">
      <path d="${STAR_PATH}" />
    </svg>
  `;
}

function renderRatingStars(average) {
  if (!ratingStarsEl) return;
  const rounded = Math.round(average * 2) / 2;
  const stars = Array.from({ length: 5 }, (_, index) => {
    const starIndex = `${Date.now()}-${index}`;
    if (rounded >= index + 1) return getRatingStar('full', starIndex);
    if (rounded >= index + 0.5) return getRatingStar('half', starIndex);
    return getRatingStar('empty', starIndex);
  });
  ratingStarsEl.innerHTML = stars.join('');
}

function calculateAverageRating(ratings) {
  if (!ratings || ratings.length === 0) return 0;
  const sum = ratings.reduce((acc, r) => acc + (r.score || 0), 0);
  return Number((sum / ratings.length).toFixed(1));
}

function renderRating(user) {
  const count = (user.ratings || []).length;
  const average = typeof user.ratingAverage !== 'undefined'
    ? user.ratingAverage
    : calculateAverageRating(user.ratings);

  if (!count) {
    if (ratingAverageEl) ratingAverageEl.textContent = '–';
    if (ratingCountEl) ratingCountEl.textContent = 'Немає оцінок';
    renderRatingStars(0);
    renderReviews([]);
    return;
  }

  if (ratingAverageEl) ratingAverageEl.textContent = Number(average).toFixed(1);
  if (ratingCountEl) ratingCountEl.textContent = `${count} ${count === 1 ? 'оцінка' : count < 5 ? 'оцінки' : 'оцінок'}`;
  renderRatingStars(Number(average));
  renderReviews(user.ratings);
}

function renderReviewStars(score, reviewIndex) {
  return Array.from({ length: 5 }, (_, index) => {
    const starIndex = `review-${reviewIndex}-${index}`;
    return index < score
      ? getRatingStar('full', starIndex)
      : getRatingStar('empty', starIndex);
  }).join('');
}

function renderReviews(ratings) {
  if (!reviewsListEl) return;

  if (!ratings || ratings.length === 0) {
    reviewsListEl.innerHTML = '<div class="empty-reviews">Поки що немає відгуків</div>';
    return;
  }

  const sortedRatings = [...ratings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  reviewsListEl.innerHTML = sortedRatings.map((rating, index) => {
    const date = new Date(rating.createdAt).toLocaleDateString('uk-UA');
    const stars = renderReviewStars(rating.score, index);
    const authorName = escapeHtml(rating.ratedBy?.name || rating.ratedBy || 'Анонім');
    const reviewComment = rating.comment ? `<p class="review-comment">${escapeHtml(rating.comment)}</p>` : '';

    return `
      <div class="review-card">
        <div class="review-header">
          <span class="review-author">${authorName}</span>
          <div class="review-stars">${stars}</div>
        </div>
        ${reviewComment}
        <div class="review-date">${escapeHtml(date)}</div>
      </div>
    `;
  }).join('');
}

function initRatingForm() {
  if (!ratingForm) return;

  // Comment length indicator
  if (ratingCommentEl) {
    const updateCommentCount = () => {
      const length = ratingCommentEl.value.length;
      if (commentCountEl) {
        commentCountEl.textContent = `${length}/${COMMENT_MAX_LENGTH}`;
        commentCountEl.classList.toggle('limit-exceeded', length > COMMENT_MAX_LENGTH);
      }
    };

    ratingCommentEl.addEventListener('input', () => {
      if (ratingCommentEl.value.length > COMMENT_MAX_LENGTH) {
        ratingCommentEl.value = ratingCommentEl.value.slice(0, COMMENT_MAX_LENGTH);
      }
      updateCommentCount();
    });

    updateCommentCount();
  }

  // Star selector
  if (starsSelector) {
    const starBtns = starsSelector.querySelectorAll('.star-btn');
    starBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const value = btn.dataset.value;
        selectedRatingInput.value = value;
        
        starBtns.forEach((b, idx) => {
          if (idx < value) {
            b.classList.add('active');
          } else {
            b.classList.remove('active');
          }
        });
      });
    });
  }

  // Form submit
  ratingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const score = parseInt(selectedRatingInput.value) || 0;
    const comment = ratingCommentEl.value.trim();

    if (score === 0) {
      showRatingMessage('Виберіть оцінку', 'error');
      return;
    }

    if (ratingCommentEl.value.length > COMMENT_MAX_LENGTH) {
      showRatingMessage(`Коментар не може перевищувати ${COMMENT_MAX_LENGTH} символів`, 'error');
      return;
    }

    if (!currentUserToken) {
      showRatingMessage('Необхідно ввійти в акаунт', 'error');
      setTimeout(() => window.location.href = '/login', 1000);
      return;
    }

    try {
      const res = await fetch(`/api/user/${currentProfileId}/rating`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUserToken}`
        },
        body: JSON.stringify({ score, comment })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Не вдалося залишити оцінку');
      }

      showRatingMessage('Ваша оцінка надіслана!', 'success');
      
      // Reset form
      selectedRatingInput.value = 0;
      ratingCommentEl.value = '';
      if (commentCountEl) {
        commentCountEl.textContent = `0/${COMMENT_MAX_LENGTH}`;
      }
      if (starsSelector) {
        starsSelector.querySelectorAll('.star-btn').forEach(b => b.classList.remove('active'));
      }

      // Reload profile
      setTimeout(() => loadProfile(), 1500);
    } catch (err) {
      console.error(err);
      showRatingMessage(err.message || 'Помилка при збереженні оцінки', 'error');
    }
  });
}

function showRatingMessage(message, type = 'success') {
  if (!ratingFormMessageEl) return;
  ratingFormMessageEl.textContent = message;
  ratingFormMessageEl.className = `form-message ${type}`;
  setTimeout(() => {
    ratingFormMessageEl.textContent = '';
    ratingFormMessageEl.className = 'form-message';
  }, 4000);
}

function showMessageFormMessage(message, type = 'success') {
  if (!messageFormMessageEl) return;
  messageFormMessageEl.textContent = message;
  messageFormMessageEl.className = `form-message ${type}`;
  setTimeout(() => {
    messageFormMessageEl.textContent = '';
    messageFormMessageEl.className = 'form-message';
  }, 4000);
}

function toggleMessageModal(show) {
  if (!messageModal) return;
  messageModal.classList.toggle('open', show);
  messageModal.setAttribute('aria-hidden', show ? 'false' : 'true');
  if (show && messageBodyEl) {
    setTimeout(() => messageBodyEl.focus(), 50);
  }
}

function attachMessageModalHandlers() {
  if (openMessageBtn) {
    openMessageBtn.addEventListener('click', () => {
      if (!currentUserToken) {
        showMessageFormMessage('Увійдіть, щоб надіслати повідомлення', 'error');
        setTimeout(() => window.location.href = '/login', 1200);
        return;
      }
      toggleMessageModal(true);
    });
  }

  if (messageModalClose) {
    messageModalClose.addEventListener('click', () => toggleMessageModal(false));
  }

  if (cancelMessageBtn) {
    cancelMessageBtn.addEventListener('click', () => toggleMessageModal(false));
  }

  if (messageModalBackdrop) {
    messageModalBackdrop.addEventListener('click', () => toggleMessageModal(false));
  }

  if (messageForm) {
    messageForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!currentUserToken) {
        showMessageFormMessage('Увійдіть, щоб надіслати повідомлення', 'error');
        setTimeout(() => window.location.href = '/login', 1200);
        return;
      }

      const body = messageBodyEl ? messageBodyEl.value.trim() : '';
      if (!body) {
        showMessageFormMessage('Введіть текст повідомлення', 'error');
        return;
      }

      try {
        const res = await fetch(`/api/user/${currentProfileId}/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentUserToken}`
          },
          body: JSON.stringify({ body })
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'Не вдалося надіслати повідомлення');
        }

        showMessageFormMessage('Повідомлення надіслано', 'success');
        if (messageBodyEl) messageBodyEl.value = '';
        setTimeout(() => toggleMessageModal(false), 1200);
      } catch (err) {
        console.error(err);
        showMessageFormMessage(err.message || 'Не вдалося надіслати повідомлення', 'error');
      }
    });
  }
}

// Hide rating form if viewing own profile or not logged in
function updateRatingFormVisibility(user) {
  if (!ratingForm) return;
  
  // Check if viewing own profile
  if (currentProfileId === 'own' || !currentProfileId) {
    ratingForm.style.display = 'none';
    return;
  }

  // Check if logged in
  if (!currentUserToken) {
    ratingForm.style.display = 'none';
    return;
  }

  ratingForm.style.display = 'block';
}

async function loadProfile() {
  try {
    if (profileId) {
      currentProfileId = profileId;
      const res = await fetch(`/api/user/${profileId}`);
      if (!res.ok) throw new Error('Не вдалося завантажити профіль');
      const data = await res.json();
      renderProfile(data.user);
      renderVacancies(data.vacancies || []);
    } else {
      // own profile
      currentProfileId = 'own';
      if (!currentUserToken) return window.location.href = '/login';

      const meRes = await fetch('/api/user/me', { headers: { Authorization: `Bearer ${currentUserToken}` } });
      if (!meRes.ok) throw new Error('Не вдалося завантажити профіль');
      const me = await meRes.json();
      renderProfile(me.user);

      const vacRes = await fetch('/api/user/vacancies', { headers: { Authorization: `Bearer ${currentUserToken}` } });
      if (vacRes.ok) {
        const vacData = await vacRes.json();
        renderVacancies(vacData.vacancies || []);
      }
    }
  } catch (err) {
    console.error(err);
    profileNameEl.textContent = 'Профіль не знайдено';
    createdVacanciesEl.innerHTML = '<p class="empty-state">Неможливо завантажити дані.</p>';
  }
}

function renderProfile(user) {
  if (!user) return;
  profileNameEl.textContent = user.name || user.email || 'Користувач';
  const roleLabels = {
    volunteer: 'Волонтер',
    organization: 'Організація',
    company: 'Компанія'
  };
  profileRoleEl.textContent = user.role ? (roleLabels[user.role] || user.role) : '—';
  // Show email only if user explicitly allows it (showEmail !== false)
  if (profileEmailEl) {
    if (user.showEmail === false || !user.email) {
      profileEmailEl.textContent = 'Приховано';
    } else {
      profileEmailEl.textContent = user.email;
    }
  }
  if (profileRegisteredEl) profileRegisteredEl.textContent = new Date(user.createdAt).toLocaleDateString('uk-UA');
  // avatar initials fallback
  if (profileAvatarEl) {
    const name = (user.name || user.email || '').trim();
    const initials = name.split(' ').slice(0,2).map(s => s.charAt(0).toUpperCase()).join('') || 'U';
    profileAvatarEl.textContent = initials;
  }

  const blocks = [];
  if (user.goal) blocks.push(`<p><strong>Мета:</strong> ${escapeHtml(user.goal)}</p>`);
  if (user.motivation) blocks.push(`<p><strong>Мотивація:</strong> ${escapeHtml(user.motivation)}</p>`);
  profileBioEl.innerHTML = blocks.join('');

  // Render ratings
  renderRating(user);
  updateRatingFormVisibility(user);
  if (openMessageBtn) {
    openMessageBtn.style.display = (profileId && currentProfileId !== 'own') ? 'inline-flex' : 'none';
  }
}

function renderVacancies(list) {
  if (!createdVacanciesEl) return;
  if (!list.length) {
    createdVacanciesEl.innerHTML = '<p class="empty-state">Цей користувач ще не створив вакансій.</p>';
    return;
  }
  createdVacanciesEl.innerHTML = list.map(v => {
    const safeTitle = escapeHtml(v.title || '');
    const safeLocation = escapeHtml(v.location || 'Онлайн');
    const safeDescription = escapeHtml(v.description || '');
    const safeStatus = v.status === 'open' ? 'Відкрита' : 'Закрита';
    const safeTags = (v.tags || []).map(t => `<span data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`).join('');
    const safeHref = v._id ? `/vacancy.html?id=${encodeURIComponent(v._id)}` : '#';
    return `
    <article class="job-card">
      <div class="job-card-top">
        <div>
          <h3><a href="${safeHref}" class="job-link">${safeTitle}</a></h3>
          <p class="company">${safeLocation}</p>
        </div>
        <div class="card-right">
          <span class="verified">${escapeHtml(safeStatus)}</span>
        </div>
      </div>
      <p class="job-description">${safeDescription}</p>
      <div class="job-tags">${safeTags}</div>
    </article>
    `;
  }).join('');
}

loadProfile();
initRatingForm();
attachMessageModalHandlers();

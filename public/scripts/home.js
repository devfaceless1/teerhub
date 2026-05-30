const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileMenu = document.getElementById('mobileMenu');
const mobileMenuClose = document.getElementById('mobileMenuClose');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const filterButtons = document.querySelectorAll('.pill');
const resultsGrid = document.getElementById('resultsGrid');
const previewList = document.getElementById('previewList');
const resultCount = document.getElementById('resultCount');

const userToken = localStorage.getItem('teerhub_token');
const desktopAccountLink = document.querySelector('.nav-actions a[href="/login"]');
const mobileAccountBtn = document.getElementById('mobileAccountBtn');

const sampleItems = [
  {
    type: 'vacancy',
    title: 'Збір гуманітарної допомоги',
    entity: 'Фонд «Разом»',
    location: 'Київ',
    tags: ['логістика', 'склад', 'транспорт'],
    description: 'Потрібні волонтери для упаковки посилок та координування перевезень гуманітарної допомоги.',
  },
  {
    type: 'vacancy',
    title: 'Допомога дітям у навчанні',
    entity: 'Волонтер Марія',
    location: 'Львів',
    tags: ['освіта', 'репетиторство'],
    description: 'Шукаю команду для проведення уроків з української мови та математики для дітей.',
  },
  {
    type: 'vacancy',
    title: 'Підтримка медичної команди',
    entity: 'Організація «Серце»',
    location: 'Одеса',
    tags: ['медицина', 'організація', 'психологія'],
    description: 'Потрібні допоміжні волонтери для роботи з медичним персоналом та пацієнтами.',
  },
  {
    type: 'volunteer',
    title: 'Оксана — PR та комунікації',
    entity: 'Волонтерська організація',
    location: 'Харків',
    tags: ['PR', 'комунікація', 'соцмережі'],
    description: 'Маю досвід у комунікаціях, готова допомогти організаціям з інформаційною підтримкою.',
  },
  {
    type: 'organization',
    title: '«Миру Коло» — волонтерська ініціатива',
    entity: 'Організація',
    location: 'Чернівці',
    tags: ['переселенці', 'допомога', 'активізм'],
    description: 'Пошук волонтерів для соціальних проєктів та заходів на місцевому рівні.',
  },
  {
    type: 'organization',
    title: 'IT Волонтери UA',
    entity: 'Спільнота',
    location: 'Онлайн',
    tags: ['IT', 'технології', 'освіта'],
    description: 'З’єднуємо ІТ-спеціалістів із освітніми та гуманітарними проєктами.',
  },
];

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toggleMobileMenu(open) {
  mobileMenu.classList.toggle('open', open);
}

function updateAccountLinks() {
  const actionLinks = document.querySelectorAll('.mobile-actions, .nav-actions');
  const accountUrl = userToken ? '/dashboard' : '/login';
  const accountText = userToken ? 'Мій кабінет' : 'Увійти';

  if (mobileAccountBtn) {
    mobileAccountBtn.href = accountUrl;
    mobileAccountBtn.textContent = accountText;
  }

  if (desktopAccountLink) {
    desktopAccountLink.href = accountUrl;
    desktopAccountLink.textContent = accountText;
  }
}

function renderPreview() {
  const vacancyItems = sampleItems.filter(item => item.type === 'vacancy').slice(0, 4);
  previewList.innerHTML = vacancyItems.map(item => `
    <div class="preview-item">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.entity)} · ${escapeHtml(item.location)}</span>
    </div>
  `).join('');
}

function renderResults(items) {
  resultCount.textContent = `Показано ${items.length} результатів`;
  if (!items.length) {
    resultsGrid.innerHTML = '<p class="empty-state">За вашим запитом не знайдено результатів.</p>';
    return;
  }

  resultsGrid.innerHTML = items.map(item => `
    <article class="listing-card">
      <div class="listing-header">
        <span class="tag-pill">${escapeHtml(item.type === 'vacancy' ? 'Вакансія' : item.type === 'volunteer' ? 'Волонтер' : 'Організація')}</span>
        <h3>${escapeHtml(item.title)}</h3>
      </div>
      <p>${escapeHtml(item.description)}</p>
      <div class="tag-pill-group">
        ${item.tags.map(tag => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join('')}
      </div>
      <div class="listing-footer">
        <span>${escapeHtml(item.entity)}</span>
        <span>${escapeHtml(item.location)}</span>
      </div>
    </article>
  `).join('');
}

function getCurrentFilter() {
  return document.querySelector('.pill.active')?.dataset.filter || 'vacancy';
}

function searchItems() {
  const filter = getCurrentFilter();
  const query = searchInput.value.trim().toLowerCase();

  let items = sampleItems.filter(item => filter === 'all' ? true : item.type === filter);
  if (query) {
    items = items.filter(item => {
      const haystack = [item.title, item.description, item.entity, item.location, ...(item.tags || [])].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }
  renderResults(items);
}

if (hamburgerBtn && mobileMenu && mobileMenuClose) {
  hamburgerBtn.addEventListener('click', () => toggleMobileMenu(true));
  mobileMenuClose.addEventListener('click', () => toggleMobileMenu(false));
  mobileMenu.addEventListener('click', (event) => {
    if (event.target === mobileMenu) toggleMobileMenu(false);
  });
}

filterButtons.forEach(button => {
  button.addEventListener('click', () => {
    filterButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    searchItems();
  });
});

if (searchBtn) {
  searchBtn.addEventListener('click', searchItems);
}

if (searchInput) {
  searchInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') searchItems();
  });
}

updateAccountLinks();
renderPreview();
searchItems();

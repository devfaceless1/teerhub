let token = localStorage.getItem('teerhub_token');

const conversationSearch = document.getElementById('conversationSearch');
const conversationList = document.getElementById('conversationList');
const chatShell = document.querySelector('.chat-shell');
const chatHeaderTitle = document.getElementById('chatHeaderTitle');
const chatThread = document.getElementById('chatThread');
const chatReplyForm = document.getElementById('chatReplyForm');
const replyBody = document.getElementById('replyBody');
const replySubmit = document.getElementById('replySubmit');
const backBtn = document.getElementById('backToList');
const logoutBtn = document.getElementById('logoutBtn');

let conversations = [];
let activeConversationId = null;
let pollingTimer = null;
let isRefreshingMessages = false;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setAppViewportHeight() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--app-vh', `${vh}px`);
}

async function ensureToken() {
  if (!token) {
    const session = await checkSessionAndRestoreToken();
    if (session.loggedIn) {
      token = session.token;
    }
  }
  return token;
}

function getToastContainer(position = 'bottom') {
  const containerId = position === 'top' ? 'toastContainerTop' : 'toastContainer';
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.className = `toast-container toast-container--${position}`;
    document.body.appendChild(container);
  }
  return container;
}

function showToast(message, type = 'success', title = '') {
  if (type === 'success') return;

  const position = type === 'error' ? 'top' : 'bottom';
  const container = getToastContainer(position);
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
  setTimeout(removeToast, 4200);
}

async function requestApi(path, options = {}) {
  const authToken = await ensureToken();
  const res = await fetch(path, {
    ...options,
    credentials: options.credentials || 'include',
    headers: {
      ...(options.headers || {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });
  if (!res.ok) {
    if (res.status === 401) {
      await logoutAndDestroySession();
      throw new Error('Потрібна авторизація');
    }
    let errMessage = 'Помилка запиту';
    try {
      const errBody = await res.json();
      if (errBody && errBody.message) errMessage = errBody.message;
    } catch (err) {
      const text = await res.text().catch(() => '');
      if (text) errMessage = text;
    }
    throw new Error(errMessage || `Помилка (${res.status})`);
  }
  return res.json();
}

function formatDate(dateString) {
  if (!dateString) return '';
  return new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(dateString));
}

function getConversationKey(msg) {
  const partner = msg.partner || msg.to || msg.from || {};
  const partnerId = String(partner.id || partner._id || partner.userId || 'anonymous');
  const partnerName = partner.name || partner.fullName || 'Анонім';
  return `${partnerId}::${partnerName}`;
}

function buildConversations(messages = []) {
  const groups = new Map();
  messages.forEach(msg => {
    const key = getConversationKey(msg);
    const partner = msg.partner || msg.to || msg.from || {};
    const partnerName = partner.name || partner.fullName || 'Анонім';
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        name: partnerName,
        partnerId: partner.id || partner._id || partner.userId || 'anonymous',
        messages: [],
        lastUpdated: msg.createdAt || msg.updatedAt || new Date().toISOString(),
        snippet: msg.body || '',
        canReply: !!msg.canReply,
      });
    }
    const conversation = groups.get(key);
    conversation.messages.push(msg);
    const created = new Date(msg.createdAt || msg.updatedAt || Date.now());
    if (created > new Date(conversation.lastUpdated)) {
      conversation.lastUpdated = msg.createdAt || msg.updatedAt;
    }
    if (msg.body) {
      conversation.snippet = msg.body;
    }
    conversation.canReply = conversation.canReply || !!msg.canReply;
  });
  return [...groups.values()]
    .map(conv => {
      conv.messages.sort((a, b) => new Date(a.createdAt || a.updatedAt || 0) - new Date(b.createdAt || b.updatedAt || 0));
      return conv;
    })
    .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
}

function renderConversationList(items = []) {
  if (!conversationList) return;
  if (!items.length) {
    conversationList.innerHTML = '<div class="empty-state">Немає активних чатів.</div>';
    return;
  }
  conversationList.innerHTML = items
    .map(conv => {
      const isActive = conv.id === activeConversationId ? 'active' : '';
      const preview = conv.snippet ? escapeHtml(conv.snippet.slice(0, 40)) : 'Немає повідомлення';
      const timestamp = conv.lastUpdated ? formatDate(conv.lastUpdated) : '';
      const initials = escapeHtml(conv.name || 'Анонім')
        .split(' ')
        .map(part => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();
      return `
        <button type="button" class="conversation-item ${isActive}" data-id="${escapeHtml(conv.id)}">
          <div class="conversation-avatar">${initials}</div>
          <div class="conversation-details">
            <span class="conversation-name" data-profile-id="${escapeHtml(conv.partnerId)}">${escapeHtml(conv.name || 'Анонім')}</span>
            <span class="conversation-snippet">${preview}</span>
          </div>
          <span class="conversation-meta">${escapeHtml(timestamp)}</span>
        </button>
      `;
    })
    .join('');
}

function renderThread(conversation) {
  if (!chatThread) return;
  if (!conversation) {
    chatHeaderTitle.textContent = 'Оберіть чат';
    chatThread.innerHTML = '<div class="chat-empty-state">Оберіть чат зліва, щоб почати листування.</div>';
    replyBody.disabled = true;
    replySubmit.disabled = true;
    return;
  }
  chatHeaderTitle.textContent = conversation.name;
  if (conversation.partnerId && chatHeaderTitle) {
    chatHeaderTitle.dataset.profileId = conversation.partnerId;
  } else if (chatHeaderTitle) {
    chatHeaderTitle.removeAttribute('data-profile-id');
  }
  if (!conversation.messages || !conversation.messages.length) {
    chatThread.innerHTML = '<div class="chat-empty-state">У цьому чаті ще немає повідомлень.</div>';
  } else {
    chatThread.innerHTML = conversation.messages
      .map(msg => {
        const isOutgoing = !!msg.fromMe || msg.sentByMe || msg.direction === 'outgoing';
        const bubbleClass = isOutgoing ? 'message message--outgoing' : 'message message--incoming';
        const escapedBody = escapeHtml(msg.body || '').replace(/\n/g, '<br>');
        const label = isOutgoing ? 'Ви' : escapeHtml(conversation.name || 'Анонім');
        const time = escapeHtml(formatDate(msg.createdAt || msg.updatedAt || ''));
        return `
          <article class="${bubbleClass}">
            <p>${escapedBody}</p>
            <div class="message-meta">
              <span>${label}</span>
              <span>${time}</span>
            </div>
          </article>
        `;
      })
      .join('');
  }
  replyBody.disabled = !conversation.canReply;
  replySubmit.disabled = !conversation.canReply;
  setTimeout(() => {
    chatThread.scrollTop = chatThread.scrollHeight;
  }, 50);
}

function openMobileChat() {
  if (window.innerWidth <= 980 && chatShell) {
    chatShell.classList.add('mobile-chat-open');
  }
}

function closeMobileChat() {
  if (chatShell) {
    chatShell.classList.remove('mobile-chat-open');
  }
}

function selectConversation(id) {
  activeConversationId = id;
  const conversation = conversations.find(item => item.id === id);
  renderConversationList(conversations);
  renderThread(conversation);
  openMobileChat();
}

function addOutgoingMessage(text) {
  const conversation = conversations.find(item => item.id === activeConversationId);
  if (!conversation) return;
  conversation.messages.push({
    _id: `out_${Date.now()}`,
    body: text,
    createdAt: new Date().toISOString(),
    fromMe: true,
  });
  renderThread(conversation);
}

async function handleReplySubmit(event) {
  event.preventDefault();
  const text = replyBody.value.trim();
  if (!text) {
    showToast('Введіть текст повідомлення', 'error');
    return;
  }
  const conversation = conversations.find(item => item.id === activeConversationId);
  if (!conversation) {
    showToast('Оберіть чат', 'error');
    return;
  }
  const lastIncoming = [...conversation.messages].reverse().find(msg => !msg.fromMe && !msg.sentByMe);
  const messageId = lastIncoming?._id || conversation.messages[conversation.messages.length - 1]?._id;
  if (!messageId) {
    showToast('Не вдалося знайти повідомлення для відповіді', 'error');
    return;
  }
  replySubmit.disabled = true;
  try {
    await requestApi(`/api/user/messages/${messageId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text }),
    });
    addOutgoingMessage(text);
    replyBody.value = '';
    showToast('Повідомлення надіслано');
  } catch (err) {
    showToast(err.message || 'Не вдалося надіслати', 'error');
  } finally {
    replySubmit.disabled = false;
  }
}

async function refreshConversations() {
  if (isRefreshingMessages) return;
  isRefreshingMessages = true;
  try {
    const data = await requestApi('/api/user/messages');
    const updated = buildConversations(data.messages || []);
    const currentActive = activeConversationId;
    conversations = updated;

    if (!conversations.length) {
      activeConversationId = null;
      renderConversationList([]);
      renderThread(null);
      return;
    }

    if (!currentActive || !conversations.some(conv => conv.id === currentActive)) {
      activeConversationId = conversations[0].id;
    } else {
      activeConversationId = currentActive;
    }

    renderConversationList(conversations);
    const activeConv = conversations.find(conv => conv.id === activeConversationId) || conversations[0];
    renderThread(activeConv);
  } catch (err) {
    console.warn('Chat refresh error:', err.message || err);
  } finally {
    isRefreshingMessages = false;
  }
}

async function loadConversations() {
  try {
    const data = await requestApi('/api/user/messages');
    conversations = buildConversations(data.messages || []);
    if (!conversations.length) {
      renderConversationList([]);
      renderThread(null);
      return;
    }
    activeConversationId = conversations[0].id;
    renderConversationList(conversations);
    renderThread(conversations[0]);
  } catch (err) {
    if (conversationList) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.textContent = err.message || 'Не вдалося завантажити чати';
      conversationList.innerHTML = '';
      conversationList.appendChild(emptyState);
    }
    renderThread(null);
  }
}

function startMessagePolling() {
  stopMessagePolling();
  pollingTimer = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    refreshConversations();
  }, 5000);
}

function stopMessagePolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

function setupEvents() {
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logoutAndDestroySession);
  }
  if (conversationList) {
    conversationList.addEventListener('click', event => {
      const nameLink = event.target.closest('.conversation-name');
      if (nameLink) {
        const profileId = nameLink.dataset.profileId;
        if (profileId && profileId !== 'anonymous') {
          window.location.href = `/profile.html?id=${profileId}`;
        }
        return;
      }

      const button = event.target.closest('.conversation-item');
      if (!button) return;
      const id = button.dataset.id;
      if (id) selectConversation(id);
    });
  }
  if (conversationSearch) {
    conversationSearch.addEventListener('input', () => {
      const query = conversationSearch.value.trim().toLowerCase();
      const filtered = conversations.filter(conv => {
        return conv.name.toLowerCase().includes(query) || conv.snippet.toLowerCase().includes(query);
      });
      renderConversationList(filtered);
    });
  }
  if (backBtn) {
    backBtn.addEventListener('click', closeMobileChat);
  }
  if (chatHeaderTitle) {
    chatHeaderTitle.addEventListener('click', () => {
      const profileId = chatHeaderTitle.dataset.profileId;
      if (profileId && profileId !== 'anonymous') {
        window.location.href = `/profile.html?id=${profileId}`;
      }
    });
  }
  if (chatReplyForm) {
    chatReplyForm.addEventListener('submit', handleReplySubmit);
  }
  if (replyBody && chatReplyForm) {
    replyBody.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (typeof chatReplyForm.requestSubmit === 'function') {
          chatReplyForm.requestSubmit();
        } else {
          chatReplyForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      }
    });
  }
  window.addEventListener('resize', () => {
    if (window.innerWidth > 980) {
      closeMobileChat();
    }
  });
}

(async () => {
  setAppViewportHeight();
  window.addEventListener('resize', setAppViewportHeight);
  window.addEventListener('orientationchange', setAppViewportHeight);

  await ensureToken();
  setupEvents();
  await loadConversations();
  startMessagePolling();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshConversations();
    }
  });
  window.addEventListener('beforeunload', stopMessagePolling);
})();

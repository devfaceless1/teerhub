const params = new URLSearchParams(window.location.search);
const id = params.get('id');

const vacancyTitle = document.getElementById('vacancyTitle');
const vacancyOrg = document.getElementById('vacancyOrg');
const vacancyPosterRole = document.getElementById('vacancyPosterRole');
const vacancyDesc = document.getElementById('vacancyDesc');
const vacancyContact = document.getElementById('vacancyContact');
const vacancyTags = document.getElementById('vacancyTags');
const applyLink = document.getElementById('applyLink');
const messageForm = document.getElementById('messageForm');
const msgSubject = document.getElementById('msgSubject');
const msgBody = document.getElementById('msgBody');
const msgStatus = document.getElementById('msgStatus');

if (!id) {
  vacancyTitle.textContent = 'Вакансія не знайдена';
} else {
  fetch(`/api/vacancies/${id}`)
    .then(async res => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data?.message || 'Не вдалося завантажити вакансію';
        if (vacancyOrg) vacancyOrg.textContent = '';
        if (vacancyPosterRole) {
          vacancyPosterRole.textContent = '';
          vacancyPosterRole.className = 'creator-badge';
        }
        if (vacancyDesc) vacancyDesc.textContent = '';
        if (vacancyContact) vacancyContact.innerHTML = '';
        if (vacancyTags) vacancyTags.innerHTML = '';
        if (applyLink) {
          applyLink.href = '#';
          applyLink.textContent = 'Контакти відсутні';
        }
        throw new Error(message);
      }
      return data;
    })
    .then(data => {
      const v = data.vacancy;
      if (!v) {
        vacancyTitle.textContent = data?.message || 'Не вдалося завантажити вакансію';
        return;
      }
      vacancyTitle.textContent = v.title;
      vacancyOrg.textContent = v.createdBy?.name || '';
      if (vacancyPosterRole) {
        const posterRole = v.createdBy?.role || 'volunteer';
        const roleLabel = posterRole === 'organization'
          ? 'Організація'
          : posterRole === 'company'
            ? 'Компанія'
            : 'Волонтер';
        vacancyPosterRole.textContent = roleLabel;
        vacancyPosterRole.className = `creator-badge ${posterRole === 'organization' ? 'org' : posterRole === 'company' ? 'company' : 'vol'}`;
      }
      vacancyDesc.textContent = v.description || '';

      if (vacancyContact) {
        vacancyContact.innerHTML = '';
        if (v.contactName) {
          const nameTag = document.createElement('span');
          nameTag.className = 'contact-label';
          nameTag.textContent = 'Контакт:';
          const nameValue = document.createElement('span');
          nameValue.textContent = ` ${v.contactName}`;
          vacancyContact.append(nameTag, nameValue);
        }
        if (v.contactEmail) {
          const emailLink = document.createElement('a');
          emailLink.href = `mailto:${v.contactEmail}`;
          emailLink.textContent = v.contactEmail;
          vacancyContact.append(emailLink);
        }
        if (v.contactPhone) {
          const phoneTag = document.createElement('span');
          phoneTag.textContent = v.contactPhone;
          vacancyContact.append(phoneTag);
        }
      }

      if (vacancyTags) {
        vacancyTags.innerHTML = '';
        (v.tags || []).forEach(tag => {
          const span = document.createElement('span');
          span.textContent = tag;
          vacancyTags.append(span);
        });
      }

      if (applyLink) {
        applyLink.href = v.contactEmail ? `mailto:${v.contactEmail}` : '#';
        applyLink.textContent = v.contactEmail ? 'Написати' : (v.contactPhone ? 'Зателефонувати' : 'Контакти відсутні');
        applyLink.classList.toggle('disabled', !v.contactEmail && !v.contactPhone);
      }
      // wire message form
      if (messageForm) {
        messageForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          msgStatus.textContent = '';
          const subject = msgSubject.value.trim();
          const body = msgBody.value.trim();
          if (!subject || !body) {
            msgStatus.textContent = 'Заповніть тему та текст повідомлення.';
            return;
          }
          try {
            const headers = { 'Content-Type': 'application/json' };
            const token = localStorage.getItem('teerhub_token');
            if (token) {
              headers.Authorization = `Bearer ${token}`;
            }
            const res = await fetch(`/api/vacancies/${id}/message`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ subject, body }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Помилка');
            msgStatus.textContent = 'Повідомлення надіслано.';
            msgSubject.value = '';
            msgBody.value = '';
          } catch (err) {
            console.error(err);
            msgStatus.textContent = err.message || 'Не вдалося надіслати повідомлення';
          }
        });
      }
    })
    .catch(err => {
      console.error(err);
      vacancyTitle.textContent = err.message || 'Не вдалося завантажити вакансію';
    });
}

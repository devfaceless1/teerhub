// Main frontend script (placeholder)
console.log('public/scripts/main.js loaded');

async function handleAuthLinkClick(event) {
  const target = event.currentTarget;
  if (typeof checkSessionAndRestoreToken !== 'function') {
    return;
  }

  event.preventDefault();
  const { loggedIn } = await checkSessionAndRestoreToken();

  if (loggedIn) {
    window.location.href = '/dashboard';
  } else {
    window.location.href = target.href;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const elements = document.querySelectorAll('.fade-up');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
      }
    });
  }, {
    threshold: 0.2
  });

  elements.forEach(el => observer.observe(el));

  const authLinks = document.querySelectorAll('a[href="/login"], a[href="/register"]');
  authLinks.forEach(link => {
    link.addEventListener('click', handleAuthLinkClick);
  });
});
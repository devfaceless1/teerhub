const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileMenu = document.getElementById('mobileMenu');
const mobileMenuClose = document.getElementById('mobileMenuClose');
const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');

function toggleMobileMenu(open) {
  if (!mobileMenu) return;
  mobileMenu.classList.toggle('open', open);
  mobileMenu.setAttribute('aria-hidden', String(!open));
  
  if (open) {
    document.body.style.overflow = 'hidden';
    // Ensure menu is on top
    mobileMenu.style.zIndex = '99999';
    if (hamburgerBtn) hamburgerBtn.style.zIndex = '99998';
  } else {
    // Only clear overflow if no other overlay (e.g. filter modal) is open
    const filterModal = document.getElementById('filterModal');
    if (!filterModal || !filterModal.classList.contains('open')) {
      document.body.style.overflow = '';
    }
    // Reset z-index
    mobileMenu.style.zIndex = '';
    if (hamburgerBtn) hamburgerBtn.style.zIndex = '';
  }
}

if (hamburgerBtn && mobileMenu && mobileMenuClose) {
  hamburgerBtn.addEventListener('click', () => toggleMobileMenu(true));
  mobileMenuClose.addEventListener('click', () => toggleMobileMenu(false));

  mobileMenu.addEventListener('click', event => {
    // Close menu when clicking on a link
    if (event.target.tagName === 'A') {
      toggleMobileMenu(false);
    }
    // Logout button in mobile menu
    if (event.target.id === 'mobileLogoutBtn') {
      if (typeof logoutAndDestroySession === 'function') {
        logoutAndDestroySession();
      }
      toggleMobileMenu(false);
    }
    // Close menu when clicking on the backdrop
    if (event.target === mobileMenu) {
      toggleMobileMenu(false);
    }
  });

  // Close menu on Escape key
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && mobileMenu.classList.contains('open')) {
      toggleMobileMenu(false);
    }
  });
}

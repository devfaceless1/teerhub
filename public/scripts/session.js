/**
 * Session Management Helper
 * Handles automatic session restoration from cookies
 */

// Check if user is logged in via session
async function checkSessionAndRestoreToken() {
  try {
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include', // Include cookies
    });

    if (response.ok) {
      const data = await response.json();
      if (data.token) {
        // Save token to localStorage for API calls
        localStorage.setItem('teerhub_token', data.token);
        return { user: data.user, token: data.token, loggedIn: true };
      }
    } else {
      localStorage.removeItem('teerhub_token');
    }
  } catch (err) {
    console.error('[SESSION] Error checking session:', err);
    localStorage.removeItem('teerhub_token');
  }

  return { loggedIn: false };
}

// Logout and destroy session
async function logoutAndDestroySession() {
  // Clear any stored auth token immediately so the client cannot use stale credentials.
  localStorage.removeItem('teerhub_token');

  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include', // Include cookies
    });

    if (!response.ok) {
      console.warn('[SESSION] Logout request failed:', response.status);
    }
  } catch (err) {
    console.error('[SESSION] Logout error:', err);
  }

  window.location.href = '/login';
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    checkSessionAndRestoreToken,
    logoutAndDestroySession,
  };
}

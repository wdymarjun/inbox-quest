/**
 * Authentication and Google OAuth Helper for Inbox Quest.
 *
 * Coordinates with the backend OAuth service:
 * - Checks status via GET /api/auth/status
 * - Initiates real Google OAuth flow via GET /api/auth/google
 * - Signs out via POST /api/auth/logout
 *
 * Security rules enforced:
 * - No client secrets or authorization codes in frontend code or storage.
 * - Credential collection and verification happen entirely on Google-hosted pages.
 * - HTTP-only session cookies managed by the backend; tokens are never readable to JS.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// In-memory auth state
let currentAuthState = {
  configured: false,
  authenticated: false,
  user: null, // { email, name, picture }
  scope: null,
  scopeDescription: null,
  statusMessage: '',
  loading: false,
};

let authListeners = [];

export function subscribeAuthState(listener) {
  authListeners.push(listener);
  listener(currentAuthState);
  return () => {
    authListeners = authListeners.filter(l => l !== listener);
  };
}

function notifyAuthState(newState) {
  currentAuthState = { ...currentAuthState, ...newState };
  authListeners.forEach(listener => listener(currentAuthState));
}

/**
 * Fetch OAuth status from backend.
 * Determines if OAuth is configured and whether an authenticated session cookie exists.
 */
export async function checkAuthStatus() {
  notifyAuthState({ loading: true });
  try {
    const res = await fetch(`${BASE_URL}/api/auth/status`, {
      method: 'GET',
      credentials: 'include', // sends HTTP-only session cookies
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const data = await res.json();
      const state = {
        configured: Boolean(data.configured),
        authenticated: Boolean(data.authenticated),
        user: data.user || null,
        scope: data.scope || 'https://www.googleapis.com/auth/gmail.modify',
        scopeDescription: data.scopeDescription || 'Read and organize Gmail messages without deleting.',
        statusMessage: data.statusMessage || (data.authenticated ? 'Connected to Google' : 'Ready to sign in'),
        loading: false,
      };
      notifyAuthState(state);
      return state;
    }
    
    // Backend returned 404 or non-200 -> OAuth routes not yet implemented on backend
    const unconfiguredState = {
      configured: false,
      authenticated: false,
      user: null,
      scope: null,
      scopeDescription: null,
      statusMessage: 'Backend OAuth service not yet implemented or configured.',
      loading: false,
    };
    notifyAuthState(unconfiguredState);
    return unconfiguredState;
  } catch (err) {
    // Network error or backend offline
    const offlineState = {
      configured: false,
      authenticated: false,
      user: null,
      scope: null,
      scopeDescription: null,
      statusMessage: 'Backend is offline or OAuth endpoint unreachable.',
      loading: false,
    };
    notifyAuthState(offlineState);
    return offlineState;
  }
}

/**
 * Initiates the Google OAuth flow.
 * Directs browser to backend-managed OAuth initiation endpoint.
 * Credentials and consent are handled strictly on Google-hosted pages.
 */
export function initiateGoogleSignIn() {
  notifyAuthState({ loading: true, statusMessage: 'Redirecting to Google…' });
  const googleAuthUrl = `${BASE_URL}/api/auth/google`;
  window.location.href = googleAuthUrl;
}

/**
 * Disconnects / logs out the active Google session.
 */
export async function disconnectGoogle() {
  notifyAuthState({ loading: true });
  try {
    await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    console.warn('Backend logout call completed with local cleanup:', err);
  }

  const signedOutState = {
    configured: currentAuthState.configured,
    authenticated: false,
    user: null,
    statusMessage: 'Signed out from Google account.',
    loading: false,
  };
  notifyAuthState(signedOutState);
  return signedOutState;
}

/**
 * Safely inspects and clears any OAuth return parameters in the URL
 * (e.g., ?auth=success or ?auth_error=access_denied) without leaking raw query strings.
 */
export function consumeUrlAuthParams() {
  if (typeof window === 'undefined' || !window.location.search) {
    return { error: null, success: false };
  }

  const params = new URLSearchParams(window.location.search);
  const authError = params.get('auth_error');
  const authSuccess = params.get('auth');

  let sanitizedError = null;
  if (authError) {
    switch (authError) {
      case 'access_denied':
      case 'cancelled':
        sanitizedError = 'Google sign-in was canceled or access was denied. No changes were made.';
        break;
      case 'scope_denied':
        sanitizedError = 'Required Gmail organizing permissions were not granted. Demo mode remains available.';
        break;
      case 'token_exchange_failed':
      case 'server_error':
        sanitizedError = 'The authentication server encountered an issue. Please try again or use Demo Inbox.';
        break;
      default:
        sanitizedError = 'Google authentication could not be completed. You can continue using Demo Inbox.';
    }
  }

  // Remove auth parameters from browser URL bar without triggering reload
  params.delete('auth_error');
  params.delete('auth');
  params.delete('code'); // safety scrub
  params.delete('state'); // safety scrub
  const newSearch = params.toString();
  const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
  window.history.replaceState({}, document.title, newUrl);

  return {
    error: sanitizedError,
    success: authSuccess === 'success',
  };
}

/**
 * Development UI Preview Helper:
 * Allows developers and reviewers to test all UI states (Signed Out, Signed In,
 * Error, Unconfigured) without having real Google cloud credentials registered yet.
 */
export function setMockAuthStateForTesting(preset) {
  if (preset === 'signed_in') {
    notifyAuthState({
      configured: true,
      authenticated: true,
      user: {
        email: 'developer.preview@gmail.com',
        name: 'Alex Developer',
        picture: '',
      },
      scope: 'https://www.googleapis.com/auth/gmail.modify',
      scopeDescription: 'Read, modify, and organize messages (deletions forbidden)',
      statusMessage: 'Connected as developer.preview@gmail.com',
      loading: false,
    });
  } else if (preset === 'signed_out') {
    notifyAuthState({
      configured: true,
      authenticated: false,
      user: null,
      scope: 'https://www.googleapis.com/auth/gmail.modify',
      scopeDescription: 'Read and organize Gmail messages without deleting.',
      statusMessage: 'Ready to sign in with Google',
      loading: false,
    });
  } else if (preset === 'unconfigured') {
    notifyAuthState({
      configured: false,
      authenticated: false,
      user: null,
      scope: null,
      scopeDescription: null,
      statusMessage: 'Backend OAuth service not configured on server.',
      loading: false,
    });
  }
}


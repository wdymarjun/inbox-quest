import { getMockInboxBatch, mockClassify } from './mock/mockInbox';
export {
  checkAuthStatus,
  initiateGoogleSignIn,
  disconnectGoogle,
  subscribeAuthState,
  consumeUrlAuthParams,
  setMockAuthStateForTesting,
} from './auth';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export let isBackendConnected = null;
let backendListeners = [];

export function subscribeBackendStatus(listener) {
  backendListeners.push(listener);
  listener(isBackendConnected);
  return () => {
    backendListeners = backendListeners.filter(l => l !== listener);
  };
}

function updateBackendStatus(connected) {
  if (isBackendConnected !== connected) {
    isBackendConnected = connected;
    backendListeners.forEach(l => l(connected));
  }
}

// Local in-memory state for fallback mode
const localActions = new Map();
const localEmailStates = new Map();

/**
 * Fetch inbox emails batch (size: 10, 25, 50)
 * source: 'demo' | 'gmail'
 */
export async function fetchInbox(size = 25, source = 'demo') {
  try {
    const url = `${BASE_URL}/api/inbox?size=${size}${source === 'gmail' ? '&source=gmail' : ''}`;
    const res = await fetch(url, {
      credentials: 'include', // passes session cookie if signed in
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();

    if (source === 'gmail') {
      if (data?.source !== 'gmail' || !Array.isArray(data.emails)) {
        throw new Error('The backend did not confirm that this is a live Gmail inbox.');
      }
      updateBackendStatus(true);
      return { emails: data.emails, fromBackend: true, source };
    }

    if (Array.isArray(data) && data.length > 0) {
      updateBackendStatus(true);
      return { emails: data, fromBackend: true, source };
    }

    updateBackendStatus(false);
  } catch (err) {
    updateBackendStatus(false);
    if (source === 'gmail') {
      throw new Error('Could not load a verified Gmail inbox. Check the backend connection and try again.');
    }
  }

  return { emails: getMockInboxBatch(size), fromBackend: false, source: 'demo' };
}

/**
 * Classify emails
 */
export async function classifyEmails(emails, source = 'demo') {
  try {
    const res = await fetch(`${BASE_URL}/api/classify`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    if (source === 'gmail') {
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('The backend did not return verified Gmail classifications.');
      }
      updateBackendStatus(true);
      return { classifications: data, fromBackend: true };
    }

    if (Array.isArray(data) && data.length > 0) {
      updateBackendStatus(true);
      return { classifications: data, fromBackend: true };
    }
    updateBackendStatus(false);
  } catch (err) {
    updateBackendStatus(false);
    if (source === 'gmail') {
      throw new Error('Could not classify the Gmail messages. No Gmail changes have been made.');
    }
  }

  return { classifications: mockClassify(emails), fromBackend: false };
}

/**
 * Apply batch actions
 */
export async function applyActions(actions, source = 'demo') {
  try {
    const endpoint = source === 'gmail' ? '/api/gmail/actions/apply' : '/api/actions/apply';
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions }),
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    updateBackendStatus(true);
    return data;
  } catch (err) {
    updateBackendStatus(false);
    if (source === 'gmail') {
      throw new Error('Gmail actions could not be confirmed by the backend. No local-only success was recorded.');
    }
  }

  // Local fallback apply
  const applied = [];
  const rejected = [];

  for (const item of actions) {
    if (item.action === 'delete') {
      rejected.push({ email_id: item.email_id, reason: 'Deletions are forbidden' });
      continue;
    }
    const actionId = `fallback-act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const record = {
      action_id: actionId,
      email_id: item.email_id,
      action: item.action,
      applied_at: new Date().toISOString(),
      undone: false,
    };
    localActions.set(actionId, record);
    localEmailStates.set(item.email_id, item.action);
    applied.push(record);
  }

  return { applied, rejected };
}

/**
 * Undo actions
 */
export async function undoActions(actionIds, source = 'demo') {
  try {
    const endpoint = source === 'gmail' ? '/api/gmail/actions/undo' : '/api/actions/undo';
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_ids: actionIds }),
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    updateBackendStatus(true);
    return data;
  } catch (err) {
    updateBackendStatus(false);
    if (source === 'gmail') {
      throw new Error('Gmail undo could not be confirmed by the backend. Please check the account and try again.');
    }
  }

  // Local fallback undo
  const undone = [];
  const failed = [];

  for (const id of actionIds) {
    const record = localActions.get(id);
    if (!record) {
      failed.push({ action_id: id, reason: 'Action ID not found' });
      continue;
    }
    record.undone = true;
    localEmailStates.delete(record.email_id);
    undone.push(id);
  }

  return { undone, failed };
}

/**
 * Fetch summary metrics
 */
export async function fetchSummary() {
  try {
    const res = await fetch(`${BASE_URL}/api/summary`, {
      credentials: 'include',
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    updateBackendStatus(true);
    return data;
  } catch (err) {
    updateBackendStatus(false);
  }

  // Local fallback summary
  let archived = 0;
  let labeledReadLater = 0;
  let flaggedImportant = 0;
  let leftInInbox = 0;

  for (const [, state] of localEmailStates.entries()) {
    if (state === 'archive') archived++;
    if (state === 'label_read_later') labeledReadLater++;
    if (state === 'flag_important') flaggedImportant++;
    if (state === 'leave_in_inbox') leftInInbox++;
  }

  return {
    total_reviewed: localEmailStates.size,
    archived,
    labeled_read_later: labeledReadLater,
    flagged_important: flaggedImportant,
    left_in_inbox: leftInInbox,
    uncertain_unmodified: 0,
    high_priority_protected: flaggedImportant,
  };
}

export async function askInboxQuestAssistant({ message, history, screen }) {
  const response = await fetch(`${BASE_URL}/api/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      history,
      pageContext: screen ? { screen } : undefined,
    }),
    signal: AbortSignal.timeout(30000),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || 'The Inbox Quest assistant is temporarily unavailable. Please try again.');
  }
  if (typeof data?.answer !== 'string' || !data.answer.trim()) {
    throw new Error('The Inbox Quest assistant returned an invalid response. Please try again.');
  }

  return data.answer.trim();
}

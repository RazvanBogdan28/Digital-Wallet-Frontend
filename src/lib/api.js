// Thin client for the Digital Wallet API.
// - Attaches the bearer token to every authenticated call.
// - On a 401 it refreshes the access token once (single-flight) and retries.
// - Turns every failure into an ApiError with a message that is safe to show.

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const STORAGE_KEY = 'dw.session';

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

let session = readSession();
let refreshing = null;
let onSessionLost = () => {};

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export const getSession = () => session;

export function saveSession(next) {
  session = next;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode): keep the session in memory only */
  }
}

export function onSessionExpired(handler) {
  onSessionLost = handler;
}

const FALLBACKS = {
  0: "Can't reach the server. Check your connection and try again.",
  400: 'That request was not valid. Check the fields and try again.',
  401: 'Your session has expired. Sign in again.',
  403: "You don't have access to this.",
  404: 'We could not find that.',
  409: 'That conflicts with the current state. Refresh and try again.',
};

function collectMessages(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectMessages);
  if (value && typeof value === 'object') {
    if (typeof value.defaultMessage === 'string') return [value.defaultMessage];
    if (typeof value.message === 'string') return [value.message];
    return Object.values(value).flatMap(collectMessages);
  }
  return [];
}

function messageFrom(data, status) {
  if (data && typeof data === 'object') {
    for (const key of ['message', 'detail', 'error']) {
      if (typeof data[key] === 'string' && data[key].trim()) return data[key];
    }
    const nested = collectMessages(data.errors ?? data.violations ?? data.fieldErrors);
    if (nested.length) return nested.join('. ');
  }
  if (typeof data === 'string' && data.trim() && data.length < 200 && !data.startsWith('<')) {
    return data;
  }
  if (status >= 500) return 'The server ran into a problem. Try again in a moment.';
  return FALLBACKS[status] ?? 'Something went wrong. Try again.';
}

function refreshAccessToken() {
  if (!refreshing) {
    refreshing = fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = await res.json();
        saveSession({ ...session, accessToken: data.accessToken });
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function request(path, { method = 'GET', body, headers = {}, auth = true, retried = false } = {}) {
  const finalHeaders = { ...headers };
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';
  if (auth && session?.accessToken) finalHeaders.Authorization = `Bearer ${session.accessToken}`;

  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, messageFrom(null, 0));
  }

  if (res.status === 401 && auth && session?.refreshToken && !retried) {
    if (await refreshAccessToken()) {
      return request(path, { method, body, headers, auth, retried: true });
    }
    saveSession(null);
    onSessionLost();
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) throw new ApiError(res.status, messageFrom(data, res.status), data);
  return data;
}

export const api = {
  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  register: (payload) => request('/api/users', { method: 'POST', body: payload, auth: false }),
  logout: async (refreshToken) => {
    try {
      await request('/api/auth/logout', { method: 'POST', body: { refreshToken }, auth: false });
    } catch {
      /* the local session is already gone; a failed revoke should not block sign-out */
    }
  },

  user: (id) => request(`/api/users/${id}`),
  users: () => request('/api/users'),

  wallet: (id) => request(`/api/wallets/${id}`),
  walletsOf: (userId) => request(`/api/wallets/user/${userId}`),
  createWallet: (userId, currency) =>
    request('/api/wallets', { method: 'POST', body: { userId, currency } }),
  deposit: (id, amount) => request(`/api/wallets/${id}/deposit`, { method: 'POST', body: { amount } }),
  transfer: (fromId, { toWalletId, amount, description }, idempotencyKey) =>
    request(`/api/wallets/${fromId}/transfer`, {
      method: 'POST',
      body: { toWalletId, amount, description },
      headers: { 'Idempotency-Key': idempotencyKey },
    }),

  transactions: (walletId, page = 0, size = 10) =>
    request(`/api/transactions/wallet/${walletId}?page=${page}&size=${size}`),
};

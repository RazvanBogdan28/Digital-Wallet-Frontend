export const CURRENCIES = ['EUR', 'USD', 'RON'];

export const CURRENCY_INFO = {
  EUR: { name: 'Euro', symbol: '€', before: true, color: '#2C4FDB' },
  USD: { name: 'US dollar', symbol: '$', before: true, color: '#23805A' },
  RON: { name: 'Romanian leu', symbol: 'lei', before: false, color: '#DB4A31' },
};

const numberFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const shortDayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

export function splitAmount(value) {
  const parts = numberFmt.formatToParts(Number(value) || 0);
  let whole = '';
  let cents = '00';
  for (const part of parts) {
    if (part.type === 'fraction') cents = part.value;
    else if (part.type !== 'decimal') whole += part.value;
  }
  return { whole, cents };
}

export function formatMoney(value, currency, { signed = false } = {}) {
  const n = Number(value) || 0;
  const abs = numberFmt.format(Math.abs(n));
  const sign = n < 0 ? '−' : signed && n > 0 ? '+' : '';
  const info = CURRENCY_INFO[currency];
  if (!info) return `${sign}${abs} ${currency ?? ''}`.trim();
  return info.before ? `${sign}${info.symbol}${abs}` : `${sign}${abs} ${info.symbol}`;
}

export const formatDay = (value) => dayFmt.format(new Date(value));
export const formatShortDay = (value) => shortDayFmt.format(new Date(value));
export const formatTime = (value) => timeFmt.format(new Date(value));

// Accepts "25", "25.5", "25,50". Returns a number with at most 2 decimals, or null.
export function parseAmount(raw) {
  const s = String(raw).trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n >= 0.01 ? n : null;
}

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const titleCase = (s = '') =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/_/g, ' ') : '';

export const sortWallets = (wallets) =>
  [...wallets].sort(
    (a, b) => CURRENCIES.indexOf(a.currency) - CURRENCIES.indexOf(b.currency) || a.id - b.id,
  );

export const initials = (user) =>
  `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || '?';

export const newKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const CURRENCIES = ['EUR', 'USD', 'RON'];

export const CURRENCY_INFO = {
  EUR: { name: 'Euro', symbol: '€', before: true, color: '#2C4FDB' },
  USD: { name: 'US dollar', symbol: '$', before: true, color: '#23805A' },
  RON: { name: 'Romanian leu', symbol: 'lei', before: false, color: '#DB4A31' },
};

const MAX_AMOUNT_CENTS = 9999999999999999999n;

const dayFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const shortDayFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
});

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
});

// Converts a decimal amount to an exact integer number of cents.
export function toCents(value) {
  const text = String(value).trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);

  if (!match) {
    throw new Error('Invalid money amount.');
  }

  const whole = BigInt(match[2]);
  const fraction = BigInt((match[3] ?? '').padEnd(2, '0'));
  const cents = whole * 100n + fraction;

  return match[1] === '-' ? -cents : cents;
}

// Converts exact cents back to a decimal string.
export function fromCents(cents) {
  if (typeof cents !== 'bigint') {
    throw new Error('Money calculations must use integer cents.');
  }

  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const whole = absolute / 100n;
  const fraction = String(absolute % 100n).padStart(2, '0');

  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

export function compareMoney(left, right) {
  const a = toCents(left);
  const b = toCents(right);

  return a < b ? -1 : a > b ? 1 : 0;
}

function groupedWhole(absoluteCents) {
  return String(absoluteCents / 100n)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function splitAmount(value) {
  const cents = toCents(value);
  const absolute = cents < 0n ? -cents : cents;

  return {
    whole: `${cents < 0n ? '-' : ''}${groupedWhole(absolute)}`,
    cents: String(absolute % 100n).padStart(2, '0'),
  };
}

export function formatMoney(value, currency, { signed = false } = {}) {
  const cents = toCents(value);
  const absolute = cents < 0n ? -cents : cents;
  const fraction = String(absolute % 100n).padStart(2, '0');
  const amount = `${groupedWhole(absolute)}.${fraction}`;
  const sign = cents < 0n ? '−' : signed && cents > 0n ? '+' : '';
  const info = CURRENCY_INFO[currency];

  if (!info) {
    return `${sign}${amount} ${currency ?? ''}`.trim();
  }

  return info.before
      ? `${sign}${info.symbol}${amount}`
      : `${sign}${amount} ${info.symbol}`;
}

export const formatDay = (value) => dayFmt.format(new Date(value));
export const formatShortDay = (value) =>
    shortDayFmt.format(new Date(value));
export const formatTime = (value) => timeFmt.format(new Date(value));

// Accepts "25", "25.5", "25,50".
// Returns an exact decimal string, or null when invalid.
export function parseAmount(raw) {
  const text = String(raw).trim().replace(',', '.');

  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    return null;
  }

  const cents = toCents(text);

  if (cents < 1n || cents > MAX_AMOUNT_CENTS) {
    return null;
  }

  return fromCents(cents);
}

// Kept temporarily for existing callers.
// We will remove its use from money calculations in ledger.js.
export const round2 = (n) =>
    Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const titleCase = (s = '') =>
    s
        ? s.charAt(0).toUpperCase() +
        s.slice(1).toLowerCase().replace(/_/g, ' ')
        : '';

export const sortWallets = (wallets) =>
    [...wallets].sort(
        (a, b) =>
            CURRENCIES.indexOf(a.currency) - CURRENCIES.indexOf(b.currency) ||
            a.id - b.id,
    );

export const initials = (user) =>
    `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`
        .toUpperCase() || '?';

export const newKey = () =>
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
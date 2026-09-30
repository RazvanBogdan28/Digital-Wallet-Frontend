import { api } from './api';
import { fromCents, toCents, titleCase } from './format';

const timeOf = (tx) => new Date(tx.createdAt).getTime() || 0;

export const byNewest = (a, b) =>
    timeOf(b) - timeOf(a) || b.id - a.id;

const isDeposit = (tx) =>
    String(tx.type || '').toUpperCase().includes('DEPOSIT');

// in: incoming money; out: outgoing money;
// internal: transfers between wallets belonging to the same user.
export function direction(tx, myIds) {
  if (isDeposit(tx)) return 'in';

  const fromMine = myIds.has(tx.fromWalletId);
  const toMine = myIds.has(tx.toWalletId);

  if (fromMine && toMine) return 'internal';
  if (toMine) return 'in';
  if (fromMine) return 'out';

  return 'internal';
}

function signedCents(tx, walletId) {
  const dir = direction(tx, new Set([walletId]));
  const amount = toCents(tx.amount);

  return dir === 'in' ? amount : dir === 'out' ? -amount : 0n;
}

// Returns an exact decimal string.
export function signedAmount(tx, walletId) {
  return fromCents(signedCents(tx, walletId));
}

export function toRows(transactions, myIds) {
  return transactions.map((tx) => {
    const dir = direction(tx, myIds);
    const amount = toCents(tx.amount);
    let title = tx.description?.trim();
    let detail;

    if (isDeposit(tx)) {
      title ||= 'Deposit';
      detail = `Into wallet No. ${tx.toWalletId}`;
    } else if (dir === 'in') {
      title ||= 'Money received';
      detail = `From wallet No. ${tx.fromWalletId}`;
    } else if (dir === 'out') {
      title ||= 'Money sent';
      detail = `To wallet No. ${tx.toWalletId}`;
    } else {
      title ||= 'Transfer between your wallets';
      detail = `Wallet No. ${tx.fromWalletId} to No. ${tx.toWalletId}`;
    }

    return {
      id: tx.id,
      dir,
      title,
      detail,
      amount: fromCents(dir === 'out' ? -amount : amount),
      currency: tx.currency,
      status: titleCase(tx.status),
      createdAt: tx.createdAt,
    };
  });
}

// Fetches a recent transaction window for the chart.
export async function fetchRecentWindow(walletId) {
  const first = await api.transactions(walletId, 0, 100);

  if (first.totalPages <= 1) {
    return { items: first.content, complete: true };
  }

  const last = await api.transactions(
      walletId,
      first.totalPages - 1,
      100,
  );

  if (first.totalPages === 2) {
    return {
      items: [...first.content, ...last.content],
      complete: true,
    };
  }

  const newest = (page) =>
      Math.max(0, ...page.content.map(timeOf));

  const winner = newest(first) >= newest(last) ? first : last;

  return { items: winner.content, complete: false };
}

// Rebuilds balances using exact integer cents.
// Each point keeps its balance as a decimal string.
export function balanceSeries(items, walletId, currentBalance) {
  const newestFirst = [...items].sort(byNewest);
  let balance = toCents(currentBalance);
  const latest = newestFirst.length ? timeOf(newestFirst[0]) : 0;

  const points = [
    {
      ts: Math.max(Date.now(), latest),
      balance: fromCents(balance),
    },
  ];

  for (const tx of newestFirst) {
    points.push({
      ts: timeOf(tx),
      balance: fromCents(balance),
      tx,
    });

    balance -= signedCents(tx, walletId);
  }

  return points.reverse();
}
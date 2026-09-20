import { api } from './api';
import { round2, titleCase } from './format';

const timeOf = (tx) => new Date(tx.createdAt).getTime() || 0;
export const byNewest = (a, b) => timeOf(b) - timeOf(a) || b.id - a.id;

const isDeposit = (tx) => String(tx.type || '').toUpperCase().includes('DEPOSIT');

// in: money arrives in one of "my" wallets, out: leaves one, internal: moves between my own wallets.
export function direction(tx, myIds) {
  if (isDeposit(tx)) return 'in';
  const fromMine = myIds.has(tx.fromWalletId);
  const toMine = myIds.has(tx.toWalletId);
  if (fromMine && toMine) return 'internal';
  if (toMine) return 'in';
  if (fromMine) return 'out';
  return 'internal';
}

export function signedAmount(tx, walletId) {
  const dir = direction(tx, new Set([walletId]));
  const amount = Number(tx.amount) || 0;
  return dir === 'in' ? amount : dir === 'out' ? -amount : 0;
}

export function toRows(transactions, myIds) {
  return transactions.map((tx) => {
    const dir = direction(tx, myIds);
    const amount = Number(tx.amount) || 0;
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
      amount: dir === 'out' ? -amount : amount,
      currency: tx.currency,
      status: titleCase(tx.status),
      createdAt: tx.createdAt,
    };
  });
}

// The API paginates and does not document its sort order, so we grab the page at each
// end and keep whichever side holds the newest transactions.
export async function fetchRecentWindow(walletId) {
  const first = await api.transactions(walletId, 0, 100);
  if (first.totalPages <= 1) return { items: first.content, complete: true };

  const last = await api.transactions(walletId, first.totalPages - 1, 100);
  if (first.totalPages === 2) return { items: [...first.content, ...last.content], complete: true };

  const newest = (page) => Math.max(0, ...page.content.map(timeOf));
  const winner = newest(first) >= newest(last) ? first : last;
  return { items: winner.content, complete: false };
}

// Rebuilds the balance after each transaction by walking backwards from the current balance.
export function balanceSeries(items, walletId, currentBalance) {
  const newestFirst = [...items].sort(byNewest);
  let balance = round2(currentBalance);
  const latest = newestFirst.length ? timeOf(newestFirst[0]) : 0;
  const points = [{ ts: Math.max(Date.now(), latest), balance }];

  for (const tx of newestFirst) {
    points.push({ ts: timeOf(tx), balance, tx });
    balance = round2(balance - signedAmount(tx, walletId));
  }
  return points.reverse();
}

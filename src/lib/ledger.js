import { api } from './api';
import { fromCents, toCents, titleCase } from './format';

const timeOf = (tx) => new Date(tx.createdAt).getTime();

// Preserve fractional seconds when comparing transaction timestamps.
function preciseTime(value) {
  const milliseconds = Date.parse(value);

  if (!Number.isFinite(milliseconds)) return 0n;

  const fraction =
      String(value).match(/\.(\d+)(?:Z|[+-]\d{2}:\d{2})$/)?.[1] ?? '';

  const remainder = fraction.padEnd(9, '0').slice(3, 9);

  return (
      BigInt(milliseconds) * 1000000n +
      BigInt(remainder || '0')
  );
}

export function byNewest(a, b) {
  const first = preciseTime(a.createdAt);
  const second = preciseTime(b.createdAt);

  if (first === second) return b.id - a.id;

  return first > second ? -1 : 1;
}

const isDeposit = (tx) =>
    String(tx.type || '').toUpperCase() === 'DEPOSIT';

export function direction(tx, myIds) {
  const fromMine = myIds.has(tx.fromWalletId);
  const toMine = myIds.has(tx.toWalletId);

  if (isDeposit(tx) && toMine) return 'in';

  if (fromMine && toMine) return 'internal';
  if (toMine) return 'in';
  if (fromMine) return 'out';

  return 'internal';
}

function signedCents(tx, walletId) {
  if (String(tx.status || '').toUpperCase() !== 'COMPLETED') {
    return 0n;
  }

  const amount = toCents(tx.amount);

  if (isDeposit(tx)) {
    return tx.toWalletId === walletId ? amount : 0n;
  }

  const incoming = tx.toWalletId === walletId ? amount : 0n;
  const outgoing = tx.fromWalletId === walletId ? amount : 0n;

  return incoming - outgoing;
}

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

// The wallet balance and transactions come from one server snapshot.
export async function fetchRecentWindow(walletId) {
  const result = await api.transactionWindow(walletId, 100);

  if (
      !result?.wallet ||
      result.wallet.id !== walletId ||
      !Array.isArray(result.items) ||
      !Number.isFinite(Date.parse(result.snapshotAt))
  ) {
    throw new Error(
        'The server returned invalid wallet history. Please try again.',
    );
  }

  return result;
}

// Calculate with integer cents; expose balances as decimal strings.
export function balanceSeries(
    items,
    walletId,
    currentBalance,
    snapshotAt,
) {
  const unique = new Map(items.map((tx) => [tx.id, tx]));

  const ordered = [...unique.values()]
      .sort(byNewest)
      .reverse();

  const current = toCents(currentBalance);
  const snapshotTime = Date.parse(snapshotAt);

  if (!ordered.length) {
    return [{
      ts: snapshotTime,
      balance: fromCents(current),
      kind: 'snapshot',
    }];
  }

  let balance = current;

  for (const tx of ordered) {
    balance -= signedCents(tx, walletId);
  }

  const points = [{
    ts: timeOf(ordered[0]) - 1,
    balance: fromCents(balance),
    kind: 'baseline',
  }];

  for (const tx of ordered) {
    balance += signedCents(tx, walletId);

    points.push({
      ts: timeOf(tx),
      balance: fromCents(balance),
      tx,
      kind: 'transaction',
    });
  }

  points.push({
    ts: Math.max(
        snapshotTime,
        timeOf(ordered[ordered.length - 1]),
    ),
    balance: fromCents(current),
    kind: 'snapshot',
  });

  return points;
}
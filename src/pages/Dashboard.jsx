import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Send } from 'lucide-react';
import WalletNote from '../components/WalletNote';
import Ledger from '../components/Ledger';
import CopyButton from '../components/CopyButton';
import DepositSheet from '../components/DepositSheet';
import SendSheet from '../components/SendSheet';
import FormError from '../components/FormError';
import { useToast } from '../components/Toast';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import {
  CURRENCIES,
  CURRENCY_INFO,
  sortWallets,
} from '../lib/format';
import { byNewest, fetchRecentWindow, toRows } from '../lib/ledger';

export default function Dashboard() {
  const { user } = useAuth();

  if (!user) return null;

  return <UserDashboard key={user.id} user={user} />;
}

function UserDashboard({ user }) {
  const toast = useToast();

  const [wallets, setWallets] = useState(null);
  const [rows, setRows] = useState(null);
  const [walletError, setWalletError] = useState('');
  const [activityError, setActivityError] = useState('');
  const [walletLoading, setWalletLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [sheet, setSheet] = useState(null);
  const [adding, setAdding] = useState('');

  const mountedRef = useRef(false);
  const requestRef = useRef(0);
  const addingRef = useRef(false);

  const load = useCallback(async () => {
    if (!mountedRef.current) return;

    const requestId = ++requestRef.current;
    const isCurrent = () =>
        mountedRef.current && requestId === requestRef.current;

    setWalletError('');
    setActivityError('');
    setWalletLoading(true);
    setActivityLoading(true);
    setRows(null);

    let list;

    try {
      list = sortWallets(await api.walletsOf(user.id));

      if (!isCurrent()) return;

      setWallets(list);
      setWalletLoading(false);
    } catch (err) {
      if (!isCurrent()) return;

      setWalletError(err.message || 'Could not load your wallets.');
      setWalletLoading(false);
      setActivityLoading(false);
      return;
    }

    try {
      const windows = await Promise.all(
          list.map((wallet) => fetchRecentWindow(wallet.id)),
      );

      if (!isCurrent()) return;

      const unique = new Map();

      windows.forEach((win) => {
        win.items.forEach((tx) => unique.set(tx.id, tx));
      });

      const latest = [...unique.values()]
          .sort(byNewest)
          .slice(0, 8);

      const myIds = new Set(list.map((wallet) => wallet.id));

      setRows(toRows(latest, myIds));
    } catch (err) {
      if (!isCurrent()) return;

      setActivityError(
          err.message || 'Could not load your recent activity.',
      );
    } finally {
      if (isCurrent()) {
        setActivityLoading(false);
      }
    }
  }, [user.id]);

  useEffect(() => {
    mountedRef.current = true;
    load();

    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, [load]);

  async function addWallet(currency) {
    if (
        !mountedRef.current ||
        addingRef.current ||
        walletLoading ||
        walletError
    ) {
      return;
    }

    addingRef.current = true;
    setAdding(currency);

    try {
      await api.createWallet(user.id, currency);

      if (!mountedRef.current) return;

      toast(`${CURRENCY_INFO[currency].name} wallet created`);
      await load();
    } catch (err) {
      if (mountedRef.current) {
        toast(err.message || 'Could not create the wallet.', 'error');
      }
    } finally {
      addingRef.current = false;

      if (mountedRef.current) {
        setAdding('');
      }
    }
  }

  function finished(message) {
    if (!mountedRef.current) return;

    setSheet(null);
    toast(message);
    load();
  }

  if (walletError && !wallets) {
    return (
        <div className="notice">
          <h1>Could not load your wallets</h1>
          <FormError>{walletError}</FormError>
          <button
              type="button"
              className="btn btn-primary"
              disabled={walletLoading}
              onClick={load}
          >
            {walletLoading ? 'Loading…' : 'Try again'}
          </button>
        </div>
    );
  }

  const missing = wallets
      ? CURRENCIES.filter(
          (currency) => !wallets.some((w) => w.currency === currency),
      )
      : [];

  const actionsDisabled =
      walletLoading || Boolean(walletError) || Boolean(adding);

  return (
      <>
        <header className="page-head">
          <div>
            <h1>Hello, {user.firstName}</h1>
            <p className="lede">
              Your wallets, and the latest movements across all of them.
            </p>
          </div>
        </header>

        <section aria-labelledby="wallets-title">
          <div className="section-head">
            <h2 id="wallets-title">Wallets</h2>
            {walletLoading && wallets && (
                <span className="muted">Refreshing wallets…</span>
            )}
          </div>

          {walletError && (
              <div>
                <FormError>{walletError}</FormError>
                <p className="sheet-note">
                  The displayed balances could not be refreshed.
                </p>
                <button
                    type="button"
                    className="btn btn-quiet btn-small"
                    disabled={walletLoading}
                    onClick={load}
                >
                  Retry wallets
                </button>
              </div>
          )}

          {!wallets ? (
              <ul className="wallet-grid" aria-busy="true">
                {[0, 1, 2].map((i) => (
                    <li key={i}>
                      <div className="note skel" />
                    </li>
                ))}
              </ul>
          ) : (
              <ul className="wallet-grid">
                {wallets.map((wallet) => (
                    <li key={wallet.id} className="wallet-item">
                      <Link
                          to={`/wallets/${wallet.id}`}
                          className="note-link"
                          aria-label={
                            `Open ${wallet.currency} wallet No. ${wallet.id}`
                          }
                      >
                        <WalletNote wallet={wallet} />
                      </Link>

                      <div className="note-actions">
                        <button
                            type="button"
                            className="btn btn-quiet btn-small"
                            disabled={actionsDisabled}
                            onClick={() => setSheet({ kind: 'deposit', wallet })}
                        >
                          <Plus size={15} aria-hidden="true" />
                          Deposit
                        </button>

                        <button
                            type="button"
                            className="btn btn-quiet btn-small"
                            disabled={actionsDisabled}
                            onClick={() => setSheet({ kind: 'send', wallet })}
                        >
                          <Send size={15} aria-hidden="true" />
                          Send
                        </button>

                        <CopyButton
                            value={wallet.id}
                            message={`Wallet No. ${wallet.id} copied`}
                            iconOnly
                            label={`Copy wallet No. ${wallet.id}`}
                        />
                      </div>
                    </li>
                ))}

                {missing.map((currency) => (
                    <li key={currency}>
                      <button
                          type="button"
                          className="note-ghost"
                          disabled={actionsDisabled}
                          onClick={() => addWallet(currency)}
                      >
                        <Plus size={20} aria-hidden="true" />
                        <span>
                    {adding === currency
                        ? 'Creating…'
                        : `Add ${CURRENCY_INFO[currency].name} wallet`}
                  </span>
                      </button>
                    </li>
                ))}
              </ul>
          )}
        </section>

        <section className="section" aria-labelledby="activity-title">
          <div className="section-head">
            <h2 id="activity-title">Recent activity</h2>
          </div>

          {walletError ? (
              <p className="muted">
                Retry loading your wallets to refresh recent activity.
              </p>
          ) : activityError ? (
              <div>
                <FormError>{activityError}</FormError>
                <button
                    type="button"
                    className="btn btn-quiet btn-small"
                    disabled={activityLoading || walletLoading}
                    onClick={load}
                >
                  Retry activity
                </button>
              </div>
          ) : activityLoading || rows === null ? (
              <div className="skel skel-ledger" aria-busy="true" />
          ) : (
              <Ledger
                  rows={rows}
                  empty={
                      'No transactions yet. Make a deposit into one of your ' +
                      'wallets to get started.'
                  }
              />
          )}
        </section>

        {sheet?.kind === 'deposit' && (
            <DepositSheet
                wallet={sheet.wallet}
                onClose={() => setSheet(null)}
                onDone={(_, message) => finished(message)}
            />
        )}

        {sheet?.kind === 'send' && (
            <SendSheet
                wallet={sheet.wallet}
                onClose={() => setSheet(null)}
                onDone={(_, message) => finished(message)}
            />
        )}
      </>
  );
}
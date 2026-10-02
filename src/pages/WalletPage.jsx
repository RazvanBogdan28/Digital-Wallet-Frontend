import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  Send,
} from 'lucide-react';
import WalletNote from '../components/WalletNote';
import Ledger from '../components/Ledger';
import BalanceChart from '../components/BalanceChart';
import CopyButton from '../components/CopyButton';
import DepositSheet from '../components/DepositSheet';
import SendSheet from '../components/SendSheet';
import FormError from '../components/FormError';
import { useToast } from '../components/Toast';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { CURRENCY_INFO } from '../lib/format';
import {
  balanceSeries,
  byNewest,
  fetchRecentWindow,
  toRows,
} from '../lib/ledger';

const PAGE_SIZE = 10;

export default function WalletPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const walletId = Number(id);

  if (!Number.isSafeInteger(walletId) || walletId <= 0) {
    return (
        <div className="notice">
          <h1>Wallet unavailable</h1>
          <FormError>Invalid wallet number.</FormError>
          <Link to="/" className="btn btn-primary">
            Back to wallets
          </Link>
        </div>
    );
  }

  if (!user) return null;

  return (
      <WalletDetails
          key={`${user.id}:${walletId}`}
          walletId={walletId}
      />
  );
}

function WalletDetails({ walletId }) {
  const toast = useToast();

  const [snapshot, setSnapshot] = useState(null);
  const [snapshotError, setSnapshotError] = useState('');
  const [snapshotLoading, setSnapshotLoading] = useState(true);

  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [sheet, setSheet] = useState(null);

  const activeRef = useRef(false);
  const snapshotRequestRef = useRef(0);
  const historyRequestRef = useRef(0);
  const pageRef = useRef(page);

  useLayoutEffect(() => {
    activeRef.current = true;

    return () => {
      activeRef.current = false;
      snapshotRequestRef.current += 1;
      historyRequestRef.current += 1;
    };
  }, []);

  useLayoutEffect(() => {
    pageRef.current = page;
    historyRequestRef.current += 1;
    setData(null);
    setHistoryError('');
    setHistoryLoading(true);
  }, [page]);

  const loadSnapshot = useCallback(async () => {
    if (!activeRef.current) return;

    const requestId = ++snapshotRequestRef.current;
    const current = () =>
        activeRef.current &&
        requestId === snapshotRequestRef.current;

    setSnapshotError('');
    setSnapshotLoading(true);

    try {
      const next = await fetchRecentWindow(walletId);

      if (current()) {
        setSnapshot(next);
      }
    } catch (err) {
      if (current()) {
        setSnapshotError(
            err.message || 'Could not load the wallet and balance chart.',
        );
      }
    } finally {
      if (current()) {
        setSnapshotLoading(false);
      }
    }
  }, [walletId]);

  const loadPage = useCallback(async (p) => {
    if (!activeRef.current || p !== pageRef.current) return;

    const requestId = ++historyRequestRef.current;
    const current = () =>
        activeRef.current &&
        requestId === historyRequestRef.current &&
        p === pageRef.current;

    setHistoryError('');
    setHistoryLoading(true);
    setData(null);

    try {
      const next = await api.transactions(walletId, p, PAGE_SIZE);

      if (current()) {
        setData(next);
      }
    } catch (err) {
      if (current()) {
        setHistoryError(
            err.message || 'Could not load transactions.',
        );
      }
    } finally {
      if (current()) {
        setHistoryLoading(false);
      }
    }
  }, [walletId]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    loadPage(page);

    return () => {
      historyRequestRef.current += 1;
    };
  }, [page, loadPage]);

  const wallet = snapshot?.wallet ?? null;

  const series = useMemo(
      () => (
          snapshot
              ? balanceSeries(
                  snapshot.items,
                  walletId,
                  snapshot.wallet.balance,
                  snapshot.snapshotAt,
              )
              : []
      ),
      [snapshot, walletId],
  );

  const rows = useMemo(
      () => (
          data
              ? toRows(
                  [...data.content].sort(byNewest),
                  new Set([walletId]),
              )
              : null
      ),
      [data, walletId],
  );

  function finished(message) {
    if (!activeRef.current) return;

    setSheet(null);
    toast(message);
    loadSnapshot();

    if (page === 0) {
      loadPage(0);
    } else {
      setPage(0);
    }
  }

  if (snapshotError && !wallet) {
    return (
        <div className="notice">
          <h1>Wallet unavailable</h1>
          <FormError>{snapshotError}</FormError>
          <button
              type="button"
              className="btn btn-quiet"
              disabled={snapshotLoading}
              onClick={loadSnapshot}
          >
            {snapshotLoading ? 'Loading…' : 'Retry'}
          </button>
          <Link to="/" className="btn btn-primary">
            Back to wallets
          </Link>
        </div>
    );
  }

  const info = wallet ? CURRENCY_INFO[wallet.currency] : null;
  const totalPages = data?.totalPages ?? 0;
  const actionsDisabled =
      snapshotLoading || Boolean(snapshotError);

  return (
      <>
        <Link to="/" className="back">
          <ArrowLeft size={16} aria-hidden="true" />
          All wallets
        </Link>

        <header className="wallet-hero">
          {wallet ? (
              <WalletNote wallet={wallet} large />
          ) : (
              <div className="note skel" />
          )}

          <div>
            <h1>{info ? `${info.name} wallet` : 'Wallet'}</h1>
            <p className="lede">
              Wallet No. {walletId}. Share this number to receive{' '}
              {wallet?.currency ?? 'money'}.
            </p>

            {wallet && (
                <div className="hero-actions">
                  <button
                      type="button"
                      className="btn btn-primary"
                      disabled={actionsDisabled}
                      onClick={() => setSheet('deposit')}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Deposit
                  </button>

                  <button
                      type="button"
                      className="btn btn-quiet"
                      disabled={actionsDisabled}
                      onClick={() => setSheet('send')}
                  >
                    <Send size={16} aria-hidden="true" />
                    Send
                  </button>

                  <CopyButton
                      value={walletId}
                      message={`Wallet No. ${walletId} copied`}
                  >
                    Copy number
                  </CopyButton>
                </div>
            )}

            {wallet && snapshotLoading && (
                <p className="muted">Refreshing balance…</p>
            )}

            {wallet && snapshotError && (
                <div>
                  <FormError>{snapshotError}</FormError>
                  <p className="sheet-note">
                    The displayed balance could not be refreshed.
                  </p>
                  <button
                      type="button"
                      className="btn btn-quiet btn-small"
                      disabled={snapshotLoading}
                      onClick={loadSnapshot}
                  >
                    Retry wallet and chart
                  </button>
                </div>
            )}
          </div>
        </header>

        <section className="section" aria-labelledby="chart-title">
          <div className="section-head">
            <h2 id="chart-title">Balance</h2>
            {snapshot && !snapshot.complete && (
                <span className="muted">
              Latest {snapshot.items.length} transactions
            </span>
            )}
          </div>

          <div className="panel">
            {snapshotLoading ? (
                <div className="skel skel-chart" aria-busy="true" />
            ) : snapshotError ? (
                <div>
                  <FormError>{snapshotError}</FormError>
                  <button
                      type="button"
                      className="btn btn-quiet btn-small"
                      onClick={loadSnapshot}
                  >
                    Retry wallet and chart
                  </button>
                </div>
            ) : snapshot ? (
                <BalanceChart
                    points={series}
                    currency={snapshot.wallet.currency}
                />
            ) : (
                <div className="skel skel-chart" aria-busy="true" />
            )}
          </div>
        </section>

        <section className="section" aria-labelledby="history-title">
          <div className="section-head">
            <h2 id="history-title">Transactions</h2>
            {data && (
                <span className="muted">
              {data.totalElements} in total
            </span>
            )}
          </div>

          {historyError ? (
              <div>
                <FormError>{historyError}</FormError>
                <button
                    type="button"
                    className="btn btn-quiet btn-small"
                    disabled={historyLoading}
                    onClick={() => loadPage(page)}
                >
                  Retry transactions
                </button>
              </div>
          ) : rows ? (
              <Ledger
                  rows={rows}
                  empty={
                    'No transactions yet. Deposit into this wallet to see it here.'
                  }
              />
          ) : (
              <div className="skel skel-ledger" aria-busy="true" />
          )}

          {totalPages > 1 && (
              <nav className="pager" aria-label="Transaction pages">
                <button
                    type="button"
                    className="btn btn-quiet btn-small"
                    disabled={historyLoading || page === 0}
                    onClick={() => setPage((current) => current - 1)}
                >
                  <ChevronLeft size={15} aria-hidden="true" />
                  Previous
                </button>

                <span>Page {page + 1} of {totalPages}</span>

                <button
                    type="button"
                    className="btn btn-quiet btn-small"
                    disabled={historyLoading || page + 1 >= totalPages}
                    onClick={() => setPage((current) => current + 1)}
                >
                  Next
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
              </nav>
          )}
        </section>

        {sheet === 'deposit' && wallet && (
            <DepositSheet
                wallet={wallet}
                onClose={() => setSheet(null)}
                onDone={(_, message) => finished(message)}
            />
        )}

        {sheet === 'send' && wallet && (
            <SendSheet
                wallet={wallet}
                onClose={() => setSheet(null)}
                onDone={(_, message) => finished(message)}
            />
        )}
      </>
  );
}
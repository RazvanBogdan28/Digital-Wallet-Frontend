import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Send } from 'lucide-react';
import WalletNote from '../components/WalletNote';
import Ledger from '../components/Ledger';
import BalanceChart from '../components/BalanceChart';
import CopyButton from '../components/CopyButton';
import DepositSheet from '../components/DepositSheet';
import SendSheet from '../components/SendSheet';
import FormError from '../components/FormError';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { CURRENCY_INFO } from '../lib/format';
import { balanceSeries, byNewest, fetchRecentWindow, toRows } from '../lib/ledger';

const PAGE_SIZE = 10;

export default function WalletPage() {
  const { id } = useParams();
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

  return <WalletDetails key={id} walletId={walletId} />;
}

function WalletDetails({ walletId }) {
  const toast = useToast();
  const [wallet, setWallet] = useState(null);
  const [win, setWin] = useState(null);
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [sheet, setSheet] = useState(null);

  const [walletError, setWalletError] = useState('');
  const [chartError, setChartError] = useState('');
  const [historyError, setHistoryError] = useState('');

  const [walletLoading, setWalletLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const activeRef = useRef(false);
  const walletRequestRef = useRef(0);
  const chartRequestRef = useRef(0);
  const historyRequestRef = useRef(0);
  const pageRef = useRef(page);

  useLayoutEffect(() => {
    activeRef.current = true;

    return () => {
      activeRef.current = false;
      walletRequestRef.current += 1;
      chartRequestRef.current += 1;
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

  const loadWallet = useCallback(async () => {
    if (!activeRef.current) return;

    const requestId = ++walletRequestRef.current;
    const current = () =>
        activeRef.current && requestId === walletRequestRef.current;

    setWalletError('');
    setWalletLoading(true);

    try {
      const next = await api.wallet(walletId);
      if (current()) setWallet(next);
    } catch (err) {
      if (current()) {
        setWalletError(err.message || 'Could not load this wallet.');
      }
    } finally {
      if (current()) setWalletLoading(false);
    }
  }, [walletId]);

  const loadChart = useCallback(async () => {
    if (!activeRef.current) return;

    const requestId = ++chartRequestRef.current;
    const current = () =>
        activeRef.current && requestId === chartRequestRef.current;

    setChartError('');
    setChartLoading(true);
    setWin(null);

    try {
      const next = await fetchRecentWindow(walletId);
      if (current()) setWin(next);
    } catch (err) {
      if (current()) {
        setChartError(err.message || 'Could not load the balance chart.');
      }
    } finally {
      if (current()) setChartLoading(false);
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
      if (current()) setData(next);
    } catch (err) {
      if (current()) {
        setHistoryError(err.message || 'Could not load transactions.');
      }
    } finally {
      if (current()) setHistoryLoading(false);
    }
  }, [walletId]);

  useEffect(() => {
    loadWallet();
    loadChart();
  }, [loadWallet, loadChart]);

  useEffect(() => {
    loadPage(page);

    return () => {
      historyRequestRef.current += 1;
    };
  }, [page, loadPage]);

  const series = useMemo(
      () => (
          wallet && win
              ? balanceSeries(win.items, walletId, wallet.balance)
              : []
      ),
      [wallet, win, walletId],
  );

  const rows = useMemo(
      () => (
          data
              ? toRows([...data.content].sort(byNewest), new Set([walletId]))
              : null
      ),
      [data, walletId],
  );

  function finished(message) {
    if (!activeRef.current) return;

    setSheet(null);
    toast(message);
    loadWallet();
    loadChart();

    if (page === 0) loadPage(0);
    else setPage(0);
  }

  if (walletError && !wallet) {
    return (
        <div className="notice">
          <h1>Wallet unavailable</h1>
          <FormError>{walletError}</FormError>
          <button
              type="button"
              className="btn btn-quiet"
              disabled={walletLoading}
              onClick={loadWallet}
          >
            {walletLoading ? 'Loading…' : 'Retry'}
          </button>
          <Link to="/" className="btn btn-primary">
            Back to wallets
          </Link>
        </div>
    );
  }

  const info = wallet ? CURRENCY_INFO[wallet.currency] : null;
  const totalPages = data?.totalPages ?? 0;

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
                      disabled={walletLoading || Boolean(walletError)}
                      onClick={() => setSheet('deposit')}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Deposit
                  </button>
                  <button
                      type="button"
                      className="btn btn-quiet"
                      disabled={walletLoading || Boolean(walletError)}
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

            {wallet && walletError && (
                <div>
                  <FormError>{walletError}</FormError>
                  <button
                      type="button"
                      className="btn btn-quiet btn-small"
                      disabled={walletLoading}
                      onClick={loadWallet}
                  >
                    Retry wallet
                  </button>
                </div>
            )}
          </div>
        </header>

        <section className="section" aria-labelledby="chart-title">
          <div className="section-head">
            <h2 id="chart-title">Balance</h2>
            {win && !win.complete && (
                <span className="muted">
              Latest {win.items.length} transactions
            </span>
            )}
          </div>
          <div className="panel">
            {chartError ? (
                <div>
                  <FormError>{chartError}</FormError>
                  <button
                      type="button"
                      className="btn btn-quiet btn-small"
                      disabled={chartLoading}
                      onClick={loadChart}
                  >
                    Retry chart
                  </button>
                </div>
            ) : wallet && win ? (
                <BalanceChart points={series} currency={wallet.currency} />
            ) : (
                <div className="skel skel-chart" aria-busy="true" />
            )}
          </div>
        </section>

        <section className="section" aria-labelledby="history-title">
          <div className="section-head">
            <h2 id="history-title">Transactions</h2>
            {data && (
                <span className="muted">{data.totalElements} in total</span>
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
                  empty="No transactions yet. Deposit into this wallet to see it here."
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
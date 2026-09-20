import { useCallback, useEffect, useState } from 'react';
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
import { CURRENCIES, CURRENCY_INFO, sortWallets } from '../lib/format';
import { byNewest, fetchRecentWindow, toRows } from '../lib/ledger';

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const [wallets, setWallets] = useState(null);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(null);
  const [adding, setAdding] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const list = sortWallets(await api.walletsOf(user.id));
      setWallets(list);

      const windows = await Promise.all(
        list.map((wallet) => fetchRecentWindow(wallet.id).catch(() => ({ items: [] }))),
      );
      const unique = new Map();
      windows.forEach((win) => win.items.forEach((tx) => unique.set(tx.id, tx)));
      const latest = [...unique.values()].sort(byNewest).slice(0, 8);
      setRows(toRows(latest, new Set(list.map((wallet) => wallet.id))));
    } catch (err) {
      setError(err.message);
    }
  }, [user.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function addWallet(currency) {
    setAdding(currency);
    try {
      await api.createWallet(user.id, currency);
      toast(`${CURRENCY_INFO[currency].name} wallet created`);
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setAdding('');
    }
  }

  function finished(message) {
    setSheet(null);
    toast(message);
    load();
  }

  if (error && !wallets) {
    return (
      <div className="notice">
        <h1>Could not load your wallets</h1>
        <FormError>{error}</FormError>
        <button type="button" className="btn btn-primary" onClick={load}>
          Try again
        </button>
      </div>
    );
  }

  const missing = wallets ? CURRENCIES.filter((c) => !wallets.some((w) => w.currency === c)) : [];

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Hello, {user.firstName}</h1>
          <p className="lede">Your wallets, and the latest movements across all of them.</p>
        </div>
      </header>

      <section aria-labelledby="wallets-title">
        <div className="section-head">
          <h2 id="wallets-title">Wallets</h2>
        </div>
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
                <Link to={`/wallets/${wallet.id}`} className="note-link" aria-label={`Open ${wallet.currency} wallet No. ${wallet.id}`}>
                  <WalletNote wallet={wallet} />
                </Link>
                <div className="note-actions">
                  <button type="button" className="btn btn-quiet btn-small" onClick={() => setSheet({ kind: 'deposit', wallet })}>
                    <Plus size={15} aria-hidden="true" />
                    Deposit
                  </button>
                  <button type="button" className="btn btn-quiet btn-small" onClick={() => setSheet({ kind: 'send', wallet })}>
                    <Send size={15} aria-hidden="true" />
                    Send
                  </button>
                  <CopyButton value={wallet.id} message={`Wallet No. ${wallet.id} copied`} iconOnly label={`Copy wallet No. ${wallet.id}`} />
                </div>
              </li>
            ))}
            {missing.map((currency) => (
              <li key={currency}>
                <button type="button" className="note-ghost" disabled={Boolean(adding)} onClick={() => addWallet(currency)}>
                  <Plus size={20} aria-hidden="true" />
                  <span>{adding === currency ? 'Creating…' : `Add ${CURRENCY_INFO[currency].name} wallet`}</span>
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
        {rows ? (
          <Ledger rows={rows} empty="No transactions yet. Make a deposit into one of your wallets to get started." />
        ) : (
          <div className="skel skel-ledger" aria-busy="true" />
        )}
      </section>

      {sheet?.kind === 'deposit' && (
        <DepositSheet wallet={sheet.wallet} onClose={() => setSheet(null)} onDone={(_, message) => finished(message)} />
      )}
      {sheet?.kind === 'send' && (
        <SendSheet wallet={sheet.wallet} onClose={() => setSheet(null)} onDone={(_, message) => finished(message)} />
      )}
    </>
  );
}

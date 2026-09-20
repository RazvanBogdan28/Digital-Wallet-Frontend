import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import CopyButton from '../components/CopyButton';
import FormError from '../components/FormError';
import { api } from '../lib/api';
import { CURRENCY_INFO, formatMoney, sortWallets } from '../lib/format';

export default function AdminPage() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState({});

  useEffect(() => {
    api.users().then(setUsers).catch((err) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users ?? []).filter(
      (u) => !q || `${u.id} ${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q),
    );
  }, [users, query]);

  async function toggle(user) {
    if (open[user.id]) {
      setOpen((current) => {
        const next = { ...current };
        delete next[user.id];
        return next;
      });
      return;
    }
    setOpen((current) => ({ ...current, [user.id]: { loading: true } }));
    try {
      const wallets = sortWallets(await api.walletsOf(user.id));
      setOpen((current) => ({ ...current, [user.id]: { wallets } }));
    } catch (err) {
      setOpen((current) => ({ ...current, [user.id]: { error: err.message } }));
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Users</h1>
          <p className="lede">Everyone registered in the system. Open a user to see their wallets and balances.</p>
        </div>
        <label className="search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search users</span>
          <input placeholder="Search by name, email or id" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </header>

      <FormError>{error}</FormError>
      {!users && !error && <div className="skel skel-ledger" aria-busy="true" />}

      {users && (
        <div className="ledger">
          <div className="users-head" aria-hidden="true">
            <span>Id</span>
            <span>Name</span>
            <span>Email</span>
            <span />
          </div>
          <ul className="ledger-list">
            {filtered.map((user) => {
              const state = open[user.id];
              return (
                <li key={user.id} className="user-row">
                  <div className="user-line">
                    <span className="user-id">{user.id}</span>
                    <span className="user-name">
                      {user.firstName} {user.lastName}
                    </span>
                    <span className="user-mail">{user.email}</span>
                    <button
                      type="button"
                      className="btn btn-quiet btn-small"
                      aria-expanded={Boolean(state)}
                      onClick={() => toggle(user)}
                    >
                      Wallets
                      <ChevronDown size={15} aria-hidden="true" className={state ? 'flip' : ''} />
                    </button>
                  </div>
                  {state && (
                    <div className="user-wallets">
                      {state.loading && <span className="muted">Loading wallets…</span>}
                      {state.error && <FormError>{state.error}</FormError>}
                      {state.wallets?.length === 0 && <span className="muted">This user has no wallets yet.</span>}
                      {state.wallets?.map((wallet) => (
                        <div key={wallet.id} className={`chip chip-${wallet.currency.toLowerCase()}`}>
                          <span className="chip-code">{wallet.currency}</span>
                          <span className="chip-id">No. {wallet.id}</span>
                          <span className="chip-balance">{formatMoney(wallet.balance, wallet.currency)}</span>
                          <CopyButton value={wallet.id} message={`Wallet No. ${wallet.id} copied`} iconOnly label={`Copy wallet No. ${wallet.id}`} />
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {!filtered.length && <p className="empty">No users match “{query}”.</p>}
        </div>
      )}
    </>
  );
}

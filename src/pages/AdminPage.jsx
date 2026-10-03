import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import Amt from '../components/Amt';
import CopyButton from '../components/CopyButton';
import FormError from '../components/FormError';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { sortWallets } from '../lib/format';

export default function AdminPage() {
  const { user } = useAuth();

  if (!user) return null;

  return <AdminUsers key={user.id} />;
}

function AdminUsers() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    setError('');
    setLoading(true);

    async function loadUsers() {
      try {
        const next = await api.users();

        if (active) setUsers(next);
      } catch (err) {
        if (active) {
          setError(err.message || 'Could not load users.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadUsers();

    return () => {
      active = false;
    };
  }, [attempt]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return (users ?? []).filter((user) => {
      const text =
          `${user.id} ${user.firstName} ${user.lastName} ${user.email}`;

      return !q || text.toLowerCase().includes(q);
    });
  }, [users, query]);

  return (
      <>
        <header className="page-head">
          <div>
            <h1>Users</h1>
            <p className="lede">
              Everyone registered in the system. Open a user to see
              their wallets and balances.
            </p>
          </div>

          <label className="search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Search users</span>
            <input
                placeholder="Search by name, email or id"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </header>

        {error && (
            <div>
              <FormError>{error}</FormError>
              <button
                  type="button"
                  className="btn btn-quiet btn-small"
                  disabled={loading}
                  onClick={() => setAttempt((current) => current + 1)}
              >
                Retry users
              </button>
            </div>
        )}

        {loading && !users && (
            <div className="skel skel-ledger" aria-busy="true" />
        )}

        {users && (
            <div className="ledger">
              <div className="users-head" aria-hidden="true">
                <span>Id</span>
                <span>Name</span>
                <span>Email</span>
                <span />
              </div>

              <ul className="ledger-list">
                {filtered.map((user) => (
                    <UserRow key={user.id} user={user} />
                ))}
              </ul>

              {!filtered.length && (
                  <p className="empty">
                    {users.length === 0
                        ? 'No users registered yet.'
                        : `No users match “${query}”.`}
                  </p>
              )}
            </div>
        )}
      </>
  );
}

function UserRow({ user }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = `user-wallets-${user.id}`;

  return (
      <li className="user-row">
        <div className="user-line">
          <span className="user-id">{user.id}</span>

          <span className="user-name">
                    {user.firstName} {user.lastName}
                </span>

          <span className="user-mail">{user.email}</span>

          <button
              type="button"
              className="btn btn-quiet btn-small"
              aria-expanded={expanded}
              aria-controls={expanded ? panelId : undefined}
              onClick={() => setExpanded((current) => !current)}
          >
            Wallets
            <ChevronDown
                size={15}
                aria-hidden="true"
                className={expanded ? 'flip' : ''}
            />
          </button>
        </div>

        {expanded && (
            <UserWallets
                key={user.id}
                userId={user.id}
                panelId={panelId}
            />
        )}
      </li>
  );
}

function UserWallets({ userId, panelId }) {
  const [wallets, setWallets] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    setWallets(null);
    setError('');
    setLoading(true);

    async function loadWallets() {
      try {
        const next = sortWallets(await api.walletsOf(userId));

        if (active) setWallets(next);
      } catch (err) {
        if (active) {
          setError(err.message || 'Could not load these wallets.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadWallets();

    return () => {
      active = false;
    };
  }, [userId, attempt]);

  return (
      <div
          id={panelId}
          className="user-wallets"
          aria-busy={loading}
      >
        {loading && (
            <span className="muted">Loading wallets…</span>
        )}

        {error && (
            <div>
              <FormError>{error}</FormError>
              <button
                  type="button"
                  className="btn btn-quiet btn-small"
                  disabled={loading}
                  onClick={() => setAttempt((current) => current + 1)}
              >
                Retry wallets
              </button>
            </div>
        )}

        {!loading && !error && wallets?.length === 0 && (
            <span className="muted">
                    This user has no wallets yet.
                </span>
        )}

        {!loading && !error && wallets?.map((wallet) => (
            <div
                key={wallet.id}
                className={`chip chip-${wallet.currency.toLowerCase()}`}
            >
              <span className="chip-code">{wallet.currency}</span>
              <span className="chip-id">No. {wallet.id}</span>
              <span className="chip-balance">
                        <Amt value={wallet.balance} currency={wallet.currency} />
                    </span>
              <CopyButton
                  value={wallet.id}
                  message={`Wallet No. ${wallet.id} copied`}
                  iconOnly
                  label={`Copy wallet No. ${wallet.id}`}
              />
            </div>
        ))}
      </div>
  );
}
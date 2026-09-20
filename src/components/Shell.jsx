import { Link, Outlet, useLocation } from 'react-router-dom';
import { Eye, EyeOff, LogOut, ShieldCheck, Wallet } from 'lucide-react';
import Mark from './Mark';
import { useAuth } from '../lib/auth';
import { usePrivacy } from '../lib/privacy';
import { initials } from '../lib/format';

export default function Shell() {
  const { user, logout } = useAuth();
  const { hidden, toggle } = usePrivacy();
  const { pathname } = useLocation();
  const onWallets = pathname === '/' || pathname.startsWith('/wallets');

  return (
    <div className="shell">
      <aside className="rail">
        <Link to="/" className="rail-brand" aria-label="Digital Wallet, home">
          <Mark size={30} />
          <span>Digital Wallet</span>
        </Link>

        <nav className="rail-nav" aria-label="Main">
          <Link to="/" className={`rail-link ${onWallets ? 'active' : ''}`} aria-current={onWallets ? 'page' : undefined}>
            <Wallet size={18} aria-hidden="true" />
            Wallets
          </Link>
          {user.isAdmin && (
            <Link
              to="/admin"
              className={`rail-link ${pathname === '/admin' ? 'active' : ''}`}
              aria-current={pathname === '/admin' ? 'page' : undefined}
            >
              <ShieldCheck size={18} aria-hidden="true" />
              Admin
            </Link>
          )}
        </nav>

        <div className="rail-foot">
          <button type="button" className="rail-btn" onClick={toggle} aria-pressed={hidden}>
            {hidden ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            {hidden ? 'Show amounts' : 'Hide amounts'}
          </button>
          <button type="button" className="rail-btn" onClick={logout}>
            <LogOut size={18} aria-hidden="true" />
            Sign out
          </button>
          <div className="rail-user">
            <span className="avatar" aria-hidden="true">
              {initials(user)}
            </span>
            <div className="rail-user-text">
              <p className="rail-user-name">
                {user.firstName} {user.lastName}
              </p>
              <p className="rail-user-mail">{user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

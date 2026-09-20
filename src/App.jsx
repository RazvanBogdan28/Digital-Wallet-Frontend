import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Shell from './components/Shell';
import Mark from './components/Mark';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import WalletPage from './pages/WalletPage';
import AdminPage from './pages/AdminPage';
import { useAuth } from './lib/auth';

function Splash() {
  return (
    <div className="splash" role="status" aria-label="Loading">
      <Mark size={56} />
    </div>
  );
}

function Protected() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <Splash />;
  if (status === 'anon') return <Navigate to="/login" state={{ from: location }} replace />;
  return <Shell />;
}

function PublicOnly({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <Splash />;
  if (status === 'authed') return <Navigate to={location.state?.from?.pathname || '/'} replace />;
  return children;
}

function AdminOnly({ children }) {
  const { user } = useAuth();
  return user.isAdmin ? children : <Navigate to="/" replace />;
}

function NotFound() {
  return (
    <div className="notice notice-page">
      <h1>Page not found</h1>
      <p className="lede">The page you asked for does not exist.</p>
      <Link to="/" className="btn btn-primary">
        Back to wallets
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><AuthPage mode="login" /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><AuthPage mode="register" /></PublicOnly>} />
      <Route element={<Protected />}>
        <Route index element={<Dashboard />} />
        <Route path="wallets/:id" element={<WalletPage />} />
        <Route path="admin" element={<AdminOnly><AdminPage /></AdminOnly>} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

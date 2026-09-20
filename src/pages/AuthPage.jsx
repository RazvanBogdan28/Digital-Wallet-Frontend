import { useState } from 'react';
import { Link } from 'react-router-dom';
import Guilloche from '../components/Guilloche';
import Mark from '../components/Mark';
import FormError from '../components/FormError';
import { useAuth } from '../lib/auth';

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { login, register } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!isLogin && form.password.length < 8) {
      setError('Use at least 8 characters for the password.');
      return;
    }
    setBusy(true);
    try {
      if (isLogin) {
        await login(form.email.trim(), form.password);
      } else {
        await register({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          password: form.password,
        });
      }
    } catch (err) {
      if (isLogin && err.status === 401) setError('Email or password is incorrect.');
      else if (!isLogin && err.status === 409) setError('An account with this email already exists. Sign in instead.');
      else setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <section className="auth-art">
        <Guilloche variant="art" seed={7} />
        <Link to="/login" className="auth-brand">
          <Mark size={30} />
          <span>Digital Wallet</span>
        </Link>
        <div className="auth-pitch">
          <h2>A wallet for every currency you hold.</h2>
          <p>
            Deposit, send and follow every movement in euros, dollars and lei. Transfers carry an idempotency key, so a
            double tap never sends money twice.
          </p>
        </div>
      </section>

      <section className="auth-panel">
        <form className="auth-form" onSubmit={submit} noValidate>
          <div>
            <h1>{isLogin ? 'Sign in' : 'Create your account'}</h1>
            <p className="lede">
              {isLogin ? 'Use the email and password you registered with.' : 'It takes a minute. You can add wallets right after.'}
            </p>
          </div>

          {!isLogin && (
            <div className="field-row">
              <div className="field">
                <label htmlFor="firstName">First name</label>
                <input id="firstName" autoComplete="given-name" required value={form.firstName} onChange={set('firstName')} />
              </div>
              <div className="field">
                <label htmlFor="lastName">Last name</label>
                <input id="lastName" autoComplete="family-name" required value={form.lastName} onChange={set('lastName')} />
              </div>
            </div>
          )}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
              minLength={isLogin ? undefined : 8}
              value={form.password}
              onChange={set('password')}
            />
            {!isLogin && <span className="hint">At least 8 characters.</span>}
          </div>

          <FormError>{error}</FormError>

          <button type="submit" className="btn btn-primary btn-wide" disabled={busy}>
            {busy ? (isLogin ? 'Signing in…' : 'Creating account…') : isLogin ? 'Sign in' : 'Create account'}
          </button>

          <p className="switch">
            {isLogin ? (
              <>
                New here? <Link to="/register">Create an account</Link>
              </>
            ) : (
              <>
                Already have an account? <Link to="/login">Sign in</Link>
              </>
            )}
          </p>
        </form>
      </section>
    </div>
  );
}

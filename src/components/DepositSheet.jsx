import { useRef, useState } from 'react';
import Sheet from './Sheet';
import Stamp from './Stamp';
import FormError from './FormError';
import { api } from '../lib/api';
import {
  CURRENCY_INFO,
  formatMoney,
  newKey,
  parseAmount,
} from '../lib/format';

const QUICK = [50, 100, 250, 500];

export default function DepositSheet({ wallet, onClose, onDone }) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const attemptRef = useRef(null);
  const inFlightRef = useRef(false);
  const completedRef = useRef(false);

  const info = CURRENCY_INFO[wallet.currency];
  const locked = busy || attemptRef.current !== null;

  async function close() {
    if (inFlightRef.current) return;

    if (!result) {
      if (attemptRef.current) {
        setError(
            'The deposit result is unknown. Retry the same deposit before closing.',
        );
        return;
      }

      onClose();
      return;
    }

    if (!result.duplicate) {
      onDone(
          result.updated,
          `Deposited ${formatMoney(result.amount, wallet.currency)}`,
      );
      return;
    }

    inFlightRef.current = true;
    setBusy(true);
    setError('');

    try {
      const updated = await api.wallet(result.walletId);
      onDone(updated, 'Deposit already processed. Balance refreshed.');
    } catch (err) {
      setError(
          err.message || 'Could not refresh the balance. Press Done to retry.',
      );
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  async function submit(event) {
    event.preventDefault();

    if (inFlightRef.current || completedRef.current) return;

    let attempt = attemptRef.current;

    if (!attempt) {
      const parsed = parseAmount(amount);

      if (parsed == null) {
        setError(
            'Enter an amount of at least 0.01, with up to two decimals. For example 25 or 25.50.',
        );
        return;
      }

      attempt = {
        walletId: wallet.id,
        amount: parsed,
        key: newKey(),
      };

      attemptRef.current = attempt;
    }

    inFlightRef.current = true;
    setBusy(true);
    setError('');

    try {
      const updated = await api.deposit(
          attempt.walletId,
          attempt.amount,
          attempt.key,
      );

      completedRef.current = true;

      setResult({
        updated,
        amount: attempt.amount,
        walletId: attempt.walletId,
        duplicate: false,
      });
    } catch (err) {
      if (
          err.status === 409 &&
          err.data?.error === 'DUPLICATE_TRANSACTION'
      ) {
        completedRef.current = true;

        setResult({
          amount: attempt.amount,
          walletId: attempt.walletId,
          duplicate: true,
        });
      } else if ([400, 403, 404, 422].includes(err.status)) {
        attemptRef.current = null;
        setError(err.message || 'The deposit was rejected.');
      } else {
        setError(
            `${err.message || 'Could not confirm the deposit.'} ` +
            'The result is unknown. Retry to check the same deposit.',
        );
      }
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  return (
      <Sheet title={`Deposit to ${info.name} wallet`} onClose={close}>
        {result ? (
            <div className="receipt">
              <Stamp
                  label={result.duplicate ? 'Already processed' : 'Deposited'}
              />

              {result.duplicate && (
                  <p className="sheet-note">
                    This deposit was already processed. No new deposit was
                    made by this retry. Press Done to refresh the balance.
                  </p>
              )}

              <dl>
                <div>
                  <dt>Amount</dt>
                  <dd>
                    {formatMoney(result.amount, wallet.currency, {
                      signed: true,
                    })}
                  </dd>
                </div>

                {!result.duplicate && (
                    <div>
                      <dt>New balance</dt>
                      <dd>
                        {formatMoney(
                            result.updated.balance,
                            wallet.currency,
                        )}
                      </dd>
                    </div>
                )}
              </dl>

              <FormError>{error}</FormError>

              <button
                  type="button"
                  className="btn btn-primary"
                  onClick={close}
                  disabled={busy}
              >
                {busy ? 'Refreshing…' : 'Done'}
              </button>
            </div>
        ) : (
            <form className="sheet-form" onSubmit={submit} noValidate>
              <p className="sheet-note">
                Current balance {formatMoney(wallet.balance, wallet.currency)}
                {' '}in wallet No. {wallet.id}.
              </p>

              <div className="field">
                <label htmlFor="deposit-amount">
                  Amount in {wallet.currency}
                </label>
                <input
                    id="deposit-amount"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.00"
                    value={amount}
                    disabled={locked}
                    onChange={(event) => setAmount(event.target.value)}
                />
              </div>

              <div
                  className="quick"
                  role="group"
                  aria-label="Quick amounts"
              >
                {QUICK.map((value) => (
                    <button
                        key={value}
                        type="button"
                        className="chip-btn"
                        disabled={locked}
                        onClick={() => setAmount(String(value))}
                    >
                      {value}
                    </button>
                ))}
              </div>

              <FormError>{error}</FormError>

              <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy}
              >
                {busy
                    ? 'Depositing…'
                    : attemptRef.current
                        ? 'Retry same deposit'
                        : 'Deposit'}
              </button>
            </form>
        )}
      </Sheet>
  );
}
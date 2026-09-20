import { useState } from 'react';
import Sheet from './Sheet';
import Stamp from './Stamp';
import FormError from './FormError';
import { api } from '../lib/api';
import { CURRENCY_INFO, formatMoney, parseAmount } from '../lib/format';

const QUICK = [50, 100, 250, 500];

export default function DepositSheet({ wallet, onClose, onDone }) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const info = CURRENCY_INFO[wallet.currency];

  const close = () => (result ? onDone(result.updated, `Deposited ${formatMoney(result.amount, wallet.currency)}`) : onClose());

  async function submit(event) {
    event.preventDefault();
    const parsed = parseAmount(amount);
    if (parsed == null) {
      setError('Enter an amount of at least 0.01, with up to two decimals. For example 25 or 25.50.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const updated = await api.deposit(wallet.id, parsed);
      setResult({ updated, amount: parsed });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={`Deposit to ${info.name} wallet`} onClose={close}>
      {result ? (
        <div className="receipt">
          <Stamp label="Deposited" />
          <dl>
            <div>
              <dt>Added</dt>
              <dd>{formatMoney(result.amount, wallet.currency, { signed: true })}</dd>
            </div>
            <div>
              <dt>New balance</dt>
              <dd>{formatMoney(result.updated.balance, wallet.currency)}</dd>
            </div>
          </dl>
          <button type="button" className="btn btn-primary" onClick={close}>
            Done
          </button>
        </div>
      ) : (
        <form className="sheet-form" onSubmit={submit} noValidate>
          <p className="sheet-note">
            Current balance {formatMoney(wallet.balance, wallet.currency)} in wallet No. {wallet.id}.
          </p>
          <div className="field">
            <label htmlFor="deposit-amount">Amount in {wallet.currency}</label>
            <input
              id="deposit-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="quick" role="group" aria-label="Quick amounts">
            {QUICK.map((value) => (
              <button key={value} type="button" className="chip-btn" onClick={() => setAmount(String(value))}>
                {value}
              </button>
            ))}
          </div>
          <FormError>{error}</FormError>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Depositing…' : 'Deposit'}
          </button>
        </form>
      )}
    </Sheet>
  );
}

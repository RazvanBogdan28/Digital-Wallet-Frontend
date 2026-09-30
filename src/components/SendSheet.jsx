import { useRef, useState } from 'react';
import Sheet from './Sheet';
import Stamp from './Stamp';
import FormError from './FormError';
import { api } from '../lib/api';
import { CURRENCY_INFO, formatMoney, newKey, parseAmount } from '../lib/format';

export default function SendSheet({ wallet, onClose, onDone }) {
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const info = CURRENCY_INFO[wallet.currency];

  const attemptRef = useRef(null);
  const inFlightRef = useRef(false);
  const completedRef = useRef(false);
  const locked = busy || attemptRef.current !== null;

  async function close() {
    if (inFlightRef.current) return;

    if (result) {
      if (!result.duplicate) {
        onDone(result.updated, `Sent ${formatMoney(result.amount, wallet.currency)}`);
        return;
      }

      inFlightRef.current = true;
      setBusy(true);
      setError('');
      try {
        const updated = await api.wallet(result.from);
        onDone(updated, 'Transfer was already processed. Balance refreshed.');
      } catch (err) {
        setError(err.message || 'Could not refresh the balance. Try again.');
      } finally {
        inFlightRef.current = false;
        setBusy(false);
      }
      return;
    }

    if (attemptRef.current) {
      setError('The transfer result is still unknown. Retry the same transfer to check it before closing.');
      return;
    }

    onClose();
  }

  async function submit(event) {
    event.preventDefault();
    if (inFlightRef.current || completedRef.current) return;

    let attempt = attemptRef.current;
    if (!attempt) {
      const target = Number(toId);
      const parsed = parseAmount(amount);

      if (!Number.isSafeInteger(target) || target <= 0) return setError('Enter the recipient wallet number, like 42.');
      if (target === wallet.id) return setError('Choose a different wallet than the one you are sending from.');
      if (parsed == null) return setError('Enter an amount of at least 0.01, with up to two decimals.');
      if (parsed > Number(wallet.balance)) {
        return setError(`That is more than the ${formatMoney(wallet.balance, wallet.currency)} available.`);
      }

      attempt = {
        from: wallet.id,
        payload: { toWalletId: target, amount: parsed, description: note.trim() || undefined },
        key: newKey(),
      };
      attemptRef.current = attempt;
    }

    inFlightRef.current = true;
    setBusy(true);
    setError('');
    try {
      const updated = await api.transfer(attempt.from, attempt.payload, attempt.key);
      completedRef.current = true;
      setResult({ updated, amount: attempt.payload.amount, to: attempt.payload.toWalletId });
    } catch (err) {
      if (err.status === 409 && err.data?.error === 'DUPLICATE_TRANSACTION') {
        completedRef.current = true;
        setResult({ duplicate: true, from: attempt.from, amount: attempt.payload.amount, to: attempt.payload.toWalletId });
      } else if ([400, 403, 404, 422].includes(err.status)) {
        attemptRef.current = null;
        setError(err.message || 'The transfer was rejected. Check the fields and try again.');
      } else {
        setError('We could not confirm the transfer result. Retry to check the same transfer; do not start another one.');
      }
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  return (
      <Sheet title={`Send ${wallet.currency}`} onClose={close}>
        {result ? (
            <div className="receipt">
              <Stamp label={result.duplicate ? 'Already processed' : 'Sent'} />
              {result.duplicate && (
                  <p className="sheet-note">
                    The server reports that this transfer was already processed. No new transfer was sent.
                    Select Done to refresh your balance, then check your transaction history.
                  </p>
              )}
              <dl>
                <div>
                  <dt>Amount</dt>
                  <dd>{formatMoney(result.amount, wallet.currency)}</dd>
                </div>
                <div>
                  <dt>To</dt>
                  <dd>Wallet No. {result.to}</dd>
                </div>
                {result.updated && (
                    <div>
                      <dt>New balance</dt>
                      <dd>{formatMoney(result.updated.balance, wallet.currency)}</dd>
                    </div>
                )}
              </dl>
              <FormError>{error}</FormError>
              <button type="button" className="btn btn-primary" onClick={close} disabled={busy}>
                {busy ? 'Refreshing…' : 'Done'}
              </button>
            </div>
        ) : (
            <form className="sheet-form" onSubmit={submit} noValidate>
              <p className="sheet-note">
                From wallet No. {wallet.id}, {formatMoney(wallet.balance, wallet.currency)} available. You can only send{' '}
                {info.name} to another {wallet.currency} wallet.
              </p>
              <div className="field">
                <label htmlFor="send-to">Recipient wallet number</label>
                <input
                    id="send-to"
                    disabled={locked}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="42"
                    value={toId}
                    onChange={(event) => setToId(event.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div className="field">
                <label htmlFor="send-amount">Amount in {wallet.currency}</label>
                <input
                    id="send-amount"
                    disabled={locked}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.00"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="send-note">Note (optional)</label>
                <input
                    id="send-note"
                    disabled={locked}
                    maxLength={255}
                    autoComplete="off"
                    placeholder="Rent for September"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                />
              </div>
              <FormError>{error}</FormError>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Sending…' : attemptRef.current ? 'Retry same transfer' : 'Send money'}
              </button>
            </form>
        )}
      </Sheet>
  );
}

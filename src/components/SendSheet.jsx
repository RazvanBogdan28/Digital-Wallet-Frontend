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

  // One key per attempt. If the request dies on the network we keep the same key, so a retry
  // can never move the money twice. Once the server answers, the next attempt gets a fresh key.
  const keyRef = useRef(newKey());

  const close = () => (result ? onDone(result.updated, `Sent ${formatMoney(result.amount, wallet.currency)}`) : onClose());

  async function submit(event) {
    event.preventDefault();
    const target = Number(toId);
    const parsed = parseAmount(amount);

    if (!Number.isInteger(target) || target <= 0) return setError('Enter the recipient wallet number, like 42.');
    if (target === wallet.id) return setError('Choose a different wallet than the one you are sending from.');
    if (parsed == null) return setError('Enter an amount of at least 0.01, with up to two decimals.');
    if (parsed > Number(wallet.balance)) {
      return setError(`That is more than the ${formatMoney(wallet.balance, wallet.currency)} available.`);
    }

    setBusy(true);
    setError('');
    try {
      const updated = await api.transfer(
        wallet.id,
        { toWalletId: target, amount: parsed, description: note.trim() || undefined },
        keyRef.current,
      );
      keyRef.current = newKey();
      setResult({ updated, amount: parsed, to: target });
    } catch (err) {
      if (err.status !== 0) keyRef.current = newKey();
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={`Send ${wallet.currency}`} onClose={close}>
      {result ? (
        <div className="receipt">
          <Stamp label="Sent" />
          <dl>
            <div>
              <dt>Amount</dt>
              <dd>{formatMoney(result.amount, wallet.currency)}</dd>
            </div>
            <div>
              <dt>To</dt>
              <dd>Wallet No. {result.to}</dd>
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
            From wallet No. {wallet.id}, {formatMoney(wallet.balance, wallet.currency)} available. You can only send{' '}
            {info.name} to another {wallet.currency} wallet.
          </p>
          <div className="field">
            <label htmlFor="send-to">Recipient wallet number</label>
            <input
              id="send-to"
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
              maxLength={255}
              autoComplete="off"
              placeholder="Rent for September"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <FormError>{error}</FormError>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Sending…' : 'Send money'}
          </button>
        </form>
      )}
    </Sheet>
  );
}

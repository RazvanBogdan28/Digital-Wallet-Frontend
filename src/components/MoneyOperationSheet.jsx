import { useEffect, useRef, useState } from 'react';
import Sheet from './Sheet';
import Stamp from './Stamp';
import FormError from './FormError';
import { api, getSession } from '../lib/api';
import {
    CURRENCY_INFO,
    compareMoney,
    formatMoney,
    newKey,
    parseAmount,
} from '../lib/format';

const QUICK = [50, 100, 250, 500];

function readAttempt(storageKey, kind, wallet) {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;

    const attempt = JSON.parse(raw);

    if (
        !attempt ||
        attempt.version !== 1 ||
        attempt.kind !== kind ||
        attempt.walletId !== wallet.id ||
        attempt.currency !== wallet.currency ||
        typeof attempt.key !== 'string' ||
        !attempt.key.trim() ||
        attempt.key.length > 255 ||
        parseAmount(attempt.amount) == null ||
        (kind === 'transfer' && (
            !Number.isSafeInteger(attempt.toWalletId) ||
            attempt.toWalletId <= 0 ||
            (attempt.description != null && (
                typeof attempt.description !== 'string' ||
                attempt.description.length > 255
            ))
        ))
    ) {
        throw new Error('Invalid saved operation');
    }

    return attempt;
}

function restoreAttempt(storageKey, kind, wallet) {
    try {
        return {
            attempt: readAttempt(storageKey, kind, wallet),
            error: '',
        };
    } catch {
        return {
            attempt: null,
            error:
                'Could not read the saved operation. Do not start another ' +
                'operation until its result has been checked.',
        };
    }
}

export default function MoneyOperationSheet({
                                                kind,
                                                wallet,
                                                onClose,
                                                onDone,
                                            }) {
    const isTransfer = kind === 'transfer';
    const operationName = isTransfer ? 'transfer' : 'deposit';
    const info = CURRENCY_INFO[wallet.currency];

    const ownerRef = useRef(getSession()?.userId);
    const storageKeyRef = useRef(
        `dw.pending.v1:${import.meta.env.VITE_API_URL || location.origin}` +
        `:${ownerRef.current}:${wallet.id}:${kind}`,
    );

    const [initial] = useState(() =>
        restoreAttempt(storageKeyRef.current, kind, wallet),
    );

    const [amount, setAmount] = useState(
        initial.attempt ? String(initial.attempt.amount) : '',
    );
    const [toId, setToId] = useState(
        initial.attempt?.toWalletId
            ? String(initial.attempt.toWalletId)
            : '',
    );
    const [note, setNote] = useState(
        initial.attempt?.description ?? '',
    );
    const [attempt, setAttempt] = useState(initial.attempt);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(
        initial.error ||
        (initial.attempt
            ? `A saved ${operationName} has an unknown result. ` +
            'Retry it with the same details to check its result.'
            : ''),
    );
    const [result, setResult] = useState(null);

    const attemptRef = useRef(initial.attempt);
    const inFlightRef = useRef(false);
    const completedRef = useRef(false);
    const mountedRef = useRef(false);

    const locked = busy || Boolean(attempt) || Boolean(initial.error);

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
        };
    }, []);

    function sameOwner() {
        const currentOwner = getSession()?.userId;

        return (
            ownerRef.current != null &&
            String(currentOwner) === String(ownerRef.current)
        );
    }

    function forgetStoredAttempt(currentAttempt) {
        try {
            if (!currentAttempt) return false;

            const saved = readAttempt(
                storageKeyRef.current,
                kind,
                wallet,
            );

            if (saved?.key === currentAttempt.key) {
                sessionStorage.removeItem(storageKeyRef.current);
            }

            return true;
        } catch {
            return false;
        }
    }

    function rememberAttempt(currentAttempt) {
        sessionStorage.setItem(
            storageKeyRef.current,
            JSON.stringify(currentAttempt),
        );

        const saved = readAttempt(
            storageKeyRef.current,
            kind,
            wallet,
        );

        if (saved?.key !== currentAttempt.key) {
            throw new Error('Could not save the operation');
        }
    }

    function closeAnyway() {
        if (attemptRef.current && !completedRef.current) {
            const confirmed = window.confirm(
                `The ${operationName} may already have been processed. ` +
                'Closing does not cancel it. Its details are saved in this tab. ' +
                'Reopen this form to retry the same operation and check its result. ' +
                'Do not repeat it in another tab.\n\nClose anyway?',
            );

            if (!confirmed) return;
        }

        onClose();
    }

    async function close() {
        if (!result) {
            closeAnyway();
            return;
        }

        if (inFlightRef.current) return;

        if (!sameOwner()) {
            onClose();
            return;
        }

        inFlightRef.current = true;
        setBusy(true);
        setError('');

        try {
            const updated = await api.wallet(wallet.id);

            if (!mountedRef.current || !sameOwner()) return;

            if (!forgetStoredAttempt(attemptRef.current)) {
                setError(
                    'The operation was processed, but its saved details could not ' +
                    'be cleared. Press Done to retry.',
                );
                return;
            }

            onDone(
                updated,
                result.duplicate
                    ? `${isTransfer ? 'Transfer' : 'Deposit'} already processed. Balance refreshed.`
                    : `${isTransfer ? 'Sent' : 'Deposited'} ` +
                    formatMoney(result.amount, wallet.currency),
            );
        } catch (err) {
            if (mountedRef.current && sameOwner()) {
                setError(
                    err.message ||
                    'Could not refresh the balance. Press Done to retry.',
                );
            }
        } finally {
            inFlightRef.current = false;

            if (mountedRef.current) setBusy(false);
        }
    }

    async function submit(event) {
        event.preventDefault();

        if (
            inFlightRef.current ||
            completedRef.current ||
            initial.error
        ) {
            return;
        }

        if (!sameOwner()) {
            setError('Sign in to the same account before retrying.');
            return;
        }

        let currentAttempt = attemptRef.current;
        const wasRetry = Boolean(currentAttempt);

        if (!currentAttempt) {
            const parsed = parseAmount(amount);

            if (parsed == null) {
                setError(
                    'Enter an amount of at least 0.01, with up to two decimals.',
                );
                return;
            }

            let target;

            if (isTransfer) {
                target = Number(toId);

                if (!Number.isSafeInteger(target) || target <= 0) {
                    setError('Enter the recipient wallet number, like 42.');
                    return;
                }

                if (target === wallet.id) {
                    setError(
                        'Choose a different wallet than the one you are sending from.',
                    );
                    return;
                }

                if (compareMoney(parsed, wallet.balance) > 0) {
                    setError(
                        `That is more than the ${
                            formatMoney(wallet.balance, wallet.currency)
                        } available.`,
                    );
                    return;
                }
            }

            currentAttempt = {
                version: 1,
                kind,
                walletId: wallet.id,
                currency: wallet.currency,
                amount: parsed,
                key: newKey(),
                ...(isTransfer
                    ? {
                        toWalletId: target,
                        description: note.trim() || undefined,
                    }
                    : {}),
            };
        }

        try {
            rememberAttempt(currentAttempt);
        } catch {
            setError(
                'Could not save this operation for safe retry. ' +
                'No request was sent. Check browser storage and try again.',
            );
            return;
        }

        attemptRef.current = currentAttempt;
        setAttempt(currentAttempt);
        inFlightRef.current = true;
        setBusy(true);
        setError('');

        try {
            const updated = isTransfer
                ? await api.transfer(
                    currentAttempt.walletId,
                    {
                        toWalletId: currentAttempt.toWalletId,
                        amount: currentAttempt.amount,
                        description: currentAttempt.description,
                    },
                    currentAttempt.key,
                )
                : await api.deposit(
                    currentAttempt.walletId,
                    currentAttempt.amount,
                    currentAttempt.key,
                );

            completedRef.current = true;

            if (mountedRef.current && sameOwner()) {
                setResult({
                    updated,
                    amount: currentAttempt.amount,
                    to: currentAttempt.toWalletId,
                    duplicate: false,
                });
            }
        } catch (err) {
            if (
                err.status === 409 &&
                err.data?.error === 'DUPLICATE_TRANSACTION'
            ) {
                completedRef.current = true;

                if (mountedRef.current && sameOwner()) {
                    setResult({
                        amount: currentAttempt.amount,
                        to: currentAttempt.toWalletId,
                        duplicate: true,
                    });
                }
            } else if (
                (!wasRetry && [400, 403, 404, 422].includes(err.status)) ||
                (isTransfer && err.status === 400 && [
                    'SAME_WALLET_TRANSFER',
                    'CURRENCY_MISMATCH',
                    'INSUFFICIENT_FUNDS',
                ].includes(err.data?.error))
            ) {
                const removed = forgetStoredAttempt(currentAttempt);

                if (removed) {
                    attemptRef.current = null;

                    if (mountedRef.current) setAttempt(null);
                }

                if (mountedRef.current && sameOwner()) {
                    setError(
                        removed
                            ? err.message || 'The operation was rejected.'
                            : 'The operation was rejected, but its saved details ' +
                            'could not be cleared. Retry the same operation.',
                    );
                }
            } else if (mountedRef.current && sameOwner()) {
                setError(
                    `The ${operationName} result is still unknown. ` +
                    'Retry the same operation to check it, or close this window ' +
                    'and return later in the same tab.',
                );
            }
        } finally {
            inFlightRef.current = false;

            if (mountedRef.current) setBusy(false);
        }
    }

    return (
        <Sheet
            title={
                isTransfer
                    ? `Send ${wallet.currency}`
                    : `Deposit to ${info.name} wallet`
            }
            onClose={close}
        >
            {result ? (
                <div className="receipt">
                    <Stamp
                        label={
                            result.duplicate
                                ? 'Already processed'
                                : isTransfer
                                    ? 'Sent'
                                    : 'Deposited'
                        }
                    />

                    {result.duplicate && (
                        <p className="sheet-note">
                            This operation was already processed. No new operation
                            was made by this retry. Press Done to refresh the balance.
                        </p>
                    )}

                    <dl>
                        <div>
                            <dt>Amount</dt>
                            <dd>{formatMoney(result.amount, wallet.currency)}</dd>
                        </div>

                        {isTransfer && (
                            <div>
                                <dt>To</dt>
                                <dd>Wallet No. {result.to}</dd>
                            </div>
                        )}

                        {result.updated && (
                            <div>
                                <dt>New balance</dt>
                                <dd>
                                    {formatMoney(result.updated.balance, wallet.currency)}
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

                    {result.duplicate && (
                        <button
                            type="button"
                            className="btn btn-quiet"
                            onClick={closeAnyway}
                        >
                            Close without refreshing
                        </button>
                    )}
                </div>
            ) : (
                <form className="sheet-form" onSubmit={submit} noValidate>
                    <p className="sheet-note">
                        Wallet No. {wallet.id},{' '}
                        {formatMoney(wallet.balance, wallet.currency)} available.
                        {isTransfer && (
                            <> You can only send to another {wallet.currency} wallet.</>
                        )}
                    </p>

                    {attempt && (
                        <p className="sheet-note" role="status">
                            This operation is saved in this tab. Retrying uses the same
                            details and key. Closing does not cancel the operation.
                        </p>
                    )}

                    {isTransfer && (
                        <div className="field">
                            <label htmlFor="send-to">Recipient wallet number</label>
                            <input
                                id="send-to"
                                inputMode="numeric"
                                autoComplete="off"
                                placeholder="42"
                                value={toId}
                                disabled={locked}
                                onChange={(event) =>
                                    setToId(event.target.value.replace(/\D/g, ''))
                                }
                            />
                        </div>
                    )}

                    <div className="field">
                        <label htmlFor="operation-amount">
                            Amount in {wallet.currency}
                        </label>
                        <input
                            id="operation-amount"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0.00"
                            value={amount}
                            disabled={locked}
                            onChange={(event) => setAmount(event.target.value)}
                        />
                    </div>

                    {!isTransfer && (
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
                    )}

                    {isTransfer && (
                        <div className="field">
                            <label htmlFor="send-note">Note (optional)</label>
                            <input
                                id="send-note"
                                maxLength={255}
                                autoComplete="off"
                                placeholder="Rent for September"
                                value={note}
                                disabled={locked}
                                onChange={(event) => setNote(event.target.value)}
                            />
                        </div>
                    )}

                    <FormError>{error}</FormError>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={busy || Boolean(initial.error)}
                    >
                        {busy
                            ? isTransfer ? 'Sending…' : 'Depositing…'
                            : attempt
                                ? `Retry same ${operationName}`
                                : isTransfer ? 'Send money' : 'Deposit'}
                    </button>

                    {attempt && (
                        <button
                            type="button"
                            className="btn btn-quiet"
                            onClick={closeAnyway}
                        >
                            Close anyway
                        </button>
                    )}
                </form>
            )}
        </Sheet>
    );
}
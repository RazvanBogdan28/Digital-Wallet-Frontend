import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';
import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import MoneyOperationSheet from './MoneyOperationSheet';

const mocks = vi.hoisted(() => ({
    deposit: vi.fn(),
    transfer: vi.fn(),
    wallet: vi.fn(),
    userId: 1,
    hidden: false,
}));

vi.mock('../lib/api', () => ({
    api: {
        deposit: mocks.deposit,
        transfer: mocks.transfer,
        wallet: mocks.wallet,
    },
    getSession: () => ({ userId: mocks.userId }),
}));

vi.mock('../lib/privacy', () => ({
    usePrivacy: () => ({ hidden: mocks.hidden }),
}));

vi.mock('./Sheet', () => ({
    default: ({ title, onClose, children }) => (
        <section role="dialog" aria-label={title}>
            <button type="button" onClick={onClose}>
                Close
            </button>
            {children}
        </section>
    ),
}));

const wallet = {
    id: 5,
    currency: 'EUR',
    balance: '100.00',
};

function storedAttempt() {
    const key = Object.keys(sessionStorage).find(
        (value) => value.startsWith('dw.pending.v1:'),
    );

    return key
        ? JSON.parse(sessionStorage.getItem(key))
        : null;
}

function deferred() {
    let resolve;

    const promise = new Promise((done) => {
        resolve = done;
    });

    return { promise, resolve };
}

function open(kind = 'deposit') {
    const onClose = vi.fn();
    const onDone = vi.fn();

    const view = render(
        <MoneyOperationSheet
            kind={kind}
            wallet={wallet}
            onClose={onClose}
            onDone={onDone}
        />,
    );

    return { ...view, onClose, onDone };
}

function submit(kind = 'deposit') {
    fireEvent.change(screen.getByLabelText('Amount in EUR'), {
        target: { value: '25.50' },
    });

    if (kind === 'transfer') {
        fireEvent.change(
            screen.getByLabelText('Recipient wallet number'),
            { target: { value: '6' } },
        );
    }

    fireEvent.click(
        screen.getByRole('button', {
            name: kind === 'transfer' ? 'Send money' : 'Deposit',
        }),
    );
}

describe('Money operation recovery', () => {
    beforeEach(() => {
        sessionStorage.clear();

        mocks.userId = 1;
        mocks.hidden = false;

        mocks.deposit.mockReset();
        mocks.transfer.mockReset();
        mocks.wallet.mockReset();

        vi.spyOn(window, 'confirm').mockReturnValue(true);
    });

    it.each(['deposit', 'transfer'])(
        'retries an uncertain %s with the original key and payload',
        async (kind) => {
            const operation = kind === 'transfer'
                ? mocks.transfer
                : mocks.deposit;

            operation
                .mockRejectedValueOnce({ status: 503 })
                .mockResolvedValueOnce({ balance: '125.50' });

            open(kind);
            submit(kind);

            await screen.findByRole('button', {
                name: `Retry same ${kind}`,
            });

            const saved = storedAttempt();

            expect(saved.amount).toBe('25.50');
            expect(screen.getByLabelText('Amount in EUR')).toBeDisabled();

            fireEvent.click(
                screen.getByRole('button', {
                    name: `Retry same ${kind}`,
                }),
            );

            await screen.findByRole('button', { name: 'Done' });

            expect(operation.mock.calls[1]).toEqual(
                operation.mock.calls[0],
            );

            expect(storedAttempt().key).toBe(saved.key);
        },
    );

    it('keeps a late success after unmount and recovers it on reopening', async () => {
        const pending = deferred();

        mocks.deposit.mockReturnValueOnce(pending.promise);

        const first = open();
        submit();

        await waitFor(() => {
            expect(mocks.deposit).toHaveBeenCalledTimes(1);
        });

        const saved = storedAttempt();

        fireEvent.click(screen.getByRole('button', { name: 'Close' }));

        expect(window.confirm).toHaveBeenCalledTimes(1);
        expect(first.onClose).toHaveBeenCalledTimes(1);

        first.unmount();

        await act(async () => {
            pending.resolve({ balance: '125.50' });
        });

        expect(storedAttempt().key).toBe(saved.key);
        expect(first.onDone).not.toHaveBeenCalled();

        mocks.deposit.mockRejectedValueOnce({
            status: 409,
            data: { error: 'DUPLICATE_TRANSACTION' },
        });

        mocks.wallet.mockResolvedValueOnce({
            ...wallet,
            balance: '125.50',
        });

        const reopened = open();

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Retry same deposit',
            }),
        );

        await screen.findByRole('button', { name: 'Done' });

        expect(mocks.deposit.mock.calls[1]).toEqual(
            mocks.deposit.mock.calls[0],
        );

        fireEvent.click(screen.getByRole('button', { name: 'Done' }));

        await waitFor(() => {
            expect(reopened.onDone).toHaveBeenCalledWith(
                expect.objectContaining({ balance: '125.50' }),
                'Deposit already processed. Balance refreshed.',
            );
        });

        expect(storedAttempt()).toBeNull();
    });

    it.each([400, 403, 404, 422])(
        'preserves an uncertain operation after a retry returns %s',
        async (status) => {
            mocks.deposit
                .mockRejectedValueOnce({ status: 0 })
                .mockRejectedValueOnce({
                    status,
                    data: { error: 'UNRELATED_ERROR' },
                });

            open();
            submit();

            await screen.findByRole('button', {
                name: 'Retry same deposit',
            });

            const key = storedAttempt().key;

            fireEvent.click(
                screen.getByRole('button', {
                    name: 'Retry same deposit',
                }),
            );

            await waitFor(() => {
                expect(mocks.deposit).toHaveBeenCalledTimes(2);
            });

            await waitFor(() => {
                expect(
                    screen.getByRole('button', {
                        name: 'Retry same deposit',
                    }),
                ).toBeEnabled();
            });

            expect(storedAttempt().key).toBe(key);
            expect(screen.getByLabelText('Amount in EUR')).toBeDisabled();
        },
    );

    it('unlocks a transfer rejected with CURRENCY_MISMATCH after an uncertain result', async () => {
        mocks.transfer
            .mockRejectedValueOnce({ status: 0 })
            .mockRejectedValueOnce({
                status: 400,
                data: { error: 'CURRENCY_MISMATCH' },
                message: 'Wallet currencies must match',
            });

        open('transfer');
        submit('transfer');

        await screen.findByRole('button', {
            name: 'Retry same transfer',
        });

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Retry same transfer',
            }),
        );

        await screen.findByText('Wallet currencies must match');

        expect(storedAttempt()).toBeNull();
        expect(screen.getByLabelText('Amount in EUR')).toBeEnabled();

        expect(
            screen.getByLabelText('Recipient wallet number'),
        ).toBeEnabled();
    });

    it('retains a receipt and its saved key if balance refresh fails', async () => {
        mocks.deposit.mockResolvedValueOnce({
            balance: '125.50',
        });

        mocks.wallet.mockRejectedValueOnce({
            message: 'Server unavailable',
        });

        const view = open();
        submit();

        await screen.findByRole('button', { name: 'Done' });

        fireEvent.click(screen.getByRole('button', { name: 'Done' }));

        await screen.findByText('Server unavailable');

        expect(storedAttempt()).not.toBeNull();
        expect(view.onDone).not.toHaveBeenCalled();
    });

    it('does not send an operation if browser storage fails', async () => {
        open();

        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('unavailable');
        });

        submit();

        await screen.findByText(/No request was sent/);

        expect(mocks.deposit).not.toHaveBeenCalled();
    });

    it('prevents a saved operation from being retried under another account', async () => {
        mocks.deposit.mockRejectedValueOnce({ status: 0 });

        open();
        submit();

        await screen.findByRole('button', {
            name: 'Retry same deposit',
        });

        mocks.userId = 2;

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Retry same deposit',
            }),
        );

        await screen.findByText(
            'Sign in to the same account before retrying.',
        );

        expect(mocks.deposit).toHaveBeenCalledTimes(1);
        expect(storedAttempt()).not.toBeNull();
    });

    it('masks amounts and uses a completion message without financial values', async () => {
        mocks.hidden = true;

        mocks.deposit.mockResolvedValueOnce({
            balance: '125.50',
        });

        mocks.wallet.mockResolvedValueOnce({
            ...wallet,
            balance: '125.50',
        });

        const view = open();

        expect(
            screen.getByLabelText('Amount in EUR'),
        ).toHaveAttribute('type', 'password');

        expect(screen.queryByText(/€100/)).not.toBeInTheDocument();

        submit();

        await screen.findByRole('button', { name: 'Done' });

        expect(screen.queryByText(/€25/)).not.toBeInTheDocument();
        expect(screen.queryByText(/€125/)).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Done' }));

        await waitFor(() => {
            expect(view.onDone).toHaveBeenCalledWith(
                expect.any(Object),
                'Deposit completed.',
            );
        });
    });
    it.each(['deposit', 'transfer'])(
        'closes a successful %s receipt after refresh fails and preserves its key for retry',
        async (kind) => {
            mocks[kind].mockResolvedValueOnce({
                balance: '125.50',
            });

            mocks.wallet.mockRejectedValueOnce({
                status: 503,
                message: 'Server unavailable',
            });

            const view = open(kind);
            submit(kind);

            await screen.findByRole('button', { name: 'Done' });

            const saved = storedAttempt();

            fireEvent.click(
                screen.getByRole('button', { name: 'Done' }),
            );

            await screen.findByText('Server unavailable');

            fireEvent.click(
                screen.getByRole('button', {
                    name: 'Close without refreshing',
                }),
            );

            expect(view.onClose).toHaveBeenCalledTimes(1);
            expect(view.onDone).not.toHaveBeenCalled();
            expect(storedAttempt()).toEqual(saved);

            view.unmount();

            mocks[kind].mockRejectedValueOnce({
                status: 409,
                data: { error: 'DUPLICATE_TRANSACTION' },
            });

            open(kind);

            expect(
                screen.getByLabelText('Amount in EUR'),
            ).toBeDisabled();

            fireEvent.click(
                screen.getByRole('button', {
                    name: `Retry same ${kind}`,
                }),
            );

            await screen.findByRole('button', { name: 'Done' });

            expect(mocks[kind].mock.calls[1]).toEqual(
                mocks[kind].mock.calls[0],
            );

            expect(storedAttempt().key).toBe(saved.key);
        },
    );
});
import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = {
    userId: 1,
    email: 'first@example.com',
    accessToken: 'old-access',
    refreshToken: 'first-refresh',
};

function response(status, data = null) {
    return {
        status,
        ok: status >= 200 && status < 300,
        text: async () => data === null ? '' : JSON.stringify(data),
        json: async () => data,
    };
}

function deferred() {
    let resolve;

    const promise = new Promise((done) => {
        resolve = done;
    });

    return { promise, resolve };
}

describe('API authentication', () => {
    let client;
    let fetchMock;
    let expired;

    beforeEach(async () => {
        vi.resetModules();
        localStorage.clear();

        vi.spyOn(window, 'addEventListener').mockImplementation(() => {});

        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        client = await import('./api');
        client.saveSession({ ...session });

        expired = vi.fn();
        client.onSessionExpired(expired);
    });

    it('preserves the session when refresh returns 503 and allows another refresh', async () => {
        fetchMock
            .mockResolvedValueOnce(response(401))
            .mockResolvedValueOnce(response(503));

        await expect(client.api.wallet(5)).rejects.toMatchObject({
            status: 503,
            data: { error: 'REFRESH_UNAVAILABLE' },
        });

        expect(client.getSession()).toEqual(session);
        expect(expired).not.toHaveBeenCalled();

        fetchMock
            .mockResolvedValueOnce(response(401))
            .mockResolvedValueOnce(response(200, {
                accessToken: 'new-access',
            }))
            .mockResolvedValueOnce(response(200, {
                id: 5,
                balance: '25.00',
            }));

        await expect(client.api.wallet(5)).resolves.toMatchObject({
            id: 5,
        });

        expect(client.getSession().accessToken).toBe('new-access');
    });

    it('preserves the session when the network is unavailable', async () => {
        fetchMock.mockRejectedValueOnce(new TypeError('offline'));

        await expect(client.api.wallet(5)).rejects.toMatchObject({
            status: 0,
        });

        expect(client.getSession()).toEqual(session);
        expect(expired).not.toHaveBeenCalled();
    });

    it('preserves the session when refresh cannot reach the server', async () => {
        fetchMock
            .mockResolvedValueOnce(response(401))
            .mockRejectedValueOnce(new TypeError('offline'));

        await expect(client.api.wallet(5)).rejects.toMatchObject({
            status: 0,
            data: { error: 'REFRESH_UNAVAILABLE' },
        });

        expect(client.getSession()).toEqual(session);
        expect(expired).not.toHaveBeenCalled();
    });

    it('expires the session after a second 401', async () => {
        fetchMock
            .mockResolvedValueOnce(response(401))
            .mockResolvedValueOnce(response(200, {
                accessToken: 'new-access',
            }))
            .mockResolvedValueOnce(response(401));

        await expect(client.api.wallet(5)).rejects.toMatchObject({
            status: 401,
        });

        expect(client.getSession()).toBeNull();
        expect(localStorage.getItem('dw.session')).toBeNull();
        expect(expired).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('expires the session when the refresh token is rejected', async () => {
        fetchMock
            .mockResolvedValueOnce(response(401))
            .mockResolvedValueOnce(response(403));

        await expect(client.api.wallet(5)).rejects.toMatchObject({
            status: 401,
        });

        expect(client.getSession()).toBeNull();
        expect(expired).toHaveBeenCalledTimes(1);
    });

    it('does not clear a session when public login returns 401', async () => {
        fetchMock.mockResolvedValueOnce(response(401));

        await expect(
            client.api.login('wrong@example.com', 'wrong'),
        ).rejects.toMatchObject({
            status: 401,
        });

        expect(client.getSession()).toEqual(session);
        expect(expired).not.toHaveBeenCalled();
    });

    it('shares a refresh request between concurrent unauthorized requests', async () => {
        const refresh = deferred();

        fetchMock.mockImplementation((url, options) => {
            if (url.endsWith('/api/auth/refresh')) {
                return refresh.promise;
            }

            return Promise.resolve(
                options.headers.Authorization === 'Bearer old-access'
                    ? response(401)
                    : response(200, { id: 5 }),
            );
        });

        const first = client.api.wallet(5);
        const second = client.api.wallet(6);

        await vi.waitFor(() => {
            expect(
                fetchMock.mock.calls.filter(
                    ([url]) => url.endsWith('/api/auth/refresh'),
                ),
            ).toHaveLength(1);
        });

        refresh.resolve(response(200, {
            accessToken: 'new-access',
        }));

        await expect(
            Promise.all([first, second]),
        ).resolves.toHaveLength(2);

        expect(fetchMock).toHaveBeenCalledTimes(5);
    });

    it('does not overwrite another account with an old refresh response', async () => {
        const refresh = deferred();

        fetchMock
            .mockResolvedValueOnce(response(401))
            .mockReturnValueOnce(refresh.promise);

        const pending = client.api.wallet(5);

        const rejected = expect(pending).rejects.toMatchObject({
            data: { error: 'SESSION_CHANGED' },
        });

        await vi.waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        const other = {
            userId: 2,
            email: 'second@example.com',
            accessToken: 'second-access',
            refreshToken: 'second-refresh',
        };

        localStorage.setItem('dw.session', JSON.stringify(other));

        refresh.resolve(response(200, {
            accessToken: 'stale-access',
        }));

        await rejected;

        expect(client.getSession()).toEqual(other);

        expect(
            JSON.parse(localStorage.getItem('dw.session')),
        ).toEqual(other);

        expect(expired).not.toHaveBeenCalled();
    });

    it('notifies subscribers when another tab logs out', () => {
        const changed = vi.fn();
        const unsubscribe = client.onExternalSessionChanged(changed);

        localStorage.removeItem('dw.session');
        client.synchronizeSession();

        expect(client.getSession()).toBeNull();
        expect(changed).toHaveBeenCalledTimes(1);

        unsubscribe();
    });

    it('accepts a token update for the same login without an account change', () => {
        const changed = vi.fn();

        client.onExternalSessionChanged(changed);

        localStorage.setItem(
            'dw.session',
            JSON.stringify({
                ...session,
                accessToken: 'updated',
            }),
        );

        client.synchronizeSession();

        expect(client.getSession().accessToken).toBe('updated');
        expect(changed).not.toHaveBeenCalled();
    });

    it('reuses the same body and idempotency key after refreshing', async () => {
        fetchMock
            .mockResolvedValueOnce(response(401))
            .mockResolvedValueOnce(response(200, {
                accessToken: 'new-access',
            }))
            .mockResolvedValueOnce(response(200, {
                balance: '25.50',
            }));

        await client.api.deposit(5, '25.50', 'deposit-key');

        const original = fetchMock.mock.calls[0][1];
        const retried = fetchMock.mock.calls[2][1];

        expect(retried.body).toBe(original.body);
        expect(retried.headers['Idempotency-Key']).toBe('deposit-key');
        expect(retried.headers.Authorization).toBe('Bearer new-access');
    });
});
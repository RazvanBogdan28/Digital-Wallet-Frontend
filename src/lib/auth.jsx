import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import {
    api,
    ApiError,
    getSession,
    onExternalSessionChanged,
    onSessionExpired,
    saveSession,
    synchronizeSession,
} from './api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
    const [state, setState] = useState({
        status: 'loading',
        user: null,
        error: '',
    });

    const mountedRef = useRef(false);
    const operationRef = useRef(0);

    const isCurrent = useCallback(
        (operation) =>
            mountedRef.current && operation === operationRef.current,
        [],
    );

    const assertCurrent = useCallback(
        (operation) => {
            synchronizeSession();

            if (!isCurrent(operation)) {
                throw new ApiError(
                    401,
                    'Your session changed. Please try again.',
                    { error: 'SESSION_CHANGED' },
                );
            }
        },
        [isCurrent],
    );

    const hydrate = useCallback(
        async (operation) => {
            const user = await api.me();

            assertCurrent(operation);

            setState({
                status: 'authed',
                user: {
                    ...user,
                    isAdmin: user.role === 'ADMIN',
                },
                error: '',
            });
        },
        [assertCurrent],
    );

    const handleHydrationError = useCallback(
        (err, operation) => {
            if (!isCurrent(operation)) return;

            if (
                err.status === 401 &&
                err.data?.error !== 'SESSION_CHANGED'
            ) {
                saveSession(null);

                setState({
                    status: 'anon',
                    user: null,
                    error: '',
                });

                return;
            }

            setState({
                status: 'error',
                user: null,
                error:
                    err.message ||
                    'Could not load your session. Please try again.',
            });
        },
        [isCurrent],
    );

    const retry = useCallback(async () => {
        synchronizeSession();

        const operation = ++operationRef.current;
        const session = getSession();

        if (!session) {
            setState({
                status: 'anon',
                user: null,
                error: '',
            });

            return;
        }

        setState({
            status: 'loading',
            user: null,
            error: '',
        });

        try {
            await hydrate(operation);
        } catch (err) {
            handleHydrationError(err, operation);
        }
    }, [hydrate, handleHydrationError]);

    useEffect(() => {
        mountedRef.current = true;

        onSessionExpired(() => {
            operationRef.current += 1;

            if (mountedRef.current) {
                setState({
                    status: 'anon',
                    user: null,
                    error: '',
                });
            }
        });

        const unsubscribe = onExternalSessionChanged(() => {
            void retry();
        });

        void retry();

        return () => {
            unsubscribe();
            mountedRef.current = false;
            operationRef.current += 1;
            onSessionExpired(() => {});
        };
    }, [retry]);

    const login = useCallback(
        async (email, password) => {
            const operation = ++operationRef.current;

            const res = await api.login(email, password);

            assertCurrent(operation);

            const next = {
                userId: res.userId,
                email: res.email,
                accessToken: res.accessToken,
                refreshToken: res.refreshToken,
            };

            saveSession(next);

            setState({
                status: 'loading',
                user: null,
                error: '',
            });

            try {
                await hydrate(operation);
            } catch (err) {
                handleHydrationError(err, operation);
                throw err;
            }
        },
        [assertCurrent, hydrate, handleHydrationError],
    );

    const register = useCallback(
        async (payload) => {
            const operation = ++operationRef.current;

            await api.register(payload);

            assertCurrent(operation);

            await login(payload.email, payload.password);
        },
        [assertCurrent, login],
    );

    const logout = useCallback(async () => {
        operationRef.current += 1;

        const session = getSession();

        saveSession(null);

        setState({
            status: 'anon',
            user: null,
            error: '',
        });

        if (session?.refreshToken) {
            await api.logout(session.refreshToken);
        }
    }, []);

    const value = useMemo(
        () => ({
            ...state,
            login,
            register,
            logout,
            retry,
        }),
        [state, login, register, logout, retry],
    );

    if (state.status === 'error') {
        return (
            <div className="notice notice-page">
                <h1>Could not load your session</h1>

                <p role="alert">{state.error}</p>

                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={retry}
                >
                    Try again
                </button>

                <button
                    type="button"
                    className="btn btn-quiet"
                    onClick={logout}
                >
                    Sign out
                </button>
            </div>
        );
    }

    return (
        <AuthCtx.Provider value={value}>
            {children}
        </AuthCtx.Provider>
    );
}

export const useAuth = () => useContext(AuthCtx);
# Digital Wallet — Frontend

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A React and Vite client for the [Digital Wallet API](https://github.com/RazvanBogdan28/Digital-Wallet-API), built with Spring Boot.

The application supports authentication, multi-currency wallets, deposits, transfers and transaction history. It handles token refresh, uncertain payment results and session changes between browser tabs.

## Live Demo

- [Frontend](https://digitalwalletfrontend.vercel.app)
- [Backend API](https://digital-wallet-api-production-2f16.up.railway.app)
- [Swagger UI](https://digital-wallet-api-production-2f16.up.railway.app/swagger-ui/index.html)
- [Backend repository](https://github.com/RazvanBogdan28/Digital-Wallet-API)

Registration is open. New wallets start with a zero balance.

This is a portfolio application. Deposits and transfers update application balances; they do not process real bank payments.

## Screenshots

| Sign in | Dashboard |
|---|---|
| ![Sign in](docs/screenshot-login.png) | ![Dashboard](docs/screenshot-dashboard.png) |

| Wallet detail |
|---|
| ![Wallet detail](docs/screenshot-wallet.png) |

## Features

- Email and password registration and login
- Automatic access token refresh with a single shared refresh request
- Session synchronization between browser tabs
- EUR, USD and RON wallets, with one wallet per currency per user
- Deposits and transfers with an `Idempotency-Key`
- Recovery of pending operations after a lost response
- Paginated transaction history
- Balance chart derived from a recent transaction window
- Separate loading, error and retry states for wallet data and transaction activity
- Admin user directory with expandable wallet balances
- Persistent “Hide amounts” preference
- Keyboard focus containment in modal dialogs
- Responsive wallet cards, transaction tables and notifications

## Tech Stack

- React 18.3
- Vite 8.3
- React Router 7.18
- Recharts 2.15
- lucide-react
- Vitest 5, React Testing Library and jsdom
- Vercel

## Main Files

| File | Responsibility |
|---|---|
| `src/App.jsx` | Routes and authentication/admin guards |
| `src/main.jsx` | Application entry and providers |
| `src/lib/api.js` | Requests, error handling, token refresh and session synchronization |
| `src/lib/auth.jsx` | Authentication state, hydration, login, registration and logout |
| `src/lib/privacy.jsx` | Amount visibility preference |
| `src/lib/format.js` | Money, currency and date helpers |
| `src/lib/ledger.js` | Transaction rows and balance reconstruction |
| `src/pages/AuthPage.jsx` | Login and registration forms |
| `src/pages/Dashboard.jsx` | Wallet overview and recent activity |
| `src/pages/WalletPage.jsx` | Wallet details, balance chart and transaction pagination |
| `src/pages/AdminPage.jsx` | Admin user and wallet directory |
| `src/components/MoneyOperationSheet.jsx` | Shared deposit and transfer lifecycle |
| `src/components/Sheet.jsx` | Modal dialog and keyboard focus management |
| `src/lib/api.test.js` | API client regression tests |
| `src/components/MoneyOperationSheet.test.jsx` | Deposit and transfer regression tests |
| `src/test/setup.js` | Test environment setup |
| `vitest.config.js` | Vitest configuration |

## Authentication and Sessions

Authenticated requests include:

```http
Authorization: Bearer <accessToken>
```

The client loads the current profile through `GET /api/users/me`, using the bearer token. The response includes the user's role:

```json
{
  "id": 6,
  "firstName": "Transfer",
  "lastName": "Receiver",
  "email": "receiver@example.com",
  "role": "USER"
}
```

Admin navigation is enabled when this response contains `role: "ADMIN"`. Profile hydration does not download the user directory or infer permissions from token claims.

When an authenticated request receives `401`, the client attempts to refresh the access token. Concurrent requests share the same refresh operation.

After a successful refresh, the original request is retried once. If that request also receives `401`, the session is cleared and the authentication state is updated.

Network errors and temporary server failures do not, by themselves, clear the session. A failed initial profile load can be retried without discarding stored credentials.

Session changes are synchronized between tabs. Logout or login with another account invalidates requests belonging to the previous session. Responses from those requests must not restore the previous account.

The session is stored in `localStorage`, with an in-memory copy used by the API client.

## Deposits and Transfers

Both operations require an `Idempotency-Key` header.

```http
POST /api/wallets/{id}/deposit
Content-Type: application/json
Authorization: Bearer <accessToken>
Idempotency-Key: <unique-operation-key>
```

```json
{
  "amount": "25.50"
}
```

```http
POST /api/wallets/{id}/transfer
Content-Type: application/json
Authorization: Bearer <accessToken>
Idempotency-Key: <unique-operation-key>
```

```json
{
  "toWalletId": 42,
  "amount": "25.50",
  "description": "Shared expenses"
}
```

The client creates a key for a new operation and reuses the same key and payload when retrying it.

Before sending the request, the pending operation is saved in `sessionStorage`. The stored record is scoped to the API, account, wallet and operation type.

A network failure or lost response can leave the result unknown. In that case:

- The operation retains its original key and payload.
- The form prevents changes that would turn the retry into another operation.
- “Retry same deposit” or “Retry same transfer” checks the same operation.
- Closing the dialog does not cancel the server request.
- “Close anyway” warns the user and preserves the pending operation for reopening in the same tab.

A success or duplicate-operation response is acknowledged through the receipt. Selecting Done refreshes the wallet before clearing the pending record.

Both receipt types offer “Close without refreshing”, including when the balance refresh fails. This closes the dialog while preserving the original operation key and payload. Reopening the dialog allows recovery with the same key. The displayed wallet balance may remain stale until refreshed. Closing does not cancel or reverse the operation.

A late response received after closing the dialog does not discard the pending operation.

Pending records use `sessionStorage`; they are not shared between tabs and are not a durable transaction log. Closing the browser tab can remove them. Check transaction history before starting another operation when the previous result remains uncertain.

## Money Representation

The API returns transaction amounts and wallet balances as decimal strings:

```json
{
  "balance": "125.50"
}
```

```json
{
  "amount": "25.50"
}
```

The frontend uses integer cents with `BigInt` for money comparisons and balance reconstruction. Displayed amounts retain two decimal places.

The chart converts balances to JavaScript numbers only for plotting. Its tooltip formats the original decimal balance.

## Transaction History and Time

Transaction history is paginated. Newer transactions appear first, with the transaction ID used to break timestamp ties.

The balance chart requests `GET /api/transactions/wallet/{id}/window?size=100`. This endpoint returns a recent transaction window and its associated wallet balance from the same database snapshot. Balances are reconstructed from that snapshot. When the window does not contain the full history, the interface indicates its limited coverage.

Transaction timestamps include timezone information. The browser displays dates and times in the user's local timezone.

## Ownership and Admin Access

The backend enforces ownership and role permissions. Client-side route guards improve navigation but do not replace server authorization.

Users can access their own wallet data. Attempts to open unavailable or unauthorized wallets display an error state.

The admin page requests the ADMIN-only `GET /api/users` endpoint and loads users' wallets on demand. Admin status comes from the role returned by `GET /api/users/me`. The backend remains responsible for authorizing every request.

## Privacy and Accessibility

The “Hide amounts” preference is stored locally and masks amounts in wallet cards, transaction rows, admin balances and money-operation dialogs. Money-operation notifications use messages without amounts.

This preference changes presentation only. It does not remove financial data from API responses or browser memory.

Modal dialogs support Escape, contain keyboard focus and make the background inactive while open. Focus returns to the previous element when the dialog closes.

## Password Validation

Registration requires at least eight characters.

Passwords must not exceed 72 UTF-8 bytes. This limit is checked by both the frontend and backend.

UTF-8 bytes are not the same as characters: accented characters and emoji can use multiple bytes.

## Running Locally

### Requirements

- Node.js 24 LTS
- npm
- A reachable backend

### Install

```bash
npm ci
```

Create `.env` from `.env.example`.

PowerShell:

```powershell
Copy-Item .env.example .env
```

Bash:

```bash
cp .env.example .env
```

To use a local backend:

```dotenv
VITE_API_URL=
VITE_PROXY_TARGET=http://localhost:8080
```

Start the frontend:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

### API Configuration

With `VITE_API_URL` empty, requests use relative `/api/...` URLs.

During development, Vite forwards these requests to `VITE_PROXY_TARGET`. The configured fallback target is the deployed Railway backend.

To call a backend directly:

```dotenv
VITE_API_URL=http://localhost:8080
```

Direct requests require the backend to allow the frontend origin through CORS.

Vite environment values are included in the frontend build. Do not put secrets in `VITE_*` variables.

### Production Build

```bash
npm run build
```

To inspect the build locally:

```bash
npm run preview
```

The development proxy is configured for `npm run dev`. Previewing the build requires a direct API URL or a separate proxy serving `/api` requests.

## Deployment on Vercel

The repository includes `vercel.json` with:

- An `/api/*` rewrite to the Railway backend
- A fallback rewrite to `index.html` for client-side routes

When `VITE_API_URL` is empty, the deployed client uses the API rewrite.

When `VITE_API_URL` contains an absolute backend URL, requests go directly to that backend and require suitable CORS configuration.

Changing a `VITE_*` value requires rebuilding the frontend. Use Node.js 24 for the build.

Deploy a backend version supporting `GET /api/users/me` before deploying this frontend version.

## Security Considerations

Access and refresh tokens are stored in `localStorage`. Scripts running on the page can read them, so an XSS vulnerability could expose the session.

Possible production improvements include an `HttpOnly`, `Secure` refresh-token cookie, a short-lived access token kept in memory and an appropriate CSRF strategy for cookie-based authentication.

Ownership checks, role checks, amount validation and idempotency enforcement remain backend responsibilities.

## Verification

Run the regression suite and production build:

```bash
npm test
npm run build
```

For watch mode:

```bash
npm run test:watch
```

The current suite contains **25 tests across two files**:

| Test file | Tests | Coverage |
|---|---:|---|
| `src/lib/api.test.js` | 11 | Shared refresh, transient failures, final authorization failures, session changes and idempotency headers on retries |
| `src/components/MoneyOperationSheet.test.jsx` | 14 | Uncertain results, retained keys and payloads, late responses, rejection handling, storage failures, privacy and closing receipts after a failed balance refresh |

These tests use mocked requests and component dependencies. They do not replace browser end-to-end tests or backend integration tests. A successful build checks compilation and bundling.

Manual regression checks include:

- Registration, login, logout and startup retry after a temporary backend failure
- `GET /api/users/me` returning the authenticated profile and role
- Deposits, transfers, transaction pagination and the balance chart
- Account changes and logout across actual browser tabs
- Admin access and rejection of unauthorized requests
- Amount privacy in cards, history, dialogs and admin balances
- Tab, Shift+Tab, Escape and focus restoration in the actual modal dialog

## Future Improvements

- Browser end-to-end regression tests
- Additional tests for profile hydration, dashboard loading, charts and modal focus behavior
- Paginated admin user listing
- Refresh-token storage through secure cookies
- Account settings
- Dark mode

## Related Project

See the [Digital Wallet API](https://github.com/RazvanBogdan28/Digital-Wallet-API) repository for backend setup, database migrations, tests and API documentation.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

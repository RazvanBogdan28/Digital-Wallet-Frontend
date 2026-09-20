# Digital Wallet: frontend

React frontend for the [Digital Wallet API](https://github.com/RazvanBogdan28/Digital-Wallet-API). Every wallet is drawn as a banknote: the currency sets the ink (EUR blue, USD green, RON red) and the wallet id seeds a unique guilloche pattern.

- **Live API:** https://digital-wallet-api-production-2f16.up.railway.app (Swagger UI at `/swagger-ui/index.html`)
- **Stack:** React 18, Vite, React Router, Recharts, Lucide icons. Plain CSS, no UI kit. Fonts are self-hosted through Fontsource.

## Features

| Area | What it does |
| --- | --- |
| Auth | Register (auto sign-in), login, silent access-token refresh on `401` (single flight, then retry), logout that revokes the refresh token |
| Wallets | One wallet per currency (EUR, USD, RON), created with one click from the dashboard |
| Deposit | Amount validation (max 2 decimals), quick amounts, confirmation stamp |
| Send money | Transfers by wallet number with a note. Sends a fresh `Idempotency-Key` per attempt and reuses it only after a network failure, so a retry can never move money twice |
| History | Paginated ledger per wallet, plus a recent-activity feed merged across wallets |
| Balance chart | Step chart rebuilt by walking transactions backwards from the current balance |
| Admin | `ADMIN` users get a Users page: search, and expand a user to see wallets and balances |
| Privacy | "Hide amounts" toggle masks every balance, ledger amount and chart value |
| Responsive | Rail turns into a bottom bar, sheets become bottom sheets, ledger reflows on phones |

## Run it

```bash
npm install
cp .env.example .env   # optional, defaults already point to the Railway API
npm run dev            # http://localhost:5173
```

In development every `/api/*` call goes through the Vite proxy, so **no CORS setup is needed** locally.

## How it reaches the API

The client always calls relative `/api/...` URLs unless `VITE_API_URL` is set.

| Where it runs | How `/api` is resolved |
| --- | --- |
| `npm run dev` | Vite proxy (`vite.config.js`), target from `VITE_PROXY_TARGET` |
| Vercel | Rewrite in `vercel.json` |
| Netlify | `public/_redirects` |
| Anywhere else (GitHub Pages, S3, ...) | Set `VITE_API_URL` to the full API URL **and** enable CORS on the backend |

### CORS snippet (only needed when `VITE_API_URL` is set)

```java
@Bean
CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of("http://localhost:5173", "https://your-frontend.example"));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Idempotency-Key"));
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/api/**", config);
    return source;
}
```

And in your `SecurityFilterChain`: `http.cors(Customizer.withDefaults())`.

## Deploy

**Vercel:** import the repository. Framework preset is Vite, nothing else to configure.
**Netlify:** build command `npm run build`, publish directory `dist`.

## Endpoints used

| UI | Endpoint |
| --- | --- |
| Sign in / Register | `POST /api/auth/login`, `POST /api/users` |
| Refresh / Sign out | `POST /api/auth/refresh`, `POST /api/auth/logout` |
| Profile | `GET /api/users/{id}` |
| Wallet list / detail | `GET /api/wallets/user/{userId}`, `GET /api/wallets/{id}` |
| Add wallet | `POST /api/wallets` |
| Deposit | `POST /api/wallets/{id}/deposit` |
| Send money | `POST /api/wallets/{id}/transfer` with `Idempotency-Key` |
| History | `GET /api/transactions/wallet/{walletId}?page=&size=` |
| Admin users | `GET /api/users` |

## Project layout

```
src/
  lib/          api client (auth + refresh), formatting, ledger maths, auth and privacy context
  components/   WalletNote, Guilloche, Ledger, BalanceChart, Deposit/Send sheets, Shell
  pages/        AuthPage, Dashboard, WalletPage, AdminPage
```

## Notes and known limits

- The API has no "who am I" endpoint, so admin status is read from the token's role claim, falling back to probing the ADMIN-only `GET /api/users`.
- Transfers need the recipient's wallet number and must be in the same currency (the API rejects currency mismatches).
- The API does not document its sort order for transactions, so the UI sorts within each page and looks at both ends of the history to find the newest transactions for the chart.
- Tokens are kept in `localStorage` to keep the demo simple. For production, prefer an `httpOnly` cookie set by the backend.

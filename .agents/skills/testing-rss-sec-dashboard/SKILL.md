---
name: RSS Security Dashboard E2E Testing
description: How to set up and run the Go + GraphQL/React RSS Security Dashboard for local end-to-end and Playwright testing, including Clean Architecture backend and explicit DI.
---

# RSS Security Dashboard E2E Testing

## Devin Secrets Needed

None. The app uses an auto-generated JWT secret from `backend/.env.example` (`JWT_SECRET` defaults to `dev-secret-do-not-use-in-production`) and SQLite in development.

## Preconditions

- Go 1.25+, Node.js 20+ and npm are installed.
- The repo is checked out and on the correct branch (e.g. `devin/go-clean-arch`).
- Ports 4000 (backend) and 8765 (local RSS fixture) are free.

## Quick setup

```bash
# Build backend
cd /home/ubuntu/repos/qr/backend
cp .env.example .env
export PATH=$PATH:$HOME/.local/go/bin
go build ./...
go test ./...

# Build frontend
cd /home/ubuntu/repos/qr/frontend
npm install
npm run build

# Start backend serving the bundled frontend
cd /home/ubuntu/repos/qr/backend
RATE_LIMIT_DISABLED=true go run ./cmd/server
```

The UI is then reachable at `http://localhost:4000/` and GraphQL at `http://localhost:4000/graphql`.

## Database path note

`DATABASE_URL="file:./dev.db"` is resolved relative to the working directory where the Go binary runs (`backend/`). `frontend/playwright.config.ts` resets the DB by removing `backend/dev.db` before starting the server.

## Local RSS fixture

For deterministic feed/article testing, run a tiny static file server and point the feed URL at it:

```bash
python3 -m http.server 8765 --directory /tmp &
# create /tmp/test-feed.xml with at least two <item> entries
```

Then add the feed as `http://localhost:8765/test-feed.xml`.

## E2E commands

```bash
cd /home/ubuntu/repos/qr/frontend

# Run all Playwright E2E tests (chromium + Pixel 5)
npx playwright test

# Run a single spec headed for visual recording
npx playwright test e2e/<spec>.spec.ts --project=chromium --headed
```

## Manual flow notes

- First registered user becomes `ADMIN`; all later registrations become `USER` (`internal/usecase/auth.go`).
- `Delete` buttons on articles/feeds only appear when `me.role === 'ADMIN'` (`frontend/src/App.tsx`).
- Backend `deleteFeed`/`deleteArticle` resolvers require `ADMIN` (`internal/usecase/auth.go` and `internal/delivery/graphql/resolver.go`).
- For manual/exploratory testing, start the backend with `RATE_LIMIT_DISABLED=true` so repeated register/login does not trigger the auth rate limiter.
- In production, `internal/config/config.go` requires a non-default `JWT_SECRET` of at least 32 characters and `CORS_ORIGIN` must not be `"*"`. Local dev/test uses the default weak secret and wildcard CORS.

## Apollo cache on auth transitions

`App.tsx` uses `fetchPolicy: 'network-only'` for the `ME` query and awaits `client.clearStore()` on login and logout. This prevents the dashboard from briefly rendering a previous user's cached `me` data after logout and registering a new user.

## Pagination and fetch performance notes

`feeds`, `articles`, and `Feed.articles` accept optional `limit`/`offset` arguments. `fetchFeeds` polls enabled feeds concurrently and upserts articles without overwriting user flags. To verify these end-to-end:

- Start **two** local RSS servers on different ports (or use a single server with two distinct feed XML files).
- Add both feeds, click `Fetch feeds`, and confirm the result summary shows both feeds updated in one batch.
- Confirm the article list shows each article with the **correct feed name**.
- Apply the keyword filter and verify only matching articles are shown; clear it and verify the full list returns.
- Send raw GraphQL queries via `curl` to test `limit`/`offset` on `feeds`, `articles`, and `Feed.articles`:
  ```graphql
  query {
    feeds(limit: 1, offset: 0) { name }
    articles(filter: { keyword: "..." }, limit: 1, offset: 0) { title }
  }
  ```

## Account lockout, password complexity, and audit logging notes

The Go backend enforces password complexity, account lockout, and audit logging:

- Passwords must be 8-128 characters and contain at least one uppercase letter, one lowercase letter, and one number. Try registering with `password123` and confirm the UI shows the complexity error, then register with `Password123` and reach the dashboard.
- `AuthUseCase` tracks `failed_login_attempts`/`locked_until`. After `AUTH_MAX_FAILED_LOGINS` (default 5) failed logins, a valid login returns an `Account temporarily locked` message.
- To test lockout in a headed run: log out, enter the wrong password 5 times, then submit the correct password and expect the lockout message.
- Audit events (`REGISTER`, `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `ACCOUNT_LOCKED`) are written transparently to `AuditLog`; there is no UI yet, so verify that registration/login/dashboard flows do not crash.

## Screenshot golden-path test

PR #17 added a reusable Playwright POM and a screenshot spec (`frontend/e2e/03-screenshots.spec.ts`) that captures the key UI states of the admin flow:

- `frontend/e2e/pom/DashboardPage.ts` — reusable page object for login, feed/article actions, and screenshots.
- `frontend/e2e/helpers/auth.ts` — `ensureAdminUser()` obtains a fixed admin token by registering or logging in.
- `frontend/e2e/helpers/rssServer.ts` — `startLocalRssServer()` spawns a tiny RSS fixture for deterministic article fetching.
- `frontend/e2e/03-screenshots.spec.ts` — runs the golden path and saves `01-login.png` through `08-logout.png` under `frontend/test-results/`.

To run locally:

```bash
cd /home/ubuntu/repos/qr/frontend
npx playwright test e2e/03-screenshots.spec.ts
ls test-results/*/*.png
```

In GitHub Actions, the `e2e` job uploads `frontend/test-results/` as the `e2e-screenshots` artifact.

## Manual regression checklist

1. `cd backend && go build ./...` and `cd frontend && npm run build`.
2. Start backend (`RATE_LIMIT_DISABLED=true go run ./cmd/server`) and local RSS fixture(s).
3. Open `http://localhost:4000/` and register the first admin.
4. Add one or more feeds, click `Fetch feeds`, mark read/star, and observe stats update.
5. Logout, register a non-admin user, confirm no `Delete` button, and that `deleteArticle` GraphQL mutation returns `FORBIDDEN`.
6. Run `npx playwright test` and confirm all chromium + mobile chrome tests pass.
7. If testing performance changes, verify multi-feed fetch and GraphQL pagination as described above.
8. If testing security-lockout changes, additionally verify password-complexity rejection and the account lockout flow as described above.

## DI / Clean Architecture notes

The Go backend in `cmd/server/main.go` uses explicit constructor-based dependency injection:

1. `config.Load()` loads env.
2. `repository.NewDB()` opens the GORM/SQLite (or PostgreSQL) connection.
3. `repository.NewRssRepository()`, `NewUserRepository()`, `NewAuditRepository()` construct adapter structs.
4. `security.NewBcryptHasher()` and `NewJWTIssuer()` create domain services.
5. `usecase.NewRssUseCase()` and `usecase.NewAuthUseCase()` receive repository interfaces (`usecase.RssRepository`, etc.) so adapters depend inward.
6. `httpdelivery.NewServer()` receives use cases and starts the HTTP/GraphQL server.

The dependency graph is visible in `cmd/server/main.go` and follows `domain -> usecase -> repository / delivery`.

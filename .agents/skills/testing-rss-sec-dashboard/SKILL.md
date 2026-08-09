---
name: RSS Security Dashboard E2E Testing
description: How to set up and run the GraphQL/React RSS Security Dashboard for local end-to-end and Playwright testing, including security-hardening and Apollo-cache caveats.
---

# RSS Security Dashboard E2E Testing

## Devin Secrets Needed

None. The app uses an auto-generated JWT secret from `backend/src/config/config.ts` (`JWT_SECRET` defaults to `dev-secret-do-not-use-in-production`) and SQLite in development.

## Preconditions

- Node.js 20+ and npm are installed.
- The repo is checked out and on the correct branch (e.g. `devin/comprehensive-tests`).
- Ports 4000 (backend) and 8765 (local RSS fixture) are free.

## Quick setup

```bash
# Build backend (Prisma client + tsc)
cd /home/ubuntu/repos/qr/backend
cp .env.example .env
npm install
npm run build
DATABASE_URL="file:./dev.db" npx prisma migrate deploy

# Build frontend (tsc + vite build)
cd /home/ubuntu/repos/qr/frontend
npm install
npm run build

# Install Playwright browsers if they are missing
npx playwright install --with-deps

# Start backend serving the bundled frontend
cd /home/ubuntu/repos/qr/backend
DATABASE_URL="file:./dev.db" npm start
```

The UI is then reachable at `http://localhost:4000/` and GraphQL at `http://localhost:4000/graphql`.

## Database path note

`DATABASE_URL="file:./dev.db"` is resolved by Prisma relative to `backend/prisma/schema.prisma`, so the SQLite file is created at `backend/prisma/dev.db`. `frontend/playwright.config.ts` resets the DB by removing `backend/prisma/dev.db` before `prisma migrate deploy`.

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

- First registered user becomes `ADMIN`; all later registrations become `USER` (`backend/src/features/auth/service.ts`).
- `Delete` buttons on articles/feeds only appear when `me.role === 'ADMIN'` (`frontend/src/App.tsx`).
- Backend `deleteFeed`/`deleteArticle` resolvers require `ADMIN` (`backend/src/features/rss/resolvers.ts` + `backend/src/features/auth/guards.ts`).
- For manual/exploratory testing, start the backend with `RATE_LIMIT_DISABLED=true` or `NODE_ENV=test` so repeated register/login does not trigger `express-rate-limit`.
- In `production`, `config.ts` now requires a non-default `JWT_SECRET` of at least 32 characters and `CORS_ORIGIN` must not be `"*"`. Local dev/test uses the default weak secret and wildcard CORS.

## Apollo cache on auth transitions

`App.tsx` uses `fetchPolicy: 'network-only'` for the `ME` query and awaits `client.clearStore()` on login and logout. This prevents the dashboard from briefly rendering a previous user's cached `me` data after logout and registering a new user.

## Performance / N+1 regression notes

PR #10 and later performance work adds `dataloader`, optional `limit`/`offset` pagination on `feeds`/`articles`/`Feed.articles`, and parallel `fetchFeeds`. To verify these end-to-end:

- Start **two** local RSS servers on different ports (or use a single server with two distinct feed XML files).
- Add both feeds, click `Fetch feeds`, and confirm the result summary shows both feeds updated in one batch.
- Confirm the article list shows each article with the **correct feed name** (this exercises the `Article.feed` DataLoader).
- Apply the keyword filter and verify only matching articles are shown; clear it and verify the full list returns.
- Send raw GraphQL queries via `request` or `curl` to test `limit`/`offset` on `feeds`, `articles`, and `Feed.articles`:
  ```graphql
  query {
    feeds(limit: 1, offset: 0) { name }
    articles(filter: { keyword: "..." }, limit: 1, offset: 0) { title }
  }
  ```

## Account lockout, password complexity, and audit logging notes

PR #12 adds password complexity, account lockout, and audit logging. To verify these end-to-end:

- Passwords must be 8-128 characters and contain at least one uppercase letter, one lowercase letter, and one number. Try registering with `password123` and confirm the UI shows the complexity error, then register with `Password123` and reach the dashboard.
- `AuthService` tracks `failedLoginAttempts`/`lockedUntil`. After `AUTH_MAX_FAILED_LOGINS` (default 5) failed logins, a valid login returns `Account temporarily locked due to too many failed login attempts`.
- To test lockout in a headed run: log out, enter the wrong password 5 times, then submit the correct password and expect the lockout message.
- Audit events (`REGISTER`, `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `ACCOUNT_LOCKED`) are written transparently to `AuditLog`; there is no UI yet, so verify that registration/login/dashboard flows do not crash.

## Recommended verification order

1. `npm run build` in both `backend/` and `frontend/`.
2. `npx prisma migrate deploy` in `backend/` with a fresh `dev.db`.
3. Start backend (`npm start`) and local RSS fixture(s).
4. Open `http://localhost:4000/` and register the first admin.
5. Add one or more feeds, fetch, mark read/star, observe stats update.
6. Logout, register a non-admin user, confirm no `Delete` button, and that `deleteArticle` GraphQL mutation returns `FORBIDDEN`.
7. Run `npx playwright test` and confirm all chromium + mobile chrome tests pass.
8. If testing performance changes, verify multi-feed fetch and GraphQL pagination as described above.
9. If testing security-lockout changes, additionally verify password-complexity rejection and the account lockout flow as described above.

# BMarket v2.7 — Release Hardening

This upgrade targets release confidence rather than adding marketplace scope.

## Included

- Playwright E2E baseline for Expo Web.
- Public login/register smoke coverage.
- Optional authenticated student/admin smoke coverage.
- API health smoke with `X-Request-ID` verification.
- GitHub Actions quality gates for backend, frontend, and Playwright.
- Scheduled production smoke every 6 hours plus manual dispatch.
- Idempotent demo dataset with users, listing modes, transactions, review, dispute, reports, wishlist, notifications, wallet ledger, and chat.
- Version bump to 2.7.0.

## First install after applying

```powershell
cd frontend
npm install
npx playwright install chromium
cd ..\backend
npm install
npm run db:generate
```

Commit the refreshed `frontend/package-lock.json` and `backend/package-lock.json` after `npm install`. Once the frontend lockfile contains Playwright, `.github/workflows/ci.yml` can change the frontend install commands from `npm install` to `npm ci`.

## Run locally

Backend quality gate:

```powershell
cd backend
npm run db:generate
npm run typecheck
npm test
npm run build
```

Frontend quality gate:

```powershell
cd frontend
npm run typecheck
npm run lint
npm run test:e2e:smoke
```

## Demo database

Use a development/demo database only:

```powershell
cd backend
npm run db:seed:demo
```

Credentials:

- Admin: `demo.admin@binus.ac.id` / `demo12345`
- Student: `demo.buyer@binus.ac.id` / `demo12345`
- Seller: `demo.seller@binus.ac.id` / `demo12345`

Do not run the demo seed against the production database.

## Full authenticated E2E

Copy `frontend/.env.e2e.example` values into your shell environment, then run:

```powershell
cd frontend
$env:E2E_STUDENT_EMAIL='demo.buyer@binus.ac.id'
$env:E2E_STUDENT_PASSWORD='demo12345'
$env:E2E_ADMIN_EMAIL='demo.admin@binus.ac.id'
$env:E2E_ADMIN_PASSWORD='demo12345'
npm run test:e2e
```

## QA release checklist

- Backend typecheck passes.
- Backend Vitest suite passes.
- Backend production build passes.
- Frontend TypeScript passes.
- Frontend lint passes.
- Playwright public smoke passes in Chromium.
- Authenticated student smoke passes against a demo environment.
- Authenticated admin smoke passes against a demo environment.
- `/api/health` returns `{ success: true, data.status: "ok" }`.
- API responses expose `X-Request-ID`.
- Checkout reservation expiry is manually sanity-checked once.
- Payment/escrow/handover happy path is manually sanity-checked once.
- Dispute open → admin review → resolution is manually sanity-checked once.
- Pre-order OPEN → CLOSED → PROCESSING → READY path is manually sanity-checked once.
- Mobile width and desktop width are sanity-checked before tagging a release.

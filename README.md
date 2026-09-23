# BMarket

A campus marketplace for the BINUS community.

BMarket lets BINUS students discover listings, sell products and services, run pre-orders, chat with other students, pay through Midtrans Sandbox, and complete campus Meetup transactions using an escrow-style handover flow.

- Live web app: https://binus-market.vercel.app
- API health: https://bmarket-api-production.up.railway.app/api/health
- Current app version: 2.7.0

## Overview

BMarket is designed for student-to-student commerce inside the BINUS ecosystem.

Instead of relying on class group chats or manually tracking orders, BMarket provides a structured marketplace with:

- BINUS email registration and OTP verification
- Product and service listings
- Search, filters, sorting, saved listings, and recently viewed listings
- One-off, stocked, pre-order, and service selling modes
- Real-time buyer–seller chat
- Midtrans Snap Sandbox payments
- Escrow-style transaction handling
- Campus Meetup for new physical transactions
- 6-digit handover-code verification
- Service deliverable uploads
- Reviews, reports, disputes, blocking, and notifications
- Wallet ledger and seller payout tracking
- Admin moderation tools

## Current Selling Modes

| Mode | Intended use | Behavior |
| --- | --- | --- |
| One-off | Preloved items, books, used electronics | Sold once, then becomes unavailable |
| Stocked | Food, merch, repeat-stock goods | Stock is reserved during checkout and reduced per paid order |
| Pre-order | Food PO, cohort merchandise, batch orders | Supports deadline, quota, min/max quantity, ready date, and pickup information |
| Service | Tutoring, design, printing, coding, and other services | No physical stock; seller can upload deliverables |

## Transaction Flow

### Physical products

New physical transactions use campus Meetup only.

```text
Checkout
  ↓
Midtrans payment
  ↓
Verified Midtrans notification
  ↓
Transaction becomes PAID
  ↓
Buyer and seller arrange Meetup
  ↓
Buyer generates a 6-digit handover code
  ↓
Seller verifies the code
  ↓
Transaction COMPLETED
  ↓
Escrow released to seller
```

The handover code is valid for 15 minutes.

BMarket does not trust the browser return from Midtrans as proof of payment. A transaction becomes `PAID` only after the backend verifies the Midtrans notification signature and confirms the payment status server-to-server.

### Services

Service transactions keep their own fulfillment flow.

After payment, the seller may upload deliverable files. The buyer can review and accept the deliverables, after which the transaction is completed and the escrow balance is released.

Supported deliverables include common documents, images, archives, and source-code files. Up to 5 files can be uploaded per request, with a maximum size of 20 MB per file.

## Marketplace Features

- Listing images
- Product and service categories
- Search
- Filtering and sorting
- Saved listings / wishlist
- Recently viewed listings
- Seller profiles
- Ratings and reviews
- Pre-order lifecycle
- Stock reservation
- Automatic expiry of unpaid reservations
- Transaction history
- Buyer and seller transaction views
- Notification center
- User blocking
- Listing and user reports
- Dispute evidence and resolution
- Admin listing moderation
- Platform commission configuration

## Meetup-Only Direction

Courier fulfillment is no longer used for new physical transactions.

New listings use:

```text
CAMPUS_MEETUP
```

Legacy courier-related schema fields and enum values are retained only for backward compatibility with historical records.

The application does not reintroduce:

- courier selection for new orders
- shipping fees for new Meetup orders
- delivery address collection for new physical orders
- courier tracking for new physical orders

## Authentication

Registration is restricted to configured BINUS email domains.

Current flow:

```text
Register
  ↓
BINUS email OTP
  ↓
Verify email
  ↓
Account activated
```

Password reset also uses an OTP-based flow.

Automatic PDDikti/NIM identity lookup is not part of the project.

## Payments

BMarket currently integrates Midtrans Snap Sandbox.

Relevant backend endpoints:

```text
POST /api/payments/transactions/:transactionId
GET  /api/payments/transactions/:transactionId
POST /api/payments/midtrans/notification
```

The old wallet payment endpoint:

```text
POST /api/transactions/:id/pay
```

is disabled and returns HTTP 410. Buyer checkout should use Midtrans instead.

The Midtrans Server Key must remain backend-only and must never be exposed through any `EXPO_PUBLIC_*` variable.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Expo 57, React Native 0.86, React 19, Expo Router |
| Client state | Zustand |
| Server state | TanStack Query |
| Backend | NestJS 12 |
| Realtime | Socket.IO |
| Authentication | JWT + Passport |
| ORM | Prisma |
| Database | PostgreSQL on Supabase |
| Storage | Supabase Storage |
| Email | Brevo Transactional Email |
| Payments | Midtrans Snap Sandbox |
| Frontend hosting | Vercel |
| Backend hosting | Railway |
| Backend tests | Vitest |
| E2E tests | Playwright |

## Architecture

```text
Expo / React Native / Expo Web
            │
            │ HTTPS + WebSocket
            ▼
        NestJS API
            │
     ┌──────┼──────────┬──────────┐
     ▼      ▼          ▼          ▼
PostgreSQL Storage   Brevo     Midtrans
Supabase   Supabase   Email      Sandbox
```

## Project Structure

```text
BMarket/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   ├── seed.ts
│   │   └── seed-demo.ts
│   └── src/
│       ├── auth/
│       ├── listings/
│       ├── transactions/
│       ├── payments/
│       ├── chat/
│       ├── reviews/
│       ├── disputes/
│       ├── safety/
│       ├── notifications/
│       ├── uploads/
│       ├── admin/
│       └── ...
│
└── frontend/
    ├── assets/
    │   ├── branding/
    │   └── fonts/
    └── src/
        ├── app/
        ├── components/
        ├── constants/
        ├── lib/
        ├── store/
        └── types/
```

## Requirements

Use a Node.js version compatible with the package engines:

```text
^22.22.3 || ^24.15.0 || >=26.0.0
```

The repository also includes a root `.nvmrc`.

Other requirements:

- npm
- PostgreSQL or Supabase
- Git

## Local Development

### 1. Clone

```bash
git clone https://github.com/Geraldicky/BMarket.git
cd BMarket
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Configure the required environment variables, then:

```bash
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

The development API runs at:

```text
http://localhost:3000/api
```

For a completely new local database, `db:deploy` applies the existing migrations. Do not run database deployment commands against production unless you intentionally want to apply pending migrations.

### 3. Frontend

Open a second terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm start
```

PowerShell:

```powershell
Copy-Item .env.example .env
npm start
```

For local web development:

```bash
npm run web
```

## Backend Environment

A minimal local configuration looks like this:

```env
PORT=3000
NODE_ENV=development

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bmarket?schema=public"

JWT_SECRET="replace-with-a-random-secret-at-least-32-characters"
JWT_EXPIRES_IN="7d"
OTP_HASH_SECRET="replace-with-a-different-random-secret"

SSO_ALLOWED_DOMAINS="@binus.ac.id,@student.binus.ac.id,@binus.edu"

OTP_TTL_MINUTES=10
OTP_RESEND_SECONDS=60
OTP_MAX_ATTEMPTS=5
OTP_DEV_LOG=true

CORS_ORIGIN="http://localhost:8081,http://localhost:19006"

UPLOAD_DIR="uploads"
PUBLIC_BASE_URL=""

SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""
SUPABASE_STORAGE_BUCKET="bmarket-public"

CHECKOUT_RESERVATION_MINUTES=15

MIDTRANS_SERVER_KEY=""
MIDTRANS_CLIENT_KEY=""
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_TIMEOUT_MS=15000
```

For production, configure Brevo:

```env
BREVO_API_KEY=""
BREVO_FROM_EMAIL=""
BREVO_FROM_NAME="BMarket"
```

The backend also supports SMTP configuration for local development or fallback use.

For Supabase production connections, the project is designed to work with a bounded connection pool, for example:

```text
?schema=public&connection_limit=5&pool_timeout=10
```

Adjust the connection limit to the actual Supabase project and Railway replica capacity.

## Frontend Environment

```env
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000/api
EXPO_PUBLIC_API_TIMEOUT_MS=15000
EXPO_PUBLIC_PAYMENT_POLL_INTERVAL_MS=5000
```

For production:

```env
EXPO_PUBLIC_API_URL=https://bmarket-api-production.up.railway.app/api
EXPO_PUBLIC_API_TIMEOUT_MS=15000
EXPO_PUBLIC_PAYMENT_POLL_INTERVAL_MS=5000
```

Only public frontend configuration belongs in `EXPO_PUBLIC_*`.

Never expose:

- `DATABASE_URL`
- `JWT_SECRET`
- `OTP_HASH_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BREVO_API_KEY`
- `MIDTRANS_SERVER_KEY`

## Midtrans Sandbox Configuration

Backend:

```env
MIDTRANS_SERVER_KEY=SB-Mid-server-...
MIDTRANS_CLIENT_KEY=SB-Mid-client-...
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_TIMEOUT_MS=15000
MIDTRANS_FINISH_URL=https://binus-market.vercel.app/transaction/{transactionId}
```

Configure this Sandbox Payment Notification URL in Midtrans:

```text
https://bmarket-api-production.up.railway.app/api/payments/midtrans/notification
```

Sandbox QR codes and other Sandbox payment methods are test payments and should not be treated as real-money transactions.

## Useful Commands

### Backend

```bash
cd backend

npm run dev
npm run build
npm run typecheck
npm test
npm run test:flows

npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:deploy
npm run db:studio
npm run db:seed
npm run db:seed:demo
```

### Frontend

```bash
cd frontend

npm start
npm run web
npm run android
npm run ios
npm run typecheck
npm run lint

npm run test:e2e
npm run test:e2e:smoke
npm run test:e2e:headed
npm run test:e2e:report
```

## Demo / Seed Accounts

The repository contains local seed and demo seed data for development.

Basic seed:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@binus.ac.id` | `password123` |
| Student | `alice@binus.ac.id` | `password123` |
| Student | `bob@binus.ac.id` | `password123` |

Demo seed:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `demo.admin@binus.ac.id` | `demo12345` |
| Seller | `demo.seller@binus.ac.id` | `demo12345` |
| Seller | `demo.seller2@binus.ac.id` | `demo12345` |
| Buyer | `demo.buyer@binus.ac.id` | `demo12345` |
| Buyer | `demo.buyer2@binus.ac.id` | `demo12345` |
| Student | `demo.reported@binus.ac.id` | `demo12345` |

These are development/demo credentials only. Do not use them as production credentials.

## Testing

The project currently uses:

- Vitest for backend tests
- Playwright for web E2E and smoke tests
- TypeScript type checking
- ESLint for frontend linting
- Expo export/config validation for the web app

Recommended pre-push checks:

```bash
cd backend
npm run db:generate
npm run typecheck
npm run build
npm test
```

```bash
cd frontend
npm run typecheck
npm run lint
npm run test:e2e:smoke
npx expo export -p web
```

## Deployment

| Service | Purpose |
| --- | --- |
| Vercel | Expo Web frontend |
| Railway | NestJS API and Socket.IO |
| Supabase | PostgreSQL and file storage |
| Brevo | OTP email delivery |
| Midtrans | Sandbox payment processing |

Production web:

https://binus-market.vercel.app

Production API health:

https://bmarket-api-production.up.railway.app/api/health

## Current Scope and Limitations

BMarket is currently an academic project.

Important scope notes:

- Midtrans is currently configured for Sandbox use.
- New physical transactions use campus Meetup only.
- Legacy courier schema fields remain for historical compatibility.
- Buyer payment through the old BMarket wallet endpoint is disabled.
- The wallet ledger remains for escrow, refund, payout, and audit accounting.
- Internal wallet top-up functionality still exists in the backend for development/legacy use, but it is not the buyer payment path for current Midtrans checkout.
- PDDikti student lookup is not implemented.
- Native Android and iOS are supported by the Expo project, while the currently deployed public client is the Vercel web build.

## Security Notes

- Payment state is authoritative only after verified backend processing.
- Midtrans notification authenticity is checked server-side.
- The backend performs server-to-server payment status confirmation.
- Secrets must never be committed.
- Production service-role keys and payment server keys must remain backend-only.
- OTP values are hashed using a dedicated OTP secret.
- JWT and OTP secrets should be different random values.

## License

See the repository license for usage terms.

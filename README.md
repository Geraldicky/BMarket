<div align="center">

# BMarket

### A campus marketplace built for the BINUS community

Buy, sell, pre-order, and coordinate transactions with other Binusians through one marketplace.

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Expo](https://img.shields.io/badge/Expo-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Railway](https://img.shields.io/badge/Railway-0B0D0E?logo=railway&logoColor=white)](https://railway.com/)
[![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/)

[Live App](https://b-market-hazel.vercel.app) · [API Health](https://bmarket-api-production.up.railway.app/api/health)

</div>

---

## About

BMarket is a marketplace designed specifically for the BINUS community. It provides a structured alternative to selling through class or cohort group chats by combining product discovery, campus identity, real-time communication, transaction tracking, escrow-style payments, pre-orders, and moderation in one system.

The platform supports both casual sellers listing personal items and student businesses that need reusable stock or campus pre-order workflows.

## Key Features

### Marketplace

- BINUS-only account registration with email verification.
- Product and service listings with image uploads.
- Search, category filters, sorting, pagination, wishlist, and recently viewed items.
- Public seller profiles with ratings and reviews.
- Campus meetup and simulated instant-courier fulfillment.
- Real-time buyer-seller chat using Socket.IO.

### Flexible Listing Models

BMarket supports multiple selling patterns instead of forcing every seller into the same inventory model.

| Mode | Use case | Behavior |
| --- | --- | --- |
| **One-off** | Preloved items, used electronics, books | Sold once, then marked as sold |
| **Stocked** | Food, merchandise, repeatable products | Stock decreases per order and can be restocked |
| **Pre-order** | Campus food PO, cohort merch, limited batches | Orders are collected until a deadline or quota |
| **Service** | Design, tutoring, printing, and other services | Remains available without physical stock |

Sellers can archive finished or inactive listings without removing historical transaction data.

### Campus Pre-order

Pre-order listings are designed for the common campus workflow where sellers collect orders through group chats.

A pre-order can include:

- closing date and time;
- estimated ready date;
- quota;
- optional minimum order;
- maximum quantity per buyer;
- pickup location;
- pickup notes;
- seller order summary;
- lifecycle status from open to ready and completed.

Buyers receive a structured order record instead of relying on repeated promotional messages and manual chat lists.

### Transaction & Escrow

BMarket uses a virtual balance and escrow model for development and demonstration.

```text
Checkout
   ↓
Payment
   ↓
Funds held in escrow
   ↓
Buyer & seller coordinate fulfillment
   ↓
Buyer receives the item
   ↓
6-digit handover code
   ↓
Seller verifies the code
   ↓
Transaction completed
   ↓
Funds released to seller
```

Checkout reservations expire automatically and reserved stock is returned when an unpaid transaction times out.

### Trust & Safety

- Report listings and users.
- Transaction disputes with evidence.
- Escrow hold while a dispute is active.
- User blocking.
- Listing moderation.
- Seller reviews and ratings.
- Notification center.
- Auditable wallet ledger.

### Admin Console

The admin dashboard provides both reactive and proactive moderation.

Admins can:

- monitor marketplace health;
- inspect **all listings**, even when no report exists;
- search and filter listings by status and selling model;
- hide, restore, approve, or remove listings;
- review community reports;
- resolve transaction disputes;
- manage user access;
- inspect report history;
- configure the platform commission.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Expo, React Native, Expo Router, TypeScript |
| State & Data | TanStack React Query, Zustand, Axios |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL on Supabase |
| ORM | Prisma |
| Realtime | Socket.IO |
| Authentication | JWT, Passport, bcrypt |
| File Storage | Supabase Storage |
| Email | Brevo Transactional Email API |
| Testing | Vitest |
| Backend Hosting | Railway |
| Frontend Hosting | Vercel |

---

## Architecture

```text
                         ┌──────────────────────┐
                         │      Vercel          │
                         │   Expo Web Client    │
                         └──────────┬───────────┘
                                    │ HTTPS / WebSocket
                                    ▼
                         ┌──────────────────────┐
                         │      Railway         │
                         │    NestJS Backend    │
                         └──────┬─────┬─────┬───┘
                                │     │     │
                    ┌───────────┘     │     └───────────┐
                    ▼                 ▼                 ▼
          ┌─────────────────┐ ┌──────────────┐ ┌────────────────┐
          │ Supabase        │ │ Supabase     │ │ Brevo          │
          │ PostgreSQL      │ │ Storage      │ │ Email API      │
          └─────────────────┘ └──────────────┘ └────────────────┘
```

---

## Repository Structure

```text
BMarket/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   │   ├── activity/
│   │   ├── admin/
│   │   ├── auth/
│   │   ├── chat/
│   │   ├── complaints/
│   │   ├── config/
│   │   ├── disputes/
│   │   ├── listings/
│   │   ├── notifications/
│   │   ├── reviews/
│   │   ├── safety/
│   │   ├── transactions/
│   │   ├── uploads/
│   │   └── users/
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── constants/
│   │   ├── lib/
│   │   ├── store/
│   │   └── types/
│   ├── assets/
│   ├── package.json
│   └── vercel.json
│
├── render.yaml
└── README.md
```

---

## Getting Started

### Prerequisites

Install the following before running BMarket locally:

- Node.js
- npm
- PostgreSQL or a Supabase PostgreSQL project
- Git

### Clone the Repository

```bash
git clone https://github.com/Geraldicky/BMarket.git
cd BMarket
```

### Backend

```bash
cd backend
npm install
```

Create the local environment file:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Minimum development configuration:

```env
NODE_ENV=development
PORT=3000

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bmarket?schema=public"

JWT_SECRET="replace-with-a-random-secret-at-least-32-characters"
JWT_EXPIRES_IN="7d"
OTP_HASH_SECRET="replace-with-a-different-random-secret"

CORS_ORIGIN="http://localhost:8081"

OTP_DEV_LOG=true
CHECKOUT_RESERVATION_MINUTES=15
```

Generate the Prisma Client and apply migrations:

```bash
npm run db:generate
npm run db:deploy
```

Optional development seed:

```bash
npm run db:seed
```

Start the API:

```bash
npm run dev
```

The local API is available at:

```text
http://localhost:3000/api
```

### Frontend

Open another terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

Start Expo:

```bash
npm start
```

Or run a specific target:

```bash
npm run web
npm run android
npm run ios
```

To clear the Expo cache:

```bash
npm start -- --clear
```

---

## Environment Configuration

### Backend Production

The production backend requires these environment variables:

```env
NODE_ENV=production

DATABASE_URL=

JWT_SECRET=
JWT_EXPIRES_IN=7d
OTP_HASH_SECRET=

CORS_ORIGIN=

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=bmarket-public

BREVO_API_KEY=
BREVO_FROM_EMAIL=
BREVO_FROM_NAME=BMarket

OTP_DEV_LOG=false
CHECKOUT_RESERVATION_MINUTES=15
```

`SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY`, `DATABASE_URL`, `JWT_SECRET`, and `OTP_HASH_SECRET` are server-side secrets and must never be exposed in the frontend or committed to Git.

### Frontend Production

```env
EXPO_PUBLIC_API_URL=https://bmarket-api-production.up.railway.app/api
```

Only variables prefixed with `EXPO_PUBLIC_` should be exposed to the Expo client.

---

## Database

BMarket uses Prisma with PostgreSQL.

Useful commands:

```bash
npm run db:validate
npm run db:generate
npm run db:deploy
npm run db:studio
npm run db:seed
```

The repository uses a clean baseline migration so a new database can be initialized from the current Prisma schema.

For hosted environments, BMarket currently uses Supabase PostgreSQL through the Supavisor session pooler.

---

## Email Verification

Student registration requires a BINUS email address.

Allowed domains are controlled by:

```env
SSO_ALLOWED_DOMAINS="@binus.ac.id,@student.binus.ac.id,@binus.edu"
```

In development, OTP codes can be printed to the backend terminal:

```env
OTP_DEV_LOG=true
```

Production email is delivered through the Brevo Transactional Email API.

---

## Image Storage

Local development can use the backend upload directory.

Production uploads are stored in Supabase Storage using the bucket configured by:

```env
SUPABASE_STORAGE_BUCKET=bmarket-public
```

Only the generated public object URL is persisted by the application.

---

## Testing

### Backend

```bash
cd backend

npm run typecheck
npm test
npm run test:flows
npm run build
```

The test suite covers core areas including:

- authentication;
- listing and inventory behavior;
- checkout and stock reservations;
- transaction policy;
- handover codes;
- reviews;
- disputes;
- notifications;
- chat;
- safety and blocking;
- wallet integrity.

### Frontend

```bash
cd frontend

npm run typecheck
npm run lint
```

---

## Deployment

The current public deployment uses free-tier services:

| Service | Purpose |
| --- | --- |
| Vercel | Expo Web frontend |
| Railway | NestJS API and Socket.IO |
| Supabase | PostgreSQL database and image storage |
| Brevo | Transactional OTP email |

Production endpoints:

- Web: [https://b-market-hazel.vercel.app](https://b-market-hazel.vercel.app)
- API: [https://bmarket-api-production.up.railway.app](https://bmarket-api-production.up.railway.app)
- Health: [https://bmarket-api-production.up.railway.app/api/health](https://bmarket-api-production.up.railway.app/api/health)

---

## Project Scope

BMarket is currently an academic and product-development project.

The following features are simulated and are **not connected to real financial or logistics providers**:

- BMarket balance top-up;
- payment settlement;
- escrow;
- platform commission;
- instant courier;
- shipping fee and tracking.

BMarket is not currently integrated with production payment gateways such as Midtrans/Xendit or courier APIs such as GoSend/GrabExpress.

---

## Purpose

BMarket was created to make campus commerce more structured and easier to trust.

Instead of relying on scattered group-chat promotions and manual coordination, students can discover listings, manage inventory, join pre-orders, communicate with sellers, complete transactions, and resolve issues through a single platform.


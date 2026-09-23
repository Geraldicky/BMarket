<div align="center">

# 🛒 BMarket

**A campus marketplace for the BINUS community**

Buy, sell, pre-order, and chat with other Binusians — all in one place.

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Expo](https://img.shields.io/badge/Expo-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)

**[🌐 Live App](https://binus-market.vercel.app)** · **[💚 API Health](https://bmarket-api-production.up.railway.app/api/health)**

</div>

---

## 📑 Table of Contents

1. [What is BMarket?](#-what-is-bmarket)
2. [Features](#-features)
3. [Tech Stack](#-tech-stack)
4. [Quick Start](#-quick-start)
5. [Dummy Accounts](#-dummy-accounts)
6. [Environment Variables](#-environment-variables)
7. [Useful Commands](#-useful-commands)
8. [Project Structure](#-project-structure)
9. [Deployment](#-deployment)
10. [Project Scope](#%EF%B8%8F-project-scope)

---

## 💡 What is BMarket?

Selling in class group chats is messy: promos get buried, orders are tracked by hand, and it's hard to know who to trust.

BMarket replaces that with a single platform where students can **list products**, **run pre-orders**, **chat with buyers**, and **complete transactions safely** using an escrow-style flow.

It works for both casual sellers (preloved items) and student businesses (food, merch, services).

---

## ✨ Features

### 🛍️ Marketplace
- BINUS-only sign-up with email verification
- Listings with images, search, filters, sorting, and wishlist
- Seller profiles with ratings and reviews
- Real-time buyer ↔ seller chat
- Campus meetup or (simulated) instant courier

### 📦 Four Ways to Sell

| Mode | Best for | How it works |
| --- | --- | --- |
| **One-off** | Preloved items, books | Sold once, then marked sold |
| **Stocked** | Food, merch | Stock goes down per order, can be restocked |
| **Pre-order** | Campus food PO, cohort merch | Collects orders until a deadline or quota |
| **Service** | Tutoring, design, printing | Always available, no stock |

### 🗓️ Campus Pre-order
Sellers can set a **closing date**, **quota**, **minimum order**, **max per buyer**, **ready date**, and **pickup location**. Buyers get a clear order record instead of scrolling through chat.

### 💰 Safe Transactions (Escrow)

```text
Checkout → Pay → Funds held → Meet / deliver → Buyer shows 6-digit code
        → Seller verifies code → Done → Funds released to seller
```

Unpaid checkouts expire automatically and reserved stock is returned.

### 🛡️ Trust & Safety
Reports · Disputes with evidence · User blocking · Listing moderation · Reviews · Notifications · Wallet ledger

### 🧑‍💼 Admin Console
Monitor the marketplace, moderate all listings, handle reports and disputes, manage users, and set the platform commission.

---

## 🧰 Tech Stack

| Part | Tools |
| --- | --- |
| **Frontend** | Expo, React Native, Expo Router, TanStack Query, Zustand |
| **Backend** | NestJS, Socket.IO, JWT + Passport |
| **Database** | PostgreSQL (Supabase) + Prisma |
| **Storage & Email** | Supabase Storage, Brevo |
| **Testing** | Vitest, Playwright |
| **Hosting** | Vercel (web), Railway (API) |

```text
 Expo Web (Vercel) ──HTTPS/WebSocket──▶ NestJS API (Railway)
                                            │
                     ┌──────────────────────┼──────────────────────┐
                     ▼                      ▼                      ▼
             Supabase PostgreSQL     Supabase Storage          Brevo Email
```

---

## 🚀 Quick Start

### Requirements
- **Node.js 24** (see `.nvmrc`) and npm
- **PostgreSQL** (local or Supabase)
- Git

### 1. Clone

```bash
git clone https://github.com/Geraldicky/BMarket.git
cd BMarket
```

### 2. Run the backend

```bash
cd backend
npm install
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
```

Fill in `DATABASE_URL`, `JWT_SECRET`, and `OTP_HASH_SECRET` in `.env` (see [below](#backend-development) and [how to generate secrets](#-generating-random-secrets)), then:

```bash
npm run db:generate   # generate Prisma client
npm run db:deploy     # create database tables
npm run db:seed       # (optional) add sample data
npm run dev           # start API → http://localhost:3000/api
```

### 3. Run the frontend

In a **new terminal**:

```bash
cd frontend
npm install
echo "EXPO_PUBLIC_API_URL=http://localhost:3000/api" > .env
npm start             # or: npm run web / android / ios
```

> 💡 Something looks stuck? Clear the cache with `npm start -- --clear`.

> 💡 In development, email OTP codes are printed in the **backend terminal** (`OTP_DEV_LOG=true`), so you don't need a real email service.

---

## 👤 Dummy Accounts

All accounts below are already verified, so you can log in right away.

### Basic seed — `npm run db:seed`

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@binus.ac.id` | `password123` |
| Student | `alice@binus.ac.id` | `password123` |
| Student | `bob@binus.ac.id` | `password123` |

### Demo seed — `npm run db:seed:demo`

| Role | Name | Email | Password |
| --- | --- | --- | --- |
| Admin | Demo Admin | `demo.admin@binus.ac.id` | `demo12345` |
| Seller | Nadia Seller | `demo.seller@binus.ac.id` | `demo12345` |
| Seller | Raka Merchant | `demo.seller2@binus.ac.id` | `demo12345` |
| Buyer | Kevin Buyer | `demo.buyer@binus.ac.id` | `demo12345` |
| Buyer | Salsa Buyer | `demo.buyer2@binus.ac.id` | `demo12345` |
| Student | Demo Reported User | `demo.reported@binus.ac.id` | `demo12345` |

> ⚠️ These accounts are for **development and demos only**. Change or delete them before a public deployment.

---

## 🔐 Environment Variables

### Backend (development)

```env
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bmarket?schema=public"

JWT_SECRET="random-secret-at-least-32-characters"
JWT_EXPIRES_IN="7d"
OTP_HASH_SECRET="another-random-secret"

CORS_ORIGIN="http://localhost:8081"
OTP_DEV_LOG=true
CHECKOUT_RESERVATION_MINUTES=15

# Allowed email domains for sign-up
SSO_ALLOWED_DOMAINS="@binus.ac.id,@student.binus.ac.id,@binus.edu"
```

#### 🔑 Generating random secrets

`JWT_SECRET` and `OTP_HASH_SECRET` must be long random strings, and **each one should be different**. Run the command below **twice** and paste one result into each variable:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

This works on any OS where Node.js is installed. Alternatives:

```bash
# macOS / Linux / Git Bash
openssl rand -hex 48
```

```powershell
# PowerShell
$b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ($b | ForEach-Object { $_.ToString('x2') }) -join ''
```

Each command prints a 96-character string, well above the 32-character minimum. Use new secrets for production — don't reuse your development ones.

<details>
<summary><b>Backend (production) — click to expand</b></summary>

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

In production, images go to Supabase Storage and OTP emails are sent via Brevo. Locally, uploads are saved in the backend upload folder.

</details>

### Frontend

```env
# development
EXPO_PUBLIC_API_URL=http://localhost:3000/api

# production
EXPO_PUBLIC_API_URL=https://bmarket-api-production.up.railway.app/api
```

> ⚠️ **Never commit secrets.** `DATABASE_URL`, `JWT_SECRET`, `OTP_HASH_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and `BREVO_API_KEY` are backend-only. Only `EXPO_PUBLIC_*` variables may be used in the frontend.

---

## 🧪 Useful Commands

### Backend (`cd backend`)

| Command | What it does |
| --- | --- |
| `npm run dev` | Start API with auto-reload |
| `npm run build` | Build for production |
| `npm run typecheck` | Check TypeScript types |
| `npm test` | Run all tests |
| `npm run test:flows` | Run core flow tests (transactions, chat, disputes, …) |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Create a new migration (dev) |
| `npm run db:deploy` | Apply migrations |
| `npm run db:studio` | Open database GUI |
| `npm run db:seed` | Add sample data |
| `npm run db:seed:demo` | Add full demo data (listings, transactions, disputes, chat) |

### Frontend (`cd frontend`)

| Command | What it does |
| --- | --- |
| `npm start` | Start Expo |
| `npm run web` / `android` / `ios` | Run on a specific platform |
| `npm run typecheck` | Check TypeScript types |
| `npm run lint` | Run ESLint |
| `npm run test:e2e` | Run Playwright end-to-end tests |

---

## 📁 Project Structure

```text
BMarket/
├── backend/                 NestJS API
│   ├── prisma/              Database schema, migrations, seed
│   └── src/
│       ├── auth/            Login, sign-up, OTP
│       ├── listings/        Products & services
│       ├── transactions/    Checkout, escrow, handover code
│       ├── chat/            Real-time messaging
│       ├── reviews/         Ratings & reviews
│       ├── disputes/        Transaction disputes
│       ├── safety/          Reports & blocking
│       ├── notifications/   Notification center
│       ├── admin/           Admin console API
│       └── ...              activity, complaints, config, uploads, users
│
└── frontend/                Expo app (web, Android, iOS)
    └── src/
        ├── app/             Screens (Expo Router)
        ├── components/      Reusable UI
        ├── lib/             API client & helpers
        ├── store/           Zustand state
        └── types/           Shared types
```

---

## ☁️ Deployment

| Service | Used for | Link |
| --- | --- | --- |
| **Vercel** | Web frontend | [binus-market.vercel.app](https://binus-market.vercel.app) |
| **Railway** | API + Socket.IO | [bmarket-api-production.up.railway.app](https://bmarket-api-production.up.railway.app/api/health) |
| **Supabase** | Database + image storage | — |
| **Brevo** | OTP emails | — |

---

## Midtrans Sandbox Setup

BMarket buyer checkout uses Midtrans Snap Sandbox. A browser return is only navigation: a transaction becomes `PAID` exclusively after the backend verifies a signed Midtrans notification and confirms its status through Midtrans's server API.

1. Create or sign in to a Midtrans account and switch the dashboard to **Sandbox**.
2. Open **Settings → Access Keys** and copy the Sandbox Client Key and Sandbox Server Key.
3. Configure the Railway/backend environment (never add real values to Git):

   ```env
   MIDTRANS_SERVER_KEY=SB-Mid-server-...
   MIDTRANS_CLIENT_KEY=SB-Mid-client-...
   MIDTRANS_IS_PRODUCTION=false
   MIDTRANS_TIMEOUT_MS=15000
   MIDTRANS_FINISH_URL=https://binus-market.vercel.app/transaction/{transactionId}
   ```

4. Set the Midtrans Sandbox Payment Notification URL to:

   ```text
   https://bmarket-api-production.up.railway.app/api/payments/midtrans/notification
   ```

5. Deploy the Prisma migration with `npm run db:deploy`, then create a checkout and use a [Midtrans Sandbox test payment](https://docs.midtrans.com/docs/testing-payment-on-sandbox) from the Snap page. Returning to BMarket may briefly show **Menunggu konfirmasi pembayaran** until the verified webhook arrives.

Sandbox is selected with `MIDTRANS_IS_PRODUCTION=false`; the backend derives the matching Snap and transaction-status endpoints from that flag. Switching to live payments requires an explicit production review, live keys, and `MIDTRANS_IS_PRODUCTION=true`. The Server Key belongs only in the backend environment; never expose it through `EXPO_PUBLIC_*` variables or frontend responses.

---

## ⚠️ Project Scope

BMarket is an **academic project**. Buyer payments use the Midtrans Sandbox (no real funds). These features remain simulated:

- Legacy wallet top-up UI, internal escrow accounting, and commission

There is no courier integration. New physical transactions use campus Meetup only; legacy transaction fields remain solely so old records stay readable.

# BMarket

Marketplace barang dan jasa khusus komunitas BINUS.

BMarket dirancang sebagai platform jual-beli antar Binusian dengan identitas kampus, komunikasi langsung antara buyer dan seller, sistem transaksi tercatat, escrow virtual, serta mekanisme serah-terima yang membantu transaksi menjadi lebih aman dan terstruktur.

---

## Tentang BMarket

BMarket memungkinkan mahasiswa BINUS untuk:

- menjual barang preloved;
- menawarkan jasa;
- mencari kebutuhan kuliah;
- berkomunikasi langsung dengan seller;
- melakukan transaksi melalui saldo virtual dan escrow;
- melakukan meetup dengan kode serah-terima;
- memberikan rating dan review setelah transaksi selesai;
- menyimpan listing favorit;
- melaporkan listing atau pengguna yang bermasalah;
- membuka dispute jika terjadi kendala transaksi.

BMarket menggunakan sistem post-moderation. Listing dapat langsung tampil di marketplace, tetapi pengguna dapat melaporkan konten yang mencurigakan untuk ditinjau oleh admin.

---

## Fitur Utama

### Authentication & Account

- Registrasi menggunakan email BINUS.
- Verifikasi email menggunakan OTP 6 digit.
- OTP memiliki batas waktu, resend cooldown, dan batas percobaan.
- Login menggunakan JWT.
- Forgot password dan reset password menggunakan OTP.
- Session invalidation menggunakan `tokenVersion`.
- Student dan Admin role.
- Profile mahasiswa dengan nama, NIM, bio, avatar, saldo, dan statistik transaksi.

### Marketplace

- Listing barang dan jasa.
- Kategori:
  - Elektronik
  - Buku
  - Fashion
  - Makanan
  - Jasa
  - Olahraga
  - Lainnya
- Upload 1–4 foto listing.
- Cover image dan pengaturan urutan foto.
- Kondisi barang dan manajemen stok.
- Search listing.
- Filter berdasarkan kategori, tipe, kondisi, dan metode penyerahan.
- Sorting berdasarkan harga dan listing terbaru.
- Pagination / load more.
- Public seller profile.
- Wishlist / produk favorit.
- Recently viewed listing.

### Seller Storefront

Seller memiliki halaman khusus untuk mengelola seluruh listing.

Informasi yang tersedia antara lain:

- total listing;
- listing aktif;
- listing terjual;
- listing yang dimoderasi;
- transaksi selesai;
- pendapatan seller;
- search listing;
- filter berdasarkan status;
- edit dan nonaktifkan listing.

### Transaction & Escrow

BMarket menggunakan saldo virtual untuk mensimulasikan transaksi marketplace.

Saat buyer melakukan checkout:

1. Stok direservasi sementara.
2. Buyer melakukan pembayaran menggunakan saldo BMarket.
3. Dana dipindahkan ke escrow.
4. Seller belum menerima dana selama transaksi belum selesai.
5. Dana baru dilepas ke seller setelah proses serah-terima selesai.

Reservasi checkout memiliki batas waktu. Jika buyer tidak melakukan pembayaran sampai batas waktu berakhir, transaksi dibatalkan dan stok dikembalikan.

Transaction juga menyimpan snapshot informasi listing sehingga riwayat transaksi tidak berubah walaupun listing diedit setelah pembelian.

---

## Meetup Flow

Untuk transaksi meetup, lokasi dan waktu tidak disimpan sebagai form terpisah.

Buyer dan seller melakukan koordinasi melalui chat.

Alurnya:

```text
Seller membuat listing
        ↓
Buyer memilih listing
        ↓
Checkout
        ↓
Pembayaran
        ↓
Dana masuk escrow
        ↓
Buyer dan seller berdiskusi melalui chat
        ↓
Menentukan waktu dan lokasi meetup
        ↓
Buyer bertemu seller
        ↓
Buyer menerima dan memeriksa barang
        ↓
Buyer membuat kode serah-terima 6 digit
        ↓
Buyer memberikan kode kepada seller
        ↓
Seller memasukkan kode
        ↓
Kode diverifikasi
        ↓
Transaction COMPLETED
        ↓
Escrow dilepas
        ↓
Saldo seller bertambah
        ↓
Buyer dapat memberikan review
```

Kode serah-terima memiliki waktu berlaku terbatas dan dapat dibuat ulang jika telah kedaluwarsa.

---

## Instant Courier

BMarket juga menyediakan flow kurir instan sebagai simulasi.

Seller dapat memilih metode penyerahan:

- Campus Meetup
- Instant Courier
- Keduanya

Untuk Instant Courier, BMarket menyimpan informasi seperti:

- provider kurir;
- alamat tujuan;
- nomor penerima;
- ongkir;
- tracking number.

Integrasi kurir saat ini masih berupa simulasi dan belum terhubung ke API GoSend atau GrabExpress secara nyata.

---

## Chat

BMarket memiliki real-time chat menggunakan Socket.IO.

Chat digunakan untuk:

- menanyakan kondisi barang;
- berdiskusi sebelum membeli;
- menentukan lokasi meetup;
- menentukan waktu meetup;
- berkomunikasi selama transaksi.

Pada desktop, chat menggunakan layout dua kolom:

```text
Daftar percakapan | Percakapan aktif
```

Conversation tetap berada dalam shell BMarket tanpa berpindah ke layout halaman terpisah.

Chat juga memiliki:

- timestamp;
- read status;
- transaction context;
- blocked-user protection.

---

## Rating & Review

Setelah transaksi selesai, buyer dapat memberikan review kepada seller.

Review terdiri dari:

- rating 1–5;
- komentar opsional.

Satu transaksi hanya dapat menerima satu review.

Public seller profile menampilkan:

- rata-rata rating;
- jumlah review;
- transaksi selesai;
- listing aktif;
- bio seller;
- review dari buyer.

---

## Wishlist & Discovery

Pengguna dapat menyimpan listing ke wishlist.

Wishlist disimpan di database, sehingga tidak hilang setelah browser atau aplikasi ditutup.

BMarket juga mencatat recently viewed listing untuk membantu pengguna kembali ke produk yang sebelumnya dilihat.

---

## Dispute & Safety

Jika terjadi masalah pada transaksi yang sudah dibayar, buyer atau seller dapat membuka dispute.

Contoh alasan dispute:

- barang tidak sesuai deskripsi;
- barang rusak;
- barang tidak diterima;
- seller tidak datang saat meetup;
- buyer tidak datang saat meetup;
- alasan lainnya.

Dispute dapat menyertakan:

- deskripsi;
- bukti gambar;
- status pemeriksaan;
- keputusan admin.

Saat dispute aktif, dana escrow tetap ditahan sampai admin memberikan keputusan.

Admin dapat:

- refund dana ke buyer;
- melepas dana ke seller;
- menolak dispute.

---

## Report & Moderation

Pengguna dapat melaporkan:

- listing;
- pengguna.

Admin memiliki moderation dashboard untuk:

- melihat laporan;
- meninjau listing;
- menyembunyikan listing;
- menghapus listing;
- mempertahankan listing;
- mengaktifkan atau menonaktifkan akun pengguna;
- menangani dispute.

---

## Block User

Pengguna dapat memblokir pengguna lain.

Jika salah satu pihak memblokir pihak lainnya:

- chat baru tidak dapat dilakukan;
- komunikasi antara kedua akun dibatasi.

Block dapat dibatalkan kembali melalui sistem.

---

## Notifications

BMarket memiliki notification center dengan unread badge.

Notification digunakan untuk event seperti:

- perubahan transaksi;
- pesan;
- review;
- dispute;
- system notification.

Pengguna dapat:

- membaca notification;
- mark as read;
- mark all as read.

---

## Wallet & Ledger

Setiap user memiliki:

- `balance`
- `escrow`

BMarket juga menyimpan wallet ledger untuk mencatat perubahan saldo secara auditable.

Jenis ledger antara lain:

```text
TOPUP
PURCHASE_HOLD
REFUND
ESCROW_RELEASE
SELLER_PAYOUT
```

Setiap ledger menyimpan nilai perubahan saldo dan saldo setelah transaksi.

---

## Tech Stack

### Backend

- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- Socket.IO
- JWT Authentication
- Passport
- bcrypt
- Nodemailer
- Multer
- Helmet
- Express Rate Limit
- Vitest

### Frontend

- Expo
- React Native
- TypeScript
- Expo Router
- React Query
- Zustand
- Axios
- Socket.IO Client
- Expo Secure Store
- Expo Image Picker
- React Native Reanimated

---

## Struktur Project

```text
BMarket/
│
├── .github/
│   └── workflows/
│
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   │
│   ├── src/
│   │   ├── activity/
│   │   ├── admin/
│   │   ├── auth/
│   │   ├── chat/
│   │   ├── complaints/
│   │   ├── disputes/
│   │   ├── listings/
│   │   ├── notifications/
│   │   ├── reviews/
│   │   ├── safety/
│   │   ├── transactions/
│   │   ├── uploads/
│   │   └── users/
│   │
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
│   │
│   ├── assets/
│   ├── package.json
│   └── .env.example
│
├── .nvmrc
└── README.md
```

---

## Prerequisites

Sebelum menjalankan project, pastikan sudah terinstall:

- Node.js 24.15.0 atau runtime kompatibel;
- npm;
- PostgreSQL;
- Git.

Database default yang digunakan:

```text
PostgreSQL
Database: bmarket
Port: 5432
```

---

# Menjalankan Project

## 1. Clone Repository

```bash
git clone https://github.com/Geraldicky/BMarket.git
cd BMarket
```

---

## 2. Backend Setup

Masuk ke folder backend:

```bash
cd backend
```

Install dependency:

```bash
npm install
```

Buat `.env` dari template.

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS / Linux:

```bash
cp .env.example .env
```

Contoh konfigurasi:

```env
PORT=3000
NODE_ENV=development

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bmarket?schema=public"

JWT_SECRET="your_random_secret"
JWT_EXPIRES_IN="7d"

OTP_HASH_SECRET="your_random_otp_secret"

CORS_ORIGIN="http://localhost:8081"

UPLOAD_DIR="uploads"

CHECKOUT_RESERVATION_MINUTES=15
```

Generate Prisma Client:

```bash
npm run db:generate
```

Apply migration:

```bash
npm run db:deploy
```

Optional development seed:

```bash
npm run db:seed
```

Jalankan backend:

```bash
npm run dev
```

Backend akan tersedia di:

```text
http://localhost:3000/api
```

---

## 3. Frontend Setup

Buka terminal baru:

```bash
cd frontend
npm install
```

Buat `.env`:

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS / Linux:

```bash
cp .env.example .env
```

Untuk web atau emulator di komputer yang sama:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

Untuk perangkat fisik, gunakan IP LAN komputer:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000/api
```

Pastikan komputer dan perangkat berada di jaringan yang sama.

Jalankan Expo:

```bash
npm start
```

Atau:

```bash
npm run web
npm run android
npm run ios
```

Untuk membersihkan cache:

```bash
npm start -- --clear
```

---

# Email OTP

Registrasi membutuhkan verifikasi email BINUS.

Domain yang diperbolehkan dikontrol melalui:

```env
SSO_ALLOWED_DOMAINS="@binus.ac.id,@student.binus.ac.id,@binus.edu"
```

Untuk development tanpa SMTP:

```env
OTP_DEV_LOG=true
```

OTP akan ditampilkan pada terminal backend.

Untuk menggunakan email sungguhan, isi konfigurasi SMTP:

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="BMarket <your-email@gmail.com>"
```

Jika menggunakan Gmail, gunakan App Password.

---

# Testing

## Backend Type Check

```bash
cd backend
npm run typecheck
```

## Core Flow Tests

```bash
npm run test:flows
```

## Full Test Suite

```bash
npm test
```

## Production Build Check

```bash
npm run build
```

Backend memiliki automated test untuk area seperti:

- authentication;
- listing;
- transaction policy;
- checkout;
- stock reservation;
- handover code;
- review;
- wishlist;
- recently viewed;
- dispute;
- notification;
- user blocking;
- chat;
- wallet ledger.

---

## Frontend Type Check

```bash
cd frontend
npm run typecheck
```

Lint:

```bash
npm run lint
```

---

# Useful Backend Commands

```bash
npm run dev
npm run build
npm run typecheck
npm test
npm run test:flows

npm run db:validate
npm run db:generate
npm run db:deploy
npm run db:studio
npm run db:seed
```

---

# Health Check

Backend menyediakan health endpoint:

```text
GET /api/health
```

dan readiness check untuk memastikan service siap menerima request.

---

# Security

Beberapa proteksi yang digunakan:

- JWT authentication;
- hashed password;
- hashed OTP;
- OTP expiration;
- OTP attempt limit;
- email domain restriction;
- request validation;
- Helmet;
- CORS allowlist;
- rate limiting;
- account activation status;
- token invalidation;
- serialized transaction flow;
- escrow;
- duplicate transaction protection;
- stock reservation;
- user blocking;
- dispute workflow.

Jangan pernah commit file `.env` ke repository.

Gunakan `.env.example` sebagai template konfigurasi.

---

# Scope Project

BMarket saat ini menggunakan beberapa fitur simulasi untuk kebutuhan development dan demonstrasi.

Yang masih bersifat simulasi:

- top up saldo;
- pembayaran;
- escrow virtual;
- Instant Courier;
- tracking number;
- ongkir.

BMarket belum terhubung dengan:

- payment gateway seperti Midtrans atau Xendit;
- QRIS production;
- GoSend API;
- GrabExpress API.

Tidak tersedia COD tunai pada flow utama BMarket.

---

# Main User Flow

```text
Register
   ↓
Verify Email OTP
   ↓
Login
   ↓
Browse Marketplace
   ↓
Open Listing
   ↓
Checkout
   ↓
Pay with BMarket Balance
   ↓
Escrow
   ↓
Chat Seller
   ↓
Meetup
   ↓
Buyer Receives Item
   ↓
Generate Handover Code
   ↓
Seller Verifies Code
   ↓
Transaction Completed
   ↓
Seller Receives Balance
   ↓
Buyer Reviews Seller
```

---

# Admin Flow

```text
Admin Login
   ↓
Dashboard
   ├── User Management
   ├── Listing Moderation
   ├── Reports
   ├── Disputes
   └── Commission Settings
```

---

## Project Purpose

BMarket dikembangkan sebagai marketplace komunitas kampus yang memprioritaskan:

- trust antar pengguna;
- komunikasi langsung;
- transaksi yang tercatat;
- pengalaman jual-beli yang sederhana;
- mekanisme penyelesaian transaksi yang lebih aman;
- moderasi berbasis komunitas.

Project ini ditujukan untuk kebutuhan akademik, pengembangan produk, dan demonstrasi sistem marketplace end-to-end.

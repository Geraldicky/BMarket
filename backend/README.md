# BMarket API

Backend NestJS 12 dengan Prisma 5, PostgreSQL, JWT, Socket.IO, upload lokal, rate limiting, dan transaksi escrow atomik.

## Environment wajib

- `DATABASE_URL`: URL PostgreSQL.
- `JWT_SECRET`: string acak minimal 32 karakter.
- `CORS_ORIGIN`: daftar origin dipisahkan koma.
- `PUBLIC_BASE_URL`: alamat publik server untuk URL gambar.
- `UPLOAD_DIR`: folder penyimpanan upload, default `uploads`.
- `OTP_HASH_SECRET`: secret acak untuk meng-hash kode OTP; gunakan nilai berbeda dari JWT.
- `SMTP_USER` dan `SMTP_PASS`: akun SMTP yang mengirim email verifikasi. Wajib di production.
- `PASSWORD_RESET_MIN_RESPONSE_MS`: waktu respons minimum permintaan reset untuk mengurangi kebocoran status akun melalui timing.

Lihat `.env.example` untuk contoh development.

## Perintah

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
npm test
npm run build
```

Endpoint memakai prefix `/api`. Upload menerima 1–4 gambar JPG, PNG, atau WebP dengan ukuran maksimal 5 MB per file dan membutuhkan JWT. Listing baru wajib memiliki minimal satu foto. Barang juga wajib memiliki kondisi serta stok, sedangkan jasa selalu menyimpan kolom kondisi/stok sebagai `null`.

Saat seller mengubah jumlah stok barang, backend mempertahankan jumlah unit yang sudah dialokasikan ke transaksi. Contoh: stok awal 5 dan stok tersedia 3 berarti 2 unit sudah dialokasikan; bila total stok dinaikkan menjadi 8, stok tersedia menjadi 6, bukan 8.

## Verifikasi email BINUS dengan OTP

Registrasi tidak lagi langsung memberikan JWT. Backend membuat akun dengan `isVerified=false`, mengirim kode enam digit, lalu baru mengaktifkan akun dan memberikan JWT setelah `POST /api/auth/verify-email` berhasil. Kode disimpan sebagai HMAC, berlaku 10 menit, hanya sekali pakai, maksimal lima percobaan, dan memiliki cooldown kirim ulang 60 detik.

Untuk mencoba dengan Gmail:

1. Aktifkan verifikasi dua langkah pada akun Google pengirim.
2. Buat App Password 16 digit.
3. Isi `SMTP_USER`, `SMTP_PASS`, dan `SMTP_FROM` di `.env`; jangan gunakan password login Google biasa.
4. Restart backend setelah mengubah `.env`.

Gmail sesuai untuk development/demo, bukan pengiriman production berskala besar. Untuk development tanpa SMTP, biarkan `OTP_DEV_LOG=true`; kode OTP akan dicetak di terminal backend dan tidak dikembalikan lewat API. Pada `NODE_ENV=production`, backend menolak startup jika SMTP belum diisi.

Endpoint autentikasi terkait:

- `POST /api/auth/register` — membuat akun belum terverifikasi dan mengirim OTP.
- `POST /api/auth/verify-email` — memverifikasi OTP dan mengembalikan user + JWT.
- `POST /api/auth/resend-verification` — mengganti OTP lama dengan kode baru setelah cooldown.
- `POST /api/auth/login` — menolak akun yang belum terverifikasi dengan kode `EMAIL_NOT_VERIFIED`.

## Lupa password

Pemulihan akun memakai tiga endpoint dan tidak pernah mengirim password melalui email:

1. `POST /api/auth/forgot-password` menerima email dan selalu memberi respons generik, baik akun ditemukan maupun tidak.
2. `POST /api/auth/verify-reset-code` memvalidasi OTP lalu memberikan token reset acak yang hanya berlaku 10 menit.
3. `POST /api/auth/reset-password` menerima token tersebut, password baru, dan konfirmasi password.

OTP dan token reset sama-sama disimpan sebagai HMAC, memiliki batas lima percobaan, kedaluwarsa, dan hanya sekali pakai. Reset yang berhasil menaikkan `tokenVersion`, sehingga seluruh JWT dan koneksi chat lama otomatis ditolak. Pengguna harus masuk kembali dengan password baru. Email pemberitahuan juga dikirim setelah password berubah.

Listing memakai post-moderation: listing baru langsung aktif, sedangkan laporan pengguna diperiksa melalui endpoint admin. Migration menambahkan status `HIDDEN` dan `REMOVED`, mengubah default listing menjadi `ACTIVE`, serta mencegah laporan duplikat dari akun yang sama. Migration autentikasi menambahkan tabel `email_verifications`, `password_resets`, dan versi token pengguna; jalankan migration sebelum menyalakan versi backend ini.

## Checkout dan transaksi

- Checkout mereservasi stok secara atomik dan menolak transaksi aktif duplikat dari buyer yang sama untuk listing yang sama.
- Pembayaran hanya dapat dilakukan sekali oleh buyer dan memindahkan saldo ke escrow.
- Seller mengubah `PAID → CONFIRMED`; hanya buyer yang dapat mengubah `CONFIRMED → COMPLETED` dan melepaskan escrow.
- Pembatalan transaksi aktif wajib menyertakan alasan, mengembalikan escrow serta stok, dan tidak membuka kembali listing yang sedang dimoderasi admin.
- Kolom milestone `paidAt`, `confirmedAt`, `completedAt`, `cancelledAt`, `cancelledBy`, dan `cancellationReason` ditambahkan oleh migration `20260903170000_transaction_checkout_flow`.

Untuk production, gunakan object storage seperti S3/R2 untuk upload, aktifkan TLS melalui reverse proxy, jalankan migration dengan `prisma migrate deploy`, serta simpan secret di secret manager platform deployment.

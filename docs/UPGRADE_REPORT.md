# BMarket 2.0 — Upgrade Report

## Ringkasan

Upgrade ini memindahkan Flutter lama ke `legacy/flutter`, membangun ulang aplikasi utama dengan React Native, dan memperbaiki beberapa risiko backend yang dapat menyebabkan token lemah, akses chat tanpa otorisasi, overselling, pembayaran ganda, atau escrow dilepas oleh pihak yang salah.

## Frontend

- Expo SDK 57, React Native 0.86, React 19, dan TypeScript strict.
- Expo Router dengan route group auth, student, dan admin.
- TanStack Query untuk server state, Zustand untuk session, Axios untuk API, dan SecureStore untuk JWT.
- UI baru dengan Poppins, design tokens, loading/error/empty state, serta layout Android/iOS/web.
- Image Picker dan multipart upload; Socket.IO untuk chat real-time.
- Pengelola foto listing mendukung foto lama dan baru dalam satu urutan, cover selection, delete, batas ukuran, progres upload, dan upload browser melalui objek `File` native.
- Galeri detail listing memakai thumbnail aktif, navigasi maju/mundur, indikator jumlah foto, cache disk/memori, transisi, dan fallback gambar.
- Checkout memakai modal lintas web/native dengan ringkasan produk, jumlah, catatan, total, dan penjelasan reservasi stok/escrow.
- Dashboard transaksi memiliki tab buyer/seller, filter status, penghitung tindakan, kartu berfoto, serta CTA sesuai role dan state.
- Detail transaksi menampilkan milestone timeline, saldo/escrow, komisi seller, pihak terkait, dialog konfirmasi, dan alasan pembatalan.
- Konfigurasi package Android/iOS, EAS preview APK, splash screen, dan permission minimum.

## Backend

- NestJS 12, TypeScript 6, bcryptjs 3, Helmet, rate limiting, dan CORS allowlist.
- Startup gagal jika `DATABASE_URL`/`JWT_SECRET` hilang atau secret terlalu pendek.
- Akun nonaktif ditolak pada login dan setiap validasi token.
- Email dinormalisasi; DTO membatasi panjang, format, pagination, gambar, stok, dan nominal.
- Listing nonaktif hanya dapat dilihat owner atau admin.
- Upload terautentikasi dengan validasi MIME, jumlah, ukuran, dan nama file acak.
- Aturan domain listing memastikan minimal satu foto, kondisi/stok wajib untuk barang, dan atribut barang dibersihkan saat listing diubah menjadi jasa.
- Perubahan total stok mempertahankan unit yang sudah dialokasikan sehingga edit seller tidak membuka kembali stok yang telah dipesan.
- State machine transaksi menolak checkout aktif duplikat dan pembayaran ganda, mencatat timestamp milestone, serta mengharuskan alasan pembatalan.
- Refund dan pengembalian stok tetap atomik; listing `HIDDEN`/`REMOVED` tidak diaktifkan kembali oleh pembatalan transaksi.
- Membership chat divalidasi untuk join, send, dan typing; room diurutkan berdasarkan aktivitas terbaru.
- Query unread chat digabung dengan filtered count untuk menghindari N+1 query.

## Konsistensi transaksi

Create, pay, status change, completion, cancellation, refund, dan stock return memakai interactive Prisma transaction ber-isolasi `Serializable`, retry pada konflik `P2034`, serta conditional update. Buyer menjadi satu-satunya pihak yang dapat menyelesaikan pesanan setelah status `CONFIRMED`.

## Database

Migration `20260902000000_performance_indexes` menambahkan `chat_rooms.updatedAt` dan index untuk feed listing, transaksi per user, review, pesan/unread chat, serta antrean complaint. Migration `20260903170000_transaction_checkout_flow` menambahkan histori milestone dan data pembatalan transaksi.

## Batas pengujian

Build, type-check, unit test, Prisma validation, dan static Expo export dapat dijalankan tanpa database aktif. Pengujian integrasi penuh tetap membutuhkan PostgreSQL, backend berjalan, dan perangkat/emulator. Sebelum rilis festival, uji minimal dua akun student dan satu admin pada perangkat nyata untuk seluruh alur bayar–konfirmasi–selesai serta cancel/refund.

## Rekomendasi deployment berikutnya

1. Gunakan PostgreSQL terkelola dan jalankan `prisma migrate deploy`.
2. Pindahkan gambar ke object storage; volume lokal dapat hilang pada redeploy.
3. Gunakan HTTPS, rotasi JWT secret, dan batasi CORS ke domain/app production.
4. Tambahkan integration test dengan database disposable dan smoke test E2E Android.
5. Tautkan EAS project lalu hasilkan APK preview untuk pengujian panitia.

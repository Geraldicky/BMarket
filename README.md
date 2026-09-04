# BMarket V21

Marketplace barang dan jasa khusus komunitas BINUS. V21 berfokus pada core stability dan transaction integrity: upload gambar dipulihkan, checkout memakai reservasi stok 15 menit, histori transaksi memakai snapshot listing, dan pembatalan setelah seller mengonfirmasi tidak lagi diperbolehkan secara langsung.

## Struktur

```text
backend/        NestJS 12, Prisma, PostgreSQL, Socket.IO
frontend/       Expo SDK 57, React Native, Expo Router, TypeScript
legacy/flutter/ aplikasi Flutter lama sebagai referensi migrasi
docs/           laporan teknis upgrade
```

## Menjalankan backend

Prasyarat: PostgreSQL dan Node.js `24.15.0` (tersimpan di `.nvmrc`; jalur kompatibel lain: `^22.22.3` atau `>=26`).

```bash
cd backend
npm install
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed       # opsional
npm run dev
```

Isi `DATABASE_URL` dengan koneksi PostgreSQL dan gunakan `JWT_SECRET` acak minimal 32 karakter. API tersedia di `http://localhost:3000/api`, sedangkan health check ada di `http://localhost:3000/api/health`.

Registrasi menggunakan verifikasi OTP email BINUS. Untuk development tanpa SMTP, kode muncul di terminal backend. Untuk mengirim email sungguhan, isi konfigurasi `SMTP_*` dan `OTP_HASH_SECRET` sesuai `backend/.env.example`; Gmail memerlukan App Password, bukan password akun biasa.

## Menjalankan React Native

```bash
cd frontend
npm install
cp .env.example .env
npm start
```

Untuk perangkat fisik, ganti `EXPO_PUBLIC_API_URL` dengan IP LAN komputer, misalnya `http://192.168.1.10:3000/api`. Komputer dan perangkat harus berada di jaringan yang sama.

Perintah lain:

```bash
npm run android
npm run ios
npm run web
npm run typecheck
```

## Alur transaksi V21

1. Seller menentukan apakah listing menerima **Meetup Kampus**, **Kurir Instan simulasi**, atau keduanya.
2. Buyer mengatur jumlah/catatan, memilih metode penyerahan, lalu melengkapi detail checkout; stok langsung direservasi selama 15 menit (dapat diubah melalui `CHECKOUT_RESERVATION_MINUTES`).
3. Meetup meminta kampus, titik temu, dan jadwal. Kurir meminta GoSend/GrabExpress simulasi, alamat, serta nomor penerima.
4. Buyer membayar dari saldo BMarket; subtotal dan ongkir masuk escrow. Komisi 5% hanya dihitung dari subtotal barang/jasa, bukan ongkir.
5. Seller mengonfirmasi meetup atau menyiapkan pengiriman. Kurir memperoleh nomor tracking simulasi.
6. Untuk meetup, buyer membuat kode serah-terima enam digit yang berlaku 15 menit setelah barang/jasa diterima. Seller memasukkan kode tersebut untuk menyelesaikan transaksi.
7. Untuk kurir, buyer menyelesaikan transaksi setelah kiriman benar-benar diterima.
8. Setelah transaksi selesai, saldo virtual seller menerima subtotal setelah biaya layanan. Ongkir dianggap dibayarkan ke penyedia kurir simulasi.
9. Pembatalan wajib memiliki alasan dan hanya dapat dilakukan saat `PENDING` atau `PAID`. Setelah seller mengubah transaksi menjadi `CONFIRMED`, direct-cancel ditutup agar buyer tidak dapat menerima barang sekaligus refund.

Tidak tersedia COD tunai. Meetup tetap menggunakan pembayaran virtual BMarket sehingga escrow, riwayat transaksi, dan biaya layanan tidak dapat dilewati.

Alur dasar yang tetap dipertahankan:

1. Buyer memeriksa ringkasan checkout sebelum membuat pesanan; stok direservasi sementara dan otomatis kembali jika pembayaran melewati batas waktu.
2. Satu buyer tidak dapat membuat beberapa transaksi aktif untuk listing yang sama.
3. Setiap milestone menyimpan waktu pembayaran, konfirmasi, selesai, atau batal untuk ditampilkan sebagai timeline. V21 juga menyimpan snapshot judul, cover, tipe, dan kondisi listing agar riwayat pembelian tidak berubah saat listing diedit.

Semua perubahan saldo, escrow, status, dan stok dijalankan dalam transaksi database `Serializable` untuk mencegah pembayaran ganda dan overselling. Pembatalan tidak dapat mengaktifkan kembali listing yang sedang disembunyikan atau dihapus admin.

## Alur registrasi dan verifikasi

1. Pengguna mendaftar menggunakan domain email BINUS yang diizinkan.
2. Akun dibuat dalam keadaan belum terverifikasi dan belum menerima JWT.
3. Kode OTP enam digit dikirim ke email, berlaku 10 menit, dan dapat diminta ulang setelah 60 detik.
4. Setelah kode benar, OTP dihapus, akun ditandai terverifikasi, lalu aplikasi menyimpan JWT dan membuka beranda.
5. Login dengan password benar tetap ditolak sampai email selesai diverifikasi.

## Alur lupa password

1. Dari halaman masuk, pengguna memilih **Lupa password?** dan memasukkan email BINUS.
2. API selalu memberikan respons generik agar tidak membocorkan email mana yang terdaftar.
3. Pengguna memasukkan OTP enam digit, lalu memperoleh izin reset terbatas yang hanya disimpan sementara di memori aplikasi.
4. Password baru harus dikonfirmasi dan tidak boleh sama dengan password lama.
5. Reset berhasil menghapus token reset dan menaikkan `tokenVersion`, sehingga JWT lama ditolak pada request dan koneksi baru. Pengguna kemudian masuk kembali.

## Alur moderasi listing

1. Listing baru atau perubahan listing langsung berstatus `ACTIVE` dan tampil di marketplace.
2. Pengguna lain dapat melaporkan listing dengan alasan terstruktur serta detail tambahan.
3. Satu pengguna hanya dapat membuat satu laporan untuk target yang sama dan tidak dapat melaporkan listing sendiri.
4. Laporan masuk ke antrean admin. Admin dapat mempertahankan, menyembunyikan, atau menghapus listing.
5. Saat listing disembunyikan atau dihapus, seluruh laporan terbuka untuk listing tersebut otomatis diselesaikan.

Setelah mengambil versi yang menyertakan perubahan schema, jalankan `npm run db:migrate` di folder `backend` sebelum menyalakan server.

## Alur listing dan foto

1. Seller wajib menambahkan 1–4 foto JPG, PNG, atau WebP dengan ukuran maksimal 5 MB per foto.
2. Foto pertama menjadi sampul. Di form edit, foto lama dan baru dapat dihapus, digeser, atau dijadikan sampul tanpa menghilangkan foto lain.
3. Barang wajib memiliki kondisi dan stok; jasa tidak menyimpan atribut stok/kondisi barang.
4. Galeri detail menampilkan seluruh foto dengan thumbnail, tombol navigasi, indikator urutan, cache lokal, dan fallback jika gambar gagal dimuat.
5. Ketika total stok diedit, unit yang sudah masuk transaksi tetap direservasi dan tidak kembali menjadi stok tersedia.
6. Seller wajib mengaktifkan minimal satu metode penyerahan pada form listing.

## Upgrade dari V20 ke V21

Setelah menimpa folder project lama dengan isi V21, jalankan:

```bash
cd backend
npm install
npm run db:generate
npm run db:migrate
npm run db:seed       # opsional untuk database development baru
npm run dev
```

Kemudian buka terminal kedua:

```bash
cd frontend
npm install
npm start -- --clear
```

Migration V21 menambahkan `reservationExpiresAt` dan snapshot listing ke transaksi. Transaksi `PENDING` lama diberi batas 15 menit dari waktu pembuatannya; jika sudah lewat, service V21 akan mengubahnya menjadi `CANCELLED` dan mengembalikan stok.

## Akun seed

Seed lama menyediakan akun admin dan student untuk development. Jangan gunakan password seed pada deployment publik; ubah atau hapus seluruh akun contoh setelah setup.

## Verifikasi

```bash
cd backend && npm test && npm run build
cd frontend && npm run typecheck && npx expo-doctor
```

Detail arsitektur, keamanan, migration, dan batas pengujian ada di [docs/UPGRADE_REPORT.md](docs/UPGRADE_REPORT.md).

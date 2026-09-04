# BMarket Mobile

Aplikasi React Native berbasis Expo SDK 57 dan TypeScript. Navigasi memakai Expo Router dengan pemisahan route mahasiswa dan admin.

## Setup

```bash
npm install
cp .env.example .env
npm start
```

Isi `EXPO_PUBLIC_API_URL` dengan URL backend. Android Emulator biasanya memakai `http://10.0.2.2:3000/api`; perangkat fisik memakai IP LAN komputer.

## Fitur

- Login/register email BINUS dan token di SecureStore.
- Browse, cari, filter, buat, edit, dan nonaktifkan listing.
- Form listing terstruktur dengan validasi inline dan progres upload.
- Upload 1–4 foto (maksimal 5 MB), pilih sampul, ubah urutan, hapus foto lama/baru, dan galeri detail interaktif.
- Saldo simulasi, pembelian, escrow, status transaksi, dan pembatalan.
- Checkout confirmation dengan ringkasan harga, jumlah, catatan, dan informasi reservasi stok.
- Dashboard transaksi dengan filter buyer/seller, status, kebutuhan tindakan, foto produk, dan CTA kontekstual.
- Detail transaksi dengan timeline milestone, rincian komisi/saldo/escrow, dialog tindakan, chat pihak terkait, dan alasan pembatalan.
- Chat real-time melalui Socket.IO.
- Edit profil dan laporan listing dengan pilihan alasan serta detail tambahan.
- Listing seller langsung tayang tanpa antrean persetujuan awal.
- Dashboard, antrean laporan listing, tindakan moderasi, pengguna, riwayat laporan, dan komisi untuk admin.

## Quality checks

```bash
npm run typecheck
npm run lint
npx expo-doctor
npx expo export --platform web
```

Build APK internal dapat dibuat dengan profil `preview` pada `eas.json` setelah project ditautkan ke akun Expo.

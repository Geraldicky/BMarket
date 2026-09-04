# BMarket V19 — Marketplace Suite

V19 menyatukan tujuh iterasi fitur setelah flow meetup/kurir. Semua nilai uang, QRIS, VA, e-wallet, dan kurir tetap simulasi; belum ada integrasi uang nyata.

## Isi rilis

| Versi | Fitur | Perilaku utama |
| --- | --- | --- |
| V13 | Payment gateway virtual | Saldo, QRIS, VA, e-wallet; sesi 15 menit; callback sukses simulasi; satu ledger pembayaran per transaksi |
| V14 | Sengketa dan refund | Hanya saat dana di escrow; status transaksi dikunci; admin refund buyer, bayar seller, atau menolak sengketa |
| V15 | Reputasi | Buyer dan seller masing-masing dapat memberi satu ulasan setelah transaksi selesai |
| V16 | Notifikasi | Pesanan, pembayaran, penyerahan, sengketa, review, dan offer tersimpan di inbox pengguna |
| V17 | Saved activity | Wishlist persisten dan maksimal 30 listing yang baru dilihat |
| V18 | Price offer | Buyer menawar 50–100% harga; berlaku 24 jam; seller terima/tolak; accepted offer dipakai sekali di checkout |
| V19 | Admin analytics | GMV, komisi, conversion, dispute rate, rating, tren order, payment mix, fulfillment, dan kategori |

## Aturan finansial

- Komisi default 5% dibebankan ke seller dari subtotal barang/jasa.
- Ongkir tidak masuk dasar komisi.
- Saat pembayaran sukses, seluruh `grandTotal` masuk escrow buyer.
- Selesai normal melepas `sellerReceives` ke seller. Ongkir diasumsikan diteruskan ke kurir simulasi.
- Refund sengketa mengembalikan `grandTotal` ke saldo virtual buyer dan mengembalikan stok.
- Keputusan admin memakai transaksi database serializable agar saldo, stok, dan status tidak terpisah.

## Migrasi setelah extract ZIP

```powershell
cd backend
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Buka terminal kedua:

```powershell
cd frontend
npm install
npm start -- --clear
```

`db:seed` opsional bila data contoh sudah ada. Seed V19 bersifat idempotent berdasarkan kombinasi seller dan judul listing, sehingga tidak menggandakan fixture yang sama.

## Skenario demo singkat

1. Buyer membuka listing, menyimpannya ke wishlist, lalu chat seller.
2. Buyer mengirim offer 90%; seller menerima dari akun seller.
3. Buyer menekan **Checkout dengan harga ini**, memilih meetup/kurir, dan membuat pesanan.
4. Buyer memilih QRIS/VA/e-wallet, lalu menekan tombol simulasi callback sukses.
5. Seller memproses. Buyer dan seller menyelesaikan sesuai flow penyerahan.
6. Setelah selesai, kedua pihak memberi ulasan.
7. Alternatif: selama status PAID/CONFIRMED, salah satu pihak membuka sengketa. Admin memutuskan melalui tab **Sengketa**.
8. Admin membuka tab **Analytics** untuk melihat perubahan metrik.

## Batas produksi

- Payment gateway belum terhubung; endpoint callback simulasi harus dinonaktifkan di production.
- Kurir belum memesan driver dan tracking masih fixture.
- Upload masih memakai disk lokal; production sebaiknya memakai object storage.
- Notifikasi masih in-app polling, belum push notification.
- Analytics dihitung dari data operasional langsung; skala besar perlu tabel agregat atau data warehouse.

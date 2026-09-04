# BMarket V12 — Meetup Kampus & Kurir Instan

## Keputusan produk

- COD tunai dihapus dari alur utama.
- Meetup Kampus tetap dibayar lewat saldo virtual BMarket.
- Dana buyer ditahan di escrow sampai penyerahan selesai.
- Seller tetap dikenai biaya layanan berdasarkan subtotal barang/jasa.
- Ongkir tidak dikenai komisi dan tidak menambah pendapatan seller.
- GoSend dan GrabExpress pada versi ini adalah simulasi, bukan pemesanan kurir sungguhan.

## Fitur baru

- Seller memilih metode penyerahan yang didukung saat membuat atau mengedit listing.
- Buyer memilih Meetup Kampus atau Kurir Instan saat checkout.
- Meetup menyimpan kampus, titik temu, dan jadwal yang disepakati.
- Kurir menyimpan provider, ongkir simulasi, alamat, telepon, dan nomor tracking simulasi.
- Total checkout membedakan subtotal, ongkir, biaya layanan seller, dan total buyer.
- Buyer meetup dapat membuat kode serah-terima enam digit yang berlaku 15 menit.
- Seller meetup harus memasukkan kode tersebut sebelum escrow dilepas.
- Detail transaksi melakukan refresh berkala agar tindakan pihak lain terlihat tanpa membuka ulang halaman.

## Tarif simulasi

| Layanan | Ongkir | Estimasi |
| --- | ---: | --- |
| GoSend Instant | Rp18.000 | 1–3 jam |
| GrabExpress Instant | Rp17.000 | 1–3 jam |

Nilai ini hanya fixture demonstrasi dan dihitung ulang oleh backend. Frontend tidak menjadi sumber harga yang dipercaya.

## Migrasi database

Migration: `20260904090000_fulfillment_and_handover`

Migration menambahkan enum dan field penyerahan, mengaktifkan dua metode untuk listing lama, serta mengisi `grandTotal` transaksi lama dari `totalPrice`.

## Checklist demo

1. Login sebagai seller dan aktifkan metode penyerahan pada listing.
2. Login sebagai buyer, buka listing, lalu checkout memakai Meetup Kampus.
3. Bayar memakai saldo virtual.
4. Seller mengonfirmasi jadwal meetup.
5. Buyer membuat kode serah-terima setelah barang diterima.
6. Seller memasukkan kode dan memastikan transaksi menjadi selesai.
7. Ulangi checkout memakai Kurir Instan dan periksa ongkir serta tracking simulasi.

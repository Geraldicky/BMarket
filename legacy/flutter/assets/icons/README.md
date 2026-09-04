# Cara Mengubah Icon Aplikasi

## File yang dibutuhkan

Taruh file icon kamu di folder ini dengan nama:

```
assets/icons/
├── app_icon.png               ← WAJIB — icon utama (minimal 1024x1024 px)
└── app_icon_foreground.png    ← OPSIONAL — bagian depan adaptive icon Android
```

## Syarat file icon

- Format: **PNG**
- Ukuran minimal: **1024 x 1024 pixel**
- Background: **transparan** (supaya warna biru BINUS dari config tampil di belakangnya)
- Isi icon: logo/gambar yang ingin ditampilkan

## Langkah-langkah

### 1. Siapkan file icon
Buat atau desain icon kamu (bisa pakai Canva, Figma, dll) lalu export sebagai PNG 1024x1024.
Rename filenya menjadi `app_icon.png` lalu taruh di folder ini.

### 2. Install dependencies
```bash
flutter pub get
```

### 3. Generate icon otomatis
```bash
dart run flutter_launcher_icons
```
Perintah ini akan otomatis membuat semua ukuran icon yang dibutuhkan
untuk Android dan iOS dari 1 file `app_icon.png` yang kamu sediakan.

### 4. Jalankan aplikasi
```bash
flutter run
```

## Catatan

- Warna background icon Android sudah diset ke biru BINUS `#1565C0` di `pubspec.yaml`
- Jika ingin ganti warna background, ubah nilai `adaptive_icon_background` di `pubspec.yaml`
- Setiap kali ganti file `app_icon.png`, ulangi langkah 3

## Contoh hasil

```
android/app/src/main/res/
├── mipmap-hdpi/ic_launcher.png
├── mipmap-mdpi/ic_launcher.png
├── mipmap-xhdpi/ic_launcher.png
├── mipmap-xxhdpi/ic_launcher.png
└── mipmap-xxxhdpi/ic_launcher.png
```
Semua ukuran ini di-generate otomatis, kamu tidak perlu buat manual.

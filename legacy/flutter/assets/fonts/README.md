# Cara Install Font Poppins

Flutter membutuhkan file font `.ttf` di folder ini sebelum bisa dijalankan.

## Langkah-langkah:

1. Buka browser, pergi ke:
   https://fonts.google.com/specimen/Poppins

2. Klik tombol **"Download family"** (pojok kanan atas)

3. Extract file zip yang terdownload

4. Salin 4 file `.ttf` berikut ke folder `assets/fonts/` ini:
   - `Poppins-Regular.ttf`
   - `Poppins-Medium.ttf`
   - `Poppins-SemiBold.ttf`
   - `Poppins-Bold.ttf`

5. Setelah disalin, jalankan:
   ```
   flutter pub get
   flutter run
   ```

## Struktur folder yang benar setelah selesai:

```
assets/
└── fonts/
    ├── Poppins-Regular.ttf       ← weight 400
    ├── Poppins-Medium.ttf        ← weight 500
    ├── Poppins-SemiBold.ttf      ← weight 600
    └── Poppins-Bold.ttf          ← weight 700
```

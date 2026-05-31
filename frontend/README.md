# TBU Pay Frontend

Frontend aplikasi TBU Pay untuk digitalisasi operasional keuangan dan layanan warga perumahan skala mikro. Aplikasi ini mengimplementasikan arsitektur berlapis (domain, use case, repository, adapter) agar maintainable, testable, dan siap dikembangkan jangka panjang.

## Ringkasan

- Framework: React 19 + Vite
- State management: Zustand (persisted session)
- Routing: React Router
- Data adapter: Google Apps Script Web App (REST-style action endpoint)
- Offline strategy: TTL cache + network sync + fallback ke cache saat offline
- Peran pengguna: admin, warga, petugas

## Fitur Inti

- Autentikasi berbasis akun yang dikelola admin
- Cashflow perumahan (pemasukan, pengeluaran, status verifikasi)
- Unggah bukti bayar (dengan dukungan kompresi gambar di klien)
- Ticketing layanan warga (keluhan/saran + update status)
- Berita perumahan + balasan diskusi
- Manajemen user (khusus admin)
- Manajemen kategori transaksi dinamis (khusus admin)

## Arsitektur Aplikasi

Implementasi menggunakan pendekatan clean architecture untuk memisahkan aturan bisnis dari detail teknis.

- `src/domain`: model dan mapper domain
- `src/application/use-cases`: aturan bisnis per fitur
- `src/infrastructure/repositories`: jembatan use case ke adapter data
- `src/infrastructure/adapters`: HTTP adapter, cache store, error mapper
- `src/pages` dan `src/components`: UI dan interaksi pengguna
- `src/store`: state global autentikasi, loading, dan dialog

Alur data utama:

1. UI memanggil use case.
2. Use case memanggil repository.
3. Repository memanggil adapter backend.
4. Adapter mengelola request, cache, dan normalisasi error.
5. Respons dimapping ke domain model lalu dirender ke UI.

## Prasyarat

- Node.js 20 LTS atau lebih baru
- npm 10 atau lebih baru
- Endpoint Google Apps Script yang sudah deploy sebagai Web App

## Konfigurasi Environment

1. Salin file env contoh:

```bash
cp .env.example .env
```

Untuk Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

2. Isi variabel berikut di file `.env`:

```env
VITE_GAS_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

Catatan penting:

- Jangan commit URL endpoint sensitif ke repository publik jika berisi akses yang tidak dibatasi.
- Pastikan pengaturan akses Web App konsisten dengan kebijakan keamanan tim.

## Instalasi dan Menjalankan Lokal

```bash
npm install
npm run dev
```

Aplikasi akan berjalan di URL lokal yang ditampilkan Vite (umumnya `http://localhost:5173`).

## Skrip NPM

- `npm run dev`: menjalankan development server
- `npm run build`: build produksi
- `npm run preview`: preview hasil build
- `npm run lint`: static analysis dengan ESLint

## Integrasi Backend (Google Apps Script)

Frontend mengakses satu endpoint GAS (`VITE_GAS_URL`) dengan pola action-based API.

### Aksi GET

- `getTransactions`
- `getTickets`
- `getNews`
- `getUsers`
- `getTransactionCategories`
- `getNewsReplies`

### Aksi POST

- `login`
- `addTransaction`
- `verifyTransaction`
- `addTicket`
- `updateTicketStatus`
- `addUser`
- `updateUser`
- `deleteUser`
- `addNews`
- `addNewsReply`
- `addTransactionCategory`
- `deleteTransactionCategory`
- `reorderTransactionCategories`

## Caching, Offline, dan Ketahanan

Strategi cache berada di level adapter untuk endpoint baca (GET).

- TTL-based freshness check
- Return data cache saat masih fresh
- Sinkronisasi ke network saat cache stale
- Offline fallback ke cache jika network gagal
- Merge incremental untuk data append-heavy agar update tidak berat

Manfaat operasional:

- Waktu muat halaman lebih cepat
- Pengalaman pengguna lebih stabil pada jaringan lemah
- Pengurangan request berulang ke backend GAS

## Keamanan

Hal yang sudah diterapkan:

- Kontrol akses berbasis role di sisi aplikasi
- Pembatasan aksi tertentu (misalnya publish berita/kategori) oleh role admin
- Normalisasi error agar respons ke UI konsisten

Rekomendasi hardening lanjutan (production):

- Hash kata sandi kuat di backend (minimal SHA-256 + salt unik per user)
- Audit logging perubahan data kritis (verifikasi transaksi, perubahan user)
- Tambahkan rate limiting atau throttling di sisi backend gateway
- Pisahkan environment dev dan prod endpoint
- Lakukan rotasi berkala terhadap identifier sensitif (sheet ID, folder ID)

## Kualitas Kode

- ESLint sudah dikonfigurasi untuk React + hooks
- Struktur folder dipisah per concern agar onboarding engineer lebih cepat
- Use case layer meminimalkan business logic di komponen UI

Checklist sebelum merge:

1. `npm run lint` lolos tanpa error.
2. `npm run build` sukses.
3. Uji regresi manual untuk login, cashflow, ticketing, berita, dan manajemen user.
4. Verifikasi behavior offline untuk halaman yang menggunakan cache.

## Deployment Frontend

Langkah umum:

1. Set `VITE_GAS_URL` ke endpoint backend production.
2. Jalankan build:

```bash
npm run build
```

3. Deploy direktori `dist` ke static hosting pilihan (contoh: Vercel, Netlify, Nginx, atau object storage + CDN).
4. Pastikan fallback routing SPA aktif pada hosting.

## Operasional dan Troubleshooting

### Gejala: Login gagal untuk semua akun

- Periksa nilai `VITE_GAS_URL`.
- Pastikan deployment GAS masih aktif dan dapat diakses.
- Cek konfigurasi izin akses Web App.

### Gejala: Data lama tidak berubah

- Lakukan hard refresh browser.
- Trigger refresh data dari UI.
- Validasi TTL cache dan respons backend terbaru.

### Gejala: Unggah bukti bayar/tiket gagal

- Periksa ukuran/format gambar sebelum upload.
- Pastikan Google Drive folder backend memiliki izin tulis.
- Lihat log Apps Script untuk detail error.

## Struktur Direktori (Ringkas)

```text
frontend/
	src/
		api/
		application/use-cases/
		domain/
		infrastructure/
			adapters/
			repositories/
		components/
		pages/
		store/
```

## Kompatibilitas

- Browser modern berbasis Chromium, Firefox, Safari terbaru
- Optimal untuk penggunaan mobile web dan desktop web

## Roadmap Rekomendasi

- Unit test untuk use case dan mapper domain
- Integrasi test untuk adapter dan repository
- Error telemetry terpusat (misalnya Sentry)
- Feature flag untuk rilis bertahap
- CI pipeline untuk lint, test, build, dan quality gate

## Kontribusi

Standar kontribusi internal:

1. Buat branch fitur dari `main`.
2. Pastikan lint dan build sukses.
3. Buat pull request dengan deskripsi perubahan, risiko, dan rencana rollback.
4. Sertakan bukti uji untuk skenario utama.

## Lisensi & Pengembang

* **Pengembang**: Fathur R
* **Surel (Email)**: office.fathur@gmail.com
* **Hak Cipta**: © 2026 TBU Pay. Hak Cipta Dilindungi.

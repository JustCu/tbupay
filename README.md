# TBU Pay Monorepo

TBU Pay adalah platform PWA (Progressive Web App) modern yang dirancang untuk mendukung tata kelola keuangan mandiri, transparansi kas/iuran, dan layanan komunikasi terpadu untuk skala lingkungan perumahan (seperti Perumahan Teras Bali Ungaran).

Repositori ini menggunakan arsitektur monorepo yang menggabungkan:
1. **Frontend**: Aplikasi web responsif berbasis **React 19**, **Vite**, dan **Zustand**.
2. **Backend**: API serverless berbasis **Google Apps Script (GAS)** dengan basis data **Google Sheets** dan penyimpanan media **Google Drive**.

---

## 🚀 Fitur Unggulan & Keunggulan

TBU Pay dirancang dengan visual premium bergradasi indah, animasi mikro interaktif, responsivitas ponsel cerdas (termasuk iOS notch safe-area), dan strategi performa tinggi.

### 1. Transparansi & Pencatatan Keuangan (Arus Iuran)
* **Pencatatan Iuran & Verifikasi**: Pengguna warga dapat melaporkan pembayaran iuran bulanan dengan melampirkan foto bukti transfer. Di sisi klien, gambar dikompresi secara otomatis demi efisiensi bandwidth. Administrator memiliki antrean verifikasi interaktif (menyetujui / menolak pembayaran).
* **Buku Iuran Rinci (General Ledger)**: Pembukuan akuntansi standar dari transaksi tertua ke terbaru secara otomatis.
* **Agregasi Pengeluaran Pos**: Pengelompokan pengeluaran otomatis per pos kategori pembukuan diiringi visualisasi bagan donat (*doughnut chart*) dan grafik batang (*bar chart*) arus kas bulanan.

### 2. Ekspor Laporan Formal PDF (Standar A4)
* **Ekspor Laporan Keuangan Warga**: Administrator dapat mengekspor mutasi keuangan lengkap ke format lembar A4 virtual standar cetak PDF.
* **Fitur Pratinjau**: Pratinjau kertas A4 yang terkunci ukurannya (`210mm` x `297mm`), dilengkapi kontrol zoom visual, Kop Surat (*letterhead*), ringkasan eksekutif, dan tanda tangan bendahara serta pengurus perumahan.
* **Neutral Dark Mode Printing**: Desain cetak otomatis menetralkan mode gelap (selalu mencetak teks hitam di atas kertas putih bersih).

### 3. Layanan & Pengaduan Warga (Ticketing)
* **Pantau Keluhan Warga**: Sistem pengaduan responsif dengan pelacakan status (*Menunggu*, *Diproses*, *Selesai*).
* **PIC Penugasan & Kategori Otomatis**: Administrator dapat menunjuk petugas PIC resmi dengan nama lengkap. Judul keluhan otomatis mengekstrak kategori keluhan dari pola teks bracket (contoh: `[Keamanan]`).
* **Paginasi Cerdas**: Loading data yang terbagi rapi maksimal 10 entri per halaman untuk keluhan warga dan berita.

### 4. Pusat Komunikasi & Forum Diskusi
* **Grup Obrolan & Diskusi**: Saluran berita penting perumahan dilengkapi diskusi langsung antar tetangga menggunakan gelembung obrolan (*chat bubble*) ala WhatsApp.
* **Auto-Refresh 5 Detik**: Pembaruan obrolan, diskusi berita, dan diskusi keluhan berjalan di latar belakang secara instan setiap 5 detik tanpa kedipan (*flicker-free*).

### 5. Resident Digital ID Card (Kartu Hunian)
* **Kartu Identitas Digital**: Kartu identitas warga dengan skema gradasi biru premium, chip kartu emas, hologram, nama, alamat blok, nomor telepon, dan status hunian.
* **Kelola Warga Interaktif**: Admin dapat melihat database warga dalam format *List View* (daftar) atau *Tile View* (grid). Klik warga akan memunculkan popup kartu identitas digital dengan akses cepat WhatsApp.

### 6. Keamanan & Keandalan Sesi
* **Sesi Auto-Logout 7 Hari**: Penganalisis aktivitas pengguna secara berkala. Jika tidak ada aktivitas interaksi (klik mouse, ketukan layar, gulir halaman, atau ketikan tombol) selama 7 hari berturut-turut, sistem akan melakukan *auto-logout* dan menampilkan notifikasi sesi kedaluwarsa.
* **Throttling Kinerja**: Pembaruan aktivitas dibatasi maksimal sekali setiap 30 detik guna menghemat daya tulis memori penyimpanan.

---

## 🛠️ Arsitektur & Spesifikasi Teknologi

* **Frontend**: React 19, Vite, Zustand, TailwindCSS, Chart.js, Lucide Icons.
* **Backend**: Google Apps Script (Web App Endpoint).
* **Database & File Storage**: Google Sheets & Google Drive API.
* **PWA & Cache**: Web App Manifest (`manifest.json`), Service Worker (`sw.js`) dengan strategi caching pintar *Network-First* dan *Offline Fallback*.

---

## 💻 Informasi Pengembang

TBU Pay dirancang, dibangun, dan dipelihara secara profesional oleh:

* **Pengembang**: Fathur R
* **Surel (Email)**: [office.fathur@gmail.com](mailto:office.fathur@gmail.com)
* **Lisensi / Hak Cipta**: © 2026 TBU Pay. Hak Cipta Dilindungi.

---

*Untuk detail instalasi dan panduan development frontend, silakan lihat direktori [frontend/README.md](frontend/README.md).*

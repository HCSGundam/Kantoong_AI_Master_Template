# Daftar cek HP & laptop — Kantoong (Tahap 3)

Cara pakai: buka web di **HP** dan **laptop** bersamaan. Tiap baris: lakukan → lihat hasilnya → centang.
Kalau ada yang aneh, **screenshot** lalu kirim ke Claude dengan nomor barisnya (mis. "B4 di HP").

Alat bantu (khusus `npm run dev` di laptop):
- **Rapor tampilan otomatis**: buka `http://127.0.0.1:5173/audit.html` → **Jalankan semua**. Semua halaman diuji di ukuran HP & laptop, masalahnya didaftar per halaman.
- **Tes isolasi data**: `node tools/isolation-check.mjs` → pastikan tertulis **"Tidak ada kebocoran"**.

---

## A. Toko (pembeli)
| # | Lakukan | Yang benar | HP | Laptop |
|---|---|---|---|---|
| A1 | Buka beranda pertama kali | Muncul "Mau pakai bahasa apa?". Garis abu di atas lembar: **tarik naik = penuh, tarik turun = tutup** | ☐ | ☐ |
| A2 | Gulir beranda sampai bawah | Tidak ada yang melebar ke samping; footer menempel di dasar; ada "Dibuat oleh KANTOONG KENZO AI" | ☐ | ☐ |
| A3 | Ketuk ♡ dan tombol mata (Tanya AI) di kartu produk | Mudah diketuk dengan jempol, tidak salah tekan | ☐ | ☐ |
| A4 | Ketuk "Cek semuanya →" | Halaman koleksi terbuka; tombol filter → lembar bawah bisa ditarik | ☐ | ☐ |
| A5 | Buka satu produk | Harga besar 1 baris, rating tampil, tombol Bandingkan berfungsi | ☐ | ☐ |
| A6 | Matikan internet sebentar | Pita "Sinyalmu lagi hilang 📡" muncul, web tidak putih | ☐ | ☐ |
| A7 | Buka `info.html?halaman=kontak` | Rapi, tombol kembali mudah diketuk | ☐ | ☐ |

## B. Dashboard pengguna (Ruang Pribadi)
| # | Lakukan | Yang benar | HP | Laptop |
|---|---|---|---|---|
| B1 | Buka Ruang Pribadi | Kartu bento rapi, **tidak ada lubang kosong** di samping kartu kecil | ☐ | ☐ |
| B2 | Gulir sampai paling bawah | Kartu terakhir bisa digulir **di atas** pil "Hai, Kak!" (tidak tertutup) | ☐ | ☐ |
| B3 | Tambah fitur (Feature Hub) | Garis pegangan berfungsi: naik = penuh, turun = tutup | ☐ | ☐ |
| B4 | Katalog Produk → tombol filter | Lembar filter bisa ditarik, kartu produk sama dengan toko | ☐ | ☐ |
| B5 | Pengaturan → Tampilan → Bahasa/Tema/Font | Lapisan pop-up bertumpuk, garis pegangan berfungsi, tidak ada tulisan "null" | ☐ | ☐ |
| B6 | Buka beberapa ruang (Pesananku, Kartu Diriku, Wishlist) | Tidak ada teks "null/undefined", tidak ada yang terpotong aneh | ☐ | ☐ |

## C. ERP (coba mode demo, ganti-ganti peran)
| # | Lakukan | Yang benar | HP | Laptop |
|---|---|---|---|---|
| C1 | Masuk demo sebagai **Owner** | Langsung ke **Ruang Komando**: 3 keputusan hari ini + skor kesehatan | ☐ | ☐ |
| C2 | Tekan **Ctrl+K** (laptop) / ikon kaca pembesar (HP) → ketik "piutang" | Lompat ke Keuangan › Piutang | ☐ | ☐ |
| C3 | Ketuk 🔔 | Daftar notifikasi; "Tandai semua dibaca" menghapus angka merah | ☐ | ☐ |
| C4 | Persetujuan, Keuangan, Gudang, HR, CRM | **Tidak melebar ke samping**; deretan tab bisa digeser di dalam pitanya | ☐ | ☐ |
| C5 | Ganti peran **Keuangan** → setujui "Beli mesin espresso" → ganti **Owner** → setujui | Rantai ✓ → ✓ → ✓, status Disetujui | ☐ | ☐ |
| C6 | Dokumen & PDF → Invoice → isi dari calon pelanggan → unduh PDF | PDF berkop, total + terbilang, tanda tangan, **QR**. Scan QR → "Dokumen ASLI" | ☐ | ☐ |
| C7 | Alat PDF → Gabung 2 PDF, lalu Tanda tangan PDF | Hasil terunduh; file tidak diunggah ke mana pun | ☐ | ☐ |
| C8 | Agen AI → "buatkan slip gaji untuk Andi" (mode Tampil) | Panel emas menunjukkan langkah; layar ikut pindah; tombol Stop berfungsi | ☐ | ☐ |
| C9 | Etalase & Brand → kartu "Paket & industri" | **Tidak ada tulisan "null"**; tombol × dan ‹ di chip mudah diketuk | ☐ | ☐ |

## D. Kasir (peran Kasir Outlet)
| # | Lakukan | Yang benar | HP / tablet | Laptop |
|---|---|---|---|---|
| D1 | Buka Kasir POS, tambah 2 menu | Tombol − + cukup besar untuk jari | ☐ | ☐ |
| D2 | Lihat strip "Pesanan berjalan" | Tidak tertutup panel pesanan | ☐ | ☐ |
| D3 | Bayar campuran (QRIS + tunai) | Pilihan muncul, total benar, struk tercetak (pratinjau) | ☐ | ☐ |

## E. Keamanan & isolasi
| # | Cek | Yang benar |
|---|---|---|
| E1 | `node tools/isolation-check.mjs` | "✅ Tidak ada kebocoran". Pengunjung anonim tidak bisa membaca data karyawan, gaji, pesanan, jurnal, dokumen, harga modal |
| E2 | Setelah SQL `erp-pro.sql` & `erp-docs.sql` dijalankan, ulangi E1 | Baris "dilewati" berubah jadi "aman" |
| E3 | Catatan arsitektur | Data ERP **1 database Supabase = 1 perusahaan**. Untuk klien baru (mis. paman) **pakai proyek Supabase sendiri** agar data tiap brand terpisah total |

---

Setelah semua dicentang & revisi beres → **publish sekali** ke Cloudflare (`npm run deploy`, atas izin Koko).

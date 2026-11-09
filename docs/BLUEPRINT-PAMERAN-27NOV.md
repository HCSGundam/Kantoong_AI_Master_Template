# Blueprint Eksekusi Kantoong AI — Menuju Presentasi & Pameran 27 November 2026

Disusun 9 November 2026 dari: Blueprint Kantoong Kenzo AI Vol.7 (270 halaman, termasuk
Master Roadmap 20 stage / 200 langkah), hasil kerja yang sudah ada di repo, dan diskusi
agen AI otonom. **Checkout & pembayaran ditunda** (bukan untuk 27 Nov).

Prinsip yang dipakai di setiap langkah: Zero to One · MOAT · inversion thinking ·
anti Red Queen · AI hanya menulis kata, database memegang angka · AI tidak pernah membayar.

Legenda status: ✅ sudah ada · 🟡 ada sebagian · ⬜ belum · 🔵 butuh tindakan Koko / pihak luar.
Kolom "Stage" = nomor stage di Master Roadmap Vol.7.

---

## Jadwal besar (18 hari kerja)

| Tanggal | Fase | Jalur |
|---|---|---|
| 9 Nov | 0. Fondasi | Z |
| 10–13 Nov | 1. Homepage + Konsultasi + Orb | A, B, C |
| 14–17 Nov | 2. ERP Pro Max + Dokumen | F, E |
| 18–20 Nov | 3. AI Orchestrator | D |
| 21–23 Nov | 4. Dashboard User | G |
| 24–25 Nov | 5. GEO + Data + AR + Keamanan | H, I, K, J |
| 26 Nov | 6. Gladi & kunci fitur | L |
| **27 Nov** | **Presentasi & pameran** | |

Total: **13 jalur (Z, A–L), 98 langkah.**

---

## Z. Fondasi (9 Nov) — 6 langkah
| # | Langkah | Status |
|---|---|---|
| Z1 | Commit pekerjaan keamanan + layar tablet (26 file) | ⬜ |
| Z2 | Uji kasir dengan data asli Supabase (shift, jual, void PIN, tablet) | ⬜ |
| Z3 | Cek & perbaiki error 500 backend Gemini | ⬜ |
| Z4 | Redirect URL reset password di Supabase | 🔵 |
| Z5 | Siapkan aset 2 brand demo (Baju & Sepatu): logo, foto produk, harga | 🔵 |
| Z6 | Kunci daftar fitur demo per peran (owner, kasir, konsumen) | ⬜ |

## A. Homepage & Storefront — 10 langkah (Stage 9, 11; Vol.7 hal 215–220)
| # | Langkah | Status |
|---|---|---|
| A1 | Audit homepage & kartu produk di browser | ⬜ |
| A2 | **Halaman detail produk ala e-commerce**: galeri foto/video + zoom, varian, harga coret, rating & ulasan, stok, info kirim, produk serupa, bar bawah menempel | 🟡 |
| A3 | Tombol **"Tanyakan seputar produk"** megah (berdenyut) vs Checkout gaya ghost | ⬜ |
| A4 | Pop-up "Tunggu Kak…" konsultasi kilat sebelum checkout | ⬜ |
| A5 | **Live Dynamic Canvas**: katalog di belakang chat ikut kurasi AI + tombol kembali | ⬜ |
| A6 | Halaman katalog: cari, filter, kategori, urutkan | 🟡 |
| A7 | 2 brand demo Baju & Sepatu dengan skin masing-masing | 🟡 |
| A8 | Storefront Studio di ERP: atur hero/banner/unggulan, draft → publish → rollback | 🟡 |
| A9 | Responsif HP & kecepatan muat | 🟡 |
| A10 | Ulasan produk asli (tabel `product_reviews` sudah ada) | 🟡 |

## B. Konsultasi AI "membaca pikiran" — 9 langkah (Stage 10–11; Vol.7 hal 1–49, 204)
| # | Langkah | Status |
|---|---|---|
| B1 | **Konsultasi dulu, produk belakangan**: AI menggali kebutuhan (untuk siapa, acara, budget, ukuran, gaya) sebelum menampilkan produk | ⬜ |
| B2 | Sinyal terstruktur per sesi: Intent · Context · Entity · Evidence · Trust · Relevance | ⬜ |
| B3 | Rekomendasi beralasan + perbandingan antar produk + boleh ubah kebutuhan | 🟡 |
| B4 | **Prediksi kebutuhan** dari memori ber-izin: AI menyapa duluan ("baju hitam → sepatu hitam") dengan menyebut sumbernya | 🟡 |
| B5 | "Kartu Diriku": profil kebutuhan/gaya/budget yang bisa dilihat & dihapus user | ⬜ |
| B6 | Alasan beli / tidak beli tercatat (anonim) → bahan Kantoong Index | 🟡 |
| B7 | Riwayat chat + pin produk dari sesi lama | 🟡 |
| B8 | AI jujur: tidak mengarang harga/stok/review; bilang "belum tersedia" | 🟡 |
| B9 | Uji 20 skenario percakapan (umum, ambigu, di luar katalog, mencoba membajak AI) | ⬜ |

## C. Orb AI baru — 5 langkah
| # | Langkah | Status |
|---|---|---|
| C1 | Orb "hidup": bernapas, mata berkedip & mengikuti kursor, partikel cahaya | 🟡 |
| C2 | Ekspresi sesuai keadaan: mendengar, berpikir, senang, bekerja (mode agen) | ⬜ |
| C3 | Reaksi kontekstual: menyapa pelan saat user ragu lama di satu produk | ⬜ |
| C4 | Tombol mic + gelombang suara (input suara) | ⬜ |
| C5 | Konsisten di semua halaman: toko, keranjang, dashboard user, ERP, kasir | ✅ |

## D. AI Orchestrator: multi-LLM, multi-agent, otomasi, penjadwal — 12 langkah (Vol.7 hal 168–170)
| # | Langkah | Status |
|---|---|---|
| D1 | Router model di backend: Gemini + minimal 1 merek lain, cadangan otomatis bila gagal | ⬜ 🔵 kunci API |
| D2 | Daftar aksi (tool registry) per halaman + izin mengikuti pengguna + tingkat risiko | ⬜ |
| D3 | **Saklar Mode Konsultasi / Mode Agen** di orb | ⬜ |
| D4 | Agen bisa pindah halaman, memfilter, mengisi form, menambah ke keranjang | 🟡 |
| D5 | Konfirmasi untuk aksi berisiko + perintah "stop" | 🟡 |
| D6 | 15 agen spesialis terdaftar; 6 aktif untuk demo: Executive, POS & Sales, Inventory, Finance, Marketing, Customer Service | ⬜ |
| D7 | Workflow automation: pemicu waktu/peristiwa → aksi → persetujuan → riwayat | ⬜ |
| D8 | **Task scheduler** (jalan di backend, bukan browser): laporan pagi, pengingat, cek stok | ⬜ |
| D9 | **AI Control Center** (owner): pilih model per tugas, harga token, pemakaian, anggaran, fee platform | ⬜ |
| D10 | Harga token terbarui otomatis dari sumber harga + verifikasi | ⬜ |
| D11 | Jejak aksi AI (siapa memerintah, apa yang dilakukan, hasil) | 🟡 |
| D12 | Suara dua arah (bicara ke AI & AI menjawab dengan suara) | ⬜ |

## E. Dokumen otomatis — 7 langkah (diskusi agen 5 Nov)
| # | Langkah | Status |
|---|---|---|
| E1 | Mesin dokumen: template → **PDF** siap cetak | ⬜ |
| E2 | Ekspor **Word (.docx)** | ⬜ |
| E3 | Ekspor **Excel (.xlsx)** asli (bukan CSV) | 🟡 CSV ada |
| E4 | Dokumen pertama: slip gaji, invoice, PO, surat kerja sama, laporan kasir | ⬜ |
| E5 | QR keaslian + arsip dokumen | ⬜ |
| E6 | **Kotak Masuk ERP** + persetujuan (pengganti kirim lewat Gmail) | ⬜ |
| E7 | Email ditulis AI, terkirim hanya setelah user bilang "kirim" | ⬜ 🔵 layanan email + domain |

## F. ERP "Pro Max" (versi kelas atas) — 12 langkah (Vol.7 hal 167–168)
| # | Langkah | Status |
|---|---|---|
| F1 | Audit celah: fitur ERP kelas atas vs yang kita punya | ⬜ |
| F2 | **Ruang Komando Owner**: KPI realtime + "keputusan hari ini" disiapkan AI | 🟡 |
| F3 | Persetujuan berjenjang (nominal/divisi/risiko) + SLA + eskalasi | 🟡 |
| F4 | Keuangan: anggaran, utang-piutang jatuh tempo, rekonsiliasi bank, laba per kanal/cabang | 🟡 |
| F5 | Gudang: batch & kedaluwarsa, reorder point, peramalan permintaan | 🟡 |
| F6 | SDM: cuti, tugas & checklist, KPI, onboarding karyawan | 🟡 |
| F7 | Marketing & CRM: kalender kampanye, funnel, deteksi anggaran tanpa aktivitas | 🟡 |
| F8 | Konsolidasi multi-cabang & multi-brand | ⬜ |
| F9 | **Pencarian global + Ctrl+K** + pusat notifikasi | ⬜ |
| F10 | Lapisan unik: Dokumen Hidup, Temuan Tak Terduga, Memori Cara Kerja | ⬜ |
| F11 | Kasir POS Pro 1–6 (lengkap) | ✅ |
| F12 | Desain premium Atelier di semua menu | ✅ |

## G. Dashboard User — 8 langkah (Vol.7 hal 185–193)
| # | Langkah | Status |
|---|---|---|
| G1 | Sistem 3 lapisan: kartu ringkasan visual → halaman detail → registry | 🟡 |
| G2 | Kartu unik per fitur (contoh: mobil boks bergerak untuk paket dikirim) | ⬜ |
| G3 | Fitur inti hidup: Profil, Alamat, Lacak Paket, Pesananku, Riwayat Transaksi, Total & Analitik Belanja, Wishlist, Ulasan, Voucher, Poin Member, Riwayat Chat AI, Customer Service | 🟡 |
| G4 | Fitur pelengkap: Kalender, Ekspor Data, Lokasi Toko, Video Feed, Dokumen Kerja Sama, Upload Media, Interaksi Suara, Banner, Booking, Takeaway, Antrian, Jam, Musik, Bahasa, POS, Pembayaran | ⬜ |
| G5 | Adaptive Menu + Intent Menu (bisa dipanggil AI) + Navigation Memory 7 hari | 🟡 |
| G6 | Feature Hub: tambah/arsip/"segera hadir" sesuai kontrak brand | 🟡 |
| G7 | Hak data (UU PDP): lihat & hapus memori per brand/industri | 🟡 |
| G8 | Responsif HP | 🟡 |

## H. GEO, Google & media sosial — 10 langkah (Stage 12, 16, 17; Vol.7 hal 50–123)
| # | Langkah | Status |
|---|---|---|
| H1 | Halaman produk bisa dibaca Google: URL bersih, judul/deskripsi, canonical | ⬜ |
| H2 | Data terstruktur Product/Offer/Organization/LocalBusiness/FAQ | ⬜ |
| H3 | Sitemap + robots.txt | ⬜ |
| H4 | **Feed Google Merchant** otomatis (free listings) | ⬜ 🔵 akun Merchant Center |
| H5 | ID produk konsisten (KTO-BRAND-000127) + **deep link konsultasi** | ⬜ |
| H6 | **Context Resolver**: konten IG/TikTok → produk → sesi konsultasi berkonteks | ⬜ |
| H7 | 1 tautan bio per brand + pelacakan asal (sumber, konten, produk masuk) | ⬜ |
| H8 | AI pembuat konten: caption & hook per produk untuk IG/TikTok + jadwal posting | ⬜ |
| H9 | Lapisan bukti: identitas bisnis, review asli, FAQ, kebijakan | 🟡 |
| H10 | Skor kesiapan "ditemukan AI" per produk di ERP | ⬜ |

## I. Data & fondasi perusahaan rating — 5 langkah (Stage 18)
| # | Langkah | Status |
|---|---|---|
| I1 | Funnel: kunjungan → konsultasi → rekomendasi → keranjang | 🟡 |
| I2 | Insight need, wants, daya beli per segmen (anonim, ber-izin) | 🟡 |
| I3 | Alasan tidak membeli (dari chat & penjualan hilang) | 🟡 |
| I4 | Umpan ke Second Brain / Kantoong Index | 🟡 |
| I5 | Dashboard validasi PMF untuk dosen/investor | ⬜ |

## J. Keamanan & akun — 4 langkah
| # | Langkah | Status |
|---|---|---|
| J1 | CAPTCHA (Cloudflare Turnstile) di login | ⬜ 🔵 akun Cloudflare |
| J2 | MFA untuk owner & manajer | ⬜ |
| J3 | Tes isolasi data antar brand (multi-tenant) | 🟡 |
| J4 | Keamanan berlapis L1–L10 | ✅ |

## K. AR — 3 langkah
| # | Langkah | Status |
|---|---|---|
| K1 | Lihat produk 3D & AR di HP (untuk produk yang punya model 3D) | ⬜ 🔵 model 3D |
| K2 | "Coba di kamu" sederhana via kamera (prototipe) | ⬜ |
| K3 | Sambungan ke Studio Digital Twin CHRONOS (foto → 3D kasar) | 🟡 di Anachronos |

## L. Presentasi & pameran — 7 langkah
| # | Langkah | Status |
|---|---|---|
| L1 | Data demo kaya & konsisten (2 brand fashion + 1 kafe) | 🟡 |
| L2 | Naskah demo per peran: konsumen → owner → kasir → agen AI | ⬜ |
| L3 | Mode pameran (kios): layar sambutan, reset data otomatis | ⬜ |
| L4 | Cadangan bila internet pameran mati (demo offline + video) | ⬜ |
| L5 | Slide pitch: Zero to One, MOAT, GEO, Kantoong Index | ⬜ |
| L6 | Gladi penuh + perbaikan bug | ⬜ |
| L7 | Kunci fitur (tidak ada fitur baru setelah 26 Nov) | ⬜ |

---

## Yang perlu Koko siapkan (jalur 🔵)
1. Redirect URL reset password di Supabase.
2. Aset 2 brand demo (logo, foto produk, harga, deskripsi).
3. Kunci API minimal 1 merek LLM selain Gemini (untuk demo multi-LLM).
4. Akun Google Merchant Center (persetujuan bisa butuh beberapa hari, mulai secepatnya).
5. Akun Cloudflare (CAPTCHA) & layanan email + domain (untuk email asli).
6. Model 3D produk bila ingin demo AR sungguhan.

## Batasan jujur
- **Google & media sosial**: kita bisa membuat data & konten yang sangat siap ditemukan, tetapi
  tidak ada yang bisa *memaksa* Google atau algoritma IG/TikTok menampilkannya. Tayang di Google
  Shopping bergantung persetujuan Merchant Center; integrasi API Meta/TikTok butuh review aplikasi.
- **"AI membaca pikiran"**: terasa begitu karena memori & prediksi — wajib ber-izin, transparan
  (menyebut sumber), dan bisa dihapus (UU PDP). Data untuk perusahaan rating hanya anonim & agregat.
- **Waktu**: 98 langkah dalam 18 hari sangat padat. Langkah bertanda 🔵 bergantung pihak luar;
  bila terlambat, versi demo tetap jalan dengan label jelas.

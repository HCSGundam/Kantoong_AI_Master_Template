# Struktur Keamanan Berlapis — Kantoong AI (Anachronos Indonesia)

> Prinsip: **tidak ada satu kunci yang menjaga semuanya.** Penyerang (manusia, bot, atau AI)
> harus menembus banyak lapisan berbeda sekaligus. Setiap lapisan dirancang dengan asumsi
> lapisan sebelumnya *sudah* jebol (*defense in depth*, *zero trust*).

Terakhir diperbarui: 4 November 2026.

---

## 1. Peta lapisan

```
Pengunjung / Staf / Bot / AI penyerang
        │
 L0  Tepi jaringan (CDN + WAF + anti-bot)        ← disarankan saat produksi (Cloudflare)
 L1  Browser: CSP, versi library terkunci, tanpa kunci rahasia
 L2  Gerbang backend: CORS, penyaring bot, pembatas kecepatan, anggaran AI
 L3  Penjaga AI: anti prompt-injection, aksi terbatas, AI tidak bisa membayar
 L4  Identitas: Supabase Auth, email terverifikasi, ERP minta password ulang, kunci 30 menit
 L5  Izin database: RLS per baris, izin per kolom, fungsi tertutup untuk API
 L6  Integritas bisnis: harga dihitung server, PIN atasan, shift buta, void tercatat
 L7  Anti bot di database: pembatas pesanan/ulasan/event AI per sidik pengunjung
 L8  Jejak tak terhapus + deteksi: audit append-only, skor integritas, rekonsiliasi
 L9  Privasi (UU PDP): izin terpisah, data minimal, nomor tersamar, hak hapus
 L10 Pemulihan: cadangan harian, rotasi kunci, rencana insiden
        │
      Data Koko
```

---

## 2. Ancaman & lapisan yang menghadangnya

| Ancaman | Pelaku umum | Lapisan penghadang |
|---|---|---|
| Menebak password login | manusia, bot | L0, L4 (rate limit Supabase Auth, CAPTCHA, MFA owner) |
| Menebak PIN atasan kasir | kasir nakal, skrip | L6 bcrypt + **kunci 15 menit setelah 5× salah** (tercatat walau transaksi gagal) |
| Membaca data perusahaan lewat API | siapa pun | L5 RLS (sudah dites: tabel sensitif 0 baris untuk tamu) |
| Mencuri **harga modal** untuk banting harga | kompetitor, bot pengintai | L5 izin per kolom: `cost_price` hanya lewat `erp_product_costs()` |
| Menyedot daftar nomor HP pelanggan | staf nakal, bot dengan sesi curian | L5 nomor tersamar + L7 pencarian member maks 120 / 10 menit |
| **Menguras tagihan API AI** (ribuan chat otomatis) | bot, AI agent | L2: tolak alat otomatis, 12 chat/menit & 300/hari per alamat, **anggaran global 3.000/hari**, jawaban maks 700 token |
| **Prompt injection** ("abaikan instruksimu…") | manusia, AI lain | L3: teks dibersihkan, upaya ditandai & AI diperingatkan, keluaran dibatasi skema JSON, aksi hanya `show-catalog`/`show-products` |
| AI dibajak menyebar link phishing / bocor kunci | AI lain, penyerang | L3: tautan asing, kunci, HTML & nomor kartu disaring dari jawaban; frontend menampilkan sebagai teks |
| AI disuruh membayar / memesan | penyerang | L3: AI **tidak punya** fungsi bayar; pembayaran selalu oleh pengguna |
| **Meracuni data AI** (event palsu → Dapur Prediktif salah) | bot | L7 event AI dibuang diam-diam bila banjir; minat dihitung per **sesi unik** |
| Pesanan / ulasan palsu massal | bot | L7 maks 8 pesanan / 10 menit, 3 ulasan / jam per sidik pengunjung |
| Menyisipkan skrip ke halaman (XSS) | penyerang | L1 CSP melarang skrip tertanam & koneksi ke situs asing (**sudah diuji: diblokir**); data selalu `textContent` |
| Paket library disusupi (*supply chain*) | penyerang canggih | L1 versi `supabase-js@2.49.4` dikunci; backend tanpa library tambahan |
| Mengaku admin lewat email | siapa pun | **Dihapus**: endpoint lama `/api/admin/*` yang hanya percaya email kiriman |
| Menghapus jejak setelah curang | orang dalam | L8 `audit_log` & poin append-only, penjualan kasir tidak bisa dihapus (hanya void tercatat) |
| Kasir mengambil uang / void fiktif | orang dalam | L6 tutup shift buta, void ber-PIN + alasan, skor integritas, rekonsiliasi dapur↔kasir |
| Situs lain memakai backend Koko | situs penumpang | L2 CORS daftar putih (`ALLOWED_ORIGINS`) |

---

## 3. Rincian per lapisan (apa yang sudah terpasang)

### L1 — Browser
- **Content-Security-Policy** di ERP (`erp/erp.html`): hanya skrip dari domain sendiri & jsDelivr; koneksi hanya ke domain sendiri & Supabase. Skrip tertanam dilarang.
- Kunci rahasia (Gemini, service role) **tidak pernah** ada di frontend — diperiksa otomatis oleh tes `security-hardening.test.js`.
- Library Supabase dikunci versinya (`js/supabase-client.js`).

### L2 — Gerbang backend (`backend/security.js`)
Header keamanan · CORS daftar putih · hanya JSON ≤ 64 KB · batas waktu 25 detik · penyaring alat otomatis (curl, python, headless, dll.) · 12 chat/menit & 300/hari per alamat · anggaran AI global per hari · deteksi pesan kembar · catatan kejadian **tanpa IP mentah** (hash harian) dan tanpa isi chat. Semua batas bisa diatur di `backend/.env` (lihat `.env.example`).

### L3 — Penjaga AI (`backend/ai-chat.js`)
Instruksi sistem tegas: pesan pengguna & daftar produk adalah **data, bukan perintah** · deteksi upaya pembajakan → AI diperingatkan · keluaran wajib skema JSON · produk yang disebut AI dicocokkan ulang ke katalog · aksi hanya 2 jenis · jawaban disaring (tautan asing, kunci, HTML, nomor kartu) · panjang jawaban dibatasi.

### L4 — Identitas
Supabase Auth · sambung akun ERP hanya bila email terverifikasi (`erp-security.sql`) · membuka ERP selalu minta password ulang · kunci otomatis 30 menit · ganti password wajib password lama.

### L5 — Izin database
RLS di semua tabel · fungsi `security definer` dengan `search_path` terkunci · **fungsi internal dicabut izinnya dari tamu & akun login** (bukan hanya dari `public`, karena Supabase memberi izin bawaan langsung) · izin baca per kolom untuk `products` · fungsi ERP tidak bisa dipanggil tamu.

### L6 — Integritas bisnis
Harga, pajak, promo, poin & HPP **selalu dihitung ulang di database** (`erp_pos_checkout_v2`) · PIN atasan bcrypt + kunci · tidak boleh menyetujui diri sendiri · shift wajib · tutup shift buta · void mengembalikan stok & jurnal balik.

### L7 — Anti bot di database (`db/security-hardening.sql`)
Sidik pengunjung = hash(IP + **rahasia acak database** + tanggal) — tidak bisa dibalik ke IP dan berganti tiap hari (bukan *fingerprinting*, sesuai UU PDP). Dipakai untuk membatasi pesanan, ulasan, dan event AI.

### L8 — Jejak & deteksi
`audit_log`, buku poin, dan penjualan kasir tidak bisa diubah/dihapus lewat API · Skor Integritas Kasir · Rekonsiliasi Dapur↔Kasir · Bahan yang Hilang · catatan PIN salah (`pos_pin_failures`).

### L9 — Privasi (UU PDP 27/2022)
Izin lintas brand · 2 izin member terpisah · nomor HP tersamar · hak hapus data · event AI anonim (tanpa nama/HP/isi chat) · hapus otomatis event 90 hari.

---

## 4. Yang HARUS Koko lakukan (tidak bisa dilakukan dari kode)

### 4a. Jalankan SQL di Supabase › SQL Editor (urutan penting)
Hasil pengecekan langsung ke Supabase Koko (4 Nov 2026):

| File | Status |
|---|---|
| erp-foundation, erp-phase2, erp-phase3, erp-phase4, owner-and-pin, assistant-memory | ✅ sudah |
| `db/sales-and-reviews.sql` | ❌ **belum** |
| `db/erp-pos-pro.sql` (Kasir POS Pro 1–6 + keamanan bagian 13) | ❌ **belum** |
| `db/security-hardening.sql` (file baru, **paling akhir**) | ❌ **belum** |

Urutan: `sales-and-reviews.sql` → `erp-pos-pro.sql` → `security-hardening.sql`.

### 4b. Pengaturan Supabase Dashboard
1. **Authentication › URL Configuration › Redirect URLs**: tambahkan `http://127.0.0.1:5173/auth/reset-password.html` (dan domain produksi nanti).
2. **Authentication › Attack Protection**: nyalakan **CAPTCHA (Cloudflare Turnstile)** dan **Leaked password protection**.
3. **Authentication › Rate Limits**: pastikan batas login/daftar/OTP aktif (bawaan Supabase).
4. **MFA** untuk akun owner & manajer.
5. **Database › Backups**: aktifkan *Point in Time Recovery* bila paket memungkinkan.
6. Jangan pernah membagikan **secret key / service role key**. Bila pernah bocor: *rotate* di Project Settings › API.

### 4c. Saat produksi (online)
1. Taruh web & backend di belakang **Cloudflare** (WAF, Bot Fight Mode, DDoS) → lapisan L0.
2. `backend/.env`: isi `ALLOWED_ORIGINS` dengan domain asli, `TRUST_PROXY=1`, `LOG_SALT` teks acak panjang, `HOST=0.0.0.0` hanya di belakang proxy.
3. HTTPS wajib + header HSTS di server web.
4. Saklar `erp_demo` di `client-config.js` **WAJIB `false`** untuk web klien.

---

## 5. Bila terjadi insiden
1. **Kunci**: matikan akun yang dicurigai (ERP › Organisasi & Akses), rotasi kunci API Supabase & Gemini.
2. **Lihat jejak**: `audit_log`, `pos_pin_failures`, Kontrol Kasir, log `[keamanan]` di backend.
3. **Pulihkan**: dari cadangan Supabase.
4. **Lapor**: kebocoran data pribadi wajib diberitahukan ke pemilik data & lembaga pengawas dalam 3×24 jam (UU PDP Pasal 46).

---

## 6. Pengujian otomatis
- `test/backend-security.test.js` — server sungguhan diserang: bot, situs asing, format palsu, body raksasa, banjir chat, endpoint admin lama.
- `test/security-hardening.test.js` — kunci PIN, anti racun Dapur Prediktif, pemeriksa kode (tidak ada `select *` produk, tidak ada kunci rahasia, versi library terkunci, SQL menutup fungsi internal).
- Jalankan: `npm test`.

# Kantoong AI — Panduan Proyek untuk Claude

## Tentang pemilik proyek
- Pemilik berlatar belakang **bisnis, bukan IT**. Claude berperan sebagai asisten IT-nya.
- Selalu jawab dalam **Bahasa Indonesia** yang santai dan mudah dipahami. Jelaskan istilah teknis dengan bahasa bisnis.
- Sebelum perubahan besar, jelaskan dulu rencananya secara singkat. Setelah selesai, jelaskan apa yang berubah dan cara mengeceknya di browser.

## Perusahaan & brand
- Perusahaan: **Anachronos Indonesia**. Brand produk: **Kantoong AI**.
- Nama lama "ABPi Mall" / "Kantong AI" di dokumen lama sudah **tidak dipakai**.
- Target: demo dalam 1 bulan (mulai 2 November 2026) untuk dosen kampus, bos, dan partner bos.

## Konsep produk (SaaS untuk brand)
Dari depan terlihat seperti **e-commerce/marketplace biasa**, tapi di belakangnya ada AI yang menghubungkan semua brand.

1. **Storefront per brand**: katalog produk bergaya marketplace (unggulan, trending, best seller, paling banyak di-checkout, paling banyak di-wishlist). Fokusnya UI/UX bagian depan.
2. **AI Agent konsultasi (netral, lintas brand)**: chat yang bisa mengecil menjadi **orb** dan mendampingi user di semua halaman. Input berupa teks, suara, foto/selfie, dan video.
   - AI bisa **mengendalikan web**: buka katalog, scroll, filter, buka produk, masukkan ke keranjang, sampai halaman checkout. Perintah "stop" langsung menghentikannya.
   - **Pembayaran selalu dilakukan user sendiri**. AI dilarang membayar.
   - AI menyapa duluan secara personal berdasarkan preferensi dari brand lain (contoh: suka baju hitam elegan di Brand A → menawarkan sepatu hitam di Brand B).
3. **Memori permanen** di **PostgreSQL (Supabase)**: riwayat belanja, konsultasi, dan ringkasan isi upload disimpan sebagai **teks**. File upload dihapus otomatis setelah **30 hari**.
4. **Satu identitas lintas brand (Kantoong ID)**: web brand memakai nama/subdomain Kantoong sehingga user anonim tetap dikenali lintas brand.
5. **Dashboard admin bergaya ERP**: owner mengatur akses per **email + divisi + jabatan**. Setiap orang hanya melihat dashboard miliknya, tapi datanya saling terhubung.
6. **Kasir POS** untuk toko offline/F&B; transaksinya masuk ke data dan memori yang sama.
7. **AI Research customer behavior**: analisis need, wants, dan behavior dari web dan chat.
8. **Billing brand**: fitur AI bisa dinyalakan/dimatikan per brand, dengan model bayar per pemakaian (pay-as-you-go).
9. **Second Brain** untuk owner: visual graf 3D biru (brand, user, dan agent sebagai jaringan hidup) beserta panel aktivitas agent.

## Aturan privasi & hukum (wajib, UU PDP 27/2022)
- Berbagi profil lintas brand **wajib dengan persetujuan (consent)** user.
- Saat AI memakai preferensi dari brand lain, AI menyebut sumbernya secara halus (misalnya "karena kamu suka koleksi hitam di jaringan Kantoong...").
- User bisa meminta AI **menghapus memori secara selektif**: per brand (misalnya hapus Puma tapi simpan Nike), per industri (semua brand sepatu), atau semuanya.
- Memori dienkripsi dan dibatasi aksesnya untuk staf, tapi user tetap berhak melihat dan menghapus datanya sendiri.
- Jangan memakai fingerprinting untuk melacak user.
- Jangan pernah menaruh kunci rahasia (API key AI, service role key) di kode frontend. Taruh di backend / environment variable.

## Prioritas MVP 1 bulan
1. ⭐ Storefront + 2 brand demo (Baju & Sepatu)
2. ⭐ AI orb/chat yang bisa mengendalikan web sampai checkout
3. ⭐ Memori lintas brand (skenario baju hitam → sepatu hitam)
4. ✅ Dashboard admin dengan akses per email/divisi/jabatan (versi ringkas)
5. ✅ Kasir POS dasar
6. ✅ Second Brain graf biru
7. ⏳ Nanti / cukup mockup: ERP penuh, suara, video, billing PAYG asli, payment gateway asli

## Struktur kode saat ini
- `frontend/`: web (HTML/CSS/JavaScript biasa, dibangun dengan **Vite**)
  - `index.html` + `js/engine.js`: storefront/homepage
  - `js/ai-brain.js`, `js/chat-sheet.js`, `js/agent-state.js`: AI chat (Gemini lewat backend, cadangan jawaban lokal).
  - `js/kantoong-assistant.js`: **asisten universal**. Satu baris script memasang chat yang sama di halaman mana pun (toko, ERP, brand lain). Markup tunggal di `js/assistant-markup.js`, konteks & izin memori di `js/assistant-context.js`. Jangan menyalin markup chat ke HTML.
  - Memori asisten: lintas brand HANYA bila user memilih "Ingat di semua toko" (UU PDP). Login + izin → disinkron ke `db/assistant-memory.sql` (teks saja, RLS milik sendiri). Menu + › "Hapus memori asisten"
  - Di atas keranjang/dashboard user chat mengecil jadi orb (`kantoong:overlay`); di ERP mulai sebagai orb
  - Kartu produk di chat (`js/chat-product-gestures.js`): ketuk = pop-up produk (TIDAK mengirim pesan), tarik ke atas = lampirkan ke kotak ketik (Tanya AI), tarik ke bawah = keranjang (hanya di toko)
  - Riwayat Chat AI (`js/assistant-history.js`): tombol kisi di bar judul → kartu per sesi (pratinjau mini + produk, jam, judul, tanggal). Kartu redup; hidup (menyala, membesar, isi bergulir) saat di-hover (desktop) / di tengah saat digulir (HP). Data: arsip lokal dari "Chat baru" (30 hari, maks 30 sesi), `openArchived` di ai-brain. Belum disinkron ke server
  - Desktop (≥900px): chat terbuka menempel di samping, halaman menyempit (`js/assistant-dock.js`). Mode melayang (mode awal, tarik naik setengah/penuh seperti HP)/samping/belah, sisi kiri/kanan, tombol X (desktop) = kembali ke "Halo Kak" (lempar kotak "Halo Kak"), tepi bisa ditarik. "Panggung": kartu produk di chat disorot → kartu sama di halaman menyala (`kantoong:stage-focus`). Kartu produk TETAP disimpan di chat (untuk riwayat)
  - `client-config.js`: identitas dan skin per brand (`business_id`, nama, warna)
  - `cart/`: keranjang dan order (`order.sql`)
  - `auth/`: login (satu pintu login web)
  - `dashboard-admin/`: hanya pengalih ke ERP. Editor produk lama sudah pindah ke ERP › Katalog Master (`erp/modules/product-editor.js`)
  - Membuka ERP selalu minta password lagi + kunci otomatis 30 menit (`erp/core/erp-lock.js`). Mode demo hanya lewat `erp/erp.html?demo=1`. Tombol ERP di Profil hanya untuk anggota (`members`)
  - `db/erp-phase3.sql`: ERP Fase 3 (supplier & PO, alur kirim pesanan + resi, tiket CS & retur, voucher di checkout, CRM dengan izin pemasaran UU PDP)
  - `db/erp-phase4.sql`: ERP Fase 4A (tabel `ai_events` anonim + `log_ai_events()`; baca HANYA owner level 5; hapus otomatis 90 hari). Menu ERP "Second Brain" (`erp/modules/brain.js` + kanvas `brain-neuron.js`): 1 brand = 1 neuron berdenyut, klik = panel ringkas. Hanya brand sendiri; peta banyak neuron hanya di web terpisah Anachronos Digital Mall. Hitungan di `erp/core/research.js`. Toko mencatat lewat `js/ai-telemetry.js`: tanpa nama/HP/email/isi chat, kata kunci hanya kata katalog/kebutuhan. Fase 4B (Produksi) belum
  - `db/erp-security.sql`: sambung akun hanya bila email terverifikasi; produk/foto bisa dikelola dari ERP
  - `dashboard-user/`: dashboard user (sistem fitur modular, intent menu, navigation memory)
  - `db/owner-and-pin.sql`: SQL owner/PIN
  - `db/erp-foundation.sql`: ERP Fase 1 (organisasi, anggota, target/komisi, gaji, toko per sales, approval, audit, leaderboard, RLS)
  - `db/erp-phase2.sql`: ERP Fase 2 (gudang & stok, kasir POS, jurnal akuntansi, absensi jam-server, payroll). Stok/jurnal/kasir hanya lewat fungsi database
  - `erp/`: aplikasi ERP (`erp.html`). `core/` = aturan akses & hitungan (murni, dites), `data/` = adapter Supabase + mode demo, `modules/` = satu file per dashboard
  - `js/sales-store.js`: toko per sales (`/nama-sales`, nanti `nama-sales.kantoong.id`) + atribusi pesanan 30 hari
  - `js/supabase-client.js`: koneksi Supabase (hanya memakai publishable key)
- **Anachronos Digital Mall** (web internal owner, Second Brain 3D) ada di proyek TERPISAH `C:\Anachronos_Digital_Mall` (Vite + three.js, port 5180). Jangan dibuat di dalam Kantoong
- `backend/server.js` + `backend/ai-chat.js`: Express port 5000, `/api/chat` ke Gemini (kunci di backend/.env). Prompt memakai konteks halaman, brand, nama user, izin memori
- `test/`: tes otomatis (Vitest)
- `dist/`: hasil build. Jangan diedit manual.

## Perintah penting
- `npm run dev`: jalankan web di http://127.0.0.1:5173
- `npm run build`: build ke folder `dist/`
- `npm test`: jalankan tes
- `cd backend && npm start`: jalankan backend di port 5000

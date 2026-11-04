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
  - Di atas keranjang/dashboard user chat mengecil jadi orb (`kantoong:overlay`)
  - ERP & kasir: chat SELALU mulai sebagai orb bulat bermata (`startMinimized: true`, bawaan kiri bawah); ketuk orb = kotak "Halo Kak". Chat mode BEBAS (`dock: false` di `KantoongAssistantContext`, `html[data-kc-free]`): pil "Halo Kak" di bawah, digeser kiri/kanan saja (posisi disimpan `kantoong:assistant-free-x`), dibuka naik seperti HP (setengah/penuh). TIDAK pernah menempel di samping & halaman tidak menyempit. Notifikasi ERP pindah ke atas
  - Kartu produk di chat (`js/chat-product-gestures.js`): ketuk = pop-up produk (TIDAK mengirim pesan), tarik ke atas = lampirkan ke kotak ketik (Tanya AI), tarik ke bawah = keranjang (hanya di toko)
  - Riwayat Chat AI (`js/assistant-history.js`): tombol kisi di bar judul → kartu per sesi (pratinjau mini + produk, jam, judul, tanggal). Kartu redup; hidup (menyala, membesar, isi bergulir) saat di-hover (desktop) / di tengah saat digulir (HP). Data: arsip lokal dari "Chat baru" (30 hari, maks 30 sesi), `openArchived` di ai-brain. Belum disinkron ke server
  - Desktop (≥900px): chat terbuka menempel di samping, halaman menyempit (`js/assistant-dock.js`). Mode melayang (mode awal, tarik naik setengah/penuh seperti HP)/samping/belah, sisi kiri/kanan, tombol X (desktop) = kembali ke "Halo Kak" (lempar kotak "Halo Kak"), tepi bisa ditarik. "Panggung": kartu produk di chat disorot → kartu sama di halaman menyala (`kantoong:stage-focus`). Kartu produk TETAP disimpan di chat (untuk riwayat)
  - `client-config.js`: identitas dan skin per brand (`business_id`, nama, warna)
  - `cart/`: keranjang dan order (`order.sql`)
  - `auth/`: login (satu pintu login web). Lupa password = link email ke `auth/reset-password.html` (WAJIB terdaftar di Supabase › Authentication › URL Configuration › Redirect URLs); ganti password di Profil (wajib password lama). Aturan di `auth/password-rules.js`
  - `dashboard-admin/`: hanya pengalih ke ERP. Editor produk lama sudah pindah ke ERP › Katalog Master (`erp/modules/product-editor.js`)
  - Membuka ERP selalu minta password lagi + kunci otomatis 30 menit (`erp/core/erp-lock.js`). Mode demo (data contoh, untuk presentasi) diatur saklar `erp_demo` di `client-config.js`: `true` di template master (panel demo selalu tampil di login ERP + tombol "Coba Demo ERP" di Profil), WAJIB `false` untuk web klien. Tombol ERP di Profil hanya untuk anggota (`members`)
  - `db/erp-phase3.sql`: ERP Fase 3 (supplier & PO, alur kirim pesanan + resi, tiket CS & retur, voucher di checkout, CRM dengan izin pemasaran UU PDP)
  - `db/erp-phase4.sql`: ERP Fase 4A (tabel `ai_events` anonim + `log_ai_events()`; baca HANYA owner level 5; hapus otomatis 90 hari). Menu ERP "Second Brain" (`erp/modules/brain.js` + kanvas `brain-neuron.js`): 1 brand = 1 neuron berdenyut, klik = panel ringkas. Hanya brand sendiri; peta banyak neuron hanya di web terpisah Anachronos Digital Mall. Hitungan di `erp/core/research.js`. Toko mencatat lewat `js/ai-telemetry.js`: tanpa nama/HP/email/isi chat, kata kunci hanya kata katalog/kebutuhan. Fase 4B (Produksi) belum
  - Kasir POS Pro (Tahap 1 dari 6): `erp/modules/pos.js` + hitungan `erp/core/pos-pro.js` (dites) + `db/erp-pos-pro.sql` (`erp_pos_checkout_v2`, rumus SAMA dengan pos-pro.js). Tipe pesanan/channel (harga ojol +markup), meja & nama, varian/topping (`pos_modifier_groups`), catatan, service (dine-in) & PB1, pembulatan, bayar campuran, bill terbuka, struk thermal 58/80 + cetak ulang. Tahap 2 (selesai): menu ERP "Dapur & Bar" (`erp/modules/kitchen.js`, hitungan `erp/core/kitchen.js`, dites) — tiket otomatis bar/dapur dari bill & bayar (kirim tambahan saja), nomor antrian harian, peran baru `dapur` (persona Barista), layar antrian TV `#/kitchen/antrian`. Lapisan UVP (prinsip Zero to One, lihat memori): ETA Jujur (belajar waktu pembuatan nyata, dicetak di struk), Dapur Prediktif (pola jam + minat chat AI anonim), Penjualan yang Hilang (menu habis & alasan batal 1 ketukan). Tahap 3 (selesai, kontrol uang): jualan wajib shift aktif, kas masuk/keluar beralasan, tutup shift BUTA + laporan Z, void & diskon besar wajib PIN atasan (bcrypt di `pos_pins`, tidak boleh menyetujui diri sendiri kecuali owner/manajer), stok kembali + jurnal balik. Menu "Kontrol Kasir" (`erp/modules/cashcontrol.js`, hitungan `erp/core/cash-control.js`, dites): Rekonsiliasi Dapur ↔ Kasir (pesanan dibuat tapi tak dibayar), Skor Integritas Kasir, riwayat shift & void. PIN atasan demo = 1234. Tahap 4 (selesai, pelanggan & promo): member di kasir cukup nama + HP dengan 2 izin terpisah (simpan riwayat & poin WAJIB / promo WhatsApp opsional), "Hapus data saya" (UU PDP), nomor HP tersamar untuk kasir (lengkap hanya yang izin promo). "Kasir yang Ingat" (sapaan + pesanan favorit lengkap varian, 1 ketukan). Poin: buku besar `pos_points` dengan `business_id` (siap lintas brand), tukar langsung di kasir, void membalik poin. Promo otomatis jam hemat & paket hemat (tidak untuk ojol). Urutan potongan: promo -> diskon manual -> poin -> service -> PB1 -> pembulatan. Hitungan `erp/core/promo.js` + `erp/core/loyalty.js` (dites), SQL bagian 9 di `db/erp-pos-pro.sql` (rumus sama di checkout_v2). Menu "Promo & Member" (`erp/modules/promos.js`): Promo yang membuktikan dirinya sendiri (untung/impas/boncos/"belum terbukti" bila jarang dipakai), saran promo dari data (jam sepi, stok lambat laku), Radar pelanggan menghilang. Data demo: `erp/data/demo-seed-loyalty.js`. Metode adapter member staf = `listMembers`, member pelanggan = `listPosMembers` (jangan ditukar). Tahap 5 (selesai, resep & HPP): bahan baku per outlet (`pos_ingredients` + stok), resep menu + resep varian (boleh minus, mis. less sugar). Menu ber-resep TIDAK memakai stok barang jadi: bahan dipotong saat bayar (tidak memblokir; stok minus = perlu hitung ulang), HPP di struk (`cogs`) & jurnal (5-1000 / 1-1310), void mengembalikan bahan. Kasir: "Bisa N porsi" + HABIS OTOMATIS bila satu bahan habis (kasir tidak melihat harga modal). Menu "Resep & HPP" (`erp/modules/recipes.js`, hitungan `erp/core/recipe.js`, dites): peringatan belanja (habis dalam X hari), Bahan yang Hilang (selisih hitung stok + bahan dibuang, akun 5-1100), hitung stok BUTA, "Harga ojol aman?" (komisi vs markup), HPP & kelas menu (bintang/kuda kerja/teka-teki/beban) + saran harga. Tombol "Bahan dibuang" juga di Dapur & Bar. Laporan promo kini menampilkan laba kotor setelah HPP. SQL bagian 10. Data demo: `erp/data/demo-seed-recipe.js`. Tahap 6 (selesai, POS Pro lengkap): split bill per item (struk sendiri-sendiri, sisa tetap di meja/bill) & bagi rata N orang (`erp/core/pos-split.js`). MODE OFFLINE: transaksi diantrikan di localStorage (`kantoong:pos-offline-queue`, nomor OFF-…), disinkron otomatis saat online dengan jam aslinya (`offline_at`, maks 48 jam; promo mengikuti jam itu); yang ditolak server ditandai, bukan dibuang; tutup shift diblokir selama antrian ada; diskon ber-PIN & tukar poin tidak bisa offline; mode demo punya tombol "Simulasi offline". LAYAR PELANGGAN `#/pos/layar` (`erp/modules/customer-display.js`, BroadcastChannel, hanya membaca; rating 😀😐☹️ disimpan oleh jendela kasir — jangan biarkan tab kedua menulis data demo karena tiap tab punya salinan db). Menu "Laporan Kasir" (`erp/modules/posreport.js`, hitungan `erp/core/pos-report.js`, dites): ringkasan bercerita, pembanding hari yang sama minggu lalu sampai jam yang sama, per jam/menu/channel/metode bayar/kasir/pajak, kepuasan, ekspor CSV (titik koma + BOM untuk Excel). SQL bagian 11. Belum: service worker (halaman harus sudah terbuka sebelum internet mati), layar pelanggan beda perangkat (butuh realtime server). Kartu menu kasir "Etalase Malam": HABIS = kartu gelap bergaris emas + "— HABIS —" (font Cormorant Garamond, kilau emas pelan) + "N pelanggan menunggu" + status restok; MENIPIS = cincin amber berdenyut + "Sisa N" + "± habis jam" (`sellOutAt` di recipe.js). Ketuk menu habis = lembar gelap (TIDAK masuk pesanan, pengganti bergambar, "Minta restok ke gudang"). Permintaan restok (`pos_restock` demo / `pos_restock_requests` SQL bagian 12) tampil di Resep & HPP, selesai otomatis saat belanja bahannya dicatat. Tombol + keranjang mati di batas porsi
  - `db/erp-security.sql`: sambung akun hanya bila email terverifikasi; produk/foto bisa dikelola dari ERP
  - `dashboard-user/`: dashboard user (sistem fitur modular, intent menu, navigation memory)
  - `db/owner-and-pin.sql`: SQL owner/PIN
  - `db/erp-foundation.sql`: ERP Fase 1 (organisasi, anggota, target/komisi, gaji, toko per sales, approval, audit, leaderboard, RLS)
  - `db/erp-phase2.sql`: ERP Fase 2 (gudang & stok, kasir POS, jurnal akuntansi, absensi jam-server, payroll). Stok/jurnal/kasir hanya lewat fungsi database
  - Desain ERP "Atelier" (blok paling bawah `erp/erp.css`): kertas gading + tinta pekat, judul serif Cormorant Garamond, UI Inter, garis rambut, bayangan berlapis, angka tabular. Untuk klien cukup ganti token `:root` di blok Atelier. Kasir POS: panel pesanan terkunci di kanan (`.erp-pos-panel`), strip "Pesanan berjalan", kategori berfoto, kartu menu dengan − qty +, angka ringkas di bawah menu
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

# Web online lewat Cloudflare Pages

Link utama tetap `https://kantoong-kenzo-ai.pages.dev` dan selalu menampilkan versi terbaru.
Setiap publish juga membuat link arsip per versi (`abc123.kantoong-kenzo-ai.pages.dev`) — boleh diabaikan.

- Tampilan web = folder `dist/` (hasil `npm run build`).
- Backend AI (chat + penerjemah) = `functions/api/[[path]].js`, memakai ulang `backend/ai-chat.js`,
  `backend/translate.js`, `backend/security.js`. Di laptop tetap pakai `backend/server.js`.
- Kunci Gemini = SECRET di Cloudflare, tidak pernah ada di kode / browser.
- Paket gratis: 500 publish/bulan, pengunjung tanpa batas, tanpa sistem kredit.

## Sekali saja (dikerjakan Koko)
1. `npx wrangler login` → browser terbuka → daftar/masuk Cloudflare (gratis) → Allow.
2. `npx wrangler pages project create kantoong-kenzo-ai --production-branch main`
   (bila nama `kantoong` sudah dipakai orang, pakai nama lain dan ganti `name` di `wrangler.toml`).
3. `npx wrangler pages secret put GEMINI_API_KEY --project-name kantoong-kenzo-ai`
   → tempel kunci Gemini dari `backend/.env` sendiri, Enter.
4. Supabase › Authentication › URL Configuration › Redirect URLs: tambahkan
   `https://kantoong-kenzo-ai.pages.dev/**` (agar link lupa password & login Google kembali ke web online).

## Setiap mau publish
- `npm run deploy` (build + unggah langsung dari laptop, TANPA push GitHub).
- Uji dulu "Cloudflare mini" di laptop: `npm run cf:dev` → http://localhost:8788
  (butuh file `.dev.vars` berisi `GEMINI_API_KEY=...`; file ini tidak ikut ke GitHub).

## Catatan
- Pembatas kecepatan & anggaran AI harian tersimpan per mesin Cloudflare (cukup untuk demo).
- Bagikan link hanya ke orang tertentu dulu: setiap chat memakai kuota Gemini Koko.
- Setelah punya domain sendiri, ganti `site_url` di `frontend/client-config.js` (untuk sitemap).

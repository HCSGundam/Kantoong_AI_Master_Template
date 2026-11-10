// Film pameran Kantoong versi panjang: tiap fitur = bab (laptop + HP), plus bab Anachronos ala HUD.
import { writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("C:/Kantoong_AI_Master_Template/package.json");
const QRCode = require("qrcode");

const [,, shotsDir, outDir] = process.argv;
if (existsSync(`${outDir}/ui`)) rmSync(`${outDir}/ui`, { recursive: true, force: true });
mkdirSync(`${outDir}/ui`, { recursive: true });
readdirSync(shotsDir).filter((f) => f.endsWith(".jpg")).forEach((f) => copyFileSync(`${shotsDir}/${f}`, `${outDir}/ui/${f}`));
const qr = await QRCode.toString("https://kantoong-kenzo-ai.pages.dev", { type: "svg", margin: 0, color: { dark: "#0b0a08", light: "#ffffff" } });

const logo = `<svg viewBox="0 0 100 100" class="logo"><rect x="16" y="8" width="20" height="84" fill="#c9a227"/><polygon points="36,52 72,8 92,8 52,52" fill="#e3c46a"/><polygon points="36,52 52,52 92,92 70,92" fill="#9e7b1a"/></svg>`;
const star = (cls = "") => `<svg viewBox="0 0 100 100" class="star ${cls}"><defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4cf"/><stop offset=".45" stop-color="#e3c46a"/><stop offset="1" stop-color="#8a6a12"/></linearGradient></defs><path d="M50 2 C54 34 66 46 98 50 C66 54 54 66 50 98 C46 66 34 54 2 50 C34 46 46 34 50 2Z" fill="url(#sg)"/></svg>`;
const ic = (d) => `<svg viewBox="0 0 48 48"><g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${d}</g></svg>`;
const ICON = {
  toko: ic('<path d="M5 8h6l5 22h22l5-16H13"/><circle cx="19" cy="38" r="3"/><circle cx="35" cy="38" r="3"/>'),
  chat: ic('<path d="M8 10h26a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H20l-8 7v-7H8a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z"/>'),
  pos: ic('<rect x="8" y="6" width="32" height="24" rx="3"/><path d="M16 38h16M24 30v8M14 14h10"/>'),
  erp: ic('<path d="M6 40h36M10 40V28M18 40V22M26 40V26M34 40V16"/>'),
  doc: ic('<path d="M12 5h17l9 9v29H12z"/><path d="M29 5v9h9M18 26h14M18 33h10"/>'),
  box: ic('<path d="M24 5l17 9v20L24 43 7 34V14z"/><path d="M7 14l17 9 17-9M24 23v20"/>'),
  money: ic('<rect x="5" y="12" width="38" height="24" rx="4"/><circle cx="24" cy="24" r="6"/>'),
  agent: ic('<circle cx="24" cy="18" r="9"/><path d="M8 42c2-9 9-13 16-13s14 4 16 13M20 17h.01M28 17h.01"/>'),
  user: ic('<circle cx="24" cy="16" r="8"/><path d="M8 42c2-9 8-13 16-13s14 4 16 13"/>'),
  check: ic('<path d="M10 25l9 9 19-20"/>'),
};

// Bab fitur: [nomor, label, judul (boleh <em>), sub, poin[], gambar[], durasi, flip]
const CHAPTERS = [
  ["01", "TOKO ONLINE", "Toko online <em>brand-mu</em>", "Dari depan terlihat seperti marketplace biasa.", ["Homepage promosi diatur sendiri dari ERP", "Rel terlaris, kupon & kotak hadiah misteri", "Tampil rapi di laptop maupun HP"], ["toko-1", "toko-2", "toko-3", "toko-4"], 13000],
  ["02", "HALAMAN PRODUK", "Produk yang <em>jujur</em>", "Pembeli yakin, bukan dibujuk.", ["Harga coret hanya kalau benar pernah berlaku", "Ruang Ragu & bandingkan produk", "Cocok / kurang cocok untuk siapa"], ["produk", "produk-2"], 10500, true],
  ["03", "KERANJANG", "Keranjang yang <em>ingat alasanmu</em>", "Kenapa barang ini masuk keranjang?", ["Catat alasan per barang, hanya di HP pembeli", "Pengingat halus, bukan spam", "Bayar selalu oleh pembeli sendiri"], ["keranjang"], 9000],
  ["04", "KONSULTASI AI", "Asisten AI yang <em>menemani belanja</em>", "Netral, ramah, menjawab 24 jam.", ["Teks, foto & suara", "Ikut ke semua halaman sebagai orb", "Ingat selera lintas toko — hanya dengan izin"], ["chat", "chat-2"], 11000, true],
  ["05", "DASHBOARD PEMBELI", "Ruang <em>Pribadi</em> pembeli", "26 fitur dalam satu ruang yang bisa diatur sendiri.", ["Pesanan, lacak paket, voucher, poin, wishlist", "Katalog pintar: cari pakai kalimat", "Kartu Diriku: lihat & hapus data kapan saja (UU PDP)"], ["dash", "dash-2", "katalog", "pesanan", "kartu-diriku"], 15000],
  "DIVIDER",
  ["06", "RUANG KOMANDO", "Ruang <em>Komando</em> owner", "Buka pagi, langsung tahu harus apa.", ["3 keputusan paling penting hari ini", "Skor kesehatan bisnis", "Proyeksi kas 30 hari ke depan"], ["erp-komando"], 10000, true],
  ["07", "DASHBOARD ADMIN", "Atur toko <em>tanpa coding</em>", "Dashboard admin bergaya ERP.", ["Etalase & Brand dengan pratinjau langsung", "Katalog Master: produk, harga, stok", "Akses per email, divisi & jabatan"], ["erp-etalase", "erp-katalog"], 11000],
  ["08", "KEUANGAN & GUDANG", "Uang & stok <em>tersambung</em>", "Setiap transaksi langsung masuk pembukuan.", ["Jurnal otomatis, piutang & hutang", "Anggaran & laporan laba rugi", "Stok per gudang + saran belanja"], ["erp-keuangan", "erp-gudang"], 11000, true],
  ["09", "TIM & PELANGGAN", "Tim & pelanggan <em>terurus</em>", "HR dan CRM dalam satu sistem.", ["Absensi jam server, cuti, kinerja", "Pipeline penjualan & alasan kalah", "Persetujuan berjenjang otomatis"], ["erp-hr", "erp-crm"], 11000],
  ["10", "DOKUMEN & AGEN AI", "Dokumen jadi, <em>agen yang siapkan</em>", "Invoice, slip gaji, PO — sekali klik.", ["7 templat PDF / Word / Excel", "QR keaslian di setiap dokumen", "Agen menyiapkan, kamu yang tanda tangan"], ["erp-dokumen", "erp-agen"], 11000, true],
  ["11", "KASIR POS", "Kasir untuk toko & <em>F&B</em>", "Transaksi offline masuk ke memori yang sama.", ["Varian, topping, split bill, bayar campuran", "Tiket dapur & nomor antrean otomatis", "Tetap jalan saat sinyal hilang"], ["kasir", "kasir-2", "dapur"], 12500],
  ["12", "LAPORAN & HPP", "Laporan yang <em>bercerita</em>", "Bukan sekadar angka.", ["Dibanding minggu lalu, jam yang sama", "Resep & HPP per menu + saran harga", "Bahan hilang langsung ketahuan"], ["erp-laporan", "erp-resep"], 11000, true],
  ["13", "RISET PELANGGAN", "Tahu <em>kenapa</em> pembeli tidak jadi beli", "AI membaca kebutuhan, keinginan & perilaku.", ["Corong: lihat → keranjang → beli", "Alasan tidak beli dari chat & kasir", "Second Brain: 1 brand = 1 neuron hidup"], ["erp-analisis", "erp-brain"], 11000],
];

const reel = (cls, names, prefix) => `<div class="reel ${cls}" data-n="${names.length}">${names.map((n) => `<img src="ui/${prefix}${n}.jpg" alt="">`).join("")}</div>`;
const chapter = ([no, label, title, sub, points, imgs, dur, flip]) => `
  <section class="scene" data-d="${dur}">
    <div class="ch ${flip ? "flip" : ""}">
      <div class="ch__text">
        <div class="ch__no in"><span>${no}</span>${label}</div>
        <h2 class="ch__title in" style="animation-delay:.25s">${title}</h2>
        <p class="ch__sub in" style="animation-delay:.5s">${sub}</p>
        <ul>${points.map((p, i) => `<li class="in" style="animation-delay:${1 + i * 0.6}s"><i>${ICON.check}</i>${p}</li>`).join("")}</ul>
      </div>
      <div class="ch__dev">
        <div class="laptop in" style="animation-delay:.2s"><div class="laptop__lid"><div class="laptop__screen">${reel("", imgs, "d-")}</div></div><div class="laptop__base"></div><span class="tag">Mode Desktop</span></div>
        <div class="mphone in" style="animation-delay:.7s"><div class="mphone__screen">${reel("late", imgs, "m-")}</div><span class="tag">Mode HP</span></div>
      </div>
    </div>
  </section>`;
const divider = `
  <section class="scene" data-d="6500">
    <div class="divider">
      <div class="in" style="animation-delay:.2s">Itu yang dilihat <span class="gold">pembeli</span>.</div>
      <div class="in big" style="animation-delay:1.6s">Sekarang… <em>dapur bisnisnya.</em></div>
    </div>
  </section>`;

const hudFrame = (img, side, readouts, title, sub) => `
  <section class="scene ana" data-d="11500">
    <div class="ana__title in">${title}</div>
    <div class="ana__sub in" style="animation-delay:.4s">${sub}</div>
    <div class="holo ${side}">
      <div class="holo__img"><img src="ui/${img}.jpg" alt=""><div class="scan"></div></div>
      <i class="br tl"></i><i class="br tr"></i><i class="br bl"></i><i class="br br2"></i>
    </div>
    <div class="readout ${side === "l" ? "r" : "l"}">${readouts.map((r, i) => `<div class="ro in" style="animation-delay:${1.2 + i * 0.5}s"><small>${r[0]}</small><b>${r[1]}</b></div>`).join("")}</div>
    <div class="ring r1"></div><div class="ring r2"></div>
  </section>`;

const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kantoong AI — Film Pameran</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@1,500&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
:root { --bg:#08080a; --ink:#f6f1e4; --muted:#a9a295; --gold:#e3c46a; --gold2:#c9a227; --deep:#9e7b1a; --cyan:#7fe3ff; }
* { box-sizing:border-box; margin:0; padding:0; }
html,body { width:100%; height:100%; background:#000; overflow:hidden; cursor:none; }
body { font-family:"Poppins","Segoe UI",sans-serif; color:var(--ink); }
#stage { position:absolute; left:50%; top:50%; width:1920px; height:1080px; overflow:hidden; background:var(--bg); transform-origin:center; }
.bgglow { position:absolute; inset:-20%; background:radial-gradient(40% 35% at 50% 110%, rgba(227,196,106,.42), transparent 70%), radial-gradient(30% 30% at 85% 10%, rgba(80,120,255,.16), transparent 70%); animation: drift 18s ease-in-out infinite alternate; }
@keyframes drift { to { transform: translate(-3%, -2%) scale(1.06); } }
.grid { position:absolute; left:-20%; right:-20%; bottom:-10%; height:55%; background-image:linear-gradient(rgba(227,196,106,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(227,196,106,.14) 1px, transparent 1px); background-size:90px 90px; transform: perspective(700px) rotateX(62deg); transform-origin: top; mask-image: linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent); opacity:.55; }
.scene { position:absolute; inset:0; display:grid; place-items:center; opacity:0; visibility:hidden; transition: opacity .9s ease, visibility 0s linear .9s; }
.scene.on { opacity:1; visibility:visible; transition: opacity .9s ease; }
.scene * { animation-play-state: paused; }
.scene.on * { animation-play-state: running; }
.in { opacity:0; animation: fadeUp 1s cubic-bezier(.2,.8,.2,1) forwards; }
@keyframes fadeUp { from { opacity:0; transform: translateY(40px) scale(.98); filter:blur(8px); } to { opacity:1; transform:none; filter:none; } }
@keyframes pop { 0% { opacity:0; transform: scale(.6) rotate(-6deg); } 70% { opacity:1; transform: scale(1.05); } 100% { opacity:1; transform:none; } }
.logo { width:64px; height:64px; }
.brandline { display:flex; align-items:center; gap:18px; font-size:30px; font-weight:600; letter-spacing:.22em; }
.mega { font-size:200px; font-weight:700; letter-spacing:-.04em; line-height:1; background:linear-gradient(100deg,#fff3cc 0%, #e3c46a 45%, #fff 60%, #c9a227 100%); background-size:200% 100%; -webkit-background-clip:text; background-clip:text; color:transparent; animation: fadeUp 1.2s .6s cubic-bezier(.2,.8,.2,1) forwards, sheen 4s 1.8s linear infinite; opacity:0; }
@keyframes sheen { to { background-position:-200% 0; } }
.arc { position:absolute; width:2200px; height:1400px; left:50%; margin-left:-1100px; top:62%; border-radius:50%; border-top:3px solid rgba(227,196,106,.65); box-shadow: 0 -60px 160px -40px rgba(227,196,106,.55) inset, 0 -40px 120px -30px rgba(227,196,106,.4); opacity:0; animation: fadeUp 1.6s forwards; }
.sub { font-size:38px; font-weight:300; color:var(--muted); }
.gold { color:var(--gold); }
em { font-family:"Playfair Display",serif; font-style:italic; font-weight:500; color:var(--gold); }
.title { position:absolute; top:46px; z-index:5; left:0; right:0; text-align:center; font-size:64px; font-weight:600; letter-spacing:-.02em; }
/* tanya */
.ask { position:relative; width:1180px; height:150px; border-radius:99px; background:rgba(14,14,16,.9); border:2px solid rgba(227,196,106,.45); display:flex; align-items:center; padding:0 26px 0 56px; gap:28px; box-shadow:0 0 0 14px rgba(227,196,106,.06), 0 30px 120px -20px rgba(227,196,106,.35); }
.ask .q { flex:1; font-size:46px; font-weight:300; color:#cfc7b6; white-space:nowrap; overflow:hidden; }
.ask .btn { display:flex; align-items:center; gap:16px; padding:24px 44px; border-radius:99px; border:2px solid var(--gold); font-size:42px; font-weight:600; color:var(--ink); transition: background .3s, color .3s; }
.ask .btn svg { width:44px; height:44px; animation:none; filter:none; }
.ask .btn.press { background:var(--gold); color:#14120f; box-shadow:0 0 60px rgba(227,196,106,.7); }
.cursor { position:absolute; width:90px; height:90px; border-radius:50%; border:3px solid rgba(255,244,207,.85); background:rgba(227,196,106,.12); left:1300px; top:700px; transition: left 1.4s cubic-bezier(.6,0,.2,1), top 1.4s cubic-bezier(.6,0,.2,1), transform .2s; }
/* chat */
.chat { width:1240px; display:grid; gap:44px; }
.row { display:grid; grid-template-columns:110px 1fr; gap:36px; align-items:start; }
.av { width:110px; height:110px; border-radius:50%; border:2px solid rgba(227,196,106,.55); display:grid; place-items:center; background:rgba(227,196,106,.08); color:var(--gold); box-shadow:0 0 40px rgba(227,196,106,.25); }
.av svg { width:54px; height:54px; }
.bub { min-height:110px; padding:30px 44px; border-radius:30px; border:2px solid rgba(227,196,106,.5); background:rgba(16,15,13,.85); font-size:46px; line-height:1.35; box-shadow: 0 0 80px -20px rgba(227,196,106,.4); }
.bub.ai { border-color: rgba(227,196,106,.85); }
.dots span { display:inline-block; width:16px; height:16px; border-radius:50%; background:var(--gold); margin-right:12px; animation: blink 1s infinite; }
.dots span:nth-child(2) { animation-delay:.2s } .dots span:nth-child(3) { animation-delay:.4s }
@keyframes blink { 50% { opacity:.25; transform: translateY(-6px); } }
.prodcard { margin-top:22px; display:flex; gap:22px; align-items:center; padding:16px; border-radius:22px; background:rgba(255,255,255,.05); border:1.5px solid rgba(227,196,106,.3); width:max-content; opacity:0; }
.prodcard img { width:150px; height:150px; object-fit:cover; object-position: 50% 30%; border-radius:16px; }
.prodcard b { font-size:36px; } .prodcard small { display:block; font-size:30px; color:var(--gold); }
/* BAB FITUR */
.ch { position:relative; width:1920px; height:1080px; }
.ch__text { position:absolute; left:110px; top:190px; width:600px; }
.ch.flip .ch__text { left:auto; right:100px; }
.ch__no { display:flex; align-items:center; gap:18px; font-size:22px; font-weight:600; letter-spacing:.28em; color:var(--gold); }
.ch__no span { display:grid; place-items:center; width:62px; height:62px; border-radius:50%; border:2px solid var(--gold); font-size:24px; letter-spacing:0; }
.ch__title { margin-top:34px; font-size:72px; line-height:1.06; font-weight:600; letter-spacing:-.03em; }
.ch__sub { margin-top:22px; font-size:30px; font-weight:300; color:var(--muted); }
.ch ul { list-style:none; margin-top:44px; display:grid; gap:22px; }
.ch li { display:grid; grid-template-columns:48px 1fr; gap:18px; align-items:center; font-size:28px; line-height:1.3; }
.ch li i { width:48px; height:48px; border-radius:50%; display:grid; place-items:center; background:rgba(227,196,106,.14); color:var(--gold); }
.ch li i svg { width:26px; height:26px; }
.ch__dev { position:absolute; left:760px; top:120px; width:1100px; height:880px; }
.ch.flip .ch__dev { left:70px; }
.laptop { position:absolute; left:0; top:60px; width:1000px; }
.laptop__lid { padding:18px 18px 22px; border-radius:26px 26px 8px 8px; background:linear-gradient(160deg,#2c2924,#0e0d0b); border:2px solid rgba(227,196,106,.45); box-shadow:0 50px 120px -40px rgba(0,0,0,.9), 0 0 90px -30px rgba(227,196,106,.5); }
.laptop__screen { position:relative; width:962px; height:601px; border-radius:8px; overflow:hidden; background:#f6f1e7; }
.laptop__base { margin:0 -60px; height:26px; border-radius:0 0 30px 30px; background:linear-gradient(#3a362f,#14120f); border:1.5px solid rgba(227,196,106,.35); border-top:none; }
.mphone { position:absolute; right:0; top:200px; width:316px; height:672px; border-radius:48px; padding:12px; background:linear-gradient(145deg,#2a2722,#0d0c0a); border:2px solid rgba(227,196,106,.6); box-shadow:-30px 50px 110px -30px rgba(0,0,0,.95), 0 0 70px -20px rgba(227,196,106,.5); z-index:2; }
.ch.flip .mphone { right:auto; left:780px; }
.ch.flip .mphone .tag { right:auto; left:0; }
.mphone__screen { position:relative; width:100%; height:100%; border-radius:37px; overflow:hidden; background:#f6f1e7; }
.tag { position:absolute; top:-46px; left:0; font-size:20px; font-weight:500; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); }
.mphone .tag { left:auto; right:0; }
.reel { position:absolute; inset:0; }
.reel img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:top; transform: translateY(100%); transition: transform 1.1s cubic-bezier(.7,0,.2,1), opacity 1.1s ease; }
.reel img.cur { transform:none; }
.reel img.past { transform: translateY(-30%); opacity:0; }
.reel img:first-child { transform:none; }
.reel img:first-child.past { transform: translateY(-30%); }
.laptop .reel img.cur { animation: kb 6s ease-out forwards; }
@keyframes kb { from { transform: scale(1); } to { transform: scale(1.045); } }
.divider { display:grid; justify-items:center; gap:30px; text-align:center; font-size:64px; font-weight:300; }
.divider .big { font-size:120px; font-weight:600; letter-spacing:-.035em; }
/* kartu tumpuk */
.stack { display:grid; gap:26px; width:1100px; margin-top:120px; }
.task { display:grid; grid-template-columns:96px 1fr auto; gap:30px; align-items:center; padding:28px 36px; border-radius:30px; background:rgba(20,19,16,.9); border:2px solid rgba(227,196,106,.4); opacity:0; box-shadow:0 30px 80px -40px rgba(0,0,0,.9); }
.task .ti { width:96px; height:96px; border-radius:26px; display:grid; place-items:center; background:rgba(227,196,106,.14); color:var(--gold); }
.task .ti svg { width:48px; height:48px; }
.task b { font-size:42px; font-weight:600; } .task small { display:block; font-size:30px; color:var(--muted); margin-top:4px; }
.task .ok { width:72px; height:72px; border-radius:50%; background:#1d7a4b; color:#eafff2; display:grid; place-items:center; } .task .ok svg { width:40px; height:40px; }
.task.hl { background: linear-gradient(90deg, rgba(227,196,106,.95), rgba(240,214,140,.95)); color:#14120f; border-color:#fff1c4; }
.task.hl small { color:#4a3d16; } .task.hl .ti { background:rgba(20,18,15,.12); color:#14120f; }
/* kisi ikon */
.panel { position:relative; width:1300px; padding:60px 70px 80px; border-radius:44px; border:2.5px solid rgba(227,196,106,.7); background:rgba(12,12,13,.8); box-shadow:0 0 120px -40px rgba(227,196,106,.55); transform: perspective(1600px) rotateX(18deg); margin-top:150px; }
.panel h3 { text-align:center; font-size:44px; font-weight:500; margin-bottom:46px; color:#f3e6bf; }
.tiles { display:grid; grid-template-columns:repeat(4,1fr); gap:34px; }
.tile { display:grid; justify-items:center; gap:16px; padding:34px 10px; border-radius:30px; border:2px solid rgba(255,244,207,.6); background:#111; font-size:28px; font-weight:500; opacity:0; animation: pop .8s forwards; }
.tile svg { width:74px; height:74px; color:var(--gold); }
/* ANACHRONOS HUD */
.ana { background: radial-gradient(60% 60% at 50% 50%, rgba(20,40,90,.55), #02040a 75%); font-family:"JetBrains Mono",monospace; }
.ana__title { position:absolute; top:52px; left:0; right:0; text-align:center; font-family:"Poppins",sans-serif; font-size:58px; font-weight:600; letter-spacing:-.02em; z-index:4; }
.ana__title em { color:var(--cyan); }
.ana__sub { position:absolute; top:136px; left:0; right:0; text-align:center; font-size:22px; letter-spacing:.3em; color:rgba(127,227,255,.75); z-index:4; }
.holo { position:absolute; top:220px; width:1240px; height:698px; perspective:1800px; }
.holo.l { left:90px; } .holo.r { right:90px; }
.holo__img { position:relative; width:100%; height:100%; border:1.5px solid rgba(127,227,255,.6); box-shadow:0 0 80px rgba(127,227,255,.35), inset 0 0 60px rgba(127,227,255,.2); overflow:hidden; transform-origin:center; opacity:0; }
.holo.l .holo__img { animation: holoInL 1.6s .3s cubic-bezier(.2,.8,.2,1) forwards, flick 7s 2s infinite; }
.holo.r .holo__img { animation: holoInR 1.6s .3s cubic-bezier(.2,.8,.2,1) forwards, flick 7s 2s infinite; }
@keyframes holoInL { from { opacity:0; transform: rotateY(35deg) scale(.7); filter: blur(10px) hue-rotate(40deg); } to { opacity:1; transform: rotateY(9deg); filter:none; } }
@keyframes holoInR { from { opacity:0; transform: rotateY(-35deg) scale(.7); filter: blur(10px) hue-rotate(40deg); } to { opacity:1; transform: rotateY(-9deg); filter:none; } }
@keyframes flick { 0%,96%,100% { opacity:1; } 97% { opacity:.6; } 98% { opacity:1; } 99% { opacity:.75; } }
.holo__img img { width:100%; height:100%; object-fit:cover; display:block; animation: kb2 11s ease-out forwards; }
@keyframes kb2 { from { transform: scale(1.02); } to { transform: scale(1.12) translate(-2%, 1%); } }
.scan { position:absolute; inset:0; background: repeating-linear-gradient(0deg, rgba(127,227,255,.07) 0 2px, transparent 2px 5px); mix-blend-mode:screen; }
.scan::after { content:""; position:absolute; left:0; right:0; height:140px; background:linear-gradient(transparent, rgba(127,227,255,.22), transparent); animation: sweep 3.2s linear infinite; }
@keyframes sweep { from { top:-140px; } to { top:100%; } }
.br { position:absolute; width:60px; height:60px; border:3px solid var(--cyan); filter: drop-shadow(0 0 8px var(--cyan)); }
.br.tl { left:-16px; top:-16px; border-right:none; border-bottom:none; } .br.tr { right:-16px; top:-16px; border-left:none; border-bottom:none; }
.br.bl { left:-16px; bottom:-16px; border-right:none; border-top:none; } .br.br2 { right:-16px; bottom:-16px; border-left:none; border-top:none; }
.readout { position:absolute; top:260px; width:420px; display:grid; gap:20px; }
.readout.r { right:100px; } .readout.l { left:100px; }
.ro { padding:18px 22px; border-left:3px solid var(--cyan); background:linear-gradient(90deg, rgba(127,227,255,.12), transparent); }
.ro small { display:block; font-size:16px; letter-spacing:.24em; color:rgba(127,227,255,.75); }
.ro b { display:block; margin-top:6px; font-size:34px; font-weight:600; color:#e8fbff; text-shadow:0 0 18px rgba(127,227,255,.6); }
.ring { position:absolute; border-radius:50%; border:1.5px dashed rgba(127,227,255,.25); pointer-events:none; }
.ring.r1 { width:1500px; height:1500px; left:50%; top:50%; margin:-750px 0 0 -750px; animation: rot 60s linear infinite; }
.ring.r2 { width:1900px; height:1900px; left:50%; top:50%; margin:-950px 0 0 -950px; border-style:dotted; animation: rot 90s linear infinite reverse; }
@keyframes rot { to { transform: rotate(360deg); } }
.hud { position:relative; width:1920px; height:1080px; display:grid; place-items:center; }
.hud canvas { position:absolute; inset:0; }
.hud__rings { position:absolute; left:50%; top:50%; width:0; height:0; }
.hud__rings i { position:absolute; border-radius:50%; border:2px solid rgba(255,179,71,.55); box-shadow:0 0 30px rgba(255,140,40,.35); }
.hud__rings i:nth-child(1) { width:820px; height:820px; left:-410px; top:-410px; border-style:dashed; animation: rot 24s linear infinite; }
.hud__rings i:nth-child(2) { width:940px; height:940px; left:-470px; top:-470px; border-width:6px; border-color: rgba(255,179,71,.7) transparent rgba(255,179,71,.7) transparent; animation: rot 9s linear infinite reverse; }
.hud__rings i:nth-child(3) { width:1060px; height:1060px; left:-530px; top:-530px; border-style:dotted; border-width:4px; animation: rot 40s linear infinite; }
.hud__txt { position:relative; z-index:3; text-align:center; font-family:"Poppins",sans-serif; }
.hud__txt small { display:block; font-family:"JetBrains Mono",monospace; font-size:22px; letter-spacing:.4em; color:#ffc27a; }
.hud__txt b { display:block; margin-top:16px; font-size:110px; font-weight:700; letter-spacing:.06em; background:linear-gradient(180deg,#fff6e0,#ffb347 60%,#c46a10); -webkit-background-clip:text; background-clip:text; color:transparent; filter: drop-shadow(0 0 30px rgba(255,150,40,.55)); }
.hud__txt span { display:block; margin-top:10px; font-size:34px; font-weight:300; color:#ffe2b8; letter-spacing:.08em; }
.hud__corner { position:absolute; font-family:"JetBrains Mono",monospace; font-size:20px; color:rgba(255,194,122,.85); line-height:1.6; z-index:3; }
.hud__corner.a { left:70px; top:60px; } .hud__corner.b { right:70px; bottom:60px; text-align:right; }
/* bintang & penutup */
.star { width:260px; height:260px; filter: drop-shadow(0 0 40px rgba(227,196,106,.7)); animation: spin 5s cubic-bezier(.6,0,.3,1) infinite; }
@keyframes spin { 0% { transform: rotate(0) scale(.6); } 50% { transform: rotate(180deg) scale(1); } 100% { transform: rotate(360deg) scale(.6); } }
.star.sm { width:120px; height:120px; } .star.xs { width:48px; height:48px; animation:none; filter:none; }
.headline { font-size:112px; font-weight:700; line-height:1.05; letter-spacing:-.035em; text-align:center; }
.future { display:grid; justify-items:center; gap:10px; font-size:120px; font-weight:600; letter-spacing:-.035em; line-height:1.1; }
.future .fl { display:flex; align-items:center; gap:34px; } .future .fl span { font-family:"Playfair Display",serif; font-style:italic; font-weight:500; color:var(--gold); }
.withk { position:relative; display:flex; align-items:center; gap:40px; font-size:96px; font-weight:300; }
.withk .kname { display:flex; align-items:center; gap:26px; font-weight:600; letter-spacing:.12em; }
.withk .kname .logo { width:110px; height:110px; filter: drop-shadow(0 0 30px rgba(227,196,106,.6)); }
.cta { display:inline-flex; align-items:center; gap:18px; margin-top:44px; padding:24px 50px; border-radius:99px; background:linear-gradient(90deg,#e3c46a,#f3dc96); color:#14120f; font-size:40px; font-weight:600; box-shadow:0 0 70px rgba(227,196,106,.55); }
.final { display:grid; grid-template-columns: 1fr 380px; gap:90px; align-items:center; width:1640px; }
.final h2 { font-size:92px; line-height:1.08; font-weight:600; letter-spacing:-.03em; }
.final h2 b { color:var(--gold); }
.qrbox { width:380px; padding:26px; border-radius:36px; background:#fff; box-shadow:0 0 0 10px rgba(227,196,106,.35), 0 0 120px rgba(227,196,106,.5); }
.qrbox svg { width:100%; height:auto; display:block; }
.qrcap { margin-top:26px; text-align:center; font-size:40px; font-weight:600; }
.qrurl { text-align:center; font-size:26px; color:var(--muted); margin-top:6px; }
.wm { position:absolute; right:48px; bottom:36px; display:flex; align-items:center; gap:12px; font-size:22px; letter-spacing:.2em; color:rgba(246,241,228,.55); z-index:9; }
.wm svg { width:30px; height:30px; }
.progress { position:absolute; left:0; bottom:0; height:4px; background:var(--gold); width:0; z-index:9; }
</style></head><body>
<div id="stage">
  <div class="bgglow"></div>
  <div class="grid"></div>

  <section class="scene" data-d="7000">
    <div class="arc"></div>
    <div style="display:grid;justify-items:center;gap:40px;position:relative">
      <div class="brandline in" style="animation-delay:.2s">${logo}KANTOONG AI</div>
      <div class="mega">Karyawan AI</div>
      <div class="sub in" style="animation-delay:1.6s">untuk bisnis yang <span class="gold">jualannya enak</span>.</div>
    </div>
  </section>

  <section class="scene" data-d="6500" data-js="ask">
    <div class="title in">Cukup <em>bilang</em> saja.</div>
    <div class="ask in" style="animation-delay:.4s"><div class="q" id="askq"></div><div class="btn" id="askbtn">${star()}<span>Tanya AI</span></div></div>
    <div class="cursor" id="cursor"></div>
  </section>

  <section class="scene" data-d="10000" data-js="chat">
    <div class="chat">
      <div class="row in"><div class="av">${ICON.user}</div><div class="bub" id="cq"></div></div>
      <div class="row in" style="animation-delay:.3s"><div class="av" style="color:#14120f;background:var(--gold)">${star("xs")}</div>
        <div class="bub ai"><div id="ca"><span class="dots"><span></span><span></span><span></span></span></div>
          <div class="prodcard" id="cp"><img src="ui/m-produk.jpg" alt=""><div><b>Oatcookies</b><small>Masuk keranjang? Tinggal geser ke bawah.</small></div></div></div></div>
    </div>
  </section>

  ${CHAPTERS.map((c) => (c === "DIVIDER" ? divider : chapter(c))).join("\n")}

  <section class="scene" data-d="9000">
    <div class="title in">Saat kamu tidur, <em>dia</em> tetap kerja.</div>
    <div class="stack">
      <div class="task" style="animation: fadeUp .9s .5s forwards"><div class="ti">${ICON.doc}</div><div><b>Invoice INV/014 terbit</b><small>Lengkap dengan QR keaslian</small></div><div class="ok">${ICON.check}</div></div>
      <div class="task" style="animation: fadeUp .9s 1.6s forwards"><div class="ti">${ICON.box}</div><div><b>Kopi habis 3 hari lagi</b><small>PO restok sudah diajukan ke atasan</small></div><div class="ok">${ICON.check}</div></div>
      <div class="task hl" style="animation: fadeUp .9s 2.7s forwards"><div class="ti">${ICON.money}</div><div><b>Rp18,1 jt piutang ditagih</b><small>Pesan pengingat siap kamu kirim</small></div><div class="ok">${ICON.check}</div></div>
      <div class="task" style="animation: fadeUp .9s 3.8s forwards"><div class="ti">${ICON.chat}</div><div><b>Pembeli: “Ada ukuran M?”</b><small>Dijawab pukul 02.14</small></div><div class="ok">${ICON.check}</div></div>
    </div>
  </section>

  <section class="scene" data-d="8000">
    <div class="title in">Semua jadi <em>satu sistem.</em></div>
    <div class="panel in" style="animation-delay:.3s">
      <h3>Toko, kasir, gudang, keuangan — saling terhubung</h3>
      <div class="tiles">
        ${[["toko","Toko online"],["chat","Asisten AI"],["pos","Kasir POS"],["erp","ERP & laporan"],["doc","Dokumen & PDF"],["box","Gudang & stok"],["money","Keuangan"],["agent","Agen AI"]]
          .map(([k, l], i) => `<div class="tile" style="animation-delay:${(0.7 + i * 0.18).toFixed(2)}s">${ICON[k]}<span>${l}</span></div>`).join("")}
      </div>
    </div>
  </section>

  <section class="scene ana" data-d="9500" data-js="globe">
    <div class="hud">
      <canvas id="globe" width="1920" height="1080"></canvas>
      <div class="hud__rings"><i></i><i></i><i></i></div>
      <div class="hud__corner a">SYS // ANACHRONOS<br>LINK ............ OK<br>NEURON SYNC ..... 360</div>
      <div class="hud__corner b">KANTOONG NETWORK<br>BRAND AKTIF 12<br>AGENTS ONLINE 10</div>
      <div class="hud__txt"><small class="in" style="animation-delay:.6s">SATU LAGI…</small><b class="in" style="animation-delay:1.4s">ANACHRONOS</b><span class="in" style="animation-delay:2.2s">Digital Mall · Second Brain</span></div>
    </div>
  </section>

  ${hudFrame("a-mall", "l", [["BRAND AKTIF", "12"], ["NEURON", "360"], ["KUNJUNGAN 7 HARI", "51.648"], ["PESANAN", "1.514"]], "Seluruh brand jadi <em>satu otak</em>", "SECOND BRAIN · 3D · REALTIME")}
  ${hudFrame("a-brand-2", "r", [["NODE AKTIF", "AURUM JEWELRY"], ["OBROLAN AI", "881"], ["MASUK KERANJANG", "240"], ["INSIGHT AI", "3 SARAN BARU"]], "1 brand = 1 <em>neuron hidup</em>", "KLIK BRAND → MASUK KE ORGANNYA")}
  ${hudFrame("a-mall-2", "l", [["CHRONOS", "AKTIF"], ["INPUT", "GERAK TANGAN"], ["KAMERA", "DI PERANGKAT"], ["AGEN", "BEKERJA"]], "Dikendalikan dengan <em>gerakan tangan</em>", "CHRONOS · TANPA MOUSE · TANPA KEYBOARD")}

  <section class="scene" data-d="7000">
    <div style="display:grid;justify-items:center;gap:50px">
      ${star()}
      <div class="headline in" style="animation-delay:1s">Jualannya enak.<br>Ngurusnya yang <em>capek.</em></div>
    </div>
  </section>

  <section class="scene" data-d="6000">
    <div class="future">
      <div class="in" style="animation-delay:.2s">Masa depan bisnismu</div>
      <div class="in fl" style="animation-delay:.9s">${star("sm")}<span>ada di sini.</span></div>
    </div>
  </section>

  <section class="scene" data-d="5500">
    <div class="arc"></div>
    <div class="withk">
      <span class="in" style="animation-delay:.2s">bersama</span>
      <span class="in" style="animation-delay:.7s">${star("sm")}</span>
      <span class="in kname" style="animation-delay:1.2s">${logo}KANTOONG AI</span>
    </div>
  </section>

  <section class="scene" data-d="11000">
    <div class="final">
      <div>
        <div class="brandline in" style="margin-bottom:46px">${logo}KANTOONG AI</div>
        <h2 class="in" style="animation-delay:.4s">Biar karyawan<br><b>KANTOONG AI</b><br>yang ngurus.</h2>
        <p class="sub in" style="animation-delay:.9s;margin-top:34px">Toko · Asisten AI · Kasir · ERP · Dokumen — satu pintu.</p>
        <div class="cta in" style="animation-delay:1.6s">${star("xs")}<span>Coba sekarang</span></div>
      </div>
      <div class="in" style="animation-delay:1.2s"><div class="qrbox">${qr}</div><div class="qrcap">Scan, coba 1 menit</div><div class="qrurl">kantoong-kenzo-ai.pages.dev</div></div>
    </div>
  </section>

  <div class="wm">${logo}KANTOONG AI</div>
  <div class="progress" id="prog"></div>
</div>
<script>
(() => {
  const stage = document.getElementById("stage");
  const fit = () => { const s = Math.min(innerWidth / 1920, innerHeight / 1080); stage.style.transform = "translate(-50%,-50%) scale(" + s + ")"; };
  addEventListener("resize", fit); fit();
  const scenes = [...document.querySelectorAll(".scene")];
  const starts = []; let acc = 0; scenes.forEach((s) => { starts.push(acc); acc += Number(s.dataset.d); });
  const total = acc;
  const prog = document.getElementById("prog");
  const timers = []; let raf = 0;
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const type = (el, text, speed, done) => { let i = 0; el.textContent = ""; const t = setInterval(() => { el.textContent = text.slice(0, ++i); if (i >= text.length) { clearInterval(t); done && done(); } }, speed); timers.push(t); };
  // Layar di laptop/HP berganti dengan geser (seperti di-scroll), tidak pernah kosong.
  const runReels = (scene) => {
    const dur = Number(scene.dataset.d);
    scene.querySelectorAll(".reel").forEach((r) => {
      const imgs = [...r.children]; if (imgs.length < 2) return;
      const step = (dur - 1200) / imgs.length; const offset = r.classList.contains("late") ? step * 0.35 : 0;
      imgs.forEach((img, k) => { if (k === 0) return; later(() => { imgs[k - 1].classList.add("past"); img.classList.add("cur"); }, step * k + offset); });
    });
  };
  const JS = {
    ask(sc) {
      const q = sc.querySelector("#askq"), b = sc.querySelector("#askbtn"), c = sc.querySelector("#cursor");
      c.style.left = "1500px"; c.style.top = "820px";
      later(() => type(q, "Buatkan invoice untuk Kafe Senja…", 55), 900);
      later(() => { c.style.left = (b.offsetLeft + b.offsetParent.offsetLeft + b.offsetWidth / 2 - 45) + "px"; c.style.top = (b.offsetParent.offsetTop + b.offsetTop + b.offsetHeight / 2 - 45) + "px"; }, 3300);
      later(() => { b.classList.add("press"); c.style.transform = "scale(.8)"; }, 4800);
      later(() => { c.style.transform = ""; }, 5100);
    },
    chat(sc) {
      const q = sc.querySelector("#cq"), a = sc.querySelector("#ca"), p = sc.querySelector("#cp");
      later(() => type(q, "Ada camilan sehat buat sore?", 50), 700);
      later(() => type(a, "Ada, Kak! Oatcookies cocok buat sore — renyah, manisnya pas, tetap ringan.", 32, () => { p.style.animation = "fadeUp .8s forwards"; }), 3400);
    },
    globe(sc) {
      const cv = sc.querySelector("#globe"), g = cv.getContext("2d");
      const N = 1100, pts = [];
      for (let i = 0; i < N; i++) { const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963; pts.push([Math.cos(th) * r, y, Math.sin(th) * r, Math.random()]); }
            const t0 = performance.now();
      const draw = (now) => {
        const t = (now - t0) / 1000, R = 330 + Math.min(1, t / 1.5) * 40, cx = 960, cy = 540, ry = t * .35, cs = Math.cos(ry), sn = Math.sin(ry);
        g.clearRect(0, 0, 1920, 1080); g.globalCompositeOperation = "lighter";
        for (const [x, y, z, w] of pts) {
          const X = x * cs - z * sn, Z = x * sn + z * cs; const d = (Z + 1.6) / 2.6;
          const fl = .55 + .45 * Math.sin(t * 3 + w * 20);
          g.fillStyle = "rgba(255," + (150 + 70 * w | 0) + ",60," + (d * .85 * fl).toFixed(2) + ")";
          g.beginPath(); g.arc(cx + X * R, cy + y * R * .98, 1.2 + d * 2.2, 0, 6.29); g.fill();
        }
        g.lineWidth = 2;
        for (let k = 0; k < 3; k++) {
          g.strokeStyle = "rgba(255,170,60," + (.35 + .15 * k) + ")";
          g.beginPath(); g.ellipse(cx, cy, R * (1.12 + k * .1), R * (.28 + k * .08), (k - 1) * .5 + t * (.15 + k * .05), 0, 6.29); g.stroke();
        }
        g.globalCompositeOperation = "source-over";
        if (sc.classList.contains("on")) raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
    },
  };
  let i = Math.max(0, Math.min(scenes.length - 1, Number(new URLSearchParams(location.search).get("adegan") || 1) - 1)), tStart = 0;
  const show = () => {
    timers.splice(0).forEach((t) => { clearTimeout(t); clearInterval(t); }); cancelAnimationFrame(raf);
    scenes.forEach((s, k) => {
      if (k === i) {
        // Ganti adegan dengan salinan segar: semua animasi pasti mulai dari awal lagi.
        const fresh = s.cloneNode(true); fresh.classList.remove("on"); s.replaceWith(fresh); scenes[k] = fresh;
        void fresh.offsetWidth; fresh.classList.add("on");
      } else s.classList.remove("on");
    });
    const sc = scenes[i]; const js = sc.dataset.js; if (js) JS[js](sc);
    runReels(sc);
    tStart = performance.now() - starts[i];
    timers.push(setTimeout(() => { i = (i + 1) % scenes.length; show(); }, Number(sc.dataset.d)));
  };
  const tick = (t) => { prog.style.width = (((t - tStart) % total) / total * 100) + "%"; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  show();
  addEventListener("keydown", (e) => {
    if (e.key === "f" || e.key === "F") document.documentElement.requestFullscreen?.();
    if (e.key === "ArrowRight") { i = (i + 1) % scenes.length; show(); }
    if (e.key === "ArrowLeft") { i = (i - 1 + scenes.length) % scenes.length; show(); }
  });
})();
</script>
</body></html>`;
writeFileSync(`${outDir}/index.html`, html);
console.log("ok", "durasi", Math.round([...html.matchAll(/data-d="(\d+)"/g)].reduce((n, m) => n + Number(m[1]), 0) / 1000), "detik");

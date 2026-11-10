// FILM PAMERAN KANTOONG v4 — gaya iklan SaaS (Doks.ai / Teamble):
// UI Kantoong DIGAMBAR ULANG sebagai kartu tajam (tidak dipotong, tidak di-zoom), potongan cepat 1–3 detik,
// kursor tangan memencet, teks kinetik raksasa, latar terang & gelap bergantian, Anachronos 3D hidup.
// Pakai: node film4.mjs <folder-screenshot> <folder-anachronos-dist> <folder-keluaran>
import { writeFileSync, mkdirSync, copyFileSync, rmSync, existsSync, cpSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("C:/Kantoong_AI_Master_Template/package.json");
const QRCode = require("qrcode");

const [,, SHOTS, AXDIST, OUT] = process.argv;
for (const d of ["ui", "anachronos"]) if (existsSync(`${OUT}/${d}`)) rmSync(`${OUT}/${d}`, { recursive: true, force: true });
mkdirSync(`${OUT}/ui`, { recursive: true });
cpSync(AXDIST, `${OUT}/anachronos`, { recursive: true });
const used = new Set();
const src = (name) => { used.add(name); return `ui/${name}.jpg`; };
const DIM = { d: [2160, 1350], m: [780, 1688] };
const qr = await QRCode.toString("https://kantoong-kenzo-ai.pages.dev", { type: "svg", margin: 0, color: { dark: "#0b0a08", light: "#ffffff" } });
const qrSmall = await QRCode.toString("INV/014/XI/2026", { type: "svg", margin: 0, color: { dark: "#14120f", light: "#ffffff" } });

/* ---------- aset kecil ---------- */
// Logo resmi Kantoong (latar transparan). Simbol untuk ikon kecil, logo penuh untuk adegan logo.
const logo = (c = "") => `<img src="logo/simbol.png" class="logo ${c}" alt="">`;
const logoFull = (c = "") => `<div class="logocard ${c}"><img src="logo/logo-putih.png" alt="KANTOONG"></div>`;
// Bintang 3D berkilau: 16 lapis bintang ditumpuk (tebal), diputar, kilau bergerak di muka depan.
const STAR_PATH = "M50 3 C55 35 65 45 97 50 C65 55 55 65 50 97 C45 65 35 55 3 50 C35 45 45 35 50 3Z";
const star3d = (cls = "") => `<div class="s3d ${cls}"><div class="s3d__spin">${Array.from({ length: 16 }, (_, k) => {
  const face = k === 0 || k === 15;
  const shade = Math.round(40 + Math.abs(k - 7.5) * 6);
  return `<svg viewBox="0 0 100 100" style="--k:${(k - 7.5).toFixed(1)}"><path d="${STAR_PATH}" fill="${face ? "url(#s3face)" : `hsl(214 85% ${shade}%)`}"/></svg>`;
}).join("")}</div></div>`;
const star = (cls = "") => `<svg viewBox="0 0 100 100" class="star ${cls}"><defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8f6ff"/><stop offset=".45" stop-color="#7fd4ff"/><stop offset="1" stop-color="#1f5fd6"/></linearGradient></defs><path d="M50 2 C54 34 66 46 98 50 C66 54 54 66 50 98 C46 66 34 54 2 50 C34 46 46 34 50 2Z" fill="url(#sg)"/></svg>`;
const ic = (d) => `<svg viewBox="0 0 48 48" class="ic"><g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${d}</g></svg>`;
const I = {
  cart: ic('<path d="M5 8h6l5 22h22l5-16H13"/><circle cx="19" cy="38" r="3"/><circle cx="35" cy="38" r="3"/>'),
  chat: ic('<path d="M8 10h26a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H20l-8 7v-7H8a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z"/>'),
  pos: ic('<rect x="8" y="6" width="32" height="24" rx="3"/><path d="M16 38h16M24 30v8M14 14h10"/>'),
  erp: ic('<path d="M6 40h36M10 40V28M18 40V22M26 40V26M34 40V16"/>'),
  doc: ic('<path d="M12 5h17l9 9v29H12z"/><path d="M29 5v9h9M18 26h14M18 33h10"/>'),
  box: ic('<path d="M24 5l17 9v20L24 43 7 34V14z"/><path d="M7 14l17 9 17-9M24 23v20"/>'),
  money: ic('<rect x="5" y="12" width="38" height="24" rx="4"/><circle cx="24" cy="24" r="6"/>'),
  agent: ic('<circle cx="24" cy="18" r="9"/><path d="M8 42c2-9 9-13 16-13s14 4 16 13M20 17h.01M28 17h.01"/>'),
  user: ic('<circle cx="24" cy="16" r="8"/><path d="M8 42c2-9 8-13 16-13s14 4 16 13"/>'),
  check: ic('<path d="M10 25l9 9 19-20"/>'),
  heart: ic('<path d="M24 40S6 29 6 17a9 9 0 0 1 18-3 9 9 0 0 1 18 3c0 12-18 23-18 23z"/>'),
  search: ic('<circle cx="21" cy="21" r="13"/><path d="M31 31l10 10"/>'),
  wifi: ic('<path d="M6 18a26 26 0 0 1 36 0M12 25a17 17 0 0 1 24 0M18 32a8 8 0 0 1 12 0"/><circle cx="24" cy="38" r="2"/>'),
  trash: ic('<path d="M8 13h32M19 13V8h10v5M12 13l2 28h20l2-28"/>'),
  bell: ic('<path d="M12 34V22a12 12 0 0 1 24 0v12l4 4H8z"/><path d="M20 42a4 4 0 0 0 8 0"/>'),
  sign: ic('<path d="M6 36c6-12 10-14 12-10s-2 10 4 8 6-14 10-12-2 10 6 10"/><path d="M6 42h36"/>'),
};
const HAND = `<svg viewBox="0 0 32 32"><path d="M11 3.5c1.2 0 2.2 1 2.2 2.2v8.1l.6-.1c.9-.2 1.9.3 2.3 1.2l.2.5.7-.2c1-.2 2 .3 2.4 1.2l.2.4.6-.1c1.1-.2 2.2.6 2.4 1.7l.9 5.2c.4 2.3-.3 4.6-1.9 6.3l-.8.9H10.7l-5-7.3c-.6-.9-.4-2.1.5-2.7.8-.6 1.9-.5 2.6.2l.9.9V5.7c0-1.2 1-2.2 2.2-2.2z" fill="#fff" stroke="#1a1612" stroke-width="1.5" stroke-linejoin="round"/><path d="M13.2 13.8v4M17 15.4v3.2M20.6 16.9v2.8" stroke="#1a1612" stroke-width="1.2" stroke-linecap="round"/></svg>`;
// Foto produk (bukan UI) dipotong dari screenshot asli, sebagai latar kotak.
function photo(name, [x, y, w, h], cls = "", slot = "") {
  const [iw, ih] = DIM[name[0]];
  return `<div class="photo ${cls}" ${slot !== "" ? `data-slot="${slot}"` : ""} style="background-image:url(${src(name)});background-size:${(100 / w).toFixed(2)}% auto;background-position:${(x / (1 - w) * 100).toFixed(2)}% ${(y / (1 - h) * 100).toFixed(2)}%;aspect-ratio:${(w * iw / (h * ih)).toFixed(3)}"></div>`;
}
const P = {
  cookie: (c) => photo("m-produk", [0.12, 0.43, 0.55, 0.25], c, 0),
  choco: (c) => photo("m-chat-2", [0.42, 0.125, 0.48, 0.22], c, 1),
  framb: (c) => photo("m-chat-2", [0.46, 0.66, 0.4, 0.15], c, 2),
};

/* ---------- penyusun adegan ---------- */
// cur: daftar langkah kursor [target(selector | [x,y]), waktu ms, pencet?]
const cur = (steps) => `<div class="hand" data-steps='${JSON.stringify(steps)}'>${HAND}</div>`;
const at = (ms, html, cls = "") => `<div class="at ${cls}" data-at="${ms}">${html}</div>`;
const S = [];
const scene = (d, bg, body, attrs = "") => S.push(`<section class="scene" data-d="${d}" data-bg="${bg}" ${attrs}>${body}</section>`);
const words = (list, cls = "") => `<div class="kin ${cls}">${list.map(([w, delay, c = ""]) => `<span class="w ${c}" style="animation-delay:${delay}s">${w}</span>`).join(" ")}</div>`;

/* ================= INTRO ================= */
scene(2600, "dark", `
  <div class="pill-intro"><span class="typed" data-type="Memperkenalkan " data-at="100" data-speed="45"></span><b class="typed" data-type="KANTOONG KENZO AI" data-at="900" data-speed="60"></b></div>
  <div class="glowline"></div>`);
scene(2400, "dark", `<div class="logoHero in">${logoFull()}</div>`);
scene(2200, "light", words([["Jualannya", 0, "gold"], ["enak.", 0.7]], "huge"));
scene(2100, "light", `${words([["Ngurusnya", 0], ["yang", 0.2], ["<em>capek.</em>", 0.45, "target"]], "big")}${cur([[[1500, 900], 0], [".target", 1300, 1]])}`);
scene(1500, "blur", words([["Biar", 0]], "giant white"));
scene(2600, "rings", `<div class="rings"><i></i><i></i><i></i></div><div class="ringrow"><span class="in">karyawan AI yang ngurus</span><div class="swap"><b>24 jam</b><b>tanpa libur</b><b>10× lebih gesit</b></div></div>`);

/* ================= PEMBELI ================= */
scene(3000, "light", `
  <div class="card notif in">
    <div class="notif__ic">${logo()}</div>
    <div class="notif__b"><b>Kantoong AI</b><p class="typed" data-type="Hai Kak Rina! Sepatu hitam yang cocok sama blazer Noir-mu lagi diskon 15%." data-at="350" data-speed="24"></p>
    <div class="notif__row"><span class="mini">${I.heart}<em>dari selera di jaringan Kantoong</em></span><button class="btn gold tgt">Lihat</button></div></div>
  </div>${cur([[[1500, 950], 0], [".tgt", 2300, 1]])}`);

scene(3600, "light", `
  <div class="pcard card in">
    ${P.cookie("pcard__img")}
    <div class="pcard__b">
      <div class="tagrow"><span class="tag hot">🔥 Lagi hits</span><span class="tag">Cookies</span></div>
      <h3 data-sname="0">Oatcookies</h3>
      <div class="meta">★ 4,8 (12) · 5rb+ terjual</div>
      <div class="price" data-sprice="0">Rp 7.000</div>
      <div class="ship">Tiba 3 hari · Dari Bandung</div>
      <div class="btns"><button class="btn ghost">${I.chat}Tanya AI</button><button class="btn dark tgt">${I.cart}Keranjang</button></div>
    </div>
  </div>
  <div class="cartbadge">${I.cart}<b class="count" data-count="1>2" data-at="2500"></b></div>
  ${at(2550, `<div class="toast">${I.check}Masuk keranjang</div>`, "pop toastC")}
  ${cur([[[1600, 1000], 0], [".tgt", 2400, 1]])}`);

scene(2900, "dark", `
  <div class="cap in">Cukup <em>bilang</em> saja.</div>
  <div class="ask in"><span class="q typed" data-type="Ada minuman cokelat buat sore?" data-at="250" data-speed="38"></span><button class="askbtn tgt">${star("xs")}Tanya AI</button></div>
  ${cur([[[1400, 950], 0], [".tgt", 2200, 1]])}`);

scene(3600, "dark", `
  <div class="chat">
    <div class="bub me in">Ada minuman cokelat buat sore?</div>
    <div class="bub ai in" style="animation-delay:.35s"><span class="typed" data-type="Ada, Kak! Ini 3 yang paling cocok buat sore — manisnya pas ✨" data-at="500" data-speed="22"></span></div>
    <div class="minis">
      ${at(2100, `<div class="mini-p">${P.choco("mp")}<b data-sname="1">Miloat Chocolate</b><span data-sprice="1">Rp 15.000</span></div>`, "pop")}
      ${at(2300, `<div class="mini-p">${P.framb("mp")}<b data-sname="2">Miloat Frambozen</b><span data-sprice="2">Rp 15.000</span></div>`, "pop")}
      ${at(2500, `<div class="mini-p">${P.cookie("mp")}<b data-sname="0">Oatcookies</b><span data-sprice="0">Rp 7.000</span></div>`, "pop")}
    </div>
  </div>`);

scene(3300, "light", `
  <div class="cap dark-t in">Lihat sendiri: <em>tampilan aslinya.</em></div>
  <div class="phones3">
    <div class="ph p1"><img src="${src("m-toko-1")}" alt=""></div>
    <div class="ph p2"><img src="${src("m-chat-2")}" alt=""></div>
    <div class="ph p3"><img src="${src("m-dash")}" alt=""></div>
  </div>`);

scene(3600, "light", `
  <div class="card cartrow in">
    ${P.cookie("cartrow__img")}
    <div class="cartrow__b"><h4 data-sname="0">Oatcookies</h4><div class="price sm" data-sprice="0">Rp 7.000</div>
      <button class="link tgt">✧ Ingat alasannya</button>
      ${at(1500, `<div class="reason"><span class="typed" data-type="Kado ulang tahun Mama 🎁" data-at="1600" data-speed="40"></span></div>`, "pop")}
    </div>
    <div class="qty"><span>−</span><b>1</b><span>+</span></div>
  </div>
  ${at(2900, `<div class="chipnote">${I.check}Tersimpan hanya di HP-mu</div>`, "pop chipnotePos")}
  <div class="cap dark-t low in" style="animation-delay:.2s">Keranjang yang <em>ingat alasanmu.</em></div>
  ${cur([[[1500, 950], 0], [".tgt", 1200, 1]])}`);

scene(3000, "light", `
  <div class="card consent in">
    <div class="consent__h">${logo()}<b>Konsultasi AI</b></div>
    <p>Boleh aku mengingat obrolan kita di semua toko jaringan Kantoong? Kamu bisa menghapusnya kapan saja.</p>
    <div class="btns"><button class="btn dark tgt">Ingat di semua toko</button><button class="btn ghost">Hanya di toko ini</button></div>
  </div>
  ${at(1950, `<div class="toast">${I.check}Diizinkan — sesuai UU PDP</div>`, "pop toastC")}
  ${cur([[[1500, 950], 0], [".tgt", 1700, 1]])}`);

scene(3300, "light", `
  <div class="card me in">
    <div class="me__h"><small>KARTU DIRIKU</small><b>Yang AI tahu tentangku</b></div>
    <div class="fact"><span>${I.heart}</span><div><b>Suka busana hitam elegan</b><small>sumber: Noir Atelier</small></div></div>
    <div class="fact tgtrow"><span>${I.box}</span><div><b>Ukuran sepatu 42</b><small>sumber: Stride Co.</small></div><button class="del tgt">${I.trash}Hapus</button></div>
    <div class="fact"><span>${I.chat}</span><div><b>Lebih suka jawaban singkat</b><small>sumber: obrolan</small></div></div>
  </div>
  <div class="cap right dark-t in" style="animation-delay:.2s">Datamu, <em>milikmu.</em><small>Hapus per brand, kapan saja.</small></div>
  ${cur([[[1500, 980], 0], [".tgt", 1500, 1]])}`);

/* ================= BISNIS ================= */
scene(1500, "dark", words([["Itu", 0], ["sisi", 0.1], ["<em>pembeli.</em>", 0.2]], "mid"));
scene(1700, "dark", words([["Sekarang,", 0], ["dapur", 0.25], ["<em>bisnisnya.</em>", 0.45]], "big"));

scene(3800, "dark", `
  <div class="card dk cmd in">
    <div class="cmd__top"><div><small>RUANG KOMANDO · OWNER</small><b>3 keputusan hari ini</b></div>
      <div class="ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" class="rbg"/><circle cx="60" cy="60" r="50" class="rfg"/></svg><b class="count" data-count="0>38" data-at="300"></b><small>Waspada</small></div></div>
    <div class="dec tgtrow"><i>1</i><div><small>KEUANGAN</small><b>Tagih 2 piutang yang telat</b><span>Rp18.150.000 · Kafe Senja</span></div><button class="btn light tgt">Selesaikan →</button></div>
    <div class="dec"><i>2</i><div><small>GUDANG</small><b>3 batch kedaluwarsa ≤ 7 hari</b><span>Jadikan promo sebelum terbuang</span></div><button class="btn light">Selesaikan →</button></div>
    <div class="dec"><i>3</i><div><small>SDM</small><b>Kontrak Dewi segera habis</b><span>Perpanjang atau angkat tetap</span></div><button class="btn light">Selesaikan →</button></div>
  </div>
  ${at(2650, `<div class="toast">${I.check}Pesan tagihan disiapkan</div>`, "pop toastR")}
  ${cur([[[1500, 1000], 0], [".tgt", 2400, 1]])}`);

scene(2600, "light", `
  <div class="kpis">
    <div class="kpi card in"><small>Omzet hari ini</small><b>Rp <span class="count" data-count="0>351" data-at="200"></span>rb</b><em>▲ 45%</em></div>
    <div class="kpi card in" style="animation-delay:.15s"><small>Kas & bank</small><b>Rp <span class="count" data-count="0>38" data-at="350"></span>,3 jt</b><em>aman</em></div>
    <div class="kpi card in" style="animation-delay:.3s"><small>Piutang telat</small><b>Rp <span class="count" data-count="0>18" data-at="500"></span>,1 jt</b><em class="red">2 pelanggan</em></div>
  </div>
  <div class="cap dark-t low in">Angka bisnis, <em>langsung terlihat.</em></div>`);

scene(2800, "dark", `
  <div class="cap in">Tinggal <em>perintah.</em></div>
  <div class="agentbar in"><span class="mic">${I.agent}</span><span class="q typed" data-type="Buatkan invoice untuk Kafe Senja" data-at="250" data-speed="40"></span><button class="btn gold tgt">Jalankan</button></div>
  ${cur([[[1500, 950], 0], [".tgt", 2100, 1]])}`);

scene(2900, "dark", `
  <div class="gen2">
    <div class="gorb"><div class="gring"></div><div class="gring r2"></div><div class="glogo">${logo()}</div></div>
    <div class="gtxt">Agen AI sedang <span class="shim">menyiapkan dokumen</span></div>
    <div class="gsteps"><div class="gst" style="--d:0.35s"><i></i><span>Membaca pesanan Kafe Senja</span></div><div class="gst" style="--d:0.77s"><i></i><span>Menghitung PPN 11%</span></div><div class="gst" style="--d:1.19s"><i></i><span>Menyusun INV/014/XI/2026</span></div><div class="gst" style="--d:1.61s"><i></i><span>Membuat QR keaslian</span></div></div>
  </div>`);

scene(3600, "light", `
  <div class="card inv in">
    <div class="inv__h"><div>${logo()}<b>INVOICE</b><small>INV/014/XI/2026</small></div><div class="qr">${qrSmall}<small>QR keaslian</small></div></div>
    <div class="inv__to"><small>Kepada</small><b>Kafe Senja</b></div>
    <div class="inv__l"><span>Miloat Chocolate × 120</span><b>Rp 12.000.000</b></div>
    <div class="inv__l"><span>Oatcookies × 500</span><b>Rp 3.500.000</b></div>
    <div class="inv__l"><span>PPN 11%</span><b>Rp 2.650.000</b></div>
    <div class="inv__t"><span>Total</span><b>Rp 18.150.000</b></div>
    <div class="inv__f"><span class="muted">Disiapkan oleh Agen AI · menunggu tanda tanganmu</span><button class="btn dark tgt">${I.sign}Tanda tangan</button></div>
    ${at(2450, `<div class="stamp">SAH ✓</div>`, "stampIn")}
  </div>
  ${cur([[[1500, 1000], 0], [".tgt", 2200, 1]])}`);

scene(4200, "light", `
  <div class="card mod in">
    <div class="mod__h"><b>Miloat Chocolate</b><span class="price sm">Rp <span class="count" data-count="15>24" data-at="2900"></span>.000</span></div>
    <small>Ukuran</small><div class="opts"><span class="opt on">Regular</span><span class="opt t1">Large +5rb</span></div>
    <small>Gula</small><div class="opts"><span class="opt on o2">Normal</span><span class="opt t2">Less sugar</span><span class="opt">No sugar</span></div>
    <small>Topping</small><div class="opts"><span class="opt t3">Boba +4rb</span><span class="opt">Grass jelly</span><span class="opt">Cheese foam</span></div>
    <button class="btn dark wide t4">Tambah ke pesanan</button>
  </div>
  <div class="cap right dark-t in" style="animation-delay:.2s">Kasir untuk toko & <em>F&B.</em><small>Varian, topping, split bill.</small></div>
  ${cur([[[1500, 1000], 0], [".t1", 900, 1], [".t2", 1700, 1], [".t3", 2500, 1], [".t4", 3500, 1]])}`, `data-js="mod"`);

scene(2800, "dark", `
  <div class="ticket card in">
    <div class="ticket__no"><small>ANTREAN</small><b>A-022</b></div>
    <div class="ticket__b"><small>DAPUR · BAR</small><b>1× Miloat Chocolate</b><span>Large · Less sugar · Boba</span><span class="who">Kak Rina · Meja 5</span></div>
    <div class="eta"><small>ETA jujur</small><b>6 mnt</b></div>
  </div>
  <div class="cap low in">Langsung ke <em>dapur.</em></div>`);

scene(3000, "dark", `
  <div class="net">
    ${at(100, `<div class="np red">${I.wifi}Sinyal hilang</div>`, "pop")}
    ${at(800, `<div class="np">${I.pos}Transaksi tetap jalan · antre 3</div>`, "pop")}
    ${at(1700, `<div class="np green">${I.check}Online · semua tersinkron</div>`, "pop")}
  </div>
  <div class="cap low in">Internet mati? <em>Kasir tetap jalan.</em></div>`);

scene(3400, "light", `
  <div class="card rep in">
    <small>LAPORAN KASIR · HARI INI</small>
    <p><span class="typed" data-type="Omzet Rp 214.000 — naik 45% dibanding Selasa lalu di jam yang sama. Menu terlaris: Miloat Frambozen." data-at="300" data-speed="16"></span></p>
    <div class="bars">${[30, 45, 38, 60, 52, 75, 68, 92].map((h, k) => `<i style="--h:${h}%;animation-delay:${1.2 + k * 0.08}s"></i>`).join("")}</div>
  </div>
  <div class="cap dark-t low in">Laporan yang <em>bercerita.</em></div>`);

scene(3000, "dark", `
  <div class="tilt">
    <div class="tilt__h">Semua jadi <em>satu sistem</em></div>
    <div class="tiles">${[["cart", "Toko online"], ["chat", "Asisten AI"], ["pos", "Kasir POS"], ["erp", "ERP"], ["doc", "Dokumen"], ["box", "Gudang"], ["money", "Keuangan"], ["agent", "Agen AI"]]
      .map(([k, l], n) => `<div class="tile" style="animation-delay:${0.15 + n * 0.08}s">${I[k]}<span>${l}</span></div>`).join("")}</div>
  </div>`);

scene(3300, "light", `
  <div class="cap dark-t in">Tampil di <em>laptop</em> & <em>HP.</em></div>
  <div class="duo">
    <div class="bw"><div class="bw__bar"><i></i><i></i><i></i></div><img src="${src("d-erp-komando")}" alt=""></div>
    <div class="ph p4"><img src="${src("m-kasir")}" alt=""></div>
  </div>`);

/* ================= ANACHRONOS ================= */
scene(1800, "dark", words([["Satu", 0], ["lagi…", 0.25]], "mid"));
const axcap = (k, t) => `<div class="axcap"><small class="in">${k}</small><b class="in" style="animation-delay:.2s">${t}</b></div>`;
scene(5200, "ax", axcap("ANACHRONOS DIGITAL MALL · LIVE", "Semua brand jadi <em>satu otak.</em>"), `data-ax="orbit"`);
scene(6200, "ax", axcap("KLIK SATU NEURON", "Masuk ke <em>dalam</em> brand."), `data-ax="dive"`);
scene(6400, "ax", axcap("SETIAP ORGAN HIDUP", "Sampai ke <em>produknya.</em>"), `data-ax="organs"`);
scene(4600, "ax", axcap("SECOND BRAIN", "Bisnismu, dilihat <em>dari atas.</em>"), `data-ax="cinema"`);

/* ================= PENUTUP ================= */
scene(2200, "doksplain", `<div class="center">${star3d("big")}</div>`);
scene(2600, "doksplain", `<div class="line"><span class="cy">Masa depan bisnismu</span> ${star3d("mid")} <span>ada di sini</span></div>`);
scene(2200, "doksplain", `<div class="line"><span class="cy">bersama</span> ${star3d("mid")} <b>KANTOONG KENZO AI</b></div>`);
scene(7000, "doks", `
  <div class="endc">
    <div class="in">${logoFull("end")}</div>
    <div class="endtag in" style="animation-delay:.35s">Biar karyawan <b>KANTOONG KENZO AI</b> yang ngurus.</div>
    <button class="endcta in tgt" style="animation-delay:.6s">${star3d("xs")}Coba sekarang</button>
  </div>
  <div class="endqr in" style="animation-delay:.9s"><div class="qrbox">${qr}</div><span>Scan, coba 1 menit</span></div>
  ${cur([[[1500, 1000], 0], [".tgt", 1900, 1]])}`);

/* ---------- HTML ---------- */
const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kantoong AI — Film Pameran</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@1,500;1,600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>
:root { --ink:#15120d; --ivory:#fbf7ef; --gold:#3d8bff; --gold2:#7fd4ff; --muted:#7b7263; --dk:#0b1222; }
* { box-sizing:border-box; margin:0; padding:0; }
html,body { width:100%; height:100%; background:#000; overflow:hidden; cursor:none; }
body { font-family:"Poppins","Segoe UI",sans-serif; color:var(--ink); }
button { font:inherit; border:0; cursor:none; }
#stage { position:absolute; left:50%; top:50%; width:1920px; height:1080px; overflow:hidden; background:var(--dk); transform-origin:center; }
/* latar */
.bg { position:absolute; inset:0; opacity:0; transition: opacity .5s ease; }
.bg.on { opacity:1; }
.bg--dark { background: radial-gradient(60% 60% at 50% 120%, rgba(61,139,255,.38), transparent 70%), radial-gradient(40% 40% at 90% -10%, rgba(40,90,200,.35), transparent 70%), #0b1222; }
.bg--light { background:#0b1222; overflow:hidden; }
.bg--light i { position:absolute; border-radius:50%; filter: blur(110px); opacity:.42; animation: blob 9s ease-in-out infinite alternate; }
.bg--light i:nth-child(1) { width:900px; height:700px; right:-200px; top:-250px; background:#1f6fff; }
.bg--light i:nth-child(2) { width:800px; height:600px; left:-250px; bottom:-300px; background:#5b45ff; animation-duration: 11s; }
.bg--light i:nth-child(3) { width:600px; height:500px; left:40%; top:50%; background:#12b8ff; animation-duration: 7s; }
@keyframes blob { to { transform: translate(-120px, 80px) scale(1.15); } }
.bg--blur { background: radial-gradient(45% 55% at 35% 55%, #2f7cff, transparent 70%), radial-gradient(45% 55% at 70% 45%, #6a4dff, transparent 70%), #0d1630; filter: saturate(1.1); }
.bg--rings { background: radial-gradient(circle at 50% 50%, #12285a, #0d1630 60%, #0b1222); }
.bg--final { background: radial-gradient(70% 60% at 50% 115%, rgba(61,139,255,.6), transparent 70%), #0b1222; }
#ax { position:absolute; inset:0; width:1920px; height:1080px; border:0; opacity:0; transition: opacity .6s ease; pointer-events:none; background:#02040a; }
#ax.on { opacity:1; }
/* adegan */
.scene { position:absolute; inset:0; display:grid; place-items:center; opacity:0; visibility:hidden; transform: scale(1.03); transition: opacity .5s ease, transform .6s ease, visibility 0s linear .5s; }
.scene.on { opacity:1; visibility:visible; transform:none; transition: opacity .5s ease, transform .8s cubic-bezier(.2,.8,.2,1); }
.scene * { animation-play-state: paused; }
.scene.on * { animation-play-state: running; }
.scene { color:#eef5ff; }
.in { opacity:0; animation: up .7s cubic-bezier(.2,.8,.2,1) forwards; }
@keyframes up { from { opacity:0; transform: translateY(46px) scale(.97); filter: blur(10px); } to { opacity:1; transform:none; filter:none; } }
@keyframes pop { 0% { opacity:0; transform: scale(.6); } 70% { opacity:1; transform: scale(1.06); } 100% { opacity:1; transform:none; } }
em { font-family:"Playfair Display",serif; font-style:italic; font-weight:600; color:var(--gold); }
.logo { width:64px; height:64px; flex:none; }
.ic { width:30px; height:30px; flex:none; }
/* kursor tangan */
.hand { position:absolute; left:0; top:0; width:70px; height:70px; margin:-8px 0 0 -24px; z-index:50; opacity:0; transition: left 1s cubic-bezier(.55,0,.2,1), top 1s cubic-bezier(.55,0,.2,1), opacity .25s; filter: drop-shadow(0 10px 18px rgba(0,0,0,.35)); pointer-events:none; }
.hand svg { width:100%; height:100%; transition: transform .14s; }
.hand.press svg { transform: scale(.82) rotate(-6deg); }
.rip { position:absolute; width:26px; height:26px; margin:-13px; border-radius:50%; border:3px solid var(--gold); z-index:49; pointer-events:none; animation: rip .7s ease-out forwards; }
@keyframes rip { to { transform: scale(5); opacity:0; } }
.hit { transform: scale(.96); }
/* elemen berjadwal */
.at { opacity:0; }
.at.show { animation: pop .5s cubic-bezier(.2,.9,.3,1.3) forwards; }
.typed::after { content:""; display:inline-block; width:3px; height:.95em; margin-left:4px; vertical-align:-.12em; background:var(--gold); animation: car 1s steps(1) infinite; }
.typed.done::after { display:none; }
@keyframes car { 50% { opacity:0; } }
/* teks kinetik */
.kin { text-align:center; font-weight:700; letter-spacing:-.05em; line-height:1.02; }
.kin.huge { font-size:220px; } .kin.big { font-size:170px; } .kin.mid { font-size:120px; } .kin.giant { font-size:380px; }
.kin.gold .w, .kin .w.gold { color:var(--gold); } .kin.white .w { color:#fff; text-shadow:0 10px 60px rgba(40,110,255,.35); }
.kin .w { display:inline-block; opacity:0; animation: word .55s cubic-bezier(.2,.9,.25,1.15) forwards; }
.kin .w.dim { opacity:.35; animation:none; }
.kin em { font-size:1.04em; }
@keyframes word { from { opacity:0; transform: translateY(80px) scale(.92); filter: blur(12px); } to { opacity:1; transform:none; filter:none; } }
.cap { position:absolute; top:110px; left:0; right:0; text-align:center; font-size:76px; font-weight:600; letter-spacing:-.035em; }
.cap.dark-t { color:#f2f7ff; } .cap.low { top:auto; bottom:110px; }
.cap.right { left:auto; right:120px; top:50%; width:620px; text-align:left; transform: translateY(-50%); }
.cap small { display:block; margin-top:16px; font-size:30px; font-weight:400; letter-spacing:0; color:#9fb6d8; text-shadow:none; }
/* intro */
.pill-intro { padding:34px 70px; border-radius:99px; border:1.5px solid rgba(127,212,255,.45); background:rgba(20,18,14,.65); font-size:64px; font-weight:300; color:#f3ead6; white-space:nowrap; box-shadow:0 0 90px -20px rgba(61,139,255,.6); }
.pill-intro b { font-weight:700; color:var(--gold2); }
.glowline { position:absolute; left:20%; right:20%; top:640px; height:2px; background:linear-gradient(90deg, transparent, var(--gold2), transparent); box-shadow:0 0 30px var(--gold); animation: grow 1.6s ease-out forwards; transform: scaleX(0); }
@keyframes grow { to { transform: scaleX(1); } }
.logo { object-fit:contain; filter: drop-shadow(0 0 10px rgba(90,160,255,.35)); }
.logoHero { position:relative; display:grid; place-items:center; }
.logocard { position:relative; width:560px; border-radius:48px; overflow:hidden; background:#fff; box-shadow: 0 50px 120px -40px rgba(0,0,0,.9), 0 0 0 1px rgba(255,255,255,.6), 0 0 120px -20px rgba(70,150,255,.55); }
.logocard img { display:block; width:100%; height:auto; }
.logocard.end { width:400px; border-radius:40px; margin:0 auto; }
/* bintang 3D */
.s3d { position:relative; width:var(--sz); height:var(--sz); perspective:900px; filter: drop-shadow(0 0 calc(var(--sz) * .12) rgba(90,170,255,.75)); --sz:240px; --d:1.6px; animation: s3in 1.1s cubic-bezier(.2,.9,.3,1.2) both; }
.s3d.big { --sz:300px; --d:2px; } .s3d.mid { --sz:110px; --d:.8px; display:inline-block; vertical-align:middle; margin:0 18px; } .s3d.xs { --sz:44px; --d:.35px; animation:none; filter:none; }
.s3d__spin { position:absolute; inset:0; transform-style:preserve-3d; animation: s3spin 4.5s cubic-bezier(.45,0,.25,1) infinite; }
.s3d svg { position:absolute; inset:0; width:100%; height:100%; transform: translateZ(calc(var(--k) * var(--d))); }
.s3d.xs .s3d__spin { animation-duration: 6s; }
@keyframes s3spin { 0% { transform: rotateX(14deg) rotateY(0); } 50% { transform: rotateX(-8deg) rotateY(180deg); } 100% { transform: rotateX(14deg) rotateY(360deg); } }
@keyframes s3in { from { transform: scale(.15) rotate(-120deg); opacity:0; } to { transform:none; opacity:1; } }
/* penutup ala Doks.ai */
.bg--doksplain { background: linear-gradient(180deg, #0c1220 0%, #0c1220 70%, #0d2238 100%); }
.bg--doks { background:#0c1220; overflow:hidden; }
.bg--doks::before { content:""; position:absolute; inset:-80px; background: radial-gradient(ellipse 1080px 760px at 50% 34%, transparent 66%, rgba(70,150,255,.82) 80%, rgba(90,190,255,.35) 90%, transparent 100%); filter: blur(46px); animation: doksb 8s ease-in-out infinite alternate; }
@keyframes doksb { to { transform: scale(1.04) translateY(-12px); } }
.bg--doks::after { content:""; position:absolute; inset:0; background: linear-gradient(180deg, #0c1220 4%, transparent 30%); }
.line .cy { background:linear-gradient(90deg,#6fd3ff,#4f8dff); -webkit-background-clip:text; background-clip:text; color:transparent; font-weight:600; }
.scene .line b { font-weight:700; letter-spacing:.03em; color:#fff; }
.endc { display:grid; justify-items:center; gap:34px; text-align:center; color:#fff; }
.endtag { font-size:54px; font-weight:500; letter-spacing:-.02em; } .endtag b { font-weight:700; background:linear-gradient(90deg,#9fe0ff,#5b9bff); -webkit-background-clip:text; background-clip:text; color:transparent; }
.endcta { display:inline-flex; align-items:center; gap:16px; padding:22px 48px; border-radius:99px; background:rgba(255,255,255,.08); border:1.5px solid rgba(140,200,255,.55); color:#fff; font-size:40px; font-weight:500; }
.endqr { position:absolute; right:90px; bottom:90px; display:grid; justify-items:center; gap:10px; color:#cfe3ff; font-size:22px; }
.endqr .qrbox { width:190px; padding:14px; border-radius:20px; box-shadow:0 0 0 6px rgba(120,190,255,.25), 0 0 60px rgba(90,160,255,.4); }
.logoHero::before { content:""; position:absolute; width:760px; height:760px; border-radius:50%; background: radial-gradient(closest-side, rgba(70,140,255,.45), rgba(70,140,255,.12) 55%, transparent); filter: blur(10px); }
.logofull { position:relative; width:640px; height:auto; filter: brightness(1.35) saturate(1.15) drop-shadow(0 0 40px rgba(80,160,255,.55)); }
.logoHero.sm::before { width:380px; height:380px; } .logoHero.sm .logofull { width:300px; }
.final__l .logoHero { justify-items:start; } .final__l .logoHero::before { left:-40px; }
.brandw { font-family:"Poppins",sans-serif; font-style:normal; font-weight:800; letter-spacing:.02em; background:linear-gradient(90deg,#9fe0ff,#4da3ff 45%,#8fc1ff); -webkit-background-clip:text; background-clip:text; color:transparent; }
.logoBig { display:flex; align-items:center; gap:34px; font-size:120px; font-weight:700; letter-spacing:.04em; color:#fff; }
.logoBig .logo { width:150px; height:150px; } .logoBig b { color:var(--gold2); }
.logoBig.sm { font-size:52px; gap:20px; } .logoBig.sm .logo { width:74px; height:74px; }
.swoosh { position:absolute; width:900px; height:300px; left:300px; top:640px; border-radius:50%; background: radial-gradient(closest-side, rgba(70,150,255,.9), transparent); filter: blur(40px); animation: sw 1.9s ease-out forwards; opacity:0; }
@keyframes sw { 30% { opacity:1; } to { opacity:.7; transform: translateX(260px) rotate(-8deg); } }
.rings { position:absolute; left:50%; top:50%; }
.rings i { position:absolute; border-radius:400px; background:rgba(80,160,255,.07); box-shadow: inset 0 0 0 2px rgba(127,212,255,.45), 0 0 40px rgba(61,139,255,.25); transform: translate(-50%,-50%); animation: ring 2.6s ease-out forwards; }
.rings i:nth-child(1) { width:1500px; height:620px; } .rings i:nth-child(2) { width:1150px; height:430px; } .rings i:nth-child(3) { width:800px; height:250px; }
@keyframes ring { from { transform: translate(-50%,-50%) scale(.8); opacity:0; } to { transform: translate(-50%,-50%) scale(1); opacity:1; } }
.ringrow { position:relative; display:flex; align-items:center; gap:30px; font-size:52px; font-weight:500; color:#d6ecff; }
.swap { position:relative; width:440px; height:110px; border-radius:99px; background:#fff; box-shadow:0 20px 60px -20px rgba(20,60,160,.5); overflow:hidden; }
.swap b { position:absolute; inset:0; display:grid; place-items:center; font-size:48px; font-weight:700; color:var(--ink); opacity:0; animation: swp 2.6s steps(1) forwards; }
.swap b:nth-child(1) { animation-name: s1; } .swap b:nth-child(2) { animation-name: s2; } .swap b:nth-child(3) { animation-name: s3; }
@keyframes s1 { 0% { opacity:0; } 10% { opacity:1; } 38% { opacity:0; } }
@keyframes s2 { 0%,38% { opacity:0; } 40% { opacity:1; } 66% { opacity:0; } }
@keyframes s3 { 0%,66% { opacity:0; } 68%,100% { opacity:1; color:var(--gold); } }
/* kartu umum */
.card { position:relative; background:#fff; border-radius:34px; box-shadow: 0 50px 120px -40px rgba(0,10,40,.45), 0 0 0 1px rgba(20,18,13,.06); }
.card.dk { background:#16140f; color:#f6f1e4; box-shadow: 0 50px 120px -40px rgba(0,0,0,.9), 0 0 0 1.5px rgba(127,212,255,.45), 0 0 120px -40px rgba(61,139,255,.5); }
.btn { display:inline-flex; align-items:center; gap:12px; padding:20px 34px; border-radius:99px; font-size:28px; font-weight:600; transition: transform .15s, background .2s; }
.btn.dark { background:#15120d; color:#fff; } .btn.gold { background:var(--gold); color:#15120d; } .btn.ghost { background:#f2ede2; color:#15120d; } .btn.light { background:#f6f1e4; color:#15120d; font-size:22px; padding:14px 24px; }
.btn.wide { width:100%; justify-content:center; margin-top:26px; }
.photo { width:100%; background-repeat:no-repeat; border-radius:22px; }
.price { font-size:58px; font-weight:700; letter-spacing:-.02em; } .price.sm { font-size:38px; }
.toast { display:inline-flex; align-items:center; gap:14px; padding:22px 38px; border-radius:99px; background:#1d7a4b; color:#fff; font-size:30px; font-weight:600; white-space:nowrap; box-shadow:0 30px 60px -20px rgba(0,0,0,.5); }
.toastC { position:absolute; left:50%; top:900px; transform:translateX(-50%); } .toastC.show { animation-name: popc; }
@keyframes popc { from { opacity:0; transform: translate(-50%, 30px) scale(.8); } to { opacity:1; transform: translate(-50%, 0); } }
.toastR { position:absolute; right:150px; top:190px; }
/* notifikasi */
.notif { display:flex; gap:34px; width:1180px; padding:44px 50px; }
.notif__ic { width:120px; height:120px; flex:none; border-radius:32px; display:grid; place-items:center; background:#fff; box-shadow: inset 0 0 0 2px #eee6d6; } .notif__ic .logo { width:76px; height:76px; }
.notif__b b { font-size:40px; } .notif__b p { margin-top:8px; font-size:36px; line-height:1.35; min-height:100px; color:#3a3328; }
.notif__row { margin-top:24px; display:flex; align-items:center; justify-content:space-between; }
.mini { display:flex; align-items:center; gap:10px; font-size:24px; color:var(--muted); } .mini em { font-family:inherit; font-style:normal; font-weight:500; color:var(--muted); } .mini .ic { color:#d4567a; }
/* kartu produk */
.pcard { display:flex; gap:50px; width:1240px; padding:34px; }
.pcard__img { width:500px; flex:none; aspect-ratio:1 !important; border-radius:26px; }
.pcard__b { display:flex; flex-direction:column; justify-content:center; gap:10px; }
.tagrow { display:flex; gap:12px; } .tag { padding:8px 18px; border-radius:99px; background:#f2ede2; font-size:22px; font-weight:600; } .tag.hot { background:#15120d; color:#9fe0ff; }
.pcard h3 { margin-top:10px; font-size:64px; font-weight:600; letter-spacing:-.03em; }
.meta { font-size:28px; color:var(--muted); } .meta::first-letter { color:var(--gold); }
.ship { font-size:24px; color:var(--muted); }
.btns { margin-top:20px; display:flex; gap:16px; }
.cartbadge { position:absolute; right:150px; top:120px; display:flex; align-items:center; gap:10px; padding:16px 26px; border-radius:99px; background:#15120d; color:#fff; font-size:30px; }
.cartbadge b { display:grid; place-items:center; min-width:44px; height:44px; border-radius:99px; background:var(--gold); color:#15120d; }
/* tanya */
.ask { display:flex; align-items:center; gap:20px; width:1300px; padding:20px 20px 20px 56px; border-radius:99px; background:rgba(24,21,16,.9); border:2px solid rgba(127,212,255,.5); box-shadow:0 0 0 16px rgba(61,139,255,.07), 0 40px 120px -30px rgba(61,139,255,.6); }
.ask .q { flex:1; font-size:46px; font-weight:300; color:#f3ead6; white-space:nowrap; overflow:hidden; }
.askbtn { display:flex; align-items:center; gap:14px; padding:26px 44px; border-radius:99px; background:var(--gold); color:#15120d; font-size:38px; font-weight:700; }
.star { width:240px; height:240px; filter: drop-shadow(0 0 40px rgba(127,212,255,.7)); animation: spin 1.5s cubic-bezier(.6,0,.3,1) forwards; }
.star.xs { width:44px; height:44px; filter:none; animation:none; }
@keyframes spin { from { transform: rotate(-180deg) scale(.2); } to { transform: none; } }
/* chat */
.chat { display:grid; gap:30px; width:1300px; }
.bub { max-width:1000px; padding:30px 42px; border-radius:34px; font-size:40px; line-height:1.35; }
.bub.me { justify-self:end; background:var(--gold); color:#15120d; border-bottom-right-radius:10px; }
.bub.ai { background:#1d1a14; border:1.5px solid rgba(127,212,255,.45); border-bottom-left-radius:10px; min-height:110px; }
.minis { display:flex; gap:26px; margin-left:20px; }
.mini-p { width:300px; padding:16px; border-radius:26px; background:#fff; color:#15120d; box-shadow:0 30px 60px -20px rgba(0,0,0,.6); }
.mini-p .mp { aspect-ratio:1.3 !important; border-radius:16px; } .mini-p b { display:block; margin-top:12px; font-size:26px; } .mini-p span { font-size:28px; font-weight:700; }
/* HP & browser asli (utuh, tidak dipotong) */
.phones3 { position:relative; width:1500px; height:820px; margin-top:150px; perspective:2000px; }
.ph { position:absolute; width:330px; border-radius:46px; padding:12px; background:#15120d; box-shadow:0 60px 120px -40px rgba(0,10,40,.7); opacity:0; }
.ph img { display:block; width:100%; border-radius:36px; }
.p1 { left:120px; top:60px; animation: phl .9s .1s cubic-bezier(.2,.8,.2,1) forwards; }
.p2 { left:585px; top:0; z-index:2; animation: up .9s .25s cubic-bezier(.2,.8,.2,1) forwards; }
.p3 { left:1050px; top:60px; animation: phr .9s .4s cubic-bezier(.2,.8,.2,1) forwards; }
@keyframes phl { from { opacity:0; transform: translateX(-120px) rotateY(40deg); } to { opacity:1; transform: rotateY(22deg) rotateZ(-3deg); } }
@keyframes phr { from { opacity:0; transform: translateX(120px) rotateY(-40deg); } to { opacity:1; transform: rotateY(-22deg) rotateZ(3deg); } }
.duo { position:relative; width:1600px; height:760px; margin-top:170px; perspective:2200px; }
.bw { position:absolute; left:40px; top:20px; width:1150px; border-radius:20px; overflow:hidden; background:#15120d; box-shadow:0 60px 140px -40px rgba(0,10,40,.7); opacity:0; animation: bwin .9s .1s cubic-bezier(.2,.8,.2,1) forwards; }
.bw__bar { height:40px; display:flex; align-items:center; gap:9px; padding:0 18px; } .bw__bar i { width:12px; height:12px; border-radius:50%; background:#3a3833; } .bw__bar i:first-child { background:var(--gold); }
.bw img { display:block; width:100%; }
@keyframes bwin { from { opacity:0; transform: rotateY(25deg) translateX(-80px); } to { opacity:1; transform: rotateY(10deg); } }
.p4 { left:1180px; top:40px; width:300px; z-index:2; animation: phr .9s .35s cubic-bezier(.2,.8,.2,1) forwards; }
/* keranjang */
.cartrow { display:flex; align-items:center; gap:40px; width:1200px; padding:34px; }
.cartrow__img { width:220px; flex:none; aspect-ratio:1 !important; }
.cartrow__b { flex:1; } .cartrow h4 { font-size:44px; font-weight:600; }
.link { margin-top:8px; background:none; font-size:30px; font-weight:600; color:#2f6fe8; text-decoration:underline; padding:6px 0; }
.reason { margin-top:12px; display:inline-block; padding:16px 26px; border-radius:18px; background:#eaf3ff; border:1.5px solid var(--gold2); font-size:32px; font-weight:500; min-width:460px; }
.qty { display:flex; align-items:center; gap:24px; padding:14px 26px; border-radius:99px; border:2px solid #e6dfd0; font-size:34px; }
.chipnote { display:inline-flex; align-items:center; gap:12px; padding:16px 28px; border-radius:99px; background:#15120d; color:#fff; font-size:26px; }
.chipnotePos { position:absolute; right:340px; top:250px; }
/* izin */
.consent { width:1000px; padding:48px 54px; }
.consent__h { display:flex; align-items:center; gap:18px; font-size:36px; } .consent__h .logo { width:54px; height:54px; }
.consent p { margin:22px 0 10px; font-size:38px; line-height:1.4; color:#3a3328; }
/* kartu diriku */
.me { width:900px; padding:40px; margin-right:520px; display:grid; gap:18px; }
.me__h small { font-size:20px; letter-spacing:.24em; color:#2f6fe8; font-weight:600; } .me__h b { display:block; font-size:44px; }
.fact { display:flex; align-items:center; gap:22px; padding:22px 26px; border-radius:24px; background:#faf6ee; transition: opacity .5s, transform .5s, filter .5s; }
.fact > span { width:62px; height:62px; flex:none; display:grid; place-items:center; border-radius:18px; background:#fff; color:#2f6fe8; }
.fact div { flex:1; } .fact b { display:block; font-size:32px; } .fact small { font-size:22px; color:var(--muted); }
.del { display:flex; align-items:center; gap:8px; padding:12px 22px; border-radius:99px; background:#fde6e2; color:#b23a2a; font-size:24px; font-weight:600; }
.fact.gone { opacity:0; transform: translateX(80px); filter: blur(6px); }
/* komando */
.cmd { width:1280px; padding:44px 50px; display:grid; gap:18px; }
.cmd__top { display:flex; justify-content:space-between; align-items:center; }
.cmd__top small { font-size:20px; letter-spacing:.24em; color:var(--gold2); } .cmd__top b { display:block; font-size:50px; font-weight:600; }
.ring { position:relative; width:150px; height:150px; display:grid; place-items:center; text-align:center; }
.ring svg { position:absolute; inset:0; transform: rotate(-90deg); } .ring circle { fill:none; stroke-width:10; } .ring .rbg { stroke:#2c2820; }
.ring .rfg { stroke:#ff8a6b; stroke-linecap:round; stroke-dasharray:314; stroke-dashoffset:314; animation: ringf 1.6s .3s ease-out forwards; }
@keyframes ringf { to { stroke-dashoffset:195; } }
.ring b { font-size:52px; line-height:1; } .ring small { position:absolute; bottom:34px; font-size:16px; color:#a9c2e6; letter-spacing:0; }
.dec { display:flex; align-items:center; gap:24px; padding:22px 26px; border-radius:24px; background:#211e17; border:1px solid #3a352a; transition: background .4s; }
.dec > i { width:54px; height:54px; flex:none; display:grid; place-items:center; border-radius:50%; background:var(--gold); color:#15120d; font-style:normal; font-weight:700; font-size:26px; }
.dec div { flex:1; } .dec small { font-size:17px; letter-spacing:.2em; color:var(--gold2); } .dec b { display:block; font-size:32px; } .dec span { font-size:22px; color:#a9c2e6; }
.dec.done { background:#173a28; } .dec.done > i { background:#2fbf71; color:#fff; }
/* KPI */
.kpis { display:flex; gap:36px; }
.kpi { width:470px; padding:40px 44px; display:grid; gap:8px; }
.kpi small { font-size:24px; color:var(--muted); } .kpi b { font-size:64px; letter-spacing:-.03em; } .kpi em { font-family:inherit; font-style:normal; font-size:26px; color:#1d7a4b; font-weight:600; } .kpi em.red { color:#c0392b; }
/* agen */
.agentbar { display:flex; align-items:center; gap:24px; width:1300px; padding:22px 22px 22px 30px; border-radius:30px; background:#fff; color:#15120d; box-shadow:0 0 0 2px rgba(127,212,255,.7), 0 40px 120px -30px rgba(61,139,255,.6); }
.agentbar .mic { width:72px; height:72px; display:grid; place-items:center; border-radius:20px; background:#15120d; color:var(--gold2); }
.agentbar .q { flex:1; font-size:44px; white-space:nowrap; overflow:hidden; }
.gen { display:grid; justify-items:center; gap:30px; font-size:52px; font-weight:500; color:#fff; text-shadow:0 6px 40px rgba(20,60,160,.4); }
.gen .logo { width:150px; height:150px; animation: pulse 1s ease-in-out infinite alternate; }
@keyframes pulse { to { transform: scale(1.12) rotate(8deg); } }
/* invoice */
.inv { width:1060px; padding:48px 56px; display:grid; gap:16px; }
.inv__h { display:flex; justify-content:space-between; align-items:flex-start; } .inv__h > div:first-child { display:grid; grid-template-columns:auto auto; column-gap:18px; align-items:center; }
.inv__h .logo { grid-row: span 2; width:70px; height:70px; } .inv__h b { font-size:46px; letter-spacing:.06em; } .inv__h small { font-size:24px; color:var(--muted); }
.qr { display:grid; justify-items:center; gap:4px; } .qr svg { width:120px; height:120px; } .qr small { font-size:18px; color:var(--muted); }
.inv__to small { font-size:20px; color:var(--muted); } .inv__to b { display:block; font-size:34px; }
.inv__l, .inv__t { display:flex; justify-content:space-between; font-size:28px; padding:12px 0; border-bottom:1px solid #eee6d6; }
.inv__t { font-size:40px; font-weight:700; border:0; }
.inv__f { display:flex; align-items:center; justify-content:space-between; margin-top:6px; } .muted { font-size:22px; color:var(--muted); }
.stamp { position:absolute; right:70px; top:230px; padding:20px 42px; border:6px solid #1d7a4b; border-radius:20px; color:#1d7a4b; font-size:58px; font-weight:800; letter-spacing:.08em; transform: rotate(-10deg); opacity:0; background:rgba(255,255,255,.8); }
.stampIn.show .stamp, .stampIn.show { opacity:1; } .stampIn { position:absolute; inset:0; pointer-events:none; opacity:0; }
.stampIn.show .stamp { animation: stampk .45s cubic-bezier(.3,1.6,.5,1) forwards; }
@keyframes stampk { from { transform: rotate(-10deg) scale(2.4); opacity:0; } to { transform: rotate(-10deg) scale(1); opacity:1; } }
/* kasir varian */
.mod { width:860px; padding:44px 50px; margin-right:560px; }
.mod__h { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; } .mod__h b { font-size:46px; }
.mod small { display:block; margin:18px 0 10px; font-size:22px; font-weight:600; color:var(--muted); letter-spacing:.06em; }
.opts { display:flex; gap:14px; flex-wrap:wrap; }
.opt { padding:16px 28px; border-radius:99px; border:2px solid #e6dfd0; font-size:28px; font-weight:500; transition: all .2s; }
.opt.on { background:#15120d; color:#fff; border-color:#15120d; }
/* tiket */
.ticket { display:flex; align-items:center; gap:40px; width:1240px; padding:40px 46px; color:#15120d; }
.ticket__no { padding:26px 34px; border-radius:26px; background:#15120d; color:#fff; text-align:center; } .ticket__no small { font-size:18px; letter-spacing:.2em; color:var(--gold2); } .ticket__no b { display:block; font-size:72px; letter-spacing:-.02em; }
.ticket__b { flex:1; display:grid; gap:4px; } .ticket__b small { font-size:20px; letter-spacing:.2em; color:#2f6fe8; font-weight:600; } .ticket__b b { font-size:44px; } .ticket__b span { font-size:28px; color:#5c5446; } .ticket__b .who { color:#1d7a4b; font-weight:600; }
.eta { text-align:center; } .eta small { font-size:20px; color:var(--muted); } .eta b { display:block; font-size:56px; color:#2f6fe8; }
/* offline */
.net { display:grid; gap:24px; justify-items:center; margin-top:-80px; }
.np { display:inline-flex; align-items:center; gap:18px; padding:26px 46px; border-radius:99px; background:#1d1a14; border:1.5px solid rgba(127,212,255,.4); font-size:40px; font-weight:500; color:#f6f1e4; }
.np.red { background:#3a1b16; border-color:#a5463a; } .np.green { background:#173a28; border-color:#2fbf71; }
/* laporan */
.rep { width:1180px; padding:50px 56px; }
.rep small { font-size:22px; letter-spacing:.22em; color:#2f6fe8; font-weight:600; }
.rep p { margin-top:16px; font-size:44px; line-height:1.35; font-weight:500; min-height:180px; }
.bars { display:flex; align-items:flex-end; gap:22px; height:160px; margin-top:20px; }
.bars i { flex:1; height:var(--h); border-radius:14px 14px 4px 4px; background:linear-gradient(#7fd4ff, #1f5fd6); transform-origin:bottom; transform: scaleY(0); animation: bar .6s cubic-bezier(.2,.9,.3,1.2) forwards; }
@keyframes bar { to { transform: scaleY(1); } }
/* panel ikon miring */
.tilt { width:1400px; padding:60px 70px 90px; border-radius:46px; border:2px solid rgba(127,212,255,.6); background:rgba(20,18,14,.7); transform: perspective(1600px) rotateX(22deg); box-shadow:0 0 140px -40px rgba(61,139,255,.6); }
.tilt__h { text-align:center; font-size:60px; font-weight:600; margin-bottom:50px; }
.tiles { display:grid; grid-template-columns:repeat(4,1fr); gap:30px; }
.tile { display:grid; justify-items:center; gap:14px; padding:36px 10px; border-radius:32px; background:#0f0e0b; border:2px solid rgba(180,220,255,.55); font-size:28px; font-weight:500; opacity:0; animation: pop .5s forwards; }
.tile .ic { width:70px; height:70px; color:var(--gold2); }
/* Anachronos */
.scene[data-ax] { place-items:start center; }
.axcap { margin-top:80px; padding:20px 46px 24px; border-radius:22px; text-align:center; background:linear-gradient(180deg, rgba(2,6,18,.85), rgba(2,6,18,.6)); border:1px solid rgba(127,227,255,.35); box-shadow:0 0 60px rgba(60,140,255,.25); }
.axcap small { display:block; font-family:"JetBrains Mono",monospace; font-size:18px; letter-spacing:.32em; color:#7fe3ff; }
.axcap b { display:block; margin-top:6px; font-size:56px; font-weight:600; letter-spacing:-.02em; }
.axcap em { color:#7fe3ff; }
/* penutup */
.center { display:grid; place-items:center; }
.line { display:flex; align-items:center; gap:26px; font-size:74px; font-weight:500; color:#f6f1e4; opacity:0; animation: up .6s forwards; }
.line b { font-weight:700; letter-spacing:.04em; color:var(--gold2); }
.spark .star.xs { width:70px; height:70px; animation: spin 1s cubic-bezier(.6,0,.3,1) forwards; filter: drop-shadow(0 0 20px rgba(127,212,255,.8)); }
.final { display:flex; align-items:center; gap:120px; color:#f6f1e4; }
.final__l { width:1000px; } .final h2 { margin-top:30px; font-size:86px; line-height:1.05; font-weight:600; letter-spacing:-.035em; }
.cta { margin-top:50px; display:inline-flex; align-items:center; gap:18px; padding:28px 54px; border-radius:99px; background:linear-gradient(90deg,#7fd4ff,#bfe6ff); color:#15120d; font-size:40px; font-weight:700; box-shadow:0 0 80px rgba(127,212,255,.6); }
.final__r { display:grid; justify-items:center; gap:10px; } .final__r b { margin-top:20px; font-size:40px; } .final__r small { font-size:26px; color:#a9c2e6; }
.qrbox { width:380px; padding:26px; border-radius:36px; background:#fff; box-shadow:0 0 0 10px rgba(127,212,255,.35), 0 0 120px rgba(127,212,255,.5); } .qrbox svg { width:100%; display:block; }
.wm { position:absolute; right:44px; bottom:30px; display:flex; align-items:center; gap:10px; font-size:20px; letter-spacing:.2em; font-weight:500; z-index:60; padding:8px 18px 8px 8px; border-radius:99px; background:#fff; color:#15233f; box-shadow:0 10px 30px -10px rgba(0,0,0,.5); }
.wm .logo { width:34px; height:30px; filter:none; }
.progress { position:absolute; left:0; bottom:0; height:4px; background:var(--gold); width:0; z-index:60; }


/* loading agen AI (gaya modern) */
.gen2 { display:grid; justify-items:center; gap:34px; }
.gorb { position:relative; width:230px; height:230px; display:grid; place-items:center; }
.gring { position:absolute; inset:0; border-radius:50%; background: conic-gradient(from 0deg, transparent 0 55%, #3d8bff 75%, #bfeaff 92%, transparent); -webkit-mask: radial-gradient(circle, transparent 60%, #000 62%); mask: radial-gradient(circle, transparent 60%, #000 62%); filter: drop-shadow(0 0 18px #3d8bff); animation: grot 1.1s linear infinite; }
.gring.r2 { inset:-26px; opacity:.55; animation-duration: 2.4s; animation-direction: reverse; background: conic-gradient(from 90deg, transparent 0 70%, #7fd4ff 88%, transparent); }
@keyframes grot { to { transform: rotate(360deg); } }
.glogo { width:120px; height:120px; border-radius:30px; background:#fff; display:grid; place-items:center; box-shadow:0 0 60px rgba(61,139,255,.75); animation: gbreath 1.4s ease-in-out infinite alternate; }
.glogo .logo { width:92px; height:80px; filter:none; }
@keyframes gbreath { to { transform: scale(1.06); box-shadow:0 0 90px rgba(127,212,255,.9); } }
.gtxt { font-size:50px; font-weight:500; color:#eef5ff; letter-spacing:-.02em; }
.shim { background: linear-gradient(90deg, #5fa8ff 0%, #ffffff 45%, #5fa8ff 70%); background-size:200% 100%; -webkit-background-clip:text; background-clip:text; color:transparent; -webkit-text-fill-color:transparent; animation: shm 1.4s linear infinite; text-shadow:none; }
@keyframes shm { from { background-position:150% 0; } to { background-position:-50% 0; } }
.gsteps { display:grid; gap:12px; min-width:560px; }
.gst { display:flex; align-items:center; gap:16px; padding:14px 22px; border-radius:16px; background:rgba(255,255,255,.05); border:1px solid rgba(127,212,255,.25); font-size:26px; color:#cfe3ff; opacity:0; animation: up .45s var(--d) forwards; }
.gst i { width:26px; height:26px; flex:none; border-radius:50%; border:3px solid rgba(127,212,255,.35); border-top-color:#7fd4ff; animation: grot .7s linear infinite, gdone .01s calc(var(--d) + .55s) forwards; }
@keyframes gdone { to { animation: none; border:0; background:#1d7a4b url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6 12l4 4 8-9' fill='none' stroke='white' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E") center/70% no-repeat; } }
/* ===== NEON BIRU (selaras logo K & Anachronos) ===== */
em { color:#7fd4ff; text-shadow: 0 0 8px rgba(127,212,255,.9), 0 0 24px rgba(61,139,255,.75), 0 0 56px rgba(61,139,255,.45); }
.kin .w, .cap, .divider, .line, .gen span, .pill-intro, .endtag, .tilt__h, .axcap b { text-shadow: 0 0 10px rgba(127,212,255,.45), 0 0 34px rgba(61,139,255,.35); }
.kin.gold .w, .kin .w.gold { color:#7fd4ff; text-shadow: 0 0 12px rgba(127,212,255,.95), 0 0 36px rgba(61,139,255,.8), 0 0 90px rgba(61,139,255,.55); }
.pill-intro b, .scene .line b, .endtag b { color:#e9f7ff; background:none; -webkit-text-fill-color:#e9f7ff; text-shadow: 0 0 10px rgba(127,212,255,.95), 0 0 30px rgba(61,139,255,.8), 0 0 70px rgba(61,139,255,.5); }
.line .cy { background:none; -webkit-text-fill-color:#7fd4ff; color:#7fd4ff; text-shadow: 0 0 10px rgba(127,212,255,.9), 0 0 30px rgba(61,139,255,.6); }
.card em, .mini em { text-shadow:none; }
.ask, .agentbar, .tilt, .pill-intro { box-shadow: 0 0 0 1px rgba(127,212,255,.55), 0 0 30px rgba(61,139,255,.45), 0 0 120px -20px rgba(61,139,255,.6); }
.askbtn, .btn.gold { background:linear-gradient(90deg,#3d8bff,#7fd4ff); color:#06122b; box-shadow:0 0 24px rgba(61,139,255,.7); }
.bub.me { background:linear-gradient(90deg,#2f7cff,#5fb8ff); color:#fff; box-shadow:0 0 30px rgba(61,139,255,.55); }
.card { box-shadow: 0 50px 120px -40px rgba(0,8,30,.9), 0 0 0 1px rgba(127,212,255,.35), 0 0 90px -30px rgba(61,139,255,.6); }
.progress { box-shadow:0 0 12px #3d8bff; }
.rip { border-color:#7fd4ff; box-shadow:0 0 14px rgba(127,212,255,.8); }
.typed::after { background:#7fd4ff; box-shadow:0 0 8px #7fd4ff; }
/* teks di dalam kartu putih tetap tinta gelap */
.card:not(.dk), .mini-p, .agentbar, .ticket { color:#15120d; text-shadow:none; }
.card:not(.dk) *, .mini-p *, .agentbar * { text-shadow:none; }
.card.dk { color:#eef5ff; }
</style></head><body>
<script src="produk/daftar.js"></script>
<div id="stage">
  <div class="bg bg--dark on" data-k="dark"></div>
  <div class="bg bg--light" data-k="light"><i></i><i></i><i></i></div>
  <div class="bg bg--blur" data-k="blur"></div>
  <div class="bg bg--rings" data-k="rings"></div>
  <div class="bg bg--final" data-k="final"></div>
  <div class="bg bg--doks" data-k="doks"></div>
  <div class="bg bg--doksplain" data-k="doksplain"></div>
  <svg width="0" height="0" style="position:absolute"><defs><linearGradient id="s3face" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8f6ff"/><stop offset=".35" stop-color="#7cc8ff"/><stop offset=".55" stop-color="#ffffff"><animate attributeName="offset" values=".2;.8;.2" dur="3s" repeatCount="indefinite"/></stop><stop offset=".75" stop-color="#2f7cf0"/><stop offset="1" stop-color="#0f3e9e"/></linearGradient></defs></svg>
  <iframe id="ax" src="anachronos/index.html" title="Anachronos" tabindex="-1"></iframe>
  ${S.join("\n")}
  <div class="wm">${logo()}KANTOONG KENZO AI</div>
  <div class="progress" id="prog"></div>
</div>
<script>
(() => {
  const stage = document.getElementById("stage");
  // KECEPATAN: 1 = cepat seperti contoh; makin besar makin pelan.
  const SLOW = 1.5;
  let scale = 1;
  const fit = () => { scale = Math.min(innerWidth / 1920, innerHeight / 1080); stage.style.transform = "translate(-50%,-50%) scale(" + scale + ")"; };
  addEventListener("resize", fit); fit();
  const ax = document.getElementById("ax");
  // FOTO PRODUK TEMAN: isi produk/daftar.js -> otomatis menggantikan foto & nama & harga contoh.
  const PROD = (window.PRODUK || []).filter((p) => p && p.foto);
  PROD.slice(0, 3).forEach((p, k) => {
    document.querySelectorAll('[data-slot="' + k + '"]').forEach((e) => { e.style.backgroundImage = "url('produk/" + encodeURI(p.foto) + "')"; e.style.backgroundSize = "cover"; e.style.backgroundPosition = "center"; });
    if (p.nama) document.querySelectorAll('[data-sname="' + k + '"]').forEach((e) => { e.textContent = p.nama; });
    if (p.harga) document.querySelectorAll('[data-sprice="' + k + '"]').forEach((e) => { e.textContent = p.harga; });
  });
  const bgs = [...document.querySelectorAll(".bg")];
  const scenes = [...document.querySelectorAll(".scene")];
  const starts = []; let acc = 0; scenes.forEach((s) => { starts.push(acc); acc += Number(s.dataset.d) * SLOW; });
  const total = acc;
  const prog = document.getElementById("prog");
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const type = (el, text, speed) => { let i = 0; el.textContent = ""; el.classList.remove("done"); const t = setInterval(() => { el.textContent = text.slice(0, ++i); if (i >= text.length) { clearInterval(t); setTimeout(() => el.classList.add("done"), 500); } }, speed); timers.push(t); };
  // posisi elemen di koordinat panggung 1920x1080
  const spot = (el) => { const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect(); return [(r.left - s.left + r.width / 2) / scale, (r.top - s.top + r.height / 2) / scale]; };

  const run = (sc) => {
    sc.querySelectorAll(".at[data-at]").forEach((e) => later(() => e.classList.add("show"), Number(e.dataset.at) * SLOW));
    sc.querySelectorAll(".typed[data-type]").forEach((e) => later(() => type(e, e.dataset.type, Number(e.dataset.speed || 40) * SLOW), Number(e.dataset.at || 0) * SLOW));
    sc.querySelectorAll("[data-count]").forEach((e) => {
      const [a, b] = e.dataset.count.split(">").map(Number); e.textContent = a;
      later(() => { const t0 = performance.now(); const step = () => { const k = Math.min(1, (performance.now() - t0) / 1000); e.textContent = Math.round(a + (b - a) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); }; step(); }, Number(e.dataset.at || 0) * SLOW);
    });
    sc.querySelectorAll(".hand").forEach((h) => {
      const steps = JSON.parse(h.dataset.steps);
      const pos = (target) => Array.isArray(target) ? target : spot(sc.querySelector(target));
      const place = (p) => { h.style.left = p[0] + "px"; h.style.top = p[1] + "px"; };
      h.style.transition = "none"; place(pos(steps[0][0])); void h.offsetWidth; h.style.transition = "";
      later(() => { h.style.opacity = "1"; }, 150);
      steps.slice(1).forEach(([target, ms, click]) => {
        later(() => place(pos(target)), Math.max(250, ms * SLOW - 1000));
        if (click) later(() => {
          h.classList.add("press"); setTimeout(() => h.classList.remove("press"), 180);
          const r = document.createElement("div"); r.className = "rip"; r.style.left = h.style.left; r.style.top = h.style.top; sc.appendChild(r); setTimeout(() => r.remove(), 750);
          const el = sc.querySelector(target);
          if (el) { el.classList.add("hit"); setTimeout(() => el.classList.remove("hit"), 160); onClick(sc, el); }
        }, ms * SLOW);
      });
    });
  };
  // reaksi tombol yang dipencet
  const onClick = (sc, el) => {
    if (el.classList.contains("opt")) { el.parentElement.querySelectorAll(".opt").forEach((o) => { if (!el.classList.contains("t3")) o.classList.remove("on"); }); el.classList.add("on"); }
    const row = el.closest(".tgtrow");
    if (row && row.classList.contains("dec")) { row.classList.add("done"); row.querySelector("i").textContent = "✓"; }
    if (row && row.classList.contains("fact")) setTimeout(() => row.classList.add("gone"), 250);
  };

  let i = Math.max(0, Math.min(scenes.length - 1, Number(new URLSearchParams(location.search).get("adegan") || 1) - 1)), tStart = 0;
  const show = () => {
    timers.splice(0).forEach((t) => { clearTimeout(t); clearInterval(t); });
    scenes.forEach((s, k) => {
      if (k === i) { const fresh = s.cloneNode(true); fresh.classList.remove("on"); s.replaceWith(fresh); scenes[k] = fresh; void fresh.offsetWidth; fresh.classList.add("on"); }
      else s.classList.remove("on");
    });
    const sc = scenes[i];
    const bg = sc.dataset.bg;
    bgs.forEach((b) => b.classList.toggle("on", b.dataset.k === bg));
    const seq = sc.dataset.ax;
    ax.classList.toggle("on", Boolean(seq));
    ax.contentWindow?.postMessage(seq ? { ax: "play", seq } : { ax: "sleep", on: true }, "*");
    // bangunkan Anachronos 1 adegan lebih awal agar langsung mulus
    if (!seq && scenes[i + 1]?.dataset.ax) ax.contentWindow?.postMessage({ ax: "play", seq: "orbit" }, "*");
    run(sc);
    tStart = performance.now() - starts[i];
    timers.push(setTimeout(() => { i = (i + 1) % scenes.length; show(); }, Number(sc.dataset.d) * SLOW));
    // animasi CSS ikut diperlambat sedikit
    requestAnimationFrame(() => sc.getAnimations({ subtree: true }).forEach((a) => { a.playbackRate = 1 / Math.sqrt(SLOW); }));
  };
  const tick = (t) => { prog.style.width = (((t - tStart) % total) / total * 100) + "%"; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  let started = false; const go = () => { if (!started) { started = true; show(); } };
  addEventListener("message", (e) => { if (e.data?.ax === "ready") setTimeout(go, 200); });
  setTimeout(go, 2500);
  addEventListener("keydown", (e) => {
    if (e.key === "f" || e.key === "F") document.documentElement.requestFullscreen?.();
    if (e.key === "ArrowRight") { i = (i + 1) % scenes.length; show(); }
    if (e.key === "ArrowLeft") { i = (i - 1 + scenes.length) % scenes.length; show(); }
  });
})();
</script>
</body></html>`;
for (const n of used) copyFileSync(`${SHOTS}/${n}.jpg`, `${OUT}/ui/${n}.jpg`);
mkdirSync(`${OUT}/logo`, { recursive: true });
copyFileSync("C:/Kantoong_AI_Master_Template/docs/pameran/logo/logo-kantoong-asli.png", `${OUT}/logo/logo-putih.png`);
copyFileSync("C:/Kantoong_AI_Master_Template/docs/pameran/logo/logo-kantoong-simbol.png", `${OUT}/logo/simbol.png`);
// Folder foto produk teman (tidak pernah ditimpa saat film dibangun ulang).
mkdirSync(`${OUT}/produk`, { recursive: true });
if (!existsSync(`${OUT}/produk/daftar.js`)) writeFileSync(`${OUT}/produk/daftar.js`, `// DAFTAR PRODUK TEMAN UNTUK FILM PAMERAN
// 1) Taruh foto produk (JPG/PNG/WEBP, sebaiknya persegi & latar rapi) di folder ini (docs/pameran/film/produk/).
// 2) Tulis 3 produk di bawah: urutan 1 = kartu produk + keranjang, 2 & 3 = rekomendasi AI di obrolan (bersama produk 1).
// 3) Simpan, lalu buka ulang index.html. Kosong = film memakai foto contoh Miloat.
window.PRODUK = [
  // { foto: "nama-file-foto.jpg", nama: "Nama Produk", harga: "Rp 25.000" },
  // { foto: "foto-kedua.jpg", nama: "Produk Kedua", harga: "Rp 40.000" },
  // { foto: "foto-ketiga.jpg", nama: "Produk Ketiga", harga: "Rp 18.000" },
];
`);
writeFileSync(`${OUT}/index.html`, html);
console.log("ok", S.length, "adegan,", (S.reduce((n, s) => n + Number(s.match(/data-d="(\d+)"/)[1]), 0) / 1000).toFixed(1), "detik,", used.size, "gambar");

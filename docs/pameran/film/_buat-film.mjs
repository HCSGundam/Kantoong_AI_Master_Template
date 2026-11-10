// FILM PAMERAN KANTOONG v3 — gaya motion SaaS (potongan UI diperbesar, kursor memencet, teks kinetik),
// tata letak bervariasi (HP saja / browser saja / kartu UI), + Anachronos 3D HIDUP (iframe, dikendalikan film).
// Pakai: node film3.mjs <folder-screenshot> <folder-anachronos-dist> <folder-keluaran>
import { writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync, existsSync, cpSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("C:/Kantoong_AI_Master_Template/package.json");
const QRCode = require("qrcode");

const [,, SHOTS, AXDIST, OUT] = process.argv;
for (const d of ["ui", "anachronos"]) if (existsSync(`${OUT}/${d}`)) rmSync(`${OUT}/${d}`, { recursive: true, force: true });
mkdirSync(`${OUT}/ui`, { recursive: true });
cpSync(AXDIST, `${OUT}/anachronos`, { recursive: true });
const used = new Set();
const img = (name) => { used.add(name); return `ui/${name}.jpg`; };
const DIM = { d: [2160, 1350], m: [780, 1688] };
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

/* ---------- Komponen ---------- */
// Kursor emas: path = [[x,y,ms,klik?], ...] dalam pecahan (0..1) wadahnya.
const cursor = (path) => `<div class="fcur" data-path='${JSON.stringify(path)}'></div>`;
// Potongan UI (crop) dari screenshot, lebar W px.
function crop(name, [x, y, w, h], W, { cls = "", inner = "", style = "" } = {}) {
  const [iw, ih] = DIM[name[0]];
  const s = W / (w * iw);
  const H = Math.round(h * ih * s);
  return `<div class="cropw" style="width:${W}px;height:${H}px;${style}"><div class="crop ${cls}"><img src="${img(name)}" style="width:${Math.round(iw * s)}px;left:${Math.round(-x * iw * s)}px;top:${Math.round(-y * ih * s)}px" alt=""></div>${inner}</div>`;
}
const text = ({ kicker, title, sub, pos = "left", delay = 0 }) => `
  <div class="cap cap--${pos}">
    ${kicker ? `<div class="cap__k in" style="animation-delay:${delay + 0.1}s">${kicker}</div>` : ""}
    <h2 class="cap__t in" style="animation-delay:${delay + 0.3}s">${title}</h2>
    ${sub ? `<p class="cap__s in" style="animation-delay:${delay + 0.7}s">${sub}</p>` : ""}
  </div>`;
const phone = (names, cls = "", extra = "", steps = "") => `<div class="ph ${cls}"><div class="ph__scr"><div class="reel" ${steps ? `data-steps="${steps}"` : ""}>${names.map((n) => `<img src="${img(n)}" alt="">`).join("")}</div>${extra}</div></div>`;
const browser = (names, { zoom, cls = "", inner = "" } = {}) => `
  <div class="bw ${cls}">
    <div class="bw__bar"><i></i><i></i><i></i><span>kantoong-kenzo-ai.pages.dev</span></div>
    <div class="bw__scr"><div class="bw__cam" ${zoom ? `data-zoom='${JSON.stringify(zoom)}'` : ""}><div class="reel">${names.map((n) => `<img src="${img(n)}" alt="">`).join("")}</div>${inner}</div></div>
  </div>`;
const at = (ms, html, cls = "pop") => `<div class="at ${cls}" data-at="${ms}">${html}</div>`;
const chip = (iconKey, label) => `<div class="chip">${ICON[iconKey]}<span>${label}</span></div>`;
const scene = (d, body, attrs = "") => `<section class="scene" data-d="${d}" ${attrs}>${body}</section>`;

/* ---------- Adegan ---------- */
const S = [];

S.push(scene(7000, `
  <div class="arc"></div>
  <div style="display:grid;justify-items:center;gap:40px;position:relative">
    <div class="brandline in" style="animation-delay:.2s">${logo}KANTOONG AI</div>
    <div class="mega">Karyawan AI</div>
    <div class="sub in" style="animation-delay:1.6s">untuk bisnis yang <span class="gold">jualannya enak</span>.</div>
  </div>`));

S.push(scene(6500, `
  <div class="kin">
    <span class="w" style="animation-delay:.2s">Jualannya</span><span class="w" style="animation-delay:.55s">enak.</span><br>
    <span class="w" style="animation-delay:1.6s">Ngurusnya</span><span class="w" style="animation-delay:2s">yang</span><span class="w hot" style="animation-delay:2.5s"><em>capek.</em></span>
  </div>`));

S.push(scene(6500, `
  <div class="title in">Cukup <em>bilang</em> saja.</div>
  <div class="ask in" style="animation-delay:.4s"><div class="q" id="askq"></div><div class="btn" id="askbtn">${star("xs")}<span>Tanya AI</span></div></div>
  <div class="cursor" id="cursor"></div>`, `data-js="ask"`));

S.push(scene(9500, `
  <div class="chat">
    <div class="row in"><div class="av">${ICON.user}</div><div class="bub" id="cq"></div></div>
    <div class="row in" style="animation-delay:.3s"><div class="av" style="color:#14120f;background:var(--gold)">${star("xs")}</div>
      <div class="bub ai"><div id="ca"><span class="dots"><span></span><span></span><span></span></span></div>
        <div class="prodcard" id="cp">${crop("m-produk", [0.07, 0.11, 0.9, 0.36], 170, { cls: "tiny" })}<div><b>Oatcookies</b><small>Masuk keranjang? Tinggal geser ke bawah.</small></div></div></div></div>
  </div>`, `data-js="chat"`));

// TOKO — HP saja, besar, berputar pelan + chip melayang
S.push(scene(10500, `
  ${text({ kicker: "01 · TOKO ONLINE", title: "Toko online<br><em>brand-mu.</em>", sub: "Dari depan seperti marketplace.<br>Di belakangnya ada AI." })}
  ${phone(["m-toko-1", "m-toko-2", "m-toko-3"], "ph--hero spin")}
  ${at(2200, chip("toko", "Rel terlaris otomatis"), "pop chipA")}
  ${at(3600, chip("box", "Kotak hadiah misteri"), "pop chipB")}
  ${at(5000, chip("money", "Kupon sekali klik"), "pop chipC")}`));

// TOKO di laptop — browser saja, kamera menyorot
S.push(scene(9000, `
  ${browser(["d-toko-1", "d-toko-3"], { cls: "bw--l2", zoom: { at: 4200, x: 0.5, y: 0.5, s: 1.3 } })}
  ${text({ kicker: "MODE DESKTOP", title: "Sama mewahnya<br>di <em>laptop.</em>", pos: "br" })}`));

// PRODUK — kartu UI besar, kursor pencet Keranjang
S.push(scene(9000, `
  ${text({ kicker: "02 · HALAMAN PRODUK", title: "Lihat, yakin,<br><em>masukkan.</em>", sub: "Harga coret hanya kalau benar.<br>Ragu? Bandingkan dulu." })}
  <div class="stagecard tiltR">${crop("m-produk", [0.07, 0.11, 0.9, 0.83], 420, { inner: cursor([[0.85, 1.1, 0], [0.7, 0.855, 2600, 1]]) + at(3100, `<div class="toast">${ICON.check}<span>Masuk keranjang</span></div>`, "pop toastPos") })}</div>`));

// KERANJANG — kartu, ingat alasan
S.push(scene(9000, `
  <div class="stagecard center up">${crop("m-keranjang", [0.03, 0.13, 0.94, 0.21], 860, { inner: cursor([[0.9, 1.4, 0], [0.48, 0.67, 2300, 1]]) })}</div>
  ${at(2900, `<div class="note"><small>Alasanmu (hanya di HP-mu)</small><b>“Buat hadiah ulang tahun Mama 🎁”</b></div>`, "pop notePos")}
  ${text({ kicker: "03 · KERANJANG", title: "Keranjang yang <em>ingat alasanmu.</em>", pos: "bottom" })}`));

// ASISTEN — HP + kartu izin besar di sampingnya
S.push(scene(10500, `
  ${phone(["m-chat-2"], "ph--left")}
  <div class="stagecard side">${crop("m-chat-2", [0.05, 0.53, 0.9, 0.29], 640, { inner: cursor([[0.95, 1.3, 0], [0.32, 0.71, 3200, 1]]) })}</div>
  ${at(3800, `<div class="toast big">${ICON.check}<span>Ingat di semua toko — dengan izinmu</span></div>`, "pop toastSide")}
  ${text({ kicker: "04 · ASISTEN AI", title: "Teman belanja yang <em>sopan.</em>", sub: "Ingat selera lintas toko — hanya kalau kamu izinkan.", pos: "br" })}`));

// DASHBOARD PEMBELI — browser saja + zoom
S.push(scene(9500, `
  ${text({ kicker: "05 · RUANG PRIBADI", title: "26 fitur untuk<br><em>pembeli.</em>", sub: "Pesanan, poin, voucher, wishlist —<br>atur kartunya sesukamu." })}
  ${browser(["d-dash"], { cls: "bw--right", zoom: { at: 3600, x: 0.5, y: 0.3, s: 1.45 } })}`));

// KARTU DIRIKU — kartu, hapus data
S.push(scene(8500, `
  <div class="stagecard tiltL">${crop("m-kartu-diriku", [0.04, 0.09, 0.92, 0.82], 430, { inner: cursor([[1.1, 0.7, 0], [0.5, 0.9, 2400, 1]]) + at(2900, `<div class="toast">${ICON.check}<span>Data dihapus</span></div>`, "pop toastPos2") })}</div>
  ${text({ kicker: "UU PDP", title: "Datamu, <em>milikmu.</em>", sub: "Lihat apa yang AI tahu.<br>Hapus kapan saja, satu ketukan.", pos: "right" })}`));

S.push(scene(6000, `
  <div class="divider">
    <div class="in" style="animation-delay:.2s">Itu yang dilihat <span class="gold">pembeli</span>.</div>
    <div class="in big" style="animation-delay:1.5s">Sekarang… <em>dapur bisnisnya.</em></div>
  </div>`));

// KOMANDO — browser, zoom ke 3 keputusan, kursor pencet Selesaikan
S.push(scene(11000, `
  ${browser(["d-erp-komando"], { cls: "bw--l2", zoom: { at: 2600, x: 0.58, y: 0.41, s: 1.75 }, inner: cursor([[0.9, 0.95, 0], [0.9, 0.95, 3800], [0.795, 0.333, 6200, 1]]) + at(6800, `<div class="toast sm">${ICON.check}<span>Pesan tagihan disiapkan</span></div>`, "pop toastKomando") })}
  ${text({ kicker: "06 · RUANG KOMANDO", title: "Buka pagi,<br><em>langsung tahu.</em>", sub: "3 keputusan terpenting hari ini.", pos: "br" })}`));

// UANG — kartu-kartu melayang
S.push(scene(10000, `
  ${text({ kicker: "07 · KEUANGAN & LAPORAN", title: "Angka yang<br><em>bercerita.</em>", sub: "Setiap transaksi langsung<br>masuk pembukuan." })}
  <div class="float f1">${crop("d-erp-keuangan", [0.41, 0.3, 0.38, 0.5], 620)}</div>
  <div class="float f2">${crop("d-erp-laporan", [0.21, 0.2, 0.77, 0.38], 760)}</div>
  <div class="float f3">${crop("d-erp-resep", [0.2, 0.2, 0.78, 0.18], 700)}</div>`));

// KASIR — HP + tiket dapur
S.push(scene(12000, `
  ${phone(["m-kasir", "m-kasir-2"], "ph--center", cursor([[0.8, 1.05, 0], [0.8, 1.05, 3600], [0.48, 0.21, 4800, 1], [0.53, 0.3, 5900, 1], [0.66, 0.885, 7100, 1]]), "2800")}
  ${text({ kicker: "08 · KASIR POS", title: "Kasir untuk<br>toko & <em>F&B.</em>", sub: "Varian, topping, split bill.<br>Tetap jalan saat sinyal hilang." })}
  ${at(7800, `<div class="ticket-wrap"><div class="tlabel">Langsung ke dapur →</div>${crop("m-dapur", [0.04, 0.69, 0.92, 0.22], 520)}</div>`, "pop ticketPos")}`));

// AGEN AI + DOKUMEN
S.push(scene(12000, `
  ${text({ kicker: "09 · AGEN AI & DOKUMEN", title: "Tinggal <em>perintah.</em>", sub: "Agen menyiapkan. Kamu yang tanda tangan.", pos: "top" })}
  <div class="stagecard wide">${crop("d-erp-agen", [0.2, 0.2, 0.78, 0.22], 1300, { inner: `<div class="typed" data-type="Buatkan invoice untuk Kafe Senja" data-at="1200"></div>` + cursor([[0.6, 1.4, 0], [0.6, 1.4, 3400], [0.918, 0.32, 4600, 1]]) })}</div>
  ${at(5400, `<div class="doccard">${crop("d-erp-dokumen", [0.2, 0.3, 0.55, 0.68], 560)}<div class="stamp">QR KEASLIAN ✓</div></div>`, "pop docPos")}`));

// ETALASE (dashboard admin) — browser kiri
S.push(scene(9500, `
  ${browser(["d-erp-etalase"], { cls: "bw--left", zoom: { at: 3400, x: 0.82, y: 0.55, s: 1.8 } })}
  ${text({ kicker: "10 · DASHBOARD ADMIN", title: "Atur toko<br><em>tanpa coding.</em>", sub: "Akses per email, divisi, jabatan.<br>Pratinjau langsung.", pos: "right" })}`));

S.push(scene(9000, `
  <div class="title in">Saat kamu tidur, <em>dia</em> tetap kerja.</div>
  <div class="stack">
    <div class="task" style="animation: fadeUp .9s .5s forwards"><div class="ti">${ICON.doc}</div><div><b>Invoice INV/014 terbit</b><small>Lengkap dengan QR keaslian</small></div><div class="ok">${ICON.check}</div></div>
    <div class="task" style="animation: fadeUp .9s 1.6s forwards"><div class="ti">${ICON.box}</div><div><b>Kopi habis 3 hari lagi</b><small>PO restok sudah diajukan ke atasan</small></div><div class="ok">${ICON.check}</div></div>
    <div class="task hl" style="animation: fadeUp .9s 2.7s forwards"><div class="ti">${ICON.money}</div><div><b>Rp18,1 jt piutang ditagih</b><small>Pesan pengingat siap kamu kirim</small></div><div class="ok">${ICON.check}</div></div>
    <div class="task" style="animation: fadeUp .9s 3.8s forwards"><div class="ti">${ICON.chat}</div><div><b>Pembeli: “Ada ukuran M?”</b><small>Dijawab pukul 02.14</small></div><div class="ok">${ICON.check}</div></div>
  </div>`));

S.push(scene(8000, `
  <div class="title in">Semua jadi <em>satu sistem.</em></div>
  <div class="panel in" style="animation-delay:.3s">
    <h3>Toko, kasir, gudang, keuangan — saling terhubung</h3>
    <div class="tiles">
      ${[["toko","Toko online"],["chat","Asisten AI"],["pos","Kasir POS"],["erp","ERP & laporan"],["doc","Dokumen & PDF"],["box","Gudang & stok"],["money","Keuangan"],["agent","Agen AI"]]
        .map(([k, l], i) => `<div class="tile" style="animation-delay:${(0.7 + i * 0.18).toFixed(2)}s">${ICON[k]}<span>${l}</span></div>`).join("")}
    </div>
  </div>`));

// ANACHRONOS — pembuka bola emas
S.push(scene(8000, `
  <div class="hud">
    <canvas id="globe" width="1920" height="1080"></canvas>
    <div class="hud__rings"><i></i><i></i><i></i></div>
    <div class="hud__corner a">SYS // ANACHRONOS<br>LINK ............ OK<br>NEURON SYNC ..... 360</div>
    <div class="hud__corner b">KANTOONG NETWORK<br>BRAND AKTIF 12<br>AGENTS ONLINE 10</div>
    <div class="hud__txt"><small class="in" style="animation-delay:.5s">SATU LAGI…</small><b class="in" style="animation-delay:1.2s">ANACHRONOS</b><span class="in" style="animation-delay:2s">Digital Mall · Second Brain</span></div>
  </div>`, `data-js="globe" class-extra="ana"`));

// ANACHRONOS HIDUP
const axCap = (k, t, s) => `<div class="axcap"><small class="in" style="animation-delay:.3s">${k}</small><b class="in" style="animation-delay:.6s">${t}</b>${s ? `<span class="in" style="animation-delay:1s">${s}</span>` : ""}</div>`;
S.push(scene(11000, axCap("ANACHRONOS DIGITAL MALL · LIVE", "12 brand · 360 neuron · <em>satu otak.</em>", "Setiap toko Kantoong adalah satu neuron yang hidup."), `data-ax="orbit"`));
S.push(scene(13000, axCap("KLIK SATU NEURON", "Masuk ke <em>dalam</em> brand.", "Traffic, chat AI, keranjang, penjualan — jadi organ."), `data-ax="dive"`));
S.push(scene(15500, axCap("SETIAP ORGAN BISA DIBUKA", "Dari keranjang… sampai <em>produknya.</em>", "Data asli toko, terlihat seperti makhluk hidup."), `data-ax="organs"`));
S.push(scene(11000, axCap("SECOND BRAIN", "Bisnismu, dilihat <em>dari atas.</em>", "Dikendalikan juga dengan gerakan tangan (CHRONOS)."), `data-ax="cinema"`));

S.push(scene(6000, `
  <div class="future">
    <div class="in" style="animation-delay:.2s">Masa depan bisnismu</div>
    <div class="in fl" style="animation-delay:.9s">${star("sm")}<span>ada di sini.</span></div>
  </div>`));
S.push(scene(5500, `
  <div class="arc"></div>
  <div class="withk">
    <span class="in" style="animation-delay:.2s">bersama</span>
    <span class="in" style="animation-delay:.7s">${star("sm")}</span>
    <span class="in kname" style="animation-delay:1.2s">${logo}KANTOONG AI</span>
  </div>`));
S.push(scene(11000, `
  <div class="final">
    <div>
      <div class="brandline in" style="margin-bottom:46px">${logo}KANTOONG AI</div>
      <h2 class="in" style="animation-delay:.4s">Biar karyawan<br><b>KANTOONG AI</b><br>yang ngurus.</h2>
      <p class="sub in" style="animation-delay:.9s;margin-top:34px">Toko · Asisten AI · Kasir · ERP · Dokumen — satu pintu.</p>
      <div class="cta in" style="animation-delay:1.6s">${star("xs")}<span>Coba sekarang</span></div>
    </div>
    <div class="in" style="animation-delay:1.2s"><div class="qrbox">${qr}</div><div class="qrcap">Scan, coba 1 menit</div><div class="qrurl">kantoong-kenzo-ai.pages.dev</div></div>
  </div>`));

const body = S.join("\n").replace(/data-js="globe" class-extra="ana"/, 'data-js="globe" data-dark="1"');

const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kantoong AI — Film Pameran</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@1,500&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
:root { --bg:#08080a; --ink:#f6f1e4; --muted:#a9a295; --gold:#e3c46a; --cyan:#7fe3ff; }
* { box-sizing:border-box; margin:0; padding:0; }
html,body { width:100%; height:100%; background:#000; overflow:hidden; cursor:none; }
body { font-family:"Poppins","Segoe UI",sans-serif; color:var(--ink); }
#stage { position:absolute; left:50%; top:50%; width:1920px; height:1080px; overflow:hidden; background:var(--bg); transform-origin:center; }
.bgglow { position:absolute; inset:-20%; background:radial-gradient(40% 35% at 50% 110%, rgba(227,196,106,.42), transparent 70%), radial-gradient(30% 30% at 85% 10%, rgba(80,120,255,.16), transparent 70%); animation: drift 18s ease-in-out infinite alternate; }
@keyframes drift { to { transform: translate(-3%, -2%) scale(1.06); } }
.grid { position:absolute; left:-20%; right:-20%; bottom:-10%; height:55%; background-image:linear-gradient(rgba(227,196,106,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(227,196,106,.14) 1px, transparent 1px); background-size:90px 90px; transform: perspective(700px) rotateX(62deg); transform-origin: top; mask-image: linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent); opacity:.5; }
/* lapisan Anachronos hidup */
#ax { position:absolute; inset:0; width:1920px; height:1080px; border:0; opacity:0; transition: opacity 1.1s ease; z-index:1; pointer-events:none; background:#02040a; }
#ax.on { opacity:1; }
.scene { position:absolute; inset:0; display:grid; place-items:center; opacity:0; visibility:hidden; transition: opacity .9s ease, visibility 0s linear .9s; z-index:2; }
.scene.on { opacity:1; visibility:visible; transition: opacity .9s ease; }
.scene[data-dark] { background: radial-gradient(60% 60% at 50% 50%, rgba(20,40,90,.55), #02040a 75%); }
.scene * { animation-play-state: paused; }
.scene.on * { animation-play-state: running; }
.in { opacity:0; animation: fadeUp 1s cubic-bezier(.2,.8,.2,1) forwards; }
@keyframes fadeUp { from { opacity:0; transform: translateY(40px) scale(.98); filter:blur(8px); } to { opacity:1; transform:none; filter:none; } }
@keyframes pop { 0% { opacity:0; transform: scale(.6); } 70% { opacity:1; transform: scale(1.05); } 100% { opacity:1; transform:none; } }
em { font-family:"Playfair Display",serif; font-style:italic; font-weight:500; color:var(--gold); }
.gold { color:var(--gold); }
.logo { width:64px; height:64px; }
.brandline { display:flex; align-items:center; gap:18px; font-size:30px; font-weight:600; letter-spacing:.22em; }
.mega { font-size:200px; font-weight:700; letter-spacing:-.04em; line-height:1; background:linear-gradient(100deg,#fff3cc 0%, #e3c46a 45%, #fff 60%, #c9a227 100%); background-size:200% 100%; -webkit-background-clip:text; background-clip:text; color:transparent; animation: fadeUp 1.2s .6s cubic-bezier(.2,.8,.2,1) forwards, sheen 4s 1.8s linear infinite; opacity:0; }
@keyframes sheen { to { background-position:-200% 0; } }
.arc { position:absolute; width:2200px; height:1400px; left:50%; margin-left:-1100px; top:62%; border-radius:50%; border-top:3px solid rgba(227,196,106,.65); box-shadow: 0 -60px 160px -40px rgba(227,196,106,.55) inset, 0 -40px 120px -30px rgba(227,196,106,.4); opacity:0; animation: fadeUp 1.6s forwards; }
.sub { font-size:38px; font-weight:300; color:var(--muted); }
.title { position:absolute; top:60px; z-index:5; left:0; right:0; text-align:center; font-size:64px; font-weight:600; letter-spacing:-.02em; }
/* teks kinetik */
.kin { text-align:center; font-size:150px; font-weight:700; letter-spacing:-.045em; line-height:1.1; }
.kin .w { display:inline-block; margin:0 .14em; opacity:0; animation: word .8s cubic-bezier(.2,.9,.2,1.2) forwards; }
.kin .hot em { font-size:1.05em; }
@keyframes word { from { opacity:0; transform: translateY(70px) rotate(4deg); filter: blur(10px); } to { opacity:1; transform:none; filter:none; } }
/* keterangan */
.cap { position:absolute; z-index:6; width:640px; }
.cap--left { left:120px; top:50%; transform: translateY(-50%); }
.cap--right { right:110px; top:50%; transform: translateY(-50%); }
.cap--tr { right:110px; top:120px; width:600px; }
.cap--br { right:100px; bottom:110px; width:560px; text-align:right; }
.cap--top { left:0; right:0; top:70px; width:auto; text-align:center; }
.cap--bottom { left:0; right:0; bottom:110px; width:auto; text-align:center; }
.cap__k { font-size:21px; font-weight:600; letter-spacing:.32em; color:var(--gold); }
.cap__t { margin-top:22px; font-size:78px; line-height:1.04; font-weight:600; letter-spacing:-.035em; }
.cap--top .cap__t, .cap--bottom .cap__t { font-size:70px; }
.cap__s { margin-top:24px; font-size:30px; line-height:1.4; font-weight:300; color:var(--muted); }
.cap--br .cap__t { font-size:66px; }
/* HP */
.ph { position:absolute; width:400px; height:850px; border-radius:62px; padding:14px; background:linear-gradient(145deg,#2c2924,#0d0c0a); border:2px solid rgba(227,196,106,.6);
  box-shadow: 0 80px 160px -50px rgba(0,0,0,.95), 0 0 110px -30px rgba(227,196,106,.55); opacity:0; animation: phIn 1.3s .2s cubic-bezier(.2,.8,.2,1) forwards; }
.ph::before { content:""; position:absolute; top:26px; left:50%; width:110px; height:30px; margin-left:-55px; border-radius:20px; background:#000; z-index:3; }
.ph__scr { position:relative; width:100%; height:100%; border-radius:49px; overflow:hidden; background:#f6f1e7; }
.ph--hero { left:50%; top:115px; margin-left:-60px; }
.ph--left { left:200px; top:115px; }
.ph--center { left:50%; top:115px; margin-left:20px; }
.ph.spin { animation: phIn 1.3s .2s cubic-bezier(.2,.8,.2,1) forwards, sway 9s 1.5s ease-in-out infinite alternate; }
@keyframes phIn { from { opacity:0; transform: perspective(1800px) translateY(160px) rotateX(24deg) rotateY(-30deg) scale(.85); } to { opacity:1; transform: perspective(1800px) rotateY(-12deg) rotateX(4deg); } }
@keyframes sway { from { transform: perspective(1800px) rotateY(-12deg) rotateX(4deg); } to { transform: perspective(1800px) rotateY(8deg) rotateX(-2deg) translateY(-14px); } }
.reel { position:absolute; inset:0; }
.reel img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:top; transform: translateY(100%); transition: transform 1.1s cubic-bezier(.7,0,.2,1); }
.reel img:first-child, .reel img.cur { transform:none; }
.reel img.past { transform: translateY(-100%); }
/* browser */
.bw { position:absolute; width:1240px; border-radius:22px; overflow:hidden; background:#121110; border:1.5px solid rgba(227,196,106,.5);
  box-shadow: 0 90px 160px -50px rgba(0,0,0,.95), 0 0 120px -40px rgba(227,196,106,.5); opacity:0; animation: bwIn 1.4s .2s cubic-bezier(.2,.8,.2,1) forwards; }
.bw__bar { height:46px; display:flex; align-items:center; gap:10px; padding:0 20px; background:#1b1a17; border-bottom:1px solid rgba(255,255,255,.06); }
.bw__bar i { width:13px; height:13px; border-radius:50%; background:#3a3833; } .bw__bar i:first-child { background:#c9a227; }
.bw__bar span { margin-left:22px; padding:6px 22px; border-radius:99px; background:#0d0c0b; font-size:16px; color:#a9a295; }
.bw__scr { position:relative; width:1240px; height:775px; overflow:hidden; background:#f6f1e7; }
.bw__cam { position:absolute; inset:0; transition: transform 2.2s cubic-bezier(.65,0,.25,1); transform-origin:0 0; }
.bw--hero { left:50%; top:110px; margin-left:-760px; }
.bw--l2 { left:90px; top:130px; width:1150px; } .bw--l2 .bw__scr { width:1150px; height:719px; }
.bw--right { right:80px; top:150px; width:1100px; } .bw--right .bw__scr { width:1100px; height:688px; }
.bw--left { left:80px; top:150px; width:1100px; } .bw--left .bw__scr { width:1100px; height:688px; }
@keyframes bwIn { from { opacity:0; transform: perspective(2200px) translateY(140px) rotateX(28deg) scale(.86); } to { opacity:1; transform: perspective(2200px) rotateX(6deg) rotateY(-4deg); } }
.bw--left { animation-name: bwInL; } @keyframes bwInL { from { opacity:0; transform: perspective(2200px) translateY(140px) rotateX(28deg) scale(.86); } to { opacity:1; transform: perspective(2200px) rotateX(5deg) rotateY(5deg); } }
/* potongan UI */
.cropw { position:relative; }
.crop { position:absolute; inset:0; overflow:hidden; border-radius:30px; background:#f6f1e7; }
.crop > img { position:absolute; max-width:none; }
.crop.tiny { border-radius:16px; }
.stagecard { position:absolute; z-index:4; opacity:0; animation: cardIn 1.2s .2s cubic-bezier(.2,.8,.2,1) forwards; }
.stagecard .crop { box-shadow: 0 80px 140px -40px rgba(0,0,0,.95), 0 0 0 1.5px rgba(227,196,106,.55), 0 0 110px -30px rgba(227,196,106,.55); }
@keyframes cardIn { from { opacity:0; transform: perspective(1800px) translateY(120px) rotateX(30deg) scale(.8); } to { opacity:1; transform: perspective(1800px) var(--rest, none); } }
.stagecard.tiltR { right:240px; top:110px; --rest: rotateY(-10deg) rotateX(4deg); }
.stagecard.tiltL { left:240px; top:120px; --rest: rotateY(10deg) rotateX(4deg); }
.stagecard.center { left:50%; margin-left:-430px; top:210px; --rest: rotateX(8deg); }
.stagecard.side { left:720px; top:300px; --rest: rotateY(-8deg); }
.stagecard.wide { left:50%; margin-left:-650px; top:300px; --rest: rotateX(10deg); }
.float { position:absolute; opacity:0; z-index:3; animation: cardIn 1.2s cubic-bezier(.2,.8,.2,1) forwards, bob 6s 1.4s ease-in-out infinite alternate; }
.float .crop { box-shadow: 0 60px 120px -40px rgba(0,0,0,.95), 0 0 0 1.5px rgba(227,196,106,.5); border-radius:24px; }
.float.f1 { right:520px; top:110px; animation-delay:.3s, 1.5s; --rest: rotateY(-8deg) rotateZ(-2deg); }
.float.f2 { right:90px; top:430px; animation-delay:1s, 2.2s; --rest: rotateY(-10deg) rotateZ(1.5deg); z-index:4; }
.float.f3 { right:600px; top:820px; animation-delay:1.7s, 2.9s; --rest: rotateX(8deg); z-index:5; }
@keyframes bob { from { translate: 0 0; } to { translate: 0 -16px; } }
/* elemen muncul berjadwal */
.at { position:absolute; opacity:0; pointer-events:none; z-index:7; }
.at.show.pop { animation: pop .7s cubic-bezier(.2,.9,.3,1.3) forwards; }
.chip { display:flex; align-items:center; gap:16px; padding:20px 30px; border-radius:24px; background:rgba(20,19,16,.92); border:1.5px solid rgba(227,196,106,.55); font-size:28px; font-weight:500; box-shadow:0 30px 80px -30px rgba(0,0,0,.9), 0 0 50px -20px rgba(227,196,106,.5); white-space:nowrap; }
.chip svg { width:40px; height:40px; color:var(--gold); }
.chipA { left:1350px; top:240px; } .chipB { left:1420px; top:470px; } .chipC { left:1330px; top:700px; }
.toast { display:flex; align-items:center; gap:14px; padding:18px 30px; border-radius:99px; background:#1d7a4b; color:#eafff2; font-size:26px; font-weight:600; white-space:nowrap; box-shadow:0 20px 60px -20px rgba(0,0,0,.8); }
.toast svg { width:30px; height:30px; } .toast.big { font-size:30px; padding:22px 36px; } .toast.sm { font-size:22px; padding:12px 24px; }
.toastPos { left:50%; bottom:-30px; transform:translateX(-50%); } .toastPos.show { animation-name: popc !important; }
@keyframes popc { from { opacity:0; transform: translate(-50%, 20px) scale(.7); } to { opacity:1; transform: translate(-50%, 0); } }
.toastPos2 { left:50%; bottom:-30px; } .toastPos2.show { animation-name: popc !important; }
.toastSide { left:740px; top:190px; } .toastKomando { left:60%; top:41%; }
.note { width:640px; padding:28px 36px; border-radius:26px; background:#fffaf0; color:#14120f; box-shadow:0 40px 90px -30px rgba(0,0,0,.9), 0 0 0 2px var(--gold); }
.note small { display:block; font-size:20px; color:#8a7a50; font-weight:500; letter-spacing:.06em; } .note b { display:block; margin-top:8px; font-size:34px; font-weight:600; }
.notePos { left:50%; margin-left:-60px; top:560px; }
.ticket-wrap .crop { box-shadow: 0 50px 110px -30px rgba(0,0,0,.95), 0 0 0 2px var(--gold); border-radius:24px; }
.tlabel { margin-bottom:14px; font-size:24px; font-weight:600; color:var(--gold); letter-spacing:.08em; }
.ticketPos { right:110px; top:620px; }
.doccard { position:relative; } .doccard .crop { box-shadow: 0 60px 120px -40px rgba(0,0,0,.95), 0 0 0 2px var(--gold); border-radius:24px; }
.stamp { position:absolute; right:-30px; top:-30px; padding:16px 26px; border-radius:16px; background:var(--gold); color:#14120f; font-weight:700; font-size:22px; letter-spacing:.1em; transform: rotate(6deg); box-shadow:0 20px 50px -10px rgba(0,0,0,.8); }
.docPos { left:50%; margin-left:-20px; top:570px; }
.typed { position:absolute; left:8.4%; top:32%; transform:translateY(-50%); width:70%; padding:4px 0 4px 6px; background:#fff; font-size:27px; color:#14120f; white-space:nowrap; overflow:hidden; }
.typed::after { content:"|"; color:var(--gold); animation: blinkc 1s steps(1) infinite; } @keyframes blinkc { 50% { opacity:0; } }
/* kursor */
.fcur { position:absolute; left:0; top:0; width:58px; height:58px; margin:-29px 0 0 -29px; border-radius:50%; border:3px solid #ffe7b0; background:rgba(227,196,106,.2); box-shadow:0 0 30px rgba(227,196,106,.8); z-index:20; opacity:0; transition: left 1.2s cubic-bezier(.6,0,.2,1), top 1.2s cubic-bezier(.6,0,.2,1), opacity .4s, transform .18s; pointer-events:none; }
.fcur::after { content:""; position:absolute; left:50%; top:50%; width:10px; height:10px; margin:-5px; border-radius:50%; background:#fff3cf; }
.fcur.press { transform: scale(.72); }
.rip { position:absolute; width:30px; height:30px; margin:-15px; border-radius:50%; border:3px solid #ffe7b0; z-index:19; pointer-events:none; animation: rip .9s ease-out forwards; }
@keyframes rip { to { transform: scale(6); opacity:0; } }
/* tanya + chat (dari versi sebelumnya) */
.ask { position:relative; width:1180px; height:150px; border-radius:99px; background:rgba(14,14,16,.9); border:2px solid rgba(227,196,106,.45); display:flex; align-items:center; padding:0 26px 0 56px; gap:28px; box-shadow:0 0 0 14px rgba(227,196,106,.06), 0 30px 120px -20px rgba(227,196,106,.35); }
.ask .q { flex:1; font-size:46px; font-weight:300; color:#cfc7b6; white-space:nowrap; overflow:hidden; }
.ask .btn { display:flex; align-items:center; gap:16px; padding:24px 44px; border-radius:99px; border:2px solid var(--gold); font-size:42px; font-weight:600; transition: background .3s, color .3s; }
.ask .btn.press { background:var(--gold); color:#14120f; box-shadow:0 0 60px rgba(227,196,106,.7); }
.cursor { position:absolute; width:90px; height:90px; border-radius:50%; border:3px solid rgba(255,244,207,.85); background:rgba(227,196,106,.12); left:1300px; top:700px; transition: left 1.4s cubic-bezier(.6,0,.2,1), top 1.4s cubic-bezier(.6,0,.2,1), transform .2s; }
.chat { width:1240px; display:grid; gap:44px; }
.row { display:grid; grid-template-columns:110px 1fr; gap:36px; align-items:start; }
.av { width:110px; height:110px; border-radius:50%; border:2px solid rgba(227,196,106,.55); display:grid; place-items:center; background:rgba(227,196,106,.08); color:var(--gold); box-shadow:0 0 40px rgba(227,196,106,.25); }
.av svg { width:54px; height:54px; }
.bub { min-height:110px; padding:30px 44px; border-radius:30px; border:2px solid rgba(227,196,106,.5); background:rgba(16,15,13,.85); font-size:46px; line-height:1.35; }
.bub.ai { border-color: rgba(227,196,106,.85); }
.dots span { display:inline-block; width:16px; height:16px; border-radius:50%; background:var(--gold); margin-right:12px; animation: blink 1s infinite; }
.dots span:nth-child(2) { animation-delay:.2s } .dots span:nth-child(3) { animation-delay:.4s }
@keyframes blink { 50% { opacity:.25; transform: translateY(-6px); } }
.prodcard { margin-top:22px; display:flex; gap:22px; align-items:center; padding:16px; border-radius:22px; background:rgba(255,255,255,.05); border:1.5px solid rgba(227,196,106,.3); width:max-content; opacity:0; }
.prodcard b { font-size:36px; } .prodcard small { display:block; font-size:30px; color:var(--gold); }
.divider { display:grid; justify-items:center; gap:30px; text-align:center; font-size:64px; font-weight:300; }
.divider .big { font-size:120px; font-weight:600; letter-spacing:-.035em; }
.stack { display:grid; gap:26px; width:1100px; margin-top:120px; }
.task { display:grid; grid-template-columns:96px 1fr auto; gap:30px; align-items:center; padding:28px 36px; border-radius:30px; background:rgba(20,19,16,.9); border:2px solid rgba(227,196,106,.4); opacity:0; }
.task .ti { width:96px; height:96px; border-radius:26px; display:grid; place-items:center; background:rgba(227,196,106,.14); color:var(--gold); }
.task .ti svg { width:48px; height:48px; }
.task b { font-size:42px; font-weight:600; } .task small { display:block; font-size:30px; color:var(--muted); margin-top:4px; }
.task .ok { width:72px; height:72px; border-radius:50%; background:#1d7a4b; color:#eafff2; display:grid; place-items:center; } .task .ok svg { width:40px; height:40px; }
.task.hl { background: linear-gradient(90deg, rgba(227,196,106,.95), rgba(240,214,140,.95)); color:#14120f; }
.task.hl small { color:#4a3d16; } .task.hl .ti { background:rgba(20,18,15,.12); color:#14120f; }
.panel { position:relative; width:1300px; padding:60px 70px 80px; border-radius:44px; border:2.5px solid rgba(227,196,106,.7); background:rgba(12,12,13,.8); box-shadow:0 0 120px -40px rgba(227,196,106,.55); transform: perspective(1600px) rotateX(18deg); margin-top:150px; }
.panel h3 { text-align:center; font-size:44px; font-weight:500; margin-bottom:46px; color:#f3e6bf; }
.tiles { display:grid; grid-template-columns:repeat(4,1fr); gap:34px; }
.tile { display:grid; justify-items:center; gap:16px; padding:34px 10px; border-radius:30px; border:2px solid rgba(255,244,207,.6); background:#111; font-size:28px; font-weight:500; opacity:0; animation: pop .8s forwards; }
.tile svg { width:74px; height:74px; color:var(--gold); }
/* HUD pembuka Anachronos */
.hud { position:relative; width:1920px; height:1080px; display:grid; place-items:center; }
.hud canvas { position:absolute; inset:0; }
.hud__rings { position:absolute; left:50%; top:50%; width:0; height:0; }
.hud__rings i { position:absolute; border-radius:50%; border:2px solid rgba(255,179,71,.55); box-shadow:0 0 30px rgba(255,140,40,.35); }
.hud__rings i:nth-child(1) { width:820px; height:820px; left:-410px; top:-410px; border-style:dashed; animation: rot 24s linear infinite; }
.hud__rings i:nth-child(2) { width:940px; height:940px; left:-470px; top:-470px; border-width:6px; border-color: rgba(255,179,71,.7) transparent rgba(255,179,71,.7) transparent; animation: rot 9s linear infinite reverse; }
.hud__rings i:nth-child(3) { width:1060px; height:1060px; left:-530px; top:-530px; border-style:dotted; border-width:4px; animation: rot 40s linear infinite; }
@keyframes rot { to { transform: rotate(360deg); } }
.hud__txt { position:relative; z-index:3; text-align:center; }
.hud__txt small { display:block; font-family:"JetBrains Mono",monospace; font-size:22px; letter-spacing:.4em; color:#ffc27a; }
.hud__txt b { display:block; margin-top:16px; font-size:110px; font-weight:700; letter-spacing:.06em; background:linear-gradient(180deg,#fff6e0,#ffb347 60%,#c46a10); -webkit-background-clip:text; background-clip:text; color:transparent; filter: drop-shadow(0 0 30px rgba(255,150,40,.55)); }
.hud__txt span { display:block; margin-top:10px; font-size:34px; font-weight:300; color:#ffe2b8; letter-spacing:.08em; }
.hud__corner { position:absolute; font-family:"JetBrains Mono",monospace; font-size:20px; color:rgba(255,194,122,.85); line-height:1.6; z-index:3; }
.hud__corner.a { left:70px; top:60px; } .hud__corner.b { right:70px; bottom:60px; text-align:right; }
/* keterangan di atas Anachronos hidup */
.scene[data-ax] { place-items:start center; }
.axcap { margin-top:96px; padding:22px 44px 26px; border-radius:22px; text-align:center; background:linear-gradient(180deg, rgba(2,6,18,.82), rgba(2,6,18,.55)); border:1px solid rgba(127,227,255,.35); box-shadow:0 0 60px rgba(60,140,255,.25); backdrop-filter: blur(6px); }
.axcap small { display:block; font-family:"JetBrains Mono",monospace; font-size:18px; letter-spacing:.32em; color:var(--cyan); }
.axcap b { display:block; margin-top:8px; font-size:54px; font-weight:600; letter-spacing:-.02em; }
.axcap b em { color:var(--cyan); }
.axcap span { display:block; margin-top:6px; font-size:24px; font-weight:300; color:#c6d6ff; }
/* penutup */
.star { width:260px; height:260px; filter: drop-shadow(0 0 40px rgba(227,196,106,.7)); animation: spin 5s cubic-bezier(.6,0,.3,1) infinite; }
@keyframes spin { 0% { transform: rotate(0) scale(.6); } 50% { transform: rotate(180deg) scale(1); } 100% { transform: rotate(360deg) scale(.6); } }
.star.sm { width:120px; height:120px; } .star.xs { width:46px; height:46px; animation:none; filter:none; }
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
  <iframe id="ax" src="anachronos/index.html" title="Anachronos" tabindex="-1"></iframe>
  ${body}
  <div class="wm">${logo}KANTOONG AI</div>
  <div class="progress" id="prog"></div>
</div>
<script>
(() => {
  const stage = document.getElementById("stage");
  const fit = () => { const s = Math.min(innerWidth / 1920, innerHeight / 1080); stage.style.transform = "translate(-50%,-50%) scale(" + s + ")"; };
  addEventListener("resize", fit); fit();
  const ax = document.getElementById("ax");
  const scenes = [...document.querySelectorAll(".scene")];
  const starts = []; let acc = 0; scenes.forEach((s) => { starts.push(acc); acc += Number(s.dataset.d); });
  const total = acc;
  const prog = document.getElementById("prog");
  const timers = []; let raf = 0;
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const type = (el, text, speed, done) => { let i = 0; el.textContent = ""; const t = setInterval(() => { el.textContent = text.slice(0, ++i); if (i >= text.length) { clearInterval(t); done && done(); } }, speed); timers.push(t); };

  // Mesin umum: reel (geser layar), kamera browser (zoom), kursor (jalan + pencet), elemen berjadwal, ketikan.
  const runGeneric = (sc) => {
    const dur = Number(sc.dataset.d);
    sc.querySelectorAll(".reel").forEach((r) => {
      const imgs = [...r.children]; if (imgs.length < 2) return;
      const step = (dur - 1500) / imgs.length;
      const plan = r.dataset.steps ? r.dataset.steps.split(",").map(Number) : null;
      imgs.forEach((im, k) => { if (k) later(() => { imgs[k - 1].classList.add("past"); im.classList.add("cur"); }, plan ? plan[k - 1] : 900 + step * k); });
    });
    sc.querySelectorAll("[data-zoom]").forEach((cam) => {
      const z = JSON.parse(cam.dataset.zoom); const W = cam.offsetWidth, H = cam.offsetHeight;
      later(() => { cam.style.transform = "translate(" + (W / 2 - z.x * W * z.s) + "px," + (H / 2 - z.y * H * z.s) + "px) scale(" + z.s + ")"; }, z.at);
    });
    sc.querySelectorAll(".fcur").forEach((c) => {
      const path = JSON.parse(c.dataset.path); const box = c.parentElement;
      const place = (p) => { c.style.left = (p[0] * box.offsetWidth) + "px"; c.style.top = (p[1] * box.offsetHeight) + "px"; };
      c.style.transition = "none"; place(path[0]); void c.offsetWidth; c.style.transition = "";
      later(() => { c.style.opacity = "1"; }, Math.max(300, path[0][2]));
      path.slice(1).forEach((p) => {
        later(() => place(p), p[2] - 1200);
        if (p[3]) later(() => {
          c.classList.add("press"); setTimeout(() => c.classList.remove("press"), 220);
          const r = document.createElement("div"); r.className = "rip"; r.style.left = c.style.left; r.style.top = c.style.top; box.appendChild(r); setTimeout(() => r.remove(), 950);
        }, p[2]);
      });
      later(() => { c.style.opacity = "0"; }, path[path.length - 1][2] + 1300);
    });
    sc.querySelectorAll(".at[data-at]").forEach((e) => later(() => e.classList.add("show"), Number(e.dataset.at)));
    sc.querySelectorAll(".typed").forEach((e) => later(() => type(e, e.dataset.type, 55), Number(e.dataset.at)));
  };

  const JS = {
    ask(sc) {
      const q = sc.querySelector("#askq"), b = sc.querySelector("#askbtn"), c = sc.querySelector("#cursor");
      c.style.left = "1500px"; c.style.top = "820px";
      later(() => type(q, "Buatkan invoice untuk Kafe Senja…", 55), 900);
      later(() => { const a = b.offsetParent; c.style.left = (a.offsetLeft + b.offsetLeft + b.offsetWidth / 2 - 45) + "px"; c.style.top = (a.offsetTop + b.offsetTop + b.offsetHeight / 2 - 45) + "px"; }, 3300);
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
          const X = x * cs - z * sn, Z = x * sn + z * cs; const d = (Z + 1.6) / 2.6; const fl = .55 + .45 * Math.sin(t * 3 + w * 20);
          g.fillStyle = "rgba(255," + (150 + 70 * w | 0) + ",60," + (d * .85 * fl).toFixed(2) + ")";
          g.beginPath(); g.arc(cx + X * R, cy + y * R * .98, 1.2 + d * 2.2, 0, 6.29); g.fill();
        }
        g.lineWidth = 2;
        for (let k = 0; k < 3; k++) { g.strokeStyle = "rgba(255,170,60," + (.35 + .15 * k) + ")"; g.beginPath(); g.ellipse(cx, cy, R * (1.12 + k * .1), R * (.28 + k * .08), (k - 1) * .5 + t * (.15 + k * .05), 0, 6.29); g.stroke(); }
        g.globalCompositeOperation = "source-over";
        if (sc.classList.contains("on")) raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
      // siapkan Anachronos (putar orbit) di belakang layar
      ax.contentWindow?.postMessage({ ax: "play", seq: "orbit" }, "*");
    },
  };

  let i = Math.max(0, Math.min(scenes.length - 1, Number(new URLSearchParams(location.search).get("adegan") || 1) - 1)), tStart = 0;
  const show = () => {
    timers.splice(0).forEach((t) => { clearTimeout(t); clearInterval(t); }); cancelAnimationFrame(raf);
    scenes.forEach((s, k) => {
      if (k === i) {
        const fresh = s.cloneNode(true); fresh.classList.remove("on"); s.replaceWith(fresh); scenes[k] = fresh;
        void fresh.offsetWidth; fresh.classList.add("on");
      } else s.classList.remove("on");
    });
    const sc = scenes[i];
    const seq = sc.dataset.ax;
    ax.classList.toggle("on", Boolean(seq));
    if (seq) ax.contentWindow?.postMessage({ ax: "play", seq }, "*");
    else ax.contentWindow?.postMessage({ ax: "sleep", on: true }, "*");
    const js = sc.dataset.js; if (js) JS[js](sc);
    runGeneric(sc);
    tStart = performance.now() - starts[i];
    timers.push(setTimeout(() => { i = (i + 1) % scenes.length; show(); }, Number(sc.dataset.d)));
  };
  const tick = (t) => { prog.style.width = (((t - tStart) % total) / total * 100) + "%"; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  // tunggu font & Anachronos siap sebentar agar adegan pertama mulus
  let started = false; const go = () => { if (!started) { started = true; show(); } };
  addEventListener("message", (e) => { if (e.data?.ax === "ready") setTimeout(go, 300); });
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
writeFileSync(`${OUT}/index.html`, html);
console.log("ok", S.length, "adegan,", Math.round([...html.matchAll(/class="scene" data-d="(\d+)"/g)].reduce((n, m) => n + Number(m[1]), 0) / 1000), "detik,", used.size, "gambar");

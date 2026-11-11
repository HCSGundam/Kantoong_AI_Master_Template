/**
 * KANTOONG NANO — orb AI dari partikel ("nano tech")
 *
 * Diam      : bola titik-titik 3D yang bergelombang seperti kain (biru → ungu → merah muda),
 *             bernapas, dengan cincin biru yang mengorbit, mata berkedip.
 * Berubah   : sesekali (dan saat AI berpikir) partikel mengalir membentuk BINTANG ✦, lalu kembali bola.
 * Terbang   : KantoongNano.flyTo(target) — partikel terurai jadi kawanan nano, terbang ke elemen
 *             mana pun di halaman, berkumpul jadi cincin di sana, lalu pulang jadi orb.
 *             Ini wadah untuk AI Agent nanti (AI "berjalan" ke tombol yang ia pencet).
 *
 * Tanpa pustaka luar: kanvas 2D + proyeksi 3D sederhana. Hemat: satu loop untuk semua orb,
 * orb yang tidak terlihat tidak digambar, menghormati prefers-reduced-motion.
 */

const TAU = Math.PI * 2;
const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

/* ---------- warna: biru (atas) → ungu → merah muda (bawah) ---------- */
const STOPS = [[79, 179, 255], [111, 123, 255], [176, 92, 255], [255, 95, 200]];
function gradient(t) {
    const x = Math.min(0.999, Math.max(0, t)) * (STOPS.length - 1);
    const i = Math.floor(x);
    const f = x - i;
    const a = STOPS[i];
    const b = STOPS[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/* ---------- titik-titik dasar di bola (Fibonacci) ---------- */
function spherePoints(n) {
    const pts = [];
    for (let i = 0; i < n; i++) {
        const y = 1 - (i / (n - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const th = i * 2.399963229728653;
        const x = Math.cos(th) * r;
        const z = Math.sin(th) * r;
        const lat = Math.asin(y);
        const lon = Math.atan2(z, x);
        const col = gradient((1 - y) / 2 * 0.85 + (Math.sin(lon * 2) + 1) * 0.075);
        pts.push({ x, y, z, lat, lon, col, delay: Math.random() * 0.45 });
    }
    return pts;
}

/** Bentuk BOLA bergelombang (riak seperti kain). */
function orbShape(p, t, out) {
    // Lipatan organik (beberapa gelombang bertumpuk) → tepi tidak pernah bulat kaku.
    const r = 1
        + 0.16 * Math.sin(2 * p.lat + t * 0.9) * Math.cos(3 * p.lon - t * 0.7)
        + 0.09 * Math.sin(4 * p.lon + 2 * p.lat + t * 1.4)
        + 0.06 * Math.cos(6 * p.lat - t * 1.8)
        + 0.03 * Math.sin(t * 1.2); // napas
    out[0] = p.x * r;
    out[1] = p.y * r;
    out[2] = p.z * r;
}

/** Bentuk BINTANG ✦ (empat ujung, tebal di tengah). */
function starShape(p, t, out) {
    const th = Math.atan2(p.y, p.x);
    const q = 0.55;
    const a = 1 / Math.pow(Math.pow(Math.abs(Math.cos(th)), q) + Math.pow(Math.abs(Math.sin(th)), q), 1 / q);
    const pulse = 1 + 0.04 * Math.sin(t * 3);
    out[0] = p.x * a * 1.3 * pulse;
    out[1] = p.y * a * 1.3 * pulse;
    out[2] = p.z * 0.3 * a;
}

const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/* ============================================================
   ORB MINI (di dalam .kc-orb)
   ============================================================ */

const orbs = new Set();

export function attachNano(host) {
    if (!host || host.dataset.nano === "1") return;
    host.dataset.nano = "1";
    host.classList.add("has-nano");
    const canvas = document.createElement("canvas");
    canvas.className = "kc-nano";
    canvas.setAttribute("aria-hidden", "true");
    host.prepend(canvas);
    const orb = {
        host,
        canvas,
        ctx: canvas.getContext("2d"),
        pts: spherePoints(760),
        morph: 0, // 0 = bola, 1 = bintang
        morphTo: 0,
        blink: 0,
        hidden: false,
    };
    orbs.add(orb);
    start();
    return orb;
}

/** Ubah semua orb: "star" atau "orb". */
let glMorph = null; // diisi saat versi WebGL selesai dimuat

export function morph(shape) {
    orbs.forEach((o) => {
        o.morphTo = shape === "star" ? 1 : 0;
    });
    glMorph?.(shape);
}

const tmpA = [0, 0, 0];
const tmpB = [0, 0, 0];

function drawOrb(o, t, dt) {
    const { host, canvas, ctx } = o;
    if (!host.isConnected) {
        orbs.delete(o);
        return;
    }
    const base = host.clientWidth;
    if (!base || host.offsetParent === null || host.classList.contains("gl-on")) return;
    const size = base * 1.9; // kanvas melebihi tombol agar tepi bergelombang tidak terpotong
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(size * dpr);
    if (canvas.width !== px) {
        canvas.width = px;
        canvas.height = px;
    }
    // morf berjalan pelan per partikel (efek "mengalir")
    o.morph += (o.morphTo - o.morph) * Math.min(1, dt * 1.6);

    const R = px * 0.25;
    const cx = px / 2;
    const cy = px / 2;
    // Saat jadi bintang, putaran mereda agar bintang menghadap depan (bukan terlihat dari samping).
    const facing = ease(Math.min(1, o.morph));
    const rotY = t * 0.5 * (1 - facing) + Math.sin(t * 1.4) * 0.35 * facing;
    const tilt = 0.35;
    const cY = Math.cos(rotY), sY = Math.sin(rotY), cX = Math.cos(tilt), sX = Math.sin(tilt);
    ctx.clearRect(0, 0, px, px);
    ctx.globalCompositeOperation = "source-over";
    const dot = Math.max(1, px / 120);


    for (const p of o.pts) {
        const k = ease(Math.min(1, Math.max(0, (o.morph * 1.45) - p.delay)));
        orbShape(p, t, tmpA);
        if (k > 0) starShape(p, t, tmpB);
        let x = tmpA[0] + (tmpB[0] - tmpA[0]) * k;
        let y = tmpA[1] + (tmpB[1] - tmpA[1]) * k;
        let z = tmpA[2] + (tmpB[2] - tmpA[2]) * k;
        // putar Y lalu miring X
        const x1 = x * cY - z * sY;
        const z1 = x * sY + z * cY;
        const y1 = y * cX - z1 * sX;
        const z2 = y * sX + z1 * cX;
        const persp = 3 / (3 + z2);
        const sx = cx + x1 * R * persp;
        const sy = cy + y1 * R * persp;
        const depth = (1 - z2) / 2; // depan = terang
        const a = 0.18 + 0.82 * Math.min(1, Math.max(0, depth));
        ctx.fillStyle = `rgba(${p.col[0] | 0},${p.col[1] | 0},${p.col[2] | 0},${a.toFixed(2)})`;
        ctx.fillRect(sx - dot / 2, sy - dot / 2, dot * persp, dot * persp);
    }

    // mata (hilang saat jadi bintang), berkedip sesekali
    ctx.globalCompositeOperation = "source-over";
    const eyeA = 1 - Math.min(1, o.morph * 1.6);
    if (eyeA > 0.02) {
        o.blink = (o.blink + dt) % 4.6;
        const open = o.blink > 4.45 ? 0.15 : 1;
        const ew = px * 0.038;
        const eh = px * 0.09 * open;
        ctx.fillStyle = `rgba(24,16,64,${eyeA.toFixed(2)})`;
        ctx.shadowColor = "rgba(150,110,255,0.8)";
        ctx.shadowBlur = px * 0.03;
        for (const ex of [cx - px * 0.055, cx + px * 0.055]) {
            ctx.beginPath();
            ctx.ellipse(ex, cy, ew / 2, eh / 2, 0, 0, TAU);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
    }
}

/* ============================================================
   KAWANAN NANO (terbang di atas halaman)
   ============================================================ */

let overlay = null;
let octx = null;
let flight = null;

function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement("canvas");
    overlay.className = "kc-nano-overlay";
    overlay.setAttribute("aria-hidden", "true");
    document.body.appendChild(overlay);
    octx = overlay.getContext("2d");
}

function centerOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}

function visibleOrb() {
    for (const o of orbs) if (o.host.isConnected && o.host.offsetParent !== null && o.host.clientWidth) return o.host;
    return null;
}

/**
 * Terbang dari `from` (elemen atau {x,y}) ke `to` (elemen atau {x,y}).
 * Mengembalikan Promise yang selesai saat kawanan sudah pulang.
 */
export function flyTo(to, { from = null, hold = 520 } = {}) {
    if (reduceMotion()) return Promise.resolve();
    const src = from || visibleOrb();
    if (!src || !to) return Promise.resolve();
    ensureOverlay();
    const a = src.getBoundingClientRect ? centerOf(src) : { x: src.x, y: src.y, w: 50, h: 50 };
    const b = to.getBoundingClientRect ? centerOf(to) : { x: to.x, y: to.y, w: 40, h: 40 };
    const home = src.getBoundingClientRect ? src : null;
    if (home?.classList.contains("has-nano")) home.classList.add("is-away");

    const n = 260;
    const pts = spherePoints(n).map((p) => {
        const nx = -(b.y - a.y);
        const ny = b.x - a.x;
        const len = Math.hypot(nx, ny) || 1;
        const bend = (Math.random() - 0.5) * 220;
        return {
            ...p,
            sx: a.x + p.x * Math.max(18, a.w * 0.36),
            sy: a.y + p.y * Math.max(18, a.h * 0.36),
            ring: Math.random() * TAU,
            cx: (a.x + b.x) / 2 + (nx / len) * bend,
            cy: (a.y + b.y) / 2 + (ny / len) * bend - 60,
            px: null,
            py: null,
            d: Math.random() * 0.35,
        };
    });
    return new Promise((resolve) => {
        flight = { pts, a, b, t0: performance.now(), out: 1050, hold, back: 950, resolve, home };
        start();
    });
}

function bez(p0, p1, p2, t) {
    const u = 1 - t;
    return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

function drawFlight(now) {
    const f = flight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (overlay.width !== Math.round(innerWidth * dpr) || overlay.height !== Math.round(innerHeight * dpr)) {
        overlay.width = Math.round(innerWidth * dpr);
        overlay.height = Math.round(innerHeight * dpr);
    }
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.clearRect(0, 0, innerWidth, innerHeight);
    octx.globalCompositeOperation = "source-over";
    const el = now - f.t0;
    const total = f.out + f.hold + f.back;
    if (el >= total) {
        octx.clearRect(0, 0, innerWidth, innerHeight);
        f.home?.classList.remove("is-away");
        flight = null;
        f.resolve();
        return;
    }
    const ringR = Math.max(16, Math.min(f.b.w, f.b.h) * 0.7);
    for (const p of f.pts) {
        let x;
        let y;
        const rx = f.b.x + Math.cos(p.ring + el / 260) * ringR;
        const ry = f.b.y + Math.sin(p.ring + el / 260) * ringR * 0.9;
        if (el < f.out) {
            const k = ease(Math.min(1, Math.max(0, (el / f.out - p.d) / (1 - p.d))));
            x = bez(p.sx, p.cx, rx, k);
            y = bez(p.sy, p.cy, ry, k);
        } else if (el < f.out + f.hold) {
            x = rx;
            y = ry;
        } else {
            const k = ease(Math.min(1, Math.max(0, ((el - f.out - f.hold) / f.back - p.d) / (1 - p.d))));
            x = bez(rx, p.cx, p.sx, k);
            y = bez(ry, p.cy - 40, p.sy, k);
        }
        if (p.px !== null) {
            octx.strokeStyle = `rgba(${p.col[0] | 0},${p.col[1] | 0},${p.col[2] | 0},0.35)`;
            octx.lineWidth = 1.2;
            octx.beginPath();
            octx.moveTo(p.px, p.py);
            octx.lineTo(x, y);
            octx.stroke();
        }
        octx.fillStyle = `rgb(${p.col[0] | 0},${p.col[1] | 0},${p.col[2] | 0})`;
        octx.fillRect(x - 1.3, y - 1.3, 2.6, 2.6);
        p.px = x;
        p.py = y;
    }
    // denyut "klik" di target
    if (el > f.out * 0.85 && el < f.out + f.hold + 200) {
        const k = (el - f.out * 0.85) / (f.hold + 360);
        octx.strokeStyle = `rgba(127,212,255,${(1 - k).toFixed(2)})`;
        octx.lineWidth = 2;
        octx.beginPath();
        octx.arc(f.b.x, f.b.y, ringR * (1 + k * 1.4), 0, TAU);
        octx.stroke();
    }
}

/* ============================================================
   LOOP
   ============================================================ */

let raf = 0;
let last = 0;
function start() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(loop);
}
function loop(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = reduceMotion() ? 0 : now / 1000;
    if (!document.hidden) {
        orbs.forEach((o) => drawOrb(o, t, dt));
        if (flight) drawFlight(now);
    }
    if (orbs.size || flight) raf = requestAnimationFrame(loop);
}

/* ============================================================
   PERILAKU OTOMATIS
   ============================================================ */

// Sesekali berubah jadi bintang lalu kembali (seperti di video).
setInterval(() => {
    if (reduceMotion() || document.hidden) return;
    morph("star");
    setTimeout(() => morph("orb"), 5000);
}, 30000); // orb bermata lama (±30 dtk), bintang ±5 dtk

// Saat AI sedang menyiapkan jawaban: jadi bintang.
document.addEventListener("kantoong:ai-thinking", (e) => morph(e.detail?.busy ? "star" : "orb"));

// Barang masuk keranjang: kawanan nano terbang dari tombol yang dipencet ke ikon keranjang.
let lastPointer = null;
document.addEventListener("pointerdown", (e) => {
    lastPointer = { x: e.clientX, y: e.clientY, at: performance.now() };
}, { capture: true, passive: true });
window.addEventListener("kantoong:cart-add", () => {
    const visible = (el) => el && el.offsetParent !== null && el.getBoundingClientRect().width > 0;
    const target = [document.querySelector(".pdp-bar__cart"), document.getElementById("btnCart")].find(visible);
    if (!target) return;
    const from = lastPointer && performance.now() - lastPointer.at < 1500 ? { x: lastPointer.x, y: lastPointer.y } : null;
    flyTo(target, { from: from || undefined });
});

window.KantoongNano = Object.freeze({ attach: attachNano, morph, flyTo });

// Versi WebGL (three.js) dimuat SETELAH halaman tampil, agar toko tetap cepat.
// Gagal/tidak didukung = tetap orb kanvas 2D di atas.
function loadGL() {
    if (reduceMotion()) return;
    import("./nano-orb-gl.js")
        .then((m) => {
            glMorph = m.morphGL;
            m.startGL();
        })
        .catch(() => {});
}
if (document.readyState === "complete") setTimeout(loadGL, 800);
else window.addEventListener("load", () => setTimeout(loadGL, 800), { once: true });

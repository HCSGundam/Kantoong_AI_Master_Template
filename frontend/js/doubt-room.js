/**
 * KANTOONG — RUANG RAGU & BANDINGKAN PRODUK (murni, dites)
 * File: frontend/js/doubt-room.js
 *
 * Ruang Ragu: bila pembeli bolak-balik di antara dua produk (A → B → A)
 * dalam 30 menit, toko menawarkan perbandingan berdampingan. Jejak hanya
 * disimpan di perangkat ini (id produk + jam), tidak dikirim ke mana pun.
 *
 * compareProducts(): hanya PERBEDAAN yang penting yang ditampilkan;
 * yang sama dirangkum satu baris ("Sama: kategori, pengiriman").
 */

import { specRows } from "./industry.js";

export const TRAIL_KEY = "kantoong:view-trail";
export const DISMISS_KEY = "kantoong:doubt-dismissed";
const TRAIL_MAX = 30;
const WINDOW_MS = 30 * 60 * 1000;

const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

function read(storage, key, fallback) {
    try {
        const raw = storage?.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function write(storage, key, value) {
    try {
        storage?.setItem(key, JSON.stringify(value));
    } catch {
        /* penyimpanan penuh / mode privat */
    }
}

/** Catat produk yang dibuka. Mengembalikan jejak terbaru. */
export function recordView(id, { now = Date.now(), storage = globalThis.localStorage } = {}) {
    const key = String(id ?? "");
    const trail = (Array.isArray(read(storage, TRAIL_KEY, [])) ? read(storage, TRAIL_KEY, []) : [])
        .filter((v) => v && typeof v.id === "string" && now - num(v.at) < WINDOW_MS);
    if (key && trail[trail.length - 1]?.id !== key) trail.push({ id: key, at: now });
    const next = trail.slice(-TRAIL_MAX);
    write(storage, TRAIL_KEY, next);
    return next;
}

const pairKey = (a, b) => [String(a), String(b)].sort().join("|");

/**
 * Pola A → B → A dalam 30 menit = ragu antara A dan B.
 * Mengembalikan id produk "lawan" atau null.
 */
export function detectDoubt(trail, currentId, { now = Date.now(), dismissed = [] } = {}) {
    const ids = (trail ?? [])
        .filter((v) => now - num(v?.at) < WINDOW_MS)
        .map((v) => String(v.id))
        .filter((id, i, arr) => i === 0 || id !== arr[i - 1]);
    const n = ids.length;
    const current = String(currentId);
    if (n < 3 || ids[n - 1] !== current) return null;
    const other = ids[n - 2];
    if (other === current || ids[n - 3] !== current) return null;
    if (dismissed.includes(pairKey(current, other))) return null;
    return other;
}

/** Tolak tawaran untuk pasangan ini (berlaku hari ini saja). */
export function dismissDoubt(a, b, { now = Date.now(), storage = globalThis.localStorage } = {}) {
    const day = new Date(now).toDateString();
    const saved = read(storage, DISMISS_KEY, {});
    const list = saved?.day === day && Array.isArray(saved.pairs) ? saved.pairs : [];
    write(storage, DISMISS_KEY, { day, pairs: [...new Set([...list, pairKey(a, b)])] });
}

export function dismissedPairs({ now = Date.now(), storage = globalThis.localStorage } = {}) {
    const saved = read(storage, DISMISS_KEY, {});
    return saved?.day === new Date(now).toDateString() && Array.isArray(saved.pairs) ? saved.pairs : [];
}

/* ---------- Perbandingan ---------- */

const rupiah = (n) => `Rp ${Math.round(num(n)).toLocaleString("id-ID")}`;

const stockLabel = (stock) => {
    if (stock == null || stock === "") return "Tersedia";
    const s = num(stock);
    if (s <= 0) return "Habis";
    if (s <= 5) return `Sisa ${s}`;
    return "Tersedia";
};

const ratingOf = (p) => num(p?.rating_avg ?? p?.rating);
const fitText = (p) => (p?.story?.fit ?? []).join(", ");

/**
 * rows: [{ key, label, a, b, better: "a" | "b" | null }] — hanya yang berbeda.
 * same: label baris yang nilainya sama. summary: kalimat ringkas perbedaan utama.
 */
export function compareProducts(a, b, { industry = "umum", nameOf = (p) => p?.name ?? "Produk" } = {}) {
    const candidates = [];
    const priceA = num(a?.price);
    const priceB = num(b?.price);
    candidates.push({ key: "price", label: "Harga", a: rupiah(priceA), b: rupiah(priceB), better: priceA === priceB ? null : priceA < priceB ? "a" : "b" });

    const offA = num(a?.compare_at_price) > priceA ? Math.round((1 - priceA / num(a.compare_at_price)) * 100) : 0;
    const offB = num(b?.compare_at_price) > priceB ? Math.round((1 - priceB / num(b.compare_at_price)) * 100) : 0;
    if (offA || offB) candidates.push({ key: "discount", label: "Diskon", a: offA ? `${offA}%` : "—", b: offB ? `${offB}%` : "—", better: offA === offB ? null : offA > offB ? "a" : "b" });

    const rA = ratingOf(a);
    const rB = ratingOf(b);
    if (rA || rB) {
        const fmt = (r, p) => (r ? `★ ${r.toFixed(1).replace(".", ",")} (${num(p?.review_count)} ulasan)` : "Belum ada ulasan");
        candidates.push({ key: "rating", label: "Rating", a: fmt(rA, a), b: fmt(rB, b), better: Math.abs(rA - rB) < 0.05 ? null : rA > rB ? "a" : "b" });
    }

    const sA = num(a?.sales_count);
    const sB = num(b?.sales_count);
    if (sA || sB) candidates.push({ key: "sold", label: "Terjual", a: `${sA}`, b: `${sB}`, better: sA === sB ? null : sA > sB ? "a" : "b" });

    candidates.push({ key: "stock", label: "Stok", a: stockLabel(a?.stock), b: stockLabel(b?.stock), better: null });
    candidates.push({ key: "category", label: "Kategori", a: String(a?.category || "—"), b: String(b?.category || "—"), better: null });
    candidates.push({ key: "ship", label: "Pengiriman", a: String(a?.ship_estimate || "—"), b: String(b?.ship_estimate || "—"), better: null });

    if (industry !== "umum") {
        const rowsA = new Map(specRows(industry, a?.attributes ?? {}).map((r) => [r.label, r.value]));
        const rowsB = new Map(specRows(industry, b?.attributes ?? {}).map((r) => [r.label, r.value]));
        [...new Set([...rowsA.keys(), ...rowsB.keys()])].forEach((label) => {
            candidates.push({ key: `spec:${label}`, label, a: rowsA.get(label) ?? "—", b: rowsB.get(label) ?? "—", better: null });
        });
    }

    if (fitText(a) || fitText(b)) candidates.push({ key: "fit", label: "Cocok untuk", a: fitText(a) || "—", b: fitText(b) || "—", better: null });

    const rows = candidates.filter((r) => r.a !== r.b);
    const same = candidates.filter((r) => r.a === r.b && r.a !== "—").map((r) => r.label);

    const nameA = nameOf(a);
    const nameB = nameOf(b);
    const parts = [];
    if (priceA !== priceB) {
        const cheaper = priceA < priceB ? nameA : nameB;
        parts.push(`${cheaper} lebih hemat ${rupiah(Math.abs(priceA - priceB))}`);
    }
    if (rA && rB && Math.abs(rA - rB) >= 0.2) parts.push(`${rA > rB ? nameA : nameB} dinilai lebih tinggi oleh pembeli`);
    if (stockLabel(a?.stock) === "Habis" || stockLabel(b?.stock) === "Habis") {
        parts.push(`${stockLabel(a?.stock) === "Habis" ? nameA : nameB} sedang habis`);
    }
    const summary = parts.length ? `${parts.join(", ")}.` : "Keduanya sangat mirip. Pilih yang paling kamu suka tampilannya.";

    return { rows, same, summary };
}

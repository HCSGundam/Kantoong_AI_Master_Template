/**
 * KANTOONG — HARGA JUJUR (murni, dites)
 * File: frontend/js/honest-price.js
 *
 * Riwayat harga dicatat database (db/honest-commerce.sql, trigger di tabel
 * products) setiap kali harga / harga coret berubah.
 *
 * Aturan: harga coret HANYA tampil bila produk ini benar pernah dijual
 * dengan harga setinggi itu dalam 30 hari terakhir. Bila riwayat belum
 * tersedia (SQL belum dijalankan / gagal dimuat) = null → tampilan lama.
 */

export const HONEST_WINDOW_DAYS = 30;
const DAY = 86_400_000;

const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

/** Kelompokkan baris riwayat per produk, urut dari yang terlama. */
export function groupHistory(rows) {
    const map = new Map();
    (rows ?? []).forEach((r) => {
        const id = String(r?.product_id ?? "");
        const at = Date.parse(r?.changed_at);
        if (!id || !Number.isFinite(at)) return;
        if (!map.has(id)) map.set(id, []);
        map.get(id).push({ price: num(r.price), compareAt: num(r.compare_at_price), at });
    });
    map.forEach((list) => list.sort((x, y) => x.at - y.at));
    return map;
}

/**
 * Titik harga dalam 30 hari (harga yang berlaku di awal jendela ikut dihitung).
 * history: [{price, compareAt, at}] urut lama → baru.
 */
export function priceWindow(history, { now = Date.now(), days = HONEST_WINDOW_DAYS } = {}) {
    const start = now - days * DAY;
    const list = (history ?? []).filter((h) => h.at <= now);
    if (!list.length) return { points: [], trackedSince: null };
    const before = list.filter((h) => h.at < start);
    const inside = list.filter((h) => h.at >= start);
    const points = [];
    if (before.length) points.push({ ...before[before.length - 1], at: start });
    points.push(...inside);
    return { points, trackedSince: list[0].at };
}

/**
 * Hasil:
 *  - strike: true/false (boleh tampilkan harga coret), null bila riwayat tidak tersedia
 *  - low, high: harga terendah/tertinggi 30 hari
 *  - points: titik untuk grafik
 *  - verdict: kalimat jujur untuk pembeli
 */
export function honestPrice({ price, compareAt, history, now = Date.now() }) {
    const current = num(price);
    const was = num(compareAt);
    if (!Array.isArray(history)) return { strike: null, points: [], verdict: "" };

    const { points, trackedSince } = priceWindow(history, { now });
    if (!points.length) {
        return { strike: false, points: [], low: current, high: current, verdict: "" };
    }
    const prices = points.map((p) => p.price);
    const low = Math.min(...prices, current);
    const high = Math.max(...prices, current);
    const strike = was > current && prices.some((p) => p >= was);

    const since = new Date(trackedSince);
    const shortDate = since.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    const young = now - trackedSince < HONEST_WINDOW_DAYS * DAY;

    let verdict;
    if (low === high) {
        verdict = young ? `Harga belum pernah berubah sejak dipantau (${shortDate}).` : "Harga stabil 30 hari terakhir.";
    } else if (current <= low) {
        verdict = "Ini harga terendah dalam 30 hari terakhir.";
    } else if (current >= high) {
        verdict = `Harga sedang di titik tertinggi 30 hari. Terendah: Rp ${low.toLocaleString("id-ID")}.`;
    } else {
        verdict = `Pernah lebih murah: Rp ${low.toLocaleString("id-ID")} dalam 30 hari terakhir.`;
    }
    return { strike, points, low, high, verdict, trackedSince };
}

/** Titik grafik (garis tangga) dinormalkan 0..1, dari awal jendela sampai sekarang. */
export function chartPath(points, { now = Date.now(), width = 280, height = 64, pad = 6 } = {}) {
    if (!points?.length) return "";
    const start = Math.min(points[0].at, now - HONEST_WINDOW_DAYS * DAY);
    const span = Math.max(1, now - start);
    const prices = points.map((p) => p.price);
    const low = Math.min(...prices);
    const high = Math.max(...prices);
    const y = (p) => (high === low ? height / 2 : pad + (1 - (p - low) / (high - low)) * (height - pad * 2));
    const x = (at) => ((at - start) / span) * width;
    let d = `M0 ${y(points[0].price).toFixed(1)}`;
    points.forEach((p, i) => {
        if (i > 0) d += ` H${x(p.at).toFixed(1)} V${y(p.price).toFixed(1)}`;
    });
    return `${d} H${width}`;
}

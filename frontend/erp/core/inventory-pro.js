/**
 * KANTOONG ERP PRO — GUDANG PRO (murni, dites)
 * File: frontend/erp/core/inventory-pro.js
 *
 * - Saran belanja: rata-rata barang keluar per hari → "habis dalam X hari",
 *   titik pesan ulang (lead time + stok minimum) & jumlah yang disarankan.
 * - Kedaluwarsa per batch + FEFO (yang paling cepat kedaluwarsa keluar dulu).
 */

const DAY = 86400000;
const OUT_KINDS = new Set(["keluar", "penjualan", "transfer_keluar"]);

/** Rata-rata pemakaian per hari selama N hari terakhir (transfer antar gudang tidak dihitung bila global). */
export function dailyUsage(moves, productId, { days = 14, now = new Date(), warehouseId = null } = {}) {
    const since = new Date(now).getTime() - days * DAY;
    const used = (moves || [])
        .filter((m) => m.product_id === productId
            && (warehouseId ? m.warehouse_id === warehouseId && OUT_KINDS.has(m.kind) : OUT_KINDS.has(m.kind) && m.kind !== "transfer_keluar")
            && new Date(m.created_at).getTime() >= since)
        .reduce((n, m) => n + Math.abs(Number(m.qty) || 0), 0);
    return used / days;
}

/**
 * Saran belanja per produk (seluruh gudang).
 * pos_sales opsional: penjualan kasir dihitung sebagai pemakaian juga.
 */
export function reorderSuggestions({ levels = [], moves = [], products = [], sales = [], leadDays = 3, coverDays = 14, days = 14, now = new Date() } = {}) {
    const since = new Date(now).getTime() - days * DAY;
    const soldByProduct = new Map();
    (sales || []).forEach((sale) => {
        if (new Date(sale.created_at).getTime() < since || sale.status === "void") return;
        (sale.items || []).forEach((item) => {
            const key = String(item.product_id);
            soldByProduct.set(key, (soldByProduct.get(key) || 0) + (Number(item.qty) || 0));
        });
    });

    return products.map((product) => {
        const id = String(product.id);
        const own = levels.filter((l) => String(l.product_id) === id);
        const onHand = own.reduce((n, l) => n + (Number(l.qty) || 0), 0);
        const minQty = own.reduce((n, l) => n + (Number(l.min_qty) || 0), 0);
        const perDay = dailyUsage(moves, id, { days, now }) + (soldByProduct.get(id) || 0) / days;
        const daysLeft = perDay > 0 ? onHand / perDay : Infinity;
        const reorderPoint = Math.ceil(perDay * leadDays + minQty);
        const suggest = Math.max(0, Math.ceil(perDay * coverDays + minQty - onHand));
        const urgency = onHand <= 0 ? "habis" : daysLeft <= leadDays ? "segera" : onHand <= reorderPoint ? "pesan" : "aman";
        return {
            product_id: id,
            name: product.name,
            onHand,
            minQty,
            perDay: Math.round(perDay * 10) / 10,
            daysLeft: Number.isFinite(daysLeft) ? Math.round(daysLeft * 10) / 10 : null,
            reorderPoint,
            suggest,
            cost: Number(product.cost_price) || 0,
            urgency,
        };
    })
        .filter((row) => row.urgency !== "aman" && row.suggest > 0)
        .sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || (a.daysLeft ?? 999) - (b.daysLeft ?? 999));
}

const URGENCY_RANK = { habis: 0, segera: 1, pesan: 2, aman: 3 };

export const URGENCY_LABELS = Object.freeze({
    habis: "Sudah habis",
    segera: "Pesan hari ini",
    pesan: "Waktunya pesan",
    aman: "Aman",
});

/** Status kedaluwarsa satu batch. */
export function expiryStatus(batch, now = new Date()) {
    if (!batch.expires_on) return "tanpa";
    const left = Math.floor((new Date(`${batch.expires_on}T00:00:00Z`) - new Date(`${new Date(now).toISOString().slice(0, 10)}T00:00:00Z`)) / DAY);
    if (left < 0) return "lewat";
    if (left <= 7) return "minggu";
    if (left <= 30) return "bulan";
    return "aman";
}

export const EXPIRY_LABELS = Object.freeze({
    lewat: "Sudah kedaluwarsa",
    minggu: "≤ 7 hari",
    bulan: "≤ 30 hari",
    aman: "Aman",
    tanpa: "Tanpa tanggal",
});

export function expiryAlerts(batches, now = new Date()) {
    const rank = { lewat: 0, minggu: 1, bulan: 2 };
    return (batches || [])
        .filter((b) => (Number(b.qty) || 0) > 0)
        .map((b) => ({ ...b, status: expiryStatus(b, now) }))
        .filter((b) => b.status in rank)
        .sort((a, b) => rank[a.status] - rank[b.status] || a.expires_on.localeCompare(b.expires_on));
}

/** FEFO: ambil qty dari batch yang paling cepat kedaluwarsa (yang sudah lewat tidak diambil). */
export function fefoPick(batches, qty, now = new Date()) {
    let need = Math.max(0, Number(qty) || 0);
    const picks = [];
    const usable = (batches || [])
        .filter((b) => (Number(b.qty) || 0) > 0 && expiryStatus(b, now) !== "lewat")
        .sort((a, b) => String(a.expires_on || "9999").localeCompare(String(b.expires_on || "9999")));
    for (const batch of usable) {
        if (need <= 0) break;
        const take = Math.min(need, Number(batch.qty));
        picks.push({ batch_id: batch.id, qty: take, expires_on: batch.expires_on });
        need -= take;
    }
    return { picks, short: need };
}

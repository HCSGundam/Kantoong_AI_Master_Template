/**
 * KANTOONG ERP — ATURAN STOK
 * File: frontend/erp/core/inventory.js
 *
 * Sama dengan erp_stock_move / erp_apply_stock_move di erp-phase2.sql:
 * stok tidak boleh minus, transfer = keluar di asal + masuk di tujuan,
 * stock opname = selisih hitung fisik vs catatan.
 */

export const MOVE_LABELS = Object.freeze({
    masuk: "Barang masuk",
    keluar: "Barang keluar",
    transfer_masuk: "Transfer masuk",
    transfer_keluar: "Transfer keluar",
    penyesuaian: "Stock opname",
    penjualan: "Penjualan kasir",
    retur: "Retur",
});

export function stockOf(levels, warehouseId, productId) {
    return levels.find((level) => level.warehouse_id === warehouseId && String(level.product_id) === String(productId))?.qty || 0;
}

/**
 * Ubah permintaan (masuk/keluar/retur/transfer/opname) menjadi baris mutasi.
 * Melempar error bila tidak valid atau stok tidak cukup.
 */
export function planMoves(levels, request) {
    const { kind, warehouse_id: from, to_warehouse_id: to, product_id: product } = request;
    const qty = Math.floor(Number(request.qty) || 0);
    const current = stockOf(levels, from, product);

    if (kind === "opname") {
        const counted = Math.floor(Number(request.counted));
        if (!Number.isFinite(counted) || counted < 0) throw new Error("Hasil hitung tidak boleh minus.");
        const diff = counted - current;
        return diff === 0 ? [] : [{ warehouse_id: from, product_id: product, qty: diff, kind: "penyesuaian" }];
    }

    if (qty < 1) throw new Error("Jumlah harus minimal 1.");

    if (kind === "masuk" || kind === "retur") {
        return [{ warehouse_id: from, product_id: product, qty, kind }];
    }

    if (current < qty) {
        throw new Error(`Stok tidak cukup (sisa ${current}, diminta ${qty}).`);
    }

    if (kind === "keluar" || kind === "penjualan") {
        return [{ warehouse_id: from, product_id: product, qty: -qty, kind }];
    }

    if (kind === "transfer") {
        if (!to || to === from) throw new Error("Pilih gudang/outlet tujuan yang berbeda.");
        return [
            { warehouse_id: from, product_id: product, qty: -qty, kind: "transfer_keluar" },
            { warehouse_id: to, product_id: product, qty, kind: "transfer_masuk" },
        ];
    }

    throw new Error("Jenis mutasi tidak dikenal.");
}

/** Terapkan mutasi ke daftar saldo (mengembalikan daftar baru). */
export function applyMoves(levels, moves) {
    const next = levels.map((level) => ({ ...level }));

    for (const move of moves) {
        let level = next.find((entry) => entry.warehouse_id === move.warehouse_id && String(entry.product_id) === String(move.product_id));
        if (!level) {
            level = { warehouse_id: move.warehouse_id, product_id: String(move.product_id), qty: 0, min_qty: 0 };
            next.push(level);
        }
        if (level.qty + move.qty < 0) throw new Error("Stok tidak cukup.");
        level.qty += move.qty;
    }

    return next;
}

/** Status stok: habis | menipis | aman. */
export function stockStatus(qty, minQty) {
    if (qty <= 0) return "habis";
    if (minQty > 0 && qty <= minQty) return "menipis";
    return "aman";
}

/** Total per produk di semua gudang (sama dengan products.stock). */
export function totalByProduct(levels) {
    const totals = new Map();
    for (const level of levels) {
        const key = String(level.product_id);
        totals.set(key, (totals.get(key) || 0) + level.qty);
    }
    return totals;
}

/**
 * KANTOONG ERP — HITUNGAN KASIR (POS)
 * File: frontend/erp/core/pos.js
 *
 * Harga SELALU diambil dari katalog (sama dengan erp_pos_checkout).
 * Diskon tidak boleh melebihi subtotal. Tunai: kembalian dihitung.
 */

export const PAY_METHODS = Object.freeze({
    tunai: "Tunai",
    qris: "QRIS",
    debit: "Kartu debit",
    transfer: "Transfer",
});

/** cart: [{ product_id, qty }] -> rincian dengan harga katalog. */
export function priceCart(cart, products, discount = 0) {
    const items = [];
    let subtotal = 0;

    for (const line of cart) {
        const product = products.find((entry) => String(entry.id) === String(line.product_id));
        const qty = Math.floor(Number(line.qty) || 0);
        if (!product || qty < 1) continue;
        const price = Number(product.price) || 0;
        items.push({ product_id: String(product.id), name: product.name, price, qty, line_total: price * qty });
        subtotal += price * qty;
    }

    const cut = Math.min(Math.max(Math.round(Number(discount) || 0), 0), subtotal);
    return { items, subtotal, discount: cut, total: subtotal - cut };
}

/** Uang diterima & kembalian. Non-tunai = pas. */
export function settle(total, method, paid) {
    if (method !== "tunai") return { paid: total, change: 0, ok: true };
    const amount = Math.round(Number(paid) || 0);
    return { paid: amount, change: Math.max(0, amount - total), ok: amount >= total };
}

/** Pecahan uang cepat untuk tombol kasir: pas, lalu dibulatkan ke atas. */
export function quickCash(total) {
    if (total <= 0) return [];
    const options = new Set([total]);
    for (const step of [5000, 10000, 20000, 50000, 100000]) {
        options.add(Math.ceil(total / step) * step);
    }
    return [...options].sort((a, b) => a - b).slice(0, 4);
}

/** Nomor struk: POS-YYMMDD-00001 (WIB). */
export function receiptNumber(serial, now = new Date()) {
    const local = new Date(now.getTime() + 7 * 3600000);
    const ymd = local.toISOString().slice(2, 10).replace(/-/g, "");
    return `POS-${ymd}-${String(serial).padStart(5, "0")}`;
}

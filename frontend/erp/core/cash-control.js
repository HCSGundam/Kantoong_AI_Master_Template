/**
 * KANTOONG ERP — KONTROL UANG KASIR (Tahap 3 POS Pro) — logika murni, dites otomatis
 * File: frontend/erp/core/cash-control.js
 *
 * Pertanyaan terbalik: "Bagaimana kasir bisa mencuri TANPA ketahuan?"
 *   1. Membatalkan transaksi setelah pelanggan pergi  -> void wajib PIN atasan + alasan;
 *      void TERLAMBAT ditandai.
 *   2. Membuat pesanan di dapur tapi tidak memasukkannya ke kasir
 *      -> REKONSILIASI DAPUR ↔ KASIR (hanya mungkin bila dapur & kasir satu data).
 *   3. Diskon besar untuk teman -> diskon di atas batas wajib PIN atasan.
 *   4. Mengambil uang laci -> TUTUP SHIFT BUTA (kasir tidak melihat angka "seharusnya").
 *   5. Pola kecil yang berulang -> SKOR INTEGRITAS KASIR dengan penjelasan biasa.
 */

export const VOID_REASONS = Object.freeze({
    salah_input: "Salah input kasir",
    pelanggan_batal: "Pelanggan batal",
    produk_bermasalah: "Produk bermasalah / komplain",
    pembayaran_gagal: "Pembayaran gagal",
    lainnya: "Lainnya",
});

export const CASH_MOVES = Object.freeze({
    masuk: "Kas masuk (tambah uang kembalian, dll)",
    keluar: "Kas keluar (beli es batu, bensin, dll)",
});

/** Pecahan rupiah untuk membantu menghitung laci. */
export const DENOMINATIONS = Object.freeze([100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100]);

export const LATE_VOID_MINUTES = 10;
const MINUTE = 60000;
const money = (value) => Math.round(Number(value) || 0);

/** { 50000: 3, 1000: 4 } -> 154.000 */
export function countDrawer(counts = {}) {
    return DENOMINATIONS.reduce((sum, value) => sum + value * Math.max(0, Math.floor(Number(counts[value]) || 0)), 0);
}

/** Uang tunai yang benar-benar masuk dari satu penjualan (sudah dikurangi kembalian). */
export function cashOf(sale) {
    if (Array.isArray(sale.payments) && sale.payments.length) {
        return sale.payments.filter((row) => row.method === "tunai").reduce((sum, row) => sum + money(row.amount), 0);
    }
    return sale.method === "tunai" ? money(sale.total) : 0;
}

/**
 * Ringkasan shift (laporan X saat berjalan / Z saat ditutup).
 * Seharusnya di laci = modal + tunai masuk dari penjualan − refund tunai + kas masuk − kas keluar.
 * Penjualan yang kemudian di-void tetap dihitung masuk; refundnya dicatat di shift yang mengembalikan.
 */
export function shiftSummary({ shift, sales = [], moves = [], refunds = [] }) {
    const mine = sales.filter((sale) => sale.shift_id === shift.id);
    const cashSales = mine.reduce((sum, sale) => sum + cashOf(sale), 0);
    const gross = mine.filter((sale) => sale.status !== "batal").reduce((sum, sale) => sum + money(sale.total), 0);
    const nonCash = mine.filter((sale) => sale.status !== "batal").reduce((sum, sale) => sum + money(sale.total) - cashOf(sale), 0);
    const refundCash = refunds.filter((entry) => entry.refund_shift_id === shift.id).reduce((sum, entry) => sum + money(entry.refund_cash), 0);
    const cashIn = moves.filter((move) => move.shift_id === shift.id && move.kind === "masuk").reduce((sum, move) => sum + money(move.amount), 0);
    const cashOut = moves.filter((move) => move.shift_id === shift.id && move.kind === "keluar").reduce((sum, move) => sum + money(move.amount), 0);
    const expected = money(shift.opening_cash) + cashSales - refundCash + cashIn - cashOut;
    return {
        transactions: mine.filter((sale) => sale.status !== "batal").length,
        voids: mine.filter((sale) => sale.status === "batal").length,
        gross, cashSales, nonCash, refundCash, cashIn, cashOut, expected,
        variance: shift.counted_cash === null || shift.counted_cash === undefined ? null : money(shift.counted_cash) - expected,
    };
}

/** Diskon melebihi batas (% dari subtotal) wajib persetujuan PIN atasan. */
export function needsDiscountApproval(subtotal, discount, percent = 20) {
    if (!discount || !subtotal) return false;
    return (money(discount) / money(subtotal)) * 100 > Math.max(0, Number(percent) || 0);
}

/** Menit antara transaksi dan pembatalannya. */
export function voidDelayMinutes(sale) {
    if (!sale?.voided_at) return null;
    return Math.max(0, Math.round((new Date(sale.voided_at).getTime() - new Date(sale.created_at).getTime()) / MINUTE));
}

const dayWib = (date) => new Date(new Date(date).getTime() + 7 * 3600000).toISOString().slice(0, 10);

/**
 * REKONSILIASI DAPUR ↔ KASIR: pesanan yang sudah dibuat dapur (siap / diambil)
 * tetapi nomor antriannya tidak pernah muncul di penjualan lunas maupun bill terbuka.
 */
export function unpaidKitchenOrders({ tickets = [], sales = [], bills = [], products = [], now = Date.now(), graceMinutes = 15 }) {
    const paid = new Set(sales.filter((sale) => sale.status !== "batal" && sale.queue_no).map((sale) => `${dayWib(sale.created_at)}|${sale.queue_no}`));
    const open = new Set(bills.filter((bill) => bill.queue_no).map((bill) => bill.queue_no));
    const orders = new Map();

    for (const ticket of tickets) {
        if (!ticket.queue_no || ticket.label === "Riwayat") continue;
        if (!["siap", "diambil"].includes(ticket.status)) continue;
        const doneAt = new Date(ticket.picked_at || ticket.ready_at || ticket.created_at).getTime();
        if (now - new Date(ticket.created_at).getTime() < graceMinutes * MINUTE) continue;
        const key = `${dayWib(ticket.created_at)}|${ticket.queue_no}`;
        if (paid.has(key) || open.has(ticket.queue_no)) continue;

        const order = orders.get(key) || {
            queue_no: ticket.queue_no, day: dayWib(ticket.created_at), label: ticket.label, channel: ticket.channel,
            created_by: ticket.created_by || null, created_at: ticket.created_at, done_at: doneAt, items: [], value: 0,
        };
        for (const item of ticket.items) {
            const price = money(products.find((product) => String(product.id) === String(item.product_id))?.price);
            order.items.push(item);
            order.value += price * (Number(item.qty) || 0);
        }
        order.done_at = Math.max(order.done_at, doneAt);
        orders.set(key, order);
    }
    return [...orders.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * SKOR INTEGRITAS KASIR (0–100) + penjelasan dengan bahasa biasa.
 * Bukan vonis: tanda untuk dicek owner. Hanya dilihat owner / keuangan.
 */
export function integrityReport({ cashiers = [], sales = [], shifts = [], summaries = {}, unpaid = [] }) {
    return cashiers.map((cashier) => {
        const own = sales.filter((sale) => sale.cashier_id === cashier.id);
        const voids = own.filter((sale) => sale.status === "batal");
        const late = voids.filter((sale) => (voidDelayMinutes(sale) ?? 0) > LATE_VOID_MINUTES);
        const gross = own.reduce((sum, sale) => sum + money(sale.subtotal || sale.total), 0);
        const discount = own.reduce((sum, sale) => sum + money(sale.discount), 0);
        const closed = shifts.filter((shift) => shift.cashier_id === cashier.id && shift.status === "closed");
        const variances = closed.map((shift) => summaries[shift.id]?.variance ?? shift.variance ?? 0);
        const shortTotal = variances.filter((value) => value < 0).reduce((sum, value) => sum + value, 0);
        const mineUnpaid = unpaid.filter((order) => order.created_by === cashier.id);

        const flags = [];
        let score = 100;
        const voidRate = own.length ? (voids.length / own.length) * 100 : 0;
        if (voidRate > 6) {
            score -= 25;
            flags.push({ tone: "late", text: `Void ${voidRate.toFixed(1)}% dari transaksi (wajar < 3%).` });
        } else if (voidRate > 3) {
            score -= 10;
            flags.push({ tone: "warn", text: `Void ${voidRate.toFixed(1)}% dari transaksi (wajar < 3%).` });
        }
        if (late.length) {
            score -= 15 * Math.min(late.length, 3);
            flags.push({ tone: "late", text: `${late.length} void terlambat: dilakukan > ${LATE_VOID_MINUTES} menit setelah transaksi (pelanggan biasanya sudah pergi).` });
        }
        const discountRate = gross ? (discount / gross) * 100 : 0;
        if (discountRate > 5) {
            score -= 10;
            flags.push({ tone: "warn", text: `Diskon ${discountRate.toFixed(1)}% dari penjualan (wajar < 5%).` });
        }
        if (shortTotal < -20000) {
            score -= 20;
            flags.push({ tone: "late", text: `Laci kurang total Rp ${Math.abs(shortTotal).toLocaleString("id-ID")} di ${variances.filter((value) => value < 0).length} shift.` });
        } else if (shortTotal < 0) {
            score -= 5;
            flags.push({ tone: "warn", text: `Laci kurang Rp ${Math.abs(shortTotal).toLocaleString("id-ID")} (kecil, tetap dicatat).` });
        }
        if (mineUnpaid.length) {
            score -= 30;
            flags.push({ tone: "late", text: `${mineUnpaid.length} pesanan sudah dibuat dapur tapi tidak pernah dibayar di kasir.` });
        }
        if (!flags.length) flags.push({ tone: "ok", text: "Tidak ada pola mencurigakan." });

        return {
            cashier,
            score: Math.max(0, score),
            level: score >= 85 ? "ok" : score >= 60 ? "warn" : "late",
            transactions: own.length,
            voids: voids.length,
            lateVoids: late.length,
            shifts: closed.length,
            flags,
        };
    }).sort((a, b) => a.score - b.score);
}

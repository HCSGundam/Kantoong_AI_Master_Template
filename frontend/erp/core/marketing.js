/**
 * KANTOONG ERP — ATURAN VOUCHER
 * File: frontend/erp/core/marketing.js
 *
 * Sama dengan erp_check_voucher / erp_voucher_discount di erp-phase3.sql.
 * Dipakai ERP (pratinjau) dan keranjang (tampilan potongan). Server tetap
 * memeriksa ulang saat pesanan dibuat.
 */

export const VOUCHER_KINDS = Object.freeze({ persen: "Persen (%)", nominal: "Potongan Rp" });

export function normalizeCode(code) {
    return String(code ?? "").trim().toUpperCase();
}

export function isValidCode(code) {
    return /^[A-Z0-9]{3,20}$/.test(normalizeCode(code));
}

/** Potongan untuk subtotal tertentu (tidak pernah melebihi subtotal). */
export function voucherDiscount(voucher, subtotal) {
    const base = Math.max(0, Math.round(Number(subtotal) || 0));
    if (!voucher) return 0;
    const raw = voucher.kind === "persen"
        ? Math.min(Math.round((base * Number(voucher.value)) / 100), Number(voucher.max_discount) || Infinity)
        : Math.round(Number(voucher.value) || 0);
    return Math.max(0, Math.min(base, raw));
}

/** Cek lengkap: aktif, masa berlaku, kuota, minimal belanja. */
export function checkVoucher(voucher, subtotal, now = new Date()) {
    if (!voucher || !voucher.is_active) return { valid: false, message: "Kode voucher tidak ditemukan." };
    if (voucher.starts_at && now < new Date(voucher.starts_at)) return { valid: false, message: "Voucher belum berlaku." };
    if (voucher.ends_at && now > new Date(voucher.ends_at)) return { valid: false, message: "Voucher sudah berakhir." };
    if (voucher.quota && voucher.used >= voucher.quota) return { valid: false, message: "Kuota voucher sudah habis." };
    if ((Number(subtotal) || 0) < (Number(voucher.min_purchase) || 0)) {
        return { valid: false, message: `Minimal belanja Rp ${Number(voucher.min_purchase).toLocaleString("id-ID")}.` };
    }
    return { valid: true, discount: voucherDiscount(voucher, subtotal) };
}

/** "10% maks Rp 20.000" / "Potongan Rp 15.000" */
export function describeVoucher(voucher) {
    if (!voucher) return "";
    const rp = (value) => `Rp ${Number(value).toLocaleString("id-ID")}`;
    const main = voucher.kind === "persen"
        ? `${String(voucher.value).replace(".", ",")}%${voucher.max_discount ? ` maks ${rp(voucher.max_discount)}` : ""}`
        : `Potongan ${rp(voucher.value)}`;
    return voucher.min_purchase > 0 ? `${main} · min. belanja ${rp(voucher.min_purchase)}` : main;
}

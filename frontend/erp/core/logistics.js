/**
 * KANTOONG ERP — ALUR PESANAN ONLINE (LOGISTIK)
 * File: frontend/erp/core/logistics.js
 *
 * Sama dengan erp_order_advance di erp-phase3.sql.
 * menunggu_pembayaran -> dibayar -> diproses -> dikirim -> selesai
 */

export const ORDER_STEPS = Object.freeze([
    { status: "menunggu_pembayaran", label: "Menunggu bayar" },
    { status: "dibayar", label: "Siap dikemas" },
    { status: "diproses", label: "Dikemas" },
    { status: "dikirim", label: "Dalam pengiriman" },
    { status: "selesai", label: "Selesai" },
]);

/** Aksi berikutnya per status + siapa yang boleh. */
const ACTIONS = Object.freeze({
    menunggu_pembayaran: [
        { action: "bayar", label: "Konfirmasi sudah bayar", roles: ["keuangan", "cs"] },
        { action: "batal", label: "Batalkan", roles: ["cs", "keuangan"], danger: true },
    ],
    dibayar: [
        { action: "proses", label: "Mulai kemas", roles: ["gudang"] },
        { action: "batal", label: "Batalkan", roles: ["cs", "keuangan"], danger: true },
    ],
    diproses: [
        { action: "kirim", label: "Kirim + isi resi", roles: ["gudang"] },
        { action: "batal", label: "Batalkan", roles: ["cs", "keuangan"], danger: true },
    ],
    dikirim: [
        { action: "selesai", label: "Tandai diterima pembeli", roles: ["gudang", "cs"] },
    ],
});

export function actionsFor(status, viewer) {
    if (!viewer) return [];
    return (ACTIONS[status] || []).filter((entry) => viewer.level >= 4 || entry.roles.includes(viewer.job_role));
}

const NEXT = { bayar: "dibayar", proses: "diproses", kirim: "dikirim", selesai: "selesai", batal: "dibatalkan" };

/** Status hasil aksi, atau melempar error bila aksi tidak sah. */
export function applyAction(status, action, { tracking = "", warehouseId = "" } = {}) {
    if (!(ACTIONS[status] || []).some((entry) => entry.action === action)) {
        throw new Error(`Langkah "${action}" tidak bisa untuk pesanan berstatus ${status}.`);
    }
    if (action === "kirim") {
        if (!String(tracking).trim()) throw new Error("Nomor resi wajib diisi.");
        if (!warehouseId) throw new Error("Pilih gudang asal pengiriman.");
    }
    return NEXT[action];
}

/** Umur pesanan dalam jam (untuk penanda terlambat). */
export function hoursSince(date, now = new Date()) {
    return Math.floor((now - new Date(date)) / 3600000);
}

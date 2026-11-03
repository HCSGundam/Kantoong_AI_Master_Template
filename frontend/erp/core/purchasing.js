/**
 * KANTOONG ERP — ATURAN PEMBELIAN (PO)
 * File: frontend/erp/core/purchasing.js
 *
 * Sama dengan erp_po_save / erp_po_status di erp-phase3.sql:
 * draft -> dipesan -> diterima (stok +, jurnal Persediaan/Utang)
 *       -> dibayar (jurnal pelunasan). Batal hanya saat draft/dipesan.
 */

export const PO_STATUS = Object.freeze({
    draft: { label: "Draf", tone: "" },
    dipesan: { label: "Dipesan ke supplier", tone: "warn" },
    diterima: { label: "Barang diterima", tone: "" },
    dibayar: { label: "Lunas", tone: "good" },
    dibatalkan: { label: "Dibatalkan", tone: "bad" },
});

const FLOW = Object.freeze({
    draft: ["dipesan", "dibatalkan"],
    dipesan: ["diterima", "dibatalkan"],
    diterima: ["dibayar"],
    dibayar: [],
    dibatalkan: [],
});

export function canTransition(from, to) {
    return (FLOW[from] || []).includes(to);
}

export function nextSteps(status) {
    return FLOW[status] || [];
}

export function poTotal(lines) {
    return lines.reduce((sum, line) => sum + (Math.floor(Number(line.qty)) || 0) * (Math.round(Number(line.unit_cost)) || 0), 0);
}

/** Validasi baris PO. Mengembalikan pesan error atau "". */
export function validatePoLines(lines) {
    if (!lines.length) return "PO minimal berisi 1 barang.";
    for (const line of lines) {
        const qty = Number(line.qty);
        const cost = Number(line.unit_cost);
        if (!line.product_id) return "Pilih produk di setiap baris.";
        if (!Number.isInteger(qty) || qty < 1) return "Jumlah barang harus bilangan bulat ≥ 1.";
        if (!Number.isFinite(cost) || cost < 0) return "Harga beli tidak boleh minus.";
    }
    return "";
}

/** Jurnal saat barang diterima & saat PO dibayar. */
export function receiveJournal(total) {
    return [
        { account_code: "1-1300", debit: total, credit: 0 },
        { account_code: "2-1000", debit: 0, credit: total },
    ];
}

export function payJournal(total, method = "transfer") {
    return [
        { account_code: "2-1000", debit: total, credit: 0 },
        { account_code: method === "tunai" ? "1-1000" : "1-1100", debit: 0, credit: total },
    ];
}

export function poNumber(serial, now = new Date()) {
    const local = new Date(now.getTime() + 7 * 3600000);
    return `PO-${local.toISOString().slice(2, 7).replace("-", "")}-${String(serial).padStart(4, "0")}`;
}

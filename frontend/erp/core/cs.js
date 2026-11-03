/**
 * KANTOONG ERP — CUSTOMER SERVICE
 * File: frontend/erp/core/cs.js
 */

export const TICKET_KINDS = Object.freeze({
    pertanyaan: "Pertanyaan",
    keluhan: "Keluhan",
    retur: "Retur / tukar barang",
    lainnya: "Lainnya",
});

export const TICKET_STATUS = Object.freeze({
    baru: { label: "Baru", tone: "warn" },
    diproses: { label: "Diproses", tone: "" },
    selesai: { label: "Selesai", tone: "good" },
    ditutup: { label: "Ditutup", tone: "" },
});

export const PRIORITIES = Object.freeze({
    tinggi: "Tinggi",
    normal: "Normal",
    rendah: "Rendah",
});

/** Tiket terbuka diurutkan: prioritas tinggi & paling lama menunggu dulu. */
export function sortTickets(tickets) {
    const rank = { tinggi: 0, normal: 1, rendah: 2 };
    const open = (ticket) => (["baru", "diproses"].includes(ticket.status) ? 0 : 1);
    return tickets.slice().sort((a, b) =>
        open(a) - open(b) ||
        (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1) ||
        String(a.created_at).localeCompare(String(b.created_at))
    );
}

/** Lama menunggu: "2 jam", "3 hari". */
export function waitingLabel(createdAt, now = new Date()) {
    const hours = Math.max(0, Math.floor((now - new Date(createdAt)) / 3600000));
    if (hours < 1) return "baru saja";
    if (hours < 24) return `${hours} jam`;
    return `${Math.floor(hours / 24)} hari`;
}

export function ticketNumber(serial) {
    return `CS-${String(serial).padStart(5, "0")}`;
}

/** Jurnal pengembalian dana retur (sama dengan erp_cs_return). */
export function refundJournal(amount, method = "transfer") {
    return [
        { account_code: "4-1000", debit: amount, credit: 0 },
        { account_code: method === "tunai" ? "1-1000" : "1-1100", debit: 0, credit: amount },
    ];
}

/**
 * KANTOONG ERP PRO — GUDANG PRO (tab di Gudang & Stok)
 * File: frontend/erp/modules/inventory-pro.js
 *
 * Saran belanja: "habis dalam X hari" dari pemakaian nyata + jumlah pesan yang
 * disarankan (bisa langsung jadi pengajuan PO berjenjang).
 * Kedaluwarsa: batch per tanggal, FEFO, buang batch yang lewat.
 */

import { EXPIRY_LABELS, URGENCY_LABELS, expiryAlerts, reorderSuggestions } from "../core/inventory-pro.js";
import { hasRole } from "../core/org.js";
import { el, emptyState, formDialog, friendlyError, rupiah, statCard, toast } from "../ui.js";
import { invalidateProData } from "./pro-data.js";

export const INVENTORY_PRO_TABS = [
    { value: "stok", label: "Stok" },
    { value: "saran", label: "Saran belanja" },
    { value: "kedaluwarsa", label: "Kedaluwarsa" },
];

const fmtDay = (day) => new Date(`${day}T00:00:00+07:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

export async function inventoryProView(ctx, tab, { warehouses, levels, products }) {
    return tab === "saran" ? reorderView(ctx, levels, products) : expiryView(ctx, warehouses, products);
}

async function reorderView(ctx, levels, products) {
    const since = new Date(Date.now() - 14 * 86400000).toISOString();
    const [moves, sales] = await Promise.all([
        ctx.data.listStockMoves({ limit: 2000 }).catch(() => []),
        ctx.data.listPosSales?.({ since }).catch(() => []) ?? [],
    ]);
    const rows = reorderSuggestions({ levels, moves, products, sales });
    const wrap = el("div", { class: "erp-stack" });
    const total = rows.reduce((n, r) => n + r.suggest * (r.cost || 0), 0);

    wrap.appendChild(el("section", { class: "erp-stats" },
        statCard({ label: "Sudah habis", value: String(rows.filter((r) => r.urgency === "habis").length), tone: rows.some((r) => r.urgency === "habis") ? "bad" : "" }),
        statCard({ label: "Pesan hari ini", value: String(rows.filter((r) => r.urgency === "segera").length), sub: "habis sebelum barang datang (3 hari)" }),
        statCard({ label: "Waktunya pesan", value: String(rows.filter((r) => r.urgency === "pesan").length) }),
        total ? statCard({ label: "Perkiraan belanja", value: rupiah(total), sub: "dari harga modal" }) : null));

    if (!rows.length) {
        wrap.appendChild(emptyState("Semua stok cukup untuk 14 hari ke depan. 👍"));
        return wrap;
    }

    wrap.appendChild(el("section", { class: "erp-card" },
        el("p", { class: "erp-muted", text: "Dihitung dari rata-rata barang keluar & penjualan kasir 14 hari terakhir. Waktu tunggu pemasok: 3 hari, stok untuk 14 hari." }),
        el("div", { class: "erp-table-wrap" }, el("table", { class: "erp-table" },
            el("thead", {}, el("tr", {}, ["Produk", "Stok", "Terpakai/hari", "Habis dalam", "Saran pesan", "Status"].map((h) => el("th", { text: h })))),
            el("tbody", {}, rows.map((r) => el("tr", {},
                el("td", { "data-label": "Produk", text: r.name }),
                el("td", { "data-label": "Stok", class: "erp-num", text: r.onHand.toLocaleString("id-ID") }),
                el("td", { "data-label": "Terpakai/hari", class: "erp-num", text: r.perDay.toLocaleString("id-ID") }),
                el("td", { "data-label": "Habis dalam", class: "erp-num", text: r.daysLeft == null ? "—" : r.onHand <= 0 ? "Sudah habis" : `${r.daysLeft} hari` }),
                el("td", { "data-label": "Saran pesan", class: "erp-num" }, el("strong", { text: r.suggest.toLocaleString("id-ID") })),
                el("td", { "data-label": "Status" }, el("span", { class: `erp-pill erp-pill--${r.urgency === "pesan" ? "warn" : "bad"}`, text: URGENCY_LABELS[r.urgency] }))))))),
        el("div", { class: "erp-row-actions" },
            el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => askPo(ctx, rows, total) }, "Ajukan PO dari saran ini →"))));
    return wrap;
}

/** Saran belanja → pengajuan "po" yang ikut rantai persetujuan berjenjang. */
async function askPo(ctx, rows, total) {
    const values = await formDialog({
        title: "Ajukan pembelian (PO)",
        submitLabel: "Kirim pengajuan",
        fields: [
            { name: "title", label: "Judul", value: `PO restok ${rows.length} barang`, required: true, max: 120 },
            { name: "amount", label: "Perkiraan nilai (Rp)", type: "number", min: 0, step: 1000, value: total || "" },
            { name: "note", label: "Rincian", type: "textarea", max: 500, value: rows.slice(0, 12).map((r) => `${r.name}: ${r.suggest}`).join("\n") },
        ],
    });
    if (!values) return;
    try {
        await ctx.data.createApproval({ kind: "po", title: values.title.trim(), amount: values.amount ? Math.round(Number(values.amount)) : null, note: values.note.trim() || null });
        invalidateProData();
        toast("Pengajuan PO terkirim. Pantau di Persetujuan.");
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

async function expiryView(ctx, warehouses, products) {
    const batches = await ctx.data.listBatches?.().catch(() => []) ?? [];
    const alerts = expiryAlerts(batches);
    const canEdit = hasRole(ctx.me, "gudang");
    const productName = (id) => products.find((p) => String(p.id) === String(id))?.name || id;
    const whName = (id) => warehouses.find((w) => w.id === id)?.name || "—";
    const wrap = el("div", { class: "erp-stack" });

    wrap.appendChild(el("div", { class: "erp-toolbar" },
        el("p", { class: "erp-muted", text: "FEFO: barang yang paling cepat kedaluwarsa dikeluarkan lebih dulu. Yang ≤ 7 hari sebaiknya dipromokan." }),
        canEdit ? el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => addBatch(ctx, warehouses, products) }, "+ Catat batch") : null));

    wrap.appendChild(el("section", { class: "erp-stats" },
        statCard({ label: "Sudah kedaluwarsa", value: String(alerts.filter((b) => b.status === "lewat").length), tone: alerts.some((b) => b.status === "lewat") ? "bad" : "" }),
        statCard({ label: "≤ 7 hari", value: String(alerts.filter((b) => b.status === "minggu").length), tone: alerts.some((b) => b.status === "minggu") ? "warn" : "" }),
        statCard({ label: "≤ 30 hari", value: String(alerts.filter((b) => b.status === "bulan").length) }),
        statCard({ label: "Batch tercatat", value: String(batches.filter((b) => b.qty > 0).length) })));

    const list = batches.filter((b) => b.qty > 0).sort((a, b) => a.expires_on.localeCompare(b.expires_on));
    if (!list.length) {
        wrap.appendChild(emptyState("Belum ada batch bertanggal kedaluwarsa."));
        return wrap;
    }
    const statusOf = (b) => alerts.find((a) => a.id === b.id)?.status || "aman";

    wrap.appendChild(el("section", { class: "erp-card" }, el("div", { class: "erp-table-wrap" }, el("table", { class: "erp-table" },
        el("thead", {}, el("tr", {}, ["Produk", "Lot", "Lokasi", "Jumlah", "Kedaluwarsa", "Status", ""].map((h) => el("th", { text: h })))),
        el("tbody", {}, list.map((b) => {
            const status = statusOf(b);
            return el("tr", {},
                el("td", { "data-label": "Produk", text: productName(b.product_id) }),
                el("td", { "data-label": "Lot", text: b.lot }),
                el("td", { "data-label": "Lokasi", text: whName(b.warehouse_id) }),
                el("td", { "data-label": "Jumlah", class: "erp-num", text: Number(b.qty).toLocaleString("id-ID") }),
                el("td", { "data-label": "Kedaluwarsa", text: fmtDay(b.expires_on) }),
                el("td", { "data-label": "Status" }, el("span", { class: `erp-pill erp-pill--${{ lewat: "bad", minggu: "bad", bulan: "warn", aman: "good" }[status]}`, text: EXPIRY_LABELS[status] })),
                el("td", { "data-label": "" }, canEdit && status === "lewat"
                    ? el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: async () => {
                        if (!window.confirm("Tandai batch ini sudah dibuang? Jumlahnya jadi 0.")) return;
                        try {
                            await ctx.data.disposeBatch(b.id);
                            invalidateProData();
                            ctx.rerender();
                        } catch (error) {
                            toast(friendlyError(error), "error");
                        }
                    } }, "Buang")
                    : null));
        }))))));
    return wrap;
}

async function addBatch(ctx, warehouses, products) {
    const values = await formDialog({
        title: "Catat batch barang",
        fields: [
            { name: "product_id", label: "Produk", type: "select", options: products.map((p) => ({ value: p.id, label: p.name })) },
            { name: "warehouse_id", label: "Lokasi", type: "select", options: warehouses.map((w) => ({ value: w.id, label: w.name })) },
            { name: "lot", label: "Nomor lot (opsional)", max: 30 },
            { name: "qty", label: "Jumlah", type: "number", min: 1, step: 1, required: true },
            { name: "expires_on", label: "Tanggal kedaluwarsa", type: "date", required: true },
        ],
    });
    if (!values) return;
    try {
        await ctx.data.saveBatch(values);
        invalidateProData();
        toast("Batch dicatat.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

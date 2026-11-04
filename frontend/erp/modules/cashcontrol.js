/**
 * KANTOONG ERP — KONTROL KASIR (Tahap 3 POS Pro)
 * File: frontend/erp/modules/cashcontrol.js
 *
 * Untuk owner, manajer & keuangan (supervisor: atur PIN persetujuan).
 * Pertanyaan terbalik: "Bagaimana kasir bisa curang tanpa ketahuan?"
 *   - REKONSILIASI DAPUR ↔ KASIR: pesanan sudah dibuat dapur tapi tidak
 *     pernah dibayar — hanya mungkin karena dapur & kasir satu data.
 *   - SKOR INTEGRITAS KASIR: pola void, void terlambat, diskon, selisih laci.
 *   - Riwayat shift (tutup buta) & void yang disetujui atasan.
 */

import { hasRole } from "../core/org.js";
import { CHANNELS, orderLabel } from "../core/pos-pro.js";
import { VOID_REASONS, integrityReport, shiftSummary, unpaidKitchenOrders, voidDelayMinutes, LATE_VOID_MINUTES } from "../core/cash-control.js";
import { dateTime, el, emptyState, formDialog, friendlyError, pageHeader, rupiah, segmented, statCard, toast } from "../ui.js";

const view = { outlet: null, days: 7 };

export async function render(ctx) {
    const { data, me } = ctx;
    const page = el("div", { class: "erp-page__inner" });
    const warehouses = await data.listWarehouses();
    const outlets = warehouses.filter((entry) => entry.kind === "outlet" && entry.is_active !== false);
    if (!outlets.some((entry) => entry.id === view.outlet)) view.outlet = outlets[0]?.id || null;

    const canSeeAll = hasRole(me, "keuangan");
    const pinButton = me.level >= 3 ? el("button", { class: "erp-btn", type: "button", onclick: () => setPin(ctx) }, "🔑 Atur PIN persetujuanku") : null;

    if (!outlets.length) {
        page.append(pageHeader("Kontrol Kasir", "Belum ada outlet.", pinButton), emptyState("Buat outlet dulu di menu Gudang & Stok."));
        return page;
    }

    const since = new Date(Date.now() - view.days * 86400000).toISOString();
    const [sales, shifts, tickets, bills, products, members, hasPin] = await Promise.all([
        data.listPosSales({ since }),
        data.listShifts({ outletId: view.outlet, days: view.days }),
        data.listKitchenTickets({ outletId: view.outlet, days: view.days }),
        data.listOpenBills(view.outlet),
        data.listProducts(),
        data.listMembers(),
        data.hasMyPin(),
    ]);
    const moves = await data.listCashMoves({ shiftIds: shifts.map((shift) => shift.id) });
    const outletSales = sales.filter((sale) => sale.outlet_id === view.outlet);
    const nameOf = (id) => members.find((member) => member.id === id)?.full_name || "—";

    const summaries = Object.fromEntries(shifts.map((shift) => [shift.id, shiftSummary({
        shift, sales: outletSales, moves, refunds: outletSales.filter((sale) => sale.refund_shift_id),
    })]));
    const unpaid = unpaidKitchenOrders({ tickets, sales: outletSales, bills, products });
    const voids = outletSales.filter((sale) => sale.status === "batal").sort((a, b) => (b.voided_at || "").localeCompare(a.voided_at || ""));
    const approvedDiscounts = outletSales.filter((sale) => sale.discount_approved_by && sale.status !== "batal");
    const cashierIds = [...new Set([...outletSales.map((sale) => sale.cashier_id), ...shifts.map((shift) => shift.cashier_id)])].filter(Boolean);
    const report = canSeeAll ? integrityReport({
        cashiers: cashierIds.map((id) => members.find((member) => member.id === id) || { id, full_name: nameOf(id) }),
        sales: outletSales, shifts, summaries, unpaid,
    }) : [];

    const closed = shifts.filter((shift) => shift.status === "closed");
    const varianceTotal = closed.reduce((sum, shift) => sum + (summaries[shift.id]?.variance ?? Number(shift.variance) ?? 0), 0);
    const short = closed.filter((shift) => (summaries[shift.id]?.variance ?? shift.variance) < 0).length;

    page.appendChild(pageHeader(
        "Kontrol Kasir",
        "Bukan sekadar laporan: sistem mencari celah kecurangan yang biasanya tidak terlihat.",
        outlets.length > 1 ? segmented(outlets.map((entry) => ({ value: entry.id, label: `🏪 ${entry.name}` })), view.outlet, (value) => { view.outlet = value; ctx.rerender(); }) : null,
        segmented([{ value: 1, label: "Hari ini" }, { value: 7, label: "7 hari" }, { value: 30, label: "30 hari" }], view.days, (value) => { view.days = value; ctx.rerender(); }),
        pinButton
    ));

    if (me.level >= 3 && !hasPin) {
        page.appendChild(el("p", { class: "erp-note erp-cc__nudge", text: "🔑 Kamu belum punya PIN persetujuan. Kasir butuh PIN atasan untuk void & diskon besar — atur sekarang." }));
    }

    if (!canSeeAll) {
        page.appendChild(emptyState("Laporan kontrol kasir hanya untuk owner, manajer & keuangan. Kamu tetap bisa mengatur PIN persetujuan di atas."));
        return page;
    }

    page.appendChild(el("div", { class: "erp-stats" },
        statCard({
            label: "Pesanan dibuat tapi tidak dibayar",
            value: String(unpaid.length),
            sub: unpaid.length ? `±${rupiah(unpaid.reduce((sum, order) => sum + order.value, 0))} — cek sekarang` : "dapur & kasir cocok",
            tone: unpaid.length ? "alert" : "",
        }),
        statCard({ label: "Selisih laci", value: `${varianceTotal < 0 ? "−" : varianceTotal > 0 ? "+" : ""}${rupiah(Math.abs(varianceTotal))}`, sub: `${closed.length} shift ditutup · ${short} kurang`, tone: varianceTotal < 0 ? "alert" : "" }),
        statCard({ label: "Void", value: String(voids.length), sub: voids.length ? `${rupiah(voids.reduce((sum, sale) => sum + Number(sale.total), 0))} · ${voids.filter((sale) => (voidDelayMinutes(sale) ?? 0) > LATE_VOID_MINUTES).length} terlambat` : "tidak ada", tone: voids.some((sale) => (voidDelayMinutes(sale) ?? 0) > LATE_VOID_MINUTES) ? "alert" : "" }),
        statCard({ label: "Diskon disetujui atasan", value: String(approvedDiscounts.length), sub: rupiah(approvedDiscounts.reduce((sum, sale) => sum + Number(sale.discount), 0)) })
    ));

    // ---------- 1. Rekonsiliasi Dapur ↔ Kasir ----------
    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" },
            el("h2", { text: "🚨 Rekonsiliasi Dapur ↔ Kasir" }),
            el("span", { class: "erp-muted", text: "Pesanan yang sudah dibuat & diambil, tapi nomornya tidak pernah lunas di kasir" })),
        unpaid.length
            ? el("ul", { class: "erp-cc__list" }, unpaid.map((order) => el("li", { class: "is-late" },
                el("div", {},
                    el("strong", { text: `${order.queue_no} · ${CHANNELS[order.channel]?.icon || ""} ${order.label || orderLabel(order)}` }),
                    el("small", { text: order.items.map((item) => `${item.qty}× ${item.name}`).join(", ") }),
                    el("small", { text: `Dibuat ${dateTime(order.created_at)} · dikirim ke dapur oleh ${nameOf(order.created_by)} · tidak ada pembayaran & bukan bill terbuka` })
                ),
                el("strong", { class: "erp-cc__value", text: `±${rupiah(order.value)}` })
            )))
            : emptyState("✔ Semua pesanan yang dibuat dapur sudah dibayar atau masih di bill terbuka.")
    ));

    // ---------- 2. Skor integritas ----------
    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" },
            el("h2", { text: "🛡️ Skor integritas kasir" }),
            el("span", { class: "erp-muted", text: "Bukan vonis — tanda untuk dicek. Hanya terlihat owner, manajer & keuangan." })),
        report.length
            ? el("div", { class: "erp-cc__scores" }, report.map((row) => el("article", { class: `erp-cc__score is-${row.level}` },
                el("header", {},
                    el("strong", { text: row.cashier.full_name }),
                    el("span", { class: "erp-cc__num", text: String(row.score) })),
                el("small", { text: `${row.transactions} transaksi · ${row.voids} void (${row.lateVoids} terlambat) · ${row.shifts} shift` }),
                el("ul", {}, row.flags.map((flag) => el("li", { class: `is-${flag.tone}`, text: flag.text })))
            )))
            : emptyState("Belum ada transaksi kasir di periode ini.")
    ));

    // ---------- 3. Riwayat shift ----------
    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" }, el("h2", { text: "🧾 Shift (tutup buta)" })),
        shifts.length
            ? el("div", { class: "erp-table-wrap" }, el("table", { class: "erp-table" },
                el("thead", {}, el("tr", {}, ["Kasir", "Buka", "Tutup", "Modal", "Seharusnya", "Dihitung", "Selisih", "Catatan"].map((head) => el("th", { text: head })))),
                el("tbody", {}, shifts.slice().sort((a, b) => b.opened_at.localeCompare(a.opened_at)).map((shift) => {
                    const summary = summaries[shift.id];
                    const variance = shift.status === "closed" ? summary.variance ?? shift.variance : null;
                    return el("tr", { class: variance < 0 ? "is-short" : null },
                        el("td", { "data-label": "Kasir", text: nameOf(shift.cashier_id) }),
                        el("td", { "data-label": "Buka", text: dateTime(shift.opened_at) }),
                        el("td", { "data-label": "Tutup", text: shift.status === "open" ? "🟢 masih buka" : dateTime(shift.closed_at) }),
                        el("td", { "data-label": "Modal", text: rupiah(shift.opening_cash) }),
                        el("td", { "data-label": "Seharusnya", text: rupiah(summary.expected) }),
                        el("td", { "data-label": "Dihitung", text: shift.status === "closed" ? rupiah(shift.counted_cash) : "—" }),
                        el("td", { "data-label": "Selisih", text: variance === null ? "—" : `${variance > 0 ? "+" : variance < 0 ? "−" : ""}${rupiah(Math.abs(variance))}` }),
                        el("td", { "data-label": "Catatan", text: shift.note || "" })
                    );
                }))
            ))
            : emptyState("Belum ada shift.")
    ));

    // ---------- 4. Void ----------
    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" }, el("h2", { text: "↩️ Void & persetujuan atasan" })),
        voids.length
            ? el("div", { class: "erp-table-wrap" }, el("table", { class: "erp-table" },
                el("thead", {}, el("tr", {}, ["Struk", "Kasir", "Total", "Alasan", "Disetujui", "Jeda"].map((head) => el("th", { text: head })))),
                el("tbody", {}, voids.map((sale) => {
                    const delay = voidDelayMinutes(sale);
                    return el("tr", { class: delay > LATE_VOID_MINUTES ? "is-short" : null },
                        el("td", { "data-label": "Struk" }, el("code", { text: sale.receipt_no })),
                        el("td", { "data-label": "Kasir", text: nameOf(sale.void_by || sale.cashier_id) }),
                        el("td", { "data-label": "Total", text: rupiah(sale.total) }),
                        el("td", { "data-label": "Alasan", text: `${VOID_REASONS[sale.void_reason] || "—"}${sale.void_note ? ` · ${sale.void_note}` : ""}` }),
                        el("td", { "data-label": "Disetujui", text: nameOf(sale.void_approved_by) }),
                        el("td", { "data-label": "Jeda", text: delay === null ? "—" : `${delay} menit${delay > LATE_VOID_MINUTES ? " ⚠️ terlambat" : ""}` })
                    );
                }))
            ))
            : emptyState("Tidak ada void di periode ini.")
    ));

    return page;
}

async function setPin(ctx) {
    const values = await formDialog({
        title: "PIN persetujuan atasan",
        fields: [
            { name: "pin", label: "PIN baru (4–6 angka)", type: "password", required: true, max: 6, hint: "Dipakai menyetujui void & diskon besar di kasir. Jangan beritahu kasir." },
            { name: "again", label: "Ulangi PIN", type: "password", required: true, max: 6 },
        ],
    });
    if (!values) return;
    if (values.pin !== values.again) {
        toast("Ulangan PIN belum sama.", "error");
        return;
    }
    try {
        await ctx.data.setMyPin(values.pin);
        toast("PIN persetujuan disimpan.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

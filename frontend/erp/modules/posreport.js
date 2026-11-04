/**
 * KANTOONG ERP — LAPORAN KASIR YANG BERCERITA (Tahap 6 POS Pro)
 * File: frontend/erp/modules/posreport.js
 *
 * Untuk owner, manajer, supervisor & keuangan.
 *   - Ringkasan dalam kalimat biasa + tanda baik/buruk
 *   - Pembanding ADIL: hari yang sama minggu lalu sampai jam yang sama
 *   - Rekap per jam, menu (laba kotor), channel (komisi ojol), metode bayar
 *     (cocokkan ke mutasi bank/QRIS), kasir, pajak PB1 & service, kepuasan pelanggan
 *   - Ekspor CSV (titik koma, siap Excel Indonesia) & cetak
 */

import { hasRole } from "../core/org.js";
import { CHANNELS, PAY_METHODS, posSettings } from "../core/pos-pro.js";
import { PERIODS, buildReport, periodRange, pctChange, storyLines, toCsv } from "../core/pos-report.js";
import { dateTime, el, emptyState, pageHeader, rupiah, segmented, statCard, toast } from "../ui.js";

const view = { period: "today", outlet: "all" };

export async function render(ctx) {
    const { data, me } = ctx;
    const page = el("div", { class: "erp-page__inner erp-report" });
    const now = new Date();
    const range = periodRange(view.period, now);
    const since = new Date(range.prevFrom).toISOString();

    const warehouses = await data.listWarehouses();
    const outlets = warehouses.filter((entry) => entry.kind === "outlet");
    const firstOutlet = outlets[0]?.id;
    const [sales, members, lost, ratings, settingsRaw, book, ingredients] = await Promise.all([
        data.listPosSales({ since }),
        data.listMembers(),
        data.listLostSales({ since }),
        data.listRatings ? data.listRatings({ since }) : [],
        firstOutlet ? data.getPosSettings(firstOutlet) : {},
        data.getRecipes ? data.getRecipes() : { recipes: {}, optionRecipes: {} },
        firstOutlet && data.listIngredients ? data.listIngredients(firstOutlet) : [],
    ]);
    const settings = posSettings(settingsRaw);
    const pick = (list) => (view.outlet === "all" ? list : list.filter((entry) => entry.outlet_id === view.outlet));
    const hasCost = ingredients.some((entry) => entry.cost !== null);
    const context = hasCost ? { ...book, ingredients } : null;
    const nameOf = (id) => members.find((member) => member.id === id)?.full_name || "—";

    const args = { sales: pick(sales), context, settings, lost: pick(lost), ratings: pick(ratings) };
    const report = buildReport({ ...args, from: range.from, to: range.to });
    const previous = buildReport({ ...args, from: range.prevFrom, to: range.prevTo });
    const story = storyLines(report, previous, { compareLabel: range.compareLabel, cashierName: nameOf });
    const change = pctChange(report.gross, previous.gross);

    const periodLabel = `${dateTime(new Date(range.from).toISOString()).split(",")[0]} – ${dateTime(new Date(range.to - 1).toISOString())}`;
    const periodSales = pick(sales).filter((sale) => {
        const at = new Date(sale.created_at).getTime();
        return at >= range.from && at < range.to;
    });

    page.append(
        pageHeader(
            "Laporan Kasir",
            `${PERIODS[view.period]} · ${periodLabel} · dibanding ${range.compareLabel}`,
            segmented(Object.entries(PERIODS).map(([value, label]) => ({ value, label })), view.period, (value) => { view.period = value; ctx.rerender(); }),
            outlets.length > 1
                ? segmented([{ value: "all", label: "Semua outlet" }, ...outlets.map((entry) => ({ value: entry.id, label: entry.name }))], view.outlet, (value) => { view.outlet = value; ctx.rerender(); })
                : null,
            el("button", { class: "erp-btn", type: "button", onclick: () => window.print() }, "🖨️ Cetak")
        ),
        el("section", { class: "erp-card erp-story" },
            el("div", { class: "erp-card__head" }, el("h2", { text: `📖 Ringkasan ${PERIODS[view.period].toLowerCase()}` })),
            el("ul", {}, story.map((line) => el("li", { class: line.tone ? `is-${line.tone}` : "", text: line.text })))
        ),
        el("div", { class: "erp-stats" },
            statCard({ label: "Omzet", value: rupiah(report.gross), sub: change === null ? "belum ada pembanding" : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change).toLocaleString("id-ID")}% vs ${rupiah(previous.gross)}`, tone: change === null ? "" : change >= 0 ? "good" : "alert" }),
            statCard({ label: "Transaksi", value: String(report.count), sub: `rata-rata ${rupiah(report.avgTicket)} · ${report.voids} void` }),
            statCard({ label: "Laba kotor", value: report.grossProfit === null ? "—" : rupiah(report.grossProfit), sub: report.foodCost === null ? "isi resep di menu Resep & HPP" : `HPP ${report.foodCost.toLocaleString("id-ID")}%` }),
            statCard({ label: "Kepuasan pelanggan", value: report.rating.count ? `😀 ${report.rating.happyPct}%` : "—", sub: report.rating.count ? `${report.rating.count} penilaian · ☹️ ${report.rating.sad}` : "buka Layar pelanggan di kasir" })
        )
    );

    if (!report.count && !report.voids) {
        page.appendChild(emptyState("Belum ada transaksi di periode ini."));
        return page;
    }

    // ---------- Per jam (satu seri: omzet) ----------
    const maxHour = Math.max(...report.byHour.map((slot) => slot.total), 1);
    const hours = [];
    if (report.byHour.length) {
        for (let hour = report.byHour[0].hour; hour <= report.byHour[report.byHour.length - 1].hour; hour += 1) {
            hours.push(report.byHour.find((slot) => slot.hour === hour) || { hour, total: 0, count: 0 });
        }
    }
    const csvButton = (label, filename, rows, columns) => el("button", {
        class: "erp-btn erp-btn--sm", type: "button",
        onclick: () => download(filename, toCsv(rows, columns)),
    }, `⬇️ ${label}`);

    page.appendChild(section("Omzet per jam", "Batang = omzet di jam itu. Arahkan kursor/ketuk untuk detail.",
        csvButton("CSV", `per-jam-${view.period}.csv`, hours, [
            { label: "Jam", value: (row) => `${String(row.hour).padStart(2, "0")}:00` }, { key: "count", label: "Transaksi" }, { key: "total", label: "Omzet" },
        ]),
        el("div", { class: "erp-hours", role: "img", "aria-label": `Omzet per jam, tertinggi jam ${report.peak?.hour}:00 sebesar ${rupiah(report.peak?.total)}` },
            hours.map((slot) => el("div", { class: `erp-hours__col${slot.hour === report.peak?.hour ? " is-peak" : ""}`, tabindex: 0 },
                slot.hour === report.peak?.hour ? el("span", { class: "erp-hours__label", text: rupiah(slot.total) }) : null,
                el("span", { class: "erp-hours__bar", style: `height:${Math.max(slot.total ? 3 : 0, (slot.total / maxHour) * 100)}%` }),
                el("span", { class: "erp-hours__tip", role: "tooltip", text: `${String(slot.hour).padStart(2, "0")}:00 · ${rupiah(slot.total)} · ${slot.count} transaksi` }),
                el("small", { text: String(slot.hour).padStart(2, "0") })
            )))
    ));

    // ---------- Per menu ----------
    page.appendChild(section("Per menu", "Omzet dari harga jual per item (sebelum diskon struk). Laba = omzet − HPP bahan.",
        csvButton("CSV", `per-menu-${view.period}.csv`, report.byMenu, [
            { key: "name", label: "Menu" }, { key: "qty", label: "Terjual" }, { key: "revenue", label: "Omzet" }, { key: "cogs", label: "HPP" }, { key: "profit", label: "Laba kotor" },
        ]),
        table(["Menu", "Terjual", "Omzet", "HPP", "Laba kotor"], report.byMenu.map((row) => [row.name, row.qty, rupiah(row.revenue), hasCost ? rupiah(row.cogs) : "—", row.profit === null ? "—" : rupiah(row.profit)]))
    ));

    // ---------- Per channel & metode bayar ----------
    page.appendChild(el("div", { class: "erp-report__pair" },
        section("Per tipe pesanan", `Komisi ojol diperkirakan ${settings.online_commission}% (atur di Kasir › Pengaturan).`,
            csvButton("CSV", `per-channel-${view.period}.csv`, report.byChannel, [
                { key: "label", label: "Tipe" }, { key: "count", label: "Transaksi" }, { key: "total", label: "Omzet" }, { key: "commission", label: "Komisi" }, { key: "net", label: "Bersih" },
            ]),
            table(["Tipe", "Trx", "Omzet", "Komisi", "Bersih"], report.byChannel.map((row) => [`${CHANNELS[row.channel]?.icon || ""} ${row.label}`, row.count, rupiah(row.total), row.commission ? rupiah(row.commission) : "—", rupiah(row.net)]))),
        section("Per metode bayar", "Uang yang benar-benar masuk (tunai sudah dikurangi kembalian). Cocokkan dengan mutasi bank/QRIS.",
            csvButton("CSV", `per-metode-${view.period}.csv`, report.byMethod, [{ key: "label", label: "Metode" }, { key: "amount", label: "Jumlah" }]),
            table(["Metode", "Jumlah"], report.byMethod.map((row) => [PAY_METHODS[row.method] || row.method, rupiah(row.amount)])))
    ));

    // ---------- Kasir & pajak ----------
    page.appendChild(el("div", { class: "erp-report__pair" },
        section("Per kasir", "Void tinggi? Lihat detailnya di Kontrol Kasir.",
            null,
            table(["Kasir", "Trx", "Omzet", "Void"], report.byCashier.map((row) => [nameOf(row.cashier_id), row.count, rupiah(row.total), row.voids]))),
        section("Pajak & potongan", "Bahan lapor PB1 ke pemda & cek potongan.",
            null,
            table(["Pos", "Jumlah"], [
                ["PB1 (pajak resto) terkumpul", rupiah(report.tax)],
                ["Service charge", rupiah(report.service)],
                ["Penjualan bersih (tanpa pajak & service)", rupiah(report.net)],
                ["Potongan promo", rupiah(report.promoDiscount)],
                ["Diskon manual", rupiah(report.manualDiscount)],
                ["Tukar poin member", rupiah(report.pointsValue)],
                ["Penjualan hilang (tercatat)", rupiah(report.lost.value)],
            ]))
    ));

    // ---------- Semua transaksi ----------
    const canExport = me.level >= 3 || hasRole(me, "keuangan");
    if (canExport) {
        page.appendChild(section("Semua transaksi periode ini", `${periodSales.length} struk (termasuk void). Untuk akuntan/Excel.`,
            csvButton("Unduh CSV transaksi", `transaksi-${view.period}.csv`, periodSales.slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))), [
                { key: "receipt_no", label: "No struk" },
                { label: "Waktu (WIB)", value: (row) => new Date(new Date(row.created_at).getTime() + 7 * 3600000).toISOString().slice(0, 16).replace("T", " ") },
                { label: "Kasir", value: (row) => nameOf(row.cashier_id) },
                { label: "Tipe", value: (row) => CHANNELS[row.channel]?.label || row.channel || "" },
                { label: "Item", value: (row) => (row.items || []).map((item) => `${item.qty}x ${item.name || item.product_name}`).join(", ") },
                { key: "subtotal", label: "Subtotal" },
                { label: "Promo", value: (row) => Number(row.promo_discount) || 0 },
                { label: "Diskon", value: (row) => Number(row.discount) || 0 },
                { label: "Poin", value: (row) => Number(row.points_value) || 0 },
                { label: "Service", value: (row) => Number(row.service) || 0 },
                { label: "PB1", value: (row) => Number(row.tax) || 0 },
                { key: "total", label: "Total" },
                { label: "Metode", value: (row) => (row.payments || []).map((pay) => `${PAY_METHODS[pay.method] || pay.method} ${pay.amount}`).join(" + ") || row.method },
                { label: "Status", value: (row) => (row.status === "batal" ? `VOID: ${row.void_reason || ""}` : "Lunas") },
                { label: "Offline", value: (row) => (row.offline ? "ya" : "") },
            ]),
            null));
    }

    return page;
}

function section(title, note, action, body) {
    return el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" }, el("h2", { text: title }), action),
        note ? el("p", { class: "erp-muted", text: note }) : null,
        body);
}

function table(heads, rows) {
    if (!rows.length) return emptyState("—");
    return el("div", { class: "erp-table-wrap" }, el("table", { class: "erp-table" },
        el("thead", {}, el("tr", {}, heads.map((head) => el("th", { text: head })))),
        el("tbody", {}, rows.map((cells) => el("tr", {}, cells.map((cell) => el("td", { text: String(cell) })))))));
}

/** Unduh CSV dengan BOM supaya Excel membaca huruf & simbol dengan benar. */
function download(filename, text) {
    try {
        const blob = new Blob(["﻿", text], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = el("a", { href: url, download: filename });
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast(`File ${filename} diunduh.`);
    } catch {
        toast("Browser menolak mengunduh file.", "error");
    }
}


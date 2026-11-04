/**
 * KANTOONG ERP — LAPORAN KASIR YANG BERCERITA (Tahap 6 POS Pro) — logika murni, dites otomatis
 * File: frontend/erp/core/pos-report.js
 *
 * Pertanyaan terbalik: "Kenapa laporan kasir TIDAK PERNAH dibaca owner?"
 *   - Isinya tabel angka tanpa makna        -> RINGKASAN BERCERITA: kalimat biasa + tanda baik/buruk.
 *   - Perbandingan menyesatkan (Senin vs Sabtu, jam 10 pagi vs sehari penuh)
 *     -> dibanding HARI YANG SAMA minggu lalu, sampai JAM YANG SAMA.
 *   - Rekap tidak bisa dicocokkan ke bank   -> rekap per metode bayar (uang benar-benar masuk).
 *   - Susah dibawa ke akuntan/Excel          -> ekspor CSV (titik koma, siap Excel Indonesia).
 */

import { CHANNELS, LOST_REASONS, PAY_METHODS, summarizeLost } from "./pos-pro.js";
import { saleCogs } from "./recipe.js";

const DAY = 86400000;
const WIB = 7 * 3600000;
const money = (value) => Math.round(Number(value) || 0);

export const PERIODS = Object.freeze({
    today: "Hari ini",
    yesterday: "Kemarin",
    week: "7 hari",
    month: "30 hari",
});

export const RATING_FACES = Object.freeze({ 3: "😀", 2: "😐", 1: "☹️" });

/** Awal hari WIB (ms). */
export function startOfWibDay(ms) {
    return Math.floor((ms + WIB) / DAY) * DAY - WIB;
}

/**
 * Rentang laporan + pembandingnya yang ADIL.
 * Hari ini sampai jam sekarang dibanding hari yang sama minggu lalu sampai jam yang sama.
 */
export function periodRange(key, now = new Date()) {
    const nowMs = new Date(now).getTime();
    const today = startOfWibDay(nowMs);
    switch (key) {
        case "yesterday":
            return { from: today - DAY, to: today, prevFrom: today - 8 * DAY, prevTo: today - 7 * DAY, compareLabel: "hari yang sama minggu lalu" };
        case "week":
            return { from: today - 6 * DAY, to: nowMs, prevFrom: today - 13 * DAY, prevTo: nowMs - 7 * DAY, compareLabel: "7 hari sebelumnya" };
        case "month":
            return { from: today - 29 * DAY, to: nowMs, prevFrom: today - 59 * DAY, prevTo: nowMs - 30 * DAY, compareLabel: "30 hari sebelumnya" };
        default:
            return { from: today, to: nowMs, prevFrom: today - 7 * DAY, prevTo: nowMs - 7 * DAY, compareLabel: "hari yang sama minggu lalu sampai jam ini" };
    }
}

/** Persentase perubahan; null bila pembanding nol. */
export function pctChange(current, before) {
    if (!before) return null;
    return Math.round(((current - before) / before) * 1000) / 10;
}

const inRange = (at, from, to) => {
    const ms = new Date(at).getTime();
    return ms >= from && ms < to;
};

const cashIn = (sale) => (Array.isArray(sale.payments) && sale.payments.length
    ? sale.payments
    : [{ method: sale.method === "campuran" ? "tunai" : sale.method || "tunai", amount: sale.total }]);

/** Semua rekap satu periode. context = { recipes, optionRecipes, ingredients } (boleh kosong). */
export function buildReport({ sales = [], context = null, settings = {}, lost = [], ratings = [], from = -Infinity, to = Infinity } = {}) {
    const all = sales.filter((sale) => inRange(sale.created_at, from, to));
    const live = all.filter((sale) => sale.status !== "batal");
    const commission = Math.min(Math.max(Number(settings.online_commission ?? 20), 0), 90);
    const hasCost = Boolean(context && Object.keys(context.recipes || {}).length);

    const report = {
        count: live.length,
        voids: all.length - live.length,
        gross: 0, service: 0, tax: 0, net: 0,
        promoDiscount: 0, manualDiscount: 0, pointsValue: 0,
        cogs: hasCost ? 0 : null,
        items: 0,
        offline: live.filter((sale) => sale.offline).length,
    };
    const hours = new Map();
    const menus = new Map();
    const channels = new Map();
    const methods = new Map();
    const cashiers = new Map();

    for (const sale of all) {
        const cashier = cashiers.get(sale.cashier_id) || { cashier_id: sale.cashier_id, count: 0, total: 0, voids: 0 };
        if (sale.status === "batal") cashier.voids += 1;
        cashiers.set(sale.cashier_id, cashier);
    }

    for (const sale of live) {
        const total = money(sale.total);
        const net = total - money(sale.service) - money(sale.tax);
        report.gross += total;
        report.service += money(sale.service);
        report.tax += money(sale.tax);
        report.net += net;
        report.promoDiscount += money(sale.promo_discount);
        report.manualDiscount += money(sale.discount);
        report.pointsValue += money(sale.points_value);
        const cogs = hasCost ? saleCogs(sale, context) : 0;
        if (hasCost) report.cogs += cogs;

        const hour = new Date(new Date(sale.created_at).getTime() + WIB).getUTCHours();
        const slot = hours.get(hour) || { hour, total: 0, count: 0 };
        slot.total += total;
        slot.count += 1;
        hours.set(hour, slot);

        for (const item of sale.items || []) {
            const qty = Number(item.qty) || 0;
            report.items += qty;
            const key = String(item.product_id);
            const row = menus.get(key) || { product_id: key, name: item.name || item.product_name || "Menu", qty: 0, revenue: 0, cogs: 0 };
            row.qty += qty;
            row.revenue += money(item.price ?? item.unit_price) * qty;
            if (hasCost) row.cogs += saleCogs({ items: [item] }, context);
            menus.set(key, row);
        }

        const channel = CHANNELS[sale.channel] ? sale.channel : "take_away";
        const entry = channels.get(channel) || { channel, label: CHANNELS[channel].label, count: 0, total: 0, commission: 0 };
        entry.count += 1;
        entry.total += total;
        if (CHANNELS[channel].online) entry.commission += Math.round((total * commission) / 100);
        channels.set(channel, entry);

        for (const row of cashIn(sale)) {
            const method = PAY_METHODS[row.method] ? row.method : "tunai";
            methods.set(method, (methods.get(method) || 0) + money(row.amount));
        }

        const cashier = cashiers.get(sale.cashier_id);
        cashier.count += 1;
        cashier.total += total;
    }

    const slots = [...hours.values()].sort((a, b) => a.hour - b.hour);
    report.byHour = slots;
    report.peak = slots.slice().sort((a, b) => b.total - a.total)[0] || null;
    report.byMenu = [...menus.values()]
        .map((row) => ({ ...row, profit: hasCost ? row.revenue - row.cogs : null }))
        .sort((a, b) => b.revenue - a.revenue);
    report.byChannel = [...channels.values()].map((row) => ({ ...row, net: row.total - row.commission })).sort((a, b) => b.total - a.total);
    report.byMethod = [...methods].map(([method, amount]) => ({ method, label: PAY_METHODS[method], amount })).sort((a, b) => b.amount - a.amount);
    report.byCashier = [...cashiers.values()].sort((a, b) => b.total - a.total);
    report.avgTicket = report.count ? Math.round(report.gross / report.count) : 0;
    report.grossProfit = hasCost ? report.net - report.cogs : null;
    report.foodCost = hasCost && report.net ? Math.round((report.cogs / report.net) * 1000) / 10 : null;
    report.lost = summarizeLost(lost.filter((entry) => inRange(entry.created_at, from, to)));

    const rated = ratings.filter((entry) => inRange(entry.created_at, from, to));
    report.rating = {
        count: rated.length,
        happy: rated.filter((entry) => Number(entry.score) === 3).length,
        meh: rated.filter((entry) => Number(entry.score) === 2).length,
        sad: rated.filter((entry) => Number(entry.score) === 1).length,
    };
    report.rating.happyPct = rated.length ? Math.round((report.rating.happy / rated.length) * 100) : null;
    return report;
}

const rp = (value) => `Rp ${money(value).toLocaleString("id-ID")}`;
const hourText = (hour) => `${String(hour).padStart(2, "0")}:00–${String((hour + 1) % 24).padStart(2, "0")}:00`;
const arrow = (pct) => (pct === null ? "" : pct >= 0 ? `▲ ${pct.toLocaleString("id-ID")}%` : `▼ ${Math.abs(pct).toLocaleString("id-ID")}%`);

/** RINGKASAN BERCERITA: kalimat biasa + nada (good / warn / late / ""). */
export function storyLines(report, previous = null, { compareLabel = "periode sebelumnya", cashierName = (id) => id } = {}) {
    if (!report.count && !report.voids) return [{ tone: "", text: "Belum ada transaksi di periode ini." }];
    const lines = [];
    const change = previous ? pctChange(report.gross, previous.gross) : null;
    lines.push({
        tone: change === null ? "" : change >= 0 ? "good" : "late",
        text: `Omzet ${rp(report.gross)} dari ${report.count} transaksi${change === null ? "" : ` (${arrow(change)} dibanding ${compareLabel}: ${rp(previous.gross)})`}.`,
    });
    const ticketChange = previous ? pctChange(report.avgTicket, previous.avgTicket) : null;
    lines.push({ tone: "", text: `Rata-rata struk ${rp(report.avgTicket)}${ticketChange === null ? "" : ` (${arrow(ticketChange)})`} · ${report.items} item terjual.` });
    if (report.peak) lines.push({ tone: "", text: `Jam tersibuk ${hourText(report.peak.hour)}: ${rp(report.peak.total)} dari ${report.peak.count} transaksi.` });

    const top = report.byMenu[0];
    const richest = report.byMenu.filter((row) => row.profit !== null).sort((a, b) => b.profit - a.profit)[0];
    if (top) {
        lines.push({
            tone: "",
            text: `Menu terlaris: ${top.name} (${top.qty} porsi)${richest && richest.product_id !== top.product_id ? `; paling menghasilkan laba: ${richest.name} (${rp(richest.profit)})` : ""}.`,
        });
    }
    if (report.grossProfit !== null) {
        lines.push({ tone: report.foodCost > 40 ? "warn" : "good", text: `Laba kotor ${rp(report.grossProfit)} (HPP ${report.foodCost?.toLocaleString("id-ID")}% dari penjualan bersih).` });
    }
    const online = report.byChannel.filter((row) => CHANNELS[row.channel]?.online);
    const onlineTotal = online.reduce((sum, row) => sum + row.total, 0);
    if (onlineTotal) {
        const fee = online.reduce((sum, row) => sum + row.commission, 0);
        lines.push({ tone: "", text: `${Math.round((onlineTotal / report.gross) * 100)}% omzet dari ojol; perkiraan komisi aplikasi ${rp(fee)}.` });
    }
    const discounts = report.promoDiscount + report.manualDiscount + report.pointsValue;
    if (discounts) lines.push({ tone: "", text: `Potongan diberikan ${rp(discounts)} (promo ${rp(report.promoDiscount)}, diskon manual ${rp(report.manualDiscount)}, tukar poin ${rp(report.pointsValue)}).` });
    if (report.voids) {
        const worst = report.byCashier.slice().sort((a, b) => b.voids - a.voids)[0];
        lines.push({ tone: "warn", text: `${report.voids} transaksi dibatalkan (void)${worst?.voids ? `, terbanyak oleh ${cashierName(worst.cashier_id)} (${worst.voids})` : ""}. Cek di Kontrol Kasir.` });
    }
    if (report.lost.value) {
        const [reason] = report.lost.byReason[0] || [];
        lines.push({ tone: "late", text: `Penjualan hilang ${rp(report.lost.value)}${reason ? `, terbesar karena "${LOST_REASONS[reason]}"` : ""}.` });
    }
    if (report.rating.count) {
        lines.push({
            tone: report.rating.sad ? "warn" : "good",
            text: `Kepuasan pelanggan: 😀 ${report.rating.happyPct}% dari ${report.rating.count} penilaian${report.rating.sad ? ` · ☹️ ${report.rating.sad} kurang puas` : ""}.`,
        });
    }
    if (report.offline) lines.push({ tone: "", text: `${report.offline} transaksi dibuat saat offline dan sudah tersinkron.` });
    return lines;
}

/**
 * CSV siap Excel Indonesia: pemisah titik koma, angka tanpa titik ribuan.
 * columns: [{ key, label, value?: (row) => any }]
 */
export function toCsv(rows = [], columns = [], { separator = ";" } = {}) {
    const cell = (value) => {
        if (value === null || value === undefined) return "";
        const text = String(value);
        return /[";\n\r,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const head = columns.map((column) => cell(column.label)).join(separator);
    const body = rows.map((row) => columns.map((column) => cell(column.value ? column.value(row) : row[column.key])).join(separator));
    return [head, ...body].join("\r\n");
}

/**
 * KANTOONG ERP — HITUNGAN PENJUALAN
 * File: frontend/erp/core/metrics.js
 *
 * Omzet, periode (zona waktu Jakarta), papan peringkat, komisi, target.
 * Semua angka berasal dari pesanan asli: tidak ada input manual.
 */

import { canView } from "./org.js";

/** Status pesanan yang dihitung sebagai omzet (sama dengan erp_is_paid di SQL). */
export const PAID_STATUSES = Object.freeze(["dibayar", "diproses", "dikirim", "selesai"]);

export const isPaid = (order) => PAID_STATUSES.includes(order?.status);

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Awal hari / bulan di zona waktu Jakarta (WIB). */
export function periodStart(period, now = new Date()) {
    const local = new Date(now.getTime() + JAKARTA_OFFSET_MS);
    const start = period === "month"
        ? Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1)
        : Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());

    return new Date(start - JAKARTA_OFFSET_MS);
}

/** Jumlah hari dalam bulan berjalan (WIB). */
export function daysInMonth(now = new Date()) {
    const local = new Date(now.getTime() + JAKARTA_OFFSET_MS);
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
}

/** "2026-11-03" untuk tanggal WIB. */
export function jakartaDateKey(date) {
    return new Date(new Date(date).getTime() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Map memberId -> { omzet, count } untuk pesanan dibayar sejak `since`. */
export function salesTotals(orders, since) {
    const sinceMs = since ? new Date(since).getTime() : -Infinity;
    const totals = new Map();

    for (const order of orders) {
        if (!order.sales_member_id || !isPaid(order)) continue;
        if (new Date(order.created_at).getTime() < sinceMs) continue;

        const entry = totals.get(order.sales_member_id) || { omzet: 0, count: 0 };
        entry.omzet += Number(order.total) || 0;
        entry.count += 1;
        totals.set(order.sales_member_id, entry);
    }

    return totals;
}

/** Total omzet & jumlah pesanan dibayar sejak `since` (opsional disaring per sales). */
export function sumOrders(orders, since, memberIds = null) {
    const sinceMs = since ? new Date(since).getTime() : -Infinity;
    let omzet = 0;
    let count = 0;

    for (const order of orders) {
        if (!isPaid(order)) continue;
        if (new Date(order.created_at).getTime() < sinceMs) continue;
        if (memberIds && !memberIds.has(order.sales_member_id)) continue;
        omzet += Number(order.total) || 0;
        count += 1;
    }

    return { omzet, count, average: count ? Math.round(omzet / count) : 0 };
}

/**
 * Papan peringkat sales (sama dengan erp_leaderboard di SQL).
 * Semua melihat urutan & nama; angka hanya untuk yang boleh dilihat.
 */
export function leaderboard({ members, orders, period = "day", viewer, now = new Date() }) {
    const since = periodStart(period, now);
    const totals = salesTotals(orders, since);

    const rows = members
        .filter((member) => member.is_active !== false && member.job_role === "sales")
        .map((member) => ({
            member_id: member.id,
            full_name: member.full_name,
            unit_name: member.unit_name || "",
            omzet: totals.get(member.id)?.omzet || 0,
            order_count: totals.get(member.id)?.count || 0,
        }))
        .sort((a, b) => b.omzet - a.omzet || a.full_name.localeCompare(b.full_name, "id"));

    // Peringkat rapat: omzet sama = peringkat sama.
    let rank = 0;
    let previous = null;

    return rows.map((row) => {
        if (row.omzet !== previous) {
            rank += 1;
            previous = row.omzet;
        }

        const visible = canView(viewer, row.member_id, members);

        return {
            ...row,
            rank,
            is_me: row.member_id === viewer?.id,
            omzet: visible ? row.omzet : null,
            order_count: visible ? row.order_count : null,
        };
    });
}

/** Komisi = omzet × persen. */
export function commission(omzet, rate) {
    const value = (Number(omzet) || 0) * (Number(rate) || 0) / 100;
    return Math.round(value);
}

/** Persentase capaian target (0–999). Target 0 = null (belum diatur). */
export function progress(actual, target) {
    const goal = Number(target) || 0;
    if (goal <= 0) return null;
    return Math.min(999, Math.round(((Number(actual) || 0) / goal) * 100));
}

/** Omzet harian `days` hari terakhir: [{ date: "2026-11-03", omzet }]. */
export function dailySeries(orders, days = 14, now = new Date(), memberIds = null) {
    const today = periodStart("day", now).getTime();
    const keys = [];
    const sums = new Map();

    for (let i = days - 1; i >= 0; i -= 1) {
        const key = jakartaDateKey(today - i * 86400000 + 1);
        keys.push(key);
        sums.set(key, 0);
    }

    for (const order of orders) {
        if (!isPaid(order)) continue;
        if (memberIds && !memberIds.has(order.sales_member_id)) continue;
        const key = jakartaDateKey(order.created_at);
        if (sums.has(key)) sums.set(key, sums.get(key) + (Number(order.total) || 0));
    }

    return keys.map((date) => ({ date, omzet: sums.get(date) }));
}

export function formatRupiah(value) {
    return "Rp " + Math.round(Number(value) || 0).toLocaleString("id-ID");
}

/** Rp 1,2 jt / Rp 850 rb — untuk kartu ringkas. */
export function formatShortRupiah(value) {
    const number = Number(value) || 0;
    if (Math.abs(number) >= 1e9) return `Rp ${(number / 1e9).toFixed(1).replace(".", ",")} M`;
    if (Math.abs(number) >= 1e6) return `Rp ${(number / 1e6).toFixed(1).replace(".", ",")} jt`;
    if (Math.abs(number) >= 1e3) return `Rp ${Math.round(number / 1e3)} rb`;
    return `Rp ${Math.round(number)}`;
}

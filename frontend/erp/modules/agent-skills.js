/**
 * KANTOONG ERP — ANGKA LAPORAN BULANAN (dipakai templat Laporan & Agen AI)
 * File: frontend/erp/modules/agent-skills.js
 */

import { flattenLines } from "../core/accounting.js";

/** Laporan bulanan: omzet (online dibayar + kasir), transaksi, beban dari jurnal, per kategori. */
export default async function monthlyNumbers(ctx) {
    const { data } = ctx;
    const period = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7);
    const since = `${period}-01T00:00:00+07:00`;
    const [orders, sales, journal, accounts, products] = await Promise.all([
        data.listOrders?.({ since }).catch(() => []) ?? [],
        data.listPosSales?.({ since }).catch(() => []) ?? [],
        data.listJournal?.().catch(() => []) ?? [],
        data.listAccounts?.().catch(() => []) ?? [],
        data.listProducts?.().catch(() => []) ?? [],
    ]);
    const paid = orders.filter((o) => !["dibatalkan", "menunggu_pembayaran"].includes(o.status));
    const okSales = sales.filter((s) => s.status !== "void");
    const omzet = paid.reduce((n, o) => n + (Number(o.total) || 0), 0) + okSales.reduce((n, s) => n + (Number(s.total) || 0), 0);
    const expenseCodes = new Set(accounts.filter((a) => a.type === "beban").map((a) => a.code));
    const expense = flattenLines(journal).filter((l) => String(l.entry_date).startsWith(period) && expenseCodes.has(l.account_code))
        .reduce((n, l) => n + (Number(l.debit) || 0) - (Number(l.credit) || 0), 0);
    const byCat = new Map();
    okSales.forEach((s) => (s.items || []).forEach((it) => {
        const cat = products.find((p) => String(p.id) === String(it.product_id))?.category || "Lainnya";
        const row = byCat.get(cat) || { qty: 0, total: 0 };
        row.qty += Number(it.qty) || 0;
        row.total += (Number(it.qty) || 0) * (Number(it.price) || 0);
        byCat.set(cat, row);
    }));
    const rows = [...byCat.entries()].sort((a, b) => b[1].total - a[1].total).map(([cat, r]) => `${cat} | ${r.qty} | ${Math.round(r.total)}`).join("\n");
    return { period, omzet: Math.round(omzet), orders: paid.length + okSales.length, expense: Math.round(expense), rows };
}


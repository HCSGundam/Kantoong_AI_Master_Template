/**
 * KANTOONG ERP PRO — PENGUMPUL DATA BERSAMA
 * File: frontend/erp/modules/pro-data.js
 *
 * Ruang Komando, pusat notifikasi, dan Ctrl+K memakai sinyal yang sama.
 * Setiap sumber dibaca dengan aman: bila satu tabel belum ada / tidak boleh
 * dibaca peran ini, bagian itu kosong (bukan error).
 */

import { budgetUsage } from "../core/finance-pro.js";
import { buildSignals } from "../core/command-center.js";
import { flattenLines } from "../core/accounting.js";

const safe = (promise) => Promise.resolve(promise).catch(() => []).then((value) => value ?? []);
const CACHE_MS = 20000;
let cache = { at: 0, key: "", value: null, pending: null };

export async function loadProData(ctx, { fresh = false } = {}) {
    const { data, me } = ctx;
    const key = `${data.mode}:${me.id}`;
    if (!fresh && cache.key === key && cache.value && Date.now() - cache.at < CACHE_MS) return cache.value;
    if (!fresh && cache.key === key && cache.pending) return cache.pending;

    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    cache.key = key;
    cache.pending = (async () => {
        const [members, approvals, invoices, recurring, budgets, levels, moves, products, batches, contracts, leaves, deals, journal, accounts, orders, sales] = await Promise.all([
            safe(data.listMembers?.()),
            safe(data.listApprovals?.()),
            safe(data.listInvoices?.()),
            safe(data.listRecurring?.()),
            safe(data.listBudgets?.()),
            safe(data.listStockLevels?.()),
            safe(data.listStockMoves?.()),
            safe(data.listProducts?.()),
            safe(data.listBatches?.()),
            safe(data.listContracts?.()),
            safe(data.listLeaves?.()),
            safe(data.listDeals?.()),
            safe(data.listJournal?.()),
            safe(data.listAccounts?.()),
            safe(data.listOrders?.({ since })),
            safe(data.listPosSales?.({ since })),
        ]);
        const lines = flattenLines(journal || []);
        const period = new Date().toISOString().slice(0, 7);
        const usage = budgetUsage(budgets, lines, period).map((row) => ({ ...row, label: row.label || accounts.find((a) => a.code === row.account_code)?.name }));
        const raw = { members, approvals, invoices, recurring, budgets, usage, levels, moves, products, batches, contracts, leaves, deals, lines, accounts, orders, sales };
        const signals = buildSignals({ me, ...raw, budgetUsage: usage, now: new Date() });
        const value = { raw, signals };
        cache = { at: Date.now(), key, value, pending: null };
        return value;
    })();
    return cache.pending;
}

export function invalidateProData() {
    cache = { at: 0, key: "", value: null, pending: null };
}

/** Saldo kas + bank dari jurnal. */
export function cashBalance(lines) {
    return (lines || [])
        .filter((line) => line.account_code === "1-1000" || line.account_code === "1-1100")
        .reduce((n, line) => n + (Number(line.debit) || 0) - (Number(line.credit) || 0), 0);
}

/** Sub-halaman dari alamat: #/finance/piutang → "piutang". */
export function subRoute() {
    return location.hash.replace(/^#\/?/, "").split("/")[1] || "";
}

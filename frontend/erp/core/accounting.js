/**
 * KANTOONG ERP — PEMBUKUAN BERPASANGAN (DOUBLE-ENTRY)
 * File: frontend/erp/core/accounting.js
 *
 * Setiap transaksi = jurnal dengan debit total = kredit total.
 * Laporan (laba rugi, neraca, buku besar) dihitung dari baris jurnal.
 * Bagan akun bawaan sama dengan erp-phase2.sql.
 */

export const DEFAULT_ACCOUNTS = Object.freeze([
    { code: "1-1000", name: "Kas", type: "aset" },
    { code: "1-1100", name: "Bank", type: "aset" },
    { code: "1-1200", name: "Piutang usaha", type: "aset" },
    { code: "1-1300", name: "Persediaan barang", type: "aset" },
    { code: "2-1000", name: "Utang usaha", type: "kewajiban" },
    { code: "2-1100", name: "Utang gaji", type: "kewajiban" },
    { code: "3-1000", name: "Modal pemilik", type: "modal" },
    { code: "4-1000", name: "Penjualan online", type: "pendapatan" },
    { code: "4-1100", name: "Penjualan kasir", type: "pendapatan" },
    { code: "5-1000", name: "Harga pokok penjualan", type: "beban" },
    { code: "6-1000", name: "Beban gaji", type: "beban" },
    { code: "6-1100", name: "Beban komisi", type: "beban" },
    { code: "6-1200", name: "Beban operasional", type: "beban" },
    { code: "6-1300", name: "Beban pemasaran", type: "beban" },
]);

export const ACCOUNT_TYPES = Object.freeze({
    aset: "Aset",
    kewajiban: "Kewajiban",
    modal: "Modal",
    pendapatan: "Pendapatan",
    beban: "Beban",
});

/** Saldo normal: aset & beban bertambah di debit; sisanya di kredit. */
export const isDebitNormal = (type) => type === "aset" || type === "beban";

/** Validasi jurnal: minimal 2 baris, angka >= 0, satu sisi per baris, seimbang. */
export function validateJournal(lines) {
    const rows = (lines || []).filter((line) => (Number(line.debit) || 0) > 0 || (Number(line.credit) || 0) > 0);

    if (rows.length < 2) return "Jurnal minimal punya 2 baris.";

    let debit = 0;
    let credit = 0;

    for (const line of rows) {
        const d = Number(line.debit) || 0;
        const c = Number(line.credit) || 0;
        if (!line.account_code) return "Setiap baris harus memilih akun.";
        if (d < 0 || c < 0) return "Angka tidak boleh minus.";
        if (d > 0 && c > 0) return "Satu baris hanya boleh debit ATAU kredit.";
        debit += d;
        credit += c;
    }

    if (Math.round(debit) !== Math.round(credit)) {
        return `Jurnal tidak seimbang: debit ${debit} ≠ kredit ${credit}.`;
    }

    return "";
}

/**
 * Gabungkan entri + baris: [{ ...line, entry_date, memo, source }].
 * entries: [{ id, entry_date, memo, source, ref, lines: [...] }]
 */
export function flattenLines(entries) {
    return entries.flatMap((entry) =>
        (entry.lines || []).map((line) => ({
            ...line,
            entry_id: entry.id,
            entry_date: entry.entry_date,
            memo: entry.memo,
            source: entry.source,
        }))
    );
}

const inRange = (date, from, to) => (!from || date >= from) && (!to || date <= to);

/** Saldo per akun (positif = sesuai saldo normal akun). */
export function balances(accounts, lines, { from = null, to = null } = {}) {
    const result = new Map(accounts.map((account) => [account.code, 0]));

    for (const line of lines) {
        if (!inRange(line.entry_date, from, to)) continue;
        const account = accounts.find((entry) => entry.code === line.account_code);
        if (!account) continue;
        const delta = (Number(line.debit) || 0) - (Number(line.credit) || 0);
        result.set(account.code, result.get(account.code) + (isDebitNormal(account.type) ? delta : -delta));
    }

    return result;
}

/** Laba rugi periode: pendapatan − beban. */
export function profitLoss(accounts, lines, range = {}) {
    const saldo = balances(accounts, lines, range);
    const pick = (type) => accounts
        .filter((account) => account.type === type)
        .map((account) => ({ ...account, amount: saldo.get(account.code) || 0 }))
        .filter((row) => row.amount !== 0);

    const revenue = pick("pendapatan");
    const expenses = pick("beban");
    const totalRevenue = revenue.reduce((sum, row) => sum + row.amount, 0);
    const totalExpense = expenses.reduce((sum, row) => sum + row.amount, 0);

    return { revenue, expenses, totalRevenue, totalExpense, net: totalRevenue - totalExpense };
}

/** Neraca per tanggal: aset = kewajiban + modal (+ laba berjalan). */
export function balanceSheet(accounts, lines, asOf = null) {
    const saldo = balances(accounts, lines, { to: asOf });
    const pick = (type) => accounts
        .filter((account) => account.type === type)
        .map((account) => ({ ...account, amount: saldo.get(account.code) || 0 }))
        .filter((row) => row.amount !== 0);

    const assets = pick("aset");
    const liabilities = pick("kewajiban");
    const equity = pick("modal");
    const earnings = profitLoss(accounts, lines, { to: asOf }).net;

    const totalAssets = assets.reduce((sum, row) => sum + row.amount, 0);
    const totalLiabilities = liabilities.reduce((sum, row) => sum + row.amount, 0);
    const totalEquity = equity.reduce((sum, row) => sum + row.amount, 0) + earnings;

    return {
        assets, liabilities, equity, earnings,
        totalAssets, totalLiabilities, totalEquity,
        balanced: Math.round(totalAssets) === Math.round(totalLiabilities + totalEquity),
    };
}

/** "2026-11" -> { from: "2026-11-01", to: "2026-11-30" } */
export function monthRange(period) {
    const [year, month] = period.split("-").map(Number);
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { from: `${period}-01`, to: `${period}-${String(last).padStart(2, "0")}` };
}

/** Jurnal standar untuk transaksi umum (dipakai demo & formulir sederhana). */
export const QUICK_ENTRIES = Object.freeze({
    pengeluaran: (amount, expenseCode = "6-1200", cashCode = "1-1100") => [
        { account_code: expenseCode, debit: amount, credit: 0 },
        { account_code: cashCode, debit: 0, credit: amount },
    ],
    modal: (amount, cashCode = "1-1100") => [
        { account_code: cashCode, debit: amount, credit: 0 },
        { account_code: "3-1000", debit: 0, credit: amount },
    ],
    penjualanOnline: (amount) => [
        { account_code: "1-1100", debit: amount, credit: 0 },
        { account_code: "4-1000", debit: 0, credit: amount },
    ],
    penjualanKasir: (amount, method) => [
        { account_code: method === "tunai" ? "1-1000" : "1-1100", debit: amount, credit: 0 },
        { account_code: "4-1100", debit: 0, credit: amount },
    ],
});

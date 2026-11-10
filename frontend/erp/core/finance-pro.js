/**
 * KANTOONG ERP PRO — KEUANGAN PRO (murni, dites)
 * File: frontend/erp/core/finance-pro.js
 *
 * Piutang & hutang (umur tagihan), proyeksi kas 30 hari ("kapan kas
 * paling tipis?"), dan anggaran per akun beban vs realisasi jurnal.
 * Tagihan: { id, direction: "piutang"|"hutang", party, number, amount,
 *            paid, issued_at, due_date (YYYY-MM-DD), status }
 */

const DAY = 86400000;
const dayKey = (date) => new Date(date).toISOString().slice(0, 10);
const daysBetween = (from, to) => Math.floor((new Date(`${dayKey(to)}T00:00:00Z`) - new Date(`${dayKey(from)}T00:00:00Z`)) / DAY);

export const AGING_BUCKETS = Object.freeze([
    { key: "belum", label: "Belum jatuh tempo" },
    { key: "1-30", label: "Telat 1–30 hari" },
    { key: "31-60", label: "Telat 31–60 hari" },
    { key: "61-90", label: "Telat 61–90 hari" },
    { key: "90+", label: "Telat > 90 hari" },
]);

export function outstanding(invoice) {
    return Math.max(0, (Number(invoice.amount) || 0) - (Number(invoice.paid) || 0));
}

export function isOpen(invoice) {
    return invoice.status !== "batal" && outstanding(invoice) > 0;
}

/** Hari telat (negatif = masih N hari lagi). */
export function daysLate(invoice, now = new Date()) {
    return daysBetween(invoice.due_date, now);
}

export function bucketOf(invoice, now = new Date()) {
    const late = daysLate(invoice, now);
    if (late <= 0) return "belum";
    if (late <= 30) return "1-30";
    if (late <= 60) return "31-60";
    if (late <= 90) return "61-90";
    return "90+";
}

/** Umur tagihan terbuka per kelompok. */
export function aging(invoices, direction, now = new Date()) {
    const open = (invoices || []).filter((inv) => inv.direction === direction && isOpen(inv));
    const rows = AGING_BUCKETS.map((bucket) => ({ ...bucket, total: 0, count: 0, items: [] }));
    open.forEach((inv) => {
        const row = rows.find((r) => r.key === bucketOf(inv, now));
        row.total += outstanding(inv);
        row.count += 1;
        row.items.push(inv);
    });
    rows.forEach((row) => row.items.sort((a, b) => a.due_date.localeCompare(b.due_date)));
    return { total: rows.reduce((n, r) => n + r.total, 0), rows };
}

/** Tagihan yang jatuh tempo dalam N hari (termasuk yang sudah telat). */
export function dueWithin(invoices, direction, days, now = new Date()) {
    return (invoices || [])
        .filter((inv) => inv.direction === direction && isOpen(inv) && daysLate(inv, now) >= -days)
        .sort((a, b) => a.due_date.localeCompare(b.due_date));
}

/** Pembayaran sebagian/lunas. Mengembalikan tagihan baru. */
export function applyPayment(invoice, amount) {
    const value = Math.round(Number(amount) || 0);
    if (value <= 0) throw new Error("Nominal bayar harus lebih dari 0.");
    if (value > outstanding(invoice)) throw new Error("Nominal melebihi sisa tagihan.");
    const paid = (Number(invoice.paid) || 0) + value;
    return { ...invoice, paid, status: paid >= Number(invoice.amount) ? "lunas" : "sebagian" };
}

/**
 * Proyeksi saldo kas harian N hari ke depan.
 * Piutang dianggap masuk di tanggal jatuh tempo (yang sudah telat: dianggap
 * masuk 7 hari lagi, dengan peluang 60%), hutang keluar di jatuh tempo.
 * recurring: [{ label, amount (+masuk/-keluar), day (tanggal 1–28) }]
 */
export function cashForecast({ cashNow = 0, invoices = [], recurring = [], days = 30, now = new Date() } = {}) {
    const start = new Date(`${dayKey(now)}T00:00:00Z`);
    const flows = new Map();
    const add = (offset, amount, label) => {
        if (offset < 0 || offset >= days) return;
        const list = flows.get(offset) || [];
        list.push({ amount, label });
        flows.set(offset, list);
    };

    invoices.filter(isOpen).forEach((inv) => {
        let offset = daysBetween(start, inv.due_date);
        let amount = outstanding(inv);
        if (offset < 0) {
            offset = 7;
            if (inv.direction === "piutang") amount = Math.round(amount * 0.6);
            else offset = 0;
        }
        add(offset, inv.direction === "piutang" ? amount : -amount, `${inv.direction === "piutang" ? "Tagihan" : "Bayar"} ${inv.party}`);
    });

    for (let offset = 0; offset < days; offset += 1) {
        const date = new Date(start.getTime() + offset * DAY);
        recurring.forEach((item) => {
            if (date.getUTCDate() === Number(item.day)) add(offset, Number(item.amount) || 0, item.label);
        });
    }

    let balance = Number(cashNow) || 0;
    const series = [];
    for (let offset = 0; offset < days; offset += 1) {
        const items = flows.get(offset) || [];
        balance += items.reduce((n, f) => n + f.amount, 0);
        series.push({ date: dayKey(new Date(start.getTime() + offset * DAY)), balance, items });
    }

    const lowest = series.reduce((min, point) => (point.balance < min.balance ? point : min), series[0] || { balance, date: dayKey(now) });
    const firstNegative = series.find((point) => point.balance < 0) || null;
    return { series, lowest, firstNegative, end: series.at(-1)?.balance ?? balance };
}

/**
 * Anggaran vs realisasi untuk satu bulan.
 * budgets: [{ id, account_code, period: "YYYY-MM", amount, unit_name? }]
 * lines: baris jurnal datar { account_code, debit, credit, date }
 */
export function budgetUsage(budgets, lines, period) {
    return (budgets || [])
        .filter((b) => b.period === period)
        .map((budget) => {
            const actual = (lines || [])
                .filter((line) => line.account_code === budget.account_code && String(line.date || line.entry_date || "").startsWith(period))
                .reduce((n, line) => n + (Number(line.debit) || 0) - (Number(line.credit) || 0), 0);
            const pct = budget.amount > 0 ? Math.round((actual / budget.amount) * 100) : 0;
            return {
                ...budget,
                actual,
                remaining: budget.amount - actual,
                pct,
                status: pct > 100 ? "lewat" : pct >= 80 ? "waspada" : "aman",
            };
        })
        .sort((a, b) => b.pct - a.pct);
}

export function validateInvoice(input) {
    if (!["piutang", "hutang"].includes(input.direction)) return "Jenis tagihan tidak dikenal.";
    if (!String(input.party || "").trim()) return "Nama pelanggan/pemasok wajib diisi.";
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) return "Nominal tagihan harus lebih dari 0.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.due_date || ""))) return "Tanggal jatuh tempo tidak valid.";
    return null;
}

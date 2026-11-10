/**
 * KANTOONG ERP PRO — KEUANGAN PRO (tab di Keuangan & Akuntansi)
 * File: frontend/erp/modules/finance-pro.js
 *
 * Piutang & hutang dengan umur tagihan + tombol bayar (jurnal otomatis),
 * proyeksi kas 30 hari, dan anggaran per akun beban vs realisasi.
 * Pengingat tagihan ke pelanggan = pesan WhatsApp yang DISIAPKAN (staf sendiri yang menekan kirim).
 */

import { AGING_BUCKETS, aging, budgetUsage, cashForecast, daysLate, outstanding, validateInvoice } from "../core/finance-pro.js";
import { flattenLines } from "../core/accounting.js";
import { el, emptyState, formDialog, friendlyError, rupiah, shortRupiah, statCard, toast } from "../ui.js";
import { cashBalance, invalidateProData } from "./pro-data.js";

export const FINANCE_PRO_TABS = [
    { value: "piutang", label: "Piutang" },
    { value: "hutang", label: "Hutang" },
    { value: "kas", label: "Proyeksi kas" },
    { value: "anggaran", label: "Anggaran" },
];

const fmtDay = (day) => new Date(`${day}T00:00:00+07:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Jakarta" });

export async function financeProView(ctx, tab, accounts, entries) {
    if (tab === "piutang" || tab === "hutang") return invoicesView(ctx, tab);
    if (tab === "kas") return cashView(ctx, entries);
    if (tab === "anggaran") return budgetView(ctx, accounts, entries);
    return emptyState("Bagian tidak dikenal.");
}

async function invoicesView(ctx, direction) {
    const invoices = await ctx.data.listInvoices?.().catch(() => []) ?? [];
    const now = new Date();
    const report = aging(invoices, direction, now);
    const isAR = direction === "piutang";
    const wrap = el("div", { class: "erp-stack" });

    wrap.appendChild(el("div", { class: "erp-toolbar" },
        el("p", { class: "erp-muted", text: isAR ? "Uang yang masih harus DITERIMA dari pelanggan." : "Uang yang masih harus DIBAYAR ke pemasok." }),
        el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => newInvoice(ctx, direction) }, isAR ? "+ Tagihan ke pelanggan" : "+ Tagihan dari pemasok")));

    wrap.appendChild(el("section", { class: "erp-stats" },
        AGING_BUCKETS.map((b) => {
            const row = report.rows.find((r) => r.key === b.key);
            return statCard({ label: b.label, value: shortRupiah(row.total), sub: `${row.count} tagihan`, tone: b.key === "belum" ? "" : row.total ? (b.key === "1-30" ? "warn" : "bad") : "" });
        })));

    const open = report.rows.flatMap((r) => r.items).sort((a, b) => a.due_date.localeCompare(b.due_date));
    if (!open.length) {
        wrap.appendChild(emptyState(invoices.length ? "Semua tagihan sudah lunas. 👏" : "Belum ada tagihan. Jalankan db/erp-pro.sql bila memakai data asli."));
        return wrap;
    }

    wrap.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-table-wrap" },
            el("table", { class: "erp-table" },
                el("thead", {}, el("tr", {}, [isAR ? "Pelanggan" : "Pemasok", "No.", "Jatuh tempo", "Sisa", "Status", ""].map((h) => el("th", { text: h })))),
                el("tbody", {}, open.map((inv) => {
                    const late = daysLate(inv, now);
                    return el("tr", {},
                        el("td", { "data-label": isAR ? "Pelanggan" : "Pemasok", text: inv.party }),
                        el("td", { "data-label": "No.", text: inv.number }),
                        el("td", { "data-label": "Jatuh tempo", text: fmtDay(inv.due_date) }),
                        el("td", { "data-label": "Sisa", class: "erp-num", text: rupiah(outstanding(inv)) }),
                        el("td", { "data-label": "Status" },
                            el("span", { class: `erp-pill erp-pill--${late > 0 ? "bad" : late >= -3 ? "warn" : "good"}`, text: late > 0 ? `Telat ${late} hari` : late === 0 ? "Hari ini" : `${-late} hari lagi` })),
                        el("td", { "data-label": "" },
                            el("div", { class: "erp-row-actions" },
                                isAR && late > 0 ? el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => reminder(inv) }, "Siapkan pengingat") : null,
                                el("button", { class: "erp-btn erp-btn--sm erp-btn--primary", type: "button", onclick: () => pay(ctx, inv) }, isAR ? "Terima bayar" : "Bayar"))));
                }))))));
    return wrap;
}

async function newInvoice(ctx, direction) {
    const due = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const values = await formDialog({
        title: direction === "piutang" ? "Tagihan ke pelanggan" : "Tagihan dari pemasok",
        fields: [
            { name: "party", label: direction === "piutang" ? "Nama pelanggan" : "Nama pemasok", required: true, max: 80 },
            { name: "number", label: "Nomor tagihan (opsional)", max: 40 },
            { name: "amount", label: "Nominal (Rp)", type: "number", min: 1, step: 1000, required: true },
            { name: "due_date", label: "Jatuh tempo", type: "date", value: due, required: true },
        ],
    });
    if (!values) return;
    const input = { ...values, direction };
    const problem = validateInvoice(input);
    if (problem) return toast(problem, "error");
    try {
        await ctx.data.saveInvoice(input);
        invalidateProData();
        toast("Tagihan dicatat.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

async function pay(ctx, inv) {
    const values = await formDialog({
        title: `${inv.direction === "piutang" ? "Terima pembayaran" : "Bayar"} · ${inv.party}`,
        submitLabel: "Catat & buat jurnal",
        fields: [
            { name: "amount", label: `Nominal (sisa ${rupiah(outstanding(inv))})`, type: "number", min: 1, step: 1, value: outstanding(inv), required: true },
            { name: "cash", label: "Lewat", type: "select", value: "1-1100", options: [{ value: "1-1100", label: "Bank / transfer" }, { value: "1-1000", label: "Kas tunai" }] },
        ],
    });
    if (!values) return;
    try {
        await ctx.data.payInvoice(inv.id, Number(values.amount), values.cash);
        invalidateProData();
        toast("Pembayaran dicatat. Jurnal otomatis dibuat.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

/** Pesan pengingat disiapkan & disalin — staf sendiri yang mengirim lewat WhatsApp/email. */
function reminder(inv) {
    const text = `Halo ${inv.party}, kami ingin mengingatkan tagihan ${inv.number} sebesar ${rupiah(outstanding(inv))} yang jatuh tempo pada ${fmtDay(inv.due_date)}. Mohon konfirmasi jadwal pembayarannya. Terima kasih.`;
    navigator.clipboard?.writeText(text).then(
        () => toast("Pesan pengingat disalin. Tempel di WhatsApp/email pelanggan."),
        () => window.prompt("Salin pesan pengingat ini:", text)
    );
}

async function cashView(ctx, entries) {
    const [invoices, recurring] = await Promise.all([
        ctx.data.listInvoices?.().catch(() => []) ?? [],
        ctx.data.listRecurring?.().catch(() => []) ?? [],
    ]);
    const lines = flattenLines(entries);
    const cash = cashBalance(lines);
    const f = cashForecast({ cashNow: cash, invoices, recurring, days: 30 });
    const wrap = el("div", { class: "erp-stack" });

    wrap.appendChild(el("section", { class: "erp-stats" },
        statCard({ label: "Kas & bank hari ini", value: shortRupiah(cash) }),
        statCard({ label: "Titik terendah", value: shortRupiah(f.lowest.balance), sub: fmtDay(f.lowest.date), tone: f.lowest.balance < 0 ? "bad" : "" }),
        statCard({ label: "Perkiraan akhir 30 hari", value: shortRupiah(f.end) })));

    if (f.firstNegative) {
        wrap.appendChild(el("p", { class: "erp-alert erp-alert--bad", text: `⚠ Kas diperkirakan minus mulai ${fmtDay(f.firstNegative.date)}. Pilihan: percepat penagihan piutang telat, tunda pembelian yang belum mendesak, atau negosiasikan tanggal bayar pemasok.` }));
    }

    const days = f.series.filter((p) => p.items.length);
    wrap.appendChild(el("section", { class: "erp-card" },
        el("h2", { text: "Rincian arus kas ke depan" }),
        days.length
            ? el("div", { class: "erp-table-wrap" }, el("table", { class: "erp-table" },
                el("thead", {}, el("tr", {}, ["Tanggal", "Keterangan", "Masuk/keluar", "Saldo"].map((h) => el("th", { text: h })))),
                el("tbody", {}, days.flatMap((p) => p.items.map((it, i) => el("tr", {},
                    el("td", { "data-label": "Tanggal", text: i ? "" : fmtDay(p.date) }),
                    el("td", { "data-label": "Keterangan", text: it.label }),
                    el("td", { "data-label": "Masuk/keluar", class: `erp-num ${it.amount < 0 ? "erp-neg" : "erp-pos"}`, text: `${it.amount < 0 ? "−" : "+"}${rupiah(Math.abs(it.amount))}` }),
                    el("td", { "data-label": "Saldo", class: "erp-num", text: i === p.items.length - 1 ? rupiah(p.balance) : "" })))))))
            : emptyState("Belum ada arus kas terjadwal.")));
    return wrap;
}

async function budgetView(ctx, accounts, entries) {
    const period = new Date().toISOString().slice(0, 7);
    const budgets = await ctx.data.listBudgets?.().catch(() => []) ?? [];
    const rows = budgetUsage(budgets, flattenLines(entries), period);
    const nameOf = (code) => accounts.find((a) => a.code === code)?.name || code;
    const expense = accounts.filter((a) => a.type === "beban");

    const wrap = el("div", { class: "erp-stack" });
    wrap.appendChild(el("div", { class: "erp-toolbar" },
        el("p", { class: "erp-muted", text: `Anggaran bulan ini (${period}) vs pengeluaran yang sudah dijurnal.` }),
        el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: async () => {
            const values = await formDialog({
                title: "Atur anggaran bulan ini",
                fields: [
                    { name: "account_code", label: "Akun beban", type: "select", options: expense.map((a) => ({ value: a.code, label: `${a.code} · ${a.name}` })) },
                    { name: "amount", label: "Anggaran (Rp)", type: "number", min: 1, step: 10000, required: true },
                ],
            });
            if (!values) return;
            try {
                await ctx.data.saveBudget({ ...values, label: nameOf(values.account_code), period });
                invalidateProData();
                toast("Anggaran disimpan.");
                ctx.rerender();
            } catch (error) {
                toast(friendlyError(error), "error");
            }
        } }, "+ Atur anggaran")));

    if (!rows.length) {
        wrap.appendChild(emptyState("Belum ada anggaran untuk bulan ini."));
        return wrap;
    }

    wrap.appendChild(el("section", { class: "erp-card" },
        el("ul", { class: "erp-budgets" }, rows.map((row) => el("li", { class: `erp-budget erp-budget--${row.status}` },
            el("div", { class: "erp-budget__top" },
                el("strong", { text: row.label || nameOf(row.account_code) }),
                el("span", { text: `${rupiah(row.actual)} / ${rupiah(row.amount)}` })),
            el("div", { class: "erp-budget__track" }, el("span", { class: "erp-budget__fill", style: `width:${Math.min(100, row.pct)}%` })),
            el("small", { text: row.status === "lewat" ? `Lewat ${rupiah(-row.remaining)} (${row.pct}%)` : `Sisa ${rupiah(row.remaining)} · ${row.pct}% terpakai` }))))));
    return wrap;
}

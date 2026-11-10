/**
 * KANTOONG ERP — KEUANGAN & AKUNTANSI (Fase 2)
 * File: frontend/erp/modules/finance.js
 *
 * Pembukuan berpasangan. Penjualan online, kasir, dan gaji tercatat
 * otomatis; staf keuangan mencatat pengeluaran/modal secara manual.
 * Laporan: ringkasan kas, laba rugi, neraca, buku besar per akun.
 */

import { ACCOUNT_TYPES, balanceSheet, balances, flattenLines, monthRange, profitLoss, validateJournal } from "../core/accounting.js";
import { currentPeriod, periodLabel, previousPeriod, wibDate } from "../core/hr.js";
import { el, emptyState, formDialog, friendlyError, hbarList, pageHeader, rupiah, segmented, statCard, toast } from "../ui.js";
import { FINANCE_PRO_TABS, financeProView } from "./finance-pro.js";
import { subRoute } from "./pro-data.js";

let tab = "summary";
let period = null;

const SOURCE_LABELS = { manual: "Manual", pengeluaran: "Pengeluaran", order: "Online", pos: "Kasir", payroll: "Gaji" };

export async function render(ctx) {
    const { data } = ctx;
    const [accounts, entries] = await Promise.all([data.listAccounts(), data.listJournal()]);

    period = period || currentPeriod();
    // Tautan langsung dari Ruang Komando / notifikasi: #/finance/piutang dst.
    const routed = subRoute();
    if (FINANCE_PRO_TABS.some((t) => t.value === routed)) tab = routed;
    const proTab = FINANCE_PRO_TABS.some((t) => t.value === tab);
    const range = monthRange(period);
    const lines = flattenLines(entries);
    const nameOf = (code) => accounts.find((account) => account.code === code)?.name || code;

    const page = el("div", { class: "erp-page__inner" });

    page.appendChild(pageHeader(
        "Keuangan & Akuntansi",
        "Penjualan online, kasir, dan gaji masuk jurnal otomatis.",
        el("button", { class: "erp-btn", type: "button", onclick: () => quickEntry(ctx, accounts) }, "+ Pengeluaran / pemasukan"),
        el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => manualJournal(ctx, accounts) }, "+ Jurnal manual")
    ));

    const periods = [currentPeriod(), previousPeriod(currentPeriod()), previousPeriod(previousPeriod(currentPeriod()))];

    page.appendChild(el("div", { class: "erp-toolbar" },
        segmented([
            { value: "summary", label: "Ringkasan" },
            { value: "journal", label: "Jurnal" },
            { value: "pl", label: "Laba rugi" },
            { value: "bs", label: "Neraca" },
            { value: "accounts", label: "Akun" },
            ...FINANCE_PRO_TABS,
        ], tab, (value) => {
            tab = value;
            if (location.hash.split("/").length > 2) history.replaceState(null, "", "#/finance");
            ctx.rerender();
        }),
        tab !== "bs" && tab !== "accounts" && !proTab
            ? segmented(periods.map((value) => ({ value, label: periodLabel(value) })), period, (value) => {
                period = value;
                ctx.rerender();
            })
            : null
    ));

    if (!accounts.length) {
        page.appendChild(emptyState("Bagan akun belum tersedia. Jalankan db/erp-phase2.sql di Supabase."));
        return page;
    }

    if (proTab) {
        page.appendChild(await financeProView(ctx, tab, accounts, entries));
        return page;
    }
    if (tab === "summary") page.appendChild(summaryView(accounts, lines, range));
    if (tab === "journal") page.appendChild(journalView(entries, range, nameOf));
    if (tab === "pl") page.appendChild(profitLossView(accounts, lines, range));
    if (tab === "bs") page.appendChild(balanceSheetView(accounts, lines));
    if (tab === "accounts") page.appendChild(accountsView(accounts, lines));

    return page;
}

/* ---------- Ringkasan ---------- */

function summaryView(accounts, lines, range) {
    const now = balances(accounts, lines);
    const pl = profitLoss(accounts, lines, range);
    const cash = (now.get("1-1000") || 0) + (now.get("1-1100") || 0);

    const wrap = el("div", { class: "erp-page__inner" });

    wrap.appendChild(el("div", { class: "erp-stats" },
        statCard({ label: "Kas & bank saat ini", value: rupiah(cash), sub: `Kas ${rupiah(now.get("1-1000") || 0)} · Bank ${rupiah(now.get("1-1100") || 0)}` }),
        statCard({ label: "Pendapatan bulan ini", value: rupiah(pl.totalRevenue) }),
        statCard({ label: "Beban bulan ini", value: rupiah(pl.totalExpense) }),
        statCard({ label: "Laba bersih bulan ini", value: rupiah(pl.net), tone: pl.net < 0 ? "alert" : "" })
    ));

    wrap.appendChild(el("div", { class: "erp-split erp-split--even" },
        el("section", { class: "erp-card" },
            el("div", { class: "erp-card__head" }, el("h2", { text: "Pendapatan per sumber" })),
            pl.revenue.length ? hbarList(pl.revenue.map((row) => ({ label: row.name, value: row.amount }))) : emptyState("Belum ada pendapatan.")
        ),
        el("section", { class: "erp-card" },
            el("div", { class: "erp-card__head" }, el("h2", { text: "Beban per jenis" })),
            pl.expenses.length ? hbarList(pl.expenses.map((row) => ({ label: row.name, value: row.amount }))) : emptyState("Belum ada beban.")
        )
    ));

    return wrap;
}

/* ---------- Jurnal ---------- */

function journalView(entries, range, nameOf) {
    const list = entries
        .filter((entry) => entry.entry_date >= range.from && entry.entry_date <= range.to)
        .sort((a, b) => b.entry_date.localeCompare(a.entry_date) || String(b.created_at).localeCompare(String(a.created_at)));

    if (!list.length) return emptyState("Belum ada jurnal di bulan ini.");

    return el("section", { class: "erp-card" },
        el("p", { class: "erp-muted", text: `${list.length} jurnal. Setiap jurnal seimbang: total debit = total kredit.` }),
        el("ul", { class: "erp-journal" }, list.slice(0, 150).map((entry) => el("li", { class: "erp-journal__entry" },
            el("div", { class: "erp-journal__head" },
                el("span", { class: "erp-tag", text: SOURCE_LABELS[entry.source] || entry.source }),
                el("strong", { text: entry.memo }),
                el("small", { class: "erp-muted", text: entry.entry_date })
            ),
            el("table", { class: "erp-journal__lines" },
                el("tbody", {}, entry.lines.map((line) => el("tr", {},
                    el("td", { class: line.credit > 0 ? "is-credit" : "", text: `${line.account_code} ${nameOf(line.account_code)}` }),
                    el("td", { class: "num", text: line.debit > 0 ? rupiah(line.debit) : "" }),
                    el("td", { class: "num", text: line.credit > 0 ? rupiah(line.credit) : "" })
                )))
            )
        )))
    );
}

/* ---------- Laba rugi ---------- */

function reportTable(sections, totalLabel, total) {
    return el("table", { class: "erp-report" },
        el("tbody", {},
            sections.flatMap(({ title, rows, sum }) => [
                el("tr", { class: "erp-report__section" }, el("th", { colspan: 2, text: title })),
                ...(rows.length ? rows : [{ code: "", name: "(kosong)", amount: 0 }]).map((row) => el("tr", {},
                    el("td", { text: row.code ? `${row.code} ${row.name}` : row.name }),
                    el("td", { class: "num", text: rupiah(row.amount) })
                )),
                el("tr", { class: "erp-report__sum" }, el("td", { text: `Total ${title.toLowerCase()}` }), el("td", { class: "num", text: rupiah(sum) })),
            ]),
            el("tr", { class: "erp-report__grand" }, el("td", { text: totalLabel }), el("td", { class: "num", text: rupiah(total) }))
        )
    );
}

function profitLossView(accounts, lines, range) {
    const pl = profitLoss(accounts, lines, range);
    return el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" },
            el("h2", { text: `Laba rugi ${periodLabel(period)}` }),
            el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => window.print() }, "Cetak")
        ),
        reportTable([
            { title: "Pendapatan", rows: pl.revenue, sum: pl.totalRevenue },
            { title: "Beban", rows: pl.expenses, sum: pl.totalExpense },
        ], pl.net >= 0 ? "Laba bersih" : "Rugi bersih", pl.net)
    );
}

/* ---------- Neraca ---------- */

function balanceSheetView(accounts, lines) {
    const today = wibDate();
    const bs = balanceSheet(accounts, lines, today);

    return el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" },
            el("div", {},
                el("h2", { text: `Neraca per ${today}` }),
                el("p", { class: bs.balanced ? "erp-muted" : "erp-form__error", text: bs.balanced ? "✓ Seimbang: aset = kewajiban + modal" : "⚠ Tidak seimbang — periksa jurnal" })
            ),
            el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => window.print() }, "Cetak")
        ),
        el("div", { class: "erp-split erp-split--even" },
            reportTable([{ title: "Aset", rows: bs.assets, sum: bs.totalAssets }], "Total aset", bs.totalAssets),
            reportTable([
                { title: "Kewajiban", rows: bs.liabilities, sum: bs.totalLiabilities },
                { title: "Modal", rows: bs.equity.concat([{ code: "", name: "Laba ditahan & berjalan", amount: bs.earnings }]), sum: bs.totalEquity },
            ], "Total kewajiban + modal", bs.totalLiabilities + bs.totalEquity)
        )
    );
}

/* ---------- Akun ---------- */

function accountsView(accounts, lines) {
    const saldo = balances(accounts, lines);
    return el("section", { class: "erp-card" },
        el("div", { class: "erp-table-wrap" }, el("table", { class: "erp-table" },
            el("thead", {}, el("tr", {}, ["Kode", "Akun", "Jenis", "Saldo"].map((head) => el("th", { text: head })))),
            el("tbody", {}, accounts.map((account) => el("tr", {},
                el("td", { "data-label": "Kode" }, el("code", { text: account.code })),
                el("td", { "data-label": "Akun", text: account.name }),
                el("td", { "data-label": "Jenis", text: ACCOUNT_TYPES[account.type] }),
                el("td", { "data-label": "Saldo", class: "num", text: rupiah(saldo.get(account.code) || 0) })
            )))
        ))
    );
}

/* ---------- Pencatatan ---------- */

async function quickEntry(ctx, accounts) {
    const cashAccounts = accounts.filter((account) => ["1-1000", "1-1100"].includes(account.code));
    const values = await formDialog({
        title: "Catat pengeluaran / pemasukan",
        submitLabel: "Catat",
        fields: [
            { name: "direction", label: "Jenis", type: "select", value: "keluar", options: [{ value: "keluar", label: "Uang keluar (beban)" }, { value: "masuk", label: "Uang masuk (modal/pendapatan lain)" }] },
            { name: "memo", label: "Keterangan", required: true, max: 200, placeholder: "contoh: Bayar listrik outlet" },
            { name: "amount", label: "Nominal (Rp)", type: "number", min: 1, step: 1000, required: true },
            {
                name: "account", label: "Akun lawan", type: "select", value: "6-1200",
                options: accounts.filter((account) => ["beban", "pendapatan", "modal", "kewajiban"].includes(account.type)).map((account) => ({ value: account.code, label: `${account.code} ${account.name}` })),
            },
            { name: "cash", label: "Dibayar / diterima lewat", type: "select", value: "1-1100", options: cashAccounts.map((account) => ({ value: account.code, label: account.name })) },
            { name: "date", label: "Tanggal", type: "date", value: wibDate() },
        ],
    });
    if (!values) return;

    const amount = Math.round(Number(values.amount) || 0);
    const out = values.direction === "keluar";
    const lines = [
        { account_code: out ? values.account : values.cash, debit: amount, credit: 0 },
        { account_code: out ? values.cash : values.account, debit: 0, credit: amount },
    ];

    await submit(ctx, { entry_date: values.date, memo: values.memo.trim(), source: out ? "pengeluaran" : "manual", lines });
}

async function manualJournal(ctx, accounts) {
    const options = accounts.map((account) => ({ value: account.code, label: `${account.code} ${account.name}` }));
    const values = await formDialog({
        title: "Jurnal manual (2 baris)",
        submitLabel: "Catat jurnal",
        fields: [
            { name: "memo", label: "Keterangan", required: true, max: 200 },
            { name: "date", label: "Tanggal", type: "date", value: wibDate() },
            { name: "debit_account", label: "Akun DEBIT", type: "select", value: "6-1200", options },
            { name: "credit_account", label: "Akun KREDIT", type: "select", value: "1-1100", options },
            { name: "amount", label: "Nominal (Rp)", type: "number", min: 1, step: 1000, required: true, hint: "Debit & kredit otomatis sama besar." },
        ],
    });
    if (!values) return;

    const amount = Math.round(Number(values.amount) || 0);
    await submit(ctx, {
        entry_date: values.date,
        memo: values.memo.trim(),
        source: "manual",
        lines: [
            { account_code: values.debit_account, debit: amount, credit: 0 },
            { account_code: values.credit_account, debit: 0, credit: amount },
        ],
    });
}

async function submit(ctx, payload) {
    if (payload.lines[0].account_code === payload.lines[1].account_code) {
        toast("Akun debit dan kredit tidak boleh sama.", "error");
        return;
    }

    const problem = validateJournal(payload.lines);
    if (problem) {
        toast(problem, "error");
        return;
    }

    try {
        await ctx.data.postJournal(payload);
        toast("Jurnal tercatat.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}


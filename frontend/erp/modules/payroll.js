/**
 * KANTOONG ERP — PAYROLL (Fase 2)
 * File: frontend/erp/modules/payroll.js
 *
 * Semua orang: "Slip gajiku" (hanya miliknya, setelah difinalkan HR).
 * HR & owner: hitung otomatis (gaji pokok + komisi dari omzet dibayar
 * − potongan alpa), sesuaikan tunjangan/potongan, finalkan, bayar
 * (jurnal beban gaji & komisi tercatat otomatis di Keuangan).
 */

import { isPayrollAdmin } from "../core/org.js";
import { computePayslip } from "../core/payroll.js";
import { DEFAULT_HR_SETTINGS, currentPeriod, monthlyRecap, periodLabel, previousPeriod } from "../core/hr.js";
import { monthRange } from "../core/accounting.js";
import { el, emptyState, formDialog, friendlyError, initials, pageHeader, rupiah, statCard, toast } from "../ui.js";

const RUN_STATUS = {
    draft: { label: "Draf", tone: "warn" },
    final: { label: "Final", tone: "" },
    dibayar: { label: "Dibayar", tone: "good" },
};

let openRun = null;

export async function render(ctx) {
    const { data, me } = ctx;
    const admin = isPayrollAdmin(me);

    const [runs, slips, members] = await Promise.all([
        data.listPayrollRuns(),
        data.listPayslips(),
        data.listMembers(),
    ]);

    const runOf = (id) => runs.find((run) => run.id === id);
    const page = el("div", { class: "erp-page__inner" });

    page.appendChild(pageHeader(
        "Payroll",
        admin ? "Gaji pokok + komisi otomatis − potongan alpa. Hanya HR & owner yang melihat semua slip." : "Slip gajimu. Hanya kamu, HR, dan owner yang bisa melihatnya.",
        admin ? el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => createRun(ctx, runs) }, "+ Payroll periode baru") : null
    ));

    // ---------- Slip gajiku ----------
    const mine = slips
        .filter((slip) => slip.member_id === me.id && runOf(slip.run_id) && runOf(slip.run_id).status !== "draft")
        .sort((a, b) => runOf(b.run_id).period.localeCompare(runOf(a.run_id).period));

    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" }, el("h2", { text: "Slip gajiku" })),
        mine.length
            ? el("ul", { class: "erp-members" }, mine.map((slip) => {
                const run = runOf(slip.run_id);
                return el("li", { class: "erp-member" },
                    el("div", { class: "erp-member__main" },
                        el("strong", { text: periodLabel(run.period) }),
                        el("small", { class: "erp-muted", text: RUN_STATUS[run.status].label })
                    ),
                    el("strong", { text: rupiah(slip.net) }),
                    el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => showSlip(slip, run, me) }, "Lihat slip")
                );
            }))
            : emptyState("Belum ada slip gaji yang difinalkan untukmu.")
    ));

    if (!admin) return page;

    // ---------- Daftar periode (HR/owner) ----------
    if (!openRun && runs.length) openRun = runs[0].id;

    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" }, el("h2", { text: "Periode payroll" })),
        runs.length
            ? el("div", { class: "erp-chips" }, runs.map((run) => el("button", {
                type: "button",
                class: `erp-chip${run.id === openRun ? " is-active" : ""}`,
                onclick: () => {
                    openRun = run.id;
                    ctx.rerender();
                },
            }, `${periodLabel(run.period)} · ${RUN_STATUS[run.status].label}`)))
            : emptyState("Belum ada payroll. Buat periode pertama.")
    ));

    const run = runOf(openRun);
    if (run) page.appendChild(await runView(ctx, run, slips.filter((slip) => slip.run_id === run.id), members));

    return page;
}

async function runView(ctx, run, slips, members) {
    const nameOf = (id) => members.find((member) => member.id === id);
    const total = slips.reduce((sum, slip) => sum + Number(slip.net), 0);
    const commissionTotal = slips.reduce((sum, slip) => sum + Number(slip.commission), 0);
    const editable = run.status === "draft";

    const wrap = el("div", { class: "erp-page__inner" });

    wrap.appendChild(el("div", { class: "erp-stats" },
        statCard({ label: `Total gaji bersih ${periodLabel(run.period)}`, value: rupiah(total), sub: `${slips.length} karyawan` }),
        statCard({ label: "Total komisi", value: rupiah(commissionTotal), sub: "dari omzet dibayar" }),
        statCard({ label: "Status", value: RUN_STATUS[run.status].label, sub: run.status === "dibayar" ? "jurnal sudah tercatat di Keuangan" : run.status === "final" ? "siap dibayar" : "masih bisa diubah", tone: run.status === "draft" ? "alert" : "" })
    ));

    // Isian tunjangan/potongan (khusus draf).
    const inputs = new Map();

    const table = el("table", { class: "erp-table" },
        el("thead", {}, el("tr", {}, ["Karyawan", "Pokok", "Komisi", "Tunjangan", "Potongan", "Alpa", "Bersih"].map((head) => el("th", { text: head })))),
        el("tbody", {}, slips
            .slice()
            .sort((a, b) => (nameOf(a.member_id)?.full_name || "").localeCompare(nameOf(b.member_id)?.full_name || "", "id"))
            .map((slip) => {
                const member = nameOf(slip.member_id);
                const allowance = el("input", { type: "number", min: 0, step: 50000, class: "erp-input-sm", value: slip.allowance, "aria-label": "Tunjangan", disabled: !editable });
                const deduction = el("input", { type: "number", min: 0, step: 50000, class: "erp-input-sm", value: slip.deduction, "aria-label": "Potongan", disabled: !editable });
                inputs.set(slip.member_id, { slip, allowance, deduction });

                return el("tr", {},
                    el("td", {}, el("div", { class: "erp-person" },
                        el("span", { class: "erp-avatar erp-avatar--sm", text: initials(member?.full_name) }),
                        el("span", {}, el("strong", { text: member?.full_name || "—" }), el("small", { text: member?.position_title || "" }))
                    )),
                    el("td", { "data-label": "Pokok", text: rupiah(slip.base_salary) }),
                    el("td", { "data-label": "Komisi", text: rupiah(slip.commission) }),
                    el("td", { "data-label": "Tunjangan" }, editable ? allowance : rupiah(slip.allowance)),
                    el("td", { "data-label": "Potongan" }, editable ? deduction : rupiah(slip.deduction)),
                    el("td", { "data-label": "Alpa", text: slip.attendance_deduction ? `−${rupiah(slip.attendance_deduction)}` : "-" }),
                    el("td", { "data-label": "Bersih" }, el("strong", { text: rupiah(slip.net) }))
                );
            }))
    );

    const actions = el("div", { class: "erp-form__actions" });

    if (editable) {
        actions.append(
            el("button", { class: "erp-btn", type: "button", onclick: () => generate(ctx, run, inputs) }, slips.length ? "Hitung ulang otomatis" : "Hitung otomatis"),
            slips.length ? el("button", { class: "erp-btn", type: "button", onclick: () => saveEdits(ctx, run, inputs) }, "Simpan tunjangan/potongan") : null,
            el("span", { class: "erp-spacer" }),
            slips.length ? el("button", {
                class: "erp-btn erp-btn--primary", type: "button",
                onclick: async () => {
                    if (!window.confirm(`Finalkan payroll ${periodLabel(run.period)}? Setelah final, slip tidak bisa diubah dan karyawan bisa melihat slipnya.`)) return;
                    await act(ctx, () => ctx.data.finalizePayroll(run.id), "Payroll difinalkan. Karyawan kini bisa melihat slipnya.");
                },
            }, "Finalkan") : null
        );
    } else if (run.status === "final") {
        actions.append(
            el("span", { class: "erp-spacer" }),
            el("button", {
                class: "erp-btn erp-btn--primary", type: "button",
                onclick: async () => {
                    if (!window.confirm(`Tandai gaji ${periodLabel(run.period)} sudah ditransfer (${rupiah(total)})? Jurnal beban gaji akan dicatat.`)) return;
                    await act(ctx, () => ctx.data.payPayroll(run.id), "Gaji ditandai dibayar & jurnal tercatat.");
                },
            }, "Tandai sudah dibayar")
        );
    }

    wrap.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" },
            el("h2", { text: `Slip ${periodLabel(run.period)}` }),
            el("span", { class: `erp-pill erp-pill--${RUN_STATUS[run.status].tone}`, text: RUN_STATUS[run.status].label })
        ),
        slips.length ? el("div", { class: "erp-table-wrap" }, table) : emptyState("Belum dihitung. Tekan \"Hitung otomatis\"."),
        actions
    ));

    return wrap;
}

/** Hitung slip semua karyawan aktif dari data asli (omzet, absensi, gaji pokok). */
async function generate(ctx, run, inputs) {
    try {
        const range = monthRange(run.period);
        const [base, attendance, settings] = await Promise.all([
            ctx.data.payrollBase(run.period),
            ctx.data.listAttendance(range),
            ctx.data.getHrSettings(),
        ]);
        const rules = { ...DEFAULT_HR_SETTINGS, ...(settings || {}) };

        const slips = base
            .filter((row) => row.base_salary > 0 || row.omzet > 0)
            .map((row) => {
                const kept = inputs.get(row.member_id);
                const recap = monthlyRecap(attendance, row.member_id, run.period);
                return {
                    member_id: row.member_id,
                    ...computePayslip({
                        baseSalary: row.base_salary,
                        commissionRate: row.commission_rate,
                        omzet: row.omzet,
                        alpaDays: recap.alpa,
                        workingDays: rules.working_days,
                        allowance: kept ? Number(kept.allowance.value) || 0 : 0,
                        deduction: kept ? Number(kept.deduction.value) || 0 : 0,
                    }),
                };
            });

        await ctx.data.savePayslips(run.id, slips);
        toast(`${slips.length} slip dihitung otomatis.`);
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

async function saveEdits(ctx, run, inputs) {
    const slips = [...inputs.values()].map(({ slip, allowance, deduction }) => {
        const details = slip.details || {};
        return {
            member_id: slip.member_id,
            ...computePayslip({
                baseSalary: slip.base_salary,
                commissionRate: details.commission_rate,
                omzet: details.omzet,
                alpaDays: details.alpa_days,
                workingDays: details.working_days,
                allowance: Number(allowance.value) || 0,
                deduction: Number(deduction.value) || 0,
            }),
        };
    });

    await act(ctx, () => ctx.data.savePayslips(run.id, slips), "Tunjangan & potongan disimpan.");
}

async function act(ctx, fn, message) {
    try {
        await fn();
        toast(message);
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

async function createRun(ctx, runs) {
    const options = [currentPeriod(), previousPeriod(currentPeriod())]
        .filter((period) => !runs.some((run) => run.period === period));

    if (!options.length) {
        toast("Payroll bulan ini & bulan lalu sudah dibuat.");
        return;
    }

    const values = await formDialog({
        title: "Payroll periode baru",
        submitLabel: "Buat",
        fields: [{ name: "period", label: "Periode", type: "select", value: options[0], options: options.map((period) => ({ value: period, label: periodLabel(period) })) }],
    });
    if (!values) return;

    try {
        const run = await ctx.data.createPayrollRun(values.period);
        openRun = run.id;
        toast("Periode dibuat. Tekan \"Hitung otomatis\".");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

function showSlip(slip, run, member) {
    const details = slip.details || {};
    const row = (label, value, strong = false) => [
        el("dt", { class: strong ? "erp-pos__total" : "", text: label }),
        el("dd", { class: strong ? "erp-pos__total" : "", text: value }),
    ];

    const dialog = el("dialog", { class: "erp-dialog erp-receipt" },
        el("div", { class: "erp-receipt__paper" },
            el("p", { class: "erp-receipt__brand", text: "SLIP GAJI" }),
            el("p", { class: "erp-muted", text: `${periodLabel(run.period)} · ${member.full_name}` }),
            el("p", { class: "erp-muted", text: member.position_title }),
            el("dl", {},
                row("Gaji pokok", rupiah(slip.base_salary)),
                row(`Komisi (${String(details.commission_rate || 0).replace(".", ",")}% × ${rupiah(details.omzet || 0)})`, rupiah(slip.commission)),
                row("Tunjangan", rupiah(slip.allowance)),
                row("Potongan", `−${rupiah(slip.deduction)}`),
                row(`Potongan alpa (${details.alpa_days || 0} hari)`, `−${rupiah(slip.attendance_deduction)}`),
                row("Gaji bersih", rupiah(slip.net), true)
            ),
            el("p", { class: "erp-receipt__thanks", text: "Rahasia — hanya untuk penerima." })
        ),
        el("div", { class: "erp-form__actions" },
            el("span", { class: "erp-spacer" }),
            el("button", { class: "erp-btn", type: "button", onclick: () => window.print() }, "Cetak"),
            el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => dialog.close() }, "Tutup")
        )
    );

    dialog.addEventListener("close", () => dialog.remove());
    document.body.appendChild(dialog);
    dialog.showModal();
}


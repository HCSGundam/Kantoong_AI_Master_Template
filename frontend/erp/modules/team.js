/**
 * KANTOONG ERP — TIM & TARGET (modul 5: Supervisor / Manager)
 * File: frontend/erp/modules/team.js
 *
 * Atasan melihat performa bawahannya (langsung & tidak langsung),
 * mengatur target & persen komisi per orang, dan memantau papan
 * peringkat real-time. Tidak bisa melihat tim lain.
 */

import { canManage, subtreeIds } from "../core/org.js";
import { commission, periodStart, progress, salesTotals, sumOrders } from "../core/metrics.js";
import {
    el, emptyState, formDialog, friendlyError, initials, pageHeader,
    rupiah, segmented, shortRupiah, statCard, toast,
} from "../ui.js";
import { autoRefresh, leaderboardPanel } from "./shared.js";

let period = "month";

export async function render(ctx) {
    const { data, me } = ctx;

    const [members, orders, targets] = await Promise.all([
        data.listMembers(),
        data.listOrders({ since: periodStart("month") }),
        data.getTargets(),
    ]);

    // Owner/direktur melihat semua sales; atasan lain hanya pohon di bawahnya.
    const below = me.level >= 4
        ? new Set(members.filter((member) => member.id !== me.id).map((member) => member.id))
        : subtreeIds(members, me.id);

    const salesTeam = members.filter((member) =>
        below.has(member.id) && member.job_role === "sales" && member.is_active !== false
    );
    const teamIds = new Set(salesTeam.map((member) => member.id));
    const targetOf = (id) => targets.find((target) => target.member_id === id) || {};

    const page = el("div", { class: "erp-page__inner" });

    const periodTabs = segmented(
        [{ value: "day", label: "Hari ini" }, { value: "month", label: "Bulan ini" }],
        period,
        (value) => {
            period = value;
            ctx.rerender();
        }
    );

    page.appendChild(pageHeader(
        "Tim & Target",
        me.level >= 4 ? "Semua sales di perusahaan" : `${salesTeam.length} sales di bawahmu`,
        periodTabs
    ));

    const since = periodStart(period);
    const totals = salesTotals(orders, since);
    const team = sumOrders(orders, since, teamIds);
    const goalKey = period === "day" ? "daily_target" : "monthly_target";
    const teamGoal = salesTeam.reduce((sum, member) => sum + (Number(targetOf(member.id)[goalKey]) || 0), 0);
    const teamCommission = salesTeam.reduce(
        (sum, member) => sum + commission(totals.get(member.id)?.omzet || 0, targetOf(member.id).commission_rate),
        0
    );

    page.appendChild(el("div", { class: "erp-stats" },
        statCard({ label: period === "day" ? "Omzet tim hari ini" : "Omzet tim bulan ini", value: rupiah(team.omzet), sub: `${team.count} pesanan dibayar` }),
        statCard({ label: "Capaian target tim", value: teamGoal ? `${progress(team.omzet, teamGoal)}%` : "-", sub: teamGoal ? `dari ${shortRupiah(teamGoal)}` : "Target belum diatur" }),
        statCard({ label: "Rata-rata per pesanan", value: rupiah(team.average) }),
        statCard({ label: "Total komisi berjalan", value: rupiah(teamCommission), sub: "estimasi dari omzet dibayar" })
    ));

    // Tabel performa per sales.
    const rows = salesTeam
        .map((member) => {
            const total = totals.get(member.id) || { omzet: 0, count: 0 };
            const target = targetOf(member.id);
            return { member, total, target, pct: progress(total.omzet, target[goalKey]) };
        })
        .sort((a, b) => b.total.omzet - a.total.omzet);

    const table = el("table", { class: "erp-table" },
        el("thead", {}, el("tr", {},
            ["Sales", "Omzet", "Pesanan", "Target", "Capaian", "Komisi", ""].map((head) => el("th", { text: head }))
        )),
        el("tbody", {}, rows.map(({ member, total, target, pct }) =>
            el("tr", {},
                el("td", {}, el("div", { class: "erp-person" },
                    el("span", { class: "erp-avatar erp-avatar--sm", text: initials(member.full_name) }),
                    el("span", {}, el("strong", { text: member.full_name }), el("small", { text: member.unit_name }))
                )),
                el("td", { "data-label": "Omzet", text: rupiah(total.omzet) }),
                el("td", { "data-label": "Pesanan", text: String(total.count) }),
                el("td", { "data-label": "Target", text: target[goalKey] ? shortRupiah(target[goalKey]) : "-" }),
                el("td", { "data-label": "Capaian" },
                    el("span", { class: `erp-pill ${pct === null ? "" : pct >= 100 ? "erp-pill--good" : pct >= 60 ? "" : "erp-pill--warn"}`, text: pct === null ? "-" : `${pct}%` })
                ),
                el("td", { "data-label": "Komisi", text: `${String(Number(target.commission_rate) || 0).replace(".", ",")}% · ${rupiah(commission(total.omzet, target.commission_rate))}` }),
                el("td", {}, canManage(me, member.id, members)
                    ? el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => editTarget(ctx, member, target) }, "Atur target")
                    : null)
            )
        ))
    );

    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" },
            el("div", {},
                el("h2", { text: "Performa per sales" }),
                el("p", { class: "erp-muted", text: "Setiap sales hanya melihat barisnya sendiri di Ruang Kerja mereka." })
            ),
            data.mode === "demo" && salesTeam.length
                ? el("button", {
                    class: "erp-btn erp-btn--sm",
                    type: "button",
                    onclick: async () => {
                        const pick = salesTeam[Math.floor(Math.random() * salesTeam.length)];
                        await data.simulateOrder(pick.id);
                        toast(`Demo: pesanan baru masuk untuk ${pick.full_name}.`);
                        ctx.rerender();
                    },
                }, "Simulasikan pesanan masuk")
                : null
        ),
        rows.length ? el("div", { class: "erp-table-wrap" }, table) : emptyState("Belum ada sales di bawahmu.")
    ));

    const board = leaderboardPanel(ctx, { period });
    page.appendChild(board.element);
    autoRefresh(ctx, board.refresh);

    return page;
}

async function editTarget(ctx, member, target) {
    const values = await formDialog({
        title: `Target & komisi — ${member.full_name}`,
        fields: [
            { name: "monthly_target", label: "Target omzet bulanan (Rp)", type: "number", min: 0, step: 1000, value: target.monthly_target || 0 },
            { name: "daily_target", label: "Target omzet harian (Rp)", type: "number", min: 0, step: 1000, value: target.daily_target || 0, hint: "Kosongkan/0 bila tidak dipakai." },
            { name: "commission_rate", label: "Komisi (% dari omzet dibayar)", type: "number", min: 0, max: 100, step: 0.1, value: target.commission_rate || 0, hint: "Bisa berbeda per orang. Tidak terlihat oleh rekan kerjanya." },
        ],
    });

    if (!values) return;

    try {
        await ctx.data.saveTarget(member.id, {
            monthly_target: Math.max(0, Math.round(Number(values.monthly_target) || 0)),
            daily_target: Math.max(0, Math.round(Number(values.daily_target) || 0)),
            commission_rate: Math.min(100, Math.max(0, Number(values.commission_rate) || 0)),
        });
        toast("Target & komisi disimpan.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

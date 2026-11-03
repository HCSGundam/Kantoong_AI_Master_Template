/**
 * KANTOONG ERP — RUANG KERJAKU (modul 2)
 * File: frontend/erp/modules/workspace.js
 *
 * Dashboard pribadi tiap karyawan: your dashboard, your report,
 * your effort, your salary. Tidak ada data rekan kerja di sini.
 */

import { levelName, subtreeIds } from "../core/org.js";
import { commission, dailySeries, daysInMonth, periodStart, progress, sumOrders } from "../core/metrics.js";
import { barChart, el, pageHeader, progressBar, rupiah, shortRupiah, statCard } from "../ui.js";
import { autoRefresh, leaderboardPanel } from "./shared.js";

export async function render(ctx) {
    const { data, me } = ctx;
    const monthStart = periodStart("month");
    const dayStart = periodStart("day");
    const chartStart = new Date(Date.now() - 14 * 86400000);

    const [members, orders, targets, salary, approvals] = await Promise.all([
        data.listMembers(),
        data.listOrders({ since: chartStart < monthStart ? chartStart : monthStart }),
        data.getTargets(),
        data.getSalary(me.id),
        data.listApprovals(),
    ]);

    const manager = members.find((member) => member.id === me.manager_id);
    const isSales = me.job_role === "sales";
    const mine = new Set([me.id]);
    const team = subtreeIds(members, me.id);
    const target = targets.find((entry) => entry.member_id === me.id);

    const page = el("div", { class: "erp-page__inner" });

    page.appendChild(pageHeader(
        `Halo, ${me.full_name.split(" ")[0]}`,
        [me.position_title, levelName(me.level), me.unit_name, manager ? `Atasan: ${manager.full_name}` : null]
            .filter(Boolean)
            .join(" · ")
    ));

    page.appendChild(el("p", { class: "erp-privacy" },
        "🔒 Halaman ini hanya untukmu. Rekan kerja tidak bisa melihat omzet, target, komisi, maupun gajimu."
    ));

    const stats = el("div", { class: "erp-stats" });
    page.appendChild(stats);

    let monthOmzet = 0;
    let rate = Number(target?.commission_rate) || 0;

    if (isSales) {
        const today = sumOrders(orders, dayStart, mine);
        const month = sumOrders(orders, monthStart, mine);
        monthOmzet = month.omzet;
        const dailyGoal = Number(target?.daily_target) || 0;
        const monthlyGoal = Number(target?.monthly_target) || 0;
        const monthPct = progress(month.omzet, monthlyGoal);

        stats.append(
            statCard({
                label: "Omzet hari ini",
                value: rupiah(today.omzet),
                sub: dailyGoal ? `Target harian ${shortRupiah(dailyGoal)} · ${progress(today.omzet, dailyGoal)}%` : `${today.count} pesanan`,
            }),
            statCard({
                label: "Omzet bulan ini",
                value: rupiah(month.omzet),
                sub: `${month.count} pesanan dibayar`,
            }),
            statCard({
                label: "Estimasi komisi bulan ini",
                value: rupiah(commission(month.omzet, rate)),
                sub: rate ? `${String(rate).replace(".", ",")}% dari omzet` : "Persen komisi belum diatur atasan",
            })
        );

        const pace = monthlyGoal
            ? Math.round((monthlyGoal / daysInMonth()) * new Date(Date.now() + 7 * 3600000).getUTCDate())
            : 0;

        page.appendChild(el("section", { class: "erp-card" },
            el("div", { class: "erp-card__head" },
                el("h2", { text: "Target bulan ini" }),
                el("span", { class: "erp-muted", text: monthlyGoal ? rupiah(monthlyGoal) : "" })
            ),
            progressBar(monthPct, "Capaian target bulan ini"),
            monthlyGoal
                ? el("p", { class: "erp-muted", text:
                    month.omzet >= pace
                        ? "Kamu di atas laju target. Pertahankan! 💪"
                        : `Untuk tepat jalur, idealnya sudah ${rupiah(pace)} hari ini. Kurang ${rupiah(pace - month.omzet)}.` })
                : null
        ));

        page.appendChild(el("section", { class: "erp-card" },
            el("div", { class: "erp-card__head" }, el("h2", { text: "Omzetku 14 hari terakhir" })),
            barChart(dailySeries(orders, 14, new Date(), mine), { label: "Omzetku per hari, 14 hari terakhir" })
        ));
    } else if (team.size) {
        const teamMonth = sumOrders(orders, monthStart, team);
        stats.append(
            statCard({ label: "Omzet timku bulan ini", value: rupiah(teamMonth.omzet), sub: `${teamMonth.count} pesanan dibayar` }),
            statCard({ label: "Anggota di bawahku", value: String(team.size), sub: "langsung & tidak langsung" })
        );
    }

    const toDecide = approvals.filter((item) => item.approver_id === me.id && item.status === "menunggu").length;
    const myPending = approvals.filter((item) => item.requester_id === me.id && item.status === "menunggu").length;

    stats.append(statCard({
        label: "Persetujuan",
        value: toDecide ? `${toDecide} perlu kuputuskan` : "Tidak ada antrean",
        sub: myPending ? `${myPending} pengajuanku menunggu` : "Semua pengajuanku sudah diputus",
        tone: toDecide ? "alert" : "",
    }));

    // Gaji: disamarkan dulu, dibuka dengan sekali ketuk.
    if (salary) {
        const base = Number(salary.base_salary) || 0;
        const total = base + (isSales ? commission(monthOmzet, rate) : 0);
        const amount = el("p", { class: "erp-salary__amount", text: "Rp •••••••" });
        const toggle = el("button", { class: "erp-btn erp-btn--sm", type: "button" }, "Tampilkan");
        let shown = false;

        toggle.addEventListener("click", () => {
            shown = !shown;
            amount.textContent = shown ? rupiah(total) : "Rp •••••••";
            toggle.textContent = shown ? "Sembunyikan" : "Tampilkan";
        });

        page.appendChild(el("section", { class: "erp-card erp-salary" },
            el("div", { class: "erp-card__head" },
                el("div", {},
                    el("h2", { text: "Perkiraan penghasilanku bulan ini" }),
                    el("p", { class: "erp-muted", text: isSales ? "Gaji pokok + komisi berjalan" : "Gaji pokok" })
                ),
                toggle
            ),
            amount,
            el("p", { class: "erp-muted", text: "Hanya kamu, HR, dan owner yang bisa melihat angka ini." })
        ));
    }

    if (isSales) {
        const board = leaderboardPanel(ctx, { title: "Posisiku di papan peringkat" });
        page.appendChild(board.element);
        autoRefresh(ctx, board.refresh);
    }

    return page;
}

/**
 * KANTOONG ERP — RINGKASAN OWNER / EXECUTIVE COCKPIT (modul 18)
 * File: frontend/erp/modules/cockpit.js
 *
 * Seluruh perusahaan dalam satu layar: omzet, tren, omzet per tim,
 * sales terbaik, capaian target, persetujuan tertunda, jumlah orang.
 * Hanya untuk owner & direktur (level 4+).
 */

import { buildUnitTree, unitSubtreeIds } from "../core/org.js";
import { dailySeries, periodStart, progress, salesTotals, sumOrders } from "../core/metrics.js";
import { barChart, el, emptyState, hbarList, initials, pageHeader, rupiah, shortRupiah, statCard } from "../ui.js";
import { autoRefresh } from "./shared.js";

export async function render(ctx) {
    const { data } = ctx;
    const since30 = new Date(Date.now() - 30 * 86400000);
    const monthStart = periodStart("month");

    const [members, units, orders, targets, approvals] = await Promise.all([
        data.listMembers(),
        data.listUnits(),
        data.listOrders({ since: since30 < monthStart ? since30 : monthStart }),
        data.getTargets(),
        data.listApprovals(),
    ]);

    const active = members.filter((member) => member.is_active !== false);
    const sellers = active.filter((member) => member.job_role === "sales");
    const today = sumOrders(orders, periodStart("day"));
    const month = sumOrders(orders, monthStart);
    const monthGoal = targets
        .filter((target) => sellers.some((member) => member.id === target.member_id))
        .reduce((sum, target) => sum + (Number(target.monthly_target) || 0), 0);
    const pending = approvals.filter((item) => item.status === "menunggu").length;
    const unattributed = orders.filter((order) => !order.sales_member_id && new Date(order.created_at) >= monthStart);

    const page = el("div", { class: "erp-page__inner" });
    page.appendChild(pageHeader("Ringkasan Owner", "Seluruh perusahaan, diperbarui otomatis dari transaksi asli."));

    page.appendChild(el("div", { class: "erp-stats" },
        statCard({ label: "Omzet hari ini", value: rupiah(today.omzet), sub: `${today.count} pesanan dibayar` }),
        statCard({ label: "Omzet bulan ini", value: rupiah(month.omzet), sub: monthGoal ? `${progress(month.omzet, monthGoal)}% dari target ${shortRupiah(monthGoal)}` : `${month.count} pesanan` }),
        statCard({ label: "Rata-rata per pesanan", value: rupiah(month.average), sub: "bulan ini" }),
        statCard({ label: "Persetujuan tertunda", value: String(pending), sub: "di seluruh perusahaan", tone: pending ? "alert" : "" })
    ));

    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" }, el("h2", { text: "Omzet 30 hari terakhir" })),
        barChart(dailySeries(orders, 30), { label: "Omzet perusahaan per hari, 30 hari terakhir" })
    ));

    // ---------- Omzet per tim (berdasarkan unit sales) ----------
    const totals = salesTotals(orders, monthStart);
    const teamRows = [];
    const visit = (node) => {
        const ids = unitSubtreeIds(units, node.id);
        const inside = sellers.filter((member) => ids.has(member.org_unit_id));
        const leaf = !node.children.some((child) => sellers.some((member) => unitSubtreeIds(units, child.id).has(member.org_unit_id)));
        if (inside.length && leaf) {
            teamRows.push({
                label: node.name,
                value: inside.reduce((sum, member) => sum + (totals.get(member.id)?.omzet || 0), 0),
            });
        }
        node.children.forEach(visit);
    };
    buildUnitTree(units).forEach(visit);
    teamRows.sort((a, b) => b.value - a.value);

    // ---------- Sales terbaik bulan ini ----------
    const top = sellers
        .map((member) => ({ member, omzet: totals.get(member.id)?.omzet || 0, count: totals.get(member.id)?.count || 0 }))
        .sort((a, b) => b.omzet - a.omzet)
        .slice(0, 5);

    page.appendChild(el("div", { class: "erp-split erp-split--even" },
        el("section", { class: "erp-card" },
            el("div", { class: "erp-card__head" }, el("h2", { text: "Omzet per tim (bulan ini)" })),
            teamRows.length ? hbarList(teamRows) : emptyState("Belum ada tim sales.")
        ),
        el("section", { class: "erp-card" },
            el("div", { class: "erp-card__head" }, el("h2", { text: "5 sales terbaik bulan ini" })),
            top.length
                ? el("ol", { class: "erp-board__list" }, top.map((row, index) =>
                    el("li", { class: `erp-board__row${index < 3 ? ` is-top is-top-${index + 1}` : ""}` },
                        el("span", { class: "erp-board__rank", text: `#${index + 1}` }),
                        el("span", { class: "erp-avatar erp-avatar--sm", text: initials(row.member.full_name) }),
                        el("span", { class: "erp-board__name" },
                            el("strong", { text: row.member.full_name }),
                            el("small", { text: `${row.member.unit_name} · ${row.count} pesanan` })
                        ),
                        el("span", { class: "erp-board__value", text: rupiah(row.omzet) })
                    )
                ))
                : emptyState("Belum ada sales.")
        )
    ));

    // ---------- Orang per divisi ----------
    const divisions = buildUnitTree(units).flatMap((root) => (root.kind === "perusahaan" ? root.children : [root]));
    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" },
            el("h2", { text: "Orang per divisi" }),
            el("span", { class: "erp-muted", text: `${active.length} anggota aktif · ${sellers.length} sales` })
        ),
        divisions.length
            ? hbarList(divisions.map((division) => {
                const ids = unitSubtreeIds(units, division.id);
                const count = active.filter((member) => ids.has(member.org_unit_id)).length;
                return { label: division.name, value: count, display: `${count} orang` };
            }))
            : emptyState("Struktur organisasi belum dibuat.")
    ));

    if (unattributed.length) {
        page.appendChild(el("p", { class: "erp-muted erp-note", text: `${unattributed.length} pesanan bulan ini masuk dari toko utama (tanpa sales).` }));
    }

    autoRefresh(ctx, () => ctx.rerender());

    return page;
}

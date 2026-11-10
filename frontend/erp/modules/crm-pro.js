/**
 * KANTOONG ERP PRO — PIPELINE CRM (tab di CRM Pelanggan)
 * File: frontend/erp/modules/crm-pro.js
 *
 * Papan kolom per tahap (prospek → dihubungi → penawaran → negosiasi → menang/kalah).
 * Nilai berbobot peluang = perkiraan omzet yang realistis. Kalah WAJIB alasan
 * (jadi bahan belajar tim). Follow-up telat/hari ini ditampilkan paling atas.
 */

import { OPEN_STAGES, STAGES, chanceOf, followUps, lossReasons, pipelineSummary, stuckDeals } from "../core/crm-pro.js";
import { el, emptyState, formDialog, friendlyError, rupiah, shortRupiah, statCard, toast } from "../ui.js";
import { invalidateProData } from "./pro-data.js";

export const CRM_PRO_TABS = [
    { value: "pelanggan", label: "Pelanggan" },
    { value: "pipeline", label: "Pipeline penjualan" },
];

const when = (iso) => (iso ? new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "");

export async function pipelineView(ctx) {
    const { data, me } = ctx;
    const [deals, members] = await Promise.all([
        data.listDeals?.().catch(() => []) ?? [],
        data.listMembers().catch(() => []),
    ]);
    const nameOf = (id) => members.find((m) => m.id === id)?.full_name || "—";
    const sum = pipelineSummary(deals);
    const due = followUps(deals);
    const stuck = new Set(stuckDeals(deals).map((d) => d.id));
    const lessons = lossReasons(deals).slice(0, 3);
    const wrap = el("div", { class: "erp-stack" });

    wrap.appendChild(el("section", { class: "erp-stats" },
        statCard({ label: "Pipeline terbuka", value: shortRupiah(sum.openValue), sub: `${deals.filter((d) => OPEN_STAGES.includes(d.stage)).length} calon pelanggan` }),
        statCard({ label: "Perkiraan omzet", value: shortRupiah(sum.forecast), sub: "nilai × peluang tiap tahap" }),
        statCard({ label: "Sudah menang", value: shortRupiah(sum.wonValue) }),
        statCard({ label: "Tingkat menang", value: sum.winRate == null ? "—" : `${sum.winRate}%`, sub: "dari yang sudah selesai" })));

    const urgent = [...due.telat, ...due.hariIni];
    if (urgent.length) {
        wrap.appendChild(el("section", { class: "erp-card erp-card--attention" },
            el("h2", { text: `Follow-up hari ini (${urgent.length})` }),
            el("ul", { class: "erp-list" }, urgent.map((d) => el("li", { class: "erp-list__row" },
                el("div", {},
                    el("strong", { text: `${d.customer} · ${d.next_action || "Hubungi"}` }),
                    el("small", { class: "erp-muted", text: `${nameOf(d.owner_id)} · ${when(d.next_action_at)}` })),
                el("span", { class: `erp-pill erp-pill--${due.telat.includes(d) ? "bad" : "warn"}`, text: due.telat.includes(d) ? "Telat" : "Hari ini" }))))));
    }

    wrap.appendChild(el("div", { class: "erp-toolbar" },
        el("p", { class: "erp-muted", text: me.level >= 3 ? "Semua calon pelanggan tim. Geser tahap lewat tombol di tiap kartu." : "Calon pelanggan milikmu." }),
        el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => editDeal(ctx, null) }, "+ Calon pelanggan")));

    if (!deals.length) {
        wrap.appendChild(emptyState("Belum ada calon pelanggan. Jalankan db/erp-pro.sql bila memakai data asli."));
        return wrap;
    }

    wrap.appendChild(el("div", { class: "erp-kanban", role: "list" }, STAGES.map((stage) => {
        const items = deals.filter((d) => d.stage === stage.key);
        return el("section", { class: `erp-kanban__col erp-kanban__col--${stage.key}`, role: "listitem" },
            el("header", { class: "erp-kanban__head" },
                el("strong", { text: stage.label }),
                el("small", { text: `${items.length} · ${shortRupiah(items.reduce((n, d) => n + (Number(d.value) || 0), 0))}${OPEN_STAGES.includes(stage.key) ? ` · ${stage.chance}%` : ""}` })),
            items.length
                ? items.map((d) => dealCard(ctx, d, nameOf, stuck.has(d.id)))
                : el("p", { class: "erp-kanban__empty", text: "—" }));
    })));

    if (lessons.length) {
        wrap.appendChild(el("section", { class: "erp-card" },
            el("h2", { text: "Pelajaran dari yang kalah" }),
            el("ul", { class: "erp-list" }, lessons.map((l) => el("li", { class: "erp-list__row" },
                el("span", { text: l.reason }), el("strong", { text: `${l.count}×` }))))));
    }
    return wrap;
}

function dealCard(ctx, deal, nameOf, isStuck) {
    const index = STAGES.findIndex((s) => s.key === deal.stage);
    const open = OPEN_STAGES.includes(deal.stage);
    const next = open ? STAGES[index + 1] : null;
    return el("article", { class: `erp-deal${isStuck ? " is-stuck" : ""}` },
        el("strong", { class: "erp-deal__title", text: deal.title }),
        el("span", { class: "erp-deal__customer", text: deal.customer }),
        el("span", { class: "erp-deal__value", text: rupiah(deal.value) }),
        open && deal.next_action ? el("small", { class: "erp-deal__next", text: `➜ ${deal.next_action}${deal.next_action_at ? ` · ${when(deal.next_action_at)}` : ""}` }) : null,
        deal.stage === "kalah" && deal.lost_reason ? el("small", { class: "erp-deal__next", text: `Alasan: ${deal.lost_reason}` }) : null,
        isStuck ? el("small", { class: "erp-deal__stuck", text: "Diam > 7 hari" }) : null,
        el("small", { class: "erp-muted", text: nameOf(deal.owner_id) }),
        open ? el("div", { class: "erp-deal__actions" },
            el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => editDeal(ctx, deal) }, "Ubah"),
            el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => lose(ctx, deal) }, "Kalah"),
            next ? el("button", { class: "erp-btn erp-btn--sm erp-btn--primary", type: "button", onclick: () => move(ctx, deal, next.key) }, next.key === "menang" ? "Menang ✓" : `→ ${next.label}`) : null) : null);
}

async function move(ctx, deal, stage, reason = "") {
    try {
        await ctx.data.moveDeal(deal.id, stage, reason);
        invalidateProData();
        toast(stage === "menang" ? "Selamat! Deal dimenangkan. 🎉" : `Dipindah ke ${STAGES.find((s) => s.key === stage)?.label}. Peluang ${chanceOf(stage)}%.`);
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

async function lose(ctx, deal) {
    const values = await formDialog({
        title: `Tandai kalah · ${deal.customer}`,
        submitLabel: "Simpan",
        fields: [{ name: "reason", label: "Alasan kalah (wajib, untuk pelajaran tim)", required: true, max: 200, placeholder: "contoh: harga lebih mahal dari pesaing" }],
    });
    if (!values) return;
    move(ctx, deal, "kalah", values.reason);
}

async function editDeal(ctx, deal) {
    const local = (iso) => (iso ? new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 16) : "");
    const values = await formDialog({
        title: deal ? "Ubah calon pelanggan" : "Calon pelanggan baru",
        fields: [
            { name: "customer", label: "Nama calon pelanggan / perusahaan", required: true, max: 80, value: deal?.customer ?? "" },
            { name: "title", label: "Kebutuhan / judul deal", max: 80, value: deal?.title ?? "", placeholder: "contoh: Langganan kopi kantor" },
            { name: "value", label: "Perkiraan nilai (Rp)", type: "number", min: 0, step: 1000, value: deal?.value ?? "" },
            { name: "next_action", label: "Langkah berikutnya", max: 120, value: deal?.next_action ?? "", placeholder: "contoh: Kirim penawaran harga" },
            { name: "next_action_at", label: "Kapan", type: "datetime-local", value: local(deal?.next_action_at) },
        ],
    });
    if (!values) return;
    try {
        await ctx.data.saveDeal({
            ...values,
            id: deal?.id,
            next_action_at: values.next_action_at ? new Date(`${values.next_action_at}:00+07:00`).toISOString() : null,
        });
        invalidateProData();
        toast("Tersimpan.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

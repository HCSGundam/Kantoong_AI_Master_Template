/**
 * KANTOONG ERP — PERSETUJUAN & AUDIT (modul 3)
 * File: frontend/erp/modules/approvals.js
 *
 * Pengajuan (diskon, cuti, pengeluaran, retur) otomatis masuk ke
 * atasan langsung. Owner/direktur bisa melihat jejak audit: siapa
 * mengubah apa dan kapan.
 */

import { dateTime, el, emptyState, formDialog, friendlyError, pageHeader, rupiah, segmented, toast } from "../ui.js";
import { APPROVAL_KINDS, chainProgress, currentApprover, isOverdue, stepLabel } from "../core/approval-chain.js";
import { rulesView, delegationsView } from "./approvals-pro.js";

const KINDS = APPROVAL_KINDS;

const STATUS = Object.freeze({
    menunggu: { label: "Menunggu", tone: "warn" },
    disetujui: { label: "Disetujui", tone: "good" },
    ditolak: { label: "Ditolak", tone: "bad" },
});

const TABLES = Object.freeze({
    org_units: "Struktur organisasi",
    members: "Anggota",
    member_targets: "Target & komisi",
    member_salary: "Gaji",
    products: "Katalog produk",
    storefronts: "Toko sales",
    approvals: "Persetujuan",
});

let tab = "decide";

export async function render(ctx) {
    const { data, me } = ctx;
    const [items, members] = await Promise.all([data.listApprovals(), data.listMembers()]);
    const nameOf = (id) => members.find((member) => member.id === id)?.full_name || "—";

    // Giliranku sekarang + yang pernah kuputuskan (riwayat), dari rantai berjenjang.
    const turnOf = (item) => currentApprover(item) ?? item.approver_id;
    const toDecide = items.filter((item) => item.requester_id !== me.id && (
        (item.status === "menunggu" && turnOf(item) === me.id)
        || (item.chain || []).some((step) => step.decided_by === me.id || (step.approver_id === me.id && step.decision))
        || (!(item.chain || []).length && item.approver_id === me.id)));
    const mine = items.filter((item) => item.requester_id === me.id);
    const waiting = toDecide.filter((item) => item.status === "menunggu" && turnOf(item) === me.id).length;

    const tabs = [
        { value: "decide", label: `Perlu kuputuskan${waiting ? ` (${waiting})` : ""}` },
        { value: "mine", label: "Pengajuanku" },
    ];
    if (me.level >= 5) tabs.push({ value: "all", label: "Semua" });
    tabs.push({ value: "rules", label: "Aturan berjenjang" });
    if (me.level >= 2) tabs.push({ value: "delegate", label: "Delegasi" });
    if (me.level >= 4) tabs.push({ value: "audit", label: "Jejak audit" });
    if (!tabs.some((entry) => entry.value === tab)) tab = "decide";

    const page = el("div", { class: "erp-page__inner" });

    page.appendChild(pageHeader(
        "Persetujuan & Audit",
        "Pengajuan otomatis berjalan berjenjang sesuai jenis & nominal: atasan → keuangan → owner.",
        el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => newRequest(ctx) }, "+ Buat pengajuan")
    ));

    page.appendChild(segmented(tabs, tab, (value) => {
        tab = value;
        ctx.rerender();
    }));

    if (tab === "audit") {
        page.appendChild(await auditView(ctx, nameOf));
        return page;
    }
    if (tab === "rules") {
        page.appendChild(await rulesView(ctx));
        return page;
    }
    if (tab === "delegate") {
        page.appendChild(await delegationsView(ctx, members));
        return page;
    }

    const list = tab === "decide" ? toDecide : tab === "mine" ? mine : items;

    if (!list.length) {
        page.appendChild(emptyState(tab === "decide" ? "Tidak ada pengajuan yang perlu kamu putuskan." : "Belum ada pengajuan."));
        return page;
    }

    page.appendChild(el("div", { class: "erp-approvals" },
        list.map((item) => {
            const status = STATUS[item.status] || STATUS.menunggu;
            const canDecide = item.status === "menunggu" && (turnOf(item) === me.id || me.level >= 5)
                && (item.requester_id !== me.id || me.level >= 5);
            const progress = chainProgress(item);
            const late = isOverdue(item);

            return el("article", { class: "erp-card erp-approval" },
                el("div", { class: "erp-approval__top" },
                    el("span", { class: "erp-tag", text: KINDS[item.kind] || item.kind }),
                    el("span", { class: `erp-pill erp-pill--${status.tone}`, text: status.label })
                ),
                el("h3", { text: item.title }),
                item.amount ? el("p", { class: "erp-approval__amount", text: rupiah(item.amount) }) : null,
                item.note ? el("p", { class: "erp-muted", text: item.note }) : null,
                el("p", { class: "erp-approval__meta", text: `Diajukan ${nameOf(item.requester_id)} · ${dateTime(item.created_at)}` }),
                chainSteps(item, nameOf),
                el("p", { class: "erp-approval__progress" }, progress.label, late ? el("span", { class: "erp-pill erp-pill--bad", text: "Menunggu > 24 jam" }) : null),
                item.decision_note ? el("p", { class: "erp-approval__decision", text: `Catatan keputusan: ${item.decision_note}` }) : null,
                canDecide
                    ? el("div", { class: "erp-approval__actions" },
                        el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => decide(ctx, item, "ditolak") }, "Tolak"),
                        el("button", { class: "erp-btn erp-btn--sm erp-btn--primary", type: "button", onclick: () => decide(ctx, item, "disetujui") }, "Setujui")
                    )
                    : null
            );
        })
    ));

    return page;
}

/** Rantai penyetuju: ✓ sudah, ● giliran sekarang, ○ menunggu giliran, ✕ ditolak. */
function chainSteps(item, nameOf) {
    const chain = item.chain || [];
    if (!chain.length) return null;
    const turn = item.status === "menunggu" ? chain.findIndex((step) => !step.decision) : -1;
    return el("ol", { class: "erp-chain", "aria-label": "Rantai persetujuan" },
        chain.map((step, index) => {
            const state = step.decision === "disetujui" ? "done" : step.decision === "ditolak" ? "rejected" : index === turn ? "now" : "next";
            const mark = { done: "✓", rejected: "✕", now: "●", next: "○" }[state];
            const delegated = step.original_id && step.original_id !== step.approver_id ? ` (wakil ${nameOf(step.original_id)})` : "";
            return el("li", { class: `erp-chain__step is-${state}`, title: step.note || "" },
                el("span", { class: "erp-chain__mark", text: mark }),
                el("span", { class: "erp-chain__text" },
                    el("strong", { text: nameOf(step.approver_id) + delegated }),
                    el("small", { text: stepLabel(step.step) + (step.at ? ` · ${dateTime(step.at)}` : "") })));
        }));
}

async function auditView(ctx, nameOf) {
    const rows = await ctx.data.listAudit();

    if (!rows.length) return emptyState("Belum ada perubahan tercatat.");

    const summarize = (changes) => {
        if (!changes || typeof changes !== "object") return "-";
        return Object.keys(changes)
            .filter((key) => !["id", "created_at", "updated_at"].includes(key))
            .slice(0, 4)
            .join(", ") || "-";
    };

    return el("section", { class: "erp-card" },
        el("div", { class: "erp-table-wrap" },
            el("table", { class: "erp-table" },
                el("thead", {}, el("tr", {}, ["Waktu", "Pelaku", "Bagian", "Aksi", "Yang berubah"].map((head) => el("th", { text: head })))),
                el("tbody", {}, rows.map((row) => el("tr", {},
                    el("td", { "data-label": "Waktu", text: dateTime(row.at) }),
                    el("td", { "data-label": "Pelaku", text: nameOf(row.actor_id) }),
                    el("td", { "data-label": "Bagian", text: TABLES[row.table_name] || row.table_name }),
                    el("td", { "data-label": "Aksi", text: { INSERT: "Tambah", UPDATE: "Ubah", DELETE: "Hapus" }[row.action] || row.action }),
                    el("td", { "data-label": "Yang berubah", text: row.table_name === "member_salary" ? "(dirahasiakan)" : summarize(row.changes) })
                )))
            )
        )
    );
}

async function newRequest(ctx) {
    const values = await formDialog({
        title: "Buat pengajuan",
        submitLabel: "Kirim pengajuan",
        fields: [
            { name: "kind", label: "Jenis", type: "select", options: Object.entries(KINDS).map(([value, label]) => ({ value, label })) },
            { name: "title", label: "Judul", required: true, max: 120, placeholder: "contoh: Diskon 10% untuk pembelian 40 botol" },
            { name: "amount", label: "Nominal (Rp, opsional)", type: "number", min: 0, step: 1000 },
            { name: "note", label: "Alasan / catatan", type: "textarea", max: 500 },
        ],
    });

    if (!values) return;

    if (values.title.trim().length < 3) {
        toast("Judul pengajuan terlalu pendek.", "error");
        return;
    }

    try {
        await ctx.data.createApproval({
            kind: values.kind,
            title: values.title.trim(),
            amount: values.amount ? Math.round(Number(values.amount)) : null,
            note: values.note.trim() || null,
        });
        const chain = await ctx.data.previewChain?.({ kind: values.kind, amount: values.amount ? Number(values.amount) : 0 }).catch(() => []);
        const members = await ctx.data.listMembers().catch(() => []);
        const names = (chain || []).map((step) => members.find((m) => m.id === step.approver_id)?.full_name).filter(Boolean);
        toast(names.length ? `Pengajuan terkirim. Alurnya: ${names.join(" → ")}.` : "Pengajuan terkirim.");
        tab = "mine";
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

async function decide(ctx, item, status) {
    const values = await formDialog({
        title: status === "disetujui" ? "Setujui pengajuan" : "Tolak pengajuan",
        submitLabel: status === "disetujui" ? "Setujui" : "Tolak",
        fields: [{ name: "note", label: "Catatan untuk pengaju (opsional)", type: "textarea", max: 300 }],
    });

    if (!values) return;

    try {
        await ctx.data.decideApproval(item.id, status, values.note.trim());
        toast(status === "disetujui" ? "Pengajuan disetujui." : "Pengajuan ditolak.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

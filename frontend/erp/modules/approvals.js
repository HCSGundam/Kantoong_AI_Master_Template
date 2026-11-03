/**
 * KANTOONG ERP — PERSETUJUAN & AUDIT (modul 3)
 * File: frontend/erp/modules/approvals.js
 *
 * Pengajuan (diskon, cuti, pengeluaran, retur) otomatis masuk ke
 * atasan langsung. Owner/direktur bisa melihat jejak audit: siapa
 * mengubah apa dan kapan.
 */

import { dateTime, el, emptyState, formDialog, friendlyError, pageHeader, rupiah, segmented, toast } from "../ui.js";

const KINDS = Object.freeze({
    diskon: "Diskon khusus",
    cuti: "Cuti / izin",
    pengeluaran: "Pengeluaran",
    retur: "Retur barang",
    lainnya: "Lainnya",
});

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

    const toDecide = items.filter((item) => item.approver_id === me.id);
    const mine = items.filter((item) => item.requester_id === me.id);
    const waiting = toDecide.filter((item) => item.status === "menunggu").length;

    const tabs = [
        { value: "decide", label: `Perlu kuputuskan${waiting ? ` (${waiting})` : ""}` },
        { value: "mine", label: "Pengajuanku" },
    ];
    if (me.level >= 5) tabs.push({ value: "all", label: "Semua" });
    if (me.level >= 4) tabs.push({ value: "audit", label: "Jejak audit" });
    if (!tabs.some((entry) => entry.value === tab)) tab = "decide";

    const page = el("div", { class: "erp-page__inner" });

    page.appendChild(pageHeader(
        "Persetujuan & Audit",
        "Pengajuanmu otomatis masuk ke atasan langsung.",
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

    const list = tab === "decide" ? toDecide : tab === "mine" ? mine : items;

    if (!list.length) {
        page.appendChild(emptyState(tab === "decide" ? "Tidak ada pengajuan yang perlu kamu putuskan." : "Belum ada pengajuan."));
        return page;
    }

    page.appendChild(el("div", { class: "erp-approvals" },
        list.map((item) => {
            const status = STATUS[item.status] || STATUS.menunggu;
            const canDecide = item.status === "menunggu" && (item.approver_id === me.id || me.level >= 5);

            return el("article", { class: "erp-card erp-approval" },
                el("div", { class: "erp-approval__top" },
                    el("span", { class: "erp-tag", text: KINDS[item.kind] || item.kind }),
                    el("span", { class: `erp-pill erp-pill--${status.tone}`, text: status.label })
                ),
                el("h3", { text: item.title }),
                item.amount ? el("p", { class: "erp-approval__amount", text: rupiah(item.amount) }) : null,
                item.note ? el("p", { class: "erp-muted", text: item.note }) : null,
                el("p", { class: "erp-approval__meta", text: `${nameOf(item.requester_id)} → ${nameOf(item.approver_id)} · ${dateTime(item.created_at)}` }),
                item.decision_note ? el("p", { class: "erp-approval__decision", text: `Catatan atasan: ${item.decision_note}` }) : null,
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
        submitLabel: "Kirim ke atasan",
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
        toast("Pengajuan terkirim ke atasanmu.");
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

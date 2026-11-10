/**
 * KANTOONG ERP PRO — ATURAN BERJENJANG & DELEGASI (tab di Persetujuan)
 * File: frontend/erp/modules/approvals-pro.js
 *
 * Owner menyusun aturan: jenis + nominal minimal → rantai penyetuju.
 * Semua orang bisa MEMBACA aturannya (transparan: "kenapa pengajuanku ke owner?").
 * Atasan bisa mendelegasikan hak menyetujui saat cuti.
 */

import { APPROVAL_KINDS, stepLabel, validateRule } from "../core/approval-chain.js";
import { el, emptyState, formDialog, friendlyError, rupiah, toast } from "../ui.js";

const STEP_OPTIONS = [
    { value: "", label: "— (tidak ada)" },
    { value: "atasan", label: "Atasan langsung" },
    { value: "level:3", label: "Manajer (level 3+)" },
    { value: "level:4", label: "Direktur (level 4+)" },
    { value: "role:keuangan", label: "Bagian keuangan" },
    { value: "role:hr", label: "Bagian HR" },
    { value: "role:gudang", label: "Bagian gudang" },
    { value: "owner", label: "Owner" },
];

export async function rulesView(ctx) {
    const { data, me } = ctx;
    const rules = await data.listApprovalRules?.().catch(() => []) ?? [];
    const canEdit = me.level >= 5;

    const wrap = el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" },
            el("div", {},
                el("h2", { text: "Aturan persetujuan berjenjang" }),
                el("p", { class: "erp-muted", text: canEdit
                    ? "Atur siapa saja yang harus menyetujui, berdasarkan jenis & nominal. Aturan dengan nominal minimal terbesar yang cocok yang dipakai."
                    : "Aturan dari owner. Pengajuanmu otomatis mengikuti rantai ini." })),
            canEdit ? el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => editRule(ctx, rules, null) }, "+ Aturan") : null));

    if (!rules.length) {
        wrap.appendChild(emptyState("Aturan belum tersedia. Jalankan db/erp-pro.sql di Supabase."));
        return wrap;
    }

    Object.entries(APPROVAL_KINDS).forEach(([kind, label]) => {
        const own = rules.filter((r) => r.kind === kind).sort((a, b) => a.min_amount - b.min_amount);
        if (!own.length) return;
        wrap.appendChild(el("div", { class: "erp-rules" },
            el("h3", { class: "erp-rules__kind", text: label }),
            own.map((rule) => el("div", { class: "erp-rule" },
                el("span", { class: "erp-rule__min", text: rule.min_amount > 0 ? `≥ ${rupiah(rule.min_amount)}` : "Semua nominal" }),
                el("span", { class: "erp-rule__chain" },
                    rule.steps.map((step, i) => [i ? el("span", { class: "erp-rule__arrow", text: "→" }) : null, el("span", { class: "erp-tag", text: stepLabel(step) })])),
                canEdit ? el("span", { class: "erp-rule__actions" },
                    el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => editRule(ctx, rules, rule) }, "Ubah"),
                    el("button", { class: "erp-btn erp-btn--sm erp-btn--ghost", type: "button", onclick: () => removeRule(ctx, rules, rule) }, "Hapus")) : null
            ))
        ));
    });
    return wrap;
}

async function editRule(ctx, rules, rule) {
    const steps = rule?.steps ?? ["atasan"];
    const values = await formDialog({
        title: rule ? "Ubah aturan" : "Aturan baru",
        fields: [
            { name: "kind", label: "Jenis pengajuan", type: "select", value: rule?.kind ?? "pengeluaran", options: Object.entries(APPROVAL_KINDS).map(([value, label]) => ({ value, label })) },
            { name: "min_amount", label: "Berlaku mulai nominal (Rp)", type: "number", min: 0, step: 1000, value: rule?.min_amount ?? 0 },
            ...[0, 1, 2, 3, 4].map((i) => ({
                name: `s${i}`, label: `Langkah ${i + 1}`, type: "select", value: steps[i] ?? "", options: i === 0 ? STEP_OPTIONS.slice(1) : STEP_OPTIONS,
            })),
        ],
    });
    if (!values) return;
    const next = {
        id: rule?.id,
        kind: values.kind,
        min_amount: Math.round(Number(values.min_amount) || 0),
        steps: [0, 1, 2, 3, 4].map((i) => values[`s${i}`]).filter(Boolean),
    };
    const problem = validateRule(next);
    if (problem) return toast(problem, "error");
    const list = rule ? rules.map((r) => (r.id === rule.id ? next : r)) : [...rules, next];
    try {
        await ctx.data.saveApprovalRules(list);
        toast("Aturan disimpan. Pengajuan baru langsung mengikuti aturan ini.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

async function removeRule(ctx, rules, rule) {
    if (!window.confirm("Hapus aturan ini? Pengajuan baru akan memakai aturan lain yang cocok (atau atasan langsung).")) return;
    try {
        await ctx.data.saveApprovalRules(rules.filter((r) => r.id !== rule.id));
        toast("Aturan dihapus.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

export async function delegationsView(ctx, members) {
    const { data, me } = ctx;
    const list = await data.listDelegations?.().catch(() => []) ?? [];
    const nameOf = (id) => members.find((m) => m.id === id)?.full_name || "—";
    const today = new Date().toISOString().slice(0, 10);

    return el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" },
            el("div", {},
                el("h2", { text: "Delegasi persetujuan" }),
                el("p", { class: "erp-muted", text: "Sedang cuti atau dinas? Serahkan hak menyetujui ke orang lain selama tanggal tertentu. Semua keputusannya tetap tercatat atas nama wakilmu." })),
            el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => addDelegation(ctx, members) }, "+ Delegasi")),
        list.length
            ? el("ul", { class: "erp-list" }, list.map((d) => el("li", { class: "erp-list__row" },
                el("div", {},
                    el("strong", { text: `${nameOf(d.from_id)} → ${nameOf(d.to_id)}` }),
                    el("small", { class: "erp-muted", text: `${d.starts} s.d. ${d.ends}${d.starts <= today && today <= d.ends ? " · aktif hari ini" : ""}` })),
                d.from_id === me.id || me.level >= 5
                    ? el("button", { class: "erp-btn erp-btn--sm erp-btn--ghost", type: "button", onclick: async () => {
                        try {
                            await data.removeDelegation(d.id);
                            ctx.rerender();
                        } catch (error) {
                            toast(friendlyError(error), "error");
                        }
                    } }, "Cabut")
                    : null)))
            : emptyState("Belum ada delegasi."));
}

async function addDelegation(ctx, members) {
    const today = new Date().toISOString().slice(0, 10);
    const values = await formDialog({
        title: "Delegasikan hak menyetujui",
        submitLabel: "Simpan delegasi",
        fields: [
            { name: "to_id", label: "Diwakilkan ke", type: "select", options: members.filter((m) => m.id !== ctx.me.id && m.is_active !== false && m.level >= 2).map((m) => ({ value: m.id, label: `${m.full_name} · ${m.position_title}` })) },
            { name: "starts", label: "Mulai", type: "date", value: today, required: true },
            { name: "ends", label: "Sampai", type: "date", value: today, required: true },
        ],
    });
    if (!values) return;
    try {
        await ctx.data.saveDelegation(values);
        toast("Delegasi aktif. Pengajuan baru di rentang itu masuk ke wakilmu.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

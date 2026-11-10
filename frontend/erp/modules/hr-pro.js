/**
 * KANTOONG ERP PRO — SDM PRO (tab di HR & Absensi)
 * File: frontend/erp/modules/hr-pro.js
 *
 * Cuti (sisa kuota + pengajuan berjenjang atasan → HR), kontrak kerja
 * (pengingat habis & masa percobaan), penilaian kinerja 5 kriteria.
 */

import { CONTRACT_TYPES, LEAVE_TYPES, REVIEW_CRITERIA, contractAlerts, leaveBalance, reviewScore, validateLeave } from "../core/hr-pro.js";
import { hasRole, subtreeIds } from "../core/org.js";
import { el, emptyState, formDialog, friendlyError, statCard, toast } from "../ui.js";
import { invalidateProData } from "./pro-data.js";

export const HR_PRO_TABS = [
    { value: "absensi", label: "Absensi" },
    { value: "cuti", label: "Cuti" },
    { value: "kontrak", label: "Kontrak" },
    { value: "kinerja", label: "Kinerja" },
];

const fmtDay = (day) => (day ? new Date(`${day}T00:00:00+07:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "—");
const STATUS_TONE = { menunggu: "warn", disetujui: "good", ditolak: "bad" };

export async function hrProView(ctx, tab, members) {
    if (tab === "cuti") return leaveView(ctx, members);
    if (tab === "kontrak") return contractView(ctx, members);
    return reviewView(ctx, members);
}

async function leaveView(ctx, members) {
    const { data, me } = ctx;
    const leaves = await data.listLeaves?.().catch(() => []) ?? [];
    const year = new Date().getFullYear();
    const mine = leaveBalance(me.id, leaves, year);
    const nameOf = (id) => members.find((m) => m.id === id)?.full_name || "—";
    const wrap = el("div", { class: "erp-stack" });

    wrap.appendChild(el("section", { class: "erp-stats" },
        statCard({ label: `Sisa cuti tahunan ${year}`, value: `${mine.left} hari`, sub: `Kuota ${mine.quota} · terpakai/diajukan ${mine.used}`, tone: mine.left <= 2 ? "warn" : "" }),
        statCard({ label: "Menunggu persetujuan", value: String(leaves.filter((l) => l.status === "menunggu").length) })));

    wrap.appendChild(el("div", { class: "erp-toolbar" },
        el("p", { class: "erp-muted", text: "Cuti otomatis jadi pengajuan berjenjang (atasan → HR). Hanya hari kerja Senin–Jumat yang dihitung." }),
        el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => requestLeave(ctx, mine) }, "+ Ajukan cuti")));

    if (!leaves.length) {
        wrap.appendChild(emptyState("Belum ada catatan cuti."));
        return wrap;
    }
    wrap.appendChild(el("section", { class: "erp-card" }, el("div", { class: "erp-table-wrap" }, el("table", { class: "erp-table" },
        el("thead", {}, el("tr", {}, ["Nama", "Jenis", "Tanggal", "Hari", "Status"].map((h) => el("th", { text: h })))),
        el("tbody", {}, [...leaves].sort((a, b) => b.starts.localeCompare(a.starts)).map((l) => el("tr", {},
            el("td", { "data-label": "Nama", text: nameOf(l.member_id) }),
            el("td", { "data-label": "Jenis", text: LEAVE_TYPES[l.kind]?.label || l.kind }),
            el("td", { "data-label": "Tanggal", text: `${fmtDay(l.starts)} – ${fmtDay(l.ends)}` }),
            el("td", { "data-label": "Hari", class: "erp-num", text: String(l.days) }),
            el("td", { "data-label": "Status" }, el("span", { class: `erp-pill erp-pill--${STATUS_TONE[l.status] || "warn"}`, text: l.status })))))))));
    return wrap;
}

async function requestLeave(ctx, balance) {
    const today = new Date().toISOString().slice(0, 10);
    const values = await formDialog({
        title: "Ajukan cuti",
        submitLabel: "Kirim pengajuan",
        fields: [
            { name: "kind", label: "Jenis", type: "select", options: Object.entries(LEAVE_TYPES).map(([value, t]) => ({ value, label: t.label })) },
            { name: "starts", label: "Mulai", type: "date", value: today, required: true },
            { name: "ends", label: "Sampai", type: "date", value: today, required: true },
            { name: "reason", label: "Alasan", type: "textarea", max: 200 },
        ],
    });
    if (!values) return;
    const problem = validateLeave(values);
    if (problem) return toast(problem, "error");
    if (values.kind === "tahunan" && balance.left <= 0) return toast("Sisa cuti tahunanmu sudah habis.", "error");
    try {
        await ctx.data.requestLeave(values);
        invalidateProData();
        toast("Pengajuan cuti terkirim ke atasan.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

async function contractView(ctx, members) {
    const { data, me } = ctx;
    const contracts = await data.listContracts?.().catch(() => []) ?? [];
    const isHr = hasRole(me, "hr");
    const alerts = contractAlerts(contracts);
    const nameOf = (id) => members.find((m) => m.id === id)?.full_name || "—";
    const wrap = el("div", { class: "erp-stack" });

    if (alerts.length) {
        wrap.appendChild(el("section", { class: "erp-card erp-card--attention" },
            el("h2", { text: "Perlu keputusan" }),
            el("ul", { class: "erp-list" }, alerts.map((a) => el("li", { class: "erp-list__row" },
                el("strong", { text: nameOf(a.member_id) }),
                el("span", { class: `erp-pill erp-pill--${a.alert === "habis" ? "bad" : "warn"}`, text: a.alert === "habis" ? `Kontrak habis ${-a.left} hari lalu` : a.alert === "segera" ? `Kontrak habis ${a.left} hari lagi` : `Percobaan selesai ${a.left} hari lagi` }))))));
    }

    wrap.appendChild(el("div", { class: "erp-toolbar" },
        el("p", { class: "erp-muted", text: isHr ? "Pengingat muncul 30 hari sebelum kontrak habis dan 14 hari sebelum masa percobaan selesai." : "Kontrak kerjamu." }),
        isHr ? el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => editContract(ctx, members, null) }, "+ Kontrak") : null));

    if (!contracts.length) {
        wrap.appendChild(emptyState("Belum ada data kontrak."));
        return wrap;
    }
    wrap.appendChild(el("section", { class: "erp-card" }, el("div", { class: "erp-table-wrap" }, el("table", { class: "erp-table" },
        el("thead", {}, el("tr", {}, ["Nama", "Jenis", "Mulai", "Selesai", "Percobaan s.d.", ""].map((h) => el("th", { text: h })))),
        el("tbody", {}, contracts.map((c) => el("tr", {},
            el("td", { "data-label": "Nama", text: nameOf(c.member_id) }),
            el("td", { "data-label": "Jenis", text: CONTRACT_TYPES[c.type] || c.type }),
            el("td", { "data-label": "Mulai", text: fmtDay(c.starts_on) }),
            el("td", { "data-label": "Selesai", text: c.ends_on ? fmtDay(c.ends_on) : "Tidak terbatas" }),
            el("td", { "data-label": "Percobaan s.d.", text: fmtDay(c.probation_ends_on) }),
            el("td", { "data-label": "" }, isHr ? el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => editContract(ctx, members, c) }, "Ubah") : null))))))));
    return wrap;
}

async function editContract(ctx, members, contract) {
    const values = await formDialog({
        title: contract ? "Ubah kontrak" : "Kontrak baru",
        fields: [
            { name: "member_id", label: "Anggota", type: "select", value: contract?.member_id, options: members.filter((m) => m.is_active !== false).map((m) => ({ value: m.id, label: m.full_name })) },
            { name: "type", label: "Jenis", type: "select", value: contract?.type ?? "pkwt", options: Object.entries(CONTRACT_TYPES).map(([value, label]) => ({ value, label })) },
            { name: "starts_on", label: "Mulai", type: "date", value: contract?.starts_on ?? "" },
            { name: "ends_on", label: "Selesai (kosongkan bila tetap)", type: "date", value: contract?.ends_on ?? "" },
            { name: "probation_ends_on", label: "Masa percobaan s.d. (opsional)", type: "date", value: contract?.probation_ends_on ?? "" },
        ],
    });
    if (!values) return;
    try {
        await ctx.data.saveContract({ ...values, id: contract?.id });
        invalidateProData();
        toast("Kontrak disimpan.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

async function reviewView(ctx, members) {
    const { data, me } = ctx;
    const reviews = await data.listReviews?.().catch(() => []) ?? [];
    const nameOf = (id) => members.find((m) => m.id === id)?.full_name || "—";
    const reviewable = hasRole(me, "hr")
        ? members.filter((m) => m.id !== me.id && m.is_active !== false)
        : members.filter((m) => subtreeIds(members, me.id).has(m.id) && m.id !== me.id && m.level < me.level);
    const wrap = el("div", { class: "erp-stack" });

    wrap.appendChild(el("div", { class: "erp-toolbar" },
        el("p", { class: "erp-muted", text: "5 kriteria berbobot: kehadiran 20%, target 30%, kualitas 25%, kerja sama 15%, inisiatif 10%. Yang dinilai bisa melihat nilainya sendiri." }),
        reviewable.length ? el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => newReview(ctx, reviewable) }, "+ Nilai anggota") : null));

    if (!reviews.length) {
        wrap.appendChild(emptyState("Belum ada penilaian."));
        return wrap;
    }
    wrap.appendChild(el("div", { class: "erp-reviews" }, reviews.map((r) => {
        const s = reviewScore(r.scores);
        return el("article", { class: "erp-card erp-review" },
            el("div", { class: "erp-review__top" },
                el("div", {}, el("strong", { text: nameOf(r.member_id) }), el("small", { class: "erp-muted", text: `${r.period} · dinilai ${nameOf(r.reviewer_id)}` })),
                el("span", { class: `erp-review__grade erp-review__grade--${s.grade}`, text: s.grade })),
            el("p", { class: "erp-review__score", text: `${s.score ?? "-"}/100 · ${s.label}` }),
            el("ul", { class: "erp-review__bars" }, REVIEW_CRITERIA.map((c) => el("li", {},
                el("span", { text: c.label }),
                el("span", { class: "erp-review__track" }, el("span", { style: `width:${((Number(r.scores?.[c.key]) || 0) / 5) * 100}%` })),
                el("b", { text: String(r.scores?.[c.key] ?? "-") })))),
            r.note ? el("p", { class: "erp-muted", text: `“${r.note}”` }) : null);
    })));
    return wrap;
}

async function newReview(ctx, reviewable) {
    const month = new Date().getMonth();
    const values = await formDialog({
        title: "Penilaian kinerja",
        submitLabel: "Simpan nilai",
        fields: [
            { name: "member_id", label: "Anggota", type: "select", options: reviewable.map((m) => ({ value: m.id, label: `${m.full_name} · ${m.position_title}` })) },
            { name: "period", label: "Periode", value: `${new Date().getFullYear()}-${month < 6 ? "H1" : "H2"}`, required: true, max: 12 },
            ...REVIEW_CRITERIA.map((c) => ({ name: c.key, label: `${c.label} (1–5)`, type: "number", min: 1, max: 5, step: 1, value: 3, required: true })),
            { name: "note", label: "Catatan untuk yang dinilai", type: "textarea", max: 300 },
        ],
    });
    if (!values) return;
    const scores = Object.fromEntries(REVIEW_CRITERIA.map((c) => [c.key, Math.min(5, Math.max(1, Math.round(Number(values[c.key]) || 3)))]));
    try {
        await ctx.data.saveReview({ member_id: values.member_id, period: values.period.trim(), scores, note: values.note.trim() });
        toast("Penilaian disimpan.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

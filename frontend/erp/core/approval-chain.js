/**
 * KANTOONG ERP PRO — PERSETUJUAN BERJENJANG (murni, dites)
 * File: frontend/erp/core/approval-chain.js
 *
 * Aturan per JENIS + NOMINAL menentukan rantai penyetuju. Contoh:
 *   pengeluaran ≥ Rp5 jt  →  atasan → keuangan → owner
 * Langkah rantai:
 *   "atasan"   = atasan langsung pemohon
 *   "level:N"  = atasan pertama (naik ke atas) dengan level ≥ N
 *   "role:X"   = anggota aktif dengan peran kerja X (mis. keuangan, hr)
 *   "owner"    = owner (level 5)
 * Delegasi: atasan yang cuti bisa menyerahkan hak menyetujui ke orang lain
 * selama rentang tanggal tertentu (satu lompatan, tidak berantai).
 * Rumus yang sama dipakai SQL erp_pro_build_chain di db/erp-pro.sql.
 */

export const APPROVAL_KINDS = Object.freeze({
    pengeluaran: "Pengeluaran",
    diskon: "Diskon khusus",
    cuti: "Cuti / izin",
    retur: "Retur barang",
    po: "Purchase order",
    lainnya: "Lainnya",
});

export const STEP_LABELS = Object.freeze({
    atasan: "Atasan langsung",
    owner: "Owner",
    "level:3": "Manajer",
    "level:4": "Direktur",
    "role:keuangan": "Keuangan",
    "role:hr": "HR",
    "role:gudang": "Gudang",
});

export const DEFAULT_RULES = Object.freeze([
    { id: "r-exp-0", kind: "pengeluaran", min_amount: 0, steps: ["atasan"] },
    { id: "r-exp-1", kind: "pengeluaran", min_amount: 1_000_000, steps: ["atasan", "role:keuangan"] },
    { id: "r-exp-5", kind: "pengeluaran", min_amount: 5_000_000, steps: ["atasan", "role:keuangan", "owner"] },
    { id: "r-disc-0", kind: "diskon", min_amount: 0, steps: ["atasan"] },
    { id: "r-disc-1", kind: "diskon", min_amount: 1_000_000, steps: ["atasan", "owner"] },
    { id: "r-leave", kind: "cuti", min_amount: 0, steps: ["atasan", "role:hr"] },
    { id: "r-ret", kind: "retur", min_amount: 0, steps: ["atasan"] },
    { id: "r-po-0", kind: "po", min_amount: 0, steps: ["atasan"] },
    { id: "r-po-5", kind: "po", min_amount: 5_000_000, steps: ["atasan", "role:keuangan", "owner"] },
    { id: "r-other", kind: "lainnya", min_amount: 0, steps: ["atasan"] },
]);

export const VALID_STEP = /^(atasan|owner|level:[1-5]|role:[a-z_]{2,20})$/;

export function stepLabel(step) {
    step = String(step || "");
    if (!step) return "Penyetuju";
    if (STEP_LABELS[step]) return STEP_LABELS[step];
    if (step.startsWith("role:")) return step.slice(5).replace(/^\w/, (c) => c.toUpperCase());
    if (step.startsWith("level:")) return `Level ${step.slice(6)}+`;
    return step;
}

/** Aturan yang berlaku: min_amount terbesar yang ≤ nominal, untuk jenis itu. */
export function ruleFor(kind, amount, rules = DEFAULT_RULES) {
    const value = Number(amount) || 0;
    const match = (rules || [])
        .filter((rule) => rule.kind === kind && (Number(rule.min_amount) || 0) <= value)
        .sort((a, b) => (Number(b.min_amount) || 0) - (Number(a.min_amount) || 0))[0];
    return match || { id: "r-fallback", kind, min_amount: 0, steps: ["atasan"] };
}

const active = (members) => (members || []).filter((m) => m.is_active !== false);

function ownerOf(members) {
    return active(members).filter((m) => m.level >= 5).sort((a, b) => String(a.id).localeCompare(String(b.id)))[0] || null;
}

/** Siapa penyetuju untuk satu langkah. null = tidak ada orang yang cocok. */
export function resolveStep(step, requester, members) {
    const list = active(members);
    const byId = (id) => list.find((m) => m.id === id) || null;

    if (step === "owner") return ownerOf(list)?.id ?? null;

    if (step === "atasan") {
        return byId(requester?.manager_id)?.id ?? ownerOf(list)?.id ?? null;
    }

    if (step.startsWith("level:")) {
        const need = Number(step.slice(6));
        let cursor = byId(requester?.manager_id);
        const seen = new Set();
        while (cursor && !seen.has(cursor.id)) {
            if (cursor.level >= need) return cursor.id;
            seen.add(cursor.id);
            cursor = byId(cursor.manager_id);
        }
        return ownerOf(list)?.id ?? null;
    }

    if (step.startsWith("role:")) {
        const role = step.slice(5);
        const found = list
            .filter((m) => m.job_role === role && m.id !== requester?.id)
            .sort((a, b) => b.level - a.level || String(a.id).localeCompare(String(b.id)))[0];
        return found?.id ?? ownerOf(list)?.id ?? null;
    }

    return null;
}

/** Delegasi aktif: hak menyetujui A dialihkan ke B selama starts..ends (YYYY-MM-DD). */
export function delegateFor(approverId, delegations = [], now = new Date()) {
    const day = new Date(now).toISOString().slice(0, 10);
    const found = (delegations || []).find((d) =>
        d.from_id === approverId && d.is_active !== false && d.starts <= day && day <= d.ends && d.to_id !== approverId);
    return found ? found.to_id : approverId;
}

/**
 * Rantai penyetuju untuk sebuah pengajuan.
 * - Pemohon tidak pernah menyetujui pengajuannya sendiri (langkahnya dilewati).
 * - Penyetuju yang sama hanya sekali, di posisi terakhirnya (owner selalu paling akhir).
 * - Owner yang mengajukan = rantai kosong (langsung disetujui).
 */
export function buildChain(request, { rules = DEFAULT_RULES, members = [], delegations = [], now = new Date() } = {}) {
    const requester = (members || []).find((m) => m.id === request.requester_id) || { id: request.requester_id };
    const rule = ruleFor(request.kind, request.amount, rules);
    const chain = [];
    // Owner adalah puncak: pengajuannya tidak perlu disetujui siapa pun.
    if ((requester.level ?? 0) >= 5) return { rule_id: rule.id, chain };

    for (const step of rule.steps) {
        const original = resolveStep(step, requester, members);
        if (!original) continue;
        const approver = delegateFor(original, delegations, now);
        if (approver === requester.id) continue;
        if (chain.length && chain[chain.length - 1].approver_id === approver) continue;
        // Orang yang sama muncul lagi di langkah lebih tinggi (mis. atasan = owner):
        // cukup sekali, di posisi TERAKHIR (otoritas tertinggi memutuskan paling akhir).
        const earlier = chain.findIndex((entry) => entry.approver_id === approver);
        if (earlier >= 0) chain.splice(earlier, 1);
        chain.push({ step, approver_id: approver, original_id: original, decision: null, note: null, at: null });
    }

    return { rule_id: rule.id, chain };
}

/** Indeks langkah yang sedang menunggu (-1 bila selesai). */
export function currentIndex(approval) {
    const chain = approval?.chain || [];
    if (approval?.status && approval.status !== "menunggu") return -1;
    return chain.findIndex((step) => !step.decision);
}

export function currentApprover(approval) {
    const index = currentIndex(approval);
    if (index < 0) return null;
    return approval.chain[index].approver_id;
}

/**
 * Putuskan langkah yang sedang berjalan. Mengembalikan pengajuan BARU (tidak mengubah aslinya).
 * Owner (level 5) boleh memutuskan langkah siapa pun (tercatat sebagai owner).
 */
export function decideStep(approval, actor, decision, note = "", now = new Date()) {
    if (!["disetujui", "ditolak"].includes(decision)) throw new Error("Keputusan tidak dikenal.");
    if (approval.status !== "menunggu") throw new Error("Pengajuan ini sudah diputuskan.");
    if (approval.requester_id === actor.id && actor.level < 5) throw new Error("Tidak boleh menyetujui pengajuan sendiri.");

    const index = currentIndex(approval);
    if (index < 0) throw new Error("Tidak ada langkah yang menunggu.");
    const step = approval.chain[index];
    if (step.approver_id !== actor.id && actor.level < 5) throw new Error("Belum giliranmu menyetujui pengajuan ini.");

    const at = new Date(now).toISOString();
    const chain = approval.chain.map((entry, i) =>
        i === index ? { ...entry, decision, note: note || null, at, decided_by: actor.id } : entry);

    const rejected = decision === "ditolak";
    const finished = rejected || chain.every((entry) => entry.decision === "disetujui");
    const next = finished ? null : chain.find((entry) => !entry.decision);

    return {
        ...approval,
        chain,
        status: rejected ? "ditolak" : finished ? "disetujui" : "menunggu",
        approver_id: next ? next.approver_id : approval.approver_id,
        decided_at: finished ? at : null,
        decision_note: finished ? note || null : approval.decision_note ?? null,
    };
}

/** Ringkasan untuk kartu: "Langkah 2 dari 3 · Keuangan". */
export function chainProgress(approval) {
    const chain = approval?.chain || [];
    const done = chain.filter((entry) => entry.decision === "disetujui").length;
    const index = currentIndex(approval);
    return {
        done,
        total: chain.length,
        current: index >= 0 ? chain[index] : null,
        label: !chain.length
            ? "Langsung"
            : index >= 0
                ? `Langkah ${index + 1} dari ${chain.length} · ${stepLabel(chain[index].step)}`
                : approval.status === "ditolak" ? "Ditolak" : "Selesai",
    };
}

/** Pengajuan yang menunggu lebih dari N jam di langkah yang sama. */
export function isOverdue(approval, now = new Date(), hours = 24) {
    if (approval?.status !== "menunggu") return false;
    const chain = approval.chain || [];
    const index = currentIndex(approval);
    const since = index > 0 ? chain[index - 1].at : approval.created_at;
    return Boolean(since) && new Date(now) - new Date(since) > hours * 3600000;
}

/** Validasi aturan yang diedit owner. */
export function validateRule(rule) {
    if (!APPROVAL_KINDS[rule.kind]) return "Jenis pengajuan tidak dikenal.";
    const amount = Number(rule.min_amount);
    if (!Number.isFinite(amount) || amount < 0) return "Nominal minimal tidak valid.";
    if (!Array.isArray(rule.steps) || !rule.steps.length || rule.steps.length > 5) return "Rantai harus 1–5 langkah.";
    if (!rule.steps.every((step) => VALID_STEP.test(step))) return "Ada langkah yang tidak dikenal.";
    return null;
}

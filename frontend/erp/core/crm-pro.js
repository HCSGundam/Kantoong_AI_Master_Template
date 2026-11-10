/**
 * KANTOONG ERP PRO — CRM PRO (murni, dites)
 * File: frontend/erp/core/crm-pro.js
 *
 * Alur calon pelanggan (pipeline) dari prospek sampai menang/kalah,
 * nilai berbobot peluang, follow-up jatuh tempo, dan deal yang "macet".
 * Deal: { id, title, customer, value, stage, owner_id, next_action,
 *         next_action_at (ISO), updated_at, created_at, lost_reason }
 */

export const STAGES = Object.freeze([
    { key: "prospek", label: "Prospek", chance: 10 },
    { key: "dihubungi", label: "Sudah dihubungi", chance: 25 },
    { key: "penawaran", label: "Penawaran dikirim", chance: 50 },
    { key: "negosiasi", label: "Negosiasi", chance: 75 },
    { key: "menang", label: "Menang", chance: 100 },
    { key: "kalah", label: "Kalah", chance: 0 },
]);

export const OPEN_STAGES = Object.freeze(["prospek", "dihubungi", "penawaran", "negosiasi"]);
const stageOf = (key) => STAGES.find((s) => s.key === key) || STAGES[0];

export function pipelineSummary(deals) {
    const rows = STAGES.map((s) => ({ ...s, count: 0, value: 0, weighted: 0 }));
    (deals || []).forEach((deal) => {
        const row = rows.find((r) => r.key === deal.stage) || rows[0];
        const value = Number(deal.value) || 0;
        row.count += 1;
        row.value += value;
        row.weighted += Math.round((value * row.chance) / 100);
    });
    const open = rows.filter((r) => OPEN_STAGES.includes(r.key));
    const won = rows.find((r) => r.key === "menang");
    const lost = rows.find((r) => r.key === "kalah");
    const closed = won.count + lost.count;
    return {
        rows,
        openValue: open.reduce((n, r) => n + r.value, 0),
        forecast: open.reduce((n, r) => n + r.weighted, 0),
        wonValue: won.value,
        winRate: closed ? Math.round((won.count / closed) * 100) : null,
    };
}

/** Follow-up: telat / hari ini / akan datang (deal terbuka saja). */
export function followUps(deals, now = new Date()) {
    const today = new Date(now).toISOString().slice(0, 10);
    const groups = { telat: [], hariIni: [], nanti: [] };
    (deals || [])
        .filter((d) => OPEN_STAGES.includes(d.stage) && d.next_action_at)
        .sort((a, b) => a.next_action_at.localeCompare(b.next_action_at))
        .forEach((deal) => {
            const day = deal.next_action_at.slice(0, 10);
            if (day < today) groups.telat.push(deal);
            else if (day === today) groups.hariIni.push(deal);
            else groups.nanti.push(deal);
        });
    return groups;
}

/** Deal terbuka yang tidak bergerak ≥ N hari dan tanpa rencana follow-up ke depan. */
export function stuckDeals(deals, now = new Date(), days = 7) {
    const limit = new Date(now).getTime() - days * 86400000;
    const today = new Date(now).toISOString().slice(0, 10);
    return (deals || []).filter((d) => OPEN_STAGES.includes(d.stage)
        && new Date(d.updated_at || d.created_at).getTime() < limit
        && !(d.next_action_at && d.next_action_at.slice(0, 10) >= today));
}

/** Pindah tahap. Kalah wajib alasan (bahan belajar). */
export function moveStage(deal, stage, { reason = "", now = new Date() } = {}) {
    if (!STAGES.some((s) => s.key === stage)) throw new Error("Tahap tidak dikenal.");
    if (stage === "kalah" && !String(reason).trim()) throw new Error("Tulis alasan kalah agar tim bisa belajar.");
    return {
        ...deal,
        stage,
        lost_reason: stage === "kalah" ? String(reason).trim().slice(0, 200) : null,
        updated_at: new Date(now).toISOString(),
        next_action_at: OPEN_STAGES.includes(stage) ? deal.next_action_at : null,
    };
}

export function chanceOf(stage) {
    return stageOf(stage).chance;
}

/** Alasan kalah terbanyak (untuk pelajaran tim). */
export function lossReasons(deals) {
    const map = new Map();
    (deals || []).filter((d) => d.stage === "kalah" && d.lost_reason).forEach((d) => {
        const k = d.lost_reason.trim().toLowerCase();
        map.set(k, (map.get(k) || 0) + 1);
    });
    return [...map.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}

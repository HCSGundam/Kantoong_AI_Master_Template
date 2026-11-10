/**
 * KANTOONG ERP PRO — SDM PRO (murni, dites)
 * File: frontend/erp/core/hr-pro.js
 *
 * Cuti (hari kerja Senin–Jumat, kuota tahunan), kontrak kerja (pengingat
 * habis kontrak & masa percobaan), dan penilaian kinerja (5 kriteria 1–5).
 */

const DAY = 86400000;

export const LEAVE_TYPES = Object.freeze({
    tahunan: { label: "Cuti tahunan", quota: true },
    sakit: { label: "Sakit (surat dokter)", quota: false },
    izin: { label: "Izin penting", quota: false },
    melahirkan: { label: "Cuti melahirkan", quota: false },
});

export const DEFAULT_ANNUAL_QUOTA = 12; // UU Ketenagakerjaan: minimal 12 hari kerja/tahun.

const parse = (day) => new Date(`${day}T00:00:00Z`);
const key = (date) => new Date(date).toISOString().slice(0, 10);

/** Jumlah hari kerja (Senin–Jumat) antara dua tanggal, inklusif. */
export function workDays(start, end, holidays = []) {
    const from = parse(start);
    const to = parse(end);
    if (!(from <= to)) return 0;
    const off = new Set(holidays);
    let count = 0;
    for (let t = from.getTime(); t <= to.getTime(); t += DAY) {
        const day = new Date(t);
        const dow = day.getUTCDay();
        if (dow !== 0 && dow !== 6 && !off.has(key(day))) count += 1;
    }
    return count;
}

export function validateLeave(input) {
    if (!LEAVE_TYPES[input.kind]) return "Jenis cuti tidak dikenal.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.starts || "") || !/^\d{4}-\d{2}-\d{2}$/.test(input.ends || "")) return "Tanggal tidak valid.";
    if (input.ends < input.starts) return "Tanggal selesai sebelum tanggal mulai.";
    if (workDays(input.starts, input.ends) === 0) return "Rentang itu tidak berisi hari kerja.";
    return null;
}

/** Sisa cuti tahunan seseorang di satu tahun (yang menunggu ikut dihitung agar tidak dobel ajukan). */
export function leaveBalance(memberId, leaves, year, quota = DEFAULT_ANNUAL_QUOTA) {
    const used = (leaves || [])
        .filter((l) => l.member_id === memberId && l.kind === "tahunan" && String(l.starts).startsWith(String(year))
            && ["disetujui", "menunggu"].includes(l.status))
        .reduce((n, l) => n + (Number(l.days) || workDays(l.starts, l.ends)), 0);
    return { quota, used, left: quota - used };
}

/** Siapa saja yang cuti pada tanggal tertentu (untuk "Hari ini tidak masuk"). */
export function onLeave(leaves, day) {
    return (leaves || []).filter((l) => l.status === "disetujui" && l.starts <= day && day <= l.ends);
}

export const CONTRACT_TYPES = Object.freeze({
    pkwt: "Kontrak (PKWT)",
    pkwtt: "Tetap (PKWTT)",
    magang: "Magang",
    harian: "Harian lepas",
});

/** Pengingat kontrak: habis dalam N hari, sudah habis, atau masa percobaan selesai. */
export function contractAlerts(contracts, now = new Date(), days = 30) {
    const today = parse(key(now));
    const out = [];
    (contracts || []).forEach((c) => {
        if (c.ends_on) {
            const left = Math.round((parse(c.ends_on) - today) / DAY);
            if (left < 0) out.push({ ...c, alert: "habis", left });
            else if (left <= days) out.push({ ...c, alert: "segera", left });
        }
        if (c.probation_ends_on) {
            const left = Math.round((parse(c.probation_ends_on) - today) / DAY);
            if (left >= 0 && left <= 14) out.push({ ...c, alert: "percobaan", left });
        }
    });
    const rank = { habis: 0, segera: 1, percobaan: 2 };
    return out.sort((a, b) => rank[a.alert] - rank[b.alert] || a.left - b.left);
}

export const REVIEW_CRITERIA = Object.freeze([
    { key: "kehadiran", label: "Kehadiran & disiplin", weight: 20 },
    { key: "target", label: "Pencapaian target", weight: 30 },
    { key: "kualitas", label: "Kualitas kerja", weight: 25 },
    { key: "kerjasama", label: "Kerja sama tim", weight: 15 },
    { key: "inisiatif", label: "Inisiatif", weight: 10 },
]);

/** Nilai berbobot 1–5 → angka 0–100 + huruf. */
export function reviewScore(scores = {}) {
    let total = 0;
    let weight = 0;
    REVIEW_CRITERIA.forEach((c) => {
        const value = Number(scores[c.key]);
        if (value >= 1 && value <= 5) {
            total += ((value - 1) / 4) * 100 * c.weight;
            weight += c.weight;
        }
    });
    if (!weight) return { score: null, grade: "-", label: "Belum dinilai" };
    const score = Math.round(total / weight);
    const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "E";
    const label = { A: "Luar biasa", B: "Baik", C: "Cukup", D: "Perlu pembinaan", E: "Perlu rencana perbaikan" }[grade];
    return { score, grade, label };
}

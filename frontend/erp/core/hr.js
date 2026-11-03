/**
 * KANTOONG ERP — ATURAN ABSENSI
 * File: frontend/erp/core/hr.js
 *
 * Sama dengan erp_clock di erp-phase2.sql: masuk lewat jam mulai +
 * toleransi = "telat". Semua jam memakai WIB.
 */

export const ATTENDANCE_LABELS = Object.freeze({
    hadir: "Hadir",
    telat: "Telat",
    izin: "Izin",
    sakit: "Sakit",
    cuti: "Cuti",
    alpa: "Alpa",
});

export const DEFAULT_HR_SETTINGS = Object.freeze({
    work_start: "09:00",
    grace_minutes: 10,
    working_days: 26,
});

const WIB_MS = 7 * 3600000;

/** "2026-11-03" untuk waktu WIB. */
export function wibDate(date = new Date()) {
    return new Date(new Date(date).getTime() + WIB_MS).toISOString().slice(0, 10);
}

/** Menit sejak tengah malam WIB. */
export function wibMinutes(date = new Date()) {
    const local = new Date(new Date(date).getTime() + WIB_MS);
    return local.getUTCHours() * 60 + local.getUTCMinutes();
}

export function wibTime(date) {
    if (!date) return "-";
    const local = new Date(new Date(date).getTime() + WIB_MS);
    return `${String(local.getUTCHours()).padStart(2, "0")}.${String(local.getUTCMinutes()).padStart(2, "0")}`;
}

/** Status masuk: hadir / telat. */
export function checkInStatus(checkIn, settings = DEFAULT_HR_SETTINGS) {
    const [hour, minute] = String(settings.work_start || "09:00").split(":").map(Number);
    const limit = hour * 60 + minute + (Number(settings.grace_minutes) || 0);
    return wibMinutes(checkIn) > limit ? "telat" : "hadir";
}

/** Rekap bulanan per anggota: { hadir, telat, izin, sakit, cuti, alpa, masuk }. */
export function monthlyRecap(records, memberId, period) {
    const recap = { hadir: 0, telat: 0, izin: 0, sakit: 0, cuti: 0, alpa: 0, masuk: 0 };

    for (const record of records) {
        if (record.member_id !== memberId || !String(record.work_date).startsWith(period)) continue;
        if (recap[record.status] !== undefined) recap[record.status] += 1;
        if (record.status === "hadir" || record.status === "telat") recap.masuk += 1;
    }

    return recap;
}

/** Durasi kerja "8 j 5 m" dari jam masuk-pulang. */
export function workDuration(checkIn, checkOut) {
    if (!checkIn || !checkOut) return "";
    const minutes = Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / 60000));
    return `${Math.floor(minutes / 60)} j ${minutes % 60} m`;
}

/** "2026-11" bulan berjalan (WIB). */
export function currentPeriod(now = new Date()) {
    return wibDate(now).slice(0, 7);
}

export function previousPeriod(period) {
    const [year, month] = period.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 2, 1));
    return date.toISOString().slice(0, 7);
}

export function periodLabel(period) {
    const [year, month] = period.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
}

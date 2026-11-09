// ============================================================
// cart/cart-reason.js - KERANJANG YANG INGAT ALASAN (murni, dites)
//
// Saat barang masuk keranjang, pembeli BOLEH menulis alasan singkat
// ("Kado ultah Mama", tanggal 20 Nov). Alasan hanya disimpan di
// perangkat ini, TIDAK ikut ke pesanan / penjual. Pengingat muncul di
// dalam web saja (tanpa notifikasi/WA/email), paling sering 1x sehari.
// ============================================================

export const REASON_PRESETS = Object.freeze(['Kado', 'Untuk acara', 'Pakai sendiri', 'Ganti yang lama']);
const DAY = 86_400_000;

const text = (v, max) => String(v ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

/** {text, date:'YYYY-MM-DD'} atau null bila kosong. */
export function cleanReason(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const t = text(raw.text, 80);
    const d = /^\d{4}-\d{2}-\d{2}$/.test(String(raw.date ?? '')) && Number.isFinite(Date.parse(raw.date)) ? raw.date : '';
    if (!t && !d) return null;
    return d ? { text: t, date: d } : { text: t };
}

const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

/** Sisa hari menuju tanggal alasan (0 = hari ini, negatif = sudah lewat), null bila tanpa tanggal. */
export function daysLeft(reason, now = Date.now()) {
    if (!reason?.date) return null;
    const [y, m, d] = reason.date.split('-').map(Number);
    return Math.round((new Date(y, m - 1, d).getTime() - startOfDay(now)) / DAY);
}

const shortDate = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

/** Label kecil di kartu keranjang: "Kado ultah Mama · 20 Nov (3 hari lagi)". */
export function reasonLabel(reason, now = Date.now()) {
    if (!reason) return '';
    const left = daysLeft(reason, now);
    const when = reason.date
        ? `${shortDate(reason.date)}${left === 0 ? ' (hari ini)' : left === 1 ? ' (besok)' : left > 1 ? ` (${left} hari lagi)` : ' (sudah lewat)'}`
        : '';
    return [reason.text, when].filter(Boolean).join(' · ');
}

/**
 * Pengingat paling mendesak: barang beralasan bertanggal 0..7 hari lagi.
 * Mengembalikan {item, left, message} atau null.
 */
export function upcomingReminder(items, now = Date.now(), { within = 7 } = {}) {
    const list = (items ?? [])
        .map((item) => ({ item, left: daysLeft(item?.reason, now) }))
        .filter((x) => x.left != null && x.left >= 0 && x.left <= within)
        .sort((a, b) => a.left - b.left);
    if (!list.length) return null;
    const { item, left } = list[0];
    const what = item.reason.text ? `“${item.reason.text}”` : `tanggal ${shortDate(item.reason.date)}`;
    const when = left === 0 ? 'hari ini' : left === 1 ? 'besok' : `${left} hari lagi`;
    const others = list.length > 1 ? ` (+${list.length - 1} barang lain)` : '';
    return { item, left, message: `${item.name} untuk ${what} masih di keranjang, ${when}${others}.` };
}

/** Boleh menampilkan pengingat? Maksimal sekali sehari per perangkat. */
export function shouldNudge(lastDay, now = Date.now()) {
    return lastDay !== new Date(now).toDateString();
}

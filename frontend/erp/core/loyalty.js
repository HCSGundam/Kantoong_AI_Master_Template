/**
 * KANTOONG ERP — MEMBER & POIN (Tahap 4 POS Pro) — logika murni, dites otomatis
 * File: frontend/erp/core/loyalty.js
 *
 * Pertanyaan terbalik: "Kenapa pelanggan MENOLAK jadi member, dan kenapa member berhenti datang?"
 *   - Formulir panjang, takut di-spam, takut datanya dijual  -> cukup nama + HP, 2 izin terpisah
 *     (simpan riwayat & poin / boleh dikirimi promo), bisa minta DIHAPUS kapan saja (UU PDP 27/2022).
 *   - Poin tidak terasa                                        -> poin langsung dipakai di kasir.
 *   - Barista tidak ingat pesanan langganannya                 -> KASIR YANG INGAT: pesanan favorit
 *     lengkap dengan variannya, 1 ketukan masuk keranjang.
 *   - Pelanggan menghilang tanpa ada yang sadar                -> RADAR PELANGGAN MENGHILANG:
 *     tahu jadwal datang tiap orang, menandai yang sudah lewat jauh dari kebiasaannya.
 * Poin dicatat sebagai buku besar (ledger) dengan business_id: siap menjadi poin
 * jaringan Kantoong lintas brand nanti (butuh server pusat & izin pelanggan).
 */

import { lineKey } from "./pos-pro.js";

const DAY = 86400000;
const money = (value) => Math.round(Number(value) || 0);

/** "0812-3456-789" / "+62 812..." / "812..." -> "62812..."; tidak valid = "". */
export function normalizePhone(raw) {
    let digits = String(raw || "").replace(/\D/g, "");
    if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
    else if (digits.startsWith("8")) digits = `62${digits}`;
    return /^628\d{7,12}$/.test(digits) ? digits : "";
}

/** "6281234567890" -> "0812-3456-7890" untuk dibaca kasir. */
export function displayPhone(phone) {
    const local = String(phone || "").startsWith("62") ? `0${String(phone).slice(2)}` : String(phone || "");
    return local.replace(/^(\d{4})(\d{4})(\d+)$/, "$1-$2-$3");
}

/** Nomor disamarkan untuk staf yang tidak perlu melihat lengkap: 0812-****-890. */
export function maskedPhone(phone) {
    const local = displayPhone(phone).replace(/-/g, "");
    return local.length > 7 ? `${local.slice(0, 4)}-****-${local.slice(-3)}` : "****";
}

/** Poin yang didapat dari belanja (setelah semua potongan, sebelum pajak & service). */
export function pointsEarned(base, settings) {
    if (!settings?.loyalty_enabled) return 0;
    const per = Math.max(1000, money(settings.points_per));
    return Math.max(0, Math.floor(money(base) / per));
}

/**
 * Poin yang boleh dipakai: tidak melebihi saldo, permintaan, dan sisa tagihan.
 * Nilai poin selalu kelipatan point_value (tidak ada "pecahan poin").
 */
export function pointsRedeemable({ requested = 0, balance = 0, remaining = 0, settings }) {
    if (!settings?.loyalty_enabled) return { points: 0, value: 0 };
    const value = Math.max(1, money(settings.point_value));
    const points = Math.max(0, Math.min(Math.floor(Number(requested) || 0), Math.floor(Number(balance) || 0), Math.floor(money(remaining) / value)));
    return { points, value: points * value };
}

/** Saldo poin dari buku besar. */
export function pointsBalance(ledger = [], memberId) {
    return ledger.filter((row) => row.member_id === memberId).reduce((sum, row) => sum + (Number(row.delta) || 0), 0);
}

const live = (sales, memberId) => sales
    .filter((sale) => sale.member_id === memberId && sale.status !== "batal")
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

/**
 * KASIR YANG INGAT: ringkasan kebiasaan member dari riwayat belanjanya.
 * Hanya dipakai bila member mengizinkan riwayatnya disimpan.
 */
export function memberProfile(member, sales = [], now = new Date()) {
    const own = live(sales, member?.id);
    const nowMs = new Date(now).getTime();
    const favorites = new Map();

    for (const sale of own) {
        const seenInSale = new Set();
        for (const item of sale.items || []) {
            const options = (item.options || []).map((option) => ({ group_id: option.group_id, option_id: option.option_id, name: option.name }));
            const key = lineKey(String(item.product_id), options, item.note || "");
            const entry = favorites.get(key) || { key, product_id: String(item.product_id), name: item.name, options, note: item.note || "", count: 0, qty: 0, last: sale.created_at };
            if (!seenInSale.has(key)) entry.count += 1;
            seenInSale.add(key);
            entry.qty += Number(item.qty) || 0;
            entry.last = sale.created_at;
            favorites.set(key, entry);
        }
    }

    const visits = own.length;
    const spent = own.reduce((sum, sale) => sum + money(sale.total), 0);
    const gaps = own.slice(1).map((sale, index) => (new Date(sale.created_at) - new Date(own[index].created_at)) / DAY);
    const avgGap = gaps.length ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : null;
    const last = own[own.length - 1];
    const channels = {};
    own.forEach((sale) => { channels[sale.channel || "take_away"] = (channels[sale.channel || "take_away"] || 0) + 1; });

    return {
        visits,
        spent,
        avgTicket: visits ? Math.round(spent / visits) : 0,
        lastDays: last ? Math.floor((nowMs - new Date(last.created_at).getTime()) / DAY) : null,
        avgGap: avgGap === null ? null : Math.round(avgGap * 10) / 10,
        usualChannel: Object.entries(channels).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
        favorites: [...favorites.values()]
            .sort((a, b) => b.count - a.count || String(b.last).localeCompare(String(a.last)))
            .slice(0, 3),
    };
}

/** Kalimat sapaan untuk kasir: "Datang lagi setelah 3 hari · biasanya Kopi Susu (Large, Less sugar)". */
export function greetingText(profile) {
    if (!profile?.visits) return "Member baru — kunjungan pertama. Sambut dengan hangat!";
    const parts = [];
    parts.push(profile.lastDays === 0 ? "Sudah datang hari ini" : `Terakhir datang ${profile.lastDays} hari lalu`);
    parts.push(`${profile.visits}× kunjungan`);
    const top = profile.favorites[0];
    if (top && top.count >= 2) {
        const options = top.options.map((option) => option.name).filter(Boolean).join(", ");
        parts.push(`biasanya ${top.name}${options ? ` (${options})` : ""}`);
    }
    return parts.join(" · ");
}

/**
 * RADAR PELANGGAN MENGHILANG: member dengan ≥ 3 kunjungan yang sudah lewat jauh
 * dari jarak kunjungan biasanya (> 2× rata-rata, minimal 10 hari).
 * Kontak hanya boleh dipakai bila member mengizinkan promo.
 */
export function churnRadar(members = [], sales = [], now = new Date()) {
    return members
        .map((member) => ({ member, profile: memberProfile(member, sales, now) }))
        .filter(({ profile }) => profile.visits >= 3 && profile.avgGap !== null)
        .map(({ member, profile }) => {
            const usual = Math.max(1, profile.avgGap);
            const overdue = profile.lastDays - usual;
            return { member, profile, usual, overdue, risk: profile.lastDays > Math.max(10, usual * 2) };
        })
        .filter((row) => row.risk)
        .sort((a, b) => b.profile.spent - a.profile.spent);
}

/** Ringkasan program member untuk owner. */
export function loyaltySummary({ members = [], sales = [], ledger = [], now = new Date(), days = 30 } = {}) {
    const since = new Date(now).getTime() - days * DAY;
    const recent = sales.filter((sale) => sale.status !== "batal" && new Date(sale.created_at).getTime() >= since);
    const memberSales = recent.filter((sale) => sale.member_id);
    const avg = (list) => (list.length ? Math.round(list.reduce((sum, sale) => sum + money(sale.total), 0) / list.length) : 0);
    const guests = recent.filter((sale) => !sale.member_id);
    const outstanding = members.reduce((sum, member) => sum + Math.max(0, pointsBalance(ledger, member.id)), 0);
    return {
        members: members.length,
        consentPromo: members.filter((member) => member.consent_promo).length,
        memberShare: recent.length ? Math.round((memberSales.length / recent.length) * 100) : 0,
        memberAvg: avg(memberSales),
        guestAvg: avg(guests),
        pointsOutstanding: outstanding,
    };
}

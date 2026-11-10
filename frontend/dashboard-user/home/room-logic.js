/**
 * KANTOONG — LOGIKA MURNI "RUANG" FITUR DASHBOARD USER (dites)
 * File: frontend/dashboard-user/home/room-logic.js
 *
 * Semua hitungan untuk 26 fitur: tanggal & hitung mundur, batas belanja,
 * pola belanja, konversi ukuran, voucher yang pas, level member,
 * Sinyal "Mungkin kamu butuh ini", dan profil selera (Kartu Diriku).
 * Tidak menyentuh DOM / jaringan → mudah dites & dipercaya.
 */

const DAY = 86_400_000;
const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
const startOfDay = (ms) => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
};

/* ---------- Tanggal & hitung mundur ---------- */

/** "YYYY-MM-DD" → waktu lokal tengah malam, atau NaN. */
export function parseDay(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
    if (!m) return NaN;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}

/** Sisa hari kalender (0 = hari ini, negatif = lewat). */
export const daysUntil = (ms, now = Date.now()) => Math.round((startOfDay(ms) - startOfDay(now)) / DAY);

/** Ulang tahun berikutnya dari tanggal lahir (tahun diabaikan). */
export function nextOccurrence(iso, now = Date.now()) {
    const base = parseDay(iso);
    if (!Number.isFinite(base)) return NaN;
    const b = new Date(base);
    const today = new Date(startOfDay(now));
    let next = new Date(today.getFullYear(), b.getMonth(), b.getDate()).getTime();
    if (next < today.getTime()) next = new Date(today.getFullYear() + 1, b.getMonth(), b.getDate()).getTime();
    return next;
}

/** Teks hitung mundur ringkas: "2 hari 4 jam", "35 menit", "Sudah lewat". */
export function countdownText(targetMs, now = Date.now()) {
    const diff = targetMs - now;
    if (!Number.isFinite(diff)) return "";
    if (diff <= 0) return "Sudah lewat";
    const d = Math.floor(diff / DAY);
    const h = Math.floor((diff % DAY) / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    if (d >= 1) return `${d} hari${h ? ` ${h} jam` : ""}`;
    if (h >= 1) return `${h} jam${m ? ` ${m} menit` : ""}`;
    return `${Math.max(1, m)} menit`;
}

/**
 * Gabungkan semua hal yang "berdetak" jadi satu daftar urut terdekat.
 * sources: [{ id, label, at(ms), kind, feature }]
 */
export function collectCountdowns(sources, now = Date.now(), { horizonDays = 60 } = {}) {
    return (sources ?? [])
        .filter((s) => Number.isFinite(s?.at) && s.at > now && s.at - now <= horizonDays * DAY)
        .sort((a, b) => a.at - b.at)
        .map((s) => ({ ...s, left: countdownText(s.at, now), days: daysUntil(s.at, now) }));
}

/* ---------- Kalender ---------- */

/** Acara dalam N hari (ulang tahun berulang tiap tahun). */
export function upcomingEvents(events, now = Date.now(), days = 30) {
    return (events ?? [])
        .map((e) => {
            const at = e?.repeat === "yearly" ? nextOccurrence(e.date, now) : parseDay(e?.date);
            return { ...e, at, days: daysUntil(at, now) };
        })
        .filter((e) => Number.isFinite(e.at) && e.days >= 0 && e.days <= days)
        .sort((a, b) => a.at - b.at);
}

/** Petak bulan (Senin pertama) untuk kalender: 6 minggu × 7 hari. */
export function monthGrid(year, month) {
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7; // Senin = 0
    return Array.from({ length: 42 }, (_, i) => {
        const d = new Date(year, month, 1 - offset + i);
        return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate(), inMonth: d.getMonth() === month, key: isoDay(d.getTime()) };
    });
}

export function isoDay(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** File .ics (kalender) dari daftar acara — diunduh pengguna sendiri. */
export function toIcs(events, { brand = "Kantoong" } = {}) {
    const esc = (s) => String(s ?? "").replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, " ");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${esc(brand)}//Kalender//ID`];
    (events ?? []).forEach((e, i) => {
        const day = String(e.date ?? "").replace(/-/g, "");
        if (!/^\d{8}$/.test(day)) return;
        lines.push("BEGIN:VEVENT", `UID:${i}-${day}@kantoong`, `DTSTART;VALUE=DATE:${day}`, `SUMMARY:${esc(e.title)}`);
        if (e.repeat === "yearly") lines.push("RRULE:FREQ=YEARLY");
        lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
}

/* ---------- Uang ---------- */

/** Status batas belanja bulanan buatan pengguna sendiri. */
export function budgetStatus(spent, limit) {
    const s = Math.max(0, num(spent));
    const l = Math.max(0, num(limit));
    if (!l) return { level: "none", pct: 0, left: 0, message: "Belum ada batas belanja." };
    const pct = Math.round((s / l) * 100);
    const left = l - s;
    if (pct >= 100) return { level: "over", pct, left, message: `Lewat batas ${Math.abs(left).toLocaleString("id-ID")} rupiah bulan ini.` };
    if (pct >= 80) return { level: "warn", pct, left, message: `Tinggal ${left.toLocaleString("id-ID")} rupiah sebelum batas bulan ini.` };
    return { level: "ok", pct, left, message: `Masih aman: sisa ${left.toLocaleString("id-ID")} rupiah bulan ini.` };
}

const VALID_ORDER = (o) => !["dibatalkan", "menunggu_pembayaran"].includes(o?.status);

/** Belanja bulan berjalan dari pesanan yang sah. */
export function spentThisMonth(orders, now = Date.now()) {
    const d = new Date(now);
    return (orders ?? []).filter(VALID_ORDER).filter((o) => {
        const t = new Date(o.created_at);
        return t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth();
    }).reduce((s, o) => s + num(o.total), 0);
}

const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** Pola belanja: hari & jam favorit, rata-rata, pesanan terbesar. */
export function spendingPattern(orders) {
    const list = (orders ?? []).filter(VALID_ORDER);
    if (!list.length) return null;
    const byDay = Array(7).fill(0);
    const byPart = { pagi: 0, siang: 0, sore: 0, malam: 0 };
    list.forEach((o) => {
        const t = new Date(o.created_at);
        byDay[t.getDay()] += 1;
        const h = t.getHours();
        byPart[h < 11 ? "pagi" : h < 15 ? "siang" : h < 18 ? "sore" : "malam"] += 1;
    });
    const total = list.reduce((s, o) => s + num(o.total), 0);
    const topDay = byDay.indexOf(Math.max(...byDay));
    const topPart = Object.entries(byPart).sort((a, b) => b[1] - a[1])[0][0];
    const biggest = list.reduce((a, b) => (num(b.total) > num(a.total) ? b : a));
    return {
        count: list.length,
        total,
        average: Math.round(total / list.length),
        favoriteDay: DAYS[topDay],
        favoritePart: topPart,
        biggest: { code: biggest.order_code ?? "", total: num(biggest.total) },
        sentence: `Kamu paling sering belanja hari ${DAYS[topDay]} ${topPart}.`,
    };
}

/** Biaya per pakai: harga ÷ berapa kali dipakai. */
export function costPerWear(price, wears) {
    const p = Math.max(0, num(price));
    const w = Math.max(0, Math.floor(num(wears)));
    if (!p) return null;
    const per = w ? Math.round(p / w) : p;
    const verdict = !w ? "Belum pernah dipakai" : per <= p * 0.05 ? "Sangat sepadan" : per <= p * 0.2 ? "Sepadan" : "Masih mahal per pakai";
    return { per, verdict };
}

/** Level member dari total belanja sah (tanpa angka karangan). */
export const LEVELS = Object.freeze([
    { id: "teman", label: "Teman", min: 0 },
    { id: "sahabat", label: "Sahabat", min: 500_000 },
    { id: "keluarga", label: "Keluarga", min: 2_000_000 },
    { id: "kehormatan", label: "Kehormatan", min: 10_000_000 },
]);

export function memberLevel(total) {
    const t = Math.max(0, num(total));
    let idx = 0;
    LEVELS.forEach((l, i) => {
        if (t >= l.min) idx = i;
    });
    const next = LEVELS[idx + 1] ?? null;
    return {
        level: LEVELS[idx],
        next,
        toNext: next ? next.min - t : 0,
        pct: next ? Math.round(((t - LEVELS[idx].min) / (next.min - LEVELS[idx].min)) * 100) : 100,
    };
}

/** Voucher: pas untuk keranjang sekarang? hampir hangus? */
export function voucherFit(voucher, cartTotal, now = Date.now()) {
    const min = num(voucher?.min_purchase ?? voucher?.minPurchase);
    const total = num(cartTotal);
    const end = Date.parse(voucher?.ends_at ?? voucher?.until ?? "");
    const expired = Number.isFinite(end) && end < now;
    const expiringDays = Number.isFinite(end) ? daysUntil(end, now) : null;
    return {
        usable: !expired && total >= min,
        short: !expired && total < min ? min - total : 0,
        expired,
        expiringSoon: !expired && expiringDays !== null && expiringDays <= 3,
        expiringDays,
    };
}

/* ---------- Ukuran ---------- */

// Tabel konversi sepatu dewasa (perkiraan umum, uniseks).
const SHOES = [
    [36, 4, 3.5], [37, 5, 4], [38, 6, 5], [39, 7, 6], [40, 7.5, 6.5], [41, 8.5, 7.5],
    [42, 9, 8], [43, 10, 9], [44, 11, 10], [45, 12, 11], [46, 12.5, 11.5],
];
const CLOTHES = [["XS", 34, 32], ["S", 36, 34], ["M", 38, 36], ["L", 40, 38], ["XL", 42, 40], ["XXL", 44, 42], ["3XL", 46, 44]];

/** Konversi ukuran. kind = "sepatu" (dari EU) | "baju" (dari huruf). */
export function convertSize(kind, value) {
    if (kind === "sepatu") {
        const eu = num(value);
        const row = SHOES.reduce((best, r) => (Math.abs(r[0] - eu) < Math.abs(best[0] - eu) ? r : best), SHOES[0]);
        if (!eu || Math.abs(row[0] - eu) > 1) return null;
        return { EU: row[0], US: row[1], UK: row[2] };
    }
    if (kind === "baju") {
        const row = CLOTHES.find((r) => r[0] === String(value ?? "").toUpperCase().trim());
        return row ? { Huruf: row[0], EU: row[1], UK: row[2] } : null;
    }
    return null;
}

/* ---------- Kartu Diriku: profil selera dari aktivitas ---------- */

const COLORS = ["hitam", "putih", "merah", "biru", "hijau", "kuning", "cokelat", "coklat", "abu", "pink", "ungu", "krem", "navy", "emas", "silver"];

/**
 * Selera yang DISIMPULKAN dari aktivitas di perangkat ini, masing-masing
 * dengan sumbernya. Baris yang sudah dihapus pengguna (suppressed) tidak muncul.
 * input: { products, wishlistIds, recentIds, chatTexts, suppressed }
 */
export function inferTraits({ products = [], wishlistIds = [], recentIds = [], chatTexts = [], suppressed = [] } = {}) {
    const byId = new Map(products.map((p) => [String(p.id), p]));
    const traits = [];
    const add = (key, label, value, source, weight) => {
        if (!suppressed.includes(key)) traits.push({ key, label, value, source, weight });
    };

    const catCount = new Map();
    const bump = (p, w) => {
        const c = String(p?.category ?? "").trim();
        if (c) catCount.set(c, (catCount.get(c) ?? 0) + w);
    };
    wishlistIds.forEach((id) => bump(byId.get(String(id)), 2));
    recentIds.forEach((id) => bump(byId.get(String(id)), 1));
    const topCats = [...catCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
    topCats.forEach(([cat, w], i) => add(`cat:${cat}`, i === 0 ? "Kategori favorit" : "Juga suka", cat, `dari ${w} kali dilihat/disimpan`, w));

    const prices = [...wishlistIds, ...recentIds].map((id) => num(byId.get(String(id))?.price)).filter(Boolean).sort((a, b) => a - b);
    if (prices.length >= 3) {
        const mid = prices[Math.floor(prices.length / 2)];
        add("budget", "Kisaran harga nyaman", `sekitar Rp ${Math.round(mid / 1000).toLocaleString("id-ID")} rb`, `dari ${prices.length} produk yang kamu lihat`, prices.length);
    }

    const colorCount = new Map();
    chatTexts.forEach((t) => {
        const words = String(t).toLowerCase().split(/[^a-z]+/);
        COLORS.forEach((c) => {
            if (words.includes(c)) colorCount.set(c === "coklat" ? "cokelat" : c, (colorCount.get(c) ?? 0) + 1);
        });
    });
    const topColor = [...colorCount.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topColor) add(`color:${topColor[0]}`, "Warna yang sering kamu sebut", topColor[0], `dari ${topColor[1]} pesan chat`, topColor[1]);

    return traits;
}

/* ---------- Sinyal: "Mungkin kamu butuh ini" ---------- */

/**
 * Tebakan diam (bukan pesan chat) dari keadaan nyata.
 * state: { cartItems, orders, wishlist:[{id,name,price,priceThen,stock}], events, budget:{spent,limit}, vouchers, takeaway, queue }
 * Hasil maks 4, urut paling mendesak.
 */
export function computeSignals(state = {}, now = Date.now()) {
    const out = [];
    const push = (s) => out.push(s);

    (state.cartItems ?? []).forEach((it) => {
        const at = parseDay(it?.reason?.date);
        if (!Number.isFinite(at)) return;
        const d = daysUntil(at, now);
        if (d >= 0 && d <= 5) {
            push({ id: `cart:${it.id}`, urgency: 10 - d, tone: "gold", title: `${it.reason.text || "Rencanamu"} ${d === 0 ? "hari ini" : `${d} hari lagi`}`, text: `${it.name} masih di keranjang.`, action: { feature: "cart" } });
        }
    });

    (state.orders ?? []).filter((o) => o?.status === "dikirim").slice(0, 1).forEach((o) => {
        push({ id: `ship:${o.id}`, urgency: 7, tone: "ink", title: "Paketmu lagi OTW 🛵", text: `${o.order_code ?? "Pesanan"}${o.shipping_eta ? ` · perkiraan ${o.shipping_eta}` : ""}`, action: { feature: "package-tracking" } });
    });
    (state.orders ?? []).filter((o) => o?.status === "menunggu_pembayaran").slice(0, 1).forEach((o) => {
        push({ id: `pay:${o.id}`, urgency: 8, tone: "gold", title: "Pesananmu nunggu dibayar", text: `${o.order_code ?? "Pesanan"} — pembayaran selalu kamu lakukan sendiri.`, action: { feature: "my-orders", tool: "need-action" } });
    });

    (state.wishlist ?? []).forEach((w) => {
        if (num(w.priceThen) > num(w.price) && num(w.price) > 0) {
            const pct = Math.round((1 - num(w.price) / num(w.priceThen)) * 100);
            if (pct >= 5) push({ id: `drop:${w.id}`, urgency: 6 + Math.min(3, pct / 10), tone: "light", title: `Harga turun ${pct}% 📉`, text: `${w.name} yang kamu simpan.`, action: { feature: "wishlist", tool: "alerts" } });
        }
    });

    upcomingEvents(state.events ?? [], now, 7).slice(0, 2).forEach((e) => {
        push({ id: `event:${e.id ?? e.title}`, urgency: 9 - e.days, tone: "light", title: `${e.title} ${e.days === 0 ? "hari ini" : `${e.days} hari lagi`}`, text: e.kind === "ultah" ? "Kadonya udah siap belum? 🎁" : "Ada di kalendermu.", action: { feature: "calendar" } });
    });

    const b = budgetStatus(state.budget?.spent, state.budget?.limit);
    if (b.level === "warn" || b.level === "over") push({ id: "budget", urgency: b.level === "over" ? 8 : 5, tone: "ink", title: b.level === "over" ? "Batas belanja kelewat" : "Dikit lagi nyentuh batas belanja", text: b.message, action: { feature: "total-spending", tool: "budget" } });

    (state.vouchers ?? []).forEach((v) => {
        const f = voucherFit(v, state.cartTotal, now);
        if (f.expiringSoon) push({ id: `voucher:${v.code}`, urgency: 6 - f.expiringDays, tone: "gold", title: `Voucher ${v.code} ${f.expiringDays === 0 ? "hangus hari ini" : `hangus ${f.expiringDays} hari lagi`}`, text: f.usable ? "Bisa dipakai untuk keranjangmu sekarang." : "Simpan sebelum hangus.", action: { feature: "vouchers-promos" } });
    });

    if (state.takeaway?.readyAt && state.takeaway.readyAt > now && state.takeaway.readyAt - now < 3 * 3_600_000) {
        push({ id: "takeaway", urgency: 9, tone: "ink", title: "Takeaway-mu hampir jadi 🥤", text: `Siap diambil ${countdownText(state.takeaway.readyAt, now)} lagi.`, action: { feature: "takeaway-ordering" } });
    }

    return out.sort((a, b) => b.urgency - a.urgency).slice(0, 4);
}

/* ---------- Antrean & takeaway ---------- */

/** Perkiraan tunggu antrean: posisi × rata-rata menit per orang. */
export function queueWait(myNumber, nowServing, avgMinutes = 4) {
    const ahead = Math.max(0, Math.floor(num(myNumber)) - Math.floor(num(nowServing)) - 1);
    if (!num(myNumber)) return null;
    if (num(nowServing) >= num(myNumber)) return { ahead: 0, minutes: 0, text: "Giliranmu sekarang / sudah lewat" };
    const minutes = Math.round(ahead * Math.max(1, num(avgMinutes)));
    return { ahead, minutes, text: ahead === 0 ? "Kamu berikutnya!" : `${ahead} orang di depanmu · ±${minutes} menit` };
}

/** Jam ambil takeaway paling cepat (dibulatkan ke 5 menit). */
export function earliestPickup(now = Date.now(), prepMinutes = 15) {
    const t = now + Math.max(5, num(prepMinutes)) * 60_000;
    return Math.ceil(t / 300_000) * 300_000;
}

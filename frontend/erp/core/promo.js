/**
 * KANTOONG ERP — PROMO OTOMATIS (Tahap 4 POS Pro) — logika murni, dites otomatis
 * File: frontend/erp/core/promo.js
 *
 * Pertanyaan terbalik: "Kenapa promo kafe sering MEMBAKAR uang?"
 *   1. Diskon diberikan di jam yang sudah ramai (pembeli tetap datang tanpa diskon).
 *   2. Tidak ada yang tahu apakah promo benar-benar menambah omzet.
 *   3. Promo dipilih karena ikut-ikutan kompetitor, bukan dari data sendiri.
 * Jawaban Anachronos:
 *   - PROMO YANG MEMBUKTIKAN DIRINYA SENDIRI: tiap promo punya laporan omzet di jamnya,
 *     dibanding periode yang sama SEBELUM promo, sudah dipotong diskon -> untung / impas / boncos.
 *   - SARAN PROMO DARI DATA: jam sepi -> jam hemat; stok lambat laku -> paket dengan best seller.
 *
 * RUMUS applyPromos SAMA dengan erp_pos_checkout_v2 di db/erp-pos-pro.sql.
 * Promo tidak berlaku untuk pesanan ojol (aplikasi punya promo sendiri, harganya sudah dinaikkan).
 */

export const PROMO_KINDS = Object.freeze({
    happy_hour: { label: "Jam hemat", hint: "Diskon % untuk menu tertentu di hari & jam tertentu" },
    bundle: { label: "Paket hemat", hint: "Beli beberapa menu bersama, harga dipotong per paket" },
});

export const DAY_NAMES = Object.freeze(["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]);

const DAY = 86400000;
const money = (value) => Math.round(Number(value) || 0);

/** Waktu WIB: hari (0 = Minggu), menit sejak 00:00, dan tanggal YYYY-MM-DD. */
export function wibParts(date = new Date()) {
    const shifted = new Date(new Date(date).getTime() + 7 * 3600000);
    return {
        day: shifted.getUTCDay(),
        minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
        hour: shifted.getUTCHours(),
        date: shifted.toISOString().slice(0, 10),
    };
}

/** "14:30" -> 870. Kosong / salah = null. */
export function toMinutes(text) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(text || "").trim());
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 24 || minutes > 59) return null;
    return Math.min(hours * 60 + minutes, 1440);
}

/** Bersihkan promo dari form / database. */
export function cleanPromo(promo = {}) {
    const kind = PROMO_KINDS[promo.kind] ? promo.kind : "happy_hour";
    const days = [...new Set((promo.days || []).map(Number).filter((day) => day >= 0 && day <= 6))].sort();
    return {
        ...promo,
        name: String(promo.name || "").trim().slice(0, 60),
        kind,
        percent: kind === "happy_hour" ? Math.min(Math.max(Math.round(Number(promo.percent) || 0), 0), 90) : 0,
        product_ids: (promo.product_ids || []).map(String),
        categories: (promo.categories || []).map(String),
        days: days.length === 7 ? [] : days,
        start_time: toMinutes(promo.start_time) === null ? "" : String(promo.start_time).trim(),
        end_time: toMinutes(promo.end_time) === null ? "" : String(promo.end_time).trim(),
        bundle_ids: kind === "bundle" ? [...new Set((promo.bundle_ids || []).map(String))].slice(0, 5) : [],
        bundle_amount: kind === "bundle" ? Math.max(0, money(promo.bundle_amount)) : 0,
        members_only: Boolean(promo.members_only),
        starts_on: promo.starts_on || null,
        ends_on: promo.ends_on || null,
        is_active: promo.is_active !== false,
    };
}

/** Pesan kesalahan form promo, atau "" bila sudah benar. */
export function validatePromo(promo) {
    const clean = cleanPromo(promo);
    if (!clean.name) return "Beri nama promonya.";
    if (clean.kind === "happy_hour" && (clean.percent < 1 || clean.percent > 90)) return "Diskon jam hemat 1–90%.";
    if (clean.kind === "bundle" && clean.bundle_ids.length < 2) return "Paket hemat butuh minimal 2 menu berbeda.";
    if (clean.kind === "bundle" && clean.bundle_amount < 500) return "Isi potongan per paket (minimal Rp 500).";
    if (Boolean(clean.start_time) !== Boolean(clean.end_time)) return "Isi jam mulai DAN jam selesai (atau kosongkan keduanya = sepanjang hari).";
    if (clean.starts_on && clean.ends_on && clean.ends_on < clean.starts_on) return "Tanggal selesai sebelum tanggal mulai.";
    return "";
}

/** Apakah jam & hari promo cocok dengan waktu ini (tanpa melihat tanggal berlaku / aktif). */
export function inPromoWindow(promo, date = new Date()) {
    const { day, minutes } = wibParts(date);
    if ((promo.days || []).length && !promo.days.map(Number).includes(day)) return false;
    const start = toMinutes(promo.start_time);
    const end = toMinutes(promo.end_time);
    if (start === null || end === null || start === end) return true;
    // Lewat tengah malam (mis. 22:00–02:00).
    return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

/** Promo berlaku sekarang: aktif, dalam tanggal berlaku, dan dalam jam/hari promo. */
export function promoActive(promo, date = new Date()) {
    if (!promo || promo.is_active === false) return false;
    const { date: today } = wibParts(date);
    if (promo.starts_on && today < promo.starts_on) return false;
    if (promo.ends_on && today > promo.ends_on) return false;
    return inPromoWindow(promo, date);
}

const targets = (promo, item, products) => {
    const ids = promo.product_ids || [];
    const categories = promo.categories || [];
    if (!ids.length && !categories.length) return true;
    if (ids.map(String).includes(String(item.product_id))) return true;
    const product = products.find((entry) => String(entry.id) === String(item.product_id));
    return categories.includes(product?.category || "Umum");
};

/**
 * Hitung potongan promo otomatis.
 * items: hasil harga per baris ({ product_id, qty, line_total }).
 * Urutan: semua JAM HEMAT dulu (per baris, 1 baris maksimal 1 promo), lalu PAKET HEMAT
 * dari unit yang belum kena jam hemat. Total potongan tidak melebihi subtotal.
 */
export function applyPromos({ items = [], products = [], promos = [], now = new Date(), member = false } = {}) {
    const usable = promos.filter((promo) => promoActive(promo, now) && (!promo.members_only || member));
    const covered = items.map(() => false);
    const applied = [];
    const add = (promo, amount) => {
        if (amount <= 0) return;
        const found = applied.find((row) => row.promo_id === promo.id);
        if (found) found.amount += amount;
        else applied.push({ promo_id: promo.id, name: promo.name, kind: promo.kind, amount });
    };

    for (const promo of usable.filter((entry) => entry.kind === "happy_hour")) {
        const percent = Math.min(Math.max(Number(promo.percent) || 0, 0), 90);
        if (!percent) continue;
        items.forEach((item, index) => {
            if (covered[index] || !targets(promo, item, products)) return;
            covered[index] = true;
            add(promo, Math.round((money(item.line_total) * percent) / 100));
        });
    }

    // Unit yang masih bebas per produk (belum kena jam hemat).
    const free = new Map();
    items.forEach((item, index) => {
        if (covered[index]) return;
        const id = String(item.product_id);
        free.set(id, (free.get(id) || 0) + (Number(item.qty) || 0));
    });

    for (const promo of usable.filter((entry) => entry.kind === "bundle")) {
        const ids = [...new Set((promo.bundle_ids || []).map(String))];
        const amount = money(promo.bundle_amount);
        if (ids.length < 2 || amount <= 0) continue;
        const sets = Math.min(...ids.map((id) => free.get(id) || 0));
        if (sets < 1) continue;
        ids.forEach((id) => free.set(id, free.get(id) - sets));
        add(promo, sets * amount);
    }

    const subtotal = items.reduce((sum, item) => sum + money(item.line_total), 0);
    let total = applied.reduce((sum, row) => sum + row.amount, 0);
    // Pengaman: potongan tidak boleh melebihi subtotal (promo terakhir dipangkas).
    for (let index = applied.length - 1; index >= 0 && total > subtotal; index -= 1) {
        const cut = Math.min(applied[index].amount, total - subtotal);
        applied[index].amount -= cut;
        total -= cut;
    }
    return { discount: total, applied: applied.filter((row) => row.amount > 0) };
}

/** Teks jadwal promo: "Sen–Jum · 14:00–16:00". */
export function scheduleText(promo) {
    const days = (promo.days || []).length ? promo.days.map((day) => DAY_NAMES[day]).join(", ") : "Setiap hari";
    const hours = promo.start_time && promo.end_time ? `${promo.start_time}–${promo.end_time}` : "sepanjang hari";
    return `${days} · ${hours}`;
}

/* =========================================================
   PROMO YANG MEMBUKTIKAN DIRINYA SENDIRI
   Bandingkan omzet di jam/hari promo SETELAH promo mulai dengan jam/hari yang
   sama dalam periode sepanjang itu SEBELUM promo mulai. Omzet = total struk
   (sudah dipotong diskon), jadi kenaikan yang tampil adalah kenaikan BERSIH.
   ========================================================= */

const countWindowDays = (promo, fromMs, toMs) => {
    let days = 0;
    const seen = new Set();
    for (let at = fromMs; at < toMs; at += DAY / 2) {
        const parts = wibParts(at);
        if (seen.has(parts.date)) continue;
        seen.add(parts.date);
        if (!(promo.days || []).length || promo.days.map(Number).includes(parts.day)) days += 1;
    }
    return days;
};

export function promoReport(promo, sales = [], now = new Date(), { maxDays = 28, gross = null } = {}) {
    const nowMs = new Date(now).getTime();
    const startMs = promo.starts_on
        ? new Date(`${promo.starts_on}T00:00:00+07:00`).getTime()
        : new Date(promo.created_at || nowMs).getTime();
    const endMs = Math.min(nowMs, promo.ends_on ? new Date(`${promo.ends_on}T23:59:59+07:00`).getTime() : nowMs);
    const span = Math.min(Math.max(endMs - startMs, DAY), maxDays * DAY);
    const afterFrom = Math.max(startMs, endMs - span);
    const beforeFrom = startMs - span;

    const live = sales.filter((sale) => sale.status !== "batal" && !["gofood", "grabfood", "shopeefood"].includes(sale.channel));
    const within = (from, to) => live.filter((sale) => {
        const at = new Date(sale.created_at).getTime();
        return at >= from && at < to && inPromoWindow(promo, sale.created_at);
    });

    const after = within(afterFrom, endMs + 1);
    const before = within(beforeFrom, startMs);
    const daysAfter = countWindowDays(promo, afterFrom, endMs);
    const daysBefore = countWindowDays(promo, beforeFrom, startMs);
    const revenue = (list) => list.reduce((sum, sale) => sum + money(sale.total), 0);

    const used = live.filter((sale) => (sale.promos || []).some((row) => row.promo_id === promo.id));
    const cost = used.reduce((sum, sale) => sum + (sale.promos || []).filter((row) => row.promo_id === promo.id).reduce((total, row) => total + money(row.amount), 0), 0);

    const avgAfter = daysAfter ? revenue(after) / daysAfter : 0;
    const avgBefore = daysBefore ? revenue(before) / daysBefore : 0;
    const lift = Math.round((avgAfter - avgBefore) * daysAfter);
    // Tahap 5: laba kotor (omzet − pajak/service − HPP) per hari di jam promo, bila HPP tersedia.
    const grossOf = (list) => list.reduce((sum, sale) => sum + money(gross(sale)), 0);
    const grossAfter = gross && daysAfter ? Math.round(grossOf(after) / daysAfter) : null;
    const grossBefore = gross && daysBefore ? Math.round(grossOf(before) / daysBefore) : null;
    const txAfter = daysAfter ? after.length / daysAfter : 0;
    const txBefore = daysBefore ? before.length / daysBefore : 0;

    // Kejujuran: omzet di jam promo bisa naik karena hal lain. Bila promo jarang dipakai
    // dibanding transaksi di jamnya, kenaikan TIDAK diklaim sebagai hasil promo.
    const share = after.length ? used.filter((sale) => after.includes(sale)).length / after.length : 0;

    let verdict;
    if (!used.length) verdict = { tone: "", key: "belum", text: "Belum pernah dipakai. Cek jam & menunya, atau umumkan promonya ke pelanggan." };
    else if (!before.length || daysAfter < 3) verdict = { tone: "", key: "kurang", text: "Data belum cukup untuk dinilai (butuh ≥ 3 hari promo & data sebelum promo)." };
    else if (lift > 0 && share < 0.15) verdict = { tone: "warn", key: "bukan", text: `Belum terbukti: omzet di jam ini memang naik, tapi promo hanya dipakai ${used.length}× dari ${after.length} transaksi. Kenaikannya kemungkinan BUKAN karena promo — jangan diklaim berhasil dulu.` };
    else if (lift > cost * 0.1) verdict = { tone: "good", key: "untung", text: `Promo membayar dirinya sendiri: omzet di jam promo naik ${rupiahText(lift)} dibanding sebelum promo, SUDAH setelah diskon ${rupiahText(cost)}.` };
    else if (lift >= -cost * 0.25) verdict = { tone: "warn", key: "impas", text: `Impas: omzet hampir sama dengan sebelum promo, tapi diskon ${rupiahText(cost)} sudah keluar. Coba ubah jam atau menunya.` };
    else verdict = { tone: "late", key: "boncos", text: `Promo membakar uang: omzet di jam promo justru ${rupiahText(Math.abs(lift))} lebih rendah dari sebelum promo, plus diskon ${rupiahText(cost)}. Pertimbangkan hentikan.` };

    return {
        promo_id: promo.id,
        uses: used.length,
        cost,
        daysAfter,
        daysBefore,
        revenueAfter: revenue(after),
        revenueBefore: revenue(before),
        avgAfter: Math.round(avgAfter),
        avgBefore: Math.round(avgBefore),
        txAfter: Math.round(txAfter * 10) / 10,
        txBefore: Math.round(txBefore * 10) / 10,
        lift,
        grossAfter,
        grossBefore,
        grossLift: grossAfter === null || grossBefore === null ? null : (grossAfter - grossBefore) * daysAfter,
        share: Math.round(share * 100),
        verdict,
    };
}

function rupiahText(value) {
    return `Rp ${Math.round(Number(value) || 0).toLocaleString("id-ID")}`;
}

/* =========================================================
   SARAN PROMO DARI DATA (bukan ikut-ikutan kompetitor)
   ========================================================= */

const pad = (hour) => `${String(hour % 24).padStart(2, "0")}:00`;

/**
 * - Jam sepi: blok 2 jam dengan omzet terendah di antara jam buka (< 45% jam tersibuk) -> jam hemat 15%.
 * - Stok lambat laku: stok tinggi tapi jarang terjual 14 hari -> paket dengan best seller.
 * Mengembalikan draf promo siap pakai + alasannya dalam bahasa biasa.
 */
export function suggestPromos({ sales = [], products = [], stock = {}, promos = [], now = new Date() } = {}) {
    const nowMs = new Date(now).getTime();
    const live = sales.filter((sale) => sale.status !== "batal" && new Date(sale.created_at).getTime() >= nowMs - 28 * DAY);
    const suggestions = [];
    const today = wibParts(now).date;

    // ---------- Jam sepi ----------
    const byHour = new Map();
    const daysSeen = new Set();
    for (const sale of live) {
        const { hour, date } = wibParts(sale.created_at);
        byHour.set(hour, (byHour.get(hour) || 0) + money(sale.total));
        daysSeen.add(date);
    }
    const open = [...byHour.keys()].sort((a, b) => a - b);
    // Jam yang sudah ditutup jam hemat aktif tidak disarankan lagi.
    const covered = (hour) => promos.some((promo) => promo.kind === "happy_hour" && promo.is_active !== false
        && inPromoWindow({ ...promo, days: [] }, new Date(`2026-01-01T${String(hour % 24).padStart(2, "0")}:30:00+07:00`)));
    if (open.length >= 4 && daysSeen.size >= 7) {
        const perDay = (hour) => (byHour.get(hour) || 0) / daysSeen.size;
        const peakHour = open.reduce((best, hour) => (perDay(hour) > perDay(best) ? hour : best), open[0]);
        let quiet = null;
        for (const hour of open) {
            if (!byHour.has(hour + 1) || covered(hour) || covered(hour + 1)) continue;
            const value = perDay(hour) + perDay(hour + 1);
            if (!quiet || value < quiet.value) quiet = { hour, value };
        }
        if (quiet && quiet.value / 2 < perDay(peakHour) * 0.45) {
            const share = Math.round((quiet.value / 2 / perDay(peakHour)) * 100);
            suggestions.push({
                key: "quiet-hours",
                title: `Jam hemat ${pad(quiet.hour)}–${pad(quiet.hour + 2)}`,
                reason: `Jam ${pad(quiet.hour)}–${pad(quiet.hour + 2)} omzet rata-rata hanya ${rupiahText(quiet.value)}/hari, sekitar ${share}% dari jam tersibuk (${pad(peakHour)}). Diskon kecil di jam sepi mengisi kursi kosong; jam ramai tetap harga normal.`,
                draft: { name: `Jam Hemat ${pad(quiet.hour)}`, kind: "happy_hour", percent: 15, start_time: pad(quiet.hour), end_time: pad(quiet.hour + 2), days: [], product_ids: [], categories: [], starts_on: today },
            });
        }
    }

    // ---------- Stok lambat laku -> paket dengan best seller ----------
    const sold = new Map();
    for (const sale of live.filter((entry) => new Date(entry.created_at).getTime() >= nowMs - 14 * DAY)) {
        for (const item of sale.items || []) sold.set(String(item.product_id), (sold.get(String(item.product_id)) || 0) + (Number(item.qty) || 0));
    }
    const ranked = products.filter((product) => Number(product.price) > 0).map((product) => ({ product, sold: sold.get(String(product.id)) || 0, stock: Number(stock[String(product.id)]) || 0 }));
    const best = ranked.slice().sort((a, b) => b.sold - a.sold)[0];
    const bundled = new Set(promos.filter((promo) => promo.kind === "bundle" && promo.is_active !== false).flatMap((promo) => promo.bundle_ids || []).map(String));
    const slow = ranked
        .filter((row) => row.stock >= 10 && row.product !== best?.product && !bundled.has(String(row.product.id)) && row.sold <= Math.max(3, (best?.sold || 0) * 0.2))
        .sort((a, b) => b.stock / (b.sold + 1) - a.stock / (a.sold + 1))[0];
    if (slow && best && best.sold > slow.sold) {
        const amount = Math.max(1000, Math.round(((Number(slow.product.price) + Number(best.product.price)) * 0.1) / 500) * 500);
        suggestions.push({
            key: `slow-${slow.product.id}`,
            title: `Paket ${slow.product.name} + ${best.product.name}`,
            reason: `${slow.product.name}: stok ${slow.stock} tapi hanya laku ${slow.sold} dalam 14 hari. ${best.product.name} paling laku (${best.sold}). Pasangkan supaya stok berputar sebelum basi/rusak.`,
            draft: { name: `Paket ${slow.product.name}`, kind: "bundle", bundle_ids: [String(slow.product.id), String(best.product.id)], bundle_amount: amount, days: [], start_time: "", end_time: "", starts_on: today },
        });
    }
    return suggestions;
}

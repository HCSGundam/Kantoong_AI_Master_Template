/**
 * KANTOONG ERP — KASIR POS PRO: HITUNGAN (logika murni, dites otomatis)
 * File: frontend/erp/core/pos-pro.js
 *
 * Tahap 1 POS Pro (setara aplikasi kasir berlangganan):
 *   - tipe pesanan / channel (dine-in, bawa pulang, delivery, ojek online)
 *     dengan harga ojol otomatis lebih tinggi (markup)
 *   - varian & tambahan (ukuran, level gula, topping berbayar) + catatan
 *   - service charge, pajak resto (PB1), pembulatan
 *   - bayar campuran (mis. sebagian tunai, sebagian QRIS)
 * Tahap 4: promo otomatis (promo.js), member & poin (loyalty.js).
 * Urutan potongan: promo otomatis -> diskon manual -> tukar poin -> service -> PB1 -> pembulatan.
 * RUMUS INI SAMA dengan erp_pos_checkout_v2 di db/erp-pos-pro.sql.
 * Browser hanya menampilkan; harga final selalu dihitung ulang di server.
 */

import { applyPromos } from "./promo.js";
import { pointsEarned, pointsRedeemable } from "./loyalty.js";

export const CHANNELS = Object.freeze({
    dine_in: { label: "Makan di sini", icon: "🍽️", service: true, tax: true, table: true },
    take_away: { label: "Bawa pulang", icon: "🥡", service: false, tax: true, table: false },
    delivery: { label: "Delivery toko", icon: "🛵", service: false, tax: true, table: false },
    gofood: { label: "GoFood", icon: "🟢", service: false, tax: false, online: true },
    grabfood: { label: "GrabFood", icon: "🟩", service: false, tax: false, online: true },
    shopeefood: { label: "ShopeeFood", icon: "🟧", service: false, tax: false, online: true },
});

export const PAY_METHODS = Object.freeze({
    tunai: "Tunai",
    qris: "QRIS",
    debit: "Kartu debit",
    kredit: "Kartu kredit",
    transfer: "Transfer",
    ewallet: "E-wallet",
});

export const DEFAULT_POS_SETTINGS = Object.freeze({
    service_enabled: true,
    service_rate: 5,      // % service charge (khusus makan di tempat)
    tax_enabled: true,
    tax_rate: 10,         // % PB1 / pajak restoran
    rounding: 100,        // total dibulatkan ke kelipatan ini (0 = tidak)
    online_markup: 20,    // % harga ojol di atas harga toko
    paper: 58,            // lebar kertas struk (mm): 58 / 80
    footer: "Terima kasih, sampai jumpa lagi!",
    kitchen_enabled: true, // kirim pesanan ke layar Dapur & Bar
    bar_staff: 1,          // jumlah barista bekerja bersamaan (untuk ETA Jujur)
    dapur_staff: 1,        // jumlah koki bekerja bersamaan
    discount_pin_percent: 20, // diskon di atas % ini wajib PIN atasan (Tahap 3)
    loyalty_enabled: true,    // member & poin (Tahap 4)
    points_per: 10000,        // belanja Rp sekian = 1 poin
    point_value: 100,         // 1 poin = Rp sekian saat ditukar
    online_commission: 20,    // % komisi aplikasi ojol (Tahap 5: laba per channel)
    target_food_cost: 35,     // % HPP ideal dari harga jual (saran harga)
});

const money = (value) => Math.round(Number(value) || 0);
const clampPercent = (value, max = 100) => Math.min(Math.max(Number(value) || 0, 0), max);

/** Pengaturan outlet + nilai bawaan untuk yang belum diisi. */
export function posSettings(saved = {}) {
    const merged = { ...DEFAULT_POS_SETTINGS, ...(saved || {}) };
    return {
        ...merged,
        service_rate: clampPercent(merged.service_rate, 30),
        tax_rate: clampPercent(merged.tax_rate, 30),
        online_markup: clampPercent(merged.online_markup, 100),
        rounding: [0, 100, 500, 1000].includes(Number(merged.rounding)) ? Number(merged.rounding) : 100,
        paper: Number(merged.paper) === 80 ? 80 : 58,
        service_enabled: merged.service_enabled !== false,
        tax_enabled: merged.tax_enabled !== false,
        kitchen_enabled: merged.kitchen_enabled !== false,
        bar_staff: Math.min(Math.max(Math.round(Number(merged.bar_staff) || 1), 1), 10),
        dapur_staff: Math.min(Math.max(Math.round(Number(merged.dapur_staff) || 1), 1), 10),
        discount_pin_percent: clampPercent(merged.discount_pin_percent, 100),
        loyalty_enabled: merged.loyalty_enabled !== false,
        points_per: Math.min(Math.max(Math.round(Number(merged.points_per) || 10000), 1000), 1000000),
        point_value: Math.min(Math.max(Math.round(Number(merged.point_value) || 100), 1), 10000),
        online_commission: clampPercent(merged.online_commission, 50),
        target_food_cost: Math.min(Math.max(Number(merged.target_food_cost) || 35, 10), 80),
    };
}

/** Harga per channel: ojol dinaikkan sesuai markup, dibulatkan ke atas Rp 500. */
export function channelPrice(amount, channel, settings) {
    const base = money(amount);
    if (!CHANNELS[channel]?.online || !settings.online_markup) return base;
    // Hitung dalam sen dulu agar 15000 × 120% tidak terbaca 18000,0000001 (lalu naik ke 18500).
    const raised = Math.round(base * (100 + settings.online_markup)) / 100;
    return Math.ceil(raised / 500 - 1e-9) * 500;
}

/** Grup varian/tambahan yang berlaku untuk produk ini. */
export function groupsFor(product, groups = []) {
    if (!product) return [];
    const id = String(product.id);
    return groups
        .filter((group) => group.is_active !== false)
        .filter((group) => group.applies_all
            || (group.product_ids || []).map(String).includes(id)
            || (group.categories || []).includes(product.category))
        .sort((a, b) => (a.sort || 0) - (b.sort || 0));
}

/**
 * Cek pilihan varian. selection = { [group_id]: [option_id, ...] }.
 * Mengembalikan pesan kesalahan, atau "" bila lengkap.
 */
export function validateSelection(groups, selection = {}) {
    for (const group of groups) {
        const picked = (selection[group.id] || []).filter((id) => group.options.some((option) => option.id === id));
        const max = group.max_select > 1 ? group.max_select : 1;
        if (group.required && !picked.length) return `Pilih ${group.name.toLowerCase()} dulu.`;
        if (picked.length > max) return `${group.name}: maksimal ${max} pilihan.`;
    }
    return "";
}

/** Kunci baris keranjang: produk + pilihan + catatan sama = digabung (jumlah bertambah). */
export function lineKey(productId, options = [], note = "") {
    const picked = options.map((option) => `${option.group_id}:${option.option_id}`).sort().join(",");
    return `${productId}|${picked}|${String(note || "").trim().toLowerCase()}`;
}

/**
 * Hitung pesanan.
 * lines: [{ product_id, qty, options: [{ group_id, option_id }], note }]
 * Pilihan yang tidak berlaku untuk produk itu diabaikan (tidak bisa "diselundupkan").
 */
export function priceOrder({
    lines = [], products = [], groups = [], channel = "dine_in", discount = 0, settings: saved = {},
    promos = [], now = new Date(), member = null, redeem_points: redeem = 0,
}) {
    const settings = posSettings(saved);
    const kind = CHANNELS[channel] ? channel : "dine_in";
    const items = [];
    let subtotal = 0;

    for (const line of lines) {
        const product = products.find((entry) => String(entry.id) === String(line.product_id));
        const qty = Math.floor(Number(line.qty) || 0);
        if (!product || qty < 1) continue;

        const allowed = groupsFor(product, groups);
        const options = [];
        for (const pick of line.options || []) {
            const group = allowed.find((entry) => entry.id === pick.group_id);
            const option = group?.options.find((entry) => entry.id === pick.option_id);
            if (option) options.push({ group_id: group.id, option_id: option.id, group: group.name, name: option.name, price: money(option.price) });
        }

        const unit = channelPrice(money(product.price) + options.reduce((sum, option) => sum + option.price, 0), kind, settings);
        const note = String(line.note || "").trim().slice(0, 120);
        items.push({
            key: lineKey(product.id, options, note),
            product_id: String(product.id),
            name: product.name,
            qty,
            unit_price: unit,
            options,
            note,
            line_total: unit * qty,
        });
        subtotal += unit * qty;
    }

    // Promo otomatis (tidak untuk ojol), lalu diskon manual, lalu tukar poin member.
    const rules = CHANNELS[kind];
    const promo = rules.online ? { discount: 0, applied: [] } : applyPromos({ items, products, promos, now, member: Boolean(member) });
    const promoCut = Math.min(promo.discount, subtotal);
    const cut = Math.min(Math.max(money(discount), 0), subtotal - promoCut);
    const redeemed = member
        ? pointsRedeemable({ requested: redeem, balance: member.points, remaining: subtotal - promoCut - cut, settings })
        : { points: 0, value: 0 };
    const base = subtotal - promoCut - cut - redeemed.value;
    const service = rules.service && settings.service_enabled ? Math.round((base * settings.service_rate) / 100) : 0;
    const tax = rules.tax && settings.tax_enabled ? Math.round(((base + service) * settings.tax_rate) / 100) : 0;
    const raw = base + service + tax;
    const total = settings.rounding ? Math.round(raw / settings.rounding) * settings.rounding : raw;

    return {
        channel: kind,
        items,
        subtotal,
        promo_discount: promoCut,
        promos: promo.applied,
        discount: cut,
        points_used: redeemed.points,
        points_value: redeemed.value,
        points_earned: member ? pointsEarned(base, settings) : 0,
        service,
        tax,
        rounding: total - raw,
        total: Math.max(0, total),
    };
}

/**
 * Bayar (boleh campuran). payments: [{ method, amount }].
 * Non-tunai tidak boleh melebihi sisa tagihan; kembalian hanya dari tunai.
 */
export function settlePayments(total, payments = []) {
    const rows = payments
        .map((row) => ({ method: PAY_METHODS[row.method] ? row.method : "tunai", amount: money(row.amount) }))
        .filter((row) => row.amount > 0);
    const nonCash = rows.filter((row) => row.method !== "tunai").reduce((sum, row) => sum + row.amount, 0);
    const cash = rows.filter((row) => row.method === "tunai").reduce((sum, row) => sum + row.amount, 0);

    if (nonCash > total) {
        return { ok: false, paid: nonCash + cash, change: 0, remaining: 0, problem: "Pembayaran non-tunai melebihi total. Kurangi nominalnya.", applied: [] };
    }

    const cashNeeded = total - nonCash;
    const change = Math.max(0, cash - cashNeeded);
    const remaining = Math.max(0, cashNeeded - cash);

    // Uang yang benar-benar masuk per metode (tunai sudah dikurangi kembalian).
    const applied = [];
    const add = (method, amount) => {
        if (amount <= 0) return;
        const found = applied.find((row) => row.method === method);
        if (found) found.amount += amount;
        else applied.push({ method, amount });
    };
    rows.filter((row) => row.method !== "tunai").forEach((row) => add(row.method, row.amount));
    add("tunai", Math.min(cash, cashNeeded));

    return {
        ok: remaining === 0 && total >= 0,
        paid: nonCash + cash,
        change,
        remaining,
        problem: remaining ? "Pembayaran masih kurang." : "",
        applied,
    };
}

/** Label metode untuk laporan: satu metode, atau "Campuran". */
export function methodLabel(applied = []) {
    if (applied.length > 1) return "Campuran";
    return PAY_METHODS[applied[0]?.method] || "—";
}

/**
 * Jurnal penjualan kasir: kas/bank per metode (debit) ↔ penjualan,
 * pendapatan service, utang pajak PB1 (kredit). Pembulatan masuk penjualan.
 */
export function saleJournalLines(priced, applied) {
    const debit = {};
    for (const row of applied) {
        const code = row.method === "tunai" ? "1-1000" : "1-1100";
        debit[code] = (debit[code] || 0) + row.amount;
    }
    const lines = Object.entries(debit).map(([account_code, amount]) => ({ account_code, debit: amount, credit: 0 }));
    const revenue = priced.total - (priced.service || 0) - (priced.tax || 0);
    if (revenue > 0) lines.push({ account_code: "4-1100", debit: 0, credit: revenue });
    if (priced.service > 0) lines.push({ account_code: "4-1200", debit: 0, credit: priced.service });
    if (priced.tax > 0) lines.push({ account_code: "2-1200", debit: 0, credit: priced.tax });
    return lines;
}

/** Nama pesanan untuk layar & struk: "Meja 5", "Kak Rina", atau tipe pesanan. */
export function orderLabel({ channel, table_no: table, customer_name: name } = {}) {
    const parts = [];
    if (table) parts.push(`Meja ${String(table).trim()}`);
    if (name) parts.push(String(name).trim());
    return parts.join(" · ") || CHANNELS[channel]?.label || "Pesanan";
}

/* ---------- Pengelola varian: teks "Nama = harga" per baris ---------- */

const slug = (text) => String(text).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/**
 * "Regular\nLarge = 5000\nExtra boba = 5.000" -> [{ id, name, price }].
 * Id pilihan lama dipertahankan bila namanya sama (pesanan tersimpan tetap cocok).
 */
export function parseOptionLines(text, previous = []) {
    const used = new Set();
    const options = [];
    for (const raw of String(text || "").split(/\r?\n/)) {
        const [namePart, pricePart = "0"] = raw.split("=");
        const name = namePart.trim().slice(0, 40);
        if (!name) continue;
        const price = Math.max(0, Math.round(Number(String(pricePart).replace(/[^\d]/g, "")) || 0));
        const old = previous.find((option) => option.name.toLowerCase() === name.toLowerCase());
        let id = old?.id || slug(name) || `opsi-${options.length + 1}`;
        while (used.has(id)) id = `${id}-${options.length + 1}`;
        used.add(id);
        options.push({ id, name, price });
    }
    return options.slice(0, 20);
}

export function formatOptionLines(options = []) {
    return options.map((option) => (option.price ? `${option.name} = ${option.price}` : option.name)).join("\n");
}

/* =========================================================
   PENJUALAN YANG HILANG (lost sales) — lapisan Zero-to-One
   POS biasa hanya mencatat yang TERJUAL. Pertanyaan terbaliknya:
   "berapa uang yang pergi dari kasir hari ini, dan kenapa?"
   Dicatat dengan 1 ketukan: menu habis yang tetap diminta, item yang
   dibatalkan (kemahalan / kelamaan / ganti pilihan). Data ini juga
   bahan "alasan tidak membeli" di Kantoong Index.
   ========================================================= */

export const LOST_REASONS = Object.freeze({
    habis: "Stok habis",
    harga: "Kemahalan",
    lama: "Kelamaan antri",
    ganti: "Ganti pilihan",
    batal: "Batal pesan",
    lainnya: "Lainnya",
});

/** Ringkas penjualan hilang: total rupiah, per alasan, per produk. */
export function summarizeLost(entries = []) {
    const byReason = {};
    const byProduct = {};
    let value = 0;
    let count = 0;
    for (const entry of entries) {
        const amount = Math.max(0, Math.round(Number(entry.value) || 0));
        const reason = LOST_REASONS[entry.reason] ? entry.reason : "lainnya";
        value += amount;
        count += Math.max(1, Number(entry.qty) || 1);
        byReason[reason] = (byReason[reason] || 0) + amount;
        const key = entry.name || "?";
        byProduct[key] = (byProduct[key] || 0) + amount;
    }
    const top = (map) => Object.entries(map).sort((a, b) => b[1] - a[1]);
    return { value, count, byReason: top(byReason), byProduct: top(byProduct) };
}

/* ---------- Kirim ke dapur/bar tanpa dobel ---------- */

/**
 * Baris yang BELUM dikirim ke dapur. sent = { [lineKey]: qty sudah dikirim }.
 * Bill yang ditambah pesanan hanya mengirim tambahannya.
 */
export function unsentLines(lines = [], sent = {}) {
    return lines
        .map((line) => ({ ...line, qty: Math.max(0, (Number(line.qty) || 0) - (Number(sent[line.key]) || 0)) }))
        .filter((line) => line.qty > 0);
}

export function markSent(lines = [], sent = {}) {
    const next = { ...sent };
    for (const line of lines) next[line.key] = Math.max(Number(next[line.key]) || 0, Number(line.qty) || 0);
    return next;
}

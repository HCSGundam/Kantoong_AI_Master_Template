/**
 * KANTOONG ERP — RESEP, BAHAN BAKU & HPP (Tahap 5 POS Pro) — logika murni, dites otomatis
 * File: frontend/erp/core/recipe.js
 *
 * Pertanyaan terbalik: "Kenapa kafe RAMAI tapi tetap rugi, dan bagaimana bahan hilang tanpa ketahuan?"
 *   1. Harga ditentukan dari perasaan, HPP tidak diketahui (apalagi per varian: Large, topping, less sugar)
 *      -> HPP OTOMATIS per menu + per varian dari resep.
 *   2. Menu baru ketahuan habis saat pelanggan sudah memesan
 *      -> HABIS OTOMATIS: "bisa dibuat N porsi lagi" dari stok bahan.
 *   3. Bahan hilang (takaran berlebih, tumpah, dicuri) tidak pernah terlihat
 *      -> BAHAN YANG HILANG: hasil hitung stok vs pemakaian menurut resep, dalam Rupiah + dugaan penyebab.
 *   4. Bahan habis di jam ramai -> PERINGATAN BELANJA dari kecepatan pemakaian nyata.
 *   5. "Harga ojol sudah dinaikkan 20%" padahal komisi 20% -> tetap rugi dibanding jual di toko
 *      -> LABA PER CHANNEL + kenaikan harga ojol minimal yang aman.
 * RUMUS PEMAKAIAN BAHAN SAMA dengan erp_pos_checkout_v2 di db/erp-pos-pro.sql.
 */

import { channelPrice } from "./pos-pro.js";

export const UNITS = Object.freeze({ gram: "gram", ml: "ml", pcs: "pcs" });

export const WASTE_REASONS = Object.freeze({
    basi: "Basi / kedaluwarsa",
    tumpah: "Tumpah / jatuh",
    salah: "Salah buat (dibuat ulang)",
    sampel: "Tester / sampel",
    lainnya: "Lainnya",
});

export const MENU_CLASSES = Object.freeze({
    bintang: { label: "⭐ Bintang", tone: "good", advice: "Laris & untung besar. Jaga kualitas, taruh paling depan di menu." },
    kuda: { label: "🐴 Kuda kerja", tone: "warn", advice: "Laris tapi untung tipis. Naikkan harga sedikit atau kecilkan modalnya." },
    teka: { label: "❓ Teka-teki", tone: "", advice: "Untung besar tapi jarang dipesan. Tawarkan lewat kasir/AI atau jadikan paket." },
    beban: { label: "🐢 Beban", tone: "late", advice: "Jarang laku & untung tipis. Pertimbangkan dihapus dari menu." },
});

const DAY = 86400000;
const money = (value) => Math.round(Number(value) || 0);
const num = (value) => Number(value) || 0;
const optionKey = (option) => `${option.group_id}:${option.option_id}`;

/** Bersihkan baris resep. Resep varian boleh minus (mis. less sugar = gula −7 ml). */
export function cleanRecipeItems(items = [], ingredients = [], { allowNegative = false } = {}) {
    const known = new Set(ingredients.map((entry) => entry.id));
    const merged = new Map();
    for (const item of items) {
        const qty = Math.round(num(item.qty) * 100) / 100;
        if (!known.has(item.ingredient_id) || !qty || (!allowNegative && qty < 0)) continue;
        merged.set(item.ingredient_id, (merged.get(item.ingredient_id) || 0) + qty);
    }
    return [...merged].map(([ingredient_id, qty]) => ({ ingredient_id, qty })).filter((item) => item.qty !== 0);
}

export function hasRecipe(productId, recipes = {}) {
    return (recipes[String(productId)] || []).length > 0;
}

/** Pemakaian bahan untuk SATU porsi item (resep dasar + penyesuaian varian, tidak pernah minus). */
export function itemUsage(item, recipes = {}, optionRecipes = {}) {
    const usage = new Map();
    const add = (rows) => rows.forEach((row) => usage.set(row.ingredient_id, (usage.get(row.ingredient_id) || 0) + num(row.qty)));
    add(recipes[String(item.product_id)] || []);
    if (!usage.size) return usage;
    for (const option of item.options || []) add(optionRecipes[optionKey(option)] || []);
    for (const [id, qty] of usage) usage.set(id, Math.max(0, Math.round(qty * 100) / 100));
    return usage;
}

/** Pemakaian bahan untuk seluruh pesanan. items: [{ product_id, qty, options: [{ group_id, option_id }] }]. */
export function orderUsage(items = [], recipes = {}, optionRecipes = {}) {
    const total = new Map();
    for (const item of items) {
        const qty = Math.max(0, Math.floor(num(item.qty)));
        for (const [id, used] of itemUsage(item, recipes, optionRecipes)) {
            total.set(id, Math.round(((total.get(id) || 0) + used * qty) * 100) / 100);
        }
    }
    return total;
}

/** Nilai rupiah sejumlah pemakaian bahan. */
export function usageCost(usage, ingredients = []) {
    let cost = 0;
    for (const [id, qty] of usage) cost += qty * num(ingredients.find((entry) => entry.id === id)?.cost);
    return Math.round(cost);
}

/** HPP satu porsi item (dengan varian). */
export function unitCost(item, { recipes = {}, optionRecipes = {}, ingredients = [] } = {}) {
    return usageCost(itemUsage({ ...item, qty: 1 }, recipes, optionRecipes), ingredients);
}

/** HPP sebuah struk: pakai yang tercatat saat jual, atau hitung dari resep sekarang. */
export function saleCogs(sale, context) {
    if (sale.cogs !== undefined && sale.cogs !== null) return money(sale.cogs);
    return usageCost(orderUsage(sale.items || [], context.recipes, context.optionRecipes), context.ingredients);
}

/**
 * HABIS OTOMATIS: berapa porsi lagi bisa dibuat dari stok bahan.
 * reserved = bahan yang sudah "dipesan" keranjang saat ini. Tanpa resep = null (pakai stok barang jadi).
 */
export function capacity(item, { recipes = {}, optionRecipes = {}, stock = {}, reserved = new Map(), ingredients = [] } = {}) {
    const usage = itemUsage({ ...item, qty: 1 }, recipes, optionRecipes);
    if (!usage.size) return null;
    let portions = Infinity;
    let limiting = null;
    for (const [id, need] of usage) {
        if (need <= 0) continue;
        const left = num(stock[id]) - num(reserved.get?.(id) ?? reserved[id]);
        const can = Math.max(0, Math.floor((left + 1e-9) / need));
        if (can < portions) {
            portions = can;
            limiting = id;
        }
    }
    if (portions === Infinity) return { portions: 999, limiting: null, name: null };
    return { portions, limiting, name: ingredients.find((entry) => entry.id === limiting)?.name || null };
}

/** Rata-rata tertimbang harga bahan setelah belanja. */
export function weightedCost(stockQty, oldCost, buyQty, buyTotal) {
    const have = Math.max(0, num(stockQty));
    const qty = num(buyQty);
    if (qty <= 0) return num(oldCost);
    return Math.round(((have * num(oldCost) + money(buyTotal)) / (have + qty)) * 100) / 100;
}

/** "Susu segar = 150\nGula cair = -7" -> { items, unknown }. Nama bahan tidak peka huruf besar/kecil. */
export function parseRecipeLines(text, ingredients = [], { allowNegative = false } = {}) {
    const items = [];
    const unknown = [];
    for (const raw of String(text || "").split(/\r?\n/)) {
        if (!raw.trim()) continue;
        const [namePart, qtyPart = ""] = raw.split("=");
        const name = namePart.trim().toLowerCase();
        const qty = Number(String(qtyPart).replace(",", ".").replace(/[^\d.-]/g, ""));
        const found = ingredients.find((entry) => entry.name.toLowerCase() === name);
        if (!found || !Number.isFinite(qty) || !qty || (!allowNegative && qty < 0)) {
            unknown.push(namePart.trim());
            continue;
        }
        items.push({ ingredient_id: found.id, qty });
    }
    return { items: cleanRecipeItems(items, ingredients, { allowNegative }), unknown };
}

export function formatRecipeLines(items = [], ingredients = []) {
    return items
        .map((item) => `${ingredients.find((entry) => entry.id === item.ingredient_id)?.name || "?"} = ${item.qty}`)
        .join("\n");
}

/** Pemakaian per bahan dari penjualan dalam rentang waktu. */
export function salesUsage(sales = [], context, { from = -Infinity, to = Infinity } = {}) {
    const items = sales
        .filter((sale) => sale.status !== "batal")
        .filter((sale) => {
            const at = new Date(sale.created_at).getTime();
            return at >= from && at < to;
        })
        .flatMap((sale) => sale.items || []);
    return orderUsage(items, context.recipes, context.optionRecipes);
}

/**
 * PERINGATAN BELANJA: kecepatan pemakaian nyata 14 hari -> habis dalam berapa hari,
 * dan saran jumlah beli untuk 7 hari ke depan.
 */
export function burnForecast({ ingredients = [], stock = {}, sales = [], recipes = {}, optionRecipes = {}, now = new Date(), days = 14, coverDays = 7 } = {}) {
    const nowMs = new Date(now).getTime();
    const usage = salesUsage(sales, { recipes, optionRecipes }, { from: nowMs - days * DAY, to: nowMs + 1 });
    return ingredients
        .filter((entry) => entry.is_active !== false)
        .map((ingredient) => {
            const left = num(stock[ingredient.id]);
            const perDay = Math.round(((usage.get(ingredient.id) || 0) / days) * 10) / 10;
            const daysLeft = perDay > 0 ? Math.round((left / perDay) * 10) / 10 : null;
            const buyQty = perDay > 0 ? Math.max(0, Math.ceil(perDay * coverDays - left)) : 0;
            const low = left <= num(ingredient.min_stock);
            const tone = left <= 0 ? "late" : (daysLeft !== null && daysLeft < 1.5) || low ? "late" : daysLeft !== null && daysLeft < 3 ? "warn" : "ok";
            return { ingredient, stock: left, perDay, daysLeft, buyQty, buyValue: Math.round(buyQty * num(ingredient.cost)), tone };
        })
        .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
}

/**
 * BAHAN YANG HILANG: dari hitung stok (opname) & catatan buang.
 * moves: [{ ingredient_id, kind: "opname"|"buang"|..., delta, reason, created_at }]
 * usage: Map pemakaian menurut resep pada periode yang sama (pembanding).
 */
export function lossReport({ moves = [], ingredients = [], usage = new Map() } = {}) {
    const rows = new Map();
    const row = (id) => {
        if (!rows.has(id)) rows.set(id, { ingredient: ingredients.find((entry) => entry.id === id), lostQty: 0, wasteQty: 0, gainQty: 0, reasons: {} });
        return rows.get(id);
    };
    for (const move of moves) {
        const delta = num(move.delta);
        if (move.kind === "opname" && delta < 0) row(move.ingredient_id).lostQty += -delta;
        if (move.kind === "opname" && delta > 0) row(move.ingredient_id).gainQty += delta;
        if (move.kind === "buang" && delta < 0) {
            const entry = row(move.ingredient_id);
            entry.wasteQty += -delta;
            const reason = WASTE_REASONS[move.reason] ? move.reason : "lainnya";
            entry.reasons[reason] = (entry.reasons[reason] || 0) + -delta;
        }
    }

    const list = [...rows.values()].filter((entry) => entry.ingredient).map((entry) => {
        const cost = num(entry.ingredient.cost);
        const used = usage.get(entry.ingredient.id) || 0;
        const rate = used > 0 ? Math.round(((entry.lostQty + entry.wasteQty) / used) * 1000) / 10 : null;
        const topReason = Object.entries(entry.reasons).sort((a, b) => b[1] - a[1])[0]?.[0];
        let hint = "Masih wajar.";
        if (entry.lostQty > 0 && rate !== null && rate > 5) hint = "Hilang tanpa catatan > 5% dari pemakaian: cek takaran (gelas ukur/timbangan), bahan tumpah yang tidak dicatat, atau bahan dibawa pulang.";
        else if (entry.lostQty > 0) hint = "Ada selisih kecil saat hitung stok. Biasakan mencatat bahan yang dibuang.";
        if (topReason && entry.wasteQty > entry.lostQty) hint = `Paling banyak terbuang karena "${WASTE_REASONS[topReason]}".${topReason === "basi" ? " Belanja lebih sering dalam jumlah kecil." : ""}`;
        return {
            ...entry,
            used: Math.round(used),
            lostValue: Math.round(entry.lostQty * cost),
            wasteValue: Math.round(entry.wasteQty * cost),
            rate,
            hint,
        };
    }).sort((a, b) => b.lostValue + b.wasteValue - (a.lostValue + a.wasteValue));

    return {
        lostValue: list.reduce((sum, entry) => sum + entry.lostValue, 0),
        wasteValue: list.reduce((sum, entry) => sum + entry.wasteValue, 0),
        rows: list,
    };
}

/** Kenaikan harga ojol minimal supaya laba sama dengan jual di toko: komisi / (1 − komisi). */
export function safeOnlineMarkup(commission) {
    const rate = Math.min(Math.max(num(commission), 0), 90) / 100;
    return Math.max(0, Math.ceil((rate / (1 - rate)) * 1000 - 1e-6) / 10);
}

/**
 * HPP & laba per menu + kelas menu (laris × untung) + laba ojol setelah komisi.
 * Laris = terjual ≥ 70% rata-rata; untung besar = laba/porsi ≥ rata-rata tertimbang.
 */
export function menuCosting({ products = [], recipes = {}, optionRecipes = {}, ingredients = [], settings = {}, sales = [], now = new Date(), days = 28 } = {}) {
    const since = new Date(now).getTime() - days * DAY;
    const sold = new Map();
    for (const sale of sales) {
        if (sale.status === "batal" || new Date(sale.created_at).getTime() < since) continue;
        for (const item of sale.items || []) sold.set(String(item.product_id), (sold.get(String(item.product_id)) || 0) + num(item.qty));
    }
    const commission = Math.min(Math.max(num(settings.online_commission ?? 20), 0), 90);
    const target = Math.min(Math.max(num(settings.target_food_cost ?? 35), 5), 90);

    const rows = products.filter((product) => hasRecipe(product.id, recipes)).map((product) => {
        const price = money(product.price);
        const cost = unitCost({ product_id: product.id, options: [] }, { recipes, optionRecipes, ingredients });
        const profit = price - cost;
        const online = channelPrice(price, "gofood", settings);
        const onlineNet = Math.round(online * (1 - commission / 100));
        const onlineProfit = onlineNet - cost;
        const foodCost = price ? Math.round((cost / price) * 1000) / 10 : 0;
        return {
            product,
            price,
            cost,
            profit,
            foodCost,
            sold: sold.get(String(product.id)) || 0,
            online: { price: online, net: onlineNet, profit: onlineProfit, vsStore: onlineProfit - profit },
            suggestedPrice: foodCost > target && cost > 0 ? Math.ceil(cost / (target / 100) / 500) * 500 : null,
        };
    });

    const totalSold = rows.reduce((sum, row) => sum + row.sold, 0);
    const avgSold = rows.length ? totalSold / rows.length : 0;
    const avgProfit = totalSold ? rows.reduce((sum, row) => sum + row.profit * row.sold, 0) / totalSold : rows.reduce((sum, row) => sum + row.profit, 0) / (rows.length || 1);
    for (const row of rows) {
        const popular = row.sold >= avgSold * 0.7;
        const rich = row.profit >= avgProfit;
        row.klass = popular && rich ? "bintang" : popular ? "kuda" : rich ? "teka" : "beban";
        row.profitTotal = row.profit * row.sold;
    }
    return rows.sort((a, b) => b.profitTotal - a.profitTotal);
}

/** Ringkasan HPP & laba kotor periode: food cost % dari penjualan bersih (tanpa pajak & service). */
export function grossSummary(sales = [], context, { from = -Infinity, to = Infinity } = {}) {
    let revenue = 0;
    let cogs = 0;
    for (const sale of sales) {
        const at = new Date(sale.created_at).getTime();
        if (sale.status === "batal" || at < from || at >= to) continue;
        revenue += money(sale.total) - money(sale.service) - money(sale.tax);
        cogs += saleCogs(sale, context);
    }
    return { revenue, cogs, gross: revenue - cogs, foodCost: revenue ? Math.round((cogs / revenue) * 1000) / 10 : 0 };
}

/**
 * PREDIKSI JAM HABIS (kartu menu menipis): kecepatan jual menu ini HARI INI
 * dibagi sisa porsi. POS biasa hanya bilang "sisa 2"; kasir di sini tahu "± habis 16.20".
 * openedAt = jam mulai jualan hari ini (shift dibuka / transaksi pertama).
 */
export function sellOutAt({ left, soldToday, openedAt, now = new Date() } = {}) {
    const nowMs = new Date(now).getTime();
    const start = new Date(openedAt).getTime();
    if (!(left > 0) || !(soldToday > 0) || !Number.isFinite(start) || start >= nowMs) return null;
    const hours = Math.max(0.5, (nowMs - start) / 3600000);
    const perHour = soldToday / hours;
    return new Date(nowMs + (left / perHour) * 3600000);
}

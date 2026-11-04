/**
 * KANTOONG ERP — DATA CONTOH BAHAN BAKU, RESEP & HPP (Tahap 5 POS Pro)
 * File: frontend/erp/data/demo-seed-recipe.js
 *
 * - Bahan kedai minuman (susu, rasa per menu, gula, es, cup, topping) + stok outlet.
 * - Resep tiap menu + penyesuaian varian (Large, less sugar, tanpa es, topping).
 * - Stok sengaja bervariasi: susu habis < 2 hari (peringatan belanja), satu rasa tinggal
 *   2 porsi (habis otomatis), sisanya aman.
 * - Hitung stok 3 hari lalu dengan selisih & catatan bahan dibuang -> "Bahan yang Hilang".
 * Dipasang otomatis ke data demo lama maupun baru.
 */

import { DRINK_PATTERN } from "../core/kitchen.js";
import { salesUsage } from "../core/recipe.js";

const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString();

export function buildRecipeSeed(db, now = new Date()) {
    const nowMs = now.getTime();
    const products = db.products || [];
    const outlet = (db.warehouses || []).find((entry) => entry.kind === "outlet")?.id;
    const result = { pos_ingredients: [], pos_ingredient_stock: {}, pos_recipes: {}, pos_option_recipes: {}, pos_ingredient_moves: [], pos_restock: [] };
    if (!outlet || !products.length) return result;

    const drinks = products.filter((product) => DRINK_PATTERN.test(`${product.name} ${product.category || ""}`));
    const foods = products.filter((product) => !drinks.includes(product));

    const ingredient = (id, name, unit, cost, min_stock) => {
        result.pos_ingredients.push({ id, name, unit, cost, min_stock, is_active: true, created_at: iso(nowMs - 30 * DAY) });
        return id;
    };
    const susu = ingredient("ing-susu", "Susu segar", "ml", 18, 2000);
    const gula = ingredient("ing-gula", "Gula cair", "ml", 20, 500);
    const es = ingredient("ing-es", "Es batu", "gram", 2, 3000);
    const cup = ingredient("ing-cup", "Cup & sedotan", "pcs", 700, 50);
    const boba = ingredient("ing-boba", "Boba", "gram", 40, 300);
    const jelly = ingredient("ing-jelly", "Grass jelly", "gram", 30, 300);
    const cheese = ingredient("ing-cheese", "Cheese foam", "gram", 120, 150);
    const oat = ingredient("ing-oat", "Oat", "gram", 60, 100);
    const saus = ingredient("ing-saus", "Saus cokelat", "ml", 50, 100);
    const box = ingredient("ing-box", "Kemasan kue", "pcs", 500, 30);

    // Rasa per minuman: modal rasa ±12% harga jual.
    const flavorOf = new Map();
    drinks.forEach((product, index) => {
        const cost = Math.max(20, Math.round((Number(product.price) * 0.12) / 30));
        flavorOf.set(String(product.id), ingredient(`ing-rasa-${index + 1}`, `Rasa ${product.name}`.slice(0, 60), "gram", cost, 150));
    });
    // Kue/makanan dibeli jadi dari pemasok: modal ±40% harga jual.
    const readyOf = new Map();
    foods.forEach((product, index) => {
        readyOf.set(String(product.id), ingredient(`ing-kue-${index + 1}`, `Stok ${product.name}`.slice(0, 60), "pcs", Math.round(Number(product.price) * 0.4), 5));
    });

    for (const product of drinks) {
        result.pos_recipes[String(product.id)] = [
            { ingredient_id: susu, qty: 150 },
            { ingredient_id: flavorOf.get(String(product.id)), qty: 30 },
            { ingredient_id: gula, qty: 15 },
            { ingredient_id: es, qty: 120 },
            { ingredient_id: cup, qty: 1 },
        ];
    }
    for (const product of foods) {
        result.pos_recipes[String(product.id)] = [{ ingredient_id: readyOf.get(String(product.id)), qty: 1 }, { ingredient_id: box, qty: 1 }];
    }

    // Varian: hanya bila grup varian contoh ada.
    const groups = new Set((db.pos_modifiers || []).map((group) => group.id));
    const option = (group, id, rows) => { if (groups.has(group)) result.pos_option_recipes[`${group}:${id}`] = rows; };
    option("g-size", "large", [{ ingredient_id: susu, qty: 60 }, { ingredient_id: es, qty: 40 }]);
    option("g-sugar", "less-sugar", [{ ingredient_id: gula, qty: -7 }]);
    option("g-sugar", "no-sugar", [{ ingredient_id: gula, qty: -15 }]);
    option("g-ice", "less-ice", [{ ingredient_id: es, qty: -60 }]);
    option("g-ice", "no-ice", [{ ingredient_id: es, qty: -120 }]);
    option("g-ice", "hot", [{ ingredient_id: es, qty: -120 }]);
    option("g-topping", "boba", [{ ingredient_id: boba, qty: 50 }]);
    option("g-topping", "grass-jelly", [{ ingredient_id: jelly, qty: 50 }]);
    option("g-topping", "cheese-foam", [{ ingredient_id: cheese, qty: 30 }]);
    option("g-topping", "extra-oat", [{ ingredient_id: oat, qty: 10 }]);
    option("g-food", "choco-sauce", [{ ingredient_id: saus, qty: 15 }]);

    // ---------- Stok outlet: dari kecepatan pemakaian 14 hari ----------
    const usage = salesUsage(db.pos_sales || [], { recipes: result.pos_recipes, optionRecipes: result.pos_option_recipes }, { from: nowMs - 14 * DAY, to: nowMs + 1 });
    const perDay = (id) => (usage.get(id) || 0) / 14;
    const days = (id, count, floor = 0) => Math.max(floor, Math.round(perDay(id) * count));
    const stock = {};
    stock[susu] = days(susu, 1.3, 1500);
    stock[gula] = days(gula, 9, 1500);
    stock[es] = days(es, 6, 8000);
    stock[cup] = days(cup, 4, 80);
    stock[boba] = 1200;
    stock[jelly] = 900;
    stock[cheese] = 60;
    stock[oat] = 400;
    stock[saus] = 600;
    stock[box] = 60;
    // Rasa menu ke-2 HABIS (kartu "Etalase Malam"), rasa menu ke-1 tinggal 2 porsi (cincin menipis).
    [...flavorOf.values()].forEach((id, index) => { stock[id] = index === 1 ? 0 : index === 0 ? 60 : days(id, 5 + index * 2, 600); });
    [...readyOf.values()].forEach((id, index) => { stock[id] = index === 0 ? 14 : days(id, 4, 10); });
    result.pos_ingredient_stock[outlet] = stock;

    // ---------- Riwayat: belanja, hitung stok (opname) dengan selisih, bahan dibuang ----------
    const move = (ingredient_id, kind, delta, daysAgo, extra = {}) => result.pos_ingredient_moves.push({
        id: `im-${result.pos_ingredient_moves.length + 1}`, outlet_id: outlet, ingredient_id, kind, delta,
        unit_cost: result.pos_ingredients.find((entry) => entry.id === ingredient_id)?.cost || 0,
        reason: "", ref: "", created_by: "m-joko", created_at: iso(nowMs - daysAgo * DAY), ...extra,
    });
    for (const entry of result.pos_ingredients) {
        move(entry.id, "beli", Math.max(10, Math.round((stock[entry.id] || 0) + perDay(entry.id) * 10)), 12, { ref: "BELI-AWAL" });
    }
    move(susu, "opname", -2500, 3, { reason: "Hitung stok mingguan" });
    move(es, "opname", -1500, 3, { reason: "Hitung stok mingguan" });
    move(cup, "opname", 2, 3, { reason: "Hitung stok mingguan" });
    if (flavorOf.size) move([...flavorOf.values()][0], "opname", -90, 3, { reason: "Hitung stok mingguan" });
    move(susu, "buang", -500, 5, { reason: "basi", created_by: "m-bayu" });
    move(susu, "buang", -210, 1, { reason: "salah", created_by: "m-bayu" });
    if (readyOf.size) move([...readyOf.values()][0], "buang", -3, 2, { reason: "basi", created_by: "m-dewi" });
    move(cheese, "buang", -120, 4, { reason: "basi", created_by: "m-bayu" });

    // Permintaan restok dari kasir untuk menu yang habis (muncul di Resep & HPP).
    if (drinks[1]) {
        const flavor = flavorOf.get(String(drinks[1].id));
        result.pos_restock.push({
            id: "rs-1", outlet_id: outlet, product_id: String(drinks[1].id), name: drinks[1].name,
            ingredient_id: flavor, ingredient_name: result.pos_ingredients.find((entry) => entry.id === flavor)?.name || "",
            count: 2, status: "baru", requested_by: "m-dewi", created_at: iso(nowMs - 40 * 60000), last_at: iso(nowMs - 12 * 60000),
            resolved_at: null, resolved_by: null, note: "",
        });
    }

    return result;
}

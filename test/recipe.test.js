import { describe, expect, it } from "vitest";
import {
    burnForecast, capacity, cleanRecipeItems, formatRecipeLines, grossSummary, itemUsage, lossReport, menuCosting, orderUsage,
    parseRecipeLines, safeOnlineMarkup, saleCogs, unitCost, usageCost, weightedCost,
} from "../frontend/erp/core/recipe.js";
import { posSettings } from "../frontend/erp/core/pos-pro.js";

const ingredients = [
    { id: "susu", name: "Susu segar", unit: "ml", cost: 22, min_stock: 1000 },
    { id: "rasa", name: "Bubuk cokelat", unit: "gram", cost: 100, min_stock: 200 },
    { id: "gula", name: "Gula cair", unit: "ml", cost: 20, min_stock: 300 },
    { id: "cup", name: "Cup", unit: "pcs", cost: 900, min_stock: 50 },
    { id: "boba", name: "Boba", unit: "gram", cost: 40, min_stock: 0 },
];
const recipes = {
    kopi: [{ ingredient_id: "susu", qty: 150 }, { ingredient_id: "rasa", qty: 30 }, { ingredient_id: "gula", qty: 15 }, { ingredient_id: "cup", qty: 1 }],
};
const optionRecipes = {
    "g-size:large": [{ ingredient_id: "susu", qty: 60 }, { ingredient_id: "rasa", qty: 10 }],
    "g-sugar:no-sugar": [{ ingredient_id: "gula", qty: -15 }],
    "g-sugar:less-sugar": [{ ingredient_id: "gula", qty: -40 }],
    "g-top:boba": [{ ingredient_id: "boba", qty: 50 }],
};
const ctx = { recipes, optionRecipes, ingredients };
const large = { group_id: "g-size", option_id: "large" };
const noSugar = { group_id: "g-sugar", option_id: "no-sugar" };

describe("resep & HPP per varian", () => {
    it("pemakaian dasar + varian, tidak pernah minus", () => {
        expect(Object.fromEntries(itemUsage({ product_id: "kopi", options: [] }, recipes, optionRecipes))).toEqual({ susu: 150, rasa: 30, gula: 15, cup: 1 });
        expect(Object.fromEntries(itemUsage({ product_id: "kopi", options: [large, noSugar] }, recipes, optionRecipes))).toEqual({ susu: 210, rasa: 40, gula: 0, cup: 1 });
        expect(itemUsage({ product_id: "kopi", options: [{ group_id: "g-sugar", option_id: "less-sugar" }] }, recipes, optionRecipes).get("gula")).toBe(0);
        expect(itemUsage({ product_id: "tanpa-resep", options: [large] }, recipes, optionRecipes).size).toBe(0);
    });

    it("HPP per porsi & per pesanan", () => {
        expect(unitCost({ product_id: "kopi" }, ctx)).toBe(150 * 22 + 30 * 100 + 15 * 20 + 900);
        expect(unitCost({ product_id: "kopi", options: [large] }, ctx)).toBe(7500 + 60 * 22 + 1000);
        const usage = orderUsage([{ product_id: "kopi", qty: 2, options: [] }, { product_id: "kopi", qty: 1, options: [{ group_id: "g-top", option_id: "boba" }] }], recipes, optionRecipes);
        expect(usage.get("susu")).toBe(450);
        expect(usage.get("boba")).toBe(50);
        expect(usageCost(usage, ingredients)).toBe(3 * 7500 + 2000);
        expect(saleCogs({ items: [{ product_id: "kopi", qty: 2, options: [] }] }, ctx)).toBe(15000);
        expect(saleCogs({ cogs: 1234, items: [] }, ctx)).toBe(1234);
    });

    it("membaca & menulis resep dalam teks", () => {
        const { items, unknown } = parseRecipeLines("Susu segar = 150\nbubuk cokelat=30,5\nKeju = 10\n\nGula cair = -5", ingredients);
        expect(items).toEqual([{ ingredient_id: "susu", qty: 150 }, { ingredient_id: "rasa", qty: 30.5 }]);
        expect(unknown).toEqual(["Keju", "Gula cair"]);
        expect(parseRecipeLines("Gula cair = -5", ingredients, { allowNegative: true }).items).toEqual([{ ingredient_id: "gula", qty: -5 }]);
        expect(formatRecipeLines(recipes.kopi.slice(0, 2), ingredients)).toBe("Susu segar = 150\nBubuk cokelat = 30");
        expect(cleanRecipeItems([{ ingredient_id: "susu", qty: 10 }, { ingredient_id: "susu", qty: 5 }, { ingredient_id: "x", qty: 1 }], ingredients)).toEqual([{ ingredient_id: "susu", qty: 15 }]);
    });

    it("harga bahan rata-rata tertimbang setelah belanja", () => {
        expect(weightedCost(1000, 20, 1000, 24000)).toBe(22);
        expect(weightedCost(0, 20, 500, 12500)).toBe(25);
        expect(weightedCost(100, 20, 0, 0)).toBe(20);
    });
});

describe("habis otomatis dari bahan", () => {
    const stock = { susu: 1000, rasa: 300, gula: 500, cup: 100 };
    it("porsi tersisa & bahan pembatas", () => {
        expect(capacity({ product_id: "kopi", options: [] }, { ...ctx, stock })).toEqual({ portions: 6, limiting: "susu", name: "Susu segar" });
        expect(capacity({ product_id: "kopi", options: [large] }, { ...ctx, stock }).portions).toBe(4);
        expect(capacity({ product_id: "kopi", options: [] }, { ...ctx, stock, reserved: new Map([["susu", 900]]) }).portions).toBe(0);
        expect(capacity({ product_id: "lain", options: [] }, { ...ctx, stock })).toBeNull();
    });
});

describe("peringatan belanja & bahan yang hilang", () => {
    const now = new Date("2026-11-04T20:00:00+07:00");
    const sales = Array.from({ length: 14 }, (_, n) => ({
        created_at: new Date(now.getTime() - (n + 0.5) * 86400000).toISOString(),
        items: [{ product_id: "kopi", qty: 10, options: [] }],
    }));

    it("habis dalam berapa hari & saran beli 7 hari", () => {
        const forecast = burnForecast({ ingredients, stock: { susu: 2250, rasa: 3000, gula: 5000, cup: 500, boba: 0 }, sales, recipes, optionRecipes, now });
        const susu = forecast.find((row) => row.ingredient.id === "susu");
        expect(susu.perDay).toBe(1500);
        expect(susu.daysLeft).toBe(1.5);
        expect(susu.buyQty).toBe(1500 * 7 - 2250);
        expect(susu.tone).toBe("warn");
        expect(forecast[0].ingredient.id).toBe("susu");
        expect(forecast.find((row) => row.ingredient.id === "boba").tone).toBe("late");
    });

    it("selisih opname & bahan dibuang dalam rupiah + dugaan penyebab", () => {
        const report = lossReport({
            ingredients,
            usage: new Map([["susu", 10000], ["gula", 1000]]),
            moves: [
                { ingredient_id: "susu", kind: "opname", delta: -900 },
                { ingredient_id: "susu", kind: "buang", delta: -100, reason: "tumpah" },
                { ingredient_id: "gula", kind: "buang", delta: -300, reason: "basi" },
                { ingredient_id: "gula", kind: "opname", delta: 20 },
                { ingredient_id: "cup", kind: "beli", delta: 100 },
            ],
        });
        expect(report.lostValue).toBe(900 * 22);
        expect(report.wasteValue).toBe(100 * 22 + 300 * 20);
        const susu = report.rows.find((row) => row.ingredient.id === "susu");
        expect(susu.rate).toBe(10);
        expect(susu.hint).toMatch(/takaran/);
        expect(report.rows.find((row) => row.ingredient.id === "gula").hint).toMatch(/Basi/);
    });
});

describe("laba per menu & per channel", () => {
    it("kenaikan harga ojol minimal yang aman", () => {
        expect(safeOnlineMarkup(20)).toBe(25);
        expect(safeOnlineMarkup(30)).toBe(42.9);
        expect(safeOnlineMarkup(0)).toBe(0);
    });

    it("HPP, food cost, laba ojol setelah komisi, kelas menu & saran harga", () => {
        const products = [
            { id: "kopi", name: "Kopi", price: 15000 },
            { id: "teh", name: "Teh", price: 30000 },
            { id: "roti", name: "Roti", price: 10000 },
        ];
        const more = { ...recipes, teh: [{ ingredient_id: "gula", qty: 50 }, { ingredient_id: "cup", qty: 1 }], roti: [{ ingredient_id: "rasa", qty: 80 }] };
        const sales = [
            { created_at: new Date().toISOString(), items: [{ product_id: "kopi", qty: 40 }, { product_id: "teh", qty: 2 }, { product_id: "roti", qty: 3 }] },
        ];
        const settings = posSettings({ online_markup: 20, online_commission: 20, target_food_cost: 35 });
        const rows = menuCosting({ products, recipes: more, optionRecipes, ingredients, settings, sales });
        const kopi = rows.find((row) => row.product.id === "kopi");
        expect(kopi).toMatchObject({ cost: 7500, profit: 7500, foodCost: 50, sold: 40, klass: "kuda" });
        expect(kopi.online).toMatchObject({ price: 18000, net: 14400, profit: 6900, vsStore: -600 });
        expect(kopi.suggestedPrice).toBe(21500);
        expect(rows.find((row) => row.product.id === "teh").klass).toBe("teka");
        expect(rows.find((row) => row.product.id === "roti").klass).toBe("beban");
    });

    it("ringkasan laba kotor tanpa pajak & service, void tidak dihitung", () => {
        const sales = [
            { total: 18150, service: 750, tax: 1400, created_at: "2026-11-01T03:00:00Z", items: [{ product_id: "kopi", qty: 1, options: [] }] },
            { total: 99999, status: "batal", created_at: "2026-11-01T03:00:00Z", items: [{ product_id: "kopi", qty: 9 }] },
        ];
        expect(grossSummary(sales, ctx)).toEqual({ revenue: 16000, cogs: 7500, gross: 8500, foodCost: 46.9 });
    });
});

describe("resep — alur demo kasir & gudang", async () => {
    const { posProMethods } = await import("../frontend/erp/data/demo-adapter-pos.js");
    const { demoPinHash } = await import("../frontend/erp/data/demo-seed-cash.js");
    const { validateJournal } = await import("../frontend/erp/core/accounting.js");

    function setup() {
        const db = {
            products: [{ id: "kopi", name: "Kopi", price: 20000 }, { id: "botol", name: "Air Botol", price: 5000 }],
            warehouses: [{ id: "w", kind: "outlet", is_active: true }],
            members: [{ id: "m-owner", level: 5, job_role: "umum", is_active: true }],
            stock_levels: [{ warehouse_id: "w", product_id: "botol", qty: 5, min_qty: 0 }],
            pos_sales: [], pos_serial: 1, accounts: [], pos_settings: { w: { tax_enabled: false, service_enabled: false, rounding: 0 } },
            pos_modifiers: [{ id: "g-size", name: "Ukuran", is_active: true, applies_all: true, options: [{ id: "large", name: "Large", price: 5000 }] }],
            pos_bills: [], pos_tickets: [], pos_lost: [], pos_queue: {}, pos_shifts: [], pos_cash_moves: [],
            pos_pins: [{ member_id: "m-owner", pin_hash: demoPinHash("m-owner", "4826") }],
            pos_members: [], pos_points: [], pos_promos: [],
            pos_ingredients: ingredients.map((entry) => ({ ...entry })),
            pos_ingredient_stock: { w: { susu: 1000, rasa: 500, gula: 500, cup: 50 } },
            pos_recipes: { kopi: recipes.kopi }, pos_option_recipes: { "g-size:large": optionRecipes["g-size:large"] }, pos_ingredient_moves: [],
        };
        const journal = [];
        const moved = [];
        const make = (who) => posProMethods({
            db: () => db, save: () => {}, me: () => who, audit: () => {},
            journalWrite: (memo, source, ref, lines) => journal.push({ memo, ref, lines }), recordMoves: (moves) => moved.push(...moves),
        });
        return {
            db, journal, moved,
            kasir: make({ id: "m-kasir", level: 1, job_role: "kasir" }),
            gudang: make({ id: "m-gudang", level: 1, job_role: "gudang" }),
            barista: make({ id: "m-bar", level: 1, job_role: "dapur" }),
        };
    }

    it("jual menu ber-resep: bahan dipotong sesuai varian, HPP & jurnal tercatat, stok barang jadi tidak dipakai", async () => {
        const { db, kasir, journal, moved } = setup();
        await kasir.openShift({ outlet_id: "w", opening_cash: 0 });
        const sale = await kasir.posCheckoutPro({
            outlet_id: "w", channel: "take_away", payments: [{ method: "qris", amount: 50000 }],
            lines: [{ product_id: "kopi", qty: 2, options: [{ group_id: "g-size", option_id: "large" }] }],
        });
        expect(sale.cogs).toBe(2 * (7500 + 60 * 22 + 1000));
        expect(db.pos_ingredient_stock.w).toMatchObject({ susu: 1000 - 420, rasa: 500 - 80, cup: 48 });
        expect(moved).toHaveLength(0);
        const hpp = journal.find((entry) => entry.ref === `${sale.receipt_no}-HPP`);
        expect(validateJournal(hpp.lines)).toBe("");
        expect(hpp.lines[0]).toMatchObject({ account_code: "5-1000", debit: sale.cogs });

        // Menu tanpa resep tetap memakai stok barang jadi.
        await kasir.posCheckoutPro({ outlet_id: "w", channel: "take_away", payments: [{ method: "qris", amount: 5000 }], lines: [{ product_id: "botol", qty: 1 }] });
        expect(moved.at(-1)).toMatchObject({ product_id: "botol", kind: "penjualan" });

        // Void: bahan kembali & HPP dibalik.
        await kasir.voidSale({ sale_id: sale.id, reason: "salah_input", pin: "4826" });
        expect(db.pos_ingredient_stock.w).toMatchObject({ susu: 1000, rasa: 500, cup: 50 });
        expect(journal.some((entry) => entry.ref === `${sale.receipt_no}-HPP-VOID`)).toBe(true);
    });

    it("bahan habis tidak memblokir penjualan (stok jadi minus = perlu hitung ulang)", async () => {
        const { db, kasir } = setup();
        db.pos_ingredient_stock.w.susu = 100;
        await kasir.openShift({ outlet_id: "w", opening_cash: 0 });
        await kasir.posCheckoutPro({ outlet_id: "w", channel: "take_away", payments: [{ method: "qris", amount: 20000 }], lines: [{ product_id: "kopi", qty: 1 }] });
        expect(db.pos_ingredient_stock.w.susu).toBe(-50);
    });

    it("belanja: harga modal rata-rata tertimbang + jurnal; opname mencatat selisih; buang wajib alasan", async () => {
        const { db, gudang, barista, kasir, journal } = setup();
        await gudang.ingredientMove({ outlet_id: "w", ingredient_id: "susu", kind: "beli", qty: 1000, total: 26000, pay: "utang" });
        expect(db.pos_ingredients.find((entry) => entry.id === "susu").cost).toBe(24);
        expect(journal.at(-1).lines).toEqual([{ account_code: "1-1310", debit: 26000, credit: 0 }, { account_code: "2-1000", debit: 0, credit: 26000 }]);

        const result = await gudang.ingredientMove({ outlet_id: "w", ingredient_id: "susu", kind: "opname", qty: 1700 });
        expect(result.delta).toBe(-300);
        expect(db.pos_ingredient_moves.at(-1)).toMatchObject({ kind: "opname", delta: -300 });
        expect(journal.at(-1).lines[0]).toMatchObject({ account_code: "5-1100", debit: 7200 });

        await expect(barista.ingredientMove({ outlet_id: "w", ingredient_id: "susu", kind: "buang", qty: 100 })).rejects.toThrow(/alasan/);
        await barista.ingredientMove({ outlet_id: "w", ingredient_id: "susu", kind: "buang", qty: 100, reason: "tumpah" });
        expect(db.pos_ingredient_stock.w.susu).toBe(1600);
        await expect(kasir.ingredientMove({ outlet_id: "w", ingredient_id: "susu", kind: "beli", qty: 1, total: 100 })).rejects.toThrow(/Akses ditolak/);
        await expect(kasir.saveRecipe("kopi", [])).rejects.toThrow(/Akses ditolak/);
    });

    it("kasir melihat stok bahan tapi tidak melihat harga modal", async () => {
        const { kasir, gudang } = setup();
        const forKasir = await kasir.listIngredients("w");
        expect(forKasir.find((entry) => entry.id === "susu")).toMatchObject({ stock: 1000, cost: null });
        expect((await gudang.listIngredients("w")).find((entry) => entry.id === "susu").cost).toBe(22);
    });

    it("data demo resep: setiap menu punya resep, ada bahan kritis & bahan hilang", async () => {
        const { buildRecipeSeed } = await import("../frontend/erp/data/demo-seed-recipe.js");
        const db = {
            products: [{ id: "a", name: "Miloat Milktea", price: 18000, category: "Minuman" }, { id: "c", name: "Miloat Choco", price: 20000, category: "Minuman" }, { id: "b", name: "Croissant", price: 22000, category: "Makanan" }],
            warehouses: [{ id: "w", kind: "outlet" }], pos_modifiers: [{ id: "g-size" }], pos_sales: [],
        };
        const seed = buildRecipeSeed(db, new Date());
        expect(Object.keys(seed.pos_recipes).sort()).toEqual(["a", "b", "c"]);
        expect(seed.pos_option_recipes["g-size:large"]).toBeTruthy();
        expect(seed.pos_ingredient_stock.w["ing-rasa-1"]).toBe(60);
        expect(seed.pos_ingredient_stock.w["ing-rasa-2"]).toBe(0);
        expect(seed.pos_restock[0]).toMatchObject({ product_id: "c", status: "baru", count: 2 });
        expect(seed.pos_ingredient_moves.some((move) => move.kind === "opname" && move.delta < 0)).toBe(true);
    });
});

describe("laba kotor di laporan promo", async () => {
    const { promoReport } = await import("../frontend/erp/core/promo.js");
    it("menghitung laba kotor per hari sebelum & sesudah promo", () => {
        const now = new Date("2026-11-04T20:00:00+07:00");
        const promo = { id: "p", name: "P", kind: "happy_hour", days: [], start_time: "", end_time: "", starts_on: "2026-10-28" };
        const sales = [];
        for (let n = 1; n <= 14; n += 1) {
            const after = n <= 7;
            sales.push({ total: after ? 30000 : 20000, created_at: new Date(now.getTime() - n * 86400000).toISOString(), promos: after ? [{ promo_id: "p", amount: 3000 }] : [] });
        }
        const report = promoReport(promo, sales, now, { gross: (sale) => sale.total * 0.6 });
        // Hari dihitung per tanggal kalender WIB (hari terpotong ikut dihitung).
        expect(report.grossBefore).toBe(Math.round((12000 * 7) / report.daysBefore));
        expect(report.grossAfter).toBe(Math.round((18000 * 7) / report.daysAfter));
        expect(report.grossLift).toBe((report.grossAfter - report.grossBefore) * report.daysAfter);
        expect(promoReport(promo, sales, now).grossAfter).toBeNull();
    });
});

describe("prediksi jam habis", async () => {
    const { sellOutAt } = await import("../frontend/erp/core/recipe.js");
    it("dari kecepatan jual hari ini", () => {
        const now = new Date("2026-11-04T14:00:00+07:00");
        const at = sellOutAt({ left: 2, soldToday: 8, openedAt: new Date("2026-11-04T10:00:00+07:00"), now });
        expect(at.toISOString()).toBe(new Date("2026-11-04T15:00:00+07:00").toISOString());
        expect(sellOutAt({ left: 2, soldToday: 0, openedAt: now, now })).toBeNull();
        expect(sellOutAt({ left: 0, soldToday: 5, openedAt: new Date("2026-11-04T10:00:00+07:00"), now })).toBeNull();
        // Baru buka 10 menit: dihitung minimal 30 menit supaya tidak panik berlebihan.
        const early = sellOutAt({ left: 3, soldToday: 3, openedAt: new Date("2026-11-04T13:50:00+07:00"), now });
        expect(early.toISOString()).toBe(new Date("2026-11-04T14:30:00+07:00").toISOString());
    });
});

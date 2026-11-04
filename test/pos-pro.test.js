import { describe, it, expect } from "vitest";

import {
    CHANNELS, channelPrice, formatOptionLines, groupsFor, lineKey, methodLabel, orderLabel, parseOptionLines,
    posSettings, priceOrder, saleJournalLines, settlePayments, validateSelection,
} from "../frontend/erp/core/pos-pro.js";
import { validateJournal } from "../frontend/erp/core/accounting.js";
import { posProMethods } from "../frontend/erp/data/demo-adapter-pos.js";
import { buildPosSeed } from "../frontend/erp/data/demo-seed-pos.js";

const products = [
    { id: "p1", name: "Miloat Chocolate", price: 15000, category: "Minuman" },
    { id: "p2", name: "Oatcookies", price: 7000, category: "Makanan" },
];

const groups = [
    {
        id: "size", name: "Ukuran", required: true, max_select: 1, applies_all: false, product_ids: ["p1"], categories: [],
        options: [{ id: "regular", name: "Regular", price: 0 }, { id: "large", name: "Large", price: 5000 }],
    },
    {
        id: "top", name: "Topping", required: false, max_select: 2, applies_all: false, product_ids: [], categories: ["Minuman"],
        options: [{ id: "boba", name: "Boba", price: 5000 }, { id: "jelly", name: "Grass jelly", price: 4000 }, { id: "foam", name: "Cheese foam", price: 6000 }],
    },
];

const noExtras = { service_enabled: false, tax_enabled: false, rounding: 0 };

describe("Kasir POS Pro — harga per channel & varian", () => {
    it("harga ojol = harga toko + markup, dibulatkan ke atas Rp 500 (tanpa galat desimal)", () => {
        const settings = posSettings({ online_markup: 20 });
        expect(channelPrice(15000, "gofood", settings)).toBe(18000);
        expect(channelPrice(7000, "grabfood", settings)).toBe(8500);
        expect(channelPrice(15000, "dine_in", settings)).toBe(15000);
        expect(channelPrice(15000, "gofood", posSettings({ online_markup: 0 }))).toBe(15000);
    });

    it("varian & topping menambah harga; grup berlaku per produk / kategori", () => {
        expect(groupsFor(products[0], groups).map((group) => group.id)).toEqual(["size", "top"]);
        expect(groupsFor(products[1], groups)).toEqual([]);

        const priced = priceOrder({
            products, groups, channel: "take_away", settings: noExtras,
            lines: [{ product_id: "p1", qty: 2, options: [{ group_id: "size", option_id: "large" }, { group_id: "top", option_id: "boba" }], note: " less sugar " }],
        });
        expect(priced.items[0].unit_price).toBe(25000);
        expect(priced.items[0].line_total).toBe(50000);
        expect(priced.items[0].note).toBe("less sugar");
        expect(priced.total).toBe(50000);
    });

    it("pilihan yang tidak berlaku untuk produk itu diabaikan (tidak bisa diselundupkan)", () => {
        const priced = priceOrder({
            products, groups, settings: noExtras,
            lines: [{ product_id: "p2", qty: 1, options: [{ group_id: "size", option_id: "large" }, { group_id: "top", option_id: "nope" }] }],
        });
        expect(priced.items[0].unit_price).toBe(7000);
        expect(priced.items[0].options).toEqual([]);
    });

    it("pilihan wajib & batas maksimal dicek", () => {
        const mine = groupsFor(products[0], groups);
        expect(validateSelection(mine, {})).toMatch(/ukuran/i);
        expect(validateSelection(mine, { size: ["large"], top: ["boba", "jelly", "foam"] })).toMatch(/maksimal 2/);
        expect(validateSelection(mine, { size: ["regular"], top: ["boba"] })).toBe("");
    });

    it("baris dengan varian & catatan sama digabung, beda = baris baru", () => {
        const a = lineKey("p1", [{ group_id: "size", option_id: "large" }, { group_id: "top", option_id: "boba" }], "Less ice");
        const b = lineKey("p1", [{ group_id: "top", option_id: "boba" }, { group_id: "size", option_id: "large" }], " less ice");
        expect(a).toBe(b);
        expect(lineKey("p1", [], "")).not.toBe(lineKey("p1", [], "panas"));
    });
});

describe("Kasir POS Pro — service, PB1, pembulatan", () => {
    const lines = [{ product_id: "p1", qty: 3, options: [] }, { product_id: "p2", qty: 1, options: [] }]; // 52.000

    it("makan di tempat: service 5% lalu PB1 10% dari (subtotal − diskon + service), dibulatkan ke Rp 100", () => {
        const priced = priceOrder({ products, groups, lines, channel: "dine_in", discount: 2000 });
        expect(priced.subtotal).toBe(52000);
        expect(priced.service).toBe(2500);      // 5% × 50.000
        expect(priced.tax).toBe(5250);          // 10% × 52.500
        expect(priced.total).toBe(57800);       // 57.750 -> 57.800
        expect(priced.rounding).toBe(50);
    });

    it("bawa pulang: tanpa service, tetap PB1; ojol: tanpa keduanya (sudah termasuk di aplikasi)", () => {
        expect(priceOrder({ products, groups, lines, channel: "take_away" })).toMatchObject({ service: 0, tax: 5200, total: 57200 });
        const online = priceOrder({ products, groups, lines, channel: "gofood" });
        expect(online).toMatchObject({ service: 0, tax: 0 });
        expect(online.subtotal).toBe(18000 * 3 + 8500);
    });

    it("pajak & service bisa dimatikan; diskon tidak melebihi subtotal", () => {
        const priced = priceOrder({ products, groups, lines, channel: "dine_in", discount: 999999, settings: { service_enabled: false, tax_enabled: false } });
        expect(priced).toMatchObject({ discount: 52000, service: 0, tax: 0, total: 0 });
    });
});

describe("Kasir POS Pro — bayar campuran", () => {
    it("QRIS + tunai: kembalian hanya dari tunai", () => {
        const result = settlePayments(57800, [{ method: "qris", amount: 50000 }, { method: "tunai", amount: 10000 }]);
        expect(result).toMatchObject({ ok: true, change: 2200, remaining: 0 });
        expect(result.applied).toEqual([{ method: "qris", amount: 50000 }, { method: "tunai", amount: 7800 }]);
        expect(methodLabel(result.applied)).toBe("Campuran");
    });

    it("kurang bayar & non-tunai berlebih ditolak", () => {
        expect(settlePayments(50000, [{ method: "tunai", amount: 40000 }])).toMatchObject({ ok: false, remaining: 10000 });
        expect(settlePayments(50000, [{ method: "qris", amount: 60000 }]).ok).toBe(false);
    });

    it("jurnal seimbang: kas + bank = penjualan + service + utang PB1", () => {
        const priced = priceOrder({ products, groups, channel: "dine_in", lines: [{ product_id: "p1", qty: 3 }, { product_id: "p2", qty: 1 }], discount: 2000 });
        const { applied } = settlePayments(priced.total, [{ method: "qris", amount: 50000 }, { method: "tunai", amount: 10000 }]);
        const lines = saleJournalLines(priced, applied);
        expect(validateJournal(lines)).toBe("");
        expect(lines).toContainEqual({ account_code: "2-1200", debit: 0, credit: 5250 });
        expect(lines).toContainEqual({ account_code: "4-1200", debit: 0, credit: 2500 });
    });
});

describe("Kasir POS Pro — pengelola varian & label", () => {
    it("teks \"Nama = harga\" dibaca jadi pilihan; id lama dipertahankan", () => {
        const options = parseOptionLines("Regular\nLarge = 5.000\n\n Extra boba = 5000 ", [{ id: "lg-lama", name: "large", price: 3000 }]);
        expect(options).toEqual([
            { id: "regular", name: "Regular", price: 0 },
            { id: "lg-lama", name: "Large", price: 5000 },
            { id: "extra-boba", name: "Extra boba", price: 5000 },
        ]);
        expect(formatOptionLines(options)).toBe("Regular\nLarge = 5000\nExtra boba = 5000");
    });

    it("label pesanan: meja / nama / tipe pesanan", () => {
        expect(orderLabel({ channel: "dine_in", table_no: "5", customer_name: "Rina" })).toBe("Meja 5 · Rina");
        expect(orderLabel({ channel: "gofood" })).toBe(CHANNELS.gofood.label);
    });
});

describe("Kasir POS Pro — alur demo (bayar, stok, jurnal, bill)", () => {
    function setup(viewer = { id: "m-kasir", level: 1, job_role: "kasir" }) {
        const db = {
            products: products.map((product) => ({ ...product })),
            warehouses: [{ id: "w-out", kind: "outlet", is_active: true, name: "Outlet" }],
            stock_levels: [
                { warehouse_id: "w-out", product_id: "p1", qty: 10, min_qty: 0 },
                { warehouse_id: "w-out", product_id: "p2", qty: 1, min_qty: 0 },
            ],
            pos_sales: [], pos_serial: 1, accounts: [], journal: [],
            pos_settings: {}, pos_modifiers: groups.map((group) => ({ ...group, is_active: true })), pos_bills: [], pos_members: [], pos_points: [], pos_promos: [], pos_ingredients: [], pos_ingredient_stock: {}, pos_recipes: {}, pos_option_recipes: {}, pos_ingredient_moves: [],
        };
        const journal = [];
        const moved = [];
        const api = posProMethods({
            db: () => db, save: () => {}, me: () => viewer, audit: () => {},
            journalWrite: (memo, source, ref, lines) => journal.push({ memo, ref, lines }),
            recordMoves: (moves) => moved.push(...moves),
        });
        return { db, api, journal, moved };
    }

    it("bayar campuran: harga dihitung ulang dari katalog, stok & jurnal tercatat, bill dihapus", async () => {
        const { db, api, journal, moved } = setup();
        await api.openShift({ outlet_id: "w-out", opening_cash: 100000 });
        const bill = await api.saveOpenBill({ outlet_id: "w-out", channel: "dine_in", table_no: "3", lines: [{ product_id: "p1", qty: 2 }] });
        expect(db.pos_bills).toHaveLength(1);

        const sale = await api.posCheckoutPro({
            outlet_id: "w-out", channel: "dine_in", table_no: "3", bill_id: bill.id,
            lines: [{ product_id: "p1", qty: 2, options: [{ group_id: "size", option_id: "large" }] }],
            payments: [{ method: "qris", amount: 20000 }, { method: "tunai", amount: 50000 }],
        });

        expect(sale.subtotal).toBe(40000);
        expect(sale).toMatchObject({ service: 2000, tax: 4200, total: 46200, change: 23800, method: "campuran", table_no: "3" });
        expect(moved).toEqual([expect.objectContaining({ product_id: "p1", qty: -2 })]);
        expect(validateJournal(journal[0].lines)).toBe("");
        expect(db.pos_bills).toHaveLength(0);
    });

    it("stok kurang = transaksi batal seluruhnya", async () => {
        const { api, journal } = setup();
        await api.openShift({ outlet_id: "w-out", opening_cash: 0 });
        await expect(api.posCheckoutPro({
            outlet_id: "w-out", channel: "take_away",
            lines: [{ product_id: "p1", qty: 1 }, { product_id: "p2", qty: 2 }],
            payments: [{ method: "tunai", amount: 100000 }],
        })).rejects.toThrow(/tidak cukup/);
        expect(journal).toHaveLength(0);
    });

    it("hak akses: bukan kasir tidak bisa jualan; kasir tidak bisa ubah pajak; bill wajib meja/nama", async () => {
        const staff = setup({ id: "m-x", level: 1, job_role: "umum" }).api;
        await expect(staff.posCheckoutPro({ outlet_id: "w-out", lines: [{ product_id: "p1", qty: 1 }], payments: [] })).rejects.toThrow(/kasir/);

        const cashier = setup().api;
        await expect(cashier.savePosSettings("w-out", { tax_rate: 0 })).rejects.toThrow(/owner\/manajer/);
        await expect(cashier.saveOpenBill({ outlet_id: "w-out", lines: [{ product_id: "p1", qty: 1 }] })).rejects.toThrow(/meja atau nama/);

        const owner = setup({ id: "m-owner", level: 5, job_role: "umum" }).api;
        const saved = await owner.savePosSettings("w-out", { tax_rate: 11, service_enabled: false });
        expect(saved).toMatchObject({ tax_rate: 11, service_enabled: false, rounding: 100 });
    });

    it("data demo lama otomatis mendapat varian Miloat & contoh bill", () => {
        const seed = buildPosSeed({
            products: [{ id: "a", name: "Miloat Milktea", category: "Umum" }, { id: "b", name: "Oatcookies", category: "Umum" }],
            warehouses: [{ id: "w", kind: "outlet" }],
        });
        expect(seed.pos_modifiers.find((group) => group.id === "g-size").product_ids).toEqual(["a"]);
        expect(seed.pos_modifiers.find((group) => group.id === "g-food").product_ids).toEqual(["b"]);
        expect(seed.pos_bills.map((bill) => bill.channel)).toEqual(["dine_in", "gofood"]);
    });
});

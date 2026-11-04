/**
 * KANTOONG ERP — DATA CONTOH KASIR POS PRO (Tahap 1)
 * File: frontend/erp/data/demo-seed-pos.js
 *
 * Varian & tambahan khas kedai minuman (ukuran, level gula, es, topping)
 * dan dua bill terbuka contoh, supaya presentasi langsung "hidup".
 * Dipasang otomatis ke data demo lama maupun baru.
 * Data dapur & antrian (Tahap 2) ada di demo-seed-kitchen.js.
 */

import { DRINK_PATTERN as DRINK } from "../core/kitchen.js";

export function buildPosSeed(db) {
    const products = db.products || [];
    const isDrink = (product) => DRINK.test(`${product.name} ${product.category || ""}`);
    const drinks = products.filter(isDrink).map((product) => String(product.id));
    const foods = products.filter((product) => !isDrink(product)).map((product) => String(product.id));

    const pos_modifiers = [
        {
            id: "g-size", name: "Ukuran", required: true, max_select: 1, sort: 1, is_active: true,
            applies_all: false, product_ids: drinks, categories: [],
            options: [{ id: "regular", name: "Regular", price: 0 }, { id: "large", name: "Large", price: 5000 }],
        },
        {
            id: "g-sugar", name: "Level gula", required: true, max_select: 1, sort: 2, is_active: true,
            applies_all: false, product_ids: drinks, categories: [],
            options: [
                { id: "normal-sugar", name: "Normal sugar", price: 0 },
                { id: "less-sugar", name: "Less sugar", price: 0 },
                { id: "no-sugar", name: "No sugar", price: 0 },
            ],
        },
        {
            id: "g-ice", name: "Es", required: true, max_select: 1, sort: 3, is_active: true,
            applies_all: false, product_ids: drinks, categories: [],
            options: [
                { id: "normal-ice", name: "Normal ice", price: 0 },
                { id: "less-ice", name: "Less ice", price: 0 },
                { id: "no-ice", name: "Tanpa es", price: 0 },
                { id: "hot", name: "Panas", price: 0 },
            ],
        },
        {
            id: "g-topping", name: "Topping", required: false, max_select: 3, sort: 4, is_active: true,
            applies_all: false, product_ids: drinks, categories: [],
            options: [
                { id: "boba", name: "Boba", price: 5000 },
                { id: "grass-jelly", name: "Grass jelly", price: 4000 },
                { id: "cheese-foam", name: "Cheese foam", price: 6000 },
                { id: "extra-oat", name: "Extra oat", price: 3000 },
            ],
        },
        {
            id: "g-food", name: "Tambahan", required: false, max_select: 2, sort: 5, is_active: true,
            applies_all: false, product_ids: foods, categories: [],
            options: [
                { id: "warm", name: "Dihangatkan", price: 0 },
                { id: "choco-sauce", name: "Saus cokelat", price: 2000 },
            ],
        },
    ];

    const now = Date.now();
    const pick = (group, option) => ({ group_id: group, option_id: option });
    const pos_bills = [];
    const outlet = (db.warehouses || []).find((entry) => entry.kind === "outlet")?.id;

    if (outlet && drinks.length) {
        pos_bills.push({
            id: "bill-demo-1", outlet_id: outlet, channel: "dine_in", table_no: "3", customer_name: "",
            discount: 0, created_by: "m-dewi", updated_at: new Date(now - 18 * 60000).toISOString(),
            lines: [
                { product_id: drinks[0], qty: 2, options: [pick("g-size", "large"), pick("g-sugar", "less-sugar"), pick("g-ice", "normal-ice"), pick("g-topping", "boba")], note: "" },
                ...(foods[0] ? [{ product_id: foods[0], qty: 1, options: [pick("g-food", "warm")], note: "" }] : []),
            ],
        });
        pos_bills.push({
            id: "bill-demo-2", outlet_id: outlet, channel: "gofood", table_no: "", customer_name: "Kak Rina",
            discount: 0, created_by: "m-dewi", updated_at: new Date(now - 6 * 60000).toISOString(),
            lines: [
                { product_id: drinks[Math.min(1, drinks.length - 1)], qty: 1, options: [pick("g-size", "regular"), pick("g-sugar", "no-sugar"), pick("g-ice", "less-ice")], note: "Pisah es batu" },
            ],
        });
    }

    return { pos_settings: {}, pos_modifiers, pos_bills };
}

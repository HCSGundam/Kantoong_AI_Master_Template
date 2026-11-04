/**
 * KANTOONG ERP — DATA CONTOH MEMBER, POIN & PROMO (Tahap 4 POS Pro)
 * File: frontend/erp/data/demo-seed-loyalty.js
 *
 * - 6 member dengan izin berbeda (UU PDP): ada yang boleh dikirimi promo, ada yang tidak.
 * - Riwayat belanja member lengkap dengan varian -> "Kasir yang Ingat" langsung hidup.
 * - 2 member yang mulai menghilang -> Radar Pelanggan Menghilang.
 * - Promo "Jam Hemat Sore" dengan sejarah sebelum & sesudah promo -> laporan
 *   "Promo yang membuktikan dirinya sendiri". Paket hemat yang jarang dipakai -> jujur dinilai.
 * Dipasang otomatis ke data demo lama maupun baru.
 */

import { receiptNumber } from "../core/pos.js";
import { posSettings, priceOrder } from "../core/pos-pro.js";
import { DRINK_PATTERN } from "../core/kitchen.js";

const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString();
const wibDate = (ms) => new Date(ms + 7 * 3600000).toISOString().slice(0, 10);

/** Waktu WIB tertentu, n hari lalu. */
const wibAt = (nowMs, daysAgo, hour, minute = 0) => {
    const date = wibDate(nowMs - daysAgo * DAY);
    return new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+07:00`).getTime();
};

export function buildLoyaltySeed(db, now = new Date()) {
    const nowMs = now.getTime();
    const products = db.products || [];
    const groups = db.pos_modifiers || [];
    const outlet = (db.warehouses || []).find((entry) => entry.kind === "outlet")?.id;
    const settings = posSettings(db.pos_settings?.[outlet]);
    const drinks = products.filter((product) => DRINK_PATTERN.test(`${product.name} ${product.category || ""}`));
    const foods = products.filter((product) => !drinks.includes(product));
    const drink = (index) => drinks[index % Math.max(drinks.length, 1)] || products[0];
    const food = (index) => foods[index % Math.max(foods.length, 1)] || products[0];
    const pick = (group, option) => ({ group_id: group, option_id: option });
    const drinkOptions = (size, sugar, ice) => [pick("g-size", size), pick("g-sugar", sugar), pick("g-ice", ice)];

    const result = { pos_members: [], pos_points: [], pos_promos: [], extra_sales: [] };
    if (!outlet || !products.length) return result;

    // ---------- Promo ----------
    const happyStart = wibDate(nowMs - 12 * DAY);
    const happy = {
        id: "promo-sore", name: "Jam Hemat Sore", kind: "happy_hour", percent: 20,
        product_ids: drinks.map((product) => String(product.id)), categories: [], days: [],
        start_time: "14:00", end_time: "16:00", bundle_ids: [], bundle_amount: 0, members_only: false,
        starts_on: happyStart, ends_on: null, is_active: true, created_by: "m-owner", created_at: iso(nowMs - 12 * DAY),
    };
    const breakfast = {
        id: "promo-sarapan", name: "Paket Sarapan", kind: "bundle", percent: 0, product_ids: [], categories: [], days: [],
        start_time: "07:00", end_time: "10:00", bundle_ids: [String(food(0).id), String(drink(0).id)].filter((id, index, all) => all.indexOf(id) === index),
        bundle_amount: 5000, members_only: false,
        starts_on: wibDate(nowMs - 10 * DAY), ends_on: null, is_active: true, created_by: "m-owner", created_at: iso(nowMs - 10 * DAY),
    };
    result.pos_promos = breakfast.bundle_ids.length >= 2 ? [happy, breakfast] : [happy];

    // ---------- Pembuat penjualan contoh (harga dihitung dengan rumus kasir yang sama) ----------
    let serial = db.pos_serial || 1;
    const sell = ({ at, lines, channel = "take_away", member = null, customer = "", method = "qris" }) => {
        const priced = priceOrder({
            lines, products, groups, channel, settings, promos: result.pos_promos, now: new Date(at),
            member: member ? { points: 0 } : null,
        });
        if (!priced.items.length) return null;
        const sale = {
            id: `pos-l${serial}`, receipt_no: receiptNumber(serial, new Date(at)), outlet_id: outlet, cashier_id: "m-dewi",
            channel: priced.channel, table_no: channel === "dine_in" ? String(1 + (serial % 8)) : "", customer_name: member?.name || customer,
            queue_no: "", shift_id: null, member_id: member?.id || null,
            items: priced.items.map(({ product_id, name, qty, unit_price, options, note }) => ({ product_id, name, qty, price: unit_price, options, note })),
            subtotal: priced.subtotal, promo_discount: priced.promo_discount, promos: priced.promos, discount: 0,
            points_used: 0, points_value: 0, points_earned: priced.points_earned,
            service: priced.service, tax: priced.tax, rounding: priced.rounding, total: priced.total,
            payments: [{ method, amount: priced.total }], paid: priced.total, change: 0, method,
            status: "selesai", created_at: iso(at),
        };
        serial += 1;
        result.extra_sales.push(sale);
        if (member && sale.points_earned) {
            result.pos_points.push({ id: `pt-${result.pos_points.length + 1}`, member_id: member.id, business_id: "demo", sale_id: sale.id, delta: sale.points_earned, kind: "earn", note: sale.receipt_no, created_at: sale.created_at });
        }
        return sale;
    };

    // ---------- Member (dengan izin terpisah) ----------
    const people = [
        { id: "mem-rina", name: "Rina Kartika", phone: "6281234567801", consent_history: true, consent_promo: true, every: 3, last: 2, hour: 15,
            order: () => [{ product_id: String(drink(0).id), qty: 1, options: drinkOptions("large", "less-sugar", "normal-ice"), note: "" }] },
        { id: "mem-andi", name: "Andi Wijaya", phone: "6285711122233", consent_history: true, consent_promo: false, every: 5, last: 4, hour: 9,
            order: () => [{ product_id: String(food(0).id), qty: 1, options: [pick("g-food", "warm")], note: "" }, { product_id: String(drink(1).id), qty: 1, options: drinkOptions("regular", "normal-sugar", "hot"), note: "" }] },
        { id: "mem-sinta", name: "Sinta Maharani", phone: "6281398765400", consent_history: true, consent_promo: true, every: 4, last: 1, hour: 12,
            order: () => [{ product_id: String(drink(2).id), qty: 2, options: drinkOptions("regular", "no-sugar", "less-ice"), note: "" }] },
        { id: "mem-doni", name: "Doni Saputra", phone: "6282145566778", consent_history: true, consent_promo: true, every: 3, last: 19, hour: 17,
            order: () => [{ product_id: String(drink(1).id), qty: 1, options: drinkOptions("large", "normal-sugar", "normal-ice"), note: "" }, { product_id: String(food(1).id), qty: 1, options: [], note: "" }] },
        { id: "mem-maya", name: "Maya Lestari", phone: "6287700011122", consent_history: true, consent_promo: false, every: 4, last: 16, hour: 11,
            order: () => [{ product_id: String(drink(0).id), qty: 1, options: drinkOptions("regular", "less-sugar", "no-ice"), note: "" }] },
        { id: "mem-yoga", name: "Yoga Pratama", phone: "6281277788899", consent_history: true, consent_promo: false, every: 0, last: 6, hour: 13,
            order: () => [{ product_id: String(drink(2).id), qty: 1, options: drinkOptions("regular", "normal-sugar", "normal-ice"), note: "" }] },
    ];

    for (const person of people) {
        const member = {
            id: person.id, business_id: "demo", name: person.name, phone: person.phone,
            consent_history: person.consent_history, consent_promo: person.consent_promo,
            consent_at: iso(nowMs - 45 * DAY), joined_at: iso(nowMs - 45 * DAY), created_by: "m-dewi",
        };
        result.pos_members.push(member);
        const visits = person.every ? Math.min(8, Math.floor(40 / person.every)) : 1;
        for (let visit = visits - 1; visit >= 0; visit -= 1) {
            const daysAgo = person.last + visit * (person.every || 0);
            if (daysAgo > 44) continue;
            sell({ at: wibAt(nowMs, daysAgo, person.hour, 10 + visit * 3), lines: person.order(), member, channel: visit % 3 ? "take_away" : "dine_in" });
        }
    }
    // Rina pernah menukar poin.
    result.pos_points.push({ id: `pt-${result.pos_points.length + 1}`, member_id: "mem-rina", business_id: "demo", sale_id: null, delta: -5, kind: "redeem", note: "Tukar poin", created_at: iso(nowMs - 8 * DAY) });

    // ---------- Sejarah jam 14–16: sebelum promo sepi, sesudah promo lebih ramai ----------
    for (let daysAgo = 24; daysAgo >= 1; daysAgo -= 1) {
        const afterPromo = wibDate(nowMs - daysAgo * DAY) >= happyStart;
        const count = afterPromo ? 3 + (daysAgo % 2) : 1 + (daysAgo % 3 === 0 ? 1 : 0);
        for (let index = 0; index < count; index += 1) {
            sell({
                at: wibAt(nowMs, daysAgo, 14 + (index % 2), 5 + index * 11),
                lines: [{ product_id: String(drink(index).id), qty: 1 + (index % 2), options: drinkOptions(index % 2 ? "large" : "regular", "normal-sugar", "normal-ice"), note: "" }],
                customer: ["Kak Tia", "Mas Rio", "Kak Nadia", "Pak Hendra"][index % 4],
                method: index % 2 ? "tunai" : "qris",
            });
        }
    }

    // ---------- Paket Sarapan: dipakai 2× saja ----------
    if (result.pos_promos.length > 1) {
        for (const daysAgo of [7, 3]) {
            sell({
                at: wibAt(nowMs, daysAgo, 8, 20),
                lines: [
                    { product_id: breakfast.bundle_ids[0], qty: 1, options: [], note: "" },
                    { product_id: breakfast.bundle_ids[1], qty: 1, options: drinkOptions("regular", "normal-sugar", "hot"), note: "" },
                ],
                customer: "Pak Hendra",
            });
        }
    }

    result.pos_serial = serial;
    return result;
}

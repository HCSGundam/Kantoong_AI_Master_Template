/**
 * KANTOONG ERP — DATA CONTOH DAPUR & ANTRIAN (Tahap 2 POS Pro)
 * File: frontend/erp/data/demo-seed-kitchen.js
 *
 * - Riwayat tiket 7 hari: bahan ETA Jujur belajar waktu pembuatan.
 * - Tiket aktif saat ini (bill Meja 3, GoFood, siap diambil, Meja 5).
 * - Penjualan hilang contoh (menu habis, kelamaan, kemahalan).
 * - Minat chat AI 2 jam terakhir: sinyal 🔥 untuk Dapur Prediktif.
 * - Anggota Barista (peran Dapur & Bar).
 * Dipasang otomatis ke data demo lama maupun baru.
 */

import { lineKey } from "../core/pos-pro.js";
import { queueCode, splitTickets, stationOf } from "../core/kitchen.js";

function prng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const MINUTE = 60000;
const iso = (ms) => new Date(ms).toISOString();
const dayWib = (ms) => new Date(ms + 7 * 3600000).toISOString().slice(0, 10);

/** Anggota baru untuk peran Dapur & Bar (data demo lama juga mendapatkannya). */
export function ensurePosMembers(db) {
    if (!db?.members || db.members.some((member) => member.id === "m-bayu")) return false;
    db.members.push({
        id: "m-bayu", user_id: null, email: "bayu@contoh.kantoong.id", full_name: "Bayu Pratama",
        org_unit_id: db.units?.some((unit) => unit.id === "u-outlet") ? "u-outlet" : "u-co",
        position_title: "Barista", level: 1, job_role: "dapur",
        manager_id: db.members.some((member) => member.id === "m-dewi") ? "m-dewi" : "m-owner",
        modules: null, sales_slug: null, is_active: true,
    });
    db.salaries?.push({ member_id: "m-bayu", base_salary: 4200000 });
    return true;
}

export function buildKitchenSeed(db, now = new Date()) {
    const random = prng(20261105);
    const products = db.products || [];
    const groups = db.pos_modifiers || [];
    const outlet = (db.warehouses || []).find((entry) => entry.kind === "outlet")?.id;
    const nowMs = now.getTime();
    const tickets = [];

    // ---------- Riwayat 7 hari: tiap penjualan kasir pernah jadi tiket selesai ----------
    let serial = 1;
    for (const sale of db.pos_sales || []) {
        const at = new Date(sale.created_at).getTime();
        if (at < nowMs - 7 * 86400000 || at > nowMs - 30 * MINUTE) continue;
        for (const part of splitTickets(sale.items.map((item) => ({ ...item, options: [] })), products)) {
            const prep = part.station === "bar" ? 2.2 + random() * 2.2 : 5.5 + random() * 3.5;
            const units = part.items.reduce((sum, item) => sum + item.qty, 0);
            const started = at + (0.5 + random() * 2) * MINUTE;
            const ready = started + (prep + 0.4 * (units - 1)) * MINUTE;
            tickets.push({
                id: `t-h${serial}`, outlet_id: sale.outlet_id, queue_no: queueCode((serial % 120) + 1),
                label: "Riwayat", channel: sale.channel || "take_away", ref: sale.receipt_no, ...part,
                status: "diambil", created_at: iso(at), started_at: iso(started), ready_at: iso(ready), picked_at: iso(ready + 2 * MINUTE),
            });
            serial += 1;
        }
    }

    // ---------- Tiket aktif ----------
    let queueToday = 20;
    const active = [];
    const pushActive = ({ label, channel, items, status, ageMin, startedAgo = null }) => {
        const queue = queueCode(++queueToday);
        for (const part of splitTickets(items, products)) {
            active.push({
                id: `t-a${active.length + 1}`, outlet_id: outlet, queue_no: queue, label, channel, ref: null, created_by: "m-dewi", ...part,
                status, created_at: iso(nowMs - ageMin * MINUTE),
                started_at: startedAgo !== null ? iso(nowMs - startedAgo * MINUTE) : null,
                ready_at: status === "siap" ? iso(nowMs - MINUTE) : null, picked_at: null,
            });
        }
        return queue;
    };

    const optionName = (pick) => groups.find((group) => group.id === pick.group_id)?.options.find((option) => option.id === pick.option_id)?.name;
    for (const bill of db.pos_bills || []) {
        const items = bill.lines.map((line) => ({
            product_id: line.product_id,
            name: products.find((entry) => String(entry.id) === String(line.product_id))?.name || "Menu",
            qty: line.qty,
            note: line.note || "",
            options: (line.options || []).map((pick) => ({ name: optionName(pick) })).filter((option) => option.name),
        }));
        const dineIn = bill.channel === "dine_in";
        bill.queue_no = pushActive({
            label: dineIn ? `Meja ${bill.table_no}` : bill.customer_name, channel: bill.channel, items,
            status: dineIn ? "dibuat" : "baru", ageMin: dineIn ? 9 : 6, startedAgo: dineIn ? 4 : null,
        });
        bill.sent = Object.fromEntries(bill.lines.map((line) => [lineKey(String(line.product_id), line.options || [], line.note || ""), line.qty]));
    }

    const drinks = products.filter((product) => stationOf(product) === "bar");
    const foods = products.filter((product) => stationOf(product) === "dapur");
    if (drinks.length) {
        pushActive({
            label: "Kak Sinta", channel: "take_away", status: "siap", ageMin: 7, startedAgo: 5,
            items: [{ product_id: drinks[0].id, name: drinks[0].name, qty: 2, options: [{ name: "Large" }, { name: "Less ice" }], note: "" }],
        });
        pushActive({
            label: "Meja 5", channel: "dine_in", status: "baru", ageMin: 2,
            items: [
                { product_id: drinks[0].id, name: drinks[0].name, qty: 1, options: [{ name: "Regular" }], note: "" },
                ...(foods[0] ? [{ product_id: foods[0].id, name: foods[0].name, qty: 2, options: [], note: "hangatkan" }] : []),
            ],
        });
    }

    // ---------- Penjualan hilang contoh ----------
    const lost = [];
    const at = (days, hours) => iso(nowMs - days * 86400000 - hours * 3600000);
    const push = (product, qty, reason, when, extra = 0) => lost.push({
        id: `l-${lost.length + 1}`, outlet_id: outlet, product_id: String(product.id), name: product.name,
        qty, value: (Number(product.price) + extra) * qty, reason, created_by: "m-dewi", created_at: when,
    });
    if (drinks[1]) {
        push(drinks[1], 3, "habis", at(0, 2));
        push(drinks[1], 2, "habis", at(1, 5));
    }
    if (drinks[0]) {
        push(drinks[0], 1, "lama", at(0, 1));
        push(drinks[0], 1, "harga", at(2, 3), 5000);
    }

    // ---------- Minat chat AI 2 jam terakhir (sinyal 🔥) ----------
    const hot = drinks[drinks.length - 1] || products[0];
    const aiEvents = hot ? Array.from({ length: 5 }, (_, index) => ({
        at: iso(nowMs - (10 + index * 17) * MINUTE), business_id: "demo", session_key: `s-hot${index}`,
        kind: index % 2 ? "view" : "recommend", product_id: String(hot.id), product_name: hot.name, keywords: [], surface: "store",
    })) : [];

    return {
        pos_tickets: [...tickets.slice(-300), ...active],
        pos_lost: lost,
        pos_queue: outlet ? { [outlet]: { day: dayWib(nowMs), n: queueToday } } : {},
        ai_events: [...(db.ai_events || []), ...aiEvents],
    };
}

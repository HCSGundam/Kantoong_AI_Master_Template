/**
 * KANTOONG ERP — DATA CONTOH FASE 3
 * File: frontend/erp/data/demo-seed-phase3.js
 *
 * Tahap A (sebelum jurnal Fase 2 dibuat): melengkapi pesanan dengan
 *   nomor HP, alamat, voucher, dan variasi status pengiriman, supaya
 *   jurnal penjualan memakai total yang sudah dipotong voucher.
 * Tahap B (setelah Fase 2): supplier & PO, tiket CS, voucher, profil CRM.
 * Semua FIKTIF.
 */

import { voucherDiscount } from "../core/marketing.js";
import { payJournal, poNumber, poTotal, receiveJournal } from "../core/purchasing.js";
import { wibDate } from "../core/hr.js";

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

const DAY = 86400000;

export const DEMO_VOUCHERS = Object.freeze([
    { id: "v-hemat", code: "HEMAT10", title: "Hemat 10% pelanggan baru", kind: "persen", value: 10, max_discount: 10000, min_purchase: 30000, quota: 100, is_active: true },
    { id: "v-potong", code: "POTONG5K", title: "Potongan Rp 5.000", kind: "nominal", value: 5000, max_discount: null, min_purchase: 25000, quota: 50, is_active: true },
    { id: "v-lebaran", code: "LEBARAN25", title: "Promo lebaran (sudah berakhir)", kind: "persen", value: 25, max_discount: 25000, min_purchase: 50000, quota: 200, is_active: true },
]);

/** Tahap A: dipanggil sebelum jurnal Fase 2 dibuat. */
export function enrichOrdersPhase3(seed, now = new Date()) {
    const random = prng(20261105);
    const phones = new Map();
    const phoneOf = (name) => {
        if (!phones.has(name)) phones.set(name, `0812${String(10000000 + phones.size * 7919301).slice(0, 8)}`);
        return phones.get(name);
    };

    seed.vouchers = DEMO_VOUCHERS.map((voucher, index) => ({
        ...voucher,
        used: 0,
        starts_at: new Date(now.getTime() - 60 * DAY).toISOString(),
        ends_at: index === 2 ? new Date(now.getTime() - 10 * DAY).toISOString() : new Date(now.getTime() + 30 * DAY).toISOString(),
        created_by: "m-reza",
        created_at: new Date(now.getTime() - 60 * DAY).toISOString(),
    }));
    seed.voucher_redemptions = [];

    seed.orders.forEach((order, index) => {
        order.customer_phone = phoneOf(order.customer_name);
        order.customer_email = `${order.customer_name.toLowerCase()}@contoh.id`;
        order.address_line = `Jl. Contoh Raya No. ${1 + (index % 87)}`;
        order.courier_name = ["JNE", "J&T", "SiCepat"][index % 3];
        order.voucher_code = null;
        order.voucher_discount = 0;

        // Sebagian pesanan memakai voucher (total sudah dipotong).
        const subtotal = order.total - 15000;
        const voucher = seed.vouchers[index % 7 === 0 ? 0 : index % 11 === 0 ? 1 : -1];
        if (voucher && subtotal >= voucher.min_purchase && order.status !== "dibatalkan") {
            const discount = voucherDiscount(voucher, subtotal);
            order.voucher_code = voucher.code;
            order.voucher_discount = discount;
            order.total -= discount;
            voucher.used += 1;
            seed.voucher_redemptions.push({ id: seed.voucher_redemptions.length + 1, voucher_id: voucher.id, order_code: order.order_code, discount, created_at: order.created_at });
        }

        // Variasi status pengiriman untuk 3 hari terakhir.
        const age = now - new Date(order.created_at);
        if (order.status === "diproses" && age < 3 * DAY) {
            const roll = random();
            if (roll < 0.35) order.status = "dibayar";
            else if (roll < 0.7) {
                order.status = "dikirim";
                order.tracking_number = `JX${String(Math.floor(random() * 1e10)).padStart(10, "0")}`;
                order.shipped_at = new Date(new Date(order.created_at).getTime() + 6 * 3600000).toISOString();
                order.ship_warehouse_id = "w-pusat";
            }
        } else if (order.status === "selesai") {
            order.tracking_number = `JX${String(Math.floor(random() * 1e10)).padStart(10, "0")}`;
            order.shipped_at = new Date(new Date(order.created_at).getTime() + 8 * 3600000).toISOString();
            order.delivered_at = new Date(new Date(order.created_at).getTime() + 2 * DAY).toISOString();
            order.ship_warehouse_id = "w-pusat";
        }
    });

    return seed;
}

/** Tahap B: dipanggil setelah Fase 2 (gudang & jurnal sudah ada). */
export function extendSeedPhase3(seed, now = new Date()) {
    const iso = (offsetDays) => new Date(now.getTime() - offsetDays * DAY).toISOString();

    // ---------- Anggota tambahan: CS & marketing ----------
    const base = (id, full_name, extra) => ({
        id, user_id: null, email: `${id.slice(2)}@contoh.kantoong.id`, full_name,
        org_unit_id: "u-co", position_title: "Staf", level: 1, job_role: "umum",
        manager_id: "m-owner", modules: null, sales_slug: null, is_active: true, ...extra,
    });

    seed.units.push({ id: "u-cs", parent_id: "u-co", name: "Layanan Pelanggan", kind: "divisi", sort: 5 });
    seed.units.push({ id: "u-mkt", parent_id: "u-co", name: "Marketing", kind: "divisi", sort: 6 });
    seed.members.push(
        base("m-nadia", "Nadia Safitri", { position_title: "Staf CS", job_role: "cs", org_unit_id: "u-cs" }),
        base("m-reza", "Reza Firmansyah", { position_title: "Staf Marketing", job_role: "marketing", org_unit_id: "u-mkt" })
    );
    seed.salaries.push({ member_id: "m-nadia", base_salary: 4600000 }, { member_id: "m-reza", base_salary: 5000000 });

    // ---------- Harga modal (± 55% harga jual) ----------
    seed.products.forEach((product) => {
        product.cost_price = product.cost_price || Math.round((product.price * 0.55) / 100) * 100;
    });

    // ---------- Supplier & PO ----------
    seed.suppliers = [
        { id: "s-susu", name: "PT Susu Segar Contoh", contact_name: "Pak Hadi", phone: "0221234567", email: "order@sususegar.contoh", address: "Lembang, Bandung Barat", note: "Kirim tiap Senin & Kamis", is_active: true },
        { id: "s-kemasan", name: "CV Kemasan Contoh", contact_name: "Bu Rina", phone: "0227654321", email: "sales@kemasan.contoh", address: "Cimahi", note: null, is_active: true },
    ];

    const lines = (factor) => seed.products.slice(0, 3).map((product) => ({
        product_id: product.id, qty: 20 * factor, unit_cost: product.cost_price,
    }));

    const po = (serial, status, supplier, days, factor) => {
        const poLines = lines(factor);
        return {
            id: `po-${serial}`,
            po_number: poNumber(serial, new Date(iso(days))),
            supplier_id: supplier,
            warehouse_id: "w-pusat",
            status,
            note: null,
            total: poTotal(poLines),
            paid_method: status === "dibayar" ? "transfer" : null,
            created_by: "m-joko",
            created_at: iso(days),
            ordered_at: status === "draft" ? null : iso(days - 0.2),
            received_at: ["diterima", "dibayar"].includes(status) ? iso(days - 2) : null,
            paid_at: status === "dibayar" ? iso(days - 5) : null,
            lines: poLines,
        };
    };

    seed.purchase_orders = [
        po(1, "dibayar", "s-susu", 25, 2),
        po(2, "diterima", "s-susu", 9, 1),
        po(3, "dipesan", "s-kemasan", 2, 1),
        po(4, "draft", "s-susu", 0.3, 1),
    ];
    seed.po_serial = 5;

    const addEntry = (date, memo, source, ref, entryLines, actor) => {
        seed.journal.push({
            id: `j-po-${seed.journal.length + 1}`, entry_date: wibDate(date), memo, source, ref,
            created_by: actor, created_at: new Date(date).toISOString(), lines: entryLines,
        });
    };

    for (const order of seed.purchase_orders) {
        if (order.received_at) {
            addEntry(order.received_at, `Penerimaan barang ${order.po_number}`, "pembelian", order.po_number, receiveJournal(order.total), "m-joko");
            for (const line of order.lines) {
                seed.stock_moves.push({
                    id: (seed.stock_moves.at(-1)?.id || 0) + 1, warehouse_id: order.warehouse_id, product_id: line.product_id,
                    qty: line.qty, kind: "masuk", ref: order.po_number, note: "Penerimaan PO", actor_id: "m-joko", created_at: order.received_at,
                });
            }
        }
        if (order.paid_at) {
            addEntry(order.paid_at, `Pelunasan ${order.po_number}`, "pembelian", `${order.po_number}-bayar`, payJournal(order.total), "m-fajar");
        }
    }

    // ---------- Tiket CS ----------
    const recentOrder = seed.orders.filter((order) => order.status === "dikirim" || order.status === "selesai").slice(-3);
    seed.cs_tickets = [
        { id: "t-1", ticket_no: "CS-00001", kind: "retur", subject: "Botol bocor saat diterima", customer_name: recentOrder[0]?.customer_name || "Rani", customer_contact: recentOrder[0]?.customer_phone || "", order_code: recentOrder[0]?.order_code || null, status: "baru", priority: "tinggi", assigned_to: "m-nadia", created_by: "m-nadia", created_at: iso(0.2), updated_at: iso(0.2), resolved_at: null },
        { id: "t-2", ticket_no: "CS-00002", kind: "pertanyaan", subject: "Apakah bisa kirim ke luar kota?", customer_name: "Bayu", customer_contact: "Instagram DM", order_code: null, status: "diproses", priority: "normal", assigned_to: "m-nadia", created_by: "m-andi", created_at: iso(1), updated_at: iso(0.5), resolved_at: null },
        { id: "t-3", ticket_no: "CS-00003", kind: "keluhan", subject: "Kurir terlambat 2 hari", customer_name: recentOrder[1]?.customer_name || "Dewi", customer_contact: recentOrder[1]?.customer_phone || "", order_code: recentOrder[1]?.order_code || null, status: "selesai", priority: "normal", assigned_to: "m-nadia", created_by: "m-nadia", created_at: iso(4), updated_at: iso(3), resolved_at: iso(3) },
    ];
    seed.cs_ticket_notes = [
        { id: 1, ticket_id: "t-2", author_id: "m-nadia", body: "Sudah dijelaskan: bisa kirim ke seluruh Jawa via JNE.", created_at: iso(0.5) },
        { id: 2, ticket_id: "t-3", author_id: "m-nadia", body: "Sudah dicek ke kurir, paket diterima. Diberi voucher POTONG5K sebagai permintaan maaf.", created_at: iso(3) },
    ];
    seed.ticket_serial = 4;

    // ---------- Profil CRM ----------
    const firstPhones = [...new Set(seed.orders.map((order) => order.customer_phone))].slice(0, 4);
    seed.crm_profiles = firstPhones.map((phone, index) => ({
        phone,
        tags: [["reseller"], ["suka cokelat"], [], ["kantor"]][index],
        note: ["Beli rutin untuk dijual lagi.", "", "", "Pesan untuk rapat kantor tiap Jumat."][index] || null,
        marketing_consent: index !== 2,
        updated_by: "m-nadia",
        updated_at: iso(3),
    }));

    seed.journal.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    return seed;
}


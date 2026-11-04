/**
 * KANTOONG ERP — DATA CONTOH KONTROL UANG KASIR (Tahap 3 POS Pro)
 * File: frontend/erp/data/demo-seed-cash.js
 *
 * - Shift harian Dewi (ditutup), satu shift lacinya kurang Rp 35.000.
 * - Shift aktif hari ini, modal Rp 300.000.
 * - Satu void TERLAMBAT (25 menit setelah transaksi).
 * - Satu pesanan yang sudah dibuat dapur tapi tidak pernah dibayar.
 * - PIN atasan demo: Owner, Manager Sales, Supervisor = 1234.
 * Dipasang otomatis ke data demo lama maupun baru.
 */

import { cashOf } from "../core/cash-control.js";
import { stationOf } from "../core/kitchen.js";

export const DEMO_PIN = "1234";

/**
 * Hash PIN untuk MODE DEMO saja (data fiktif di perangkat ini).
 * Data asli memakai bcrypt di database (erp_pos_set_pin, db/erp-pos-pro.sql).
 */
export function demoPinHash(memberId, pin) {
    let hash = 0x811c9dc5;
    for (const char of `kantoong-demo|${memberId}|${pin}`) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
}

const MINUTE = 60000;
const iso = (ms) => new Date(ms).toISOString();
const dayWib = (ms) => new Date(ms + 7 * 3600000).toISOString().slice(0, 10);
/** Jam tertentu (WIB) pada hari yang sama dengan `ms`. */
const atWib = (ms, hour, minute = 0) => Date.parse(`${dayWib(ms)}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+07:00`);

export function buildCashSeed(db, now = new Date()) {
    const nowMs = now.getTime();
    const outlet = (db.warehouses || []).find((entry) => entry.kind === "outlet")?.id;
    const cashier = "m-dewi";
    const shifts = [];
    const moves = [];
    const today = dayWib(nowMs);

    // Kelompokkan penjualan Dewi per hari -> satu shift per hari.
    const byDay = new Map();
    for (const sale of db.pos_sales || []) {
        if (sale.cashier_id !== cashier) continue;
        const day = dayWib(new Date(sale.created_at).getTime());
        (byDay.get(day) || byDay.set(day, []).get(day)).push(sale);
    }

    const variances = [0, -2000, 1000, 0, -35000, 0, 500, 0];
    let index = 0;
    for (const [day, sales] of [...byDay.entries()].sort()) {
        const first = Math.min(...sales.map((sale) => new Date(sale.created_at).getTime()));
        const last = Math.max(...sales.map((sale) => new Date(sale.created_at).getTime()));
        const id = `sh-${day}`;
        const opened = Math.min(atWib(first, 7, 55), first - 5 * MINUTE);
        const isToday = day === today;
        sales.forEach((sale) => { sale.shift_id = id; });

        const shift = {
            id, outlet_id: sale0Outlet(sales, outlet), cashier_id: cashier, status: isToday ? "open" : "closed",
            opening_cash: 300000, opened_at: iso(opened),
            closed_at: isToday ? null : iso(Math.max(last + 20 * MINUTE, atWib(last, 21, 5))),
            counted_cash: null, expected_cash: null, variance: null, note: "",
        };

        if (!isToday) {
            if (index % 3 === 1) moves.push({ id: `cm-${index}`, shift_id: id, kind: "keluar", amount: 15000, reason: "Beli es batu", created_by: cashier, created_at: iso(first + 30 * MINUTE) });
            const cash = sales.reduce((sum, sale) => sum + cashOf(sale), 0);
            const out = moves.filter((move) => move.shift_id === id).reduce((sum, move) => sum + (move.kind === "keluar" ? -move.amount : move.amount), 0);
            const expected = shift.opening_cash + cash + out;
            const variance = variances[index % variances.length];
            Object.assign(shift, {
                expected_cash: expected, counted_cash: expected + variance, variance,
                note: variance < -20000 ? "Uang kurang, belum ketemu" : "",
            });
            index += 1;
        }
        shifts.push(shift);
    }

    // Shift aktif hari ini bila belum ada penjualan hari ini.
    if (!shifts.some((shift) => shift.status === "open") && outlet) {
        shifts.push({
            id: `sh-${today}`, outlet_id: outlet, cashier_id: cashier, status: "open", opening_cash: 300000,
            opened_at: iso(Math.min(atWib(nowMs, 7, 55), nowMs - 60 * MINUTE)), closed_at: null,
            counted_cash: null, expected_cash: null, variance: null, note: "",
        });
    }

    // Void TERLAMBAT: transaksi tunai 3 hari lalu dibatalkan 25 menit kemudian.
    const voidable = (db.pos_sales || [])
        .filter((sale) => sale.cashier_id === cashier && sale.method === "tunai" && sale.status !== "batal")
        .find((sale) => dayWib(new Date(sale.created_at).getTime()) === dayWib(nowMs - 3 * 86400000));
    if (voidable) {
        const voidedAt = new Date(voidable.created_at).getTime() + 25 * MINUTE;
        Object.assign(voidable, {
            status: "batal", voided_at: iso(voidedAt), void_reason: "pelanggan_batal", void_note: "Pelanggan tidak jadi",
            void_by: cashier, void_approved_by: "m-budi", refund_cash: cashOf(voidable), refund_shift_id: voidable.shift_id,
        });
        const shift = shifts.find((entry) => entry.id === voidable.shift_id);
        if (shift?.status === "closed") {
            shift.expected_cash -= voidable.refund_cash;
            shift.counted_cash -= voidable.refund_cash;
        }
    }

    // Pesanan dibuat dapur tapi TIDAK PERNAH dibayar (untuk Rekonsiliasi Dapur ↔ Kasir).
    const tickets = db.pos_tickets || [];
    const product = (db.products || []).find((entry) => stationOf(entry) === "bar") || (db.products || [])[0];
    if (product && outlet && tickets.length) {
        tickets.push({
            id: "t-unpaid-1", outlet_id: outlet, queue_no: "A-019", label: "Mas Doni", channel: "take_away", ref: null,
            station: stationOf(product), items: [{ product_id: String(product.id), name: product.name, qty: 2, options: ["Large"], note: "" }],
            status: "diambil", created_by: cashier,
            created_at: iso(nowMs - 48 * MINUTE), started_at: iso(nowMs - 46 * MINUTE), ready_at: iso(nowMs - 42 * MINUTE), picked_at: iso(nowMs - 40 * MINUTE),
        });
    }

    const pins = ["m-owner", "m-dimas", "m-budi"]
        .filter((id) => (db.members || []).some((member) => member.id === id))
        .map((id) => ({ member_id: id, pin_hash: demoPinHash(id, DEMO_PIN), updated_at: iso(nowMs) }));

    return { pos_shifts: shifts, pos_cash_moves: moves, pos_pins: pins };
}

function sale0Outlet(sales, fallback) {
    return sales[0]?.outlet_id || fallback;
}

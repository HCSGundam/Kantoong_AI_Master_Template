import { describe, it, expect } from "vitest";

import {
    cashOf, countDrawer, integrityReport, needsDiscountApproval, shiftSummary, unpaidKitchenOrders, voidDelayMinutes,
} from "../frontend/erp/core/cash-control.js";
import { validateJournal } from "../frontend/erp/core/accounting.js";
import { posProMethods } from "../frontend/erp/data/demo-adapter-pos.js";
import { DEMO_PIN, buildCashSeed, demoPinHash } from "../frontend/erp/data/demo-seed-cash.js";

const MINUTE = 60000;
const NOW = Date.parse("2026-11-04T06:00:00Z");
const iso = (ms) => new Date(ms).toISOString();

describe("Kontrol uang — hitungan", () => {
    it("hitung laci per pecahan", () => {
        expect(countDrawer({ 100000: 2, 50000: 1, 1000: 3, 500: 1 })).toBe(253500);
        expect(countDrawer({ 7: 9 })).toBe(0);
    });

    it("uang tunai masuk dari penjualan campuran / lama", () => {
        expect(cashOf({ payments: [{ method: "qris", amount: 20000 }, { method: "tunai", amount: 8900 }] })).toBe(8900);
        expect(cashOf({ method: "tunai", total: 15000 })).toBe(15000);
        expect(cashOf({ method: "qris", total: 15000 })).toBe(0);
    });

    it("ringkasan shift: modal + tunai − refund + kas masuk − kas keluar", () => {
        const shift = { id: "s1", opening_cash: 300000, counted_cash: 340000 };
        const sales = [
            { shift_id: "s1", status: "selesai", total: 30000, payments: [{ method: "tunai", amount: 30000 }] },
            { shift_id: "s1", status: "selesai", total: 20000, payments: [{ method: "qris", amount: 20000 }] },
            { shift_id: "s1", status: "batal", total: 15000, payments: [{ method: "tunai", amount: 15000 }], refund_cash: 15000, refund_shift_id: "s1" },
            { shift_id: "lain", status: "selesai", total: 99000, payments: [{ method: "tunai", amount: 99000 }] },
        ];
        const moves = [{ shift_id: "s1", kind: "masuk", amount: 50000 }, { shift_id: "s1", kind: "keluar", amount: 12000 }];
        const summary = shiftSummary({ shift, sales, moves, refunds: sales });
        expect(summary).toMatchObject({ transactions: 2, voids: 1, gross: 50000, nonCash: 20000, cashSales: 45000, refundCash: 15000, cashIn: 50000, cashOut: 12000 });
        expect(summary.expected).toBe(300000 + 45000 - 15000 + 50000 - 12000);
        expect(summary.variance).toBe(340000 - 368000);
    });

    it("diskon di atas batas butuh PIN; jeda void dihitung", () => {
        expect(needsDiscountApproval(100000, 20000, 20)).toBe(false);
        expect(needsDiscountApproval(100000, 20001, 20)).toBe(true);
        expect(needsDiscountApproval(100000, 0, 0)).toBe(false);
        expect(voidDelayMinutes({ created_at: iso(NOW), voided_at: iso(NOW + 25 * MINUTE) })).toBe(25);
    });
});

describe("Rekonsiliasi Dapur ↔ Kasir", () => {
    const products = [{ id: "p1", price: 15000 }];
    const ticket = (queue, status, ageMin, extra = {}) => ({
        id: `t-${queue}`, queue_no: queue, status, label: "Tamu", channel: "take_away", station: "bar",
        created_at: iso(NOW - ageMin * MINUTE), items: [{ product_id: "p1", name: "Miloat", qty: 2 }], created_by: "m-dewi", ...extra,
    });

    it("pesanan dibuat & diambil tanpa pernah dibayar = dicurigai; yang lunas / bill terbuka / baru dibuat tidak", () => {
        const tickets = [
            ticket("A-001", "diambil", 40), // tidak pernah dibayar
            ticket("A-002", "diambil", 40), // lunas
            ticket("A-003", "siap", 40),    // masih bill terbuka
            ticket("A-004", "siap", 5),     // baru saja, masih wajar
            ticket("A-005", "dibuat", 40),  // belum selesai dibuat
            ticket("A-006", "diambil", 40, { label: "Riwayat" }),
        ];
        const sales = [{ queue_no: "A-002", status: "selesai", created_at: iso(NOW - 35 * MINUTE) }];
        const bills = [{ queue_no: "A-003" }];
        const unpaid = unpaidKitchenOrders({ tickets, sales, bills, products, now: NOW });
        expect(unpaid.map((order) => order.queue_no)).toEqual(["A-001"]);
        expect(unpaid[0].value).toBe(30000);
    });

    it("transaksi yang di-void tidak dihitung sebagai lunas", () => {
        const unpaid = unpaidKitchenOrders({
            tickets: [ticket("A-009", "diambil", 30)],
            sales: [{ queue_no: "A-009", status: "batal", created_at: iso(NOW - 25 * MINUTE) }],
            products, now: NOW,
        });
        expect(unpaid).toHaveLength(1);
    });
});

describe("Skor integritas kasir", () => {
    it("bersih = 100; void terlambat, laci kurang & pesanan tak dibayar menurunkan skor dengan penjelasan", () => {
        const sale = (id, cashier, extra = {}) => ({ id, cashier_id: cashier, status: "selesai", total: 20000, subtotal: 20000, discount: 0, created_at: iso(NOW), ...extra });
        const sales = [
            ...Array.from({ length: 20 }, (_, i) => sale(`a${i}`, "andi")),
            ...Array.from({ length: 18 }, (_, i) => sale(`d${i}`, "dewi")),
            sale("d-void", "dewi", { status: "batal", voided_at: iso(NOW + 25 * MINUTE) }),
            sale("d-void2", "dewi", { status: "batal", voided_at: iso(NOW + 2 * MINUTE) }),
        ];
        const shifts = [{ id: "s1", cashier_id: "dewi", status: "closed", variance: -35000 }];
        const unpaid = [{ created_by: "dewi" }];
        const report = integrityReport({ cashiers: [{ id: "andi", full_name: "Andi" }, { id: "dewi", full_name: "Dewi" }], sales, shifts, unpaid });
        expect(report[0].cashier.id).toBe("dewi");
        expect(report[0].level).toBe("late");
        expect(report[0].flags.map((flag) => flag.text).join(" ")).toMatch(/terlambat.*kurang.*tidak pernah dibayar/s);
        expect(report[1]).toMatchObject({ score: 100, level: "ok" });
    });
});

describe("Kontrol uang — alur demo & hak akses", () => {
    function setup(viewer) {
        const db = {
            products: [{ id: "p1", name: "Miloat Chocolate", price: 15000 }],
            warehouses: [{ id: "w", kind: "outlet", is_active: true }],
            members: [
                { id: "m-kasir", level: 1, job_role: "kasir", is_active: true, full_name: "Kasir" },
                { id: "m-spv", level: 3, job_role: "umum", is_active: true, full_name: "Supervisor" },
                { id: "m-owner", level: 5, job_role: "umum", is_active: true, full_name: "Owner" },
            ],
            stock_levels: [{ warehouse_id: "w", product_id: "p1", qty: 10, min_qty: 0 }],
            pos_sales: [], pos_serial: 1, accounts: [], pos_settings: {}, pos_modifiers: [], pos_bills: [],
            pos_tickets: [], pos_lost: [], pos_queue: {},
            pos_members: [], pos_points: [], pos_promos: [], pos_ingredients: [], pos_ingredient_stock: {}, pos_recipes: {}, pos_option_recipes: {}, pos_ingredient_moves: [],
            pos_shifts: [], pos_cash_moves: [], pos_pins: [{ member_id: "m-spv", pin_hash: demoPinHash("m-spv", "4826") }],
        };
        const journal = [];
        const moved = [];
        const make = (who) => posProMethods({
            db: () => db, save: () => {}, me: () => db.members.find((member) => member.id === who.id) || who, audit: () => {},
            journalWrite: (memo, source, ref, lines) => journal.push({ ref, lines }), recordMoves: (moves) => moved.push(...moves),
        });
        return { db, api: make(viewer), make, journal, moved };
    }
    const kasir = { id: "m-kasir", level: 1, job_role: "kasir" };
    const sell = (api, extra = {}) => api.posCheckoutPro({
        outlet_id: "w", channel: "take_away", lines: [{ product_id: "p1", qty: 2 }],
        payments: [{ method: "tunai", amount: 50000 }], ...extra,
    });

    it("tanpa shift tidak bisa jualan; tutup buta menghitung selisih", async () => {
        const { api } = setup(kasir);
        await expect(sell(api)).rejects.toThrow(/Buka shift/);
        const shift = await api.openShift({ outlet_id: "w", opening_cash: 200000 });
        await expect(api.openShift({ outlet_id: "w", opening_cash: 0 })).rejects.toThrow(/belum ditutup/);
        const sale = await sell(api); // 2 × 15.000 + PB1 = 33.000 tunai
        expect(sale.shift_id).toBe(shift.id);
        await api.addCashMove({ shift_id: shift.id, kind: "keluar", amount: 10000, reason: "Beli es batu" });
        await expect(api.addCashMove({ shift_id: shift.id, kind: "keluar", amount: 5000, reason: " " })).rejects.toThrow(/alasan/);
        const { summary } = await api.closeShift({ shift_id: shift.id, counted_cash: 220000 });
        expect(summary.expected).toBe(200000 + sale.total - 10000);
        expect(summary.variance).toBe(220000 - summary.expected);
        expect(await api.getMyShift("w")).toBeNull();
    });

    it("void: PIN salah ditolak; PIN atasan benar = stok kembali, jurnal balik seimbang, refund tunai dari shift aktif", async () => {
        const { api, journal, moved } = setup(kasir);
        await api.openShift({ outlet_id: "w", opening_cash: 0 });
        const sale = await sell(api);
        await expect(api.voidSale({ sale_id: sale.id, reason: "salah_input", pin: "0000" })).rejects.toThrow(/PIN atasan salah/);
        const voided = await api.voidSale({ sale_id: sale.id, reason: "salah_input", pin: "4826" });
        expect(voided).toMatchObject({ status: "batal", void_approved_by: "m-spv", refund_cash: sale.total });
        expect(moved.at(-1)).toMatchObject({ product_id: "p1", qty: 2, kind: "retur" });
        const reversal = journal.find((entry) => entry.ref === `${sale.receipt_no}-VOID`);
        expect(validateJournal(reversal.lines)).toBe("");
        expect(reversal.lines.find((line) => line.account_code === "1-1000").credit).toBe(sale.total);
        await expect(api.voidSale({ sale_id: sale.id, reason: "salah_input", pin: "4826" })).rejects.toThrow(/sudah dibatalkan/);
    });

    it("supervisor tidak boleh menyetujui void-nya sendiri; owner boleh", async () => {
        const { db, make } = setup(kasir);
        const supervisor = make({ id: "m-spv", level: 3, job_role: "kasir" });
        db.members.find((member) => member.id === "m-spv").job_role = "kasir";
        await supervisor.openShift({ outlet_id: "w", opening_cash: 0 });
        const sale = await sell(supervisor);
        await expect(supervisor.voidSale({ sale_id: sale.id, reason: "lainnya", pin: "4826" })).rejects.toThrow(/dirinya sendiri/);
    });

    it("diskon besar wajib PIN atasan; PIN dicatat sebagai penyetuju", async () => {
        const { api } = setup(kasir);
        await api.openShift({ outlet_id: "w", opening_cash: 0 });
        await expect(sell(api, { discount: 10000 })).rejects.toThrow(/butuh PIN atasan/);
        const sale = await sell(api, { discount: 10000, approval_pin: "4826" });
        expect(sale.discount_approved_by).toBe("m-spv");
        const small = await sell(api, { discount: 1000 });
        expect(small.discount_approved_by).toBeNull();
    });

    it("atur PIN: khusus level 3+, PIN mudah ditolak", async () => {
        const { make } = setup(kasir);
        await expect(make(kasir).setMyPin("4826")).rejects.toThrow(/supervisor/);
        const owner = make({ id: "m-owner", level: 5, job_role: "umum" });
        await expect(owner.setMyPin("1111")).rejects.toThrow(/mudah ditebak/);
        await expect(owner.setMyPin("1234")).rejects.toThrow(/mudah ditebak/);
        await owner.setMyPin("7391");
        expect(await owner.hasMyPin()).toBe(true);
    });

    it("data demo: shift harian + shift aktif, void terlambat, pesanan tak dibayar, PIN demo", () => {
        const day = 86400000;
        const now = new Date(NOW);
        const db = {
            members: [{ id: "m-owner" }, { id: "m-dimas" }, { id: "m-budi" }, { id: "m-dewi" }],
            products: [{ id: "a", name: "Miloat Milktea", price: 15000 }],
            warehouses: [{ id: "w", kind: "outlet" }],
            pos_tickets: [{ id: "x" }],
            pos_sales: [3, 2, 1, 0].map((daysAgo, index) => ({
                id: `s${index}`, cashier_id: "m-dewi", outlet_id: "w", method: "tunai", total: 15000, status: "selesai",
                created_at: iso(NOW - daysAgo * day - 60 * MINUTE),
            })),
        };
        const seed = buildCashSeed(db, now);
        expect(seed.pos_shifts.filter((shift) => shift.status === "open")).toHaveLength(1);
        expect(seed.pos_shifts.filter((shift) => shift.status === "closed").length).toBe(3);
        expect(db.pos_sales.find((sale) => sale.status === "batal")?.void_approved_by).toBe("m-budi");
        expect(db.pos_tickets.some((ticket) => ticket.id === "t-unpaid-1")).toBe(true);
        expect(seed.pos_pins.find((row) => row.member_id === "m-owner").pin_hash).toBe(demoPinHash("m-owner", DEMO_PIN));
    });
});

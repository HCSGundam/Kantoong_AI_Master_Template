import { describe, it, expect } from "vitest";

import {
    estimateReady, forecastPrep, learnPrepTimes, orderReadyAt, queueCode, slaTone, splitTickets, stationOf, ticketMinutes,
} from "../frontend/erp/core/kitchen.js";
import { LOST_REASONS, lineKey, markSent, summarizeLost, unsentLines } from "../frontend/erp/core/pos-pro.js";
import { posProMethods } from "../frontend/erp/data/demo-adapter-pos.js";
import { buildKitchenSeed, ensurePosMembers } from "../frontend/erp/data/demo-seed-kitchen.js";

const products = [
    { id: "p1", name: "Miloat Chocolate", price: 15000, category: "Umum" },
    { id: "p2", name: "Oatcookies", price: 7000, category: "Umum" },
];

const MINUTE = 60000;
const NOW = Date.parse("2026-11-04T06:00:00Z"); // 13.00 WIB
const iso = (ms) => new Date(ms).toISOString();

describe("Dapur & Bar — fondasi", () => {
    it("minuman ke bar, makanan ke dapur; satu pesanan dipecah per station", () => {
        expect(stationOf(products[0])).toBe("bar");
        expect(stationOf(products[1])).toBe("dapur");
        const tickets = splitTickets([
            { product_id: "p1", name: "Miloat Chocolate", qty: 2, options: [{ name: "Large" }], note: "less ice" },
            { product_id: "p2", name: "Oatcookies", qty: 1, options: [] },
        ], products);
        expect(tickets.map((ticket) => ticket.station).sort()).toEqual(["bar", "dapur"]);
        expect(tickets.find((ticket) => ticket.station === "bar").items[0]).toMatchObject({ qty: 2, options: ["Large"], note: "less ice" });
    });

    it("nomor antrian & warna lama menunggu", () => {
        expect(queueCode(7)).toBe("A-007");
        expect(slaTone(iso(NOW - 5 * MINUTE), NOW)).toBe("ok");
        expect(slaTone(iso(NOW - 10 * MINUTE), NOW)).toBe("warn");
        expect(slaTone(iso(NOW - 20 * MINUTE), NOW)).toBe("late");
    });

    it("bill ditambah pesanan: hanya tambahannya yang dikirim ke dapur (tanpa dobel)", () => {
        const a = { key: lineKey("p1", [], ""), product_id: "p1", qty: 2 };
        const b = { key: lineKey("p2", [], ""), product_id: "p2", qty: 1 };
        const sent = markSent([a], {});
        expect(unsentLines([a, b], sent)).toEqual([b]);
        expect(unsentLines([{ ...a, qty: 3 }, b], markSent([a, b], sent))).toEqual([{ ...a, qty: 1 }]);
    });
});

describe("ETA Jujur — belajar dari waktu pembuatan nyata", () => {
    const done = (station, productId, minutes, offset) => ({
        id: `d${offset}`, station, status: "diambil",
        items: [{ product_id: productId, name: "x", qty: 1 }],
        created_at: iso(NOW - offset * MINUTE), started_at: iso(NOW - offset * MINUTE),
        ready_at: iso(NOW - offset * MINUTE + minutes * MINUTE),
    });

    it("memakai median per produk bila ≥3 contoh, per station bila ≥3, selain itu bawaan", () => {
        const history = [done("bar", "p1", 2, 100), done("bar", "p1", 4, 90), done("bar", "p1", 3, 80), done("dapur", "p2", 9, 70)];
        const prep = learnPrepTimes(history);
        expect(prep.product.p1).toBe(3);
        expect(prep.station.bar).toBe(3);
        expect(prep.station.dapur).toBeUndefined(); // baru 1 contoh: belum dipercaya
        expect(ticketMinutes({ station: "dapur", items: [{ product_id: "p2", qty: 1 }] }, prep)).toBe(7); // bawaan dapur
        expect(ticketMinutes({ station: "bar", items: [{ product_id: "p1", qty: 3 }] }, prep)).toBeCloseTo(3.8);
    });

    it("antrian nyata: tiket kedua menunggu tiket pertama; 2 barista = paralel", () => {
        const prep = { product: { p1: 3 }, station: {} };
        const tickets = [
            { id: "t1", queue_no: "A-001", station: "bar", status: "baru", created_at: iso(NOW - 2 * MINUTE), items: [{ product_id: "p1", qty: 1 }] },
            { id: "t2", queue_no: "A-002", station: "bar", status: "baru", created_at: iso(NOW - MINUTE), items: [{ product_id: "p1", qty: 1 }] },
        ];
        const single = estimateReady(tickets, prep, NOW, { bar: 1 });
        expect(single.t1).toBe(NOW + 3 * MINUTE);
        expect(single.t2).toBe(NOW + 6 * MINUTE);
        const two = estimateReady(tickets, prep, NOW, { bar: 2 });
        expect(two.t2).toBe(NOW + 3 * MINUTE);
    });

    it("tiket yang sedang dibuat dihitung dari waktu mulai; terlambat = jujur 'sebentar lagi'", () => {
        const prep = { product: { p1: 3 }, station: {} };
        const tickets = [
            { id: "late", queue_no: "A-003", station: "bar", status: "dibuat", created_at: iso(NOW - 10 * MINUTE), started_at: iso(NOW - 8 * MINUTE), items: [{ product_id: "p1", qty: 1 }] },
            { id: "food", queue_no: "A-003", station: "dapur", status: "baru", created_at: iso(NOW - 10 * MINUTE), items: [{ product_id: "p2", qty: 1 }] },
        ];
        const eta = estimateReady(tickets, prep, NOW, { bar: 1, dapur: 1 });
        expect(eta.late).toBe(NOW + MINUTE);
        expect(orderReadyAt("A-003", tickets, eta)).toBe(NOW + 7 * MINUTE); // pesanan siap saat makanan siap
    });
});

describe("Dapur Prediktif — siapkan duluan", () => {
    it("rata-rata per hari pada jam yang sama + 🔥 minat chat AI; hari ini tidak dihitung", () => {
        const day = 86400000;
        const sale = (daysAgo, minutes, productId, qty) => ({
            created_at: iso(NOW - daysAgo * day + minutes * MINUTE), status: "selesai",
            items: [{ product_id: productId, name: productId === "p1" ? "Miloat Chocolate" : "Oatcookies", qty }],
        });
        const sales = [
            sale(1, 10, "p1", 4), sale(2, 20, "p1", 2), sale(2, -120, "p1", 9), // jam lain: tidak dihitung
            sale(1, 5, "p2", 1), sale(0, 10, "p1", 50), // hari ini: tidak dihitung
        ];
        const aiEvents = Array.from({ length: 3 }, () => ({ at: iso(NOW - 30 * MINUTE), product_name: "Oatcookies" }));
        const forecast = forecastPrep(sales, new Date(NOW), { products, aiEvents });
        const choco = forecast.find((row) => row.product_id === "p1");
        expect(choco).toMatchObject({ expected: 3, suggest: 3, station: "bar", basis: 2 });
        expect(forecast.find((row) => row.product_id === "p2").hot).toBe(3);
    });
});

describe("Penjualan yang hilang", () => {
    it("diringkas per alasan & produk", () => {
        const summary = summarizeLost([
            { name: "Miloat Milktea", qty: 3, value: 45000, reason: "habis" },
            { name: "Miloat Chocolate", qty: 1, value: 15000, reason: "lama" },
            { name: "Miloat Milktea", qty: 1, value: 15000, reason: "aneh" },
        ]);
        expect(summary.value).toBe(75000);
        expect(summary.count).toBe(5);
        expect(summary.byReason[0]).toEqual(["habis", 45000]);
        expect(summary.byReason.map(([reason]) => reason)).toContain("lainnya");
        expect(summary.byProduct[0]).toEqual(["Miloat Milktea", 60000]);
        expect(Object.keys(LOST_REASONS)).toContain("harga");
    });
});

describe("Dapur & penjualan hilang — alur demo & hak akses", () => {
    function setup(viewer) {
        const db = {
            products, warehouses: [{ id: "w", kind: "outlet", is_active: true }], members: [], units: [],
            pos_modifiers: [], pos_tickets: [], pos_lost: [], pos_queue: {}, pos_bills: [], pos_settings: {}, accounts: [],
            ai_events: [
                { at: new Date().toISOString(), product_name: "Miloat Chocolate", session_key: "rahasia" },
                { at: new Date().toISOString(), product_name: "Miloat Chocolate", session_key: "rahasia2" },
            ],
        };
        const api = posProMethods({ db: () => db, save: () => {}, me: () => viewer, audit: () => {}, journalWrite: () => {}, recordMoves: () => {} });
        return { db, api };
    }
    const kasir = { id: "m-k", level: 1, job_role: "kasir" };
    const barista = { id: "m-b", level: 1, job_role: "dapur" };

    it("kasir: nomor antrian berurutan, kirim tiket; barista: ubah status (waktu tercatat)", async () => {
        const { db, api } = setup(kasir);
        expect(await api.nextQueueNo("w")).toBe("A-001");
        expect(await api.nextQueueNo("w")).toBe("A-002");
        const [ticket] = await api.sendToKitchen({ outlet_id: "w", queue_no: "A-002", label: "Meja 1", channel: "dine_in", items: [{ product_id: "p1", name: "Miloat Chocolate", qty: 1, options: [] }] });
        expect(ticket).toMatchObject({ station: "bar", status: "baru", queue_no: "A-002" });

        const bar = posProMethods({ db: () => db, save: () => {}, me: () => barista, audit: () => {}, journalWrite: () => {}, recordMoves: () => {} });
        const started = await bar.setTicketStatus(ticket.id, "dibuat");
        expect(started.started_at).toBeTruthy();
        const ready = await bar.setTicketStatus(ticket.id, "siap");
        expect(ready.ready_at).toBeTruthy();
        await expect(bar.sendToKitchen({ outlet_id: "w", items: [] })).rejects.toThrow(/Akses ditolak/);
    });

    it("minat chat AI hanya berupa hitungan (tanpa data sesi pengunjung)", async () => {
        const { api } = setup(barista);
        expect(await api.kitchenInterest()).toEqual([{ product_name: "Miloat Chocolate", count: 2 }]);
        const outsider = setup({ id: "m-x", level: 1, job_role: "sales" }).api;
        expect(await outsider.kitchenInterest()).toEqual([]);
    });

    it("penjualan hilang: kasir mencatat; kasir hanya melihat miliknya, keuangan melihat semua", async () => {
        const { db, api } = setup(kasir);
        await api.recordLostSale({ outlet_id: "w", product_id: "p1", name: "Miloat Chocolate", qty: 2, value: 30000, reason: "habis" });
        db.pos_lost.push({ id: "other", outlet_id: "w", name: "X", qty: 1, value: 1, reason: "harga", created_by: "m-lain", created_at: new Date().toISOString() });
        expect(await api.listLostSales({ outletId: "w" })).toHaveLength(1);
        const finance = posProMethods({ db: () => db, save: () => {}, me: () => ({ id: "m-f", level: 1, job_role: "keuangan" }), audit: () => {}, journalWrite: () => {}, recordMoves: () => {} });
        expect(await finance.listLostSales({ outletId: "w" })).toHaveLength(2);
    });

    it("data demo: Barista ditambahkan sekali; tiket riwayat + aktif + contoh penjualan hilang", () => {
        const db = {
            members: [{ id: "m-dewi" }], units: [{ id: "u-outlet" }], salaries: [],
            products: [
                { id: "a", name: "Miloat Milktea", price: 15000 }, { id: "b", name: "Miloat Chocolate", price: 15000 }, { id: "c", name: "Oatcookies", price: 7000 },
            ],
            warehouses: [{ id: "w", kind: "outlet" }],
            pos_sales: [{ outlet_id: "w", receipt_no: "R1", created_at: new Date(Date.now() - 2 * 86400000).toISOString(), items: [{ product_id: "a", name: "Miloat Milktea", qty: 1 }] }],
            pos_bills: [], pos_modifiers: [],
        };
        expect(ensurePosMembers(db)).toBe(true);
        expect(ensurePosMembers(db)).toBe(false);
        expect(db.members.find((member) => member.id === "m-bayu")).toMatchObject({ job_role: "dapur", org_unit_id: "u-outlet" });
        const seed = buildKitchenSeed(db);
        expect(seed.pos_tickets.some((ticket) => ticket.status === "diambil")).toBe(true);
        expect(seed.pos_tickets.some((ticket) => ticket.status === "siap")).toBe(true);
        expect(seed.pos_lost.length).toBeGreaterThan(0);
    });
});

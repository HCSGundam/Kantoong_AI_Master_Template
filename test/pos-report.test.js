import { describe, expect, it } from "vitest";
import { buildReport, pctChange, periodRange, startOfWibDay, storyLines, toCsv } from "../frontend/erp/core/pos-report.js";
import { OFFLINE_KEY, enqueue, equalShares, isNetworkError, readQueue, removeFromQueue, splitLines, syncQueue } from "../frontend/erp/core/pos-split.js";

const at = (text) => new Date(`${text}+07:00`);

describe("periode laporan yang adil", () => {
    it("hari ini dibanding hari yang sama minggu lalu sampai jam yang sama", () => {
        const now = at("2026-11-04T15:30:00");
        const range = periodRange("today", now);
        expect(new Date(range.from)).toEqual(at("2026-11-04T00:00:00"));
        expect(range.to).toBe(now.getTime());
        expect(new Date(range.prevFrom)).toEqual(at("2026-10-28T00:00:00"));
        expect(new Date(range.prevTo)).toEqual(at("2026-10-28T15:30:00"));
        const yesterday = periodRange("yesterday", now);
        expect(new Date(yesterday.from)).toEqual(at("2026-11-03T00:00:00"));
        expect(new Date(yesterday.prevFrom)).toEqual(at("2026-10-27T00:00:00"));
        expect(startOfWibDay(at("2026-11-04T23:59:00").getTime())).toBe(at("2026-11-04T00:00:00").getTime());
    });

    it("persentase perubahan", () => {
        expect(pctChange(120, 100)).toBe(20);
        expect(pctChange(50, 0)).toBeNull();
    });
});

describe("laporan kasir", () => {
    const context = {
        recipes: { kopi: [{ ingredient_id: "susu", qty: 100 }] },
        optionRecipes: {},
        ingredients: [{ id: "susu", name: "Susu", cost: 50 }],
    };
    const sales = [
        { id: "s1", cashier_id: "dewi", channel: "dine_in", total: 33000, service: 1500, tax: 1500, discount: 1000, promo_discount: 2000, created_at: at("2026-11-04T09:10:00").toISOString(),
            items: [{ product_id: "kopi", name: "Kopi", qty: 2, price: 15000 }], payments: [{ method: "qris", amount: 20000 }, { method: "tunai", amount: 13000 }] },
        { id: "s2", cashier_id: "dewi", channel: "gofood", total: 20000, created_at: at("2026-11-04T09:40:00").toISOString(),
            items: [{ product_id: "roti", name: "Roti", qty: 1, price: 20000 }], payments: [{ method: "transfer", amount: 20000 }] },
        { id: "s3", cashier_id: "budi", channel: "take_away", total: 15000, created_at: at("2026-11-04T13:00:00").toISOString(), status: "batal",
            items: [{ product_id: "kopi", name: "Kopi", qty: 1, price: 15000 }], payments: [{ method: "tunai", amount: 15000 }] },
        { id: "old", cashier_id: "dewi", channel: "take_away", total: 99000, created_at: at("2026-10-01T10:00:00").toISOString(), items: [] },
    ];
    const ratings = [{ score: 3, created_at: at("2026-11-04T09:15:00").toISOString() }, { score: 1, created_at: at("2026-11-04T09:45:00").toISOString() }];
    const lost = [{ value: 15000, reason: "habis", qty: 1, name: "Kopi", created_at: at("2026-11-04T12:00:00").toISOString() }];
    const range = { from: at("2026-11-04T00:00:00").getTime(), to: at("2026-11-05T00:00:00").getTime() };
    const report = buildReport({ sales, context, settings: { online_commission: 20 }, lost, ratings, ...range });

    it("angka utama, HPP & laba kotor", () => {
        expect(report).toMatchObject({ count: 2, voids: 1, gross: 53000, service: 1500, tax: 1500, net: 50000, promoDiscount: 2000, manualDiscount: 1000, cogs: 10000, grossProfit: 40000, foodCost: 20, avgTicket: 26500, items: 3 });
    });

    it("rekap per jam, menu, channel (komisi), metode bayar, kasir", () => {
        expect(report.peak).toMatchObject({ hour: 9, total: 53000, count: 2 });
        expect(report.byMenu[0]).toMatchObject({ product_id: "kopi", qty: 2, revenue: 30000, cogs: 10000, profit: 20000 });
        expect(report.byChannel.find((row) => row.channel === "gofood")).toMatchObject({ total: 20000, commission: 4000, net: 16000 });
        expect(Object.fromEntries(report.byMethod.map((row) => [row.method, row.amount]))).toEqual({ qris: 20000, tunai: 13000, transfer: 20000 });
        expect(report.byCashier.find((row) => row.cashier_id === "budi")).toMatchObject({ count: 0, voids: 1 });
        expect(report.rating).toMatchObject({ count: 2, happy: 1, sad: 1, happyPct: 50 });
        expect(report.lost.value).toBe(15000);
    });

    it("ringkasan bercerita dengan pembanding", () => {
        const previous = buildReport({ sales: [{ total: 40000, created_at: at("2026-10-28T10:00:00").toISOString(), items: [] }], from: at("2026-10-28T00:00:00").getTime(), to: at("2026-10-29T00:00:00").getTime() });
        const lines = storyLines(report, previous, { compareLabel: "Rabu lalu", cashierName: (id) => (id === "budi" ? "Budi" : id) });
        const text = lines.map((line) => line.text).join("\n");
        expect(lines[0]).toMatchObject({ tone: "good" });
        expect(text).toContain("Omzet Rp 53.000 dari 2 transaksi (▲ 32,5% dibanding Rabu lalu: Rp 40.000)");
        expect(text).toContain("Jam tersibuk 09:00–10:00");
        expect(text).toContain("Laba kotor Rp 40.000");
        expect(text).toContain("ojol");
        expect(text).toContain("oleh Budi (1)");
        expect(text).toContain("Penjualan hilang Rp 15.000");
        expect(text).toContain("☹️ 1");
        expect(storyLines(buildReport({ sales: [] }))[0].text).toMatch(/Belum ada/);
    });

    it("CSV untuk Excel: titik koma & tanda kutip aman", () => {
        const csv = toCsv([{ name: 'Kopi "Susu"; Large', qty: 2 }, { name: "Teh", qty: 1 }], [{ key: "name", label: "Menu" }, { key: "qty", label: "Jumlah" }, { label: "x2", value: (row) => row.qty * 2 }]);
        expect(csv).toBe('Menu;Jumlah;x2\r\n"Kopi ""Susu""; Large";2;4\r\nTeh;1;2');
    });
});

describe("split bill", () => {
    it("bagi rata dengan pembulatan, total tetap pas", () => {
        expect(equalShares(100000, 3)).toEqual([33400, 33400, 33200]);
        expect(equalShares(50000, 2)).toEqual([25000, 25000]);
        expect(equalShares(300, 4)).toEqual([100, 100, 100, 0]);
        expect(equalShares(15000, 1)).toEqual([15000]);
        expect(equalShares(100000, 3).reduce((a, b) => a + b, 0)).toBe(100000);
    });

    it("pisah per item", () => {
        const lines = [{ key: "a", product_id: "kopi", qty: 3 }, { key: "b", product_id: "roti", qty: 1 }];
        expect(splitLines(lines, { a: 1, b: 5 })).toEqual({
            part: [{ key: "a", product_id: "kopi", qty: 1 }, { key: "b", product_id: "roti", qty: 1 }],
            rest: [{ key: "a", product_id: "kopi", qty: 2 }],
        });
        expect(splitLines(lines, {}).part).toEqual([]);
    });
});

describe("antrian offline", () => {
    const memory = () => {
        const data = {};
        return { getItem: (key) => data[key] ?? null, setItem: (key, value) => { data[key] = value; }, data };
    };

    it("simpan, nomor sementara, hapus", () => {
        const storage = memory();
        const first = enqueue(storage, { total: 1 }, { total: 1 }, at("2026-11-04T10:00:00"));
        const second = enqueue(storage, { total: 2 }, { total: 2 }, at("2026-11-04T10:05:00"));
        expect(first.id).toBe("OFF-261104-001");
        expect(second.id).toBe("OFF-261104-002");
        expect(first.payload.offline_at).toBe(at("2026-11-04T10:00:00").toISOString());
        removeFromQueue(storage, first.id);
        expect(readQueue(storage).map((entry) => entry.id)).toEqual([second.id]);
        expect(readQueue({ getItem: () => "rusak{" })).toEqual([]);
        expect(OFFLINE_KEY).toMatch(/offline/);
    });

    it("sinkron: berhasil dihapus, ditolak ditandai, jaringan putus berhenti", async () => {
        const storage = memory();
        enqueue(storage, { n: 1 }, {});
        enqueue(storage, { n: 2 }, {});
        enqueue(storage, { n: 3 }, {});
        const result = await syncQueue(storage, async (payload) => {
            if (payload.n === 2) throw new Error("Buka shift dulu sebelum berjualan.");
            if (payload.n === 3) throw new TypeError("Failed to fetch");
            return { receipt_no: "POS-1" };
        });
        expect(result.synced).toHaveLength(1);
        expect(result.failed).toEqual([{ id: expect.any(String), error: "Buka shift dulu sebelum berjualan." }]);
        expect(result.stopped).toBe(true);
        expect(result.remaining).toBe(2);
        expect(readQueue(storage)[0].error).toMatch(/shift/);
        expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
        expect(isNetworkError(new Error("Stok kurang"))).toBe(false);
    });
});

describe("Tahap 6 — alur demo: offline & rating", async () => {
    const { posProMethods } = await import("../frontend/erp/data/demo-adapter-pos.js");
    function setup() {
        const db = {
            products: [{ id: "p1", name: "Kopi", price: 20000, category: "Minuman" }],
            warehouses: [{ id: "w", kind: "outlet", is_active: true }],
            members: [], stock_levels: [{ warehouse_id: "w", product_id: "p1", qty: 50, min_qty: 0 }],
            pos_sales: [], pos_serial: 1, accounts: [], pos_settings: { w: { tax_enabled: false, service_enabled: false, rounding: 0 } },
            pos_modifiers: [], pos_bills: [], pos_tickets: [], pos_lost: [], pos_queue: {}, pos_shifts: [], pos_cash_moves: [], pos_pins: [],
            pos_members: [], pos_points: [], pos_ingredients: [], pos_ingredient_stock: {}, pos_recipes: {}, pos_option_recipes: {}, pos_ingredient_moves: [],
            pos_ratings: [],
            pos_promos: [{ id: "pagi", name: "Pagi", kind: "happy_hour", percent: 50, product_ids: [], categories: [], days: [], start_time: "07:00", end_time: "08:00", is_active: true }],
        };
        const make = (who) => posProMethods({ db: () => db, save: () => {}, me: () => who, audit: () => {}, journalWrite: () => {}, recordMoves: () => {} });
        return { db, kasir: make({ id: "k", level: 1, job_role: "kasir" }), owner: make({ id: "o", level: 5, job_role: "umum" }) };
    }

    it("sinkron offline memakai jam aslinya (promo jam itu berlaku), > 48 jam ditolak", async () => {
        const { kasir } = setup();
        await kasir.openShift({ outlet_id: "w", opening_cash: 0 });
        const morning = new Date(Date.now() - 86400000);
        const wib = new Date(morning.getTime() + 7 * 3600000).toISOString().slice(0, 10);
        const offlineAt = new Date(`${wib}T07:30:00+07:00`);
        const payload = { outlet_id: "w", channel: "take_away", lines: [{ product_id: "p1", qty: 1 }], payments: [{ method: "tunai", amount: 10000 }] };
        if (Date.now() - offlineAt.getTime() < 48 * 3600000) {
            const sale = await kasir.posCheckoutPro({ ...payload, offline_at: offlineAt.toISOString() });
            expect(sale).toMatchObject({ total: 10000, promo_discount: 10000, offline: true, created_at: offlineAt.toISOString() });
        }
        await expect(kasir.posCheckoutPro({ ...payload, offline_at: new Date(Date.now() - 50 * 3600000).toISOString() })).rejects.toThrow(/48 jam/);
    });

    it("rating 1 per struk; hanya supervisor/keuangan yang membaca", async () => {
        const { kasir, owner } = setup();
        await kasir.openShift({ outlet_id: "w", opening_cash: 0 });
        const sale = await kasir.posCheckoutPro({ outlet_id: "w", channel: "take_away", lines: [{ product_id: "p1", qty: 1 }], payments: [{ method: "qris", amount: 20000 }] });
        await expect(kasir.rateSale(sale.id, 5)).rejects.toThrow(/tidak valid/);
        await kasir.rateSale(sale.id, 3);
        await kasir.rateSale(sale.id, 1);
        expect(await kasir.listRatings()).toEqual([]);
        const rows = await owner.listRatings();
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ sale_id: sale.id, score: 3, cashier_id: "k" });
    });
});

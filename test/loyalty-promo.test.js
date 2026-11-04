import { describe, expect, it } from "vitest";
import { applyPromos, cleanPromo, inPromoWindow, promoActive, promoReport, suggestPromos, validatePromo, wibParts } from "../frontend/erp/core/promo.js";
import {
    churnRadar, displayPhone, greetingText, loyaltySummary, maskedPhone, memberProfile, normalizePhone, pointsBalance, pointsEarned, pointsRedeemable,
} from "../frontend/erp/core/loyalty.js";
import { posSettings, priceOrder } from "../frontend/erp/core/pos-pro.js";

const products = [
    { id: "kopi", name: "Kopi Susu", price: 20000, category: "Minuman" },
    { id: "teh", name: "Teh", price: 10000, category: "Minuman" },
    { id: "roti", name: "Croissant", price: 25000, category: "Makanan" },
];
const at = (text) => new Date(`${text}+07:00`);
const settings = posSettings({ service_enabled: false, tax_enabled: false, rounding: 0 });

const happy = { id: "hh", name: "Jam Hemat", kind: "happy_hour", percent: 20, product_ids: [], categories: ["Minuman"], days: [], start_time: "14:00", end_time: "16:00", is_active: true };
const bundle = { id: "pk", name: "Paket", kind: "bundle", bundle_ids: ["kopi", "roti"], bundle_amount: 5000, days: [], start_time: "", end_time: "", is_active: true };

describe("promo: jadwal", () => {
    it("membaca jam WIB, termasuk lewat tengah malam", () => {
        expect(wibParts(at("2026-11-04T14:30:00")).minutes).toBe(870);
        expect(inPromoWindow(happy, at("2026-11-04T14:30:00"))).toBe(true);
        expect(inPromoWindow(happy, at("2026-11-04T16:00:00"))).toBe(false);
        const night = { start_time: "22:00", end_time: "02:00", days: [] };
        expect(inPromoWindow(night, at("2026-11-04T23:10:00"))).toBe(true);
        expect(inPromoWindow(night, at("2026-11-04T01:10:00"))).toBe(true);
        expect(inPromoWindow(night, at("2026-11-04T12:00:00"))).toBe(false);
    });

    it("hari & tanggal berlaku", () => {
        const day = wibParts(at("2026-11-04T15:00:00")).day;
        expect(promoActive({ ...happy, days: [day] }, at("2026-11-04T15:00:00"))).toBe(true);
        expect(promoActive({ ...happy, days: [(day + 1) % 7] }, at("2026-11-04T15:00:00"))).toBe(false);
        expect(promoActive({ ...happy, starts_on: "2026-11-05" }, at("2026-11-04T15:00:00"))).toBe(false);
        expect(promoActive({ ...happy, ends_on: "2026-11-03" }, at("2026-11-04T15:00:00"))).toBe(false);
        expect(promoActive({ ...happy, is_active: false }, at("2026-11-04T15:00:00"))).toBe(false);
    });

    it("validasi form promo", () => {
        expect(validatePromo({ name: "", kind: "happy_hour", percent: 10 })).toMatch(/nama/i);
        expect(validatePromo({ name: "A", kind: "bundle", bundle_ids: ["kopi"], bundle_amount: 5000 })).toMatch(/2 menu/);
        expect(validatePromo({ name: "A", kind: "happy_hour", percent: 10, start_time: "14:00" })).toMatch(/jam/);
        expect(validatePromo(happy)).toBe("");
        expect(cleanPromo({ ...happy, days: [0, 1, 2, 3, 4, 5, 6] }).days).toEqual([]);
    });
});

describe("promo: hitungan", () => {
    const items = [
        { product_id: "kopi", qty: 2, line_total: 40000 },
        { product_id: "roti", qty: 1, line_total: 25000 },
    ];

    it("jam hemat hanya untuk menu target di jamnya", () => {
        const result = applyPromos({ items, products, promos: [happy], now: at("2026-11-04T15:00:00") });
        expect(result.discount).toBe(8000);
        expect(result.applied).toEqual([{ promo_id: "hh", name: "Jam Hemat", kind: "happy_hour", amount: 8000 }]);
        expect(applyPromos({ items, products, promos: [happy], now: at("2026-11-04T17:00:00") }).discount).toBe(0);
    });

    it("paket hemat dari unit yang tidak kena jam hemat (tidak dobel)", () => {
        expect(applyPromos({ items, products, promos: [bundle], now: at("2026-11-04T17:00:00") }).discount).toBe(5000);
        // Jam 15:00 kopi sudah kena jam hemat -> paket tidak berlaku.
        expect(applyPromos({ items, products, promos: [happy, bundle], now: at("2026-11-04T15:00:00") }).discount).toBe(8000);
        const many = [{ product_id: "kopi", qty: 3, line_total: 60000 }, { product_id: "roti", qty: 2, line_total: 50000 }];
        expect(applyPromos({ items: many, products, promos: [bundle], now: at("2026-11-04T17:00:00") }).discount).toBe(10000);
    });

    it("promo khusus member & batas subtotal", () => {
        const vip = { ...happy, id: "vip", members_only: true, start_time: "", end_time: "" };
        expect(applyPromos({ items, products, promos: [vip], now: at("2026-11-04T17:00:00") }).discount).toBe(0);
        expect(applyPromos({ items, products, promos: [vip], now: at("2026-11-04T17:00:00"), member: true }).discount).toBe(8000);
        const huge = { ...bundle, bundle_amount: 999999 };
        expect(applyPromos({ items, products, promos: [huge], now: at("2026-11-04T17:00:00") }).discount).toBe(65000);
    });

    it("priceOrder: promo -> diskon manual -> poin, ojol tanpa promo", () => {
        const lines = [{ product_id: "kopi", qty: 2 }, { product_id: "roti", qty: 1 }];
        const priced = priceOrder({
            lines, products, channel: "take_away", discount: 2000, settings, promos: [happy], now: at("2026-11-04T15:00:00"),
            member: { points: 50 }, redeem_points: 30,
        });
        expect(priced.subtotal).toBe(65000);
        expect(priced.promo_discount).toBe(8000);
        expect(priced.discount).toBe(2000);
        expect(priced.points_used).toBe(30);
        expect(priced.points_value).toBe(3000);
        expect(priced.total).toBe(52000);
        expect(priced.points_earned).toBe(5);
        const online = priceOrder({ lines, products, channel: "gofood", settings, promos: [happy], now: at("2026-11-04T15:00:00") });
        expect(online.promo_discount).toBe(0);
    });

    it("pajak & service dihitung dari harga setelah semua potongan", () => {
        const priced = priceOrder({
            lines: [{ product_id: "kopi", qty: 1 }], products, channel: "dine_in", settings: posSettings({ rounding: 0 }),
            promos: [happy], now: at("2026-11-04T15:00:00"),
        });
        expect(priced.promo_discount).toBe(4000);
        expect(priced.service).toBe(800);
        expect(priced.tax).toBe(1680);
        expect(priced.total).toBe(18480);
    });
});

describe("member & poin", () => {
    it("nomor HP dirapikan & disamarkan", () => {
        expect(normalizePhone("0812-3456-789")).toBe("628123456789");
        expect(normalizePhone("+62 812 3456 789")).toBe("628123456789");
        expect(normalizePhone("8123456789")).toBe("628123456789");
        expect(normalizePhone("12345")).toBe("");
        expect(displayPhone("628123456789")).toBe("0812-3456-789");
        expect(maskedPhone("628123456789")).toBe("0812-****-789");
    });

    it("poin didapat & ditukar dengan batas", () => {
        const rules = posSettings({});
        expect(pointsEarned(57000, rules)).toBe(5);
        expect(pointsEarned(57000, posSettings({ loyalty_enabled: false }))).toBe(0);
        expect(pointsRedeemable({ requested: 100, balance: 40, remaining: 10000, settings: rules })).toEqual({ points: 40, value: 4000 });
        expect(pointsRedeemable({ requested: 100, balance: 400, remaining: 2550, settings: rules })).toEqual({ points: 25, value: 2500 });
        expect(pointsBalance([{ member_id: "a", delta: 10 }, { member_id: "a", delta: -4 }, { member_id: "b", delta: 9 }], "a")).toBe(6);
    });

    const now = at("2026-11-04T10:00:00");
    const daysAgo = (n) => new Date(now.getTime() - n * 86400000).toISOString();
    const large = [{ group_id: "g-size", option_id: "large", name: "Large" }, { group_id: "g-sugar", option_id: "less", name: "Less sugar" }];
    const sales = [
        { member_id: "m1", created_at: daysAgo(30), total: 25000, channel: "take_away", items: [{ product_id: "kopi", name: "Kopi Susu", qty: 1, options: large }] },
        { member_id: "m1", created_at: daysAgo(26), total: 45000, channel: "take_away", items: [{ product_id: "kopi", name: "Kopi Susu", qty: 1, options: large }, { product_id: "roti", name: "Croissant", qty: 1 }] },
        { member_id: "m1", created_at: daysAgo(22), total: 25000, channel: "dine_in", items: [{ product_id: "kopi", name: "Kopi Susu", qty: 1, options: large }] },
        { member_id: "m1", created_at: daysAgo(1), total: 99000, status: "batal", items: [{ product_id: "teh", name: "Teh", qty: 9 }] },
        { member_id: "m2", created_at: daysAgo(2), total: 10000, items: [{ product_id: "teh", name: "Teh", qty: 1 }] },
        { created_at: daysAgo(2), total: 15000, items: [] },
    ];

    it("Kasir yang Ingat: favorit lengkap dengan varian", () => {
        const profile = memberProfile({ id: "m1" }, sales, now);
        expect(profile.visits).toBe(3);
        expect(profile.lastDays).toBe(22);
        expect(profile.avgGap).toBe(4);
        expect(profile.usualChannel).toBe("take_away");
        expect(profile.favorites[0]).toMatchObject({ product_id: "kopi", count: 3 });
        expect(profile.favorites[0].options.map((option) => option.option_id)).toEqual(["large", "less"]);
        expect(greetingText(profile)).toContain("biasanya Kopi Susu (Large, Less sugar)");
        expect(greetingText(memberProfile({ id: "baru" }, sales, now))).toMatch(/pertama/);
    });

    it("Radar pelanggan menghilang", () => {
        const radar = churnRadar([{ id: "m1" }, { id: "m2" }], sales, now);
        expect(radar).toHaveLength(1);
        expect(radar[0].member.id).toBe("m1");
        expect(radar[0].overdue).toBe(18);
    });

    it("ringkasan program member", () => {
        const summary = loyaltySummary({ members: [{ id: "m1", consent_promo: true }, { id: "m2" }], sales, ledger: [{ member_id: "m1", delta: 12 }], now, days: 40 });
        expect(summary.members).toBe(2);
        expect(summary.consentPromo).toBe(1);
        expect(summary.pointsOutstanding).toBe(12);
        expect(summary.memberAvg).toBe(26250);
        expect(summary.guestAvg).toBe(15000);
    });
});

describe("promo yang membuktikan dirinya sendiri", () => {
    const now = at("2026-11-04T20:00:00");
    const day = (n, hour) => new Date(now.getTime() - n * 86400000 - (20 - hour) * 3600000).toISOString();
    const promo = { ...happy, starts_on: "2026-10-25" };

    const build = (afterPerDay, beforePerDay) => {
        const sales = [];
        for (let n = 1; n <= 20; n += 1) {
            const after = wibParts(day(n, 15)).date >= "2026-10-25";
            const count = after ? afterPerDay : beforePerDay;
            for (let k = 0; k < count; k += 1) {
                sales.push({ total: 30000, created_at: day(n, 15), promos: after ? [{ promo_id: "hh", amount: 5000 }] : [] });
            }
            sales.push({ total: 50000, created_at: day(n, 11) }); // di luar jam promo: tidak dihitung
        }
        return sales;
    };

    it("untung bila omzet bersih naik melebihi diskon", () => {
        const report = promoReport(promo, build(4, 2), now);
        expect(report.uses).toBeGreaterThan(0);
        expect(report.avgAfter).toBeGreaterThan(report.avgBefore);
        expect(report.verdict.key).toBe("untung");
    });

    it("boncos bila omzet turun", () => {
        expect(promoReport(promo, build(1, 3), now).verdict.key).toBe("boncos");
    });

    it("belum dipakai", () => {
        expect(promoReport(promo, [], now).verdict.key).toBe("belum");
    });
});

describe("saran promo dari data", () => {
    const now = at("2026-11-04T21:00:00");
    const sales = [];
    for (let n = 1; n <= 14; n += 1) {
        const base = now.getTime() - n * 86400000;
        const put = (hour, total, items = [{ product_id: "kopi", qty: 2 }]) => sales.push({ total, items, created_at: new Date(base - (21 - hour) * 3600000).toISOString() });
        put(10, 60000);
        put(12, 200000);
        put(12, 150000);
        put(14, 20000);
        put(15, 15000);
        put(18, 120000);
    }

    it("menyarankan jam hemat di jam sepi & paket untuk stok lambat laku", () => {
        const result = suggestPromos({ sales, products, stock: { kopi: 30, teh: 40, roti: 25 }, now });
        const quiet = result.find((entry) => entry.key === "quiet-hours");
        expect(quiet.draft).toMatchObject({ kind: "happy_hour", start_time: "14:00", end_time: "16:00" });
        const slow = result.find((entry) => entry.draft.kind === "bundle");
        expect(slow.draft.bundle_ids).toContain("kopi");
        expect(validatePromo(slow.draft)).toBe("");
    });

    it("tidak menyarankan jam hemat bila sudah ada", () => {
        const result = suggestPromos({ sales, products, stock: {}, promos: [happy], now });
        expect(result.some((entry) => entry.key === "quiet-hours")).toBe(false);
    });
});

describe("member & promo — alur demo kasir", async () => {
    const { posProMethods } = await import("../frontend/erp/data/demo-adapter-pos.js");

    function setup() {
        const db = {
            products: [{ id: "p1", name: "Kopi Susu", price: 20000, category: "Minuman" }],
            warehouses: [{ id: "w", kind: "outlet", is_active: true }],
            members: [{ id: "m-kasir", level: 1, job_role: "kasir", is_active: true, full_name: "Kasir" }, { id: "m-owner", level: 5, job_role: "umum", is_active: true, full_name: "Owner" }],
            stock_levels: [{ warehouse_id: "w", product_id: "p1", qty: 50, min_qty: 0 }],
            pos_sales: [], pos_serial: 1, accounts: [], pos_settings: { w: { tax_enabled: false, service_enabled: false, rounding: 0 } }, pos_modifiers: [], pos_bills: [],
            pos_tickets: [], pos_lost: [], pos_queue: {}, pos_shifts: [], pos_cash_moves: [], pos_pins: [],
            pos_members: [], pos_points: [],
            pos_promos: [{ id: "all", name: "Diskon Semua", kind: "happy_hour", percent: 10, product_ids: [], categories: [], days: [], start_time: "", end_time: "", is_active: true }],
        };
        const make = (who) => posProMethods({
            db: () => db, save: () => {}, me: () => who, audit: () => {}, journalWrite: () => {}, recordMoves: () => {},
        });
        return { db, kasir: make({ id: "m-kasir", level: 1, job_role: "kasir" }), owner: make({ id: "m-owner", level: 5, job_role: "umum" }) };
    }

    it("daftar wajib izin riwayat; nomor dobel ditolak; kasir hanya melihat nomor tersamar", async () => {
        const { kasir } = setup();
        await expect(kasir.saveMember({ name: "Rina", phone: "0812345678901", consent_history: false })).rejects.toThrow(/wajib setuju/);
        const rina = await kasir.saveMember({ name: "Rina", phone: "0812-3456-78901", consent_history: true, consent_promo: false });
        expect(rina.phone).toBeNull();
        expect(rina.phone_masked).toBe("0812-****-901");
        await expect(kasir.saveMember({ name: "Lain", phone: "+62 812345678901", consent_history: true })).rejects.toThrow(/sudah terdaftar/);
        expect((await kasir.findMembers("rin")).map((member) => member.id)).toEqual([rina.id]);
        expect(await kasir.findMembers("0812345")).toHaveLength(1);
    });

    it("bayar: promo otomatis + poin didapat, lalu tukar poin; void membalik poin", async () => {
        const { db, kasir } = setup();
        await kasir.openShift({ outlet_id: "w", opening_cash: 0 });
        const rina = await kasir.saveMember({ name: "Rina", phone: "081234567890", consent_history: true });
        const first = await kasir.posCheckoutPro({
            outlet_id: "w", channel: "take_away", lines: [{ product_id: "p1", qty: 3 }], payments: [{ method: "qris", amount: 54000 }], member_id: rina.id,
        });
        expect(first).toMatchObject({ subtotal: 60000, promo_discount: 6000, total: 54000, points_earned: 5, member_id: rina.id });
        expect(first.promos[0]).toMatchObject({ promo_id: "all", amount: 6000 });
        const second = await kasir.posCheckoutPro({
            outlet_id: "w", channel: "take_away", lines: [{ product_id: "p1", qty: 1 }], payments: [{ method: "qris", amount: 17500 }], member_id: rina.id, redeem_points: 99,
        });
        expect(second).toMatchObject({ points_used: 5, points_value: 500, total: 17500, points_earned: 1 });
        const card = await kasir.getMemberCard(rina.id);
        expect(card.member.points).toBe(1);
        expect(card.profile.visits).toBe(2);
        expect(card.profile.favorites[0].product_id).toBe("p1");

        db.pos_pins.push({ member_id: "m-owner", pin_hash: (await import("../frontend/erp/data/demo-seed-cash.js")).demoPinHash("m-owner", "4826") });
        await kasir.voidSale({ sale_id: second.id, reason: "salah_input", pin: "4826" });
        expect((await kasir.getMemberCard(rina.id)).member.points).toBe(5);
    });

    it("hak dihapus (UU PDP): member & poin hilang, struk tetap tanpa identitas", async () => {
        const { db, kasir, owner } = setup();
        await kasir.openShift({ outlet_id: "w", opening_cash: 0 });
        const rina = await kasir.saveMember({ name: "Rina", phone: "081234567890", consent_history: true, consent_promo: true });
        expect((await owner.listPosMembers())[0].phone).toBe("0812-3456-7890");
        await kasir.posCheckoutPro({ outlet_id: "w", channel: "take_away", customer_name: "Rina", lines: [{ product_id: "p1", qty: 1 }], payments: [{ method: "qris", amount: 18000 }], member_id: rina.id });
        await kasir.forgetMember(rina.id);
        expect(db.pos_members).toHaveLength(0);
        expect(db.pos_points).toHaveLength(0);
        expect(db.pos_sales[0]).toMatchObject({ member_id: null, customer_name: "" });
        await expect(kasir.posCheckoutPro({ outlet_id: "w", channel: "take_away", lines: [{ product_id: "p1", qty: 1 }], payments: [{ method: "qris", amount: 18000 }], member_id: rina.id })).rejects.toThrow(/tidak ditemukan/);
    });

    it("promo hanya diatur owner/manajer/marketing dan wajib valid", async () => {
        const { kasir, owner } = setup();
        await expect(kasir.savePromo({ name: "X", kind: "happy_hour", percent: 10 })).rejects.toThrow(/Akses ditolak/);
        await expect(owner.savePromo({ name: "X", kind: "bundle", bundle_ids: ["p1"], bundle_amount: 1000 })).rejects.toThrow(/2 menu/);
        await owner.savePromo({ name: "Sore", kind: "happy_hour", percent: 15, start_time: "14:00", end_time: "16:00" });
        expect((await owner.listPromos()).map((promo) => promo.name)).toContain("Sore");
    });

    it("data demo: member, riwayat, promo & radar langsung terisi", async () => {
        const { buildLoyaltySeed } = await import("../frontend/erp/data/demo-seed-loyalty.js");
        const db = {
            products: [{ id: "a", name: "Miloat Milktea", price: 18000, category: "Minuman" }, { id: "b", name: "Croissant", price: 22000, category: "Makanan" }, { id: "c", name: "Es Kopi", price: 20000, category: "Minuman" }],
            warehouses: [{ id: "w", kind: "outlet" }], pos_modifiers: [], pos_settings: {}, pos_serial: 10,
        };
        const seed = buildLoyaltySeed(db, new Date());
        expect(seed.pos_members.length).toBe(6);
        expect(seed.extra_sales.some((sale) => sale.promos.length)).toBe(true);
        const radar = churnRadar(seed.pos_members, seed.extra_sales, new Date());
        expect(radar.map((row) => row.member.id).sort()).toEqual(["mem-doni", "mem-maya"]);
        const report = promoReport(seed.pos_promos[0], seed.extra_sales, new Date());
        expect(report.verdict.key).toBe("untung");
    });
});

describe("promo: kejujuran laporan", () => {
    it("omzet naik tapi promo jarang dipakai = belum terbukti", () => {
        const now = new Date("2026-11-04T20:00:00+07:00");
        const promo = { id: "pk", name: "Paket", kind: "bundle", days: [], start_time: "", end_time: "", starts_on: "2026-10-25" };
        const sales = [];
        for (let n = 1; n <= 20; n += 1) {
            const at = new Date(now.getTime() - n * 86400000).toISOString();
            const after = at >= "2026-10-24T17:00:00.000Z";
            for (let k = 0; k < (after ? 4 : 1); k += 1) sales.push({ total: 30000, created_at: at, promos: after && n === 2 && k === 0 ? [{ promo_id: "pk", amount: 5000 }] : [] });
        }
        const report = promoReport(promo, sales, now);
        expect(report.lift).toBeGreaterThan(0);
        expect(report.verdict.key).toBe("bukan");
    });
});

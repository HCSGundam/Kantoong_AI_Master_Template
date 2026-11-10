import { describe, expect, it } from "vitest";
import {
    budgetStatus, collectCountdowns, computeSignals, convertSize, costPerWear, countdownText, inferTraits,
    memberLevel, monthGrid, nextOccurrence, parseDay, queueWait, spendingPattern, spentThisMonth, toIcs, upcomingEvents, voucherFit,
} from "../frontend/dashboard-user/home/room-logic.js";
import { buildAnalysis, viewFor } from "../frontend/erp/core/analysis.js";
import { extractKeywords, objectionOf } from "../frontend/erp/core/research.js";
import { sanitizeConsent } from "../frontend/js/ai-consent.js";
import { modulesFor } from "../frontend/erp/core/modules.js";

const NOW = new Date(2026, 10, 10, 9, 0).getTime(); // 10 Nov 2026 09.00 lokal
const DAY = 86_400_000;

describe("ruang fitur: tanggal & kalender", () => {
    it("ulang tahun berulang tiap tahun", () => {
        expect(new Date(nextOccurrence("1970-11-13", NOW)).getDate()).toBe(13);
        expect(new Date(nextOccurrence("1970-01-02", NOW)).getFullYear()).toBe(2027);
        expect(Number.isNaN(parseDay("13-11-2026"))).toBe(true);
    });
    it("acara terdekat & hitung mundur", () => {
        const ev = upcomingEvents([{ title: "Ultah Mama", date: "1960-11-13", repeat: "yearly" }, { title: "Lewat", date: "2026-11-01" }], NOW, 30);
        expect(ev.map((e) => e.title)).toEqual(["Ultah Mama"]);
        expect(ev[0].days).toBe(3);
        expect(countdownText(NOW + 2 * DAY + 4 * 3_600_000, NOW)).toBe("2 hari 4 jam");
        expect(countdownText(NOW - 1, NOW)).toBe("Sudah lewat");
        const list = collectCountdowns([{ label: "B", at: NOW + 2 * DAY }, { label: "A", at: NOW + 3_600_000 }, { label: "jauh", at: NOW + 100 * DAY }], NOW);
        expect(list.map((x) => x.label)).toEqual(["A", "B"]);
    });
    it("petak bulan mulai Senin & file .ics", () => {
        const grid = monthGrid(2026, 10);
        expect(grid).toHaveLength(42);
        expect(grid[0].key).toBe("2026-10-26"); // Senin sebelum 1 Nov 2026 (Minggu)
        const ics = toIcs([{ title: "Ultah, Mama", date: "1960-11-13", repeat: "yearly" }]);
        expect(ics).toContain("DTSTART;VALUE=DATE:19601113");
        expect(ics).toContain("SUMMARY:Ultah\\, Mama");
        expect(ics).toContain("RRULE:FREQ=YEARLY");
    });
});

describe("ruang fitur: uang", () => {
    const orders = [
        { status: "selesai", total: 300_000, created_at: new Date(2026, 10, 6, 20).toISOString(), order_code: "A" },
        { status: "dikirim", total: 200_000, created_at: new Date(2026, 10, 2, 21).toISOString(), order_code: "B" },
        { status: "dibatalkan", total: 999_000, created_at: new Date(2026, 10, 3).toISOString() },
        { status: "selesai", total: 100_000, created_at: new Date(2026, 9, 9, 8).toISOString(), order_code: "C" },
    ];
    it("belanja bulan ini & batas belanja", () => {
        expect(spentThisMonth(orders, NOW)).toBe(500_000);
        expect(budgetStatus(500_000, 600_000).level).toBe("warn");
        expect(budgetStatus(700_000, 600_000).level).toBe("over");
        expect(budgetStatus(100_000, 0).level).toBe("none");
    });
    it("pola belanja tanpa pesanan batal", () => {
        const p = spendingPattern(orders);
        expect(p.count).toBe(3);
        expect(p.favoritePart).toBe("malam");
        expect(p.biggest.code).toBe("A");
    });
    it("biaya per pakai, level member, voucher", () => {
        expect(costPerWear(500_000, 100)).toEqual({ per: 5000, verdict: "Sangat sepadan" });
        expect(costPerWear(500_000, 0).verdict).toBe("Belum pernah dipakai");
        expect(memberLevel(600_000).level.id).toBe("sahabat");
        expect(memberLevel(0).toNext).toBe(500_000);
        const v = voucherFit({ min_purchase: 50_000, ends_at: "2026-11-12" }, 40_000, NOW);
        expect(v).toMatchObject({ usable: false, short: 10_000, expiringSoon: true, expiringDays: 2 });
    });
    it("konversi ukuran", () => {
        expect(convertSize("sepatu", 42)).toEqual({ EU: 42, US: 9, UK: 8 });
        expect(convertSize("baju", "m")).toEqual({ Huruf: "M", EU: 38, UK: 36 });
        expect(convertSize("sepatu", 70)).toBeNull();
    });
    it("antrean", () => {
        expect(queueWait(15, 11, 4)).toMatchObject({ ahead: 3, minutes: 12 });
        expect(queueWait(15, 14).text).toBe("Kamu berikutnya!");
    });
});

describe("Kartu Diriku & Sinyal", () => {
    const products = [
        { id: 1, category: "Sepatu", price: 400_000 }, { id: 2, category: "Sepatu", price: 500_000 },
        { id: 3, category: "Baju", price: 150_000 }, { id: 4, category: "Sepatu", price: 450_000 },
    ];
    it("tebakan selera + sumbernya, bisa dihapus", () => {
        const traits = inferTraits({ products, wishlistIds: ["1", "2"], recentIds: ["4", "3"], chatTexts: ["cari sepatu hitam", "yang hitam elegan"] });
        expect(traits.find((t) => t.key === "cat:Sepatu").source).toContain("kali");
        expect(traits.find((t) => t.key === "color:hitam").value).toBe("hitam");
        expect(traits.some((t) => t.key === "budget")).toBe(true);
        const after = inferTraits({ products, wishlistIds: ["1", "2"], recentIds: [], chatTexts: ["hitam"], suppressed: ["color:hitam"] });
        expect(after.some((t) => t.key === "color:hitam")).toBe(false);
    });
    it("sinyal dari keadaan nyata, urut paling mendesak", () => {
        const s = computeSignals({
            cartItems: [{ id: "x", name: "Kemeja", reason: { text: "Kado", date: "2026-11-11" } }],
            orders: [{ id: "o", status: "dikirim", order_code: "ORD-1", shipping_eta: "besok" }],
            wishlist: [{ id: "w", name: "Tas", price: 90, priceThen: 100 }],
            budget: { spent: 950, limit: 1000 },
        }, NOW);
        expect(s[0].id).toBe("cart:x");
        expect(s.map((x) => x.id)).toEqual(expect.arrayContaining(["ship:o", "drop:w", "budget"]));
        expect(s.length).toBeLessThanOrEqual(4);
        expect(computeSignals({}, NOW)).toEqual([]);
    });
    it("izin AI: hanya status yang sah", () => {
        expect(sanitizeConsent({ status: "granted", at: "2026-11-10T00:00:00Z" }).status).toBe("granted");
        expect(sanitizeConsent({ status: "maybe" })).toBeNull();
    });
});

describe("Anachronos Analysis (add-on)", () => {
    const at = (h) => new Date(2026, 10, 9, h).toISOString();
    const events = [
        { at: at(19), session_key: "a", kind: "ask", keywords: ["coklat", "hadiah"] },
        { at: at(19), session_key: "a", kind: "view", product_id: "1", product_name: "Coklat" },
        { at: at(19), session_key: "a", kind: "cart", product_id: "1" },
        { at: at(20), session_key: "b", kind: "ask", keywords: ["mahal"] },
        { at: at(20), session_key: "b", kind: "view", product_id: "1" },
        { at: at(21), session_key: "c", kind: "ask", keywords: ["ongkir", "mahal"] },
    ];
    it("keberatan dikenali dari kata umum saja", () => {
        expect(objectionOf("mahal")).toBe("harga");
        expect(extractKeywords("aduh kemahalan ongkirnya", new Set())).toEqual(["kemahalan"]);
    });
    it("corong, kebocoran, alasan tidak beli (chat + kasir)", () => {
        const a = buildAnalysis({ events, lost: [{ reason: "habis", qty: 2, value: 30000, created_at: at(12) }], orders: [{ status: "selesai", created_at: at(10) }], days: 30, now: new Date(NOW) });
        expect(a.funnel.map((s) => s.value)).toEqual([3, 2, 1]);
        expect(a.leak.key).toBe("view");
        expect(a.totals.paid).toBe(1);
        expect(a.reasons[0]).toMatchObject({ key: "harga", count: 2, source: "Chat AI" });
        expect(a.reasons.some((r) => r.source === "Kasir" && r.key === "habis")).toBe(true);
        expect(a.totals.lostValue).toBe(30000);
        expect(a.sentences.length).toBeGreaterThan(0);
    });
    it("hanya owner/manajer & divisi yang berhadapan dengan pembeli", () => {
        expect(viewFor({ level: 5 })).toBe("owner");
        expect(viewFor({ level: 2, role: "marketing" })).toBe("marketing");
        expect(viewFor({ level: 2, role: "gudang" })).toBeNull();
        const keys = (m) => modulesFor(m).map((x) => x.key);
        expect(keys({ level: 5, addons: ["analysis"] })).toContain("analysis");
        expect(keys({ level: 5, addons: [] })).not.toContain("analysis");
        expect(keys({ level: 2, role: "gudang", roles: ["gudang"], addons: ["analysis"] })).not.toContain("analysis");
    });
});

import { describe, expect, it } from "vitest";
import { compareProducts, detectDoubt, dismissDoubt, dismissedPairs, recordView } from "../frontend/js/doubt-room.js";
import { chartPath, groupHistory, honestPrice } from "../frontend/js/honest-price.js";
import { cleanStory, hasStory, supplierOrigin } from "../frontend/js/product-story.js";
import { enrichProducts } from "../frontend/js/industry.js";
import { cleanReason, daysLeft, reasonLabel, shouldNudge, upcomingReminder } from "../frontend/cart/cart-reason.js";

const memory = () => {
    const data = new Map();
    return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
};
const DAY = 86_400_000;
const NOW = Date.parse("2026-11-09T10:00:00+07:00");

describe("Ruang Ragu", () => {
    it("A → B → A dalam 30 menit = ragu antara A dan B", () => {
        const storage = memory();
        recordView("a", { now: NOW, storage });
        recordView("b", { now: NOW + 60_000, storage });
        const trail = recordView("a", { now: NOW + 120_000, storage });
        expect(detectDoubt(trail, "a", { now: NOW + 120_000 })).toBe("b");
    });
    it("hanya melihat dua produk sekali tidak dianggap ragu; jejak > 30 menit dibuang", () => {
        const storage = memory();
        recordView("a", { now: NOW, storage });
        const trail = recordView("b", { now: NOW + 1000, storage });
        expect(detectDoubt(trail, "b", { now: NOW + 1000 })).toBeNull();
        const later = recordView("a", { now: NOW + 31 * 60_000, storage });
        expect(later.map((v) => v.id)).toEqual(["a"]);
    });
    it("tawaran yang ditolak tidak muncul lagi hari itu", () => {
        const storage = memory();
        dismissDoubt("a", "b", { now: NOW, storage });
        const dismissed = dismissedPairs({ now: NOW, storage });
        const trail = [{ id: "a", at: NOW }, { id: "b", at: NOW }, { id: "a", at: NOW }];
        expect(detectDoubt(trail, "a", { now: NOW, dismissed })).toBeNull();
        expect(dismissedPairs({ now: NOW + 2 * DAY, storage })).toEqual([]);
    });
    it("bandingkan: hanya perbedaan penting + ringkasan jujur", () => {
        const a = { name: "Kemeja A", price: 250000, rating_avg: 4.8, review_count: 12, category: "Kemeja", ship_estimate: "2 hari", stock: 10 };
        const b = { name: "Kemeja B", price: 199000, rating_avg: 4.2, review_count: 3, category: "Kemeja", ship_estimate: "2 hari", stock: 0 };
        const { rows, same, summary } = compareProducts(a, b);
        expect(rows.find((r) => r.key === "price").better).toBe("b");
        expect(rows.find((r) => r.key === "rating").better).toBe("a");
        expect(rows.some((r) => r.key === "category")).toBe(false);
        expect(same).toEqual(expect.arrayContaining(["Kategori", "Pengiriman"]));
        expect(summary).toContain("Kemeja B lebih hemat Rp 51.000");
        expect(summary).toContain("Kemeja B sedang habis");
    });
});

describe("Harga Jujur", () => {
    const rows = [
        { product_id: "p1", price: 200000, compare_at_price: null, changed_at: new Date(NOW - 20 * DAY).toISOString() },
        { product_id: "p1", price: 150000, compare_at_price: 200000, changed_at: new Date(NOW - 2 * DAY).toISOString() },
        { product_id: "p2", price: 150000, compare_at_price: 300000, changed_at: new Date(NOW - 1 * DAY).toISOString() },
    ];
    const history = groupHistory(rows);

    it("harga coret tampil bila harga itu benar pernah berlaku 30 hari terakhir", () => {
        const r = honestPrice({ price: 150000, compareAt: 200000, history: history.get("p1"), now: NOW });
        expect(r.strike).toBe(true);
        expect(r.low).toBe(150000);
        expect(r.verdict).toContain("terendah");
    });
    it("harga coret karangan disembunyikan", () => {
        const r = honestPrice({ price: 150000, compareAt: 300000, history: history.get("p2"), now: NOW });
        expect(r.strike).toBe(false);
        expect(r.verdict).toContain("belum pernah berubah");
    });
    it("harga lama di luar 30 hari tidak dihitung, kecuali masih berlaku di awal jendela", () => {
        const old = groupHistory([
            { product_id: "x", price: 500000, changed_at: new Date(NOW - 60 * DAY).toISOString() },
            { product_id: "x", price: 300000, changed_at: new Date(NOW - 40 * DAY).toISOString() },
        ]).get("x");
        expect(honestPrice({ price: 300000, compareAt: 500000, history: old, now: NOW }).strike).toBe(false);
        expect(honestPrice({ price: 300000, compareAt: 300000, history: old, now: NOW }).verdict).toBe("Harga stabil 30 hari terakhir.");
    });
    it("riwayat belum tersedia = null (tampilan lama tetap)", () => {
        expect(honestPrice({ price: 1, compareAt: 2, history: null }).strike).toBeNull();
    });
    it("grafik garis tangga", () => {
        const d = chartPath(history.get("p1").map((h) => ({ ...h })), { now: NOW });
        expect(d.startsWith("M0 ")).toBe(true);
        expect(d).toContain(" V");
    });
});

describe("Cocok / Kurang Cocok & Jejak Asal", () => {
    it("dibersihkan: maks 4, tanpa duplikat & tag HTML", () => {
        const s = cleanStory({ fit: "Kulit kering\nAcara formal\nAcara formal\n<b>x</b>\na\nb", notFit: [], origin: { place: " Pekalongan ", maker: "", hack: "x" } });
        expect(s.fit).toEqual(["Kulit kering", "Acara formal", "bx/b", "a"]);
        expect(s.notFit).toBeUndefined();
        expect(s.origin).toEqual({ place: "Pekalongan" });
        expect(hasStory({})).toBe(false);
    });
    it("pemasok ERP: hanya nama + kota (kontak tidak ikut)", () => {
        expect(supplierOrigin({ name: "CV Tenun Jaya", address: "Jl. Mawar 3, Pekalongan", phone: "0812" })).toBe("CV Tenun Jaya, Pekalongan");
    });
    it("industri umum tetap membawa cerita produk", () => {
        const [p] = enrichProducts([{ id: 7, price: 1 }], new Map([["7", { story: { fit: ["Pemula"] } }]]), { industry: "umum" });
        expect(p.story.fit).toEqual(["Pemula"]);
    });
});

describe("Keranjang yang Ingat Alasan", () => {
    const now = new Date(2026, 10, 9, 10).getTime();
    it("alasan dibersihkan; kosong = null", () => {
        expect(cleanReason({ text: "  Kado <ultah> Mama ", date: "2026-11-20" })).toEqual({ text: "Kado ultah Mama", date: "2026-11-20" });
        expect(cleanReason({ text: "", date: "bukan-tanggal" })).toBeNull();
    });
    it("sisa hari & label", () => {
        expect(daysLeft({ date: "2026-11-12" }, now)).toBe(3);
        expect(reasonLabel({ text: "Kado", date: "2026-11-10" }, now)).toMatch(/^Kado · 10 Nov.* \(besok\)$/);
    });
    it("pengingat hanya untuk tanggal 0..7 hari lagi, yang paling dekat dulu", () => {
        const items = [
            { name: "Sepatu", reason: { text: "Nikahan", date: "2026-11-15" } },
            { name: "Kemeja", reason: { text: "Kado", date: "2026-11-11" } },
            { name: "Topi", reason: { text: "Liburan", date: "2026-12-30" } },
            { name: "Tas", reason: { text: "Lewat", date: "2026-11-01" } },
        ];
        const r = upcomingReminder(items, now);
        expect(r.item.name).toBe("Kemeja");
        expect(r.message).toContain("2 hari lagi");
        expect(r.message).toContain("+1 barang lain");
        expect(upcomingReminder(items, now, { within: 1 })).toBeNull();
    });
    it("maksimal sekali sehari", () => {
        expect(shouldNudge(new Date(now).toDateString(), now)).toBe(false);
        expect(shouldNudge(null, now)).toBe(true);
    });
});

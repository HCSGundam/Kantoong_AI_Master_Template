import { describe, expect, it } from "vitest";
import {
    RECENT_KEY,
    clampQty,
    priceSaving,
    productJsonLd,
    pushRecent,
    readRecent,
    relatedProducts,
    reviewSummary,
    stockState,
    timeAgo,
} from "../frontend/js/product-detail.js";
import { PRODUCT_PUBLIC_COLUMNS } from "../frontend/js/product-columns.js";

function memoryStorage() {
    const data = new Map();
    return {
        getItem: (k) => (data.has(k) ? data.get(k) : null),
        setItem: (k, v) => data.set(k, String(v)),
    };
}

describe("stok jujur", () => {
    it("tidak dilacak = tersedia tanpa angka", () => {
        expect(stockState(null)).toMatchObject({ key: "ready", label: "Stok tersedia" });
    });
    it("habis, menipis, aman", () => {
        expect(stockState(0)).toMatchObject({ key: "out", max: 0 });
        expect(stockState(3)).toMatchObject({ key: "low", label: "Sisa 3 lagi", max: 3 });
        expect(stockState(40)).toMatchObject({ key: "ready", max: 40 });
        expect(stockState(500).max).toBe(99);
    });
    it("jumlah beli dibatasi stok", () => {
        expect(clampQty(5, 3)).toBe(3);
        expect(clampQty(0, 3)).toBe(1);
        expect(clampQty(2, 0)).toBe(0);
    });
});

describe("harga jujur", () => {
    it("hemat hanya bila harga coret lebih tinggi", () => {
        expect(priceSaving(80000, 100000)).toBe(20000);
        expect(priceSaving(100000, 90000)).toBe(0);
        expect(priceSaving(100000, null)).toBe(0);
    });
});

describe("produk serupa", () => {
    const all = [
        { id: "a", category: "Sepatu", price: 500000 },
        { id: "b", category: "Sepatu", price: 520000 },
        { id: "c", category: "Baju", price: 500000 },
        { id: "d", category: "Sepatu", price: 2000000 },
        { id: "e", category: "Sepatu", price: 510000, is_published: false },
    ];
    it("kategori sama & harga dekat lebih dulu, tanpa produk itu sendiri / belum terbit", () => {
        const ids = relatedProducts(all[0], all).map((p) => p.id);
        expect(ids).toEqual(["b", "d", "c"]);
    });
});

describe("terakhir dilihat", () => {
    it("terbaru di depan, tanpa duplikat, maksimal 12", () => {
        const s = memoryStorage();
        for (let i = 0; i < 15; i++) pushRecent(`p${i}`, s);
        pushRecent("p3", s);
        const list = readRecent(s);
        expect(list[0]).toBe("p3");
        expect(list).toHaveLength(12);
        expect(new Set(list).size).toBe(12);
    });
    it("data rusak tidak membuat error", () => {
        const s = memoryStorage();
        s.setItem(RECENT_KEY, "{rusak");
        expect(readRecent(s)).toEqual([]);
    });
});

describe("ulasan", () => {
    it("rata-rata & sebaran bintang", () => {
        const sum = reviewSummary([{ rating: 5 }, { rating: 5 }, { rating: 4 }, { rating: 1 }, { rating: 9 }]);
        expect(sum.total).toBe(4);
        expect(sum.avg).toBe(3.8);
        expect(sum.bars[0]).toEqual({ star: 5, count: 2, pct: 50 });
    });
    it("waktu relatif", () => {
        const now = Date.parse("2026-11-09T12:00:00Z");
        expect(timeAgo("2026-11-06T12:00:00Z", now)).toBe("3 hari lalu");
        expect(timeAgo("bukan tanggal", now)).toBe("");
    });
});

describe("data terstruktur Google (GEO)", () => {
    it("rating hanya ikut bila ada ulasan asli", () => {
        const base = { name: "Sepatu", price: 500000, stock: 0 };
        const ld = productJsonLd(base, { url: "https://x/#produk/1", brand: "B" });
        expect(ld.offers.availability).toBe("https://schema.org/OutOfStock");
        expect(ld.aggregateRating).toBeUndefined();
        const rated = productJsonLd({ ...base, rating_avg: 4.6, review_count: 12 }, {});
        expect(rated.aggregateRating).toEqual({ "@type": "AggregateRating", ratingValue: 4.6, reviewCount: 12 });
    });
    it("toko membaca rating & jumlah ulasan, tetap tanpa harga modal", () => {
        expect(PRODUCT_PUBLIC_COLUMNS).toContain("rating_avg");
        expect(PRODUCT_PUBLIC_COLUMNS).toContain("review_count");
        expect(PRODUCT_PUBLIC_COLUMNS).not.toContain("cost_price");
    });
});

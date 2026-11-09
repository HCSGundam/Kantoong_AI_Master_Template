import { describe, expect, it } from "vitest";
import {
    applyChip,
    categoryLabel,
    chipLabel,
    chipsFor,
    orderedCategories,
    sanitizeStorefront,
} from "../frontend/js/storefront-settings.js";
import { modeFor, nearestSize, parseSize, sanitizeState } from "../frontend/dashboard-user/home/bento-engine.js";

const products = [
    { id: 1, name: "Susu Coklat", category: "PURE MILK", price: 15000, sales_count: 10, created_at: "2026-10-01", rating_avg: 4.5 },
    { id: 2, name: "Susu Stroberi", category: "PURE MILK", price: 20000, compare_at_price: 25000, sales_count: 40, created_at: "2026-11-01", stock: 0 },
    { id: 3, name: "Oatcookies", category: "Cookies", price: 7000, created_at: "2026-09-01" },
];

describe("pengaturan etalase", () => {
    it("data rusak dibersihkan, nama brand wajib ada", () => {
        const s = sanitizeStorefront({ brand: { name: "  " }, catalog: { chipLimit: 99, chips: { x: [{ kind: "hack" }, { kind: "under" }, { kind: "under", value: 50000 }] } } });
        expect(s.brand.name.length).toBeGreaterThan(0);
        expect(s.catalog.chipLimit).toBe(20);
        expect(s.catalog.chips.x).toEqual([{ kind: "under", label: "Di bawah", value: 50000 }]);
    });

    it("nama kategori, urutan & sembunyikan dari admin", () => {
        const settings = sanitizeStorefront({ catalog: { categories: { "PURE MILK": { label: "Susu", order: 0 }, Cookies: { hidden: true } } } });
        expect(categoryLabel(settings, "PURE MILK")).toBe("Susu");
        expect(orderedCategories(products, settings)).toEqual([{ key: "PURE MILK", label: "Susu" }]);
    });

    it("saran filter: bawaan, milik kategori, dan batas slot", () => {
        const base = sanitizeStorefront({});
        expect(chipsFor(base, "Cookies").map((c) => c.kind)).toEqual(["terlaris", "terbaru", "promo", "termurah", "rating"]);
        const own = sanitizeStorefront({ catalog: { chipLimit: 1, chips: { Cookies: [{ kind: "promo" }, { kind: "ready" }] } } });
        expect(chipsFor(own, "Cookies").map((c) => c.kind)).toEqual(["promo"]);
    });

    it("saran filter bekerja", () => {
        expect(applyChip(products, { kind: "terlaris" })[0].id).toBe(2);
        expect(applyChip(products, { kind: "promo" }).map((p) => p.id)).toEqual([2]);
        expect(applyChip(products, { kind: "ready" }).map((p) => p.id)).toEqual([1, 3]);
        expect(applyChip(products, { kind: "under", value: 15000 }).map((p) => p.id)).toEqual([1, 3]);
        expect(applyChip(products, { kind: "keyword", value: "coklat" }).map((p) => p.id)).toEqual([1]);
        expect(applyChip(products, { kind: "rating" }).map((p) => p.id)).toEqual([1]);
        expect(chipLabel({ kind: "under", label: "Di bawah", value: 20000 })).toBe("Di bawah 20rb");
    });
});

describe("ukuran kartu bebas", () => {
    it("bisa ditarik ke bawah/samping, dibatasi grid", () => {
        expect(nearestSize(4.2, 3.4, 8)).toBe("4x3");
        expect(nearestSize(9, 9, 6)).toBe("6x6");
        expect(parseSize("3x5")).toEqual({ w: 3, h: 5 });
        expect(parseSize("9x2")).toBeNull();
        expect(sanitizeState({ order: ["a"], sizes: { a: "5x3" } }, ["a"]).sizes.a).toBe("5x3");
    });

    it("isi kartu menyesuaikan bentuk", () => {
        expect(modeFor(1, 1)).toBe("icon");
        expect(modeFor(3, 1)).toBe("pill");
        expect(modeFor(4, 2)).toBe("row");
        expect(modeFor(2, 4)).toBe("tall");
        expect(modeFor(3, 3)).toBe("tall");
        expect(modeFor(2, 2)).toBe("box");
    });
});

import { drawReward, sampleHome, sanitizeHome, HOME_BLOCKS } from "../frontend/js/storefront-settings.js";

describe("homepage = zona promosi", () => {
    it("template contoh berisi semua jenis blok, tiap jenis sekali", () => {
        const home = sanitizeHome(sampleHome());
        expect(home.blocks.map((b) => b.type).sort()).toEqual(HOME_BLOCKS.map((b) => b.type).sort());
        expect(home.blocks.every((b) => b.sample)).toBe(true);
    });

    it("isi berbahaya dibersihkan: link non-https, kode aneh, duplikat", () => {
        const home = sanitizeHome({ blocks: [
            { type: "banner", items: [{ title: "A", image: "javascript:alert(1)", action: "hack" }] },
            { type: "banner", items: [{ title: "dobel" }] },
            { type: "coupons", items: [{ code: "hemat 10!", title: "Diskon" }, { code: "", title: "tanpa kode" }] },
            { type: "jackpot", rewards: [{ label: "Hadiah", weight: 999 }] },
            { type: "aneh" },
        ] });
        const banner = home.blocks.find((b) => b.type === "banner");
        expect(banner.items).toEqual([{ title: "A", text: "", image: "", cta: "", action: "catalog" }]);
        expect(home.blocks.filter((b) => b.type === "banner")).toHaveLength(1);
        expect(home.blocks.find((b) => b.type === "coupons").items).toEqual([{ code: "HEMAT10", title: "Diskon", text: "", expires: "" }]);
        expect(home.blocks.find((b) => b.type === "jackpot").rewards[0].weight).toBe(100);
        // jenis yang tidak disebut tetap ada tapi mati
        expect(home.blocks.find((b) => b.type === "posters").enabled).toBe(false);
    });

    it("kotak misteri mengikuti peluang yang diisi toko", () => {
        const rewards = [{ label: "A", weight: 70 }, { label: "B", weight: 30 }];
        expect(drawReward(rewards, 0).label).toBe("A");
        expect(drawReward(rewards, 0.69).label).toBe("A");
        expect(drawReward(rewards, 0.71).label).toBe("B");
        expect(drawReward([], 0.5)).toBeNull();
    });

    it("logo hanya https atau gambar data kecil", () => {
        const ok = sanitizeStorefront({ brand: { name: "X", logo: "https://cdn.test/logo.png" } });
        expect(ok.brand.logo).toBe("https://cdn.test/logo.png");
        expect(sanitizeStorefront({ brand: { name: "X", logo: "javascript:alert(1)" } }).brand.logo).toBe("");
        expect(sanitizeStorefront({ brand: { name: "X", logo: "data:image/png;base64,iVBORw0KGgo=" } }).brand.logo).toContain("data:image/png");
    });
});

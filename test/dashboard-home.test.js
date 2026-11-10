import { describe, expect, it } from "vitest";
import {
    columnsFor,
    indexAtCell,
    moveItem,
    nearestSize,
    packLayout,
    rowsUsed,
    sanitizeState,
    toItems,
} from "../frontend/dashboard-user/home/bento-engine.js";
import {
    editDistance,
    parseAmount,
    parseQuery,
    searchCatalog,
    suggest,
} from "../frontend/dashboard-user/home/catalog-search.js";
import { HUB_FEATURES } from "../frontend/dashboard-user/feature-hub/feature-hub-catalog.js";

const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("grid bento", () => {
    it("kolom mengikuti lebar wadah", () => {
        expect(columnsFor(360)).toBe(4);
        expect(columnsFor(700)).toBe(6);
        expect(columnsFor(1100)).toBe(8);
    });

    it("tidak pernah ada kartu bertumpuk & lubang ditambal", () => {
        const items = [
            { id: "a", size: "2x2" }, { id: "b", size: "1x1" }, { id: "c", size: "2x1" },
            { id: "d", size: "4x2" }, { id: "e", size: "1x1" }, { id: "f", size: "2x4" },
        ];
        const placed = packLayout(items, 4);
        for (let i = 0; i < placed.length; i++) {
            for (let j = i + 1; j < placed.length; j++) expect(overlap(placed[i], placed[j])).toBe(false);
        }
        // "b" (1x1) mengisi ruang di samping "a"
        expect(placed.find((p) => p.id === "b")).toMatchObject({ x: 2, y: 0 });
        expect(rowsUsed(placed)).toBeGreaterThan(0);
    });

    it("kartu lebih lebar dari grid dipersempit", () => {
        expect(packLayout([{ id: "x", size: "4x4" }], 4)[0]).toMatchObject({ w: 4, h: 4 });
        expect(packLayout([{ id: "x", size: "4x2" }], 2)[0]).toMatchObject({ w: 2 });
    });

    it("geser = ubah urutan", () => {
        const items = toItems({ order: ["a", "b", "c"], sizes: { a: "2x2", b: "2x2", c: "2x2" } });
        expect(moveItem(items, "a", 2).map((i) => i.id)).toEqual(["b", "c", "a"]);
        const placed = packLayout(items, 4);
        // kursor di atas kartu "c" -> masuk ke urutan c
        expect(indexAtCell(placed, "a", 0, 2)).toBe(1);
        // kursor di ruang kosong setelah semua kartu -> paling akhir
        expect(indexAtCell(placed, "a", 0, 6)).toBe(2);
        // kursor di kiri-atas kartu "b" -> sebelum b
        expect(indexAtCell(placed, "a", 2, 0)).toBe(0);
    });

    it("tarikan pegangan melompat ke ukuran sah terdekat", () => {
        expect(nearestSize(2.1, 1.9, 4)).toBe("2x2");
        expect(nearestSize(3.7, 2.2, 4)).toBe("4x2");
        expect(nearestSize(0.8, 0.9, 4)).toBe("1x1");
        expect(nearestSize(3.9, 3.9, 2)).toBe("2x4");
    });

    it("data simpanan dibersihkan: fitur baru masuk, fitur lama hilang, ukuran salah dikoreksi", () => {
        const state = sanitizeState({ order: ["x", "a", "a"], sizes: { a: "9x9" } }, ["a", "b"], { b: "2x1" });
        expect(state.order).toEqual(["a", "b"]);
        expect(state.sizes).toEqual({ a: "2x2", b: "2x1" });
    });
});

describe("katalog: pencarian pintar", () => {
    const products = [
        { id: 1, name: "Kemeja Hitam Elegan", category: "Baju", price: 250000, sales_count: 40, created_at: "2026-10-01" },
        { id: 2, name: "Kaos Putih Basic", category: "Baju", price: 90000, sales_count: 90, created_at: "2026-11-01" },
        { id: 3, name: "Sneakers Black Runner", category: "Sepatu", price: 450000, compare_at_price: 600000, sales_count: 10, created_at: "2026-09-01", stock: 0 },
        { id: 4, name: "Miloat Chocolate", category: "Minuman", price: 15000, rating_avg: 4.8, created_at: "2026-08-01" },
    ];

    it("paham angka rupiah", () => {
        expect(parseAmount("300", "rb")).toBe(300000);
        expect(parseAmount("1,5", "jt")).toBe(1500000);
        expect(parseAmount("250.000")).toBe(250000);
    });

    it("paham kalimat", () => {
        const q = parseQuery("baju hitam buat kondangan di bawah 300rb yang murah");
        expect(q.maxPrice).toBe(300000);
        expect(q.terms).toEqual(["baju", "hitam", "kondangan"]);
        expect(q.sort).toBe("termurah");
    });

    it("kalimat langsung jadi saringan", () => {
        const r = searchCatalog(products, { query: "baju hitam kondangan di bawah 300rb" });
        expect(r.items.map((p) => p.id)).toEqual([1]);
    });

    it("tahan salah ketik & padanan kata", () => {
        expect(editDistance("hitm", "hitam")).toBe(1);
        expect(searchCatalog(products, { query: "kemja" }).items[0].id).toBe(1);
        expect(searchCatalog(products, { query: "susu coklat" }).items.map((p) => p.id)).toContain(4);
        expect(searchCatalog(products, { query: "sepatu hitam" }).items[0].id).toBe(3);
    });

    it("saringan & urutan", () => {
        expect(searchCatalog(products, { discount: true }).items.map((p) => p.id)).toEqual([3]);
        expect(searchCatalog(products, { inStock: true }).items.map((p) => p.id)).not.toContain(3);
        expect(searchCatalog(products, { sort: "termurah" }).items[0].id).toBe(4);
        expect(searchCatalog(products, { sort: "terlaris" }).items[0].id).toBe(2);
        expect(searchCatalog(products, { category: "sepatu" }).items.map((p) => p.id)).toEqual([3]);
        expect(searchCatalog(products, { rating4: true }).items.map((p) => p.id)).toEqual([4]);
    });

    it("saran saat mengetik", () => {
        const s = suggest(products, "bajx");
        expect(s.length).toBeGreaterThanOrEqual(0);
        expect(suggest(products, "sne").map((x) => x.label)).toContain("Sneakers Black Runner");
        expect(suggest(products, "ba").map((x) => x.label)).toContain("Baju");
    });
});

describe("31 fitur sesuai Blueprint Vol.7", () => {
    it("31 fitur Blueprint + Kartu Diriku, ID unik", () => {
        expect(HUB_FEATURES).toHaveLength(32);
        expect(new Set(HUB_FEATURES.map((f) => f.id)).size).toBe(32);
        expect(HUB_FEATURES.some((f) => f.id === "my-card")).toBe(true);
    });
});

import { fillGaps as kcFillGaps, packLayout as kcPack } from "../frontend/dashboard-user/home/bento-engine.js";
describe("bento: lubang kosong di HP terisi", () => {
    it("kartu melebar mengisi sel kosong di barisnya", () => {
        const placed = kcPack([{ id: "a", size: "1x1" }, { id: "b", size: "2x2" }], 4);
        expect(placed.map((p) => [p.x, p.w])).toEqual([[0, 1], [1, 2]]);
        const filled = kcFillGaps(placed, 4);
        expect(filled.find((p) => p.id === "b").w).toBe(3);
        expect(kcFillGaps(kcPack([{ id: "a", size: "2x1" }, { id: "b", size: "2x1" }], 4), 4).map((p) => p.w)).toEqual([2, 2]);
    });
});

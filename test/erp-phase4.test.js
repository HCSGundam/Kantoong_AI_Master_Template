import { describe, it, expect } from "vitest";

import {
    activityFeed, catalogVocabulary, extractKeywords, guestLabels, summarizeResearch, wibHour,
} from "../frontend/erp/core/research.js";
import { modulesFor } from "../frontend/erp/core/modules.js";

const PRODUCTS = [
    { id: "p1", name: "Miloat Chocolate", category: "Pure Milk" },
    { id: "p2", name: "Miloat Milktea", category: "Pure Milk" },
    { id: "p3", name: "Oatcookies", category: "Cookies" },
];

const NOW = new Date("2026-11-03T10:00:00Z");
const at = (hoursAgo) => new Date(NOW.getTime() - hoursAgo * 3600000).toISOString();
const ev = (session, kind, extra = {}, hoursAgo = 1) => ({
    at: at(hoursAgo), business_id: "miloat", session_key: session, kind, product_id: null, keywords: [], ...extra,
});

describe("KANTOONG ERP — AI Research: privasi kata kunci", () => {
    const vocab = catalogVocabulary(PRODUCTS);

    it("hanya kata katalog & kebutuhan yang disimpan", () => {
        expect(extractKeywords("Kak ada chocolate yang murah buat hadiah?", vocab)).toEqual(["chocolate", "murah", "hadiah"]);
    });

    it("nama, nomor HP, dan email TIDAK pernah lolos", () => {
        const words = extractKeywords("Saya Budi Santoso 081234567890 budi@mail.com mau milktea", vocab);
        expect(words).toEqual(["milktea"]);
        expect(words.join(" ")).not.toMatch(/budi|santoso|0812|mail/);
    });

    it("ejaan cokelat disamakan & maksimal 5 kata", () => {
        expect(extractKeywords("cokelat", new Set(["coklat"]))).toEqual(["coklat"]);
        expect(extractKeywords("murah hemat promo diskon voucher sehat diet", vocab)).toHaveLength(5);
    });
});

describe("KANTOONG ERP — AI Research: ringkasan", () => {
    const events = [
        ev("s-a", "ask", { keywords: ["murah", "chocolate"] }, 2),
        ev("s-a", "recommend", { product_id: "p1" }, 2),
        ev("s-a", "cart", { product_id: "p1" }, 2),
        ev("s-b", "ask", { keywords: ["hadiah"] }, 3),
        ev("s-b", "recommend", { product_id: "p2" }, 3),
        ev("s-b", "view", { product_id: "p2" }, 3),
        ev("s-c", "recommend", { product_id: "p2" }, 4),
        ev("s-old", "ask", { keywords: ["murah"] }, 24 * 40),
    ];

    it("total, konversi, & rentang hari", () => {
        const summary = summarizeResearch(events, PRODUCTS, { days: 30, now: NOW });
        expect(summary.totals).toEqual({ sessions: 3, asks: 2, recommends: 3, carts: 1, conversion: 33 });
        expect(summary.funnel.map((step) => step.value)).toEqual([2, 3, 1, 1]);
    });

    it("produk diminati, kebutuhan, & kata kunci", () => {
        const summary = summarizeResearch(events, PRODUCTS, { days: 30, now: NOW });
        expect(summary.topProducts[0]).toMatchObject({ product_id: "p2", name: "Miloat Milktea", count: 3, carts: 0 });
        expect(summary.interestedNotBought.map((row) => row.product_id)).toEqual(["p2"]);
        expect(summary.needs.map((need) => need.key).sort()).toEqual(["hadiah", "hemat"]);
        expect(summary.keywords).toEqual([{ word: "chocolate", count: 1 }]);
    });

    it("jam ramai dihitung dalam WIB", () => {
        expect(wibHour("2026-11-03T18:30:00Z")).toBe(1);
        // Dua pertanyaan pukul 15 WIB (08.xx UTC), satu pukul 14 WIB.
        const busy = [ev("s-1", "ask", {}, 2), ev("s-2", "ask", {}, 2), ev("s-3", "ask", {}, 3)];
        const summary = summarizeResearch(busy, PRODUCTS, { days: 30, now: NOW });
        expect(summary.peakHour).toBe(15);
        expect(summary.hours[15]).toBe(2);
    });

    it("tanpa data tidak error", () => {
        const summary = summarizeResearch([], PRODUCTS, { now: NOW });
        expect(summary.totals.conversion).toBe(0);
        expect(summary.peakHour).toBeNull();
    });
});

describe("KANTOONG ERP — Second Brain: tamu anonim & aktivitas", () => {
    const events = [
        ev("s-a", "ask", { keywords: ["murah"] }, 3),
        ev("s-a", "recommend", { product_id: "p1" }, 2),
        ev("s-b", "cart", { product_id: "p2", product_name: "Miloat Milktea" }, 1),
    ];

    it("label tamu stabil berdasarkan urutan datang", () => {
        const labels = guestLabels(events);
        expect(labels.get("s-a")).toBe("Tamu #1");
        expect(labels.get("s-b")).toBe("Tamu #2");
    });

    it("feed aktivitas: terbaru di atas, kalimat tanpa data pribadi", () => {
        const feed = activityFeed(events, { products: PRODUCTS });
        expect(feed[0].text).toBe("Tamu #2 memasukkan Miloat Milktea ke keranjang");
        expect(feed.map((item) => item.text)).toContain("AI merekomendasikan Miloat Chocolate ke Tamu #1");
        expect(feed.at(-1).text).toBe("Tamu #1 bertanya soal murah");
    });
});

describe("KANTOONG ERP — akses Second Brain (khusus owner)", () => {
    const base = { level: 1, job_role: "umum", modules: null };
    const keys = (member) => modulesFor(member).map((module) => module.key);

    it("hanya owner (level 5); direktur, marketing, & staf tidak", () => {
        expect(keys({ ...base, level: 5 })).toContain("brain");
        expect(keys({ ...base, level: 4 })).not.toContain("brain");
        expect(keys({ ...base, level: 3, job_role: "marketing" })).not.toContain("brain");
        expect(keys(base)).not.toContain("brain");
    });
});

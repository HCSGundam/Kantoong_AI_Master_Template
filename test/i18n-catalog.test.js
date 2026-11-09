import { describe, expect, it } from "vitest";
import { guessLang, keepSpacing, sanitizeLang, shouldTranslate, splitBatches, splitSegments, trimCache } from "../frontend/js/i18n.js";
import { addHistory, catalogToParams, mergeCatalogParams, paramsToCatalog, removeHistory, stripCatalogParams } from "../frontend/js/catalog-url.js";

describe("multi bahasa", () => {
    it("hanya bahasa yang terdaftar", () => {
        expect(sanitizeLang("en")).toBe("en");
        expect(sanitizeLang("xx")).toBeNull();
        expect(sanitizeLang("<script>")).toBeNull();
    });
    it("tebak bahasa perangkat", () => {
        expect(guessLang(["ja-JP", "en"])).toBe("ja");
        expect(guessLang(["in-ID"])).toBe("id");
        expect(guessLang(["fr-FR"])).toBe("id");
    });
    it("harga, angka, email, link & kode tidak diterjemahkan", () => {
        ["Rp 15.000", "Rp15.000", "120", "a@b.co", "https://x.id/a", "MLT-CHOC-250", "★", "  "].forEach((t) => expect(shouldTranslate(t)).toBe(false));
        ["Keranjang", "Tiba 3 hari", "Produk baru"].forEach((t) => expect(shouldTranslate(t)).toBe(true));
    });
    it("paket kecil sesuai batas jumlah & panjang", () => {
        const b = splitBatches(["aaaa", "bbbb", "cccc"], { maxCount: 2, maxChars: 100 });
        expect(b).toEqual([["aaaa", "bbbb"], ["cccc"]]);
        expect(splitBatches(["aaaaa", "bbbbb"], { maxCount: 10, maxChars: 6 })).toEqual([["aaaaa"], ["bbbbb"]]);
    });
    it("pemisah · dipertahankan, tiap bagian diterjemahkan sendiri", () => {
        const parts = splitSegments("Tukar & retur · Miloat");
        expect(parts.map((p) => p.raw)).toEqual(["Tukar & retur", " · ", "Miloat"]);
        expect(parts[1].translate).toBe(false);
        expect(splitSegments("Keranjang")).toHaveLength(1);
    });
    it("spasi asli & batas cache", () => {
        expect(keepSpacing("  Halo ", "Hello")).toBe("  Hello ");
        const big = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k${i}`, i]));
        expect(Object.keys(trimCache(big, 4))).toEqual(["k6", "k7", "k8", "k9"]);
    });
});

describe("link katalog & riwayat pencarian", () => {
    const opts = { sorts: ["relevan", "termurah"], bands: ["all", "lt50"] };
    it("saringan → link → saringan sama", () => {
        const st = { query: "sepatu hitam", global: { sort: "termurah", band: "lt50", discount: true, inStock: false, rating4: true, category: "Sepatu" } };
        const params = catalogToParams(st);
        expect(params.toString()).toBe("katalog=1&cari=sepatu+hitam&urut=termurah&harga=lt50&diskon=1&rating=4&kat=Sepatu");
        expect(paramsToCatalog(params, opts)).toEqual({ query: "sepatu hitam", global: { ...st.global }, perCat: {} });
    });
    it("link buatan orang tidak bisa menyisipkan nilai aneh", () => {
        const st = paramsToCatalog("katalog=1&urut=<img>&harga=semua&cari=%3Cscript%3Ex", opts);
        expect(st.global.sort).toBe("relevan");
        expect(st.global.band).toBe("all");
        expect(st.query).toBe("scriptx");
        expect(paramsToCatalog("cari=a", opts)).toBeNull();
    });
    it("parameter lain di alamat tetap, katalog bisa dibersihkan", () => {
        const merged = mergeCatalogParams("?ref=budi", catalogToParams({ query: "kopi", global: {} }));
        expect(merged).toBe("?ref=budi&katalog=1&cari=kopi");
        expect(stripCatalogParams(merged)).toBe("?ref=budi");
    });
    it("riwayat: terbaru di atas, tanpa kembar, maks 8, bisa dihapus", () => {
        let h = [];
        ["kopi", "teh", "Kopi", "a"].forEach((q) => (h = addHistory(h, q)));
        expect(h).toEqual(["Kopi", "teh"]);
        for (let i = 0; i < 12; i++) h = addHistory(h, `kata${i}`);
        expect(h).toHaveLength(8);
        expect(removeHistory(["a", "b"], "a")).toEqual(["b"]);
    });
});

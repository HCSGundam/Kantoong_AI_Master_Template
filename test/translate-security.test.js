import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parseRequest, translateTexts } = require("../backend/translate.js");

const fakeAi = (reply) => ({
    calls: 0,
    models: {
        generateContent: async function () {
            fakeAi.last = (fakeAi.last ?? 0) + 1;
            return { text: JSON.stringify(reply) };
        },
    },
});

describe("penerjemah backend: gerbang keamanan", () => {
    it("bahasa di luar daftar ditolak", () => {
        expect(parseRequest({ lang: "xx", texts: ["a"] }).error).toBeTruthy();
        expect(parseRequest({ lang: "__proto__", texts: ["a"] }).error).toBeTruthy();
    });
    it("terlalu banyak / terlalu panjang ditolak", () => {
        expect(parseRequest({ lang: "en", texts: Array(81).fill("a") }).error).toBeTruthy();
        const long = "Produk pilihan terbaik untuk kamu hari ini dengan bahan lembut ".repeat(7);
        expect(parseRequest({ lang: "en", texts: Array(30).fill(long) }).error).toBeTruthy();
        expect(parseRequest({ lang: "en", texts: [] }).error).toBeTruthy();
    });
    it("teks dipotong & karakter tersembunyi dibuang", () => {
        const r = parseRequest({ lang: "en", texts: ["Halo​ dunia", "Kemeja katun lembut nyaman dipakai ".repeat(30)] });
        expect(r.texts[0]).toBe("Halo dunia");
        expect(r.texts[1].length).toBeLessThanOrEqual(400);
    });
    it("jawaban AI dengan jumlah berbeda = gagal (tidak menempelkan teks acak)", async () => {
        const out = await translateTexts({ lang: "ja", texts: ["Satu-unik-1", "Dua-unik-2"], keep: [] }, fakeAi(["one"]));
        expect(out).toBeNull();
    });
    it("hasil dibersihkan dari tag & tautan, lalu di-cache", async () => {
        const out = await translateTexts({ lang: "ko", texts: ["Keranjang-unik-3"], keep: [] }, fakeAi(["<img src=x onerror=alert(1)>Cart https://jahat.example"]));
        expect(out[0]).not.toMatch(/<|onerror|jahat\.example/);
        const again = await translateTexts({ lang: "ko", texts: ["Keranjang-unik-3"], keep: [] }, null);
        expect(again).toEqual(out);
    });
});

import { describe, expect, it } from "vitest";
import { PAGES, SIZES, score } from "../frontend/js/ui-audit.js";

describe("rapor tampilan", () => {
    it("menguji semua area di dua ukuran", () => {
        expect(SIZES.map((s) => s.width)).toEqual([390, 1440]);
        const areas = new Set(PAGES.map((p) => p.area));
        ["Toko", "Dashboard", "ERP", "Kasir", "Login"].forEach((a) => expect(areas.has(a)).toBe(true));
        expect(new Set(PAGES.map((p) => p.id)).size).toBe(PAGES.length);
    });
    it("skor: melebar & null paling berat", () => {
        const empty = { overflow: [], nulltext: [], clipped: [], small: [], covered: [], image: [], error: [] };
        expect(score(empty)).toBe(0);
        expect(score({ ...empty, overflow: ["x"] })).toBeGreaterThan(score({ ...empty, small: ["x", "y"] }));
    });
});

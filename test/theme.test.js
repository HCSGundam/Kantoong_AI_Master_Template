import { describe, expect, it } from "vitest";
import { choiceFor, defaultPrefs, resolveTheme, sanitizePrefs } from "../frontend/js/theme.js";

describe("tema gelap/terang seluruh web", () => {
    it("bawaan: semua halaman ikut perangkat", () => {
        expect(defaultPrefs().mode).toBe("all");
        expect(resolveTheme(null, "store", true)).toBe("dark");
        expect(resolveTheme(null, "erp", false)).toBe("light");
    });

    it("mode semua: satu pilihan untuk semua area", () => {
        const prefs = { mode: "all", all: "dark", areas: { store: "light" } };
        expect(["store", "dashboard", "erp", "pos"].map((a) => resolveTheme(prefs, a))).toEqual(["dark", "dark", "dark", "dark"]);
    });

    it("mode per halaman: tiap area sendiri", () => {
        const prefs = { mode: "per-area", all: "light", areas: { store: "light", dashboard: "dark", erp: "system", pos: "dark" } };
        expect(resolveTheme(prefs, "store")).toBe("light");
        expect(resolveTheme(prefs, "dashboard")).toBe("dark");
        expect(resolveTheme(prefs, "erp", true)).toBe("dark");
        expect(resolveTheme(prefs, "erp", false)).toBe("light");
        expect(choiceFor(prefs, "pos")).toBe("dark");
    });

    it("data rusak dibersihkan", () => {
        const clean = sanitizePrefs({ mode: "aneh", all: "ungu", areas: { pos: "dark", erp: 5 } });
        expect(clean.mode).toBe("all");
        expect(clean.all).toBe("system");
        expect(clean.areas.pos).toBe("dark");
        expect(clean.areas.erp).toBe("system");
    });
});

import { describe, expect, it } from "vitest";
import { sheetDecision } from "../frontend/js/sheet-drag.js";

describe("lembar bawah yang bisa ditarik", () => {
    it("ketuk garis = ganti penuh/normal", () => {
        expect(sheetDecision({ dy: 2, ms: 80, full: false, moved: false })).toBe("toggle");
    });
    it("tarik naik = penuh", () => {
        expect(sheetDecision({ dy: -80, ms: 300, full: false, moved: true })).toBe("full");
        expect(sheetDecision({ dy: -30, ms: 40, full: false, moved: true })).toBe("full"); // sentil cepat
    });
    it("tarik turun: penuh → normal, normal → tutup", () => {
        expect(sheetDecision({ dy: 140, ms: 400, full: true, moved: true })).toBe("normal");
        expect(sheetDecision({ dy: 140, ms: 400, full: false, moved: true })).toBe("close");
        expect(sheetDecision({ dy: 40, ms: 50, full: false, moved: true })).toBe("close"); // sentil cepat
    });
    it("geser sedikit = tetap", () => {
        expect(sheetDecision({ dy: 30, ms: 500, full: false, moved: true })).toBe("stay");
    });
});

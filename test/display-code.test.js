import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, codeFromHash, generateCode, normalizeCode, topicFor } from "../frontend/erp/core/display-code.js";

describe("kode pasangan layar pelanggan", () => {
    it("6 karakter, tanpa huruf/angka yang mirip (0/O, 1/I/L)", () => {
        for (let index = 0; index < 200; index += 1) {
            const code = generateCode();
            expect(code).toMatch(/^[A-Z2-9]{6}$/);
            expect(code).not.toMatch(/[01OIL]/);
        }
        expect(CODE_ALPHABET).toHaveLength(31);
        let n = 0;
        expect(generateCode(() => (n++ % 31) / 31)).toBe("ABCDEF");
    });

    it("kode acak tidak berulang dalam ribuan percobaan", () => {
        const seen = new Set(Array.from({ length: 3000 }, () => generateCode()));
        expect(seen.size).toBeGreaterThan(2990);
    });

    it("ketikan dirapikan; kode salah ditolak", () => {
        expect(normalizeCode(" abc-234 ")).toBe("ABC234");
        expect(normalizeCode("ABC 234")).toBe("ABC234");
        expect(normalizeCode("ABC23")).toBe("");
        expect(normalizeCode("ABC2O4")).toBe("");
        expect(normalizeCode("<script>")).toBe("");
    });

    it("saluran & alamat tablet", () => {
        expect(topicFor("ABC234")).toBe("pos-display:ABC234");
        expect(codeFromHash("#/pos/layar/abc234")).toBe("ABC234");
        expect(codeFromHash("#/pos/layar")).toBe("");
        expect(codeFromHash("#/pos/layar/../../x")).toBe("");
    });
});

import { describe, expect, it } from "vitest";
import { installDomGuard, isEmptyPart } from "../frontend/js/dom-guard.js";

describe("pengaman null di layar", () => {
    it("menyaring null/undefined/false", () => {
        const calls = [];
        class FakeEl {}
        FakeEl.prototype.append = function (...nodes) { calls.push(nodes); };
        installDomGuard({ Element: FakeEl });
        new FakeEl().append("a", null, undefined, false, 0, "");
        expect(calls[0]).toEqual(["a", 0, ""]);
        expect(isEmptyPart(null) && isEmptyPart(false) && !isEmptyPart(0)).toBe(true);
    });
});

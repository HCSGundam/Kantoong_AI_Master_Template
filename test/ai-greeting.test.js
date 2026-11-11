import { describe, it, expect } from "vitest";
import { collectActivity, localGreeting, nextVisit, beginSession, rememberSeen, SEEN_KEY } from "../frontend/js/ai-greeting.js";

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const products = [{ id: "1", name: "Miloat Chocolate", category: "PURE MILK" }, { id: "2", name: "Oatcookies", category: "Cookies" }];
const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };

describe("sapaan AI", () => {
    it("menghitung kunjungan", () => {
        expect(nextVisit(null, 100)).toEqual({ count: 1, last: 100, prev: 0 });
        expect(nextVisit({ count: 3, last: 50 }, 100)).toEqual({ count: 4, last: 100, prev: 50 });
    });

    it("tab baru = sesi baru, tab sama = lanjut", () => {
        const storage = mem(), session = mem();
        const a = beginSession({ storage, session, now: 1 });
        const b = beginSession({ storage, session, now: 2 });
        expect(a.fresh).toBe(true);
        expect(b.fresh).toBe(false);
        expect(b.visit.count).toBe(1);
        expect(beginSession({ storage, session: mem(), now: 3 }).visit.count).toBe(2);
    });

    it("merangkum jejak tanpa data pribadi", () => {
        const now = Date.now();
        const a = collectActivity({
            now, products, visit: { count: 3, prev: now - 5 * 86400000 },
            trail: [{ id: "1", at: now - 1000 }, { id: "2", at: now - 500 }, { id: "1", at: now - 100 }],
            cart: [{ name: "Oatcookies" }], searches: ["cokelat"], userName: "Rina Putri",
        });
        expect(a.viewed[0]).toBe("Miloat Chocolate");
        expect(a.most_viewed).toBe("Miloat Chocolate");
        expect(a.cart).toEqual(["Oatcookies"]);
        expect(a.days_since_last).toBe(5);
        expect(a.name).toBe("Rina");
        expect(a.first_visit).toBe(false);
    });

    it("cadangan lokal menyebut isi keranjang & berganti-ganti", () => {
        const a = collectActivity({ products, cart: [{ name: "Oatcookies" }], visit: { count: 2 } });
        const g1 = localGreeting(a, seq([0]));
        const g2 = localGreeting(a, seq([0.9]));
        expect(g1).toContain("Oatcookies");
        expect(g1).not.toBe(g2);
    });

    it("pengunjung baru disambut sebagai tamu pertama", () => {
        const a = collectActivity({ products, visit: { count: 1 } });
        expect(a.first_visit).toBe(true);
        expect(localGreeting(a, seq([0]))).toMatch(/pertama|Selamat datang/);
    });

    it("mengingat produk yang dilihat (maks 20, tanpa duplikat)", () => {
        const storage = mem();
        for (let i = 0; i < 25; i++) rememberSeen(String(i % 22), { storage, now: 1000 + i });
        const list = JSON.parse(storage.getItem(SEEN_KEY));
        expect(list.length).toBe(20);
        expect(new Set(list.map((v) => v.id)).size).toBe(20);
    });
});

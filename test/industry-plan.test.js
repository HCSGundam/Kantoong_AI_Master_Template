import { describe, expect, it } from "vitest";
import { bigPrice, cardLine, cleanAttributes, enrichProducts, goldPrice, specRows } from "../frontend/js/industry.js";
import { PACKAGES } from "../frontend/js/plan.js";
import { defaultPolicies, policyText, sanitizeStorefront, whatsappLink } from "../frontend/js/storefront-settings.js";

describe("paket industri: properti", () => {
    it("isian dibersihkan sesuai kolom properti", () => {
        const a = cleanAttributes("properti", { lt: "120", lb: "90,5", kt: "3", sertifikat: "SHM", maps: "javascript:x", hack: 1, listing: "Dijual" });
        expect(a).toEqual({ lt: 120, lb: 90.5, kt: 3, sertifikat: "SHM", listing: "Dijual" });
    });
    it("ringkasan kartu & spesifikasi", () => {
        const a = { lt: 120, lb: 90, kt: 3, km: 2, lokasi: "Bintaro" };
        expect(cardLine("properti", a)).toBe("LT 120 · LB 90 · 3 KT · 2 KM · Bintaro");
        expect(specRows("properti", a).map((r) => r.label)).toEqual(["Lokasi", "Luas tanah", "Luas bangunan", "Kamar tidur", "Kamar mandi"]);
    });
    it("harga besar mudah dibaca", () => {
        expect(bigPrice(1_250_000_000)).toBe("Rp 1,25 M");
        expect(bigPrice(850_000_000)).toBe("Rp 850 jt");
    });
});

describe("paket industri: emas", () => {
    const gold = { prices: { "24K": 1_400_000, "17K": 900_000 }, updatedAt: "9 Nov 2026" };
    it("harga = berat × harga per gram + ongkos", () => {
        expect(goldPrice({ kadar: "24K", berat: 2.5, ongkos: 150_000 }, gold)).toBe(3_650_000);
        expect(goldPrice({ kadar: "22K", berat: 2 }, gold)).toBeNull();
    });
    it("produk diperkaya: harga hari ini & catatan", () => {
        const [p] = enrichProducts([{ id: 1, price: 999, caption: "" }], new Map([["1", { kadar: "17K", berat: 2 }]]), { industry: "emas", gold });
        expect(p.price).toBe(1_800_000);
        expect(p.base_price).toBe(999);
        expect(p.price_note).toContain("9 Nov 2026");
        expect(p.caption).toBe("17K · 2 gr");
    });
    it("industri umum tidak mengubah apa pun", () => {
        const list = [{ id: 1, price: 5 }];
        expect(enrichProducts(list, new Map(), { industry: "umum" })).toBe(list);
    });
});

describe("paket layanan", () => {
    it("WEB AI BOS FREE: tanpa keranjang & kasir, ERP ringkas, dashboard terbatas", () => {
        expect(PACKAGES.free.commerce).toBe(false);
        expect(PACKAGES.free.pos).toBe(false);
        expect(PACKAGES.free.erpModules).toContain("catalog");
        expect(PACKAGES.free.erpModules).not.toContain("pos");
        expect(PACKAGES.free.dashboardFeatures).not.toContain("my-orders");
        expect(PACKAGES.pro.erpModules).toBeNull();
    });
});

describe("info toko & kebijakan", () => {
    it("kontak dibersihkan & link WhatsApp format 62", () => {
        const s = sanitizeStorefront({ brand: { name: "Toko A", contact: { whatsapp: "0812-3456-789", email: "salah", maps: "http://x" } } });
        expect(s.brand.contact.whatsapp).toBe("08123456789");
        expect(s.brand.contact.email).toBe("");
        expect(s.brand.contact.maps).toBe("");
        expect(whatsappLink(s, "halo kak")).toBe("https://wa.me/628123456789?text=halo%20kak");
    });
    it("kebijakan kosong memakai template bernama toko", () => {
        const s = sanitizeStorefront({ brand: { name: "Toko A" } });
        expect(policyText(s, "returns")).toContain("Toko A");
        expect(Object.keys(defaultPolicies("X"))).toEqual(["returns", "shipping", "terms", "privacy"]);
    });
});

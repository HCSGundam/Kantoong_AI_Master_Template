import { describe, it, expect } from "vitest";

import { canTransition, nextSteps, payJournal, poTotal, receiveJournal, validatePoLines } from "../frontend/erp/core/purchasing.js";
import { actionsFor, applyAction } from "../frontend/erp/core/logistics.js";
import { checkVoucher, describeVoucher, isValidCode, voucherDiscount } from "../frontend/erp/core/marketing.js";
import { aggregateCustomers, maskPhone, segmentOf } from "../frontend/erp/core/crm.js";
import { refundJournal, sortTickets, waitingLabel } from "../frontend/erp/core/cs.js";
import { balanceSheet, flattenLines, validateJournal } from "../frontend/erp/core/accounting.js";
import { modulesFor } from "../frontend/erp/core/modules.js";
import { buildDemoSeed } from "../frontend/erp/data/demo-seed.js";

describe("KANTOONG ERP — pembelian (PO)", () => {
    it("alur status PO tidak bisa dilompati", () => {
        expect(canTransition("draft", "dipesan")).toBe(true);
        expect(canTransition("draft", "diterima")).toBe(false);
        expect(canTransition("diterima", "dibatalkan")).toBe(false);
        expect(nextSteps("dibayar")).toEqual([]);
    });

    it("total & validasi baris", () => {
        expect(poTotal([{ qty: 10, unit_cost: 8000 }, { qty: 5, unit_cost: 11000 }])).toBe(135000);
        expect(validatePoLines([])).toMatch(/minimal/);
        expect(validatePoLines([{ product_id: "p1", qty: 1.5, unit_cost: 100 }])).toMatch(/bulat/);
        expect(validatePoLines([{ product_id: "p1", qty: 2, unit_cost: 100 }])).toBe("");
    });

    it("jurnal terima barang & pelunasan seimbang", () => {
        expect(validateJournal(receiveJournal(135000))).toBe("");
        expect(payJournal(135000, "tunai")[1].account_code).toBe("1-1000");
    });
});

describe("KANTOONG ERP — logistik pesanan online", () => {
    it("urutan langkah & resi wajib saat kirim", () => {
        expect(applyAction("dibayar", "proses")).toBe("diproses");
        expect(() => applyAction("dibayar", "kirim")).toThrow();
        expect(() => applyAction("diproses", "kirim", { warehouseId: "w" })).toThrow(/resi/);
        expect(applyAction("diproses", "kirim", { tracking: "JX1", warehouseId: "w" })).toBe("dikirim");
        expect(() => applyAction("dikirim", "batal")).toThrow();
    });

    it("tombol sesuai peran: gudang kemas, keuangan konfirmasi bayar", () => {
        const gudang = { level: 1, job_role: "gudang" };
        const keuangan = { level: 1, job_role: "keuangan" };
        expect(actionsFor("dibayar", gudang).map((a) => a.action)).toEqual(["proses"]);
        expect(actionsFor("menunggu_pembayaran", gudang)).toEqual([]);
        expect(actionsFor("menunggu_pembayaran", keuangan).map((a) => a.action)).toContain("bayar");
    });
});

describe("KANTOONG ERP — voucher", () => {
    const hemat = { code: "HEMAT10", kind: "persen", value: 10, max_discount: 10000, min_purchase: 30000, quota: 2, used: 0, is_active: true };

    it("persen dibatasi maksimal, tidak pernah melebihi belanja", () => {
        expect(voucherDiscount(hemat, 50000)).toBe(5000);
        expect(voucherDiscount(hemat, 500000)).toBe(10000);
        expect(voucherDiscount({ kind: "nominal", value: 50000 }, 20000)).toBe(20000);
    });

    it("minimal belanja, kuota, masa berlaku", () => {
        expect(checkVoucher(hemat, 20000).valid).toBe(false);
        expect(checkVoucher({ ...hemat, used: 2 }, 50000).message).toMatch(/Kuota/);
        expect(checkVoucher({ ...hemat, ends_at: "2020-01-01" }, 50000).message).toMatch(/berakhir/);
        expect(checkVoucher(hemat, 50000)).toEqual({ valid: true, discount: 5000 });
    });

    it("format kode & deskripsi", () => {
        expect(isValidCode("hemat10")).toBe(true);
        expect(isValidCode("HE MAT")).toBe(false);
        expect(describeVoucher(hemat)).toMatch(/10% maks/);
    });
});

describe("KANTOONG ERP — CRM & UU PDP", () => {
    const now = new Date("2026-11-03T05:00:00Z");
    const orders = [
        { customer_phone: "081200001111", customer_name: "Rani", status: "selesai", total: 50000, created_at: "2026-08-01T00:00:00Z", sales_member_id: "a1" },
        { customer_phone: "081200001111", customer_name: "Rani", status: "selesai", total: 60000, created_at: "2026-10-01T00:00:00Z", sales_member_id: "a1" },
        { customer_phone: "081200001111", customer_name: "Rani", status: "dibayar", total: 70000, created_at: "2026-11-01T00:00:00Z", sales_member_id: "a1" },
        { customer_phone: "081299992222", customer_name: "Agus", status: "selesai", total: 40000, created_at: "2026-07-01T00:00:00Z", sales_member_id: "b1" },
        { customer_phone: "081233334444", customer_name: "Dewi", status: "dibatalkan", total: 90000, created_at: "2026-11-02T00:00:00Z", sales_member_id: "b1" },
    ];

    it("pelanggan dari pesanan; pesanan batal tidak dihitung", () => {
        const list = aggregateCustomers(orders);
        expect(list.map((c) => c.name)).toEqual(["Rani", "Agus"]);
        expect(list[0]).toMatchObject({ orders_count: 3, total_spent: 180000 });
    });

    it("segmen: loyal & tidak aktif", () => {
        const [rani, agus] = aggregateCustomers(orders);
        expect(segmentOf(rani, now)).toBe("loyal");
        expect(segmentOf(agus, now)).toBe("pasif");
    });

    it("sales hanya melihat pelanggannya; marketing tanpa izin melihat nomor disamarkan", () => {
        expect(aggregateCustomers(orders, [], { onlySalesId: "b1" }).map((c) => c.name)).toEqual(["Agus"]);
        const masked = aggregateCustomers(orders, [{ phone: "081200001111", marketing_consent: true }], { maskWithoutConsent: true });
        expect(masked.find((c) => c.name === "Rani").phone).toBe("081200001111");
        expect(masked.find((c) => c.name === "Agus").phone).toBe(maskPhone("081299992222"));
        expect(masked.find((c) => c.name === "Agus").email).toBeNull();
    });
});

describe("KANTOONG ERP — customer service", () => {
    it("tiket terbuka berprioritas tinggi didahulukan", () => {
        const sorted = sortTickets([
            { id: 1, status: "selesai", priority: "tinggi", created_at: "2026-11-01" },
            { id: 2, status: "baru", priority: "normal", created_at: "2026-11-01" },
            { id: 3, status: "diproses", priority: "tinggi", created_at: "2026-11-02" },
        ]);
        expect(sorted.map((t) => t.id)).toEqual([3, 2, 1]);
        expect(waitingLabel("2026-11-01T00:00:00Z", new Date("2026-11-03T00:00:00Z"))).toBe("2 hari");
        expect(validateJournal(refundJournal(15000))).toBe("");
    });
});

describe("KANTOONG ERP — menu fase 3 & data demo", () => {
    it("CS & marketing punya menunya; sales melihat CRM (pelanggannya)", () => {
        expect(modulesFor({ level: 1, job_role: "cs" }).map((m) => m.key)).toEqual(expect.arrayContaining(["cs", "crm", "logistics"]));
        expect(modulesFor({ level: 1, job_role: "marketing" }).map((m) => m.key)).toEqual(expect.arrayContaining(["marketing", "crm"]));
        const sales = modulesFor({ level: 1, job_role: "sales" }).map((m) => m.key);
        expect(sales).toContain("crm");
        expect(sales).not.toContain("purchasing");
        expect(sales).not.toContain("marketing");
    });

    it("data demo tetap seimbang setelah PO, voucher & retur", () => {
        const seed = buildDemoSeed([], new Date("2026-11-03T05:00:00Z"));
        expect(seed.journal.every((entry) => validateJournal(entry.lines) === "")).toBe(true);
        expect(balanceSheet(seed.accounts, flattenLines(seed.journal), "2026-11-30").balanced).toBe(true);
        expect(seed.vouchers.find((v) => v.code === "HEMAT10").used).toBe(
            seed.voucher_redemptions.filter((r) => r.voucher_id === "v-hemat").length
        );
    });
});

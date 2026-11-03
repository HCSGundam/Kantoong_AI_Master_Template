import { describe, it, expect } from "vitest";

import { applyMoves, planMoves, stockStatus, totalByProduct } from "../frontend/erp/core/inventory.js";
import {
    DEFAULT_ACCOUNTS, QUICK_ENTRIES, balanceSheet, flattenLines, monthRange, profitLoss, validateJournal,
} from "../frontend/erp/core/accounting.js";
import { priceCart, quickCash, receiptNumber, settle } from "../frontend/erp/core/pos.js";
import { checkInStatus, monthlyRecap, previousPeriod, wibDate, workDuration } from "../frontend/erp/core/hr.js";
import { computePayslip, payrollJournal } from "../frontend/erp/core/payroll.js";
import { hasRole, isPayrollAdmin } from "../frontend/erp/core/org.js";
import { modulesFor } from "../frontend/erp/core/modules.js";
import { buildDemoSeed } from "../frontend/erp/data/demo-seed.js";

describe("KANTOONG ERP — gudang & stok", () => {
    const levels = [{ warehouse_id: "pusat", product_id: "p1", qty: 10, min_qty: 3 }];

    it("barang masuk menambah, keluar mengurangi", () => {
        const after = applyMoves(levels, planMoves(levels, { kind: "masuk", warehouse_id: "pusat", product_id: "p1", qty: 5 }));
        expect(after[0].qty).toBe(15);
        const out = applyMoves(after, planMoves(after, { kind: "keluar", warehouse_id: "pusat", product_id: "p1", qty: 4 }));
        expect(out[0].qty).toBe(11);
    });

    it("stok tidak boleh minus", () => {
        expect(() => planMoves(levels, { kind: "keluar", warehouse_id: "pusat", product_id: "p1", qty: 11 })).toThrow(/tidak cukup/);
    });

    it("transfer = keluar di asal + masuk di tujuan, total tetap", () => {
        const moves = planMoves(levels, { kind: "transfer", warehouse_id: "pusat", to_warehouse_id: "outlet", product_id: "p1", qty: 4 });
        const after = applyMoves(levels, moves);
        expect(after.find((l) => l.warehouse_id === "outlet").qty).toBe(4);
        expect(totalByProduct(after).get("p1")).toBe(10);
        expect(() => planMoves(levels, { kind: "transfer", warehouse_id: "pusat", to_warehouse_id: "pusat", product_id: "p1", qty: 1 })).toThrow();
    });

    it("stock opname mencatat selisih saja", () => {
        expect(planMoves(levels, { kind: "opname", warehouse_id: "pusat", product_id: "p1", counted: 8 })).toEqual([
            { warehouse_id: "pusat", product_id: "p1", qty: -2, kind: "penyesuaian" },
        ]);
        expect(planMoves(levels, { kind: "opname", warehouse_id: "pusat", product_id: "p1", counted: 10 })).toEqual([]);
    });

    it("status stok", () => {
        expect(stockStatus(0, 3)).toBe("habis");
        expect(stockStatus(3, 3)).toBe("menipis");
        expect(stockStatus(9, 3)).toBe("aman");
    });
});

describe("KANTOONG ERP — pembukuan berpasangan", () => {
    it("jurnal harus seimbang & minimal 2 baris", () => {
        expect(validateJournal(QUICK_ENTRIES.pengeluaran(50000))).toBe("");
        expect(validateJournal([{ account_code: "1-1000", debit: 100, credit: 0 }])).toMatch(/2 baris/);
        expect(validateJournal([
            { account_code: "6-1200", debit: 100, credit: 0 },
            { account_code: "1-1000", debit: 0, credit: 90 },
        ])).toMatch(/tidak seimbang/);
    });

    it("laba rugi & neraca selalu seimbang", () => {
        const entries = [
            { id: "1", entry_date: "2026-11-01", lines: QUICK_ENTRIES.modal(10_000_000) },
            { id: "2", entry_date: "2026-11-02", lines: QUICK_ENTRIES.penjualanOnline(300_000) },
            { id: "3", entry_date: "2026-11-02", lines: QUICK_ENTRIES.penjualanKasir(200_000, "tunai") },
            { id: "4", entry_date: "2026-11-03", lines: QUICK_ENTRIES.pengeluaran(150_000) },
        ];
        const lines = flattenLines(entries);
        const pl = profitLoss(DEFAULT_ACCOUNTS, lines, monthRange("2026-11"));
        expect(pl.totalRevenue).toBe(500_000);
        expect(pl.net).toBe(350_000);

        const bs = balanceSheet(DEFAULT_ACCOUNTS, lines, "2026-11-30");
        expect(bs.totalAssets).toBe(10_350_000);
        expect(bs.balanced).toBe(true);
    });

    it("rentang bulan", () => {
        expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    });
});

describe("KANTOONG ERP — kasir POS", () => {
    const products = [{ id: "p1", name: "Susu", price: 15000 }, { id: "p2", name: "Kue", price: 7000 }];

    it("harga dari katalog, bukan dari kasir; diskon dibatasi", () => {
        const cart = priceCart([{ product_id: "p1", qty: 2, price: 1 }, { product_id: "p2", qty: 1 }], products, 999999);
        expect(cart.subtotal).toBe(37000);
        expect(cart.discount).toBe(37000);
        expect(cart.total).toBe(0);
    });

    it("tunai menghitung kembalian; non-tunai pas", () => {
        expect(settle(37000, "tunai", 50000)).toEqual({ paid: 50000, change: 13000, ok: true });
        expect(settle(37000, "tunai", 20000).ok).toBe(false);
        expect(settle(37000, "qris", 0)).toEqual({ paid: 37000, change: 0, ok: true });
        expect(quickCash(37000)[0]).toBe(37000);
    });

    it("nomor struk berformat WIB", () => {
        expect(receiptNumber(7, new Date("2026-11-03T20:00:00Z"))).toBe("POS-261104-00007");
    });
});

describe("KANTOONG ERP — absensi", () => {
    it("telat bila masuk lewat jam mulai + toleransi (WIB)", () => {
        const rules = { work_start: "09:00", grace_minutes: 10 };
        expect(checkInStatus(new Date("2026-11-03T02:05:00Z"), rules)).toBe("hadir"); // 09.05
        expect(checkInStatus(new Date("2026-11-03T02:15:00Z"), rules)).toBe("telat"); // 09.15
    });

    it("rekap bulanan & durasi kerja", () => {
        const records = [
            { member_id: "a", work_date: "2026-11-01", status: "hadir" },
            { member_id: "a", work_date: "2026-11-02", status: "telat" },
            { member_id: "a", work_date: "2026-11-03", status: "alpa" },
            { member_id: "b", work_date: "2026-11-03", status: "hadir" },
            { member_id: "a", work_date: "2026-10-30", status: "alpa" },
        ];
        expect(monthlyRecap(records, "a", "2026-11")).toMatchObject({ masuk: 2, telat: 1, alpa: 1 });
        expect(workDuration("2026-11-03T02:00:00Z", "2026-11-03T10:05:00Z")).toBe("8 j 5 m");
        expect(previousPeriod("2026-01")).toBe("2025-12");
        expect(wibDate(new Date("2026-11-03T18:00:00Z"))).toBe("2026-11-04");
    });
});

describe("KANTOONG ERP — payroll", () => {
    it("bersih = pokok + komisi + tunjangan − potongan − alpa", () => {
        const slip = computePayslip({
            baseSalary: 5_200_000, commissionRate: 2.5, omzet: 10_000_000,
            alpaDays: 2, workingDays: 26, allowance: 300_000, deduction: 100_000,
        });
        expect(slip.commission).toBe(250_000);
        expect(slip.attendance_deduction).toBe(400_000);
        expect(slip.net).toBe(5_250_000);
    });

    it("jurnal pembayaran gaji seimbang", () => {
        const slips = [
            computePayslip({ baseSalary: 4_000_000, commissionRate: 3, omzet: 5_000_000 }),
            computePayslip({ baseSalary: 6_000_000 }),
        ];
        const lines = payrollJournal(slips);
        expect(validateJournal(lines)).toBe("");
        expect(lines.find((line) => line.account_code === "6-1100").debit).toBe(150_000);
    });

    it("hanya HR & owner yang mengelola payroll", () => {
        expect(isPayrollAdmin({ level: 2, job_role: "hr" })).toBe(true);
        expect(isPayrollAdmin({ level: 4, job_role: "umum" })).toBe(false);
        expect(hasRole({ level: 1, job_role: "kasir" }, "kasir")).toBe(true);
    });
});

describe("KANTOONG ERP — menu fase 2 & data demo", () => {
    it("kasir melihat Kasir POS, sales tidak; keuangan khusus bagian keuangan", () => {
        const kasir = modulesFor({ level: 1, job_role: "kasir" }).map((m) => m.key);
        const sales = modulesFor({ level: 1, job_role: "sales" }).map((m) => m.key);
        expect(kasir).toContain("pos");
        expect(sales).not.toContain("pos");
        expect(sales).not.toContain("finance");
        expect(sales).toContain("hr");
        expect(modulesFor({ level: 1, job_role: "keuangan" }).map((m) => m.key)).toContain("finance");
    });

    it("data demo: semua jurnal seimbang & neraca seimbang", () => {
        const seed = buildDemoSeed([], new Date("2026-11-03T05:00:00Z"));
        expect(seed.journal.every((entry) => validateJournal(entry.lines) === "")).toBe(true);
        expect(balanceSheet(seed.accounts, flattenLines(seed.journal), "2026-11-30").balanced).toBe(true);
        expect(seed.stock_levels.every((level) => level.qty >= 0)).toBe(true);
        expect(seed.payslips.length).toBeGreaterThan(0);
    });
});

import { IDLE_LIMIT_MS, isUnlocked, lock, touch, unlock } from "../frontend/erp/core/erp-lock.js";

describe("KANTOONG ERP — pintu ERP wajib password ulang", () => {
    const memory = () => {
        const store = new Map();
        return {
            getItem: (key) => (store.has(key) ? store.get(key) : null),
            setItem: (key, value) => store.set(key, String(value)),
            removeItem: (key) => store.delete(key),
        };
    };

    it("terkunci sampai password dimasukkan, hanya untuk akun yang sama", () => {
        const storage = memory();
        expect(isUnlocked("u1", storage, 1000)).toBe(false);
        unlock("u1", storage, 1000);
        expect(isUnlocked("u1", storage, 2000)).toBe(true);
        expect(isUnlocked("u2", storage, 2000)).toBe(false);
    });

    it("terkunci otomatis setelah 30 menit tanpa aktivitas; aktivitas memperpanjang", () => {
        const storage = memory();
        unlock("u1", storage, 0);
        touch(storage, IDLE_LIMIT_MS - 1000);
        expect(isUnlocked("u1", storage, IDLE_LIMIT_MS + 5000)).toBe(true);
        expect(isUnlocked("u1", storage, 2 * IDLE_LIMIT_MS)).toBe(false);
    });

    it("tombol Kunci menghapus akses", () => {
        const storage = memory();
        unlock("u1", storage, 0);
        lock(storage);
        expect(isUnlocked("u1", storage, 1)).toBe(false);
    });
});

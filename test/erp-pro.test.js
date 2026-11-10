import { describe, expect, it } from "vitest";
import { buildChain, chainProgress, currentApprover, decideStep, delegateFor, isOverdue, resolveStep, ruleFor, validateRule } from "../frontend/erp/core/approval-chain.js";
import { aging, applyPayment, budgetUsage, cashForecast, dueWithin, validateInvoice } from "../frontend/erp/core/finance-pro.js";
import { expiryAlerts, fefoPick, reorderSuggestions } from "../frontend/erp/core/inventory-pro.js";
import { contractAlerts, leaveBalance, reviewScore, validateLeave, workDays } from "../frontend/erp/core/hr-pro.js";
import { followUps, lossReasons, moveStage, pipelineSummary, stuckDeals } from "../frontend/erp/core/crm-pro.js";
import { buildSignals, healthScore, matchScore, searchCommands, topDecisions, unreadCount } from "../frontend/erp/core/command-center.js";

const members = [
    { id: "own", level: 5, job_role: "umum", manager_id: null, full_name: "Owner" },
    { id: "mgr", level: 3, job_role: "umum", manager_id: "own", full_name: "Manajer" },
    { id: "spv", level: 2, job_role: "umum", manager_id: "mgr", full_name: "Supervisor" },
    { id: "stf", level: 1, job_role: "sales", manager_id: "spv", full_name: "Staf" },
    { id: "fin", level: 2, job_role: "keuangan", manager_id: "own", full_name: "Keuangan" },
    { id: "hr", level: 2, job_role: "hr", manager_id: "own", full_name: "HR" },
];
const NOW = new Date("2026-11-10T03:00:00Z");

describe("persetujuan berjenjang", () => {
    it("memilih aturan sesuai nominal", () => {
        expect(ruleFor("pengeluaran", 500_000).id).toBe("r-exp-0");
        expect(ruleFor("pengeluaran", 1_000_000).id).toBe("r-exp-1");
        expect(ruleFor("pengeluaran", 9_000_000).id).toBe("r-exp-5");
        expect(ruleFor("tidakada", 1).steps).toEqual(["atasan"]);
    });

    it("menerjemahkan langkah ke orang", () => {
        const stf = members[3];
        expect(resolveStep("atasan", stf, members)).toBe("spv");
        expect(resolveStep("level:3", stf, members)).toBe("mgr");
        expect(resolveStep("role:keuangan", stf, members)).toBe("fin");
        expect(resolveStep("owner", stf, members)).toBe("own");
        expect(resolveStep("role:legal", stf, members)).toBe("own");
    });

    it("rantai besar: atasan → keuangan → owner, tanpa pemohon & tanpa dobel", () => {
        const { chain } = buildChain({ kind: "pengeluaran", amount: 6_000_000, requester_id: "stf" }, { members, now: NOW });
        expect(chain.map((s) => s.approver_id)).toEqual(["spv", "fin", "own"]);
        const own = buildChain({ kind: "pengeluaran", amount: 6_000_000, requester_id: "own" }, { members, now: NOW });
        expect(own.chain).toEqual([]);
        const fin = buildChain({ kind: "pengeluaran", amount: 6_000_000, requester_id: "fin" }, { members, now: NOW });
        expect(fin.chain.map((s) => s.approver_id)).toEqual(["own"]);
    });

    it("owner yang juga atasan langsung cukup sekali, di langkah terakhir", () => {
        const { chain } = buildChain({ kind: "po", amount: 7_200_000, requester_id: "hr" }, { members, now: NOW });
        expect(chain.map((s) => s.approver_id)).toEqual(["fin", "own"]);
    });

    it("delegasi saat atasan cuti", () => {
        const delegations = [{ from_id: "spv", to_id: "mgr", starts: "2026-11-09", ends: "2026-11-12" }];
        expect(delegateFor("spv", delegations, NOW)).toBe("mgr");
        expect(delegateFor("spv", delegations, new Date("2026-11-20"))).toBe("spv");
        const { chain } = buildChain({ kind: "pengeluaran", amount: 100, requester_id: "stf" }, { members, delegations, now: NOW });
        expect(chain[0]).toMatchObject({ approver_id: "mgr", original_id: "spv" });
    });

    it("memutuskan langkah demi langkah", () => {
        const base = { id: "a1", requester_id: "stf", status: "menunggu", created_at: NOW.toISOString(), ...buildChain({ kind: "pengeluaran", amount: 6_000_000, requester_id: "stf" }, { members }) };
        expect(currentApprover(base)).toBe("spv");
        expect(() => decideStep(base, members[4], "disetujui")).toThrow(/giliran/);
        expect(() => decideStep(base, members[3], "disetujui")).toThrow(/sendiri/);
        const s1 = decideStep(base, members[2], "disetujui", "", NOW);
        expect(s1.status).toBe("menunggu");
        expect(s1.approver_id).toBe("fin");
        expect(chainProgress(s1).label).toMatch(/Langkah 2 dari 3/);
        const s2 = decideStep(s1, members[4], "ditolak", "Tidak ada anggaran", NOW);
        expect(s2.status).toBe("ditolak");
        expect(() => decideStep(s2, members[0], "disetujui")).toThrow();
        // Owner boleh langsung memutuskan langkah siapa pun.
        const ok = decideStep(decideStep(decideStep(base, members[0], "disetujui"), members[0], "disetujui"), members[0], "disetujui");
        expect(ok.status).toBe("disetujui");
    });

    it("telat > 24 jam & validasi aturan", () => {
        const a = { status: "menunggu", created_at: "2026-11-08T00:00:00Z", chain: [{ approver_id: "spv" }] };
        expect(isOverdue(a, NOW)).toBe(true);
        expect(validateRule({ kind: "po", min_amount: 0, steps: ["atasan", "owner"] })).toBeNull();
        expect(validateRule({ kind: "po", min_amount: 0, steps: ["hapus semua"] })).toMatch(/tidak dikenal/);
    });
});

describe("keuangan pro", () => {
    const invoices = [
        { id: 1, direction: "piutang", party: "PT A", amount: 5_000_000, paid: 0, due_date: "2026-10-01" },
        { id: 2, direction: "piutang", party: "PT B", amount: 2_000_000, paid: 500_000, due_date: "2026-11-20" },
        { id: 3, direction: "hutang", party: "Supplier X", amount: 3_000_000, paid: 0, due_date: "2026-11-12" },
        { id: 4, direction: "piutang", party: "PT C", amount: 1_000_000, paid: 1_000_000, due_date: "2026-09-01" },
    ];

    it("umur piutang", () => {
        const ar = aging(invoices, "piutang", NOW);
        expect(ar.total).toBe(6_500_000);
        expect(ar.rows.find((r) => r.key === "31-60").total).toBe(5_000_000);
        expect(ar.rows.find((r) => r.key === "belum").total).toBe(1_500_000);
        expect(dueWithin(invoices, "hutang", 3, NOW).map((i) => i.id)).toEqual([3]);
    });

    it("bayar sebagian & lunas", () => {
        const p = applyPayment(invoices[1], 500_000);
        expect(p.status).toBe("sebagian");
        expect(applyPayment(p, 1_000_000).status).toBe("lunas");
        expect(() => applyPayment(p, 9_000_000)).toThrow();
        expect(validateInvoice({ direction: "piutang", party: "X", amount: 1, due_date: "2026-11-30" })).toBeNull();
        expect(validateInvoice({ direction: "piutang", party: "", amount: 1, due_date: "2026-11-30" })).toMatch(/wajib/);
    });

    it("proyeksi kas menemukan titik terendah", () => {
        const f = cashForecast({ cashNow: 2_000_000, invoices, recurring: [{ label: "Gaji", amount: -4_000_000, day: 25 }], days: 30, now: NOW });
        expect(f.series).toHaveLength(30);
        expect(f.lowest.balance).toBeLessThan(0);
        expect(f.firstNegative).not.toBeNull();
    });

    it("anggaran vs realisasi", () => {
        const rows = budgetUsage(
            [{ id: "b1", account_code: "6-1200", period: "2026-11", amount: 1_000_000 }],
            [{ account_code: "6-1200", debit: 900_000, credit: 0, date: "2026-11-05" }, { account_code: "6-1200", debit: 300_000, credit: 0, date: "2026-10-05" }],
            "2026-11"
        );
        expect(rows[0]).toMatchObject({ actual: 900_000, pct: 90, status: "waspada" });
    });
});

describe("gudang pro", () => {
    it("saran belanja dari pemakaian", () => {
        const rows = reorderSuggestions({
            products: [{ id: "p1", name: "Kopi", cost_price: 10000 }, { id: "p2", name: "Teh" }],
            levels: [{ product_id: "p1", qty: 4, min_qty: 2 }, { product_id: "p2", qty: 100, min_qty: 2 }],
            moves: [{ product_id: "p1", qty: -28, kind: "keluar", created_at: "2026-11-05T00:00:00Z" }],
            now: NOW,
        });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ product_id: "p1", perDay: 2, urgency: "segera" });
        expect(rows[0].suggest).toBe(26);
    });

    it("kedaluwarsa & FEFO", () => {
        const batches = [
            { id: "b1", qty: 5, expires_on: "2026-11-08" },
            { id: "b2", qty: 5, expires_on: "2026-11-15" },
            { id: "b3", qty: 5, expires_on: "2027-01-01" },
        ];
        expect(expiryAlerts(batches, NOW).map((b) => b.status)).toEqual(["lewat", "minggu"]);
        const pick = fefoPick(batches, 7, NOW);
        expect(pick.picks).toEqual([{ batch_id: "b2", qty: 5, expires_on: "2026-11-15" }, { batch_id: "b3", qty: 2, expires_on: "2027-01-01" }]);
        expect(fefoPick(batches, 20, NOW).short).toBe(10);
    });
});

describe("SDM pro", () => {
    it("hari kerja & sisa cuti", () => {
        expect(workDays("2026-11-09", "2026-11-15")).toBe(5);
        expect(validateLeave({ kind: "tahunan", starts: "2026-11-14", ends: "2026-11-15" })).toMatch(/hari kerja/);
        const bal = leaveBalance("stf", [
            { member_id: "stf", kind: "tahunan", starts: "2026-03-02", ends: "2026-03-04", status: "disetujui" },
            { member_id: "stf", kind: "sakit", starts: "2026-04-01", ends: "2026-04-02", status: "disetujui" },
            { member_id: "stf", kind: "tahunan", starts: "2026-12-01", ends: "2026-12-01", status: "ditolak" },
        ], 2026);
        expect(bal).toEqual({ quota: 12, used: 3, left: 9 });
    });

    it("pengingat kontrak & nilai kinerja", () => {
        const alerts = contractAlerts([
            { id: 1, member_id: "a", ends_on: "2026-11-20" },
            { id: 2, member_id: "b", ends_on: "2026-11-01" },
            { id: 3, member_id: "c", ends_on: "2027-06-01", probation_ends_on: "2026-11-17" },
        ], NOW);
        expect(alerts.map((a) => a.alert)).toEqual(["habis", "segera", "percobaan"]);
        expect(reviewScore({ kehadiran: 5, target: 5, kualitas: 5, kerjasama: 5, inisiatif: 5 })).toMatchObject({ score: 100, grade: "A" });
        expect(reviewScore({}).grade).toBe("-");
    });
});

describe("CRM pro", () => {
    const deals = [
        { id: 1, customer: "A", value: 10_000_000, stage: "penawaran", next_action_at: "2026-11-09T09:00:00Z", updated_at: "2026-11-09T00:00:00Z" },
        { id: 2, customer: "B", value: 4_000_000, stage: "prospek", updated_at: "2026-10-20T00:00:00Z" },
        { id: 3, customer: "C", value: 6_000_000, stage: "menang" },
        { id: 4, customer: "D", value: 1_000_000, stage: "kalah", lost_reason: "Harga" },
    ];
    it("pipeline & peramalan", () => {
        const s = pipelineSummary(deals);
        expect(s.forecast).toBe(5_400_000);
        expect(s.winRate).toBe(50);
        expect(followUps(deals, NOW).telat.map((d) => d.id)).toEqual([1]);
        expect(stuckDeals(deals, NOW).map((d) => d.id)).toEqual([2]);
        expect(() => moveStage(deals[0], "kalah")).toThrow(/alasan/);
        expect(lossReasons(deals)).toEqual([{ reason: "harga", count: 1 }]);
    });
});

describe("ruang komando & Ctrl+K", () => {
    it("sinyal dihormati per peran & diurutkan", () => {
        const input = {
            members,
            approvals: [{ id: "x", title: "Beli printer", amount: 6_000_000, requester_id: "stf", status: "menunggu", approver_id: "own", chain: [{ approver_id: "own" }], created_at: NOW.toISOString() }],
            invoices: [{ id: 1, direction: "piutang", party: "PT A", amount: 20_000_000, paid: 0, due_date: "2026-10-01" }],
            contracts: [{ id: 1, member_id: "stf", ends_on: "2026-11-15" }],
            products: [], levels: [], moves: [], deals: [],
            now: NOW,
        };
        const owner = buildSignals({ ...input, me: members[0] });
        expect(owner.map((s) => s.area)).toEqual(expect.arrayContaining(["Persetujuan", "Keuangan", "SDM"]));
        expect(owner[0].tone).toBe("kritis");
        expect(topDecisions(owner)).toHaveLength(3);
        const staff = buildSignals({ ...input, me: members[3] });
        expect(staff).toHaveLength(0);
        expect(healthScore(owner).score).toBeLessThan(100);
        expect(unreadCount(owner, [owner[0].id])).toBe(owner.length - 1);
    });

    it("pencarian perintah toleran", () => {
        expect(matchScore("gud", "Gudang & Stok")).toBe(100);
        expect(matchScore("stok", "Gudang & Stok")).toBe(80);
        expect(matchScore("gdg", "Gudang")).toBeGreaterThan(0);
        expect(matchScore("xyz", "Gudang")).toBe(0);
        const items = [{ id: 1, label: "Keuangan" }, { id: 2, label: "Gudang & Stok", keywords: "inventori barang" }];
        expect(searchCommands("barang", items).map((i) => i.id)).toEqual([2]);
    });
});

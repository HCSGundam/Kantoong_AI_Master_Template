import { describe, it, expect } from "vitest";

import {
    canEditSalary,
    canManage,
    canView,
    canViewSalary,
    isOrgAdmin,
    isValidManager,
    isValidSlug,
    managerChain,
    slugify,
    subtreeIds,
    unitPath,
    unitSubtreeIds,
} from "../frontend/erp/core/org.js";
import {
    commission,
    dailySeries,
    leaderboard,
    periodStart,
    progress,
    salesTotals,
    sumOrders,
} from "../frontend/erp/core/metrics.js";
import { modulesFor } from "../frontend/erp/core/modules.js";
import { buildDemoSeed } from "../frontend/erp/data/demo-seed.js";

const m = (id, extra = {}) => ({
    id, full_name: id, level: 1, job_role: "umum", manager_id: null, is_active: true, ...extra,
});

// Owner > Manager > (Supervisor A > Sales A1, A2) & (Supervisor B > Sales B1)
const members = [
    m("owner", { level: 5 }),
    m("mgr", { level: 3, manager_id: "owner" }),
    m("supA", { level: 2, manager_id: "mgr" }),
    m("supB", { level: 2, manager_id: "mgr" }),
    m("a1", { job_role: "sales", manager_id: "supA" }),
    m("a2", { job_role: "sales", manager_id: "supA" }),
    m("b1", { job_role: "sales", manager_id: "supB" }),
    m("hr", { job_role: "hr", level: 2, manager_id: "owner" }),
];
const byId = (id) => members.find((member) => member.id === id);

describe("KANTOONG ERP — hak lihat berlapis", () => {
    it("subtree mencakup bawahan langsung & tidak langsung", () => {
        expect([...subtreeIds(members, "mgr")].sort()).toEqual(["a1", "a2", "b1", "supA", "supB"]);
        expect([...subtreeIds(members, "supA")].sort()).toEqual(["a1", "a2"]);
        expect(subtreeIds(members, "a1").size).toBe(0);
    });

    it("sales hanya melihat dirinya sendiri, tidak bisa mengintip rekan", () => {
        expect(canView(byId("a1"), "a1", members)).toBe(true);
        expect(canView(byId("a1"), "a2", members)).toBe(false);
        expect(canView(byId("a1"), "b1", members)).toBe(false);
    });

    it("supervisor melihat timnya saja, bukan tim lain", () => {
        expect(canView(byId("supA"), "a2", members)).toBe(true);
        expect(canView(byId("supA"), "b1", members)).toBe(false);
    });

    it("manager melihat seluruh pohon di bawahnya; owner melihat semua", () => {
        expect(canView(byId("mgr"), "b1", members)).toBe(true);
        expect(canView(byId("owner"), "hr", members)).toBe(true);
    });

    it("target/komisi hanya diatur atasan, bukan diri sendiri", () => {
        expect(canManage(byId("a1"), "a1", members)).toBe(false);
        expect(canManage(byId("supA"), "a1", members)).toBe(true);
        expect(canManage(byId("supB"), "a1", members)).toBe(false);
    });

    it("gaji: hanya diri sendiri, HR, dan owner", () => {
        expect(canViewSalary(byId("a1"), "a1")).toBe(true);
        expect(canViewSalary(byId("supA"), "a1")).toBe(false);
        expect(canViewSalary(byId("mgr"), "a1")).toBe(false);
        expect(canViewSalary(byId("hr"), "a1")).toBe(true);
        expect(canViewSalary(byId("owner"), "a1")).toBe(true);
        expect(canEditSalary(byId("a1"))).toBe(false);
        expect(canEditSalary(byId("hr"))).toBe(true);
    });

    it("pengelola organisasi: direktur/owner/HR", () => {
        expect(isOrgAdmin(byId("hr"))).toBe(true);
        expect(isOrgAdmin(byId("mgr"))).toBe(false);
        expect(isOrgAdmin(byId("owner"))).toBe(true);
    });

    it("atasan tidak boleh diri sendiri atau bawahannya (anti-lingkaran)", () => {
        expect(isValidManager(members, "mgr", "mgr")).toBe(false);
        expect(isValidManager(members, "mgr", "a1")).toBe(false);
        expect(isValidManager(members, "a1", "supB")).toBe(true);
        expect(managerChain(members, "a1").map((member) => member.id)).toEqual(["supA", "mgr", "owner"]);
    });
});

describe("KANTOONG ERP — struktur & alamat toko", () => {
    const units = [
        { id: "co", parent_id: null, name: "PT", kind: "perusahaan" },
        { id: "s", parent_id: "co", name: "Sales", kind: "divisi" },
        { id: "bdg", parent_id: "s", name: "Tim Bandung", kind: "tim" },
    ];

    it("jalur unit tanpa nama perusahaan", () => {
        expect(unitPath(units, "bdg")).toBe("Sales › Tim Bandung");
        expect([...unitSubtreeIds(units, "s")].sort()).toEqual(["bdg", "s"]);
    });

    it("slug toko aman & valid", () => {
        expect(slugify("Budi Santoso")).toBe("budi-santoso");
        expect(slugify("Ádí")).toBe("adi");
        expect(isValidSlug("andi")).toBe(true);
        expect(isValidSlug("erp")).toBe(false);
        expect(isValidSlug("-andi")).toBe(false);
        expect(isValidSlug("An")).toBe(false);
    });
});

describe("KANTOONG ERP — angka penjualan otomatis", () => {
    const now = new Date("2026-11-03T05:00:00Z"); // 12:00 WIB
    const orders = [
        { sales_member_id: "a1", status: "selesai", total: 100000, created_at: "2026-11-03T01:00:00Z" },
        { sales_member_id: "a1", status: "menunggu_pembayaran", total: 999999, created_at: "2026-11-03T02:00:00Z" },
        { sales_member_id: "a2", status: "dibayar", total: 250000, created_at: "2026-11-03T03:00:00Z" },
        { sales_member_id: "b1", status: "dikirim", total: 50000, created_at: "2026-11-01T03:00:00Z" },
        { sales_member_id: "b1", status: "dibatalkan", total: 70000, created_at: "2026-11-03T03:00:00Z" },
    ];

    it("periode hari & bulan memakai jam WIB", () => {
        expect(periodStart("day", now).toISOString()).toBe("2026-11-02T17:00:00.000Z");
        expect(periodStart("month", now).toISOString()).toBe("2026-10-31T17:00:00.000Z");
    });

    it("hanya pesanan dibayar yang dihitung omzet", () => {
        const today = salesTotals(orders, periodStart("day", now));
        expect(today.get("a1")).toEqual({ omzet: 100000, count: 1 });
        expect(today.get("b1")).toBeUndefined();
        expect(sumOrders(orders, periodStart("month", now)).omzet).toBe(400000);
    });

    it("papan peringkat: urutan untuk semua, angka rekan disembunyikan", () => {
        const board = leaderboard({ members, orders, period: "day", viewer: byId("a1"), now });
        expect(board.map((row) => row.member_id)).toEqual(["a2", "a1", "b1"]);
        expect(board[0]).toMatchObject({ rank: 1, omzet: null, is_me: false });
        expect(board[1]).toMatchObject({ rank: 2, omzet: 100000, is_me: true });
    });

    it("papan peringkat bulanan terlihat penuh oleh owner", () => {
        const board = leaderboard({ members, orders, period: "month", viewer: byId("owner"), now });
        expect(board.find((row) => row.member_id === "b1").omzet).toBe(50000);
    });

    it("komisi & capaian target", () => {
        expect(commission(1_000_000, 2.5)).toBe(25000);
        expect(progress(750000, 1000000)).toBe(75);
        expect(progress(100, 0)).toBeNull();
    });

    it("deret omzet harian berisi tanggal WIB berurutan", () => {
        const series = dailySeries(orders, 3, now);
        expect(series.map((point) => point.date)).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
        expect(series[2].omzet).toBe(350000);
    });
});

describe("KANTOONG ERP — menu sesuai jabatan", () => {
    it("sales tidak melihat Ringkasan Owner & Organisasi", () => {
        const keys = modulesFor(byId("a1")).map((module) => module.key);
        expect(keys).toContain("sales");
        expect(keys).not.toContain("cockpit");
        expect(keys).not.toContain("org");
    });

    it("owner bisa membatasi modul per orang, Ruang Kerjaku selalu ada", () => {
        const keys = modulesFor({ ...byId("supA"), modules: ["team"] }).map((module) => module.key);
        expect(keys).toEqual(["workspace", "team"]);
    });
});

describe("KANTOONG ERP — data demo", () => {
    it("data contoh konsisten & setiap sales punya toko", () => {
        const seed = buildDemoSeed([], new Date("2026-11-03T05:00:00Z"));
        const sellers = seed.members.filter((member) => member.job_role === "sales");
        expect(sellers.length).toBe(4);
        expect(seed.storefronts.length).toBe(4);
        expect(seed.orders.every((order) => sellers.some((member) => member.id === order.sales_member_id))).toBe(true);
        expect(buildDemoSeed([], new Date("2026-11-03T05:00:00Z")).orders.length).toBe(seed.orders.length);
    });
});

/**
 * KANTOONG ERP PRO — DATA CONTOH (MODE DEMO)
 * File: frontend/erp/data/demo-seed-pro.js
 *
 * Ditambahkan ke data demo lama tanpa menghapusnya (ensureProSeed idempoten):
 * aturan persetujuan, tagihan piutang/hutang, anggaran, batch kedaluwarsa,
 * cuti, kontrak, penilaian kinerja, dan calon pelanggan (pipeline CRM).
 * Semua nama & angka FIKTIF.
 */

import { DEFAULT_RULES, buildChain } from "../core/approval-chain.js";

const DAY = 86400000;
const day = (now, offset) => new Date(now.getTime() + offset * DAY).toISOString().slice(0, 10);
const iso = (now, offsetDays, hour = 9) => {
    const d = new Date(now.getTime() + offsetDays * DAY);
    d.setUTCHours(hour - 7, 0, 0, 0);
    return d.toISOString();
};

/** Pengajuan lama (sebelum Pro) diberi rantai satu langkah agar tampil seragam. */
export function normalizeApproval(item) {
    if (Array.isArray(item.chain)) return item;
    const decided = item.status && item.status !== "menunggu";
    return {
        ...item,
        chain: [{
            step: "atasan",
            approver_id: item.approver_id,
            original_id: item.approver_id,
            decision: decided ? item.status : null,
            note: decided ? item.decision_note : null,
            at: decided ? item.decided_at : null,
        }],
    };
}

export function ensureProSeed(db, now = new Date()) {
    if (!db || db.pro?.version === 2) return false;
    const members = db.members || [];
    const has = (id) => members.some((m) => m.id === id);
    const pick = (...ids) => ids.find(has) || "m-owner";
    const products = db.products || [];
    const period = day(now, 0).slice(0, 7);

    db.approvals = (db.approvals || []).filter((a) => !String(a.id).startsWith("a-pro-")).map(normalizeApproval);

    // Satu pengajuan besar yang sedang berjalan di langkah ke-2 (keuangan) agar rantai terlihat.
    const big = {
        id: "a-pro-1", kind: "pengeluaran", title: "Beli mesin espresso outlet Bandung",
        amount: 18_500_000, note: "Mesin lama sering mati saat jam ramai.",
        requester_id: pick("m-budi"), status: "menunggu", decision_note: null,
        created_at: iso(now, -2), decided_at: null,
        ...buildChain({ kind: "pengeluaran", amount: 18_500_000, requester_id: pick("m-budi") }, { members, now }),
    };
    if (big.chain.length > 1) {
        big.chain[0] = { ...big.chain[0], decision: "disetujui", note: "Setuju, sudah 3x rusak bulan ini.", at: iso(now, -1, 10), decided_by: big.chain[0].approver_id };
    }
    big.approver_id = big.chain.find((s) => !s.decision)?.approver_id ?? null;

    const po = {
        id: "a-pro-2", kind: "po", title: "PO biji kopi 40 kg (Supplier Arabika Jaya)",
        amount: 7_200_000, note: "Stok biji kopi tinggal 4 hari.",
        requester_id: pick("m-joko"), status: "menunggu", decision_note: null,
        created_at: iso(now, 0, 8), decided_at: null,
        ...buildChain({ kind: "po", amount: 7_200_000, requester_id: pick("m-joko") }, { members, now }),
    };
    po.approver_id = po.chain[0]?.approver_id ?? null;
    db.approvals.push(big, po);

    db.pro = {
        version: 2,
        rules: DEFAULT_RULES.map((r) => ({ ...r, steps: [...r.steps] })),
        delegations: [],
        invoices: [
            { id: "inv-1", direction: "piutang", party: "Kafe Senja (grosir)", number: "INV-2026-101", amount: 12_400_000, paid: 0, issued_at: day(now, -52), due_date: day(now, -22), status: "terbuka" },
            { id: "inv-2", direction: "piutang", party: "Hotel Asri Bandung", number: "INV-2026-108", amount: 8_750_000, paid: 3_000_000, issued_at: day(now, -20), due_date: day(now, -5), status: "sebagian" },
            { id: "inv-3", direction: "piutang", party: "PT Kantor Maju (katering)", number: "INV-2026-115", amount: 5_600_000, paid: 0, issued_at: day(now, -6), due_date: day(now, 9), status: "terbuka" },
            { id: "inv-4", direction: "piutang", party: "Koperasi Karyawan Sejahtera", number: "INV-2026-117", amount: 3_150_000, paid: 0, issued_at: day(now, -2), due_date: day(now, 21), status: "terbuka" },
            { id: "inv-5", direction: "hutang", party: "Supplier Arabika Jaya", number: "SUP-8812", amount: 9_800_000, paid: 0, issued_at: day(now, -28), due_date: day(now, 2), status: "terbuka" },
            { id: "inv-6", direction: "hutang", party: "CV Susu Segar Lembang", number: "SUP-2207", amount: 4_200_000, paid: 0, issued_at: day(now, -10), due_date: day(now, 12), status: "terbuka" },
            { id: "inv-7", direction: "hutang", party: "Toko Kemasan Prima", number: "SUP-0931", amount: 1_850_000, paid: 1_850_000, issued_at: day(now, -40), due_date: day(now, -10), status: "lunas" },
        ],
        recurring: [
            { id: "rc-1", label: "Gaji karyawan", amount: -42_000_000, day: 25 },
            { id: "rc-2", label: "Sewa outlet", amount: -8_500_000, day: 1 },
            { id: "rc-3", label: "Rata-rata penjualan harian ×7", amount: 31_000_000, day: 7 },
            { id: "rc-4", label: "Rata-rata penjualan harian ×7", amount: 31_000_000, day: 14 },
            { id: "rc-5", label: "Rata-rata penjualan harian ×7", amount: 31_000_000, day: 21 },
            { id: "rc-6", label: "Rata-rata penjualan harian ×7", amount: 31_000_000, day: 28 },
        ],
        budgets: [
            { id: "bg-1", account_code: "6-1200", label: "Operasional", period, amount: 6_000_000 },
            { id: "bg-2", account_code: "6-1300", label: "Pemasaran", period, amount: 2_500_000 },
            { id: "bg-3", account_code: "6-1100", label: "Komisi sales", period, amount: 4_000_000 },
        ],
        batches: products.slice(0, 4).flatMap((p, i) => [
            { id: `bt-${i}-a`, product_id: String(p.id), warehouse_id: "w-pusat", lot: `LOT-${2611 + i}A`, qty: 6 + i * 2, expires_on: day(now, i === 0 ? -1 : 3 + i * 2) },
            { id: `bt-${i}-b`, product_id: String(p.id), warehouse_id: "w-pusat", lot: `LOT-${2611 + i}B`, qty: 20 + i * 5, expires_on: day(now, 45 + i * 10) },
        ]),
        leaves: [
            { id: "lv-1", member_id: pick("m-tono"), kind: "tahunan", starts: day(now, -40), ends: day(now, -38), days: 3, status: "disetujui", reason: "Pulang kampung", approval_id: null },
            { id: "lv-2", member_id: pick("m-sari"), kind: "sakit", starts: day(now, 0), ends: day(now, 1), days: 2, status: "disetujui", reason: "Demam (surat dokter)", approval_id: null },
        ],
        contracts: [
            { id: "ct-1", member_id: pick("m-andi"), type: "pkwt", starts_on: day(now, -340), ends_on: day(now, 18), probation_ends_on: null, salary_note: "" },
            { id: "ct-2", member_id: pick("m-maya"), type: "pkwt", starts_on: day(now, -80), ends_on: day(now, 285), probation_ends_on: day(now, 9), salary_note: "" },
            { id: "ct-3", member_id: pick("m-dimas"), type: "pkwtt", starts_on: day(now, -900), ends_on: null, probation_ends_on: null, salary_note: "" },
            { id: "ct-4", member_id: pick("m-dewi"), type: "pkwt", starts_on: day(now, -370), ends_on: day(now, -3), probation_ends_on: null, salary_note: "" },
        ],
        reviews: [
            { id: "rv-1", member_id: pick("m-andi"), period: "2026-H2", reviewer_id: pick("m-budi"), scores: { kehadiran: 5, target: 4, kualitas: 4, kerjasama: 5, inisiatif: 4 }, note: "Konsisten, pelanggan grosir naik.", created_at: iso(now, -12) },
            { id: "rv-2", member_id: pick("m-sari"), period: "2026-H2", reviewer_id: pick("m-budi"), scores: { kehadiran: 3, target: 3, kualitas: 4, kerjasama: 4, inisiatif: 2 }, note: "Perlu lebih aktif mencari prospek.", created_at: iso(now, -12) },
        ],
        deals: [
            { id: "dl-1", title: "Langganan kopi kantor 3 lantai", customer: "PT Kantor Maju", value: 24_000_000, stage: "negosiasi", owner_id: pick("m-andi"), next_action: "Kirim revisi harga paket bulanan", next_action_at: iso(now, -1, 10), created_at: iso(now, -20), updated_at: iso(now, -2), lost_reason: null },
            { id: "dl-2", title: "Katering rapat bulanan", customer: "Dinas Pariwisata", value: 9_500_000, stage: "penawaran", owner_id: pick("m-sari"), next_action: "Telepon tanyakan keputusan", next_action_at: iso(now, 0, 14), created_at: iso(now, -9), updated_at: iso(now, -3), lost_reason: null },
            { id: "dl-3", title: "Reseller Cimahi", customer: "Toko Berkah", value: 6_000_000, stage: "prospek", owner_id: pick("m-tono"), next_action: "", next_action_at: null, created_at: iso(now, -18), updated_at: iso(now, -15), lost_reason: null },
            { id: "dl-4", title: "Kopi untuk 2 cabang gym", customer: "FitZone", value: 14_000_000, stage: "dihubungi", owner_id: pick("m-maya"), next_action: "Sampel gratis ke cabang Dago", next_action_at: iso(now, 3, 10), created_at: iso(now, -6), updated_at: iso(now, -1), lost_reason: null },
            { id: "dl-5", title: "Hampers Lebaran 200 pcs", customer: "Bank Daerah", value: 30_000_000, stage: "menang", owner_id: pick("m-dimas"), next_action: "", next_action_at: null, created_at: iso(now, -60), updated_at: iso(now, -30), lost_reason: null },
            { id: "dl-6", title: "Kopi event kampus", customer: "BEM Universitas", value: 3_500_000, stage: "kalah", owner_id: pick("m-sari"), next_action: "", next_action_at: null, created_at: iso(now, -40), updated_at: iso(now, -25), lost_reason: "Harga lebih mahal dari pesaing" },
        ],
    };

    // Beban bulan ini agar anggaran terlihat terpakai (hanya bila jurnal demo ada).
    if (Array.isArray(db.journal)) {
        db.journal = db.journal.filter((entry) => !String(entry.id).startsWith("j-pro-"));
        const add = (code, amount, memo, offset) => db.journal.push({
            id: `j-pro-${code}-${offset}`, entry_date: day(now, offset), memo, source: "pengeluaran", ref: null,
            created_by: pick("m-fajar"), created_at: iso(now, offset),
            lines: [{ account_code: code, debit: amount, credit: 0 }, { account_code: "1-1100", debit: 0, credit: amount }],
        });
        if (Number(day(now, 0).slice(8)) >= 3) {
            add("6-1300", 2_750_000, "Iklan media sosial bulan ini", -2);
            add("6-1200", 3_100_000, "Listrik, air & internet outlet", -1);
        }
    }
    return true;
}

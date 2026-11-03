/**
 * KANTOONG ERP — DATA CONTOH (MODE DEMO)
 * File: frontend/erp/data/demo-seed.js
 *
 * Perusahaan contoh untuk presentasi & uji coba sebelum database siap.
 * Semua nama & angka FIKTIF dan ditandai "DATA CONTOH" di tampilan.
 * Pesanan dibuat dengan pembangkit acak ber-seed agar selalu sama.
 */

import { extendSeedPhase2 } from "./demo-seed-phase2.js";
import { enrichOrdersPhase3, extendSeedPhase3 } from "./demo-seed-phase3.js";

const SAMPLE_PRODUCTS = [
    { id: "demo-p1", name: "Produk Contoh A", price: 15000, category: "Minuman" },
    { id: "demo-p2", name: "Produk Contoh B", price: 20000, category: "Minuman" },
    { id: "demo-p3", name: "Produk Contoh C", price: 7000, category: "Makanan" },
    { id: "demo-p4", name: "Produk Contoh D", price: 25000, category: "Paket" },
];

const CITIES = ["Bandung", "Jakarta Selatan", "Bekasi", "Bogor", "Depok", "Cimahi", "Tangerang"];
const BUYERS = ["Rani", "Dewi", "Agus", "Fajar", "Nina", "Yusuf", "Lia", "Bayu", "Citra", "Eko", "Putri", "Hendra"];

function prng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function buildDemoSeed(realProducts = [], now = new Date()) {
    const products = (realProducts.length ? realProducts : SAMPLE_PRODUCTS).map((product, index) => ({
        ...product,
        id: String(product.id),
        name: product.name,
        price: Number(product.price) || 0,
        category: product.category || "Umum",
        image_url: product.image_url || "",
        sku: product.sku || `SKU-${String(index + 1).padStart(4, "0")}`,
        barcode: product.barcode || `899${String(1000000000 + index * 7919).slice(0, 10)}`,
        stock: Number(product.stock) || 20 + index * 7,
    }));

    const units = [
        { id: "u-co", parent_id: null, name: "Perusahaan Demo", kind: "perusahaan", sort: 0 },
        { id: "u-sales", parent_id: "u-co", name: "Sales", kind: "divisi", sort: 1 },
        { id: "u-bdg", parent_id: "u-sales", name: "Tim Bandung", kind: "tim", sort: 1 },
        { id: "u-jkt", parent_id: "u-sales", name: "Tim Jakarta", kind: "tim", sort: 2 },
        { id: "u-prod", parent_id: "u-co", name: "Produk & Gudang", kind: "divisi", sort: 2 },
        { id: "u-fin", parent_id: "u-co", name: "Keuangan", kind: "divisi", sort: 3 },
        { id: "u-hr", parent_id: "u-co", name: "HR", kind: "divisi", sort: 4 },
    ];

    const member = (id, full_name, extra) => ({
        id,
        user_id: null,
        email: `${id.slice(2)}@contoh.kantoong.id`,
        full_name,
        org_unit_id: "u-co",
        position_title: "Staf",
        level: 1,
        job_role: "umum",
        manager_id: null,
        modules: null,
        sales_slug: null,
        is_active: true,
        ...extra,
    });

    const members = [
        member("m-owner", "Owner Demo", { position_title: "Owner", level: 5 }),
        member("m-dimas", "Dimas Pratama", { position_title: "Manager Sales", level: 3, org_unit_id: "u-sales", manager_id: "m-owner" }),
        member("m-budi", "Budi Santoso", { position_title: "Supervisor Bandung", level: 2, org_unit_id: "u-bdg", manager_id: "m-dimas" }),
        member("m-rina", "Rina Wijaya", { position_title: "Supervisor Jakarta", level: 2, org_unit_id: "u-jkt", manager_id: "m-dimas" }),
        member("m-andi", "Andi Saputra", { position_title: "Sales", job_role: "sales", org_unit_id: "u-bdg", manager_id: "m-budi", sales_slug: "andi" }),
        member("m-sari", "Sari Lestari", { position_title: "Sales", job_role: "sales", org_unit_id: "u-bdg", manager_id: "m-budi", sales_slug: "sari" }),
        member("m-tono", "Tono Hidayat", { position_title: "Sales", job_role: "sales", org_unit_id: "u-jkt", manager_id: "m-rina", sales_slug: "tono" }),
        member("m-maya", "Maya Putri", { position_title: "Sales", job_role: "sales", org_unit_id: "u-jkt", manager_id: "m-rina", sales_slug: "maya" }),
        member("m-lina", "Lina Marlina", { position_title: "Staf Katalog", job_role: "produk", org_unit_id: "u-prod", manager_id: "m-owner" }),
        member("m-wati", "Wati Rahayu", { position_title: "Kepala HR", level: 2, job_role: "hr", org_unit_id: "u-hr", manager_id: "m-owner" }),
    ];

    const salesProfile = {
        "m-andi": { rate: 2.5, target: 15000000, weight: 1.15 },
        "m-sari": { rate: 3, target: 12000000, weight: 0.9 },
        "m-tono": { rate: 2, target: 18000000, weight: 1.3 },
        "m-maya": { rate: 3, target: 10000000, weight: 0.75 },
    };

    const targets = Object.entries(salesProfile).map(([member_id, profile]) => ({
        member_id,
        commission_rate: profile.rate,
        monthly_target: profile.target,
        daily_target: Math.round(profile.target / 26 / 1000) * 1000,
    }));

    const salaries = members.map((entry) => ({
        member_id: entry.id,
        base_salary: { 5: 0, 3: 9000000, 2: 7000000, 1: 4800000 }[entry.level] ?? 4800000,
    }));

    const storefronts = members
        .filter((entry) => entry.job_role === "sales")
        .map((entry) => ({
            member_id: entry.id,
            slug: entry.sales_slug,
            display_name: `Toko ${entry.full_name.split(" ")[0]}`,
            tagline: "Pesan lewat aku, dikirim langsung dari gudang pusat.",
            hero_image_url: "",
            theme: {},
            is_published: true,
        }));

    // Pesanan 40 hari terakhir, dibagi ke 4 sales.
    const random = prng(20261103);
    const orders = [];
    const dayMs = 86400000;
    let serial = 1;

    for (let day = 39; day >= 0; day -= 1) {
        for (const [memberId, profile] of Object.entries(salesProfile)) {
            const count = Math.floor(random() * 3.2 * profile.weight);

            for (let n = 0; n < count; n += 1) {
                const isToday = day === 0;
                const created = new Date(now.getTime() - day * dayMs - Math.floor(random() * (isToday ? 6 : 20)) * 3600000);
                const lines = 1 + Math.floor(random() * 3);
                let total = 0;
                const items = [];

                for (let l = 0; l < lines; l += 1) {
                    const product = products[Math.floor(random() * products.length)];
                    const qty = 1 + Math.floor(random() * 4);
                    total += product.price * qty;
                    items.push({ product_id: product.id, product_name: product.name, qty, unit_price: product.price });
                }

                const roll = random();
                const status = day <= 1 && roll < 0.25
                    ? "menunggu_pembayaran"
                    : roll < 0.05 ? "dibatalkan" : day <= 3 ? "diproses" : "selesai";

                orders.push({
                    id: `o-${serial}`,
                    order_code: `DEMO-${String(serial).padStart(5, "0")}`,
                    status,
                    total: total + 15000,
                    created_at: created.toISOString(),
                    sales_member_id: memberId,
                    storefront_slug: members.find((entry) => entry.id === memberId).sales_slug,
                    customer_name: BUYERS[Math.floor(random() * BUYERS.length)],
                    city: CITIES[Math.floor(random() * CITIES.length)],
                    items,
                });
                serial += 1;
            }
        }
    }

    // Target demo mengikuti rata-rata omzet tiap sales (+10%) agar wajar
    // untuk harga produk apa pun (produk asli Supabase atau contoh).
    for (const target of targets) {
        const paid = orders.filter((order) =>
            order.sales_member_id === target.member_id && !["menunggu_pembayaran", "dibatalkan"].includes(order.status)
        );
        const perDay = paid.reduce((sum, order) => sum + order.total, 0) / 40;
        target.monthly_target = Math.max(100000, Math.round((perDay * 30 * 1.1) / 10000) * 10000);
        target.daily_target = Math.max(10000, Math.round((perDay * 1.1) / 1000) * 1000);
    }

    const iso = (hoursAgo) => new Date(now.getTime() - hoursAgo * 3600000).toISOString();

    const approvals = [
        {
            id: "a-1", kind: "diskon", title: "Diskon 10% untuk pelanggan grosir (40 botol)",
            amount: 60000, note: "Pelanggan langganan, minta harga khusus.",
            requester_id: "m-andi", approver_id: "m-budi", status: "menunggu",
            decision_note: null, created_at: iso(5), decided_at: null,
        },
        {
            id: "a-2", kind: "cuti", title: "Cuti 1 hari (acara keluarga)",
            amount: null, note: "Tanggal 12 bulan ini.",
            requester_id: "m-tono", approver_id: "m-rina", status: "disetujui",
            decision_note: "Silakan, titip pelanggan ke Maya.", created_at: iso(30), decided_at: iso(26),
        },
        {
            id: "a-3", kind: "pengeluaran", title: "Biaya cetak brosur toko",
            amount: 150000, note: null,
            requester_id: "m-sari", approver_id: "m-budi", status: "menunggu",
            decision_note: null, created_at: iso(2), decided_at: null,
        },
    ];

    const audit = [
        { id: 1, actor_id: "m-owner", table_name: "member_targets", record_id: "m-tono", action: "UPDATE", changes: { monthly_target: { dari: 15000000, jadi: 18000000 } }, at: iso(48) },
        { id: 2, actor_id: "m-wati", table_name: "members", record_id: "m-maya", action: "INSERT", changes: { full_name: "Maya Putri", position_title: "Sales" }, at: iso(240) },
    ];

    // Urutan penting: pesanan dilengkapi (voucher, HP, status kirim) dulu,
    // lalu Fase 2 membuat jurnal, lalu Fase 3 menambah PO, tiket, CRM.
    return extendSeedPhase3(extendSeedPhase2(enrichOrdersPhase3({
        version: DEMO_VERSION,
        created_at: now.toISOString(),
        units,
        members,
        targets,
        salaries,
        storefronts,
        storefront_products: [],
        products,
        orders,
        approvals,
        audit,
    }, now), now), now);
}

/** Naikkan bila bentuk data demo berubah (data lama di perangkat diganti). */
export const DEMO_VERSION = 6;

/** Persona yang bisa dipilih di layar masuk demo (untuk menunjukkan batas akses). */
export const DEMO_PERSONAS = Object.freeze([
    { id: "m-owner", label: "Owner", note: "melihat seluruh perusahaan" },
    { id: "m-dimas", label: "Manager Sales", note: "melihat 2 tim di bawahnya" },
    { id: "m-budi", label: "Supervisor Bandung", note: "melihat Andi & Sari saja" },
    { id: "m-andi", label: "Sales Andi", note: "hanya melihat datanya sendiri" },
    { id: "m-wati", label: "HR", note: "absensi, anggota & payroll" },
    { id: "m-fajar", label: "Keuangan", note: "jurnal, laba rugi & neraca" },
    { id: "m-joko", label: "Staf Gudang", note: "stok, mutasi & opname" },
    { id: "m-dewi", label: "Kasir Outlet", note: "jualan di kasir POS" },
    { id: "m-nadia", label: "Customer Service", note: "tiket keluhan & retur" },
    { id: "m-reza", label: "Marketing", note: "voucher & data pelanggan" },
    { id: "m-lina", label: "Staf Katalog", note: "mengatur kode barang" },
]);

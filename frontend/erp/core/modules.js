/**
 * KANTOONG ERP — DAFTAR MODUL (DASHBOARD)
 * File: frontend/erp/core/modules.js
 *
 * Satu "mesin dashboard" + modul. Menu tiap orang dihitung dari
 * jabatan (level) & peran kerja (job_role). Owner bisa membatasi modul
 * per orang lewat kolom members.modules.
 *
 * Untuk klien baru: aktifkan/nonaktifkan modul di ERP_CONFIG.enabled.
 */

import { hasRole, isOrgAdmin } from "./org.js";

export const MODULES = Object.freeze([
    {
        key: "workspace",
        label: "Ruang Kerjaku",
        hint: "Dashboard, target, komisi & gajiku",
        icon: "M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z",
        allow: () => true,
    },
    {
        key: "cockpit",
        label: "Ringkasan Owner",
        hint: "Seluruh perusahaan dalam satu layar",
        icon: "M4 20V10M10 20V4M16 20v-7M22 20H2",
        allow: (member) => member.level >= 4,
    },
    {
        key: "sales",
        label: "Tokoku & Penjualan",
        hint: "Toko online-ku, pesanan & peringkat",
        icon: "M4 7h16l-1.5 12h-13zM9 7a3 3 0 0 1 6 0",
        allow: (member) => member.job_role === "sales",
    },
    {
        key: "team",
        label: "Tim & Target",
        hint: "Performa bawahan, target & komisi",
        icon: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M16 14a5 5 0 0 1 6 6",
        allow: (member) => member.level >= 2,
    },
    {
        key: "catalog",
        label: "Katalog Master",
        hint: "Kode barang, barcode & stok",
        icon: "M4 6h16M4 12h16M4 18h10M18 16v6M15 19h6",
        allow: () => true,
    },
    {
        key: "approvals",
        label: "Persetujuan & Audit",
        hint: "Pengajuan, keputusan atasan, jejak perubahan",
        icon: "M9 12l2 2 4-4M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z",
        allow: () => true,
    },
    {
        key: "inventory",
        label: "Gudang & Stok",
        hint: "Stok per gudang/outlet, mutasi & opname",
        icon: "M3 9l9-5 9 5v11H3zM8 20v-6h8v6M3 9h18",
        allow: (member) => member.level >= 3 || hasRole(member, "gudang", "produk", "kasir"),
    },
    {
        key: "pos",
        label: "Kasir POS",
        hint: "Penjualan toko offline / F&B",
        icon: "M4 4h16v10H4zM8 18h8M12 14v4M7 8h4",
        allow: (member) => hasRole(member, "kasir"),
    },
    {
        key: "finance",
        label: "Keuangan & Akuntansi",
        hint: "Jurnal, laba rugi & neraca",
        icon: "M12 3v18M17 7.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2.2 2.6 5 3 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3",
        allow: (member) => hasRole(member, "keuangan"),
    },
    {
        key: "hr",
        label: "HR & Absensi",
        hint: "Absen masuk/pulang & rekap kehadiran",
        icon: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
        allow: () => true,
    },
    {
        key: "payroll",
        label: "Payroll",
        hint: "Slip gaji & pembayaran gaji",
        icon: "M3 7h18v12H3zM3 11h18M7 15h4",
        allow: () => true,
    },
    {
        key: "org",
        label: "Organisasi & Akses",
        hint: "Divisi, tim, jabatan & hak akses",
        icon: "M10 3h4v4h-4zM12 7v2M6 11V9h12v2M4 11h4v4H4zM10 11h4v4h-4zM16 11h4v4h-4z",
        allow: (member) => isOrgAdmin(member) || member.level >= 3,
    },
]);

/** Modul tahap berikutnya: tampil abu-abu "Segera" agar peta ERP terlihat utuh. */
export const UPCOMING_MODULES = Object.freeze([
    { key: "purchasing", label: "Pembelian", phase: 3 },
    { key: "logistics", label: "Logistik & Pengiriman", phase: 3 },
    { key: "cs", label: "Customer Service", phase: 3 },
    { key: "marketing", label: "Marketing", phase: 3 },
    { key: "crm", label: "CRM Pelanggan", phase: 3 },
    { key: "production", label: "Produksi", phase: 4 },
    { key: "research", label: "AI Research & Second Brain", phase: 4 },
]);

/** Modul yang boleh dibuka seseorang (urutan sesuai MODULES). */
export function modulesFor(member, enabled = null) {
    if (!member) return [];

    return MODULES.filter((module) => {
        if (enabled && !enabled.includes(module.key)) return false;
        if (!module.allow(member)) return false;
        if (module.key === "workspace") return true;
        return !Array.isArray(member.modules) || member.modules.includes(module.key);
    });
}

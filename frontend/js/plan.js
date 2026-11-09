/**
 * KANTOONG — PAKET LAYANAN (Pro · WEB AI BOS FREE) + INDUSTRI
 * File: frontend/js/plan.js
 *
 * Diatur per klien di client-config.js:
 *   package:  "pro"  = semua fitur (commerce, ERP penuh, kasir, dashboard lengkap)
 *             "free" = WEB AI BOS FREE: katalog + AI gratis. TANPA keranjang/checkout
 *                      (pesan lewat WhatsApp), TANPA kasir, ERP hanya untuk
 *                      mengelola katalog & etalase.
 *   industry: "umum" | "properti" | "emas"
 *
 * Paket = kontrak, bukan pengaturan admin: admin klien TIDAK bisa membuka fitur Pro.
 * Hanya di web template (erp_demo: true) pemilik Kantoong bisa mencoba paket lain
 * (pratinjau, tersimpan di browser ini saja).
 */

import CFG from "../client-config.js";
import { industryOf } from "./industry.js";

export const PLAN_PREVIEW_KEY = "kantoong:plan-preview";

export const PACKAGES = Object.freeze({
    pro: {
        label: "Kantoong Pro",
        commerce: true,
        pos: true,
        erpModules: null, // null = semua modul sesuai jabatan
        dashboardFeatures: null, // null = semua fitur sesuai kontrak
    },
    free: {
        label: "WEB AI BOS FREE",
        commerce: false,
        pos: false,
        // ERP ringkas: kelola produk, etalase, akun & tim.
        erpModules: ["workspace", "catalog", "storefront", "org"],
        dashboardFeatures: ["profile", "product-catalog", "wishlist", "ai-chat-history", "customer-support", "store-map", "settings", "clock", "calendar"],
    },
});

function readPreview() {
    if (CFG?.erp_demo !== true) return null;
    try {
        return JSON.parse(localStorage.getItem(PLAN_PREVIEW_KEY) || "null");
    } catch {
        return null;
    }
}

/** Paket & industri yang berlaku sekarang. */
export function getPlan() {
    const preview = readPreview();
    const pkg = PACKAGES[preview?.package] ? preview.package : PACKAGES[CFG?.package] ? CFG.package : "pro";
    const industry = industryOf(preview?.industry ?? CFG?.industry ?? "umum");
    return { package: pkg, industry, preview: Boolean(preview), ...PACKAGES[pkg] };
}

/** Hanya untuk web template: coba paket/industri lain di browser ini. */
export function setPlanPreview(next) {
    if (CFG?.erp_demo !== true) return false;
    try {
        if (next) localStorage.setItem(PLAN_PREVIEW_KEY, JSON.stringify(next));
        else localStorage.removeItem(PLAN_PREVIEW_KEY);
    } catch {
        return false;
    }
    return true;
}

export function featureAllowed(featureId) {
    const list = getPlan().dashboardFeatures;
    return !list || list.includes(featureId);
}

export function erpModuleAllowed(key) {
    const list = getPlan().erpModules;
    return !list || list.includes(key);
}

/** Tandai <html> agar CSS bisa menyembunyikan tombol keranjang dll. */
export function markPlan() {
    if (typeof document === "undefined") return;
    const plan = getPlan();
    document.documentElement.dataset.plan = plan.package;
    document.documentElement.dataset.industry = plan.industry;
    document.documentElement.dataset.commerce = plan.commerce ? "on" : "off";
}

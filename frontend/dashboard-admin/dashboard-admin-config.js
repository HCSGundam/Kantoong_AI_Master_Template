/**
 * KANTOONG CORE — DASHBOARD ADMIN CONFIG
 * File: frontend/dashboard-admin/dashboard-admin-config.js
 */

import CFG from "../client-config.js";

export const ADMIN_CONFIG = Object.freeze({
    businessId: CFG?.business_id ?? "master_template_001",

    tables: Object.freeze({
        products: "products",
    }),

    storage: Object.freeze({
        bucket: "product-images",
        maxFileBytes: 3 * 1024 * 1024,
        allowedTypes: Object.freeze([
            "image/jpeg",
            "image/png",
            "image/webp",
        ]),
    }),

    /** Hero slider menampilkan maksimal sekian produk. */
    maxHeroSlides: 5,

    homepageUrl: "../index.html",
});

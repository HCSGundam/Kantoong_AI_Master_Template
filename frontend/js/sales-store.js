/**
 * KANTOONG — TOKO PER SALES (sisi pembeli)
 * File: frontend/js/sales-store.js
 *
 * - Membaca alamat toko: kantoong.id/nama-sales (atau ?toko=nama-sales).
 *   Nanti: nama-sales.kantoong.id (subdomain).
 * - Mengambil data toko sales (nama, slogan, pilihan produk & foto versinya).
 * - Mengingat sales perujuk selama 30 hari agar pesanan tercatat atas
 *   namanya (dipakai keranjang saat checkout lewat create_order_v2).
 *
 * Tidak memakai fingerprinting: hanya kode toko yang dikunjungi pembeli.
 */

import { supabase } from "./supabase-client.js";

const REF_KEY = "kantoong_sales_ref";
const REF_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{1,30})[a-z0-9]$/;
const RESERVED = new Set([
    "index", "index.html", "erp", "auth", "cart", "css", "js", "db", "api",
    "dashboard-admin", "dashboard-user", "assets", "admin", "login", "produk",
]);

export function isStoreSlug(value) {
    const slug = String(value ?? "").toLowerCase();
    return SLUG_PATTERN.test(slug) && !RESERVED.has(slug);
}

/** Slug dari alamat: /andi, ?toko=andi, atau subdomain andi.kantoong.id. */
export function detectStoreSlug(loc = window.location) {
    const fromQuery = new URLSearchParams(loc.search).get("toko");
    if (isStoreSlug(fromQuery)) return fromQuery.toLowerCase();

    const segment = loc.pathname.split("/").filter(Boolean)[0] || "";
    if (isStoreSlug(segment)) return segment.toLowerCase();

    const [sub, ...rest] = loc.hostname.split(".");
    if (rest.join(".") === "kantoong.id" && isStoreSlug(sub) && sub !== "www") return sub;

    return "";
}

export function rememberSalesRef(slug) {
    try {
        localStorage.setItem(REF_KEY, JSON.stringify({ slug, at: Date.now() }));
    } catch {
        // Penyimpanan diblokir: atribusi hanya berlaku selama halaman terbuka.
    }
}

/** Sales perujuk yang masih berlaku (maks 30 hari), atau "". */
export function getSalesRef() {
    try {
        const saved = JSON.parse(localStorage.getItem(REF_KEY) || "null");
        if (saved && isStoreSlug(saved.slug) && Date.now() - saved.at < REF_TTL_MS) return saved.slug;
    } catch {
        // kosong / rusak
    }
    return "";
}

/** Data toko sales (atau null bila tidak ada / database ERP belum dipasang). */
export async function loadSalesStore(slug) {
    if (!slug) return null;

    try {
        const { data: store, error } = await supabase
            .from("storefronts")
            .select("member_id, slug, display_name, tagline, hero_image_url, theme, is_published")
            .eq("slug", slug)
            .eq("is_published", true)
            .maybeSingle();

        if (error || !store) return null;

        const { data: picks } = await supabase
            .from("storefront_products")
            .select("product_id, custom_image_url, sort")
            .eq("member_id", store.member_id)
            .order("sort");

        return { ...store, products: picks || [] };
    } catch {
        return null;
    }
}

/**
 * Terapkan pilihan produk sales: kosong = semua produk katalog master.
 * Kode barang & harga tetap dari katalog; hanya foto boleh versi sales.
 */
export function applyStoreProducts(products, store) {
    if (!store?.products?.length) return products;

    const picks = new Map(store.products.map((item) => [String(item.product_id), item]));

    return products
        .filter((product) => picks.has(String(product.id)))
        .sort((a, b) => (picks.get(String(a.id)).sort ?? 0) - (picks.get(String(b.id)).sort ?? 0))
        .map((product) => {
            const custom = picks.get(String(product.id)).custom_image_url;
            return custom ? { ...product, image_url: custom } : product;
        });
}

/**
 * KANTOONG — KOLOM PRODUK YANG BOLEH DIBACA PUBLIK
 * File: frontend/js/product-columns.js
 *
 * Keamanan (db/security-hardening.sql): harga modal `cost_price` TIDAK boleh dibaca
 * pengunjung/kompetitor/bot. Database hanya memberi izin baca per kolom, jadi
 * semua kode meminta kolom-kolom ini (BUKAN "select *").
 * Staf berwenang membaca harga modal lewat fungsi erp_product_costs().
 *
 * Menambah kolom baru di tabel products? Tambahkan di sini, lalu jalankan ulang
 * db/security-hardening.sql agar izin bacanya ikut diberikan.
 */
export const PRODUCT_PUBLIC_COLUMNS = [
    "id", "name", "price", "stock", "category", "image_url", "created_at", "business_id",
    "caption", "description", "sales_count", "is_published", "is_featured", "is_hero",
    "hero_caption", "hero_text", "compare_at_price", "ship_estimate", "ship_from",
    "video_url", "gallery", "hero_image_url", "sku", "barcode", "rating_avg", "review_count",
].join(", ");

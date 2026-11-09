/**
 * KANTOONG — HITUNGAN HALAMAN DETAIL PRODUK (murni, dites)
 * File: frontend/js/product-detail.js
 *
 * Dipakai engine.js untuk halaman #produk/<id>. Tidak menyentuh DOM.
 * Prinsip "jujur adalah kemewahan": semua angka dari data asli,
 * tidak ada stok palsu, hitung mundur palsu, atau harga coret palsu.
 */

export const RECENT_KEY = "kantoong:recently-viewed";
export const RECENT_MAX = 12;
export const LOW_STOCK = 5;

const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

/**
 * Status stok yang jujur.
 * stock kosong/null = tidak dilacak -> "tersedia" tanpa angka.
 */
export function stockState(stock, { low = LOW_STOCK } = {}) {
    if (stock === null || stock === undefined || stock === "") {
        return { key: "ready", label: "Stok tersedia", max: 99 };
    }
    const n = Math.max(0, Math.floor(num(stock)));
    if (n === 0) return { key: "out", label: "Stok habis", max: 0 };
    if (n <= low) return { key: "low", label: `Sisa ${n} lagi`, max: n };
    return { key: "ready", label: "Stok tersedia", max: Math.min(n, 99) };
}

/** Hemat berapa rupiah. 0 bila harga coret tidak lebih tinggi. */
export function priceSaving(price, compareAt) {
    const p = num(price);
    const c = num(compareAt);
    return c > p && p > 0 ? c - p : 0;
}

/** Batasi jumlah beli antara 1 dan stok maksimal. */
export function clampQty(qty, max) {
    const m = Math.max(0, Math.floor(num(max)));
    if (m === 0) return 0;
    return Math.min(m, Math.max(1, Math.floor(num(qty, 1))));
}

/**
 * Produk serupa: kategori sama dulu, lalu harga terdekat, lalu terlaris.
 * Produk yang sedang dibuka & produk tidak terbit dibuang.
 */
export function relatedProducts(product, all, { limit = 8, idOf = (p) => String(p?.id ?? "") } = {}) {
    if (!product || !Array.isArray(all)) return [];
    const id = idOf(product);
    const cat = String(product.category ?? "").trim().toLowerCase();
    const price = num(product.price);

    return all
        .filter((p) => p && idOf(p) !== id && p.is_published !== false)
        .map((p) => {
            const sameCat = cat && String(p.category ?? "").trim().toLowerCase() === cat ? 1 : 0;
            const gap = price > 0 ? Math.abs(num(p.price) - price) / price : 1;
            return { p, score: sameCat * 10 - Math.min(gap, 3) + Math.min(num(p.sales_count), 1000) / 1000 };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((x) => x.p);
}

/* ---------- Terakhir dilihat (hanya di perangkat ini, tanpa sidik jari) ---------- */

export function readRecent(storage = globalThis.localStorage) {
    try {
        const list = JSON.parse(storage?.getItem(RECENT_KEY) || "[]");
        return Array.isArray(list) ? list.map(String).slice(0, RECENT_MAX) : [];
    } catch {
        return [];
    }
}

export function pushRecent(id, storage = globalThis.localStorage) {
    const key = String(id ?? "");
    if (!key) return readRecent(storage);
    const next = [key, ...readRecent(storage).filter((x) => x !== key)].slice(0, RECENT_MAX);
    try {
        storage?.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
        /* penyimpanan penuh / mode privat: abaikan */
    }
    return next;
}

/* ---------- Ulasan ---------- */

/** Ringkasan bintang: rata-rata, total, dan sebaran 5..1 (persen). */
export function reviewSummary(reviews) {
    const list = (Array.isArray(reviews) ? reviews : [])
        .map((r) => Math.round(num(r?.rating)))
        .filter((r) => r >= 1 && r <= 5);
    const total = list.length;
    const counts = [5, 4, 3, 2, 1].map((star) => list.filter((r) => r === star).length);
    const avg = total ? Math.round((list.reduce((a, b) => a + b, 0) / total) * 10) / 10 : 0;
    return {
        avg,
        total,
        bars: [5, 4, 3, 2, 1].map((star, i) => ({
            star,
            count: counts[i],
            pct: total ? Math.round((counts[i] / total) * 100) : 0,
        })),
    };
}

/** "3 hari lalu", "2 bln lalu" — untuk tanggal ulasan. */
export function timeAgo(date, now = Date.now()) {
    const t = new Date(date).getTime();
    if (!Number.isFinite(t)) return "";
    const s = Math.max(0, Math.round((now - t) / 1000));
    if (s < 3600) return `${Math.max(1, Math.round(s / 60))} mnt lalu`;
    if (s < 86400) return `${Math.round(s / 3600)} jam lalu`;
    if (s < 86400 * 30) return `${Math.round(s / 86400)} hari lalu`;
    if (s < 86400 * 365) return `${Math.round(s / (86400 * 30))} bln lalu`;
    return `${Math.round(s / (86400 * 365))} thn lalu`;
}

/* ---------- Data terstruktur untuk Google & mesin AI (GEO) ---------- */

/**
 * schema.org Product. Rating hanya ikut bila ada ulasan asli
 * (Google menghukum rating karangan).
 */
export function productJsonLd(product, { url, brand, currency = "IDR", image } = {}) {
    if (!product) return null;
    const stock = stockState(product.stock);
    const data = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: String(product.name ?? ""),
        sku: product.sku ? String(product.sku) : undefined,
        gtin: product.barcode ? String(product.barcode) : undefined,
        description: String(product.description ?? product.caption ?? "").slice(0, 5000) || undefined,
        image: image ? [image] : undefined,
        category: product.category ? String(product.category) : undefined,
        brand: brand ? { "@type": "Brand", name: String(brand) } : undefined,
        offers: {
            "@type": "Offer",
            url,
            priceCurrency: currency,
            price: num(product.price),
            availability: stock.key === "out"
                ? "https://schema.org/OutOfStock"
                : "https://schema.org/InStock",
            itemCondition: "https://schema.org/NewCondition",
        },
    };
    const reviews = num(product.review_count);
    const rating = num(product.rating_avg ?? product.rating);
    if (reviews > 0 && rating > 0) {
        data.aggregateRating = { "@type": "AggregateRating", ratingValue: rating, reviewCount: reviews };
    }
    return JSON.parse(JSON.stringify(data));
}

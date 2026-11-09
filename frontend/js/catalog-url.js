/**
 * KANTOONG — FILTER KATALOG DI LINK + RIWAYAT PENCARIAN (murni, dites)
 * File: frontend/js/catalog-url.js
 *
 * Link toko yang bisa dibagikan, contoh:
 *   /?katalog=1&cari=sepatu+hitam&urut=termurah&harga=lt100&diskon=1&kat=Sepatu
 * Dibuka → Dashboard › Katalog Produk langsung dengan saringan yang sama.
 *
 * Riwayat pencarian HANYA di perangkat ini (maks 8), bisa dihapus satu-satu
 * atau semuanya. Tidak dikirim ke server.
 */

export const CATALOG_PARAM = "katalog";
export const HISTORY_KEY = "kantoong:search-history";
export const HISTORY_MAX = 8;

const KEYS = ["cari", "urut", "harga", "diskon", "stok", "rating", "kat"];
const clean = (v, max = 80) => String(v ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
const slug = (v) => (/^[a-z0-9-]{1,24}$/.test(String(v ?? "")) ? String(v) : "");

/** State katalog → parameter link (hanya yang aktif, agar link pendek). */
export function catalogToParams(st) {
    const p = new URLSearchParams();
    p.set(CATALOG_PARAM, "1");
    const g = st?.global ?? {};
    if (clean(st?.query)) p.set("cari", clean(st.query));
    if (g.sort && g.sort !== "relevan") p.set("urut", slug(g.sort));
    if (g.band && g.band !== "all") p.set("harga", slug(g.band));
    if (g.discount) p.set("diskon", "1");
    if (g.inStock) p.set("stok", "1");
    if (g.rating4) p.set("rating", "4");
    if (g.category && g.category !== "all") p.set("kat", clean(g.category, 40));
    [...p.keys()].forEach((k) => {
        if (!p.get(k)) p.delete(k);
    });
    return p;
}

/**
 * Parameter link → state katalog. Nilai diperiksa dengan daftar yang sah
 * (sorts/bands) agar link buatan orang tidak bisa menyisipkan apa pun.
 */
export function paramsToCatalog(params, { sorts = [], bands = [] } = {}) {
    const p = params instanceof URLSearchParams ? params : new URLSearchParams(String(params ?? ""));
    if (p.get(CATALOG_PARAM) !== "1") return null;
    const sort = sorts.includes(p.get("urut")) ? p.get("urut") : "relevan";
    const band = bands.includes(p.get("harga")) ? p.get("harga") : "all";
    return {
        query: clean(p.get("cari")),
        global: {
            sort,
            band,
            discount: p.get("diskon") === "1",
            inStock: p.get("stok") === "1",
            rating4: p.get("rating") === "4",
            category: clean(p.get("kat"), 40) || "all",
        },
        perCat: {},
    };
}

/** Hapus parameter katalog dari alamat (dipakai saat katalog ditutup). */
export function stripCatalogParams(search) {
    const p = new URLSearchParams(String(search ?? ""));
    [CATALOG_PARAM, ...KEYS].forEach((k) => p.delete(k));
    const s = p.toString();
    return s ? `?${s}` : "";
}

/** Gabungkan parameter katalog ke alamat lain (parameter lain tetap). */
export function mergeCatalogParams(search, params) {
    const base = new URLSearchParams(stripCatalogParams(search));
    params.forEach((v, k) => base.set(k, v));
    return `?${base.toString()}`;
}

/* ---------- Riwayat pencarian ---------- */

export function addHistory(list, query) {
    const q = clean(query, 60);
    if (q.length < 2) return Array.isArray(list) ? list.slice(0, HISTORY_MAX) : [];
    const rest = (Array.isArray(list) ? list : []).filter((x) => typeof x === "string" && x.toLowerCase() !== q.toLowerCase());
    return [q, ...rest].slice(0, HISTORY_MAX);
}

export const removeHistory = (list, query) => (Array.isArray(list) ? list : []).filter((x) => x !== query);

export function readHistory(storage = globalThis.localStorage) {
    try {
        const list = JSON.parse(storage?.getItem(HISTORY_KEY) || "[]");
        return Array.isArray(list) ? list.filter((x) => typeof x === "string").slice(0, HISTORY_MAX) : [];
    } catch {
        return [];
    }
}

export function writeHistory(list, storage = globalThis.localStorage) {
    try {
        if (list.length) storage?.setItem(HISTORY_KEY, JSON.stringify(list));
        else storage?.removeItem(HISTORY_KEY);
    } catch {
        /* penyimpanan diblokir */
    }
}

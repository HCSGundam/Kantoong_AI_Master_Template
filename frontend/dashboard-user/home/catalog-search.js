/**
 * KANTOONG — PENCARIAN & SARINGAN KATALOG (murni, dites)
 * File: frontend/dashboard-user/home/catalog-search.js
 *
 * - Tahan salah ketik ("hitm" ketemu "hitam").
 * - Paham kalimat: "baju hitam buat kondangan di bawah 300rb"
 *   -> kata kunci [baju, hitam, kondangan] + harga maks 300.000.
 * - Saringan: kategori, rentang harga, diskon, tersedia, rating 4+.
 * - Urutan: relevan, terlaris, terbaru, termurah, termahal, rating.
 */

export const SORTS = Object.freeze([
    { id: "relevan", label: "Paling cocok" },
    { id: "terlaris", label: "Terlaris" },
    { id: "terbaru", label: "Terbaru" },
    { id: "termurah", label: "Harga terendah" },
    { id: "termahal", label: "Harga tertinggi" },
    { id: "rating", label: "Rating tertinggi" },
]);

export const PRICE_BANDS = Object.freeze([
    { id: "all", label: "Semua harga", min: 0, max: Infinity },
    { id: "lt50", label: "< 50rb", min: 0, max: 50000 },
    { id: "50-100", label: "50–100rb", min: 50000, max: 100000 },
    { id: "100-300", label: "100–300rb", min: 100000, max: 300000 },
    { id: "gt300", label: "> 300rb", min: 300000, max: Infinity },
]);

// Kata sambung yang tidak dipakai sebagai kata kunci.
const STOP = new Set([
    "yang", "dan", "atau", "buat", "untuk", "di", "ke", "dari", "dengan", "pakai", "aku", "saya", "mau",
    "cari", "carikan", "ada", "ga", "gak", "nggak", "tidak", "dong", "kak", "min", "sih", "yg", "utk",
    "bawah", "atas", "harga", "budget", "maksimal", "maks", "minimal", "min", "sekitar", "kurang", "lebih",
    "rb", "ribu", "jt", "juta", "k", "rp", "the", "a", "an", "of", "for", "itu", "ini", "nya", "aja", "saja",
    "murah", "termurah", "mahal", "termahal", "terlaris", "laris", "terbaru", "baru", "diskon", "promo", "ready", "tersedia",
]);

export function normalize(text) {
    return String(text ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9.,\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/** "300rb" / "300 ribu" / "1,5jt" / "Rp 250.000" -> angka rupiah. */
export function parseAmount(raw, unit = "") {
    const clean = String(raw).replace(/\./g, "").replace(",", ".");
    const n = Number(clean);
    if (!Number.isFinite(n)) return null;
    const u = String(unit).toLowerCase();
    if (u.startsWith("j")) return Math.round(n * 1_000_000);
    if (u.startsWith("r") || u === "k") return Math.round(n * 1000);
    return n < 1000 ? Math.round(n * 1000) : Math.round(n);
}

/** Pahami kalimat bebas menjadi saringan. */
export function parseQuery(query) {
    const text = normalize(query);
    const out = { terms: [], minPrice: null, maxPrice: null, sort: null, discount: false, inStock: false };
    if (!text) return out;

    const amount = "(?:rp\\s*)?(\\d+(?:[.,]\\d+)*)\\s*(rb|ribu|k|jt|juta)?";
    let m = text.match(new RegExp(`(?:di ?bawah|kurang dari|maks(?:imal)?|max|<|budget|sampai)\\s*${amount}`));
    if (m) out.maxPrice = parseAmount(m[1], m[2]);
    m = text.match(new RegExp(`(?:di ?atas|lebih dari|min(?:imal)?|>|mulai)\\s*${amount}`));
    if (m) out.minPrice = parseAmount(m[1], m[2]);
    m = text.match(new RegExp(`${amount}\\s*(?:-|sampai|s\\/d|hingga)\\s*${amount}`));
    if (m && out.maxPrice === null) {
        out.minPrice = parseAmount(m[1], m[2] || m[4]);
        out.maxPrice = parseAmount(m[3], m[4]);
    }

    if (/\b(murah|termurah|hemat)\b/.test(text)) out.sort = "termurah";
    if (/\b(mahal|termahal|premium|mewah)\b/.test(text)) out.sort = "termahal";
    if (/\b(terlaris|laris|best ?seller|populer)\b/.test(text)) out.sort = "terlaris";
    if (/\b(terbaru|paling baru|new)\b/.test(text)) out.sort = "terbaru";
    if (/\b(diskon|promo|sale)\b/.test(text)) out.discount = true;
    if (/\b(ready|tersedia|ada stok)\b/.test(text)) out.inStock = true;

    out.terms = text
        .replace(/(?:rp\s*)?\d+(?:[.,]\d+)*\s*(?:rb|ribu|k|jt|juta)?/g, " ")
        .split(" ")
        .filter((w) => w.length > 1 && !STOP.has(w));
    return out;
}

/** Jarak edit sederhana (untuk salah ketik). */
export function editDistance(a, b) {
    if (a === b) return 0;
    const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let prev = dp[0];
        dp[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const tmp = dp[j];
            dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
            prev = tmp;
        }
    }
    return dp[b.length];
}

// Padanan kata Indonesia <-> Inggris yang sering dipakai di nama produk.
const SYNONYMS = {
    coklat: ["chocolate", "cokelat", "choco", "brown"], cokelat: ["chocolate", "coklat", "choco", "brown"],
    hitam: ["black"], putih: ["white"], merah: ["red"], biru: ["blue"], hijau: ["green"], kuning: ["yellow"],
    abu: ["grey", "gray"], pink: ["merah muda"], susu: ["milk"], kopi: ["coffee"], teh: ["tea"],
    sepatu: ["shoes", "sneakers", "shoe"], baju: ["shirt", "kemeja", "kaos", "atasan"], celana: ["pants", "jeans"],
    tas: ["bag"], kue: ["cookies", "cake", "cookie"], emas: ["gold"], perak: ["silver"], cincin: ["ring"],
    kalung: ["necklace"], gelang: ["bracelet"], anting: ["earring", "earrings"],
};

/** Skor satu kata terhadap teks produk: 3 = persis, 2 = awalan, 1 = mirip (salah ketik). */
function termScore(term, words, haystack) {
    const base = rawTermScore(term, words, haystack);
    if (base > 0) return base;
    const alt = SYNONYMS[term] ?? [];
    return alt.some((a) => rawTermScore(a, words, haystack) > 0) ? 2 : 0;
}

function rawTermScore(term, words, haystack) {
    if (haystack.includes(term)) return words.includes(term) ? 3 : 2;
    const allowed = term.length >= 7 ? 2 : term.length >= 4 ? 1 : 0;
    if (!allowed) return 0;
    return words.some((w) => Math.abs(w.length - term.length) <= allowed && editDistance(term, w) <= allowed) ? 1 : 0;
}

export function productText(p) {
    return normalize([p.name, p.category, p.caption, p.description, p.sku].filter(Boolean).join(" "));
}

const price = (p) => Number(p?.price) || 0;
const hasDiscount = (p) => Number(p?.compare_at_price) > price(p);
const inStock = (p) => p?.stock === null || p?.stock === undefined || Number(p.stock) > 0;

/**
 * Saring + urutkan.
 * f: { query, category, band, minPrice, maxPrice, discount, inStock, rating4, sort }
 * Hasil: { items, parsed, matched } — items berisi produk + _score.
 */
export function searchCatalog(products, f = {}) {
    const parsed = parseQuery(f.query ?? "");
    const band = PRICE_BANDS.find((b) => b.id === f.band) ?? PRICE_BANDS[0];
    const min = Math.max(band.min, f.minPrice ?? 0, parsed.minPrice ?? 0);
    const max = Math.min(band.max, f.maxPrice ?? Infinity, parsed.maxPrice ?? Infinity);
    const wantDiscount = f.discount || parsed.discount;
    const wantStock = f.inStock || parsed.inStock;
    const category = String(f.category ?? "all").toLowerCase();

    let items = (products ?? [])
        .filter((p) => p && p.is_published !== false)
        .filter((p) => category === "all" || String(p.category ?? "").toLowerCase() === category)
        .filter((p) => price(p) >= min && price(p) <= max)
        .filter((p) => !wantDiscount || hasDiscount(p))
        .filter((p) => !wantStock || inStock(p))
        .filter((p) => !f.rating4 || Number(p.rating_avg ?? p.rating) >= 4);

    if (parsed.terms.length) {
        items = items
            .map((p) => {
                const hay = productText(p);
                const words = hay.split(" ");
                const scores = parsed.terms.map((t) => termScore(t, words, hay));
                const hits = scores.filter((x) => x > 0).length;
                return { p, score: scores.reduce((a, b) => a + b, 0), hits };
            })
            // Minimal separuh kata kunci cocok, agar "baju hitam kondangan" tetap ketemu
            // walau deskripsi tidak menyebut "kondangan".
            .filter((x) => x.hits >= Math.max(1, Math.ceil(parsed.terms.length / 2)))
            .map((x) => ({ ...x.p, _score: x.score + x.hits * 2 }));
    } else {
        items = items.map((p) => ({ ...p, _score: 0 }));
    }

    // Pilihan user di menu urutan menang; bila "Paling cocok", ikuti kalimat ("murah" = termurah).
    const sort = f.sort && f.sort !== "relevan" ? f.sort : parsed.sort ?? "relevan";
    const sorters = {
        relevan: (a, b) => b._score - a._score || (b.sales_count ?? 0) - (a.sales_count ?? 0),
        terlaris: (a, b) => (b.sales_count ?? 0) - (a.sales_count ?? 0),
        terbaru: (a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0),
        termurah: (a, b) => price(a) - price(b),
        termahal: (a, b) => price(b) - price(a),
        rating: (a, b) => (Number(b.rating_avg) || 0) - (Number(a.rating_avg) || 0) || (b.review_count ?? 0) - (a.review_count ?? 0),
    };
    items.sort(sorters[sort] ?? sorters.relevan);

    return { items, parsed, sort, min, max: Number.isFinite(max) ? max : null };
}

/** Saran saat mengetik: nama produk & kategori yang paling mirip. */
export function suggest(products, query, limit = 6) {
    const q = normalize(query);
    if (q.length < 2) return [];
    const seen = new Set();
    const out = [];
    const push = (label, kind) => {
        const key = `${kind}:${label.toLowerCase()}`;
        if (seen.has(key) || out.length >= limit) return;
        seen.add(key);
        out.push({ label, kind });
    };
    const cats = [...new Set((products ?? []).map((p) => p.category).filter(Boolean))];
    cats.filter((c) => normalize(c).includes(q)).forEach((c) => push(c, "kategori"));
    (products ?? [])
        .map((p) => ({ p, s: termScore(q.split(" ").pop(), normalize(p.name).split(" "), normalize(p.name)) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .forEach((x) => push(x.p.name, "produk"));
    return out;
}

/** Ringkasan saringan aktif dalam bahasa manusia. */
export function describeFilters(result) {
    const bits = [];
    if (result.parsed.terms.length) bits.push(`“${result.parsed.terms.join(" ")}”`);
    if (result.min > 0) bits.push(`≥ Rp ${result.min.toLocaleString("id-ID")}`);
    if (result.max !== null) bits.push(`≤ Rp ${result.max.toLocaleString("id-ID")}`);
    if (result.parsed.discount) bits.push("sedang diskon");
    if (result.parsed.inStock) bits.push("ready stok");
    return bits.join(" · ");
}

/**
 * KANTOONG ERP — AI RESEARCH & SECOND BRAIN (Fase 4, hitungan murni)
 * File: frontend/erp/core/research.js
 *
 * Menu ERP "Second Brain" (khusus owner): 1 neuron brand + ringkasan.
 * Sumber: ai_events (db/erp-phase4.sql), dicatat ANONIM oleh toko:
 *   { at, business_id, session_key, kind, product_id, product_name, keywords[], surface }
 *   kind: ask (bertanya) | recommend (AI merekomendasikan) | attach (produk
 *         dilampirkan ke chat) | view (pop-up produk) | cart (masuk keranjang)
 *
 * PRIVASI (UU PDP): tidak ada nama, email, HP, atau isi chat. Kata kunci
 * hanya kata yang ADA di katalog atau di daftar kebutuhan (NEEDS), jadi
 * data pribadi yang diketik pembeli tidak pernah ikut tersimpan.
 */

export const EVENT_KINDS = Object.freeze(["ask", "recommend", "attach", "view", "cart"]);

/** Kebutuhan (need) pembeli: kata pemicu -> label bisnis. */
export const NEEDS = Object.freeze({
    hadiah: { label: "Hadiah / oleh-oleh", words: ["hadiah", "kado", "oleh", "parcel", "hampers", "ultah", "ulang"] },
    hemat: { label: "Harga hemat", words: ["murah", "hemat", "promo", "diskon", "voucher", "terjangkau", "budget"] },
    sehat: { label: "Sehat / diet", words: ["sehat", "diet", "gula", "kalori", "protein", "vegan", "olahraga"] },
    cepat: { label: "Butuh cepat", words: ["cepat", "kilat", "hari", "besok", "instan", "sameday"] },
    banyak: { label: "Beli banyak / acara", words: ["grosir", "banyak", "acara", "kantor", "arisan", "reseller", "partai"] },
    rasa: { label: "Cari rasa / varian", words: ["rasa", "varian", "manis", "pahit", "segar", "creamy", "baru"] },
});

const NEED_WORDS = new Map(
    Object.entries(NEEDS).flatMap(([key, need]) => need.words.map((word) => [word, key]))
);

const STOP = new Set(["yang", "dan", "atau", "ada", "untuk", "dengan", "apa", "saja", "mau", "kak", "dong", "nya", "ini", "itu", "bisa", "tolong", "produk"]);

/** Kosakata katalog: kata dari nama & kategori produk (>= 3 huruf). */
export function catalogVocabulary(products = []) {
    const words = new Set();
    for (const product of products) {
        for (const word of `${product.name || ""} ${product.category || ""}`.toLowerCase().split(/[^a-z]+/)) {
            if (word.length >= 3 && !STOP.has(word)) words.add(word);
        }
    }
    return words;
}

/**
 * Kata kunci aman dari kalimat pembeli: hanya kata katalog atau kata
 * kebutuhan. Maks 5, tanpa angka/simbol. Nama orang, HP, email terbuang.
 */
export function extractKeywords(text, vocabulary = new Set()) {
    const found = [];
    for (const raw of String(text || "").toLowerCase().split(/[^a-z]+/)) {
        // Sinonim ejaan umum: "cokelat" = "coklat".
        const word = raw === "cokelat" ? "coklat" : raw;
        if (word.length < 3 || STOP.has(word)) continue;
        if ((vocabulary.has(word) || NEED_WORDS.has(word)) && !found.includes(word)) found.push(word);
        if (found.length === 5) break;
    }
    return found;
}

export function needOf(word) {
    return NEED_WORDS.get(word) || null;
}

/** Event di dalam rentang hari terakhir. */
export function withinDays(events, days, now = new Date()) {
    const since = now.getTime() - days * 86400000;
    return events.filter((event) => new Date(event.at).getTime() >= since);
}

const countBy = (items, keyOf) => {
    const map = new Map();
    for (const item of items) {
        const key = keyOf(item);
        if (key) map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
};

const top = (map, limit) =>
    [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, limit);

/** Jam dalam WIB (0-23). */
export function wibHour(at) {
    return (new Date(at).getUTCHours() + 7) % 24;
}

/**
 * Ringkasan Customer Research: need, wants, behavior.
 */
export function summarizeResearch(events, products = [], { days = 30, now = new Date() } = {}) {
    const recent = withinDays(events, days, now);
    const nameOf = (id, fallback) => products.find((product) => String(product.id) === String(id))?.name || fallback || "Produk";
    const by = (kind) => recent.filter((event) => event.kind === kind);

    const sessions = new Set(recent.map((event) => event.session_key)).size;
    const asks = by("ask");
    const interest = recent.filter((event) => event.product_id && event.kind !== "cart");
    const carts = by("cart");

    // Wants: produk yang paling diminati lewat AI (direkomendasikan/dilihat/ditanya).
    const interestCount = countBy(interest, (event) => String(event.product_id));
    const cartCount = countBy(carts, (event) => String(event.product_id));
    const nameById = new Map(recent.filter((event) => event.product_id).map((event) => [String(event.product_id), event.product_name]));

    const topProducts = top(interestCount, 8).map(([id, count]) => ({
        product_id: id, name: nameOf(id, nameById.get(id)), count, carts: cartCount.get(id) || 0,
    }));

    // Diminati tapi jarang masuk keranjang: peluang promo / foto / harga.
    const interestedNotBought = top(interestCount, 50)
        .map(([id, count]) => ({ product_id: id, name: nameOf(id, nameById.get(id)), count, carts: cartCount.get(id) || 0 }))
        .filter((row) => row.count >= 3 && row.carts / row.count < 0.2)
        .slice(0, 5);

    const words = asks.flatMap((event) => event.keywords || []);
    const needs = top(countBy(words, needOf), 6).map(([key, count]) => ({ key, label: NEEDS[key].label, count }));
    const keywords = top(countBy(words.filter((word) => !needOf(word)), (word) => word), 12)
        .map(([word, count]) => ({ word, count }));

    const hours = Array.from({ length: 24 }, () => 0);
    for (const event of asks) hours[wibHour(event.at)] += 1;
    const peak = hours.indexOf(Math.max(...hours));

    const cartSessions = new Set(carts.map((event) => event.session_key)).size;

    return {
        days,
        totals: {
            sessions,
            asks: asks.length,
            recommends: by("recommend").length,
            carts: carts.length,
            conversion: sessions ? Math.round((cartSessions / sessions) * 100) : 0,
        },
        funnel: [
            { key: "ask", label: "Bertanya ke AI", value: new Set(asks.map((event) => event.session_key)).size },
            { key: "recommend", label: "Dapat rekomendasi", value: new Set(by("recommend").map((event) => event.session_key)).size },
            { key: "view", label: "Melihat produk", value: new Set(recent.filter((event) => event.kind === "view" || event.kind === "attach").map((event) => event.session_key)).size },
            { key: "cart", label: "Masuk keranjang", value: cartSessions },
        ],
        topProducts,
        interestedNotBought,
        needs,
        keywords,
        hours,
        peakHour: asks.length ? peak : null,
    };
}

/* ---------- Second Brain: label tamu anonim ---------- */

/** Label anonim yang stabil per sesi: "Tamu #12". */
export function guestLabels(events) {
    const labels = new Map();
    for (const event of [...events].sort((a, b) => new Date(a.at) - new Date(b.at))) {
        if (!labels.has(event.session_key)) labels.set(event.session_key, `Tamu #${labels.size + 1}`);
    }
    return labels;
}

/* ---------- Panel aktivitas agen ---------- */

const ACTIVITY = {
    ask: (guest, product, words) => `${guest} bertanya${words ? ` soal ${words}` : ""}`,
    recommend: (guest, product) => `AI merekomendasikan ${product} ke ${guest}`,
    attach: (guest, product) => `${guest} menanyakan ${product} lebih lanjut`,
    view: (guest, product) => `${guest} membuka detail ${product}`,
    cart: (guest, product) => `${guest} memasukkan ${product} ke keranjang`,
};

/** Kalimat aktivitas terbaru (paling baru di atas). */
export function activityFeed(events, { products = [], labels = guestLabels(events), limit = 30 } = {}) {
    return [...events]
        .sort((a, b) => new Date(b.at) - new Date(a.at))
        .slice(0, limit)
        .map((event) => {
            const product = products.find((entry) => String(entry.id) === String(event.product_id))?.name || event.product_name || "produk";
            const words = (event.keywords || []).slice(0, 2).join(", ");
            return {
                at: event.at,
                kind: event.kind,
                text: (ACTIVITY[event.kind] || ACTIVITY.ask)(labels.get(event.session_key) || "Tamu", product, words),
            };
        });
}

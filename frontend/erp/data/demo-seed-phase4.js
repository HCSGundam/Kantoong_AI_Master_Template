/**
 * KANTOONG ERP — DATA CONTOH FASE 4 (AI Research & Second Brain)
 * File: frontend/erp/data/demo-seed-phase4.js
 *
 * ai_events FIKTIF selama 30 hari: tamu anonim bertanya ke AI, menerima
 * rekomendasi, membuka produk, dan sebagian memasukkan ke keranjang.
 * Polanya dibuat realistis: ramai siang & malam (WIB), satu produk
 * sering diminati tapi jarang dibeli (bahan insight "peluang").
 */

import CFG from "../../client-config.js";

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

const DAY = 86400000;

// Jam WIB beserta bobot keramaian.
const HOURS = [[8, 1], [10, 2], [12, 4], [13, 3], [16, 2], [19, 5], [20, 6], [21, 4], [22, 2]];

const QUESTIONS = [
    ["murah", "susu"], ["hadiah"], ["coklat"], ["sehat", "diet"], ["cookies", "manis"],
    ["promo"], ["oleh"], ["rasa", "baru"], ["acara", "banyak"], ["milktea"], ["segar"], ["cepat"],
];

const pick = (random, list) => list[Math.floor(random() * list.length)];

function weightedHour(random) {
    const total = HOURS.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = random() * total;
    for (const [hour, weight] of HOURS) {
        roll -= weight;
        if (roll <= 0) return hour;
    }
    return 20;
}

/** Event contoh untuk mode demo (juga dipakai "denyut langsung" di layar). */
export function demoAiSession(random, products, { at, sessionKey, businessId = CFG.business_id }) {
    const events = [];
    const add = (kind, product, offsetMin, keywords = []) => events.push({
        at: new Date(at.getTime() + offsetMin * 60000).toISOString(),
        business_id: businessId,
        session_key: sessionKey,
        kind,
        product_id: product ? String(product.id) : null,
        product_name: product ? product.name : null,
        keywords,
        surface: "store",
    });

    add("ask", null, 0, pick(random, QUESTIONS));
    if (!products.length) return events;

    // Produk pertama paling sering direkomendasikan, tapi jarang dibeli.
    const favourite = products[0];
    const picks = [random() < 0.45 ? favourite : pick(random, products), pick(random, products)];
    picks.forEach((product, index) => add("recommend", product, 1 + index));

    const chosen = picks[Math.floor(random() * picks.length)];
    if (random() < 0.6) add("view", chosen, 3);
    if (random() < 0.25) add("attach", chosen, 4, []);

    const buyChance = chosen.id === favourite.id ? 0.08 : 0.38;
    if (random() < buyChance) add("cart", chosen, 6);

    return events;
}

export function extendSeedPhase4(seed, now = new Date()) {
    const random = prng(20261103);
    const products = (seed.products || []).slice(0, 8);
    const events = [];

    for (let index = 0; index < 90; index++) {
        const dayAgo = Math.floor(random() * 30);
        const day = new Date(now.getTime() - dayAgo * DAY);
        // Jam WIB -> UTC.
        const at = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), (weightedHour(random) + 17) % 24, Math.floor(random() * 60)));
        if (at > now) at.setTime(at.getTime() - DAY);
        events.push(...demoAiSession(random, products, { at, sessionKey: `s-demo${String(index).padStart(3, "0")}x` }));
    }

    seed.ai_events = events.sort((a, b) => new Date(a.at) - new Date(b.at));
    return seed;
}

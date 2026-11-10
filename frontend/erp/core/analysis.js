/**
 * KANTOONG ERP — ANACHRONOS ANALYSIS (hitungan murni, dites)
 * File: frontend/erp/core/analysis.js
 *
 * Add-on BERBAYAR di luar paket (pusatnya nanti di Anachronos Digital Mall,
 * datanya dari sini). Menjawab 3 pertanyaan bisnis dari data ANONIM:
 *   1. Corong belanja — di tahap mana pembeli "bocor"?
 *   2. Kebutuhan — apa yang dicari pembeli (termasuk yang belum terlayani)?
 *   3. Alasan tidak beli — dari chat AI (kata umum), kasir (penjualan hilang),
 *      dan produk yang diminati tapi tidak dibeli.
 * Tiap divisi yang BERHADAPAN dengan pembeli (sales, marketing, CS) hanya
 * melihat irisan miliknya; owner/manajer melihat semua.
 */

import { NEEDS, OBJECTIONS, objectionOf, summarizeResearch, withinDays } from "./research.js";
import { LOST_REASONS } from "./pos-pro.js";

export const ADDON_ID = "analysis";
export const ADDON_NAME = "Anachronos Analysis";

/** Divisi yang boleh & irisan yang dilihat. Internal (gudang, keuangan, HR) tidak. */
export const DIVISION_VIEWS = Object.freeze({
    owner: { label: "Semua divisi", sections: ["funnel", "needs", "reasons", "hours", "products"] },
    sales: { label: "Sales", sections: ["funnel", "products", "reasons"] },
    marketing: { label: "Marketing", sections: ["needs", "hours", "products"] },
    cs: { label: "Customer Service", sections: ["reasons", "needs"] },
});

/** Irisan untuk anggota: owner/manajer (level ≥4) semua; sales/marketing/cs sesuai divisinya. */
export function viewFor(member) {
    if (!member) return null;
    if (member.level >= 4) return "owner";
    const roles = [member.role, ...(member.roles ?? [])].filter(Boolean);
    return ["sales", "marketing", "cs"].find((r) => roles.includes(r)) ?? null;
}

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

/**
 * events: ai_events anonim · lost: penjualan hilang kasir · orders: pesanan online (opsional)
 */
export function buildAnalysis({ events = [], products = [], lost = [], orders = [], days = 30, now = new Date() } = {}) {
    const research = summarizeResearch(events, products, { days, now });
    const recent = withinDays(events, days, now);
    const sessions = research.totals.sessions;
    const cutoff = now.getTime() - days * 86_400_000;
    const paid = orders.filter((o) => !["dibatalkan", "menunggu_pembayaran"].includes(o.status) && new Date(o.created_at).getTime() >= cutoff).length;

    // 1. Corong (hanya peristiwa yang tercatat dalam sesi AI yang sama → angka konsisten):
    //    mengobrol → lihat produk → keranjang. Pesanan dibayar (semua kanal) ditampilkan terpisah,
    //    karena pesanan tidak terhubung ke sesi anonim (sengaja, demi privasi).
    const steps = [
        { key: "visit", label: "Mengobrol dengan AI", value: sessions },
        ...research.funnel.filter((s) => s.key !== "recommend"),
    ];
    // "Bertanya" & "Mengobrol" sama-sama sesi; tampilkan yang berbeda saja.
    const funnel = steps.filter((s, i) => !(s.key === "ask" && steps[0].value === s.value && i > 0)).map((s, i, arr) => ({
        ...s,
        pctOfTop: pct(s.value, arr[0].value),
        dropFromPrev: i ? Math.max(0, arr[i - 1].value - s.value) : 0,
    }));
    const leak = funnel.slice(1).reduce((worst, s) => (s.dropFromPrev > (worst?.dropFromPrev ?? -1) ? s : worst), null);

    // 2. Kebutuhan: dari kata kebutuhan + produk diminati tapi sepi keranjang + kata katalog paling dicari.
    const needs = research.needs;
    const unmet = research.interestedNotBought;

    // 3. Alasan tidak beli.
    const words = recent.filter((e) => e.kind === "ask").flatMap((e) => e.keywords || []);
    const objCount = new Map();
    words.forEach((w) => {
        const key = objectionOf(w);
        if (key) objCount.set(key, (objCount.get(key) || 0) + 1);
    });
    const chatReasons = [...objCount.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, label: OBJECTIONS[key].label, count, source: "Chat AI" }));
    const lostRecent = lost.filter((l) => new Date(l.created_at).getTime() >= cutoff);
    const lostCount = new Map();
    let lostValue = 0;
    lostRecent.forEach((l) => {
        lostCount.set(l.reason, (lostCount.get(l.reason) || 0) + (Number(l.qty) || 1));
        lostValue += Number(l.value) || 0;
    });
    const posReasons = [...lostCount.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, label: LOST_REASONS[key] ?? key, count, source: "Kasir" }));
    const reasons = [...chatReasons, ...posReasons].sort((a, b) => b.count - a.count);

    const sentences = [];
    if (leak && leak.dropFromPrev) sentences.push(`Kebocoran terbesar: ${leak.dropFromPrev} pembeli berhenti sebelum "${leak.label.toLowerCase()}".`);
    if (needs[0]) sentences.push(`Kebutuhan teratas: ${needs[0].label.toLowerCase()} (${needs[0].count}×).`);
    if (reasons[0]) sentences.push(`Alasan tidak beli paling sering: ${reasons[0].label.toLowerCase()} (${reasons[0].count}×, dari ${reasons[0].source.toLowerCase()}).`);
    if (unmet[0]) sentences.push(`${unmet[0].name} sering diminati (${unmet[0].count}×) tapi jarang masuk keranjang.`);

    return {
        days,
        totals: { ...research.totals, paid, lostValue },
        funnel,
        leak,
        needs,
        unmet,
        keywords: research.keywords,
        reasons,
        topProducts: research.topProducts,
        hours: research.hours,
        peakHour: research.peakHour,
        sentences,
    };
}

export { NEEDS, OBJECTIONS };

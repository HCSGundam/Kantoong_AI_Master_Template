/**
 * KANTOONG — PENCATAT AKTIVITAS AI ANONIM (untuk ERP › AI Research)
 * File: frontend/js/ai-telemetry.js
 *
 * Mencatat apa yang terjadi di sekitar asisten AI di toko:
 *   ask (bertanya) · recommend (AI merekomendasikan) · attach (produk
 *   dilampirkan ke chat) · view (pop-up produk) · cart (masuk keranjang)
 * lalu mengirimnya berkelompok ke Supabase lewat log_ai_events()
 * (db/erp-phase4.sql).
 *
 * PRIVASI (UU PDP): tanpa user_id, nama, email, HP, atau isi chat.
 * Dari pertanyaan hanya diambil kata yang ada di katalog / daftar
 * kebutuhan (erp/core/research.js). session_key acak per tab (bukan
 * fingerprint). Browser dengan "Do Not Track" tidak dicatat.
 */

import CFG from "../client-config.js";
import { supabase } from "./supabase-client.js";
import { catalogVocabulary, extractKeywords } from "../erp/core/research.js";

const FLUSH_MS = 4000;
const MAX_BATCH = 20;

let queue = [];
let timer = 0;
let disabled = false;

function sessionKey() {
    try {
        let key = sessionStorage.getItem("kantoong:ai-session");
        if (!key) {
            key = `s-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
            sessionStorage.setItem("kantoong:ai-session", key);
        }
        return key;
    } catch {
        return null; // penyimpanan diblokir: tidak dicatat
    }
}

function products() {
    return window.KantoongAIBrain?.getProducts?.() || window.KantoongState?.products || [];
}

function productName(id, fallback = "") {
    const product = window.KantoongAIBrain?.findProduct?.(id);
    return String(product?.name || fallback || "").slice(0, 120);
}

async function flush() {
    clearTimeout(timer);
    timer = 0;
    if (!queue.length || disabled) return;

    const batch = queue.splice(0, MAX_BATCH);
    try {
        const { error } = await supabase.rpc("log_ai_events", { p: batch });
        // Fungsi belum dipasang (erp-phase4.sql belum dijalankan): berhenti diam-diam.
        if (error) disabled = true;
    } catch {
        disabled = true;
    }

    if (queue.length) timer = setTimeout(flush, FLUSH_MS);
}

function record(kind, { productId = null, name = "", keywords = [] } = {}) {
    if (disabled) return;
    const key = sessionKey();
    if (!key) return;

    queue.push({
        business_id: CFG.business_id,
        session_key: key,
        kind,
        product_id: productId ? String(productId) : null,
        product_name: productId ? productName(productId, name) : null,
        keywords,
        surface: window.KantoongAssistantContext?.surface || "store",
    });

    if (queue.length >= MAX_BATCH) flush();
    else if (!timer) timer = setTimeout(flush, FLUSH_MS);
}

export function initAiTelemetry() {
    if (window.__kantoongTelemetry) return;
    window.__kantoongTelemetry = true;

    // Dashboard kerja (ERP) bukan perilaku pembeli: tidak dicatat.
    if (window.KantoongAssistantContext?.surface === "erp") return;
    if (navigator.doNotTrack === "1" || window.doNotTrack === "1") return;

    window.addEventListener("kantoong:ai-response", (event) => {
        const detail = event.detail || {};
        record("ask", { keywords: extractKeywords(detail.question, catalogVocabulary(products())) });
        for (const id of (detail.product_ids || []).slice(0, 6)) record("recommend", { productId: id });
    });

    window.addEventListener("kantoong:attach-product", (event) => {
        const product = event.detail?.product;
        if (product?.id) record("attach", { productId: product.id, name: product.name });
    });

    window.addEventListener("kantoong:quickview-opened", (event) => {
        const product = event.detail?.product;
        if (product?.id) record("view", { productId: product.id, name: product.name });
    });

    window.addEventListener("kantoong:cart-add", (event) => {
        const product = event.detail?.product;
        if (product?.id) record("cart", { productId: product.id, name: product.name });
    });

    // Tutup tab: kirim sisa antrean.
    window.addEventListener("pagehide", flush);
}

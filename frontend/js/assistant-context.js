/**
 * KANTOONG — KONTEKS & IZIN MEMORI ASISTEN AI
 * File: frontend/js/assistant-context.js
 *
 * Asisten yang sama hadir di semua halaman & brand jaringan Kantoong.
 * Modul kecil ini menjawab:
 *  - Di mana asisten sedang dipakai? (surface: toko, keranjang, ERP, ...)
 *  - Brand apa? Siapa penggunanya (nama, bila sudah login)?
 *  - Boleh mengingat obrolan LINTAS BRAND? (izin UU PDP, dipilih pengguna)
 *
 * Halaman bisa mengisi window.KantoongAssistantContext sebelum asisten
 * dipasang, misalnya { surface: "erp", suggestions: [...] }.
 */

import CFG from "../client-config.js";

/** "network" = ingat di semua toko Kantoong, "brand" = hanya toko ini, null = belum memilih. */
export const MEMORY_SCOPE_KEY = "kantoong:assistant:memory-scope";

export const SURFACES = Object.freeze({
    store: "toko",
    cart: "keranjang",
    product: "halaman produk",
    dashboard: "dashboard pengguna",
    erp: "dashboard kerja ERP",
});

export function getMemoryScope() {
    try {
        const value = localStorage.getItem(MEMORY_SCOPE_KEY);
        return value === "network" || value === "brand" ? value : null;
    } catch {
        return null;
    }
}

export function setMemoryScope(scope) {
    try {
        if (scope === "network" || scope === "brand") localStorage.setItem(MEMORY_SCOPE_KEY, scope);
        else localStorage.removeItem(MEMORY_SCOPE_KEY);
    } catch {
        // Penyimpanan diblokir: asisten tetap jalan, memori hanya selama halaman terbuka.
    }
}

export function brandId() {
    return String(CFG?.business_id || CFG?.businessId || "default");
}

export function brandName() {
    return String(CFG?.app_name || "Kantoong");
}

/** Kunci penyimpanan riwayat sesuai izin: satu untuk seluruh jaringan, atau per brand. */
export function historyStorageKey() {
    return getMemoryScope() === "network"
        ? "kantoong:chat:network"
        : `kantoong:chat:${brandId()}`;
}

/** Surface saat ini: diisi halaman, atau ditebak dari alamat. */
export function currentSurface() {
    const set = window.KantoongAssistantContext?.surface;
    if (set && SURFACES[set]) {
        // Di dalam toko, keranjang & halaman produk adalah lapisan di atas toko.
        if (set === "store") {
            if (document.querySelector(".cart-page.is-open, #cartPage.is-open")) return "cart";
            if (location.hash.startsWith("#produk/")) return "product";
            if (document.body.classList.contains("dashboard-open")) return "dashboard";
        }
        return set;
    }
    return location.pathname.includes("/erp/") ? "erp" : "store";
}

/** Halaman yang sedang dibuka, dibaca ulang setiap pesan dikirim. */
export function currentPage() {
    const set = window.KantoongAssistantContext?.page;
    if (typeof set === "function") return String(set() || "").slice(0, 120);
    if (set) return String(set).slice(0, 120);
    if (location.hash.startsWith("#produk/")) return `halaman produk "${document.title.split(" · ")[0]}"`;
    if (location.pathname.includes("/erp/")) return `menu ERP "${document.title.split(" — ")[0]}"`;
    return "";
}

/** Konteks ringkas yang dikirim ke AI (tanpa data sensitif). */
export function assistantContext() {
    const ctx = window.KantoongAssistantContext || {};
    const surface = currentSurface();
    return {
        surface,
        surface_label: SURFACES[surface] || surface,
        brand: brandName(),
        brand_id: brandId(),
        user_name: String(ctx.userName || "").slice(0, 60),
        network_memory: getMemoryScope() === "network",
        page_title: String(document.title || "").slice(0, 80),
        // Halaman/fitur yang sedang dibuka saat pesan dikirim (bukan saat asisten dipasang).
        page: currentPage(),
        // Dashboard user: ringkasan fitur pribadi — HANYA bila pengguna mengizinkan (js/ai-consent.js).
        dashboard_state: typeof ctx.state === "function" ? String(ctx.state() || "").slice(0, 2500) : "",
        // Sub-fitur yang boleh dibuka AI (daftar tetap dari ruang fitur).
        targets: typeof ctx.targets === "function" ? ctx.targets().slice(0, 120).map((t) => String(t).slice(0, 60)) : [],
    };
}

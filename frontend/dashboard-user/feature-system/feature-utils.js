/**
 * KANTOONG CORE — FEATURE SYSTEM: UTILS
 * File: frontend/dashboard-user/feature-system/feature-utils.js
 */

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
});

export function formatRupiah(value) {
    return rupiahFormatter.format(Number(value) || 0);
}

/**
 * Kemampuan input perangkat saat ini. Dibaca per kejadian (bukan
 * "jenis perangkat"), karena laptop layar sentuh punya keduanya.
 */
export function getInputCapabilities() {
    const query = (text) =>
        typeof window.matchMedia === "function" &&
        window.matchMedia(text).matches;

    return {
        coarsePointer: query("(pointer: coarse)"),
        canHover: query("(hover: hover)"),
    };
}

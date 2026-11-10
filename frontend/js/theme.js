/**
 * KANTOONG — TEMA GELAP / TERANG UNTUK SEMUA HALAMAN
 * File: frontend/js/theme.js
 *
 * Satu pengaturan untuk seluruh web, atau diatur per area:
 *   store     = toko / homepage (termasuk halaman produk & keranjang)
 *   dashboard = Dashboard User
 *   erp       = Dashboard admin ERP
 *   pos       = Kasir POS
 * Pilihan tiap area: "light" | "dark" | "system" (ikuti HP/laptop).
 *
 * Halaman memanggil applyTheme("store") dsb. Hasilnya atribut
 * <html data-theme="light|dark">. Perubahan di satu tab/iframe langsung
 * ikut ke tab lain (event storage). Disimpan di perangkat saja.
 */

import "./personalize.js";
import "./i18n.js";
import "./net-status.js";

export const THEME_KEY = "kantoong:theme";
export const AREAS = Object.freeze([
    { id: "store", label: "Toko & halaman produk" },
    { id: "dashboard", label: "Dashboard pribadi" },
    { id: "erp", label: "Dashboard admin (ERP)" },
    { id: "pos", label: "Kasir POS" },
]);
export const CHOICES = Object.freeze([
    { id: "light", label: "Terang" },
    { id: "dark", label: "Gelap" },
    { id: "system", label: "Ikuti perangkat" },
]);

const VALID = new Set(CHOICES.map((c) => c.id));

export function defaultPrefs() {
    return { mode: "all", all: "system", areas: { store: "system", dashboard: "system", erp: "system", pos: "system" } };
}

/** Bersihkan data simpanan (murni, dites). */
export function sanitizePrefs(raw) {
    const base = defaultPrefs();
    if (!raw || typeof raw !== "object") return base;
    const pick = (v, fallback) => (VALID.has(v) ? v : fallback);
    return {
        mode: raw.mode === "per-area" ? "per-area" : "all",
        all: pick(raw.all, base.all),
        areas: Object.fromEntries(AREAS.map((a) => [a.id, pick(raw.areas?.[a.id], base.areas[a.id])])),
    };
}

/** Pilihan untuk satu area: "light" | "dark" | "system". */
export function choiceFor(prefs, area) {
    const p = sanitizePrefs(prefs);
    return p.mode === "all" ? p.all : p.areas[area] ?? p.all;
}

/** Hasil akhir "light" | "dark" (system dibaca dari perangkat). */
export function resolveTheme(prefs, area, systemDark = false) {
    const choice = choiceFor(prefs, area);
    if (choice === "system") return systemDark ? "dark" : "light";
    return choice;
}

export function readPrefs() {
    try {
        return sanitizePrefs(JSON.parse(localStorage.getItem(THEME_KEY) || "null"));
    } catch {
        return defaultPrefs();
    }
}

export function savePrefs(prefs) {
    const clean = sanitizePrefs(prefs);
    try {
        localStorage.setItem(THEME_KEY, JSON.stringify(clean));
    } catch {
        /* diblokir: tetap berlaku di halaman ini */
    }
    window.dispatchEvent(new CustomEvent("kantoong:theme-changed", { detail: clean }));
    return clean;
}

const media = typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

let currentArea = null;

export function themeFor(area) {
    return resolveTheme(readPrefs(), area, Boolean(media?.matches));
}

/** Terapkan tema untuk area halaman ini (boleh dipanggil ulang, mis. ERP <-> kasir). */
export function applyTheme(area) {
    currentArea = area;
    const theme = themeFor(area);
    const root = document.documentElement;
    if (root.dataset.theme !== theme) {
        root.classList.add("kc-theme-switching");
        root.dataset.theme = theme;
        root.style.colorScheme = theme;
        setTimeout(() => root.classList.remove("kc-theme-switching"), 350);
    }
    window.dispatchEvent(new CustomEvent("kantoong:theme-applied", { detail: { area, theme } }));
    return theme;
}

/** Ubah pilihan satu area (atau semua bila mode "all"). */
export function setChoice(area, choice) {
    const prefs = readPrefs();
    if (prefs.mode === "all") prefs.all = choice;
    else prefs.areas[area] = choice;
    savePrefs(prefs);
    if (currentArea) applyTheme(currentArea);
}

if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
        if (event.key === THEME_KEY && currentArea) applyTheme(currentArea);
    });
    window.addEventListener("kantoong:theme-changed", () => {
        if (currentArea) applyTheme(currentArea);
    });
    media?.addEventListener?.("change", () => {
        if (currentArea) applyTheme(currentArea);
    });
}

/**
 * KANTOONG — DATA PRIBADI DI PERANGKAT (untuk sub-fitur dashboard user)
 * File: frontend/dashboard-user/home/me-store.js
 *
 * Alamat, acara kalender, batas belanja, paspor ukuran, garansi, dll.
 * disimpan di perangkat ini per brand (kunci kantoong:me:<brand>:<nama>).
 * Bisa dilihat & dihapus pengguna di Ekspor Data / Kartu Diriku (UU PDP).
 */

import CFG from "../../client-config.js";

const BID = CFG?.business_id ?? "master_template_001";
export const ME_PREFIX = `kantoong:me:${BID}:`;

export function readMe(name, fallback) {
    try {
        const raw = localStorage.getItem(ME_PREFIX + name);
        return raw == null ? fallback : JSON.parse(raw);
    } catch {
        return fallback;
    }
}

export function writeMe(name, value) {
    try {
        if (value == null) localStorage.removeItem(ME_PREFIX + name);
        else localStorage.setItem(ME_PREFIX + name, JSON.stringify(value));
    } catch {
        /* penyimpanan penuh / diblokir */
    }
    window.dispatchEvent(new CustomEvent("kantoong:me-changed", { detail: { name } }));
}

export const listMe = (name) => {
    const v = readMe(name, []);
    return Array.isArray(v) ? v : [];
};

export function addMe(name, item, { max = 100 } = {}) {
    const entry = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ...item };
    writeMe(name, [entry, ...listMe(name)].slice(0, max));
    return entry;
}

export function updateMe(name, id, patch) {
    writeMe(name, listMe(name).map((x) => (x.id === id ? { ...x, ...patch } : x)));
}

export const removeMe = (name, id) => writeMe(name, listMe(name).filter((x) => x.id !== id));

/** Semua kunci pribadi milik brand ini (untuk ekspor / hapus semua). */
export function allMeKeys() {
    const keys = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k?.startsWith(ME_PREFIX)) keys.push(k);
        }
    } catch {
        /* diblokir */
    }
    return keys;
}

/** Teks pendek aman untuk disimpan (tanpa tag). */
export const clean = (v, max = 120) => String(v ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);

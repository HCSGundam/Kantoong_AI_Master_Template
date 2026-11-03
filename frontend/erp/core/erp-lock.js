/**
 * KANTOONG ERP — KUNCI PINTU ERP
 * File: frontend/erp/core/erp-lock.js
 *
 * Login web hanya satu pintu, tetapi membuka ERP SELALU minta password
 * lagi. Tanda "terbuka" disimpan di sessionStorage (hilang saat tab
 * ditutup) dan kedaluwarsa setelah 30 menit tanpa aktivitas.
 *
 * Ini lapisan tambahan. Benteng utama tetap RLS di database: hanya email
 * yang didaftarkan owner/HR sebagai anggota yang bisa membaca data ERP.
 */

export const LOCK_KEY = "kantoong_erp_unlock";
export const IDLE_LIMIT_MS = 30 * 60 * 1000;

function read(storage) {
    try {
        return JSON.parse(storage.getItem(LOCK_KEY) || "null");
    } catch {
        return null;
    }
}

function write(storage, value) {
    try {
        if (value) storage.setItem(LOCK_KEY, JSON.stringify(value));
        else storage.removeItem(LOCK_KEY);
    } catch {
        // Penyimpanan diblokir: ERP akan selalu minta password (lebih aman).
    }
}

/** Dipanggil setelah password benar. */
export function unlock(userId, storage = sessionStorage, now = Date.now()) {
    write(storage, { uid: userId, at: now, last: now });
}

/** Terbuka hanya untuk akun yang sama & belum menganggur 30 menit. */
export function isUnlocked(userId, storage = sessionStorage, now = Date.now()) {
    const token = read(storage);
    return Boolean(token && userId && token.uid === userId && now - token.last < IDLE_LIMIT_MS);
}

/** Catat aktivitas terakhir (klik, ketik, gulir). */
export function touch(storage = sessionStorage, now = Date.now()) {
    const token = read(storage);
    if (token) write(storage, { ...token, last: now });
}

export function lock(storage = sessionStorage) {
    write(storage, null);
}

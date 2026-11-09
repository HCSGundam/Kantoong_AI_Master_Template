/**
 * KANTOONG ERP — KODE PASANGAN LAYAR PELANGGAN (logika murni, dites otomatis)
 * File: frontend/erp/core/display-code.js
 *
 * Tablet layar pelanggan tersambung ke kasir lewat Supabase Realtime pada saluran
 * "pos-display:<KODE>". Kode 6 karakter tanpa huruf/angka yang mirip (0/O, 1/I/L)
 * supaya mudah diketik: 31^6 ≈ 887 juta kemungkinan. Ganti kode = tablet lama putus.
 */

export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
export const TOPIC_PREFIX = "pos-display:";

/** Kode acak. random = fungsi 0..1 (bawaan: crypto bila ada). */
export function generateCode(random = null) {
    const pick = (max) => {
        if (random) return Math.floor(random() * max);
        const buffer = new Uint32Array(1);
        globalThis.crypto.getRandomValues(buffer);
        return buffer[0] % max;
    };
    let code = "";
    for (let index = 0; index < CODE_LENGTH; index += 1) code += CODE_ALPHABET[pick(CODE_ALPHABET.length)];
    return code;
}

/** Rapikan ketikan pengguna: huruf besar, buang spasi/strip, ganti huruf yang mirip. "" bila tidak valid. */
export function normalizeCode(input) {
    const cleaned = String(input || "").toUpperCase().replace(/[\s-]/g, "");
    return cleaned.length === CODE_LENGTH && [...cleaned].every((char) => CODE_ALPHABET.includes(char)) ? cleaned : "";
}

export function topicFor(code) {
    return `${TOPIC_PREFIX}${code}`;
}

/** Ambil kode dari alamat "#/pos/layar/ABC234". */
export function codeFromHash(hash) {
    const part = String(hash || "").split("/")[3] || "";
    return normalizeCode(decodeURIComponent(part));
}

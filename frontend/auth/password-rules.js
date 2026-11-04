/**
 * KANTOONG CORE — ATURAN PASSWORD (logika murni, dites otomatis)
 * File: frontend/auth/password-rules.js
 *
 * Dipakai oleh: ganti password (Profil), buat password baru (link email),
 * dan "lupa password" (halaman login web & ERP).
 */

export const PASSWORD_MIN = 8;

/** Halaman tujuan link "lupa password" di email (harus didaftarkan di Supabase). */
export const RESET_PATH = "/auth/reset-password.html";

export function resetRedirectUrl(origin) {
    return `${String(origin || "").replace(/\/$/, "")}${RESET_PATH}`;
}

/**
 * Cek password baru. Mengembalikan pesan kesalahan, atau "" bila aman.
 * current = password lama (boleh kosong untuk alur link email).
 */
export function validateNewPassword(next, confirm, current = "") {
    const value = String(next ?? "");

    if (value.length < PASSWORD_MIN) return `Password minimal ${PASSWORD_MIN} karakter.`;
    if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return "Password harus berisi huruf dan angka.";
    if (/^\s|\s$/.test(value)) return "Password tidak boleh diawali atau diakhiri spasi.";
    if (current && value === String(current)) return "Password baru harus berbeda dari password lama.";
    if (value !== String(confirm ?? "")) return "Ulangi password baru: belum sama.";
    return "";
}

export function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

/** Pesan Supabase -> bahasa sehari-hari. */
export function describePasswordError(error) {
    const message = String(error?.message ?? error ?? "");
    const code = String(error?.code ?? "");

    if (/invalid login credentials/i.test(message)) return "Password lama salah.";
    if (code === "same_password" || /different from the old/i.test(message)) return "Password baru harus berbeda dari password lama.";
    if (code === "weak_password" || /weak|should be at least/i.test(message)) return "Password terlalu lemah. Tambah panjang & campur huruf, angka, simbol.";
    if (/rate limit|security purposes|only request this after/i.test(message)) return "Terlalu sering meminta. Tunggu sekitar 1 menit lalu coba lagi.";
    if (/session missing|not authenticated|jwt/i.test(message)) return "Sesi sudah habis. Minta link baru lewat \"Lupa password\".";
    if (/redirect/i.test(message)) return "Alamat halaman reset belum didaftarkan di Supabase (Authentication → URL Configuration).";
    if (/failed to fetch|network/i.test(message)) return "Koneksi bermasalah. Coba lagi.";
    return message || "Gagal. Coba lagi.";
}

/** Error dari link email yang kedaluwarsa / sudah dipakai (ada di alamat halaman). */
export function readLinkError(hash = "", search = "") {
    const params = new URLSearchParams(String(hash).replace(/^#/, ""));
    const query = new URLSearchParams(String(search).replace(/^\?/, ""));
    const code = params.get("error_code") || query.get("error_code") || params.get("error") || query.get("error");
    if (!code) return "";
    if (/expired/i.test(code)) return "Link sudah kedaluwarsa atau sudah pernah dipakai. Minta link baru di bawah.";
    return "Link tidak berlaku. Minta link baru di bawah.";
}

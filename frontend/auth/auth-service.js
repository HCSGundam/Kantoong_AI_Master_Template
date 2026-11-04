/**
 * KANTOONG CORE — AUTH SERVICE
 * File: frontend/auth/auth-service.js
 *
 * Tanggung jawab: login/logout, lupa password, ganti password lewat Supabase Auth.
 * Tidak menyimpan password. Sesi dikelola oleh Supabase.
 */

import { supabase } from "../js/supabase-client.js";
import { resetRedirectUrl } from "./password-rules.js";

export async function signInWithEmail(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: String(email ?? "").trim(),
        password: String(password ?? ""),
    });

    if (error) {
        throw error;
    }

    return data.user;
}

/**
 * Lupa password: Supabase mengirim link ke email. Link membuka halaman
 * "Buat password baru" (RESET_PATH). Untuk keamanan, jawabannya sama
 * walau email tidak terdaftar.
 */
export async function sendPasswordReset(email, origin = window.location.origin) {
    const { error } = await supabase.auth.resetPasswordForEmail(String(email ?? "").trim(), {
        redirectTo: resetRedirectUrl(origin),
    });

    if (error) {
        throw error;
    }
}

/** Ganti password saat sudah login: password lama dicek dulu. */
export async function changePassword({ email, currentPassword, newPassword }) {
    const { error: checkError } = await supabase.auth.signInWithPassword({
        email: String(email ?? "").trim(),
        password: String(currentPassword ?? ""),
    });

    if (checkError) {
        throw checkError;
    }

    await setNewPassword(newPassword);
}

/** Simpan password baru untuk sesi yang sedang aktif (termasuk sesi dari link email). */
export async function setNewPassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: String(newPassword ?? "") });

    if (error) {
        throw error;
    }
}

export async function signOutUser() {
    const { error } = await supabase.auth.signOut();

    if (error) {
        throw error;
    }
}

export function onAuthStateChange(callback) {
    const { data } = supabase.auth.onAuthStateChange(
        (event, session) => callback(event, session)
    );

    return () => data.subscription.unsubscribe();
}

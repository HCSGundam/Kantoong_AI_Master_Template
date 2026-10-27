/**
 * KANTOONG CORE — AUTH SERVICE
 * File: frontend/auth/auth-service.js
 *
 * Tanggung jawab: login/logout lewat Supabase Auth.
 * Tidak menyimpan password. Sesi dikelola oleh Supabase.
 */

import { supabase } from "../js/supabase-client.js";

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

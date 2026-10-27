/**
 * KANTOONG CORE — AUTH SESSION
 * File: frontend/auth/auth-session.js
 *
 * Tanggung jawab: membaca sesi dan user yang sedang login.
 */

import { supabase } from "../js/supabase-client.js";

export async function getCurrentSession() {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
        throw error;
    }

    return data.session ?? null;
}

export async function getCurrentUser() {
    const session = await getCurrentSession();

    return session?.user ?? null;
}

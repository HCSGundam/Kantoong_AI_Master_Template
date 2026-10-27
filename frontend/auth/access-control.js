/**
 * KANTOONG CORE — ACCESS CONTROL
 * File: frontend/auth/access-control.js
 *
 * Menentukan apakah user yang login adalah OWNER.
 *
 * PENTING: pemeriksaan ini hanya mengatur tampilan. Keamanan
 * sebenarnya ada di RLS Supabase (lihat db/owner-and-pin.sql):
 * walau seseorang membuka halaman admin, ia tetap tidak bisa
 * menulis ke tabel products kalau bukan owner.
 */

import { supabase } from "../js/supabase-client.js";
import { getCurrentUser } from "./auth-session.js";

export const ACCESS = Object.freeze({
    SIGNED_OUT: "signed-out",
    NOT_OWNER: "not-owner",
    OWNER: "owner",
});

export async function isOwner(userId) {
    if (!userId) {
        return false;
    }

    const { data, error } = await supabase
        .from("owners")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return Boolean(data);
}

export async function checkOwnerAccess() {
    const user = await getCurrentUser();

    if (!user) {
        return { status: ACCESS.SIGNED_OUT, user: null };
    }

    const owner = await isOwner(user.id);

    return {
        status: owner ? ACCESS.OWNER : ACCESS.NOT_OWNER,
        user,
    };
}

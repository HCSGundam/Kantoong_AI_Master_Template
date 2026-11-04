/**
 * KANTOONG CORE — AUTH BRIDGE
 * File: frontend/dashboard-user/integrations/auth-bridge.js
 *
 * Penghubung antara Dashboard User dan Supabase Auth:
 * - membaca sesi dan role (owner / pelanggan)
 * - login Google dan email
 * - lupa password (link ke email) & ganti password
 * - keluar
 * - membuka Dashboard Admin
 *
 * CATATAN: Dashboard User berjalan di dalam iframe. Google menolak
 * login di dalam iframe, jadi pengalihan ke Google SELALU dilakukan
 * lewat jendela utama (window.top). Sesi tersimpan di localStorage
 * yang sama, sehingga homepage dan dashboard berbagi sesi.
 */

import { supabase } from "../../js/supabase-client.js";
import { changePassword, sendPasswordReset } from "../../auth/auth-service.js";
import { describePasswordError } from "../../auth/password-rules.js";

export { changePassword, describePasswordError };

/** Link reset dikirim dengan alamat jendela utama (Dashboard User ada di iframe). */
export function sendPasswordResetLink(email) {
    return sendPasswordReset(email, getTopWindow().location.origin);
}

// Dashboard perusahaan (ERP). Membukanya selalu minta password lagi.
const ADMIN_PATH = "/erp/erp.html";

function getTopWindow() {
    try {
        if (window.top && window.top.location.origin) {
            return window.top;
        }
    } catch {
        // Lintas origin: pakai jendela saat ini.
    }

    return window;
}

/** Setelah login Google, pengguna dikembalikan ke halaman utama ini. */
function getRedirectUrl() {
    const topWindow = getTopWindow();

    return `${topWindow.location.origin}${topWindow.location.pathname}`;
}

export function describeAuthError(error) {
    const message = String(error?.message ?? error ?? "");

    if (/invalid login credentials/i.test(message)) {
        return "Email atau password salah.";
    }

    if (/provider is not enabled|unsupported provider/i.test(message)) {
        return "Login Google belum diaktifkan di Supabase.";
    }

    if (/redirect/i.test(message)) {
        return "Alamat pengalihan belum didaftarkan di Supabase (URL Configuration).";
    }

    if (/failed to fetch|network/i.test(message)) {
        return "Koneksi bermasalah. Coba lagi.";
    }

    return message || "Gagal masuk. Coba lagi.";
}

/**
 * Apakah akun ini anggota perusahaan (owner/karyawan di tabel members)?
 * Pelanggan biasa -> null (tidak melihat tombol dashboard sama sekali).
 * Cadangan: tabel owners lama bila database ERP belum dipasang.
 */
async function getCompanyAccess(userId) {
    try {
        const linked = await supabase.rpc("erp_link_me");

        if (!linked.error && linked.data) {
            const { data: member } = await supabase
                .from("members")
                .select("full_name, position_title, level, is_active")
                .eq("id", linked.data)
                .maybeSingle();

            if (member?.is_active) {
                return { title: member.position_title || "Anggota", name: member.full_name };
            }
            return null;
        }

        const { data, error } = await supabase
            .from("owners")
            .select("user_id")
            .eq("user_id", userId)
            .maybeSingle();

        return !error && data ? { title: "Owner", name: "" } : null;
    } catch {
        return null;
    }
}

/**
 * Mengembalikan objek user untuk Profile, atau null bila belum login.
 */
export async function getDashboardUser() {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data?.session?.user) {
        return null;
    }

    const user = data.session.user;
    const meta = user.user_metadata ?? {};
    const email = user.email ?? "";
    const company = await getCompanyAccess(user.id);
    const providers = user.app_metadata?.providers ?? [user.app_metadata?.provider];

    return {
        authenticated: true,
        // Akun email punya password Kantoong; akun Google saja tidak.
        hasPassword: providers.includes("email"),
        id: user.id,
        name: String(
            meta.full_name || meta.name || company?.name || email.split("@")[0] || "Pengguna"
        ),
        email,
        role: company ? company.title : "Pelanggan",
        // isOwner dipertahankan agar kompatibel: artinya "anggota perusahaan".
        isOwner: Boolean(company),
        isStaff: Boolean(company),
        avatarUrl: String(meta.avatar_url || meta.picture || ""),
    };
}

export async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: getRedirectUrl(),
            skipBrowserRedirect: true,
            queryParams: { prompt: "select_account" },
        },
    });

    if (error) {
        throw error;
    }

    if (!data?.url) {
        throw new Error("Tautan login Google tidak tersedia.");
    }

    getTopWindow().location.assign(data.url);
}

export async function signInWithEmail(email, password) {
    const { error } = await supabase.auth.signInWithPassword({
        email: String(email ?? "").trim(),
        password: String(password ?? ""),
    });

    if (error) {
        throw error;
    }
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
        throw error;
    }
}

export function openAdmin() {
    const topWindow = getTopWindow();

    topWindow.location.assign(
        new URL(ADMIN_PATH, topWindow.location.origin).href
    );
}

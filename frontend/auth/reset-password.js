/**
 * KANTOONG CORE — HALAMAN BUAT PASSWORD BARU
 * File: frontend/auth/reset-password.js
 *
 * Alur "lupa password":
 *   1. Pengguna minta link (halaman login web / ERP, atau di halaman ini).
 *   2. Supabase mengirim email berisi link ke halaman ini.
 *   3. Link membawa sesi sementara -> pengguna menulis password baru -> disimpan.
 * Password tidak pernah disimpan di kode atau dikirim ke tempat lain selain Supabase.
 */

import { supabase } from "../js/supabase-client.js";
import { sendPasswordReset, setNewPassword } from "./auth-service.js";
import { describePasswordError, isEmail, readLinkError, validateNewPassword } from "./password-rules.js";

const $ = (id) => document.getElementById(id);
const WAIT_FOR_LINK_MS = 4000;
// Dicatat SEBELUM Supabase membersihkan alamat: halaman ini dibuka dari link email?
// Tanpa link, orang yang sekadar sedang login TIDAK boleh ganti password di sini
// (ganti password biasa ada di Profil dan wajib password lama).
const FROM_EMAIL_LINK = /type=recovery|access_token=|[?&]code=/.test(location.hash + location.search);

function say(text, kind = "info") {
    const message = $("krMessage");
    message.textContent = text;
    message.dataset.kind = kind;
    message.hidden = !text;
}

function showRequest(intro) {
    $("krIntro").textContent = intro;
    $("krNewForm").hidden = true;
    $("krRequestForm").hidden = false;
    $("krEmail").focus();
}

function showNewPassword(session) {
    $("krIntro").textContent = "Tulis password baru untuk akunmu.";
    $("krAccount").textContent = session.user?.email ? `Akun: ${session.user.email}` : "";
    $("krRequestForm").hidden = true;
    $("krNewForm").hidden = false;
    $("krNew").focus();
    // Token dari link tidak perlu terlihat di alamat halaman.
    history.replaceState(null, "", location.pathname);
}

/** Tunggu sesi dari link email (Supabase membacanya otomatis dari alamat halaman). */
function waitForRecoverySession() {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (session) => {
            if (settled) return;
            settled = true;
            subscription.unsubscribe();
            resolve(session);
        };
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session && (event === "PASSWORD_RECOVERY" || FROM_EMAIL_LINK)) finish(session);
        });
        supabase.auth.getSession().then(({ data }) => {
            if (data.session && FROM_EMAIL_LINK) finish(data.session);
        });
        setTimeout(() => finish(null), WAIT_FOR_LINK_MS);
    });
}

$("krShow").addEventListener("change", (event) => {
    const type = event.target.checked ? "text" : "password";
    $("krNew").type = type;
    $("krConfirm").type = type;
});

$("krNewForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const problem = validateNewPassword($("krNew").value, $("krConfirm").value);
    if (problem) {
        say(problem, "error");
        return;
    }
    const button = event.submitter;
    button.disabled = true;
    say("Menyimpan…");
    try {
        await setNewPassword($("krNew").value);
        $("krNewForm").hidden = true;
        $("krIntro").textContent = "Selesai.";
        $("krDone").hidden = false;
        say("✔ Password berhasil diganti. Pakai password baru untuk masuk ke web & ERP.", "success");
    } catch (error) {
        say(describePasswordError(error), "error");
        button.disabled = false;
    }
});

$("krRequestForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("krEmail").value.trim();
    if (!isEmail(email)) {
        say("Tulis email yang benar.", "error");
        return;
    }
    const button = event.submitter;
    button.disabled = true;
    say("Mengirim…");
    try {
        await sendPasswordReset(email);
        say("✔ Kalau email itu terdaftar, link sudah dikirim. Cek kotak masuk (dan folder spam).", "success");
    } catch (error) {
        say(describePasswordError(error), "error");
    } finally {
        button.disabled = false;
    }
});

async function start() {
    const linkError = readLinkError(location.hash, location.search);
    if (linkError) {
        history.replaceState(null, "", location.pathname);
        say(linkError, "error");
        showRequest("Minta link baru untuk membuat password.");
        return;
    }
    const session = await waitForRecoverySession();
    if (session) showNewPassword(session);
    else showRequest("Buka halaman ini dari link di email \"Reset password\". Belum punya link? Minta di sini.");
}

start();

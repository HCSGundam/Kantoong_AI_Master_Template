/**
 * KANTOONG ERP — JEMBATAN KASIR ↔ LAYAR PELANGGAN
 * File: frontend/erp/data/display-link.js
 *
 * Dua jalur sekaligus:
 *   1. LOKAL  : BroadcastChannel — jendela lain di browser & komputer yang sama
 *               (monitor kedua). Tetap jalan saat offline.
 *   2. TABLET : Supabase Realtime, saluran "pos-display:<KODE>" — perangkat lain lewat internet.
 *               Mode asli memakai saluran PRIVAT: hanya akun staf ERP yang login boleh
 *               ikut mendengar/mengirim (izin di db/erp-pos-pro.sql bagian 14).
 *               Mode demo memakai saluran biasa (data fiktif) agar bisa dipamerkan.
 * Pesan diberi id unik: pesan yang datang lewat dua jalur hanya diproses sekali.
 */

import { supabase } from "../../js/supabase-client.js";
import { topicFor } from "../core/display-code.js";

export const DISPLAY_CHANNEL = "kantoong-pos-display";

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * Buka jembatan. onStatus("lokal" | "menyambung" | "tersambung" | "terputus").
 * Mengembalikan { post(message), onMessage(fn), close(), code }.
 */
export function openDisplayLink({ code = "", isPrivate = true, onStatus = () => {} } = {}) {
    const listeners = new Set();
    const seen = new Set();
    let remote = null;
    let remoteReady = false;
    let pendingCart = null;   // keranjang: cukup yang terbaru
    const queue = [];         // pesan penting (lunas, sapaan, penilaian): semuanya dikirim berurutan
    let sendTimer = null;

    const deliver = (message) => {
        if (!message || typeof message !== "object" || !message.type) return;
        if (message._id) {
            if (seen.has(message._id)) return;
            seen.add(message._id);
            if (seen.size > 300) seen.delete(seen.values().next().value);
        }
        listeners.forEach((fn) => {
            try {
                fn(message);
            } catch (error) {
                console.error("[layar pelanggan]", error);
            }
        });
    };

    // Jalur 1: lokal.
    const local = typeof BroadcastChannel === "function" ? new BroadcastChannel(DISPLAY_CHANNEL) : null;
    if (local) local.onmessage = (event) => deliver(event.data);

    // Jalur 2: tablet lewat internet.
    if (code) {
        onStatus("menyambung");
        try {
            remote = supabase.channel(topicFor(code), { config: { private: isPrivate, broadcast: { self: false } } });
            remote
                .on("broadcast", { event: "msg" }, ({ payload }) => deliver(payload))
                .subscribe((status) => {
                    remoteReady = status === "SUBSCRIBED";
                    onStatus(remoteReady ? "tersambung" : status === "CLOSED" ? "terputus" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "terputus" : "menyambung");
                    if (remoteReady) flush();
                });
        } catch (error) {
            console.warn("[layar pelanggan] Realtime tidak tersedia:", error?.message);
            onStatus("terputus");
        }
    } else {
        onStatus("lokal");
    }

    function flush() {
        if (!remote || !remoteReady) return;
        const send = (payload) => remote.send({ type: "broadcast", event: "msg", payload }).catch(() => {});
        while (queue.length) send(queue.shift());
        if (pendingCart) {
            send(pendingCart);
            pendingCart = null;
        }
    }

    return {
        code,
        post(message) {
            const stamped = { ...message, _id: newId() };
            seen.add(stamped._id);
            try {
                local?.postMessage(stamped);
            } catch {
                // Layar pelanggan opsional.
            }
            if (!remote) return;
            // Isi keranjang berubah cepat: kirim yang terbaru saja (maks ±6 kali/detik).
            if (stamped.type === "cart") {
                pendingCart = stamped;
                clearTimeout(sendTimer);
                sendTimer = setTimeout(flush, 160);
            } else {
                queue.push(stamped);
                if (queue.length > 20) queue.shift();
                flush();
            }
        },
        onMessage(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        close() {
            clearTimeout(sendTimer);
            local?.close();
            if (remote) supabase.removeChannel(remote).catch(() => {});
        },
    };
}

/* ---------- Kode pasangan yang sedang dipakai kasir (per perangkat & outlet) ---------- */

const keyFor = (outletId) => `kantoong:display-code:${outletId || "default"}`;

export function readPairCode(outletId) {
    try {
        return localStorage.getItem(keyFor(outletId)) || "";
    } catch {
        return "";
    }
}

export function savePairCode(outletId, code) {
    try {
        if (code) localStorage.setItem(keyFor(outletId), code);
        else localStorage.removeItem(keyFor(outletId));
    } catch {
        // Penyimpanan diblokir: kode berlaku selama halaman terbuka.
    }
}

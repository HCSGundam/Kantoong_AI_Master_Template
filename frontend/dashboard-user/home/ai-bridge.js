/**
 * KANTOONG — JEMBATAN FITUR ↔ ASISTEN AI (dashboard user)
 * File: frontend/dashboard-user/home/ai-bridge.js
 *
 * - Setiap ruang fitur melapor ringkasan (konteks + entitas) lewat snapshot().
 * - Bila pengguna MENGIZINKAN (js/ai-consent.js, ditanya sekali), ringkasan itu
 *   ikut terkirim bersama pesan chat → AI bisa menjawab "paketku sampai mana?"
 *   dari data asli tanpa pengguna menjelaskan.
 * - AI boleh membuka sub-fitur (aksi "open-feature" dari backend), HANYA yang
 *   ada di daftar target ruang (tidak bisa disuruh membuka hal lain).
 * - Tanpa izin: AI hanya tahu isi chat. Tidak ada yang dikirim.
 */

import { askConsent, consentGranted, getConsent } from "../../js/ai-consent.js";

const rooms = new Map();
let stateText = "";
let busy = false;
let timer = 0;

export function registerRoom(def) {
    if (def?.id) rooms.set(def.id, def);
}

export const listTargets = () => [...rooms.values()].flatMap((d) => [d.id, ...(d.tools ?? []).map((t) => `${d.id}/${t.id}`)]);

/** Kumpulkan ringkasan semua ruang (maks ±2.500 karakter). */
export async function refreshSnapshots() {
    if (busy) return stateText;
    if (!consentGranted()) {
        stateText = "";
        return stateText;
    }
    busy = true;
    try {
        const parts = await Promise.all([...rooms.values()].filter((d) => d.snapshot).map(async (d) => {
            try {
                const data = (await d.load?.()) ?? {};
                const text = String(d.snapshot(data) ?? "").replace(/\s+/g, " ").trim();
                return text ? `[${d.title}] ${text}` : "";
            } catch {
                return "";
            }
        }));
        stateText = parts.filter(Boolean).join("\n").slice(0, 2500);
    } finally {
        busy = false;
    }
    return stateText;
}

/** Buka fitur (+ sub-fitur) dari Sinyal atau aksi AI. */
export function openTarget(target) {
    const [feature, tool] = String(target ?? "").split("/");
    if (!rooms.has(feature) && feature !== "cart" && feature !== "product-catalog") return false;
    if (feature === "cart") {
        window.parent?.postMessage({ type: "kantoong:open-cart" }, window.location.origin);
        return true;
    }
    window.__kcPendingTool = { feature, tool: tool || null };
    window.dispatchEvent(new CustomEvent("kantoong:bento-open", { detail: { id: feature } }));
    setTimeout(() => window.dispatchEvent(new CustomEvent("kantoong:room-open", { detail: { feature, tool: tool || null } })), 120);
    return true;
}

/** Pasang ke konteks asisten + tanya izin sekali. */
export function startAiBridge(defs = []) {
    defs.forEach(registerRoom);
    const ctx = (window.KantoongAssistantContext = window.KantoongAssistantContext || {});
    ctx.state = () => (consentGranted() ? stateText : "");
    ctx.targets = () => listTargets();

    refreshSnapshots();
    clearInterval(timer);
    timer = setInterval(refreshSnapshots, 60_000);
    window.addEventListener("kantoong:ai-consent", refreshSnapshots);
    window.addEventListener("kantoong:me-changed", () => setTimeout(refreshSnapshots, 300));
    window.addEventListener("kantoong:ai-open-feature", (event) => openTarget(event.detail?.target));

    // Pilihan Koko (a): ditanya SEKALI saat pertama membuka dashboard.
    if (getConsent() === null) setTimeout(() => askConsent({ onDone: refreshSnapshots }), 1600);
}

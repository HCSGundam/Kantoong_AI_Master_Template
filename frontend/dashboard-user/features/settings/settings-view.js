/**
 * KANTOONG CORE — SETTINGS VIEW
 * File: frontend/dashboard-user/features/settings/settings-view.js
 *
 * Pengaturan: panel Tampilan (tema, warna chat, 50 font — js/appearance-panel.js),
 * tata letak menu, dan riwayat aktivitas.
 */

import { el } from "../../home/home-icons.js";
import { renderAppearance } from "../../../js/appearance-panel.js";

const registry = new WeakMap();

export function renderSettingsView({ rootElement, context }) {
    destroySettingsView({ rootElement });

    const api = context?.dashboardApi ?? null;
    const feedback = el("p", "kc-settings__feedback bx-muted");
    feedback.setAttribute("role", "status");

    const say = (message) => {
        feedback.textContent = message;
    };

    const appearanceBox = el("div", "kc-appearance");

    const reset = el("button", "bx-btn bx-btn--ghost", "Kembalikan tata letak");
    reset.type = "button";
    reset.addEventListener("click", () => {
        api?.resetLayout?.();
        say("Tata letak dikembalikan.");
    });

    const clear = el("button", "bx-btn bx-btn--ghost", "Hapus riwayat sekarang");
    clear.type = "button";
    clear.addEventListener("click", () => {
        api?.clearHistory?.();
        say("Riwayat dihapus.");
    });

    const page = el("div", "bx-detail kc-settings",
        el("section", "bx-hero-stat",
            el("p", "bx-eyebrow", "Pengaturan"),
            el("p", "bx-hero-stat__value bx-hero-stat__value--sm", "Tampilan & privasi"),
            el("p", "bx-muted", "Tema, warna kotak chat, dan 50 pilihan font — atur sesuka hatimu. Hanya berlaku di browser ini.")),
        appearanceBox,
        el("h3", "bx-h", "Tata letak menu"),
        el("p", "bx-muted", "Kembalikan susunan kartu ke tampilan awal di perangkat ini."),
        el("div", "bx-actions", reset),
        el("h3", "bx-h", "Riwayat aktivitas"),
        el("p", "bx-muted", "Riwayat hanya tersimpan di perangkatmu dan dihapus otomatis tiap Minggu pukul 00.00."),
        el("div", "bx-actions", clear),
        feedback,
    );

    renderAppearance(appearanceBox);
    rootElement.replaceChildren(page);
    registry.set(rootElement, { page });
    return { page };
}

export function destroySettingsView({ rootElement }) {
    const entry = registry.get(rootElement);
    if (entry) {
        entry.page.remove();
        registry.delete(rootElement);
    }
    rootElement.replaceChildren();
}

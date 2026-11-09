/**
 * KANTOONG CORE — SETTINGS VIEW
 * File: frontend/dashboard-user/features/settings/settings-view.js
 *
 * Pengaturan: tema gelap/terang untuk SEMUA halaman sekaligus atau per
 * halaman (toko, dashboard, ERP, kasir) lewat js/theme.js, tata letak
 * menu, dan riwayat aktivitas.
 */

import { AREAS, CHOICES, readPrefs, savePrefs } from "../../../js/theme.js";
import { el, icon } from "../../home/home-icons.js";

const registry = new WeakMap();

const SWATCH = {
    light: ["#fffdf8", "#16130e"],
    dark: ["#16130e", "#f1e9d6"],
    system: ["linear-gradient(135deg, #fffdf8 50%, #16130e 50%)", "#b8913f"],
};

function choiceCard(choice, on, onPick) {
    const [bg, ink] = SWATCH[choice.id];
    const preview = el("span", "kc-theme__preview",
        el("span", "kc-theme__line"),
        el("span", "kc-theme__line kc-theme__line--short"),
        el("span", "kc-theme__dot"));
    preview.style.background = bg;
    preview.style.color = ink;
    const card = el("button", `kc-theme__card${on ? " is-on" : ""}`, preview, el("span", "kc-theme__label", choice.label));
    card.type = "button";
    card.setAttribute("aria-pressed", String(on));
    card.addEventListener("click", onPick);
    return card;
}

function segmented(value, onPick) {
    const wrap = el("div", "kc-seg");
    CHOICES.forEach((c) => {
        const b = el("button", `kc-seg__btn${c.id === value ? " is-on" : ""}`, c.label);
        b.type = "button";
        b.setAttribute("aria-pressed", String(c.id === value));
        b.addEventListener("click", () => onPick(c.id));
        wrap.append(b);
    });
    return wrap;
}

export function renderSettingsView({ rootElement, context }) {
    destroySettingsView({ rootElement });

    const api = context?.dashboardApi ?? null;
    const feedback = el("p", "kc-settings__feedback bx-muted");
    feedback.setAttribute("role", "status");

    const say = (message) => {
        feedback.textContent = message;
    };

    const themeBox = el("div", "kc-theme");

    function drawTheme() {
        const prefs = readPrefs();
        const modeSwitch = el("div", "bx-chips");
        [["all", "Semua halaman sama"], ["per-area", "Atur per halaman"]].forEach(([id, label]) => {
            const chip = el("button", `bx-chip${prefs.mode === id ? " is-on" : ""}`, label);
            chip.type = "button";
            chip.setAttribute("aria-pressed", String(prefs.mode === id));
            chip.addEventListener("click", () => {
                savePrefs({ ...prefs, mode: id });
                drawTheme();
            });
            modeSwitch.append(chip);
        });

        const body = prefs.mode === "all"
            ? el("div", "kc-theme__cards", CHOICES.map((c) => choiceCard(c, prefs.all === c.id, () => {
                savePrefs({ ...prefs, all: c.id });
                drawTheme();
                say(`Tema ${c.label.toLowerCase()} untuk semua halaman.`);
            })))
            : el("div", "kc-theme__rows", AREAS.map((area) => el("div", "kc-theme__row",
                el("span", "kc-theme__area", icon({ store: "product-catalog", dashboard: "profile", erp: "spending-analytics", pos: "point-of-sale" }[area.id]), area.label),
                segmented(prefs.areas[area.id], (value) => {
                    savePrefs({ ...prefs, areas: { ...prefs.areas, [area.id]: value } });
                    drawTheme();
                    say(`${area.label}: ${CHOICES.find((c) => c.id === value).label}.`);
                }))));

        themeBox.replaceChildren(modeSwitch, body);
    }

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
            el("p", "bx-muted", "Atur mode gelap atau terang untuk seluruh web, atau per halaman sesukamu.")),
        el("h3", "bx-h", "Tema"),
        themeBox,
        el("h3", "bx-h", "Tata letak menu"),
        el("p", "bx-muted", "Kembalikan susunan kartu ke tampilan awal di perangkat ini."),
        el("div", "bx-actions", reset),
        el("h3", "bx-h", "Riwayat aktivitas"),
        el("p", "bx-muted", "Riwayat hanya tersimpan di perangkatmu dan dihapus otomatis tiap Minggu pukul 00.00."),
        el("div", "bx-actions", clear),
        feedback,
    );

    drawTheme();
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

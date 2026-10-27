/**
 * KANTOONG CORE — SETTINGS VIEW
 * File: frontend/dashboard-user/features/settings/settings-view.js
 *
 * Tampilan Pengaturan Aplikasi. Seluruh aksi lewat
 * context.dashboardApi (disediakan dashboard-user.js).
 */

function el(tag, className, text) {
    const node = document.createElement(tag);

    if (className) {
        node.className = className;
    }

    if (text !== undefined) {
        node.textContent = text;
    }

    return node;
}

function createSection(title, description) {
    const section = el("section", "kc-settings__section");

    section.append(
        el("h2", "kc-settings__section-title", title),
        el("p", "kc-settings__section-text", description)
    );

    return section;
}

function createButton(label, action, extraClass = "") {
    const button = el(
        "button",
        `kc-settings__button ${extraClass}`.trim(),
        label
    );

    button.type = "button";
    button.dataset.settingsAction = action;

    return button;
}

const registry = new WeakMap();

export function renderSettingsView({ rootElement, context }) {
    destroySettingsView({ rootElement });

    const api = context?.dashboardApi ?? null;

    const page = el("div", "kc-settings");

    const heading = el("header", "kc-settings__header");
    heading.append(
        el("p", "kc-settings__eyebrow", "PENGATURAN"),
        el("h1", "kc-settings__title", "Pengaturan Aplikasi"),
        el(
            "p",
            "kc-settings__text",
            "Sesuaikan tampilan dan kelola data aktivitasmu."
        )
    );

    // --- Tema
    const themeSection = createSection(
        "Tema",
        "Pilih tampilan yang nyaman di matamu."
    );

    const themeGroup = el("div", "kc-settings__group");
    const lightButton = createButton("Terang", "theme-light");
    const darkButton = createButton("Gelap", "theme-dark");

    themeGroup.append(lightButton, darkButton);
    themeSection.append(themeGroup);

    // --- Tata letak
    const layoutSection = createSection(
        "Tata letak menu",
        "Kembalikan susunan kartu ke tampilan awal di perangkat ini."
    );
    layoutSection.append(
        createButton("Kembalikan tata letak", "reset-layout")
    );

    // --- Privasi
    const privacySection = createSection(
        "Riwayat aktivitas",
        "Riwayat hanya tersimpan di perangkatmu dan dihapus otomatis tiap Minggu pukul 00.00."
    );
    privacySection.append(
        createButton("Hapus riwayat sekarang", "clear-history")
    );

    const feedback = el("p", "kc-settings__feedback");
    feedback.setAttribute("role", "status");
    feedback.hidden = true;

    page.append(
        heading,
        themeSection,
        layoutSection,
        privacySection,
        feedback
    );

    const syncTheme = () => {
        const theme = api?.getTheme?.() ?? "light";

        lightButton.setAttribute("aria-pressed", String(theme !== "dark"));
        darkButton.setAttribute("aria-pressed", String(theme === "dark"));
    };

    const say = (message) => {
        feedback.textContent = message;
        feedback.hidden = !message;
    };

    const handleClick = (event) => {
        const button = event.target.closest("[data-settings-action]");

        if (!button || !page.contains(button)) {
            return;
        }

        if (!api) {
            say("Pengaturan belum tersedia.");
            return;
        }

        switch (button.dataset.settingsAction) {
            case "theme-light":
                api.setTheme("light");
                syncTheme();
                say("Tema terang aktif.");
                break;

            case "theme-dark":
                api.setTheme("dark");
                syncTheme();
                say("Tema gelap aktif.");
                break;

            case "reset-layout":
                api.resetLayout();
                say("Tata letak dikembalikan.");
                break;

            case "clear-history":
                api.clearHistory();
                say("Riwayat dihapus.");
                break;

            default:
                break;
        }
    };

    page.addEventListener("click", handleClick);
    syncTheme();

    rootElement.replaceChildren(page);
    registry.set(rootElement, { page, handleClick });

    return { page };
}

export function destroySettingsView({ rootElement }) {
    const entry = registry.get(rootElement);

    if (entry) {
        entry.page.removeEventListener("click", entry.handleClick);
        entry.page.remove();
        registry.delete(rootElement);
    }

    rootElement.replaceChildren();
}

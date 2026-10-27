/**
 * KANTOONG CORE — SETTINGS FEATURE
 * File: frontend/dashboard-user/features/settings/feature.js
 *
 * Kartu awal kedua: Pengaturan Aplikasi (tema, tata letak, privasi).
 */

import { defineFeature } from "../../core/feature-contract.js";

import {
    destroySettingsView,
    renderSettingsView,
} from "./settings-view.js";

import "./settings.css";

const settingsFeature = defineFeature({
    id: "settings",
    name: "Pengaturan Aplikasi",
    title: "Pengaturan Aplikasi",
    description: "Atur tema, tata letak, dan privasi riwayat.",
    category: "settings",
    icon: "settings",

    enabled: true,
    status: "active",
    order: 20,

    // Tampil otomatis di dashboard baru (kartu awal kedua).
    defaultActive: true,
    available: true,
    defaultSize: { width: 2, height: 2 },

    // Ringkasan di kartu dashboard.
    async summary({ dashboardApi } = {}) {
        const theme =
            dashboardApi?.getTheme?.() === "dark" ? "Gelap" : "Terang";

        return {
            title: `Tema ${theme}`,
            text: "Atur tampilan, tata letak, dan privasi.",
        };
    },

    // Isi tanggal rilis (YYYY-MM-DD) bila ingin tag NEW tampil 14 hari.
    // publishedAt: "2026-10-26",

    tags: ["pengaturan", "settings", "tema", "tampilan", "privasi"],

    permissions: {
        requireAuthentication: false,
        roles: [],
        permissions: [],
        allowWhenRoleMissing: true,
    },

    async mount(context) {
        const rootElement = context?.element ?? context?.rootElement;

        if (!rootElement) {
            throw new Error("[KANTOONG Settings] Root element wajib tersedia.");
        }

        return renderSettingsView({ rootElement, context });
    },

    async unmount(context) {
        const rootElement = context?.element ?? context?.rootElement;

        if (rootElement) {
            destroySettingsView({ rootElement });
        }
    },
});

export default settingsFeature;

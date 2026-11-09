/**
 * ============================================================
 * KANTOONG CORE
 * FILE: frontend/dashboard-user/dashboard-user.js
 * ============================================================
 *
 * TANGGUNG JAWAB:
 * 1. Menginisialisasi state dashboard.
 * 2. Mengelola katalog fitur dan kartu aktif.
 * 3. Merender kartu melalui HTML template.
 * 4. Mengelola layout, koordinat, ukuran, dan tabrakan kartu.
 * 5. Menyimpan serta memulihkan preferensi layout.
 * 6. Mengaktifkan dan menonaktifkan mode edit.
 * 7. Mengelola pencarian fitur.
 * 8. Mengelola Feature Hub.
 * 9. Mengelola tema.
 * 10. Mengelola navigation history.
 * 11. Menyediakan API untuk dashboard-user-events.js.
 *
 * CATATAN:
 * - Modul ini tidak menjalankan AI atau memanggil API rahasia.
 * - Modul fitur akan diregistrasikan oleh feature loader.
 * - Event interaksi akan dihubungkan oleh events/bootstrap.
 * - Posisi kartu menggunakan koordinat grid x/y.
 * ============================================================
 */

import { createBento } from "./home/bento.js";
import { getStorefront, onStorefrontChange, startStorefrontSync } from "../js/storefront-settings.js";
import { applyTheme, setChoice, themeFor } from "../js/theme.js";
import { createShelf } from "./home/shelf.js";
import { renderWelcome } from "./home/welcome.js";
import "./home/home.css";
import {
    DASHBOARD_USER_CONFIG,
    getDashboardGridColumns,
    normalizeDashboardCardSize,
} from "./dashboard-user-config.js";

import { getSizePresets, formatSize, getCardMode } from "./adaptive-menu/adaptive-menu-resize.js";
import { applyTextFade, createSummaryBox } from "./feature-system/feature-ui.js";
import { createFeatureHub } from "./feature-hub/feature-hub.js";
import { initFeatureHub } from "./feature-hub/feature-hub-bootstrap.js";


/* ============================================================
   01. CONSTANTS
   ============================================================ */

const CONFIG = DASHBOARD_USER_CONFIG;

const ROOT_SELECTOR = "[data-dashboard-user-root]";

const LAYOUT_MODE_VIEW = "view";
const LAYOUT_MODE_EDIT = "edit";

const DEFAULT_TENANT_ID = "default-tenant";
const DEFAULT_USER_ID = "local-user";

const MAX_LAYOUT_SEARCH_ROWS = 1000;

const HISTORY_EVENT_NAME = "kantoong:dashboard-history-updated";
const LAYOUT_EVENT_NAME = "kantoong:dashboard-layout-updated";
const FEATURE_EVENT_NAME = "kantoong:dashboard-feature-open";
const THEME_EVENT_NAME = "kantoong:dashboard-theme-changed";


/* ============================================================
   02. STATE
   ============================================================ */

const state = {
    initialized: false,

    root: null,
    elements: {},

    mode: LAYOUT_MODE_VIEW,
    theme: CONFIG.theme.default,

    viewportWidth: 0,
    gridColumns: CONFIG.layout.columns.desktop,
    gridProfile: "desktop",

    /**
     * Semua modul yang berhasil diregistrasikan.
     *
     * Map:
     * featureId => feature descriptor
     */
    featureCatalog: new Map(),

    /**
     * Feature ID yang sedang muncul pada dashboard.
     */
    activeFeatureIds: new Set(),

    /**
     * Layout dipisahkan berdasarkan profil layar.
     *
     * Dengan demikian, susunan mobile dapat berbeda
     * dari susunan desktop tanpa saling menimpa.
     */
    layouts: {
        mobile: [],
        tablet: [],
        desktop: [],
    },

    /**
     * Katalog awal yang akan ditampilkan jika pengguna
     * belum memiliki pilihan fitur tersimpan.
     */
    featureSelectionLoaded: false,

    /** ID fitur yang pernah terdaftar (agar fitur baru bisa muncul otomatis). */
    knownFeatureIds: new Set(),

    // Menyimpan kondisi layout sebelum mode edit dimulai
    layoutEditSnapshot: null,

    /**
     * Layout disimpan dengan struktur:
     *
     * {
     *   version: 1,
     *   profiles: {
     *     mobile: [...],
     *     tablet: [...],
     *     desktop: [...]
     *   }
     * }
     */
    layoutLoaded: false,

    /**
     * Navigation history.
     *
     * Tidak boleh berisi password, token, API key,
     * atau rahasia autentikasi.
     */
    history: [],

    searchQuery: "",

    /**
     * Mencegah inisialisasi berulang.
     */
    abortController: null,

    /**
     * Timer untuk pembersihan riwayat.
     */
    historyCleanupTimer: null,

    /**
     * Batas jumlah entri pada session saat ini.
     */
    maximumHistoryEntries: CONFIG.history.maximumEntries,
};


/* ============================================================
   03. GENERAL HELPERS
   ============================================================ */

function isObject(value) {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}


function clamp(value, minimum, maximum) {
    return Math.min(
        maximum,
        Math.max(minimum, value)
    );
}


function normalizeString(value, fallback = "") {
    if (typeof value !== "string") {
        return fallback;
    }

    return value.trim();
}


function dispatchDashboardEvent(name, detail = {}) {
    if (!state.root) {
        return;
    }

    state.root.dispatchEvent(
        new CustomEvent(name, {
            bubbles: true,
            detail,
        })
    );
}


function announce(message) {
    const element = state.elements.announcement;

    if (!element) {
        return;
    }

    element.textContent = "";

    requestAnimationFrame(() => {
        element.textContent = normalizeString(message);
    });
}


function getCurrentTimestamp() {
    return Date.now();
}


/* ============================================================
   04. DOM REFERENCES
   ============================================================ */

function collectDashboardElements() {
    const root = document.querySelector(ROOT_SELECTOR);

    if (!root) {
        throw new Error(
            "Dashboard root tidak ditemukan. " +
            "Periksa elemen [data-dashboard-user-root]."
        );
    }

    state.root = root;

    state.elements = {
        root,

        brandName: root.querySelector("[data-brand-name]"),
        brandSubtitle: root.querySelector("[data-brand-subtitle]"),

        welcomeTitle: root.querySelector("[data-welcome-title]"),
        welcomeEyebrow: root.querySelector("[data-welcome-eyebrow]"),
        welcomeMessage: root.querySelector("[data-welcome-message]"),

        searchForm: root.querySelector("[data-dashboard-search-form]"),
        searchInput: root.querySelector("[data-dashboard-search-input]"),
        searchClear: root.querySelector('[data-action="clear-search"]'),

        searchSuggestions: root.querySelector("[data-search-suggestions]"),
        suggestionsLabel: root.querySelector("[data-suggestions-label]"),
        suggestionsList: root.querySelector("[data-suggestions-list]"),
        suggestionsEmpty: root.querySelector("[data-suggestions-empty]"),

        historyButton: root.querySelector(
            '[data-action="toggle-navigation-history"]'
        ),

        historyPanel: root.querySelector("[data-navigation-history]"),
        historyList: root.querySelector("[data-navigation-history-list]"),
        historyEmpty: root.querySelector("[data-navigation-history-empty]"),

        layoutToolbar: root.querySelector("[data-layout-toolbar]"),
        featureArea: root.querySelector("[data-feature-area]"),
        featureGrid: root.querySelector("[data-dashboard-feature-grid]"),
        gridGuide: root.querySelector("[data-grid-guide]"),

        featureLoading: root.querySelector("[data-feature-loading]"),
        featureEmpty: root.querySelector("[data-feature-empty]"),
        featureError: root.querySelector("[data-feature-error]"),
        featureErrorMessage: root.querySelector("[data-feature-error-message]"),

        featureCardTemplate: root.querySelector(
            "#dashboardFeatureCardTemplate"
        ),

        gridCellTemplate: root.querySelector(
            "#dashboardGridCellTemplate"
        ),

        suggestionTemplate: root.querySelector(
            "#dashboardSearchSuggestionTemplate"
        ),

        historyItemTemplate: root.querySelector(
            "#dashboardHistoryItemTemplate"
        ),

        settingsDialog: root.querySelector(
            "#dashboardSettingsDialog"
        ),

        featureHubDialog: root.querySelector(
            "#dashboardFeatureHubDialog"
        ),

        featureHubSearch: root.querySelector(
            "[data-feature-hub-search]"
        ),

        featureHubCategories: root.querySelector(
            "[data-feature-hub-categories]"
        ),

        featureHubLoading: root.querySelector(
            "[data-feature-hub-loading]"
        ),

        featureHubEmpty: root.querySelector(
            "[data-feature-hub-empty]"
        ),

        announcement: root.querySelector(
            "#dashboardAnnouncement"
        ),

        footerBrand: root.querySelector(
            "[data-dashboard-footer-brand]"
        ),

        themeButtons: root.querySelectorAll(
            '[data-action="toggle-theme"]'
        ),

        closeButton: root.querySelector(
            '[data-action="close-dashboard"]'
        ),

        featureHubButton: root.querySelector(
            '[data-action="open-feature-hub"]'
        ),
    };

    const requiredElements = [
        ["root", state.elements.root],
        ["featureGrid", state.elements.featureGrid],
        ["featureCardTemplate", state.elements.featureCardTemplate],
        ["layoutToolbar", state.elements.layoutToolbar],
    ];

    for (const [name, element] of requiredElements) {
        if (!element) {
            throw new Error(
                `Elemen wajib dashboard tidak ditemukan: ${name}`
            );
        }
    }

    return state.elements;
}


/* ============================================================
   05. TENANT AND USER STORAGE NAMESPACE
   ============================================================ */

/**
 * Namespace hanya digunakan untuk memisahkan preferensi lokal.
 *
 * Nilai tenant/user dari HTML tidak dianggap sebagai bukti
 * otorisasi untuk membaca data backend.
 *
 * Identitas backend yang sah nantinya harus diverifikasi
 * di server.
 */

function getStorageNamespace() {
    const root = state.root;

    const tenantId =
        normalizeString(root?.dataset.tenantId) ||
        DEFAULT_TENANT_ID;

    const userId =
        normalizeString(root?.dataset.userId) ||
        DEFAULT_USER_ID;

    return [
        CONFIG.persistence.keyPrefix,
        encodeURIComponent(tenantId),
        encodeURIComponent(userId),
    ].join(":");
}


function getStorageKey(suffix) {
    return `${getStorageNamespace()}:${suffix}`;
}


/* ============================================================
   06. SAFE LOCAL STORAGE
   ============================================================ */

function readStorage(key, fallbackValue = null) {
    try {
        const raw = localStorage.getItem(key);

        if (raw === null) {
            return fallbackValue;
        }

        return JSON.parse(raw);
    } catch (error) {
        console.warn(
            "[KANTOONG Dashboard] Gagal membaca storage:",
            error
        );

        return fallbackValue;
    }
}


function writeStorage(key, value) {
    try {
        localStorage.setItem(
            key,
            JSON.stringify(value)
        );

        return true;
    } catch (error) {
        console.warn(
            "[KANTOONG Dashboard] Gagal menyimpan storage:",
            error
        );

        announce(
            "Pengaturan belum berhasil disimpan pada perangkat ini."
        );

        return false;
    }
}


function removeStorage(key) {
    try {
        localStorage.removeItem(key);

        return true;
    } catch (error) {
        console.warn(
            "[KANTOONG Dashboard] Gagal menghapus storage:",
            error
        );

        return false;
    }
}


/* ============================================================
   07. GRID PROFILE
   ============================================================ */

function getGridProfile(viewportWidth = window.innerWidth) {
    if (
        viewportWidth <=
        CONFIG.layout.breakpoints.mobileMaxWidth
    ) {
        return "mobile";
    }

    if (
        viewportWidth <=
        CONFIG.layout.breakpoints.tabletMaxWidth
    ) {
        return "tablet";
    }

    return "desktop";
}


function updateViewportProfile() {
    state.viewportWidth = window.innerWidth;

    state.gridColumns = getDashboardGridColumns(
        state.viewportWidth
    );

    state.gridProfile = getGridProfile(
        state.viewportWidth
    );

    if (state.elements.featureGrid) {
        state.elements.featureGrid.style.setProperty(
            "--dashboard-grid-columns",
            String(state.gridColumns)
        );
    }

    if (state.root) {
        state.root.dataset.gridProfile = state.gridProfile;
    }

    syncGridCellSize();
}

/**
 * Sel grid dibuat PERSEGI: tinggi baris = lebar kolom. Dengan begitu
 * kartu 2x2 benar-benar persegi, 2x1 lebar, dan 1x2 tinggi seperti
 * pada desain. Dihitung ulang setiap lebar grid berubah.
 */
function syncGridCellSize() {
    const grid = state.elements.featureGrid;

    if (!grid) {
        return;
    }

    const width = grid.clientWidth;

    if (width <= 0) {
        return;
    }

    const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
    const columns = Math.max(1, state.gridColumns);
    const cell = (width - gap * (columns - 1)) / columns;

    if (!Number.isFinite(cell) || cell <= 0) {
        return;
    }

    const value = `${cell.toFixed(2)}px`;

    grid.style.setProperty("--dashboard-grid-row-height", value);

    state.elements.gridGuide?.style.setProperty(
        "--dashboard-grid-row-height",
        value
    );
}

let gridResizeObserver = null;

function observeGridSize() {
    const grid = state.elements.featureGrid;

    gridResizeObserver?.disconnect();

    if (!grid || typeof ResizeObserver !== "function") {
        return;
    }

    gridResizeObserver = new ResizeObserver(() => syncGridCellSize());
    gridResizeObserver.observe(grid);
}


/* ============================================================
   08. DEFAULT LAYOUT
   ============================================================ */

/**
 * Mencari posisi kosong secara row-major.
 *
 * Posisi:
 * x = kolom mulai dari 0.
 * y = baris mulai dari 0.
 *
 * Ukuran:
 * width = jumlah kolom yang dipakai.
 * height = jumlah baris yang dipakai.
 */

function rectanglesOverlap(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}


function isPositionFree(
    candidate,
    layout,
    excludedFeatureId = null
) {
    return !layout.some((item) => {
        if (item.id === excludedFeatureId) {
            return false;
        }

        return rectanglesOverlap(candidate, item);
    });
}


function findFirstFreePosition(
    width,
    height,
    columns,
    existingLayout = []
) {
    const safeWidth = clamp(width, 1, columns);
    const safeHeight = Math.max(1, height);

    for (
        let y = 0;
        y < MAX_LAYOUT_SEARCH_ROWS;
        y += 1
    ) {
        for (
            let x = 0;
            x <= columns - safeWidth;
            x += 1
        ) {
            const candidate = {
                x,
                y,
                width: safeWidth,
                height: safeHeight,
            };

            if (
                isPositionFree(
                    candidate,
                    existingLayout
                )
            ) {
                return {
                    x,
                    y,
                    width: safeWidth,
                    height: safeHeight,
                };
            }
        }
    }

    throw new Error(
        "Tidak ditemukan posisi grid kosong."
    );
}


function createDefaultLayout(featureIds, profile) {
    const width = getViewportWidthForProfile(profile);
    
    const columns = profile === state.gridProfile
        ? state.gridColumns
        : CONFIG.layout.columns[profile];

    const layout = [];

    for (
        let index = 0;
        index < featureIds.length;
        index += 1
    ) {
        const id = featureIds[index];

        const feature = state.featureCatalog.get(id);

        if (!feature) {
            continue;
        }

        const requestedSize = {
            width:
                feature.defaultSize?.width ??
                CONFIG.cards.defaultSize.width,

            height:
                feature.defaultSize?.height ??
                CONFIG.cards.defaultSize.height,
        };

        const size = normalizeDashboardCardSize(
            requestedSize,
            width
        );

        const position = findFirstFreePosition(
            size.width,
            size.height,
            columns,
            layout
        );

        layout.push({
            id,
            ...position,
            order: index,
        });
    }

    return layout;
}

function getViewportWidthForProfile(profile) {
    switch (profile) {
        case "mobile":
            return 390;

        case "tablet":
            return 800;

        case "desktop":
            return 1280;

        default:
            return window.innerWidth;
    }
}


function normalizeLayoutEntry(entry, columns, profile = state.gridProfile) {
    if (!isObject(entry) || typeof entry.id !== "string") {
        return null;
    }

    const featureId = entry.id.trim();

    if (!featureId || !state.featureCatalog.has(featureId)) {
        return null;
    }

    const viewportWidth = getViewportWidthForProfile(profile);

    const size = normalizeDashboardCardSize(
        {
            width: entry.width,
            height: entry.height,
        },
        viewportWidth
    );

    const width = clamp(
        size.width,
        1,
        columns
    );

    const height = size.height;

    const x = clamp(
        Number.isFinite(Number(entry.x))
            ? Math.round(Number(entry.x))
            : 0,
        0,
        Math.max(0, columns - width)
    );

    const y = Math.max(
        0,
        Number.isFinite(Number(entry.y))
            ? Math.round(Number(entry.y))
            : 0
    );

    return {
        id: featureId,
        x,
        y,
        width,
        height,
        order: Number.isFinite(Number(entry.order))
            ? Number(entry.order)
            : 0,
    };
}


function validateLayout(layout, profile) {
    if (!Array.isArray(layout)) {
        return [];
    }

    const columns =
        CONFIG.layout.columns[profile] ??
        CONFIG.layout.columns.desktop;

    const validated = [];
    const seenIds = new Set();

    const entries = [...layout].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
    );

    for (const entry of entries) {
        const normalized = normalizeLayoutEntry(
            entry,
            columns,
            profile
        );

        if (!normalized || seenIds.has(normalized.id)) {
            continue;
        }

        let candidate = normalized;

        if (!isPositionFree(candidate, validated)) {
            const position = findFirstFreePosition(
                normalized.width,
                normalized.height,
                columns,
                validated
            );

            candidate = {
                ...normalized,
                ...position,
            };
        }

        validated.push(candidate);
        seenIds.add(candidate.id);
    }

    return validated;
}


/* ============================================================
   10. LOAD AND SAVE LAYOUT
   ============================================================ */

function loadSavedLayouts() {
    const key = getStorageKey(
        CONFIG.persistence.keys.layout
    );

    const saved = readStorage(key, null);

    if (
        !isObject(saved) ||
        !isObject(saved.profiles)
    ) {
        state.layoutLoaded = false;
        return;
    }

    /*
     * Simpan data layout mentah terlebih dahulu.
     *
     * Jangan memvalidasi ID kartu pada tahap ini karena
     * featureCatalog mungkin belum selesai dimuat.
     *
     * Validasi dilakukan setelah modul fitur diregistrasikan.
     */
    for (const profile of ["mobile", "tablet", "desktop"]) {
        const entries = saved.profiles[profile];

        state.layouts[profile] = Array.isArray(entries)
            ? entries
                .filter((entry) => isObject(entry))
                .map((entry) => ({ ...entry }))
            : [];
    }

    state.layoutLoaded = true;
}

function saveLayouts() {
    const key = getStorageKey(
        CONFIG.persistence.keys.layout
    );

    const payload = {
        version: CONFIG.persistence.schemaVersion,

        updatedAt: new Date().toISOString(),

        profiles: {
            mobile: state.layouts.mobile,
            tablet: state.layouts.tablet,
            desktop: state.layouts.desktop,
        },
    };

    const success = writeStorage(key, payload);

    if (success) {
        dispatchDashboardEvent(
            LAYOUT_EVENT_NAME,
            {
                profile: state.gridProfile,
                layout: getCurrentLayout(),
            }
        );
    }

    return success;
}


function getCurrentLayout() {
    return state.layouts[state.gridProfile] ?? [];
}


function setCurrentLayout(layout) {
    state.layouts[state.gridProfile] = layout;
}


/* ============================================================
   11. FEATURE SELECTION
   ============================================================ */

function loadFeatureSelection() {
    const key = getStorageKey(
        CONFIG.persistence.keys.featureSelection
    );

    const saved = readStorage(key, null);

    if (
        isObject(saved) &&
        Array.isArray(saved.activeFeatureIds)
    ) {
        state.featureSelectionLoaded = true;

        state.activeFeatureIds = new Set(
            saved.activeFeatureIds.filter(
                (id) => typeof id === "string"
            )
        );

        // "Dikenal" = pernah tersedia (published). Fitur yang dulu hanya
        // "Segera hadir" lalu rilis tetap muncul otomatis di menu.
        // Data lama (knownFeatureIds) ikut berisi fitur Segera hadir, jadi
        // dipindah: hanya fitur yang dulu sudah rilis (profil & pengaturan).
        const known = Array.isArray(saved.knownPublishedIds)
            ? saved.knownPublishedIds
            : [...state.activeFeatureIds, "profile", "settings"];

        state.knownFeatureIds = new Set(
            known.filter((id) => typeof id === "string")
        );

        return;
    }

    state.featureSelectionLoaded = false;
}


function saveFeatureSelection() {
    const key = getStorageKey(
        CONFIG.persistence.keys.featureSelection
    );

    return writeStorage(key, {
        version: CONFIG.persistence.schemaVersion,

        activeFeatureIds: [
            ...state.activeFeatureIds,
        ],

        knownPublishedIds: [
            ...state.knownFeatureIds,
        ],

        updatedAt: new Date().toISOString(),
    });
}


/* ============================================================
   12. FEATURE CATALOG
   ============================================================ */

/**
 * Kontrak dasar untuk data fitur.
 *
 * Contoh descriptor:
 *
 * {
 *   id: "orders",
 *   title: "Pesanan Saya",
 *   description: "Lihat pesananmu",
 *   category: "Akun dan Aktivitas",
 *   icon: "📦",
 *   keywords: ["order", "transaksi"],
 *   defaultActive: true
 * }
 *
 * Ini bukan kode fitur itu sendiri.
 * Descriptor akan disediakan oleh feature loader.
 */

/**
 * Peta nama ikon (string) ke karakter yang bisa langsung ditampilkan.
 * Nama yang tidak dikenal dipakai apa adanya (mis. emoji atau huruf).
 */
const FEATURE_ICON_GLYPHS = {
    "user-round": "\u{1F464}",
    user: "\u{1F464}",
    settings: "\u2699",
    package: "\u{1F4E6}",
    heart: "\u2661",
    map: "\u{1F4CD}",
};

function resolveFeatureIcon(value) {
    const icon = normalizeString(value, "\u25A1");

    return FEATURE_ICON_GLYPHS[icon] ?? icon;
}

/**
 * Kontrak core memakai status "active", sedangkan dashboard
 * memakai "published". Keduanya dianggap sama.
 */
function normalizeFeatureStatus(value) {
    const status = normalizeString(value, "published");

    if (status === "active") {
        return "published";
    }

    return status;
}

function normalizeFeatureDescriptor(input) {
    if (!isObject(input)) {
        return null;
    }

    const id = normalizeString(input.id);

    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id)) {
        return null;
    }

    const title = normalizeString(
        input.title,
        input.name ?? id
    );

    return {
        id,

        title,

        description: normalizeString(
            input.description
        ),

        category: normalizeString(
            input.category,
            "Fitur lainnya"
        ),

        icon: resolveFeatureIcon(input.icon),

        keywords: Array.isArray(input.keywords)
            ? input.keywords
                .filter((item) => typeof item === "string")
                .map((item) => item.trim().toLowerCase())
            : [],

        defaultActive: input.defaultActive !== false,

        available: input.available !== false,

        status: normalizeFeatureStatus(input.status),

        /**
         * Optional ukuran awal yang disediakan oleh modul.
         */
        defaultSize: {
            width: input.defaultSize?.width ??
                CONFIG.cards.defaultSize.width,

            height: input.defaultSize?.height ??
                CONFIG.cards.defaultSize.height,
        },

        /**
         * Callback pembuka bersifat opsional.
         * Fitur sensitif tetap memerlukan pemeriksaan izin
         * pada lapisan aplikasi/backend yang berwenang.
         */
        onOpen: typeof input.onOpen === "function"
            ? input.onOpen
            : null,

        /**
         * Fitur bergaya mount/unmount (mis. Profile) ditampilkan
         * pada feature stage saat kartunya dibuka.
         */
        mount: typeof input.mount === "function"
            ? input.mount
            : null,

        unmount: typeof input.unmount === "function"
            ? input.unmount
            : null,

        /**
         * Dipakai Feature Hub:
         * - tier: "package" (termasuk paket) atau "addon" (berbayar).
         * - publishedAt: tanggal rilis, dasar tag NEW.
         * - order: urutan tampil di hub.
         */
        /**
         * Ringkasan di kartu: fungsi opsional yang mengembalikan
         * { title, text, progress? } untuk ditampilkan pada kartu.
         */
        summary: typeof input.summary === "function"
            ? input.summary
            : null,

        /**
         * Tampilan kartu khusus (mis. kartu Profil). Mengembalikan
         * elemen yang dipasang di dalam kartu; tata letaknya mengikuti
         * data-card-mode lewat CSS.
         */
        renderCard: typeof input.renderCard === "function"
            ? input.renderCard
            : null,

        tier: normalizeString(input.tier, "package"),

        publishedAt: normalizeString(input.publishedAt),

        order: Number.isFinite(input.order)
            ? input.order
            : 999,

        metadata: isObject(input.metadata)
            ? { ...input.metadata }
            : {},
    };
}


/**
 * Mendaftarkan katalog fitur dari feature loader.
 *
 * Fitur baru yang ditambahkan ke katalog belum tentu muncul
 * di dashboard jika sudah ada daftar pilihan pengguna tersimpan.
 */

export function registerDashboardFeatures(features = []) {
    if (!Array.isArray(features)) {
        throw new TypeError(
            "registerDashboardFeatures mengharapkan array."
        );
    }

    const normalizedFeatures = [];

    for (const item of features) {
        const feature = normalizeFeatureDescriptor(item);

        if (!feature) {
            console.warn(
                "[KANTOONG Dashboard] Descriptor fitur tidak valid:",
                item
            );

            continue;
        }

        if (state.featureCatalog.has(feature.id)) {
            console.warn(
                `[KANTOONG Dashboard] ID fitur duplikat: ${feature.id}`
            );

            continue;
        }

        state.featureCatalog.set(feature.id, feature);

        normalizedFeatures.push(feature);
    }

    for (const feature of normalizedFeatures) {
        if (!feature.defaultActive || feature.status !== "published") {
            continue;
        }

        // Dashboard baru: aktifkan fitur awal. Dashboard lama: aktifkan
        // hanya fitur awal yang BARU (belum pernah terdaftar), supaya
        // fitur yang sengaja diarsipkan pengguna tidak muncul lagi.
        if (
            !state.featureSelectionLoaded ||
            !state.knownFeatureIds.has(feature.id)
        ) {
            state.activeFeatureIds.add(feature.id);
        }
    }

    for (const feature of normalizedFeatures) {
        if (feature.status === "published") {
            state.knownFeatureIds.add(feature.id);
        }
    }

    ensureLayoutsContainActiveFeatures();

    saveFeatureSelection();
    saveLayouts();

    renderDashboardFeatures();
    renderFeatureHub();

    return [...state.featureCatalog.values()];
}


export function getDashboardFeatures() {
    return [...state.featureCatalog.values()];
}


export function getActiveDashboardFeatures() {
    return [...state.activeFeatureIds]
        .map((id) => state.featureCatalog.get(id))
        .filter(Boolean);
}


/* ============================================================
   13. ENSURE ACTIVE FEATURES HAVE LAYOUT
   ============================================================ */

function ensureLayoutsContainActiveFeatures() {
    for (const profile of ["mobile", "tablet", "desktop"]) {
        const columns =
            CONFIG.layout.columns[profile];

        const layout = validateLayout(
            state.layouts[profile],
            profile
        );

        const presentIds = new Set(
            layout.map((item) => item.id)
        );

        for (const id of state.activeFeatureIds) {
            if (
                presentIds.has(id) ||
                !state.featureCatalog.has(id)
            ) {
                continue;
            }

            const feature = state.featureCatalog.get(id);

            const size = normalizeDashboardCardSize(
                feature.defaultSize,
                getViewportWidthForProfile(profile)
            );

            const position = findFirstFreePosition(
                size.width,
                size.height,
                columns,
                layout
            );

            layout.push({
                id,
                ...position,
                order: layout.length,
            });

            presentIds.add(id);
        }

        state.layouts[profile] = layout.filter(
            (entry) => state.activeFeatureIds.has(entry.id)
        );
    }
}


/* ============================================================
   14. RENDER FEATURE CARDS
   ============================================================ */

function createFeatureCard(feature, layoutEntry) {
    const template = state.elements.featureCardTemplate;

    if (!template?.content) {
        return null;
    }

    const fragment = template.content.cloneNode(true);

    const card = fragment.querySelector(
        "[data-feature-card]"
    );

    if (!card) {
        return null;
    }

    card.dataset.featureId = feature.id;

    card.dataset.gridWidth = String(layoutEntry.width);
    card.dataset.gridHeight = String(layoutEntry.height);

    card.dataset.gridX = String(layoutEntry.x);
    card.dataset.gridY = String(layoutEntry.y);

    card.dataset.cardState = "normal";

    const openButton = card.querySelector(
        '[data-action="open-feature"]'
    );

    if (openButton) {
        openButton.dataset.featureId = feature.id;

        openButton.setAttribute(
            "aria-label",
            `Buka ${feature.title}`
        );
    }

    const title = card.querySelector(
        "[data-feature-title]"
    );

    if (title) {
        title.textContent = feature.title;
    }

    const description = card.querySelector(
        "[data-feature-description]"
    );

    if (description) {
        description.textContent = feature.description;

        description.hidden = !feature.description;
    }

    const iconWrap = card.querySelector(
        "[data-feature-icon-wrap]"
    );

    if (iconWrap) {
        /**
         * Gunakan textContent, bukan innerHTML untuk konten
         * yang berasal dari descriptor modul.
         */
        iconWrap.replaceChildren(
            document.createTextNode(feature.icon || "□")
        );

        iconWrap.setAttribute("aria-hidden", "true");
    }

    applyCardPosition(card, layoutEntry);

    const archiveButton = card.querySelector(
        '[data-action="archive-feature"]'
    );

    if (archiveButton) {
        archiveButton.dataset.featureId = feature.id;

        archiveButton.setAttribute(
            "aria-label",
            `Arsipkan ${feature.title}`
        );
    }

    hydrateCard(card, feature);

    if (state.mode === LAYOUT_MODE_EDIT) {
        revealCardEditControls(card, true);
    }

    return fragment;
}


function applyCardPosition(card, entry) {
    /**
     * Posisi eksplisit berdasarkan indeks grid.
     *
     * x = 0 berarti kolom pertama.
     * y = 0 berarti baris pertama.
     *
     * Tidak menggunakan grid-auto-flow: dense.
     */
    card.style.gridColumn =
        `${entry.x + 1} / span ${entry.width}`;

    card.style.gridRow =
        `${entry.y + 1} / span ${entry.height}`;

    card.dataset.gridX = String(entry.x);
    card.dataset.gridY = String(entry.y);

    card.dataset.gridWidth = String(entry.width);
    card.dataset.gridHeight = String(entry.height);

    // Mode tampilan isi kartu: 1x1, horizontal, vertical, compact, large.
    card.dataset.cardMode = getCardMode(entry.width, entry.height);
}


function revealCardEditControls(card, visible) {
    const archiveButton = card.querySelector(
        '[data-action="archive-feature"]'
    );

    if (archiveButton) {
        archiveButton.hidden = !visible;
    }

    const dragHandle = card.querySelector("[data-drag-handle]");

    if (dragHandle) {
        dragHandle.hidden = !visible;
    }

    const resizeHandles = card.querySelectorAll(
        "[data-resize-handle]"
    );

    for (const handle of resizeHandles) {
        handle.hidden = !visible;
    }
}


/* ============================================================
   14B. GRID BENTO BARU (home/bento.js) + LEMARI FITUR (home/shelf.js)
   ============================================================ */

/** Ukuran awal kartu (bisa diubah user lewat mode atur). */
const BENTO_DEFAULTS = Object.freeze({
    profile: "2x2",
    "product-catalog": "4x2",
    "package-tracking": "2x2",
    "total-spending": "2x2",
    "my-orders": "2x1",
    wishlist: "2x2",
    "ai-chat-history": "2x1",
    clock: "2x1",
    "store-map": "2x2",
    "customer-support": "2x1",
    settings: "1x1",
});

let bento = null;
let shelf = null;

/** Nama brand dari pengaturan etalase (diubah owner di ERP), realtime. */
function applyStorefrontBrand(settings = getStorefront()) {
    const name = settings?.brand?.name || "Toko";

    if (state.elements.brandName) {
        state.elements.brandName.textContent = name;
    }

    if (state.elements.brandSubtitle) {
        state.elements.brandSubtitle.textContent = settings?.brand?.tagline || "Ruang pribadimu";
    }

    document.title = `${name} · Ruang Pribadi`;

    // Logo brand (bila ada) menggantikan tanda bintang di kotak brand.
    const mark = state.root?.querySelector(".dashboard-brand__mark");
    if (mark) {
        if (!mark.dataset.original) mark.dataset.original = mark.innerHTML;
        const logo = settings?.brand?.logo;
        if (logo) {
            const img = document.createElement("img");
            img.src = logo;
            img.alt = name;
            img.className = "dashboard-brand__logo";
            mark.replaceChildren(img);
            mark.classList.add("has-logo");
        } else if (mark.classList.contains("has-logo")) {
            mark.innerHTML = mark.dataset.original;
            mark.classList.remove("has-logo");
        }
    }
}

let brandSyncStarted = false;

function startBrandSync() {
    if (brandSyncStarted) {
        return;
    }

    brandSyncStarted = true;
    applyStorefrontBrand();
    onStorefrontChange((settings) => {
        applyStorefrontBrand(settings);
        renderWelcome(state.elements.welcomeTitle?.closest("[data-welcome-card]"));
    });
    startStorefrontSync();
}

function getBento() {
    if (bento || !state.elements.featureGrid) {
        return bento;
    }

    startBrandSync();

    bento = createBento({
        grid: state.elements.featureGrid,
        storageKey: getStorageKey("bento:v1"),
        defaults: BENTO_DEFAULTS,
        onOpen: (id) => openDashboardFeature(id),
        onArchive: (id) => archiveFeatureFromDashboard(id),
        onAdd: () => getShelf().show(),
        getContext: () => ({ dashboardApi: getDashboardApi() }),
        onEditChange: (editing) => {
            state.mode = editing ? LAYOUT_MODE_EDIT : LAYOUT_MODE_VIEW;

            if (state.root) {
                state.root.dataset.layoutMode = state.mode;
                state.root.dataset.bentoEditing = editing ? "true" : "false";
            }

            announce(
                editing
                    ? "Mode atur aktif. Geser kartu untuk memindahkan, tarik sudutnya untuk mengubah ukuran."
                    : "Tata letak disimpan."
            );
        },
    });

    return bento;
}

function getShelf() {
    if (!shelf) {
        shelf = createShelf({
            host: state.root ?? document.body,
            getFeatures: () => getDashboardFeatures(),
            isActive: (id) => state.activeFeatureIds.has(id),
            canAdd: (feature) => feature.available && feature.status === "published",
            onAdd: (id) => addFeatureToDashboard(id),
        });
    }

    return shelf;
}

export function renderDashboardFeatures() {
    const grid = state.elements.featureGrid;

    if (grid && getBento()) {
        bento.render(getActiveDashboardFeatures());
        renderWelcome(state.elements.welcomeTitle?.closest("[data-welcome-card]"));
        shelf?.refresh();

        if (state.elements.featureLoading) state.elements.featureLoading.hidden = true;
        if (state.elements.featureError) state.elements.featureError.hidden = true;
        if (state.elements.featureEmpty) {
            state.elements.featureEmpty.hidden = getActiveDashboardFeatures().length > 0;
        }

        return;
    }

    if (!grid) {
        return;
    }

    const activeFeatures = getActiveDashboardFeatures();

    const layout = getCurrentLayout();

    const layoutById = new Map(
        layout.map((entry) => [entry.id, entry])
    );

    const fragment = document.createDocumentFragment();

    for (const feature of activeFeatures) {
        const entry = layoutById.get(feature.id);

        if (!entry) {
            continue;
        }

        const card = createFeatureCard(feature, entry);

        if (card) {
            fragment.append(card);
        }
    }

    // Kartu "Tambah Fitur" ikut menjadi bagian grid (ukuran 2x2) dan
    // selalu menempati ruang kosong setelah kartu terakhir.
    const hubEntry = getHubEntryElement();

    grid.replaceChildren(fragment);

    if (hubEntry) {
        grid.append(hubEntry);
        renderHubEntryThumbs(hubEntry);
    }

    updateFeatureState();
    renderGridGuide();
    updateEditModeUI();
}

let hubEntryElement = null;

/** Empat kotak kecil pratinjau fitur yang bisa ditambahkan. */
function renderHubEntryThumbs(entry) {
    const holder = entry.querySelector("[data-hub-entry-thumbs]");

    if (!holder) {
        return;
    }

    const suggestions = featureHub.getSuggestedFeatures(4);

    const thumbs = Array.from({ length: 4 }, (_, index) => {
        const thumb = document.createElement("span");

        thumb.className = "dashboard-feature-hub-entry__thumb";
        thumb.textContent = suggestions[index]?.icon ?? "";

        return thumb;
    });

    holder.replaceChildren(...thumbs);
}

function getHubEntryElement() {
    if (!hubEntryElement) {
        hubEntryElement =
            state.root?.querySelector(".dashboard-feature-hub-entry") ??
            null;
    }

    return hubEntryElement;
}

/**
 * Mengisi isi kartu setelah dibuat:
 * - renderCard: tampilan khusus (kartu Profil dengan foto, dll).
 * - summary   : kotak ringkasan sederhana (mis. tema aktif).
 */
async function hydrateCard(card, feature) {
    if (typeof feature.renderCard === "function") {
        if (card.dataset.customCard !== "ready") {
            card.dataset.customCard = "pending";
        }

        try {
            const content = await feature.renderCard({
                dashboardApi: getDashboardApi(),
            });

            const openButton = card.querySelector(
                '[data-action="open-feature"]'
            );

            if (!content || !openButton || !card.isConnected) {
                return;
            }

            openButton.replaceChildren(content);
            card.dataset.customCard = "ready";

            requestAnimationFrame(() => applyTextFade(card));
        } catch (error) {
            card.removeAttribute("data-custom-card");

            console.warn(
                `[KANTOONG Dashboard] Kartu ${feature.id} gagal dirender:`,
                error
            );
        }

        return;
    }

    const slot = card.querySelector("[data-feature-summary]");

    if (!slot || typeof feature.summary !== "function") {
        return;
    }

    try {
        const data = await feature.summary({
            dashboardApi: getDashboardApi(),
        });

        if (!data || !card.isConnected) {
            return;
        }

        slot.replaceChildren(createSummaryBox(data));
        slot.hidden = false;

        card.dataset.hasSummary = "true";
    } catch (error) {
        console.warn(
            `[KANTOONG Dashboard] Ringkasan ${feature.id} gagal dimuat:`,
            error
        );
    }
}

/** Menyegarkan ringkasan semua kartu (setelah login, tema berubah, dll). */
export function refreshFeatureSummaries() {
    if (bento) {
        bento.refresh();
        renderWelcome(state.elements.welcomeTitle?.closest("[data-welcome-card]"));
        return;
    }

    const cards = state.elements.featureGrid?.querySelectorAll(
        "[data-feature-card]"
    ) ?? [];

    for (const card of cards) {
        const feature = state.featureCatalog.get(card.dataset.featureId);

        if (feature) {
            hydrateCard(card, feature);
        }
    }
}

/** Pilihan ukuran di toolbar mode edit (sesuai jumlah kolom grid). */
function renderSizeChips() {
    const container = state.elements.layoutToolbar?.querySelector(
        "[data-size-chips]"
    );

    if (!container) {
        return;
    }

    const chips = getSizePresets(state.gridColumns).map((preset) => {
        const chip = document.createElement("button");

        chip.type = "button";
        chip.className = "dashboard-size-chip";
        chip.dataset.action = "set-card-size";
        chip.dataset.size = formatSize(preset);
        chip.textContent = `${preset.width}\u00D7${preset.height}`;

        return chip;
    });

    container.replaceChildren(...chips);
}


function updateFeatureState() {
    const hasFeatures =
        state.elements.featureGrid?.querySelectorAll(
            "[data-feature-card]"
        ).length > 0;

    if (state.elements.featureLoading) {
        state.elements.featureLoading.hidden = true;
    }

    if (state.elements.featureEmpty) {
        state.elements.featureEmpty.hidden = hasFeatures;
    }

    if (state.elements.featureError) {
        state.elements.featureError.hidden = true;
    }
}


/* ============================================================
   15. GRID GUIDE
   ============================================================ */

export function renderGridGuide() {
    const guide = state.elements.gridGuide;
    const template = state.elements.gridCellTemplate;

    if (!guide || !template?.content) {
        return;
    }

    if (state.mode !== LAYOUT_MODE_EDIT) {
        guide.hidden = true;
        guide.replaceChildren();
        return;
    }

    const layout = getCurrentLayout();

    const furthestRow = layout.reduce(
        (maximum, entry) => Math.max(
            maximum,
            entry.y + entry.height
        ),
        4
    );

    /**
     * Sel tambahan memberi ruang kosong di bawah kartu.
     */
    const totalRows = Math.max(
        4,
        furthestRow + 2
    );

    const totalCells = state.gridColumns * totalRows;

    const fragment = document.createDocumentFragment();

    for (let index = 0; index < totalCells; index += 1) {
        fragment.append(
            template.content.cloneNode(true)
        );
    }

    guide.style.setProperty(
        "--dashboard-grid-columns",
        String(state.gridColumns)
    );

    const gridRowHeight =
        state.elements.featureGrid?.style.getPropertyValue(
            "--dashboard-grid-row-height"
        );

    if (gridRowHeight) {
        guide.style.setProperty(
            "--dashboard-grid-row-height",
            gridRowHeight
        );
    }

    guide.style.gridTemplateRows =
        `repeat(${totalRows}, var(--dashboard-grid-row-height))`;

    guide.replaceChildren(fragment);
    guide.hidden = false;
}


/* ============================================================
   16. EDIT MODE
   ============================================================ */

export function setDashboardLayoutMode(mode) {
    if (
        mode !== LAYOUT_MODE_VIEW &&
        mode !== LAYOUT_MODE_EDIT
    ) {
        throw new TypeError(
            `Mode layout tidak valid: ${mode}`
        );
    }

    state.mode = mode;

    if (state.root) {
        state.root.dataset.layoutMode = mode;
    }

    updateEditModeUI();
    renderGridGuide();

    dispatchDashboardEvent(
        "kantoong:dashboard-edit-mode-changed",
        { mode }
    );

    announce(
        mode === LAYOUT_MODE_EDIT
            ? "Mode edit aktif. Kamu dapat memindahkan atau mengubah ukuran kartu."
            : "Mode edit ditutup."
    );
}



export function beginDashboardLayoutEdit() {
    if (getBento()) {
        // Tombol pensil = masuk/keluar mode atur.
        bento.setEditing(!bento.isEditing());
        return;
    }

    if (state.mode === LAYOUT_MODE_EDIT) {
        return;
    }

    state.layoutEditSnapshot = {
        mobile: state.layouts.mobile.map((entry) => ({ ...entry })),
        tablet: state.layouts.tablet.map((entry) => ({ ...entry })),
        desktop: state.layouts.desktop.map((entry) => ({ ...entry })),
    };

    setDashboardLayoutMode(LAYOUT_MODE_EDIT);
}


export function finishDashboardLayoutEdit({ save = true } = {}) {
    if (bento) {
        bento.setEditing(false);
        return;
    }

    if (save) {
        saveLayouts();
    } else {
        cancelDashboardLayoutEdit();
        return;
    }

    state.layoutEditSnapshot = null;

    setDashboardLayoutMode(LAYOUT_MODE_VIEW);
    renderDashboardFeatures();

    announce("Tata letak dashboard berhasil disimpan.");
}


export function cancelDashboardLayoutEdit() {
    if (bento) {
        bento.setEditing(false);
        return;
    }

    if (state.layoutEditSnapshot) {
        state.layouts = {
            mobile: state.layoutEditSnapshot.mobile.map((entry) => ({ ...entry })),
            tablet: state.layoutEditSnapshot.tablet.map((entry) => ({ ...entry })),
            desktop: state.layoutEditSnapshot.desktop.map((entry) => ({ ...entry })),
        };

        state.layoutEditSnapshot = null;

        // Pulihkan juga layout yang sudah telanjur tersimpan.
        saveLayouts();
    } else {
        loadSavedLayouts();
        ensureLayoutsContainActiveFeatures();
    }

    setDashboardLayoutMode(LAYOUT_MODE_VIEW);
    renderDashboardFeatures();

    announce("Perubahan tata letak dibatalkan.");
}

function updateEditModeUI() {
    const editing = state.mode === LAYOUT_MODE_EDIT;

    if (state.root) {
        state.root.dataset.layoutMode = state.mode;
    }

    if (state.elements.layoutToolbar) {
        state.elements.layoutToolbar.hidden = !editing;

        if (editing) {
            renderSizeChips();
        }
    }

    const cards = state.elements.featureGrid?.querySelectorAll(
        "[data-feature-card]"
    ) ?? [];

    for (const card of cards) {
        revealCardEditControls(card, editing);
    }
}


/* ============================================================
   17. MOVE CARD
   ============================================================ */

function findNearestFreePosition(
    targetX,
    targetY,
    width,
    height,
    columns,
    currentLayout,
    excludedFeatureId
) {
    const safeWidth = clamp(width, 1, columns);

    const x0 = clamp(
        Math.round(targetX),
        0,
        columns - safeWidth
    );

    const y0 = Math.max(
        0,
        Math.round(targetY)
    );

    const maxY = Math.min(
        MAX_LAYOUT_SEARCH_ROWS,
        Math.max(
            y0 + 30,
            ...currentLayout.map(
                (item) => item.y + item.height + 10
            )
        )
    );

    const candidates = [];

    for (let y = 0; y <= maxY; y += 1) {
        for (
            let x = 0;
            x <= columns - safeWidth;
            x += 1
        ) {
            const candidate = {
                x,
                y,
                width: safeWidth,
                height,
            };

            if (
                !isPositionFree(
                    candidate,
                    currentLayout,
                    excludedFeatureId
                )
            ) {
                continue;
            }

            const distance =
                Math.abs(x - x0) +
                Math.abs(y - y0);

            candidates.push({
                ...candidate,
                distance,
            });
        }
    }

    candidates.sort(
        (a, b) =>
            a.distance - b.distance ||
            a.y - b.y ||
            a.x - b.x
    );

    return candidates[0] ?? null;
}


/**
 * Memindahkan kartu ke posisi target.
 *
 * Apabila posisi target tabrakan, sistem mencari posisi valid
 * yang paling dekat. Kartu lain tidak otomatis dipindahkan.
 *
 * @param {string} featureId
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */

export function moveFeatureCard(featureId, x, y) {
    if (state.mode !== LAYOUT_MODE_EDIT) {
        return false;
    }

    const layout = [...getCurrentLayout()];

    const index = layout.findIndex(
        (entry) => entry.id === featureId
    );

    if (index === -1) {
        return false;
    }

    const current = layout[index];

    const target = findNearestFreePosition(
        Number(x),
        Number(y),
        current.width,
        current.height,
        state.gridColumns,
        layout,
        featureId
    );

    if (!target) {
        announce("Posisi kartu tidak tersedia.");
        return false;
    }

    layout[index] = {
        ...current,
        x: target.x,
        y: target.y,
    };

    setCurrentLayout(layout);

    saveLayouts();
    renderDashboardFeatures();

    dispatchDashboardEvent(
        LAYOUT_EVENT_NAME,
        {
            action: "move",
            featureId,
            position: {
                x: target.x,
                y: target.y,
            },
        }
    );

    return true;
}


/* ============================================================
   18. RESIZE CARD
   ============================================================ */

/**
 * Mengubah ukuran kartu sambil mempertahankan koordinatnya.
 *
 * width  = jumlah kolom.
 * height = jumlah baris.
 *
 * Jika ukuran bertabrakan dengan kartu lain, fungsi mencari
 * posisi valid terdekat tanpa menggeser kartu lainnya.
 */

export function resizeFeatureCard(
    featureId,
    requestedSize
) {
    if (state.mode !== LAYOUT_MODE_EDIT) {
        return false;
    }

    const layout = [...getCurrentLayout()];

    const index = layout.findIndex(
        (entry) => entry.id === featureId
    );

    if (index === -1) {
        return false;
    }

    const current = layout[index];

    const size = normalizeDashboardCardSize(
        requestedSize,
        state.viewportWidth
    );

    const width = clamp(
        size.width,
        1,
        state.gridColumns
    );

    const height = size.height;

    const target = findNearestFreePosition(
        current.x,
        current.y,
        width,
        height,
        state.gridColumns,
        layout,
        featureId
    );

    if (!target) {
        announce("Ukuran kartu tersebut tidak tersedia.");
        return false;
    }

    layout[index] = {
        ...current,
        x: target.x,
        y: target.y,
        width: target.width,
        height: target.height,
    };

    setCurrentLayout(layout);

    saveLayouts();
    renderDashboardFeatures();

    dispatchDashboardEvent(
        LAYOUT_EVENT_NAME,
        {
            action: "resize",
            featureId,
            size: {
                width: target.width,
                height: target.height,
            },
        }
    );

    return true;
}


/* ============================================================
   19. RESET LAYOUT
   ============================================================ */

export function resetDashboardLayout() {
    if (bento) {
        bento.reset();
        announce("Tata letak dikembalikan ke susunan awal.");
        return;
    }

    const ids = [...state.activeFeatureIds];

    state.layouts[state.gridProfile] = createDefaultLayout(
        ids,
        state.gridProfile
    );

    saveLayouts();
    renderDashboardFeatures();

    announce("Tata letak untuk perangkat ini dikembalikan.");
}


/* ============================================================
   20. FEATURE OPENING
   ============================================================ */

export async function openDashboardFeature(featureId) {
    const feature = state.featureCatalog.get(featureId);

    if (!feature) {
        announce("Fitur tidak ditemukan.");
        return false;
    }

    if (
        !feature.available ||
        feature.status !== "published"
    ) {
        announce("Fitur ini belum tersedia.");
        return false;
    }

    recordDashboardHistory({
        type: "feature-open",
        featureId: feature.id,
        title: feature.title,
    });

    dispatchDashboardEvent(
        FEATURE_EVENT_NAME,
        {
            featureId: feature.id,
            feature,
        }
    );

    // Fitur dengan mount() dirender pada feature stage.
    if (typeof feature.mount === "function") {
        const mounted = await openFeatureStage(feature);

        if (!mounted) {
            return false;
        }
    }

    /**
     * Callback fitur bersifat opsional.
     * Pemeriksaan akses tindakan sensitif harus dilakukan
     * kembali di backend saat fitur terhubung ke data nyata.
     */
    if (typeof feature.onOpen === "function") {
        try {
            await feature.onOpen({
                feature,
                dashboard: getDashboardState(),
            });
        } catch (error) {
            console.error(
                `[KANTOONG Dashboard] Gagal membuka fitur ${feature.id}:`,
                error
            );

            announce("Fitur gagal dibuka.");
            return false;
        }
    }

    return true;
}


/* ============================================================
   20B. FEATURE STAGE
   ============================================================ */

/**
 * Feature stage adalah layar penuh di dalam dashboard tempat
 * sebuah fitur (mis. Profile) menampilkan dirinya lewat mount().
 */

let activeStage = null;

export async function openFeatureStage(feature) {
    if (!state.root || typeof feature?.mount !== "function") {
        return false;
    }

    await closeFeatureStage();

    const stage = document.createElement("section");
    stage.className = "dashboard-feature-stage";
    stage.dataset.featureId = feature.id;
    stage.setAttribute("role", "dialog");
    stage.setAttribute("aria-label", feature.title);

    const header = document.createElement("header");
    header.className = "dashboard-feature-stage__header";

    const back = document.createElement("button");
    back.type = "button";
    back.className = "dashboard-icon-button dashboard-back-button";
    back.setAttribute("aria-label", "Kembali ke dashboard");
    back.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';

    const heading = document.createElement("h2");
    heading.className = "dashboard-feature-stage__title";
    heading.textContent = feature.title;

    header.append(back, heading);

    const body = document.createElement("div");
    body.className = "dashboard-feature-stage__body";

    stage.append(header, body);
    state.root.append(stage);

    back.addEventListener("click", () => {
        closeFeatureStage();
    });

    activeStage = { stage, body, feature };

    const logger = {
        debug() {},
        info() {},
        warn: console.warn.bind(console),
        error: console.error.bind(console),
    };

    // Data login dibaca dari Supabase lewat auth-bridge. Dimuat dinamis
    // agar kegagalan memuat Supabase tidak merusak seluruh dashboard.
    let bridge = null;
    let currentUser = null;

    try {
        bridge = await import("./integrations/auth-bridge.js");
        currentUser = await bridge.getDashboardUser();
    } catch (error) {
        console.warn(
            "[KANTOONG Dashboard] Layanan login tidak dapat dimuat:",
            error
        );
    }

    // Pengguna menutup layar ini saat data login sedang dimuat.
    if (!activeStage || activeStage.stage !== stage) {
        return false;
    }

    try {
        await feature.mount({
            element: body,
            rootElement: body,
            feature,
            logger,
            dashboard: getDashboardState(),
            tenantId: state.root.dataset.tenantId ?? null,
            currentUser,
            dashboardApi: getDashboardApi(),
            auth: bridge
                ? {
                    signInWithGoogle: bridge.signInWithGoogle,
                    signInWithEmail: bridge.signInWithEmail,
                    signOut: bridge.signOut,
                    openAdmin: bridge.openAdmin,
                    describeError: bridge.describeAuthError,
                    sendPasswordReset: bridge.sendPasswordResetLink,
                    changePassword: bridge.changePassword,
                    describePasswordError: bridge.describePasswordError,
                }
                : null,
            reload: () => reloadFeatureStage(),
        });
    } catch (error) {
        console.error(
            `[KANTOONG Dashboard] Gagal menampilkan fitur ${feature.id}:`,
            error
        );

        announce("Fitur gagal ditampilkan.");

        await closeFeatureStage();

        return false;
    }

    back.focus();

    return true;
}

/** Membuka ulang fitur yang sedang tampil (mis. setelah login/keluar). */
export async function reloadFeatureStage() {
    const feature = activeStage?.feature;

    if (!feature) {
        return false;
    }

    await closeFeatureStage();

    return openFeatureStage(feature);
}

export async function closeFeatureStage() {
    if (!activeStage) {
        return false;
    }

    const { stage, body, feature } = activeStage;

    activeStage = null;

    try {
        if (typeof feature.unmount === "function") {
            await feature.unmount({
                element: body,
                rootElement: body,
                feature,
            });
        }
    } catch (error) {
        console.warn(
            `[KANTOONG Dashboard] Gagal membersihkan fitur ${feature.id}:`,
            error
        );
    }

    stage.remove();

    // Login/keluar di layar fitur dapat mengubah ringkasan kartu.
    refreshFeatureSummaries();

    return true;
}


/* ============================================================
   21. FEATURE HUB
   ============================================================ */

/**
 * Jembatan yang diberikan ke modul Feature Hub.
 * Seluruh logika hub ada di feature-hub/*; dashboard hanya
 * menyediakan operasi dasar atas state-nya sendiri.
 */
const hubApi = {
    getFeatures: () => [...state.featureCatalog.values()],

    getFeature: (id) => state.featureCatalog.get(id),

    isActive: (id) => state.activeFeatureIds.has(id),

    getElements: () => state.elements,

    activate(id) {
        state.activeFeatureIds.add(id);

        ensureLayoutsContainActiveFeatures();

        saveFeatureSelection();
        saveLayouts();

        renderDashboardFeatures();
    },

    deactivate(id) {
        state.activeFeatureIds.delete(id);

        for (const profile of ["mobile", "tablet", "desktop"]) {
            state.layouts[profile] =
                state.layouts[profile].filter(
                    (entry) => entry.id !== id
                );
        }

        saveFeatureSelection();
        saveLayouts();

        renderDashboardFeatures();
    },

    updateFeature(id, patch) {
        const current = state.featureCatalog.get(id);

        if (!current) {
            return false;
        }

        state.featureCatalog.set(id, { ...current, ...patch });

        renderDashboardFeatures();

        return true;
    },

    announce: (message) => announce(message),

    record: (entry) => recordDashboardHistory(entry),
};

const featureHub = createFeatureHub({ api: hubApi });

let featureHubController = null;

export function getFeatureHub() {
    return featureHub;
}

export function renderFeatureHub(query = "") {
    featureHub.render(query);
}

export function openFeatureHub() {
    return getShelf().show();
}

export function closeFeatureHub() {
    featureHub.close();
}

/** Menambahkan fitur ke dashboard (kartu baru berukuran awal 2x2). */
export function addFeatureToDashboard(featureId) {
    return featureHub.add(featureId);
}

/**
 * Mengarsipkan kartu dari dashboard. Fitur tetap ada di katalog
 * sehingga muncul kembali di Feature Hub.
 */
export function archiveFeatureFromDashboard(featureId) {
    return featureHub.archive(featureId);
}

/** Operasi dashboard yang boleh dipakai fitur (mis. Pengaturan). */
export function getDashboardApi() {
    return {
        getTheme: () => state.theme,
        setTheme: (theme) => {
            setDashboardTheme(theme);
            refreshFeatureSummaries();
        },
        resetLayout: () => resetDashboardLayout(),
        clearHistory: () => clearNavigationHistory(),
    };
}


/* ============================================================
   22. SEARCH
   ============================================================ */

/**
 * Pencarian ini adalah pencarian teks lokal.
 *
 * Pencarian semantik berbasis AI akan membutuhkan adapter
 * tersendiri dan tidak disimulasikan di modul ini.
 */

export function searchDashboardFeatures(query = "") {
    const normalizedQuery = normalizeString(query).toLowerCase();

    state.searchQuery = normalizedQuery;

    const results = [...state.featureCatalog.values()]
        .filter((feature) => feature.status === "published")
        .map((feature) => {
            const terms = [
                feature.title,
                feature.description,
                feature.category,
                ...feature.keywords,
            ]
                .join(" ")
                .toLowerCase();

            const score = getSearchScore(
                normalizedQuery,
                feature,
                terms
            );

            return {
                feature,
                score,
            };
        })
        .filter((item) => {
            return item.score > 0;
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, CONFIG.search.suggestions.maximumResults)
        .map((item) => item.feature);

    renderSearchSuggestions(results, normalizedQuery);

    return results;
}


function getSearchScore(query, feature, searchableText) {
    if (!query) {
        return 0;
    }

    if (feature.title.toLowerCase() === query) {
        return 100;
    }

    if (feature.title.toLowerCase().startsWith(query)) {
        return 80;
    }

    if (feature.title.toLowerCase().includes(query)) {
        return 60;
    }

    if (feature.keywords.some((keyword) => keyword === query)) {
        return 55;
    }

    if (searchableText.includes(query)) {
        return 30;
    }

    const queryWords = query.split(/\s+/).filter(Boolean);

    const matchedWords = queryWords.filter(
        (word) => searchableText.includes(word)
    );

    if (matchedWords.length > 0) {
        return Math.round(
            10 * matchedWords.length / queryWords.length
        );
    }

    return 0;
}


function renderSearchSuggestions(features, query) {
    const container = state.elements.suggestionsList;

    if (!container) {
        return;
    }

    const template = state.elements.suggestionTemplate;

    if (!template?.content) {
        return;
    }

    const fragment = document.createDocumentFragment();

    for (const feature of features) {
        const clone = template.content.cloneNode(true);

        const button = clone.querySelector(
            "[data-search-suggestion]"
        );

        const icon = clone.querySelector(
            "[data-suggestion-icon]"
        );

        const title = clone.querySelector(
            "[data-suggestion-title]"
        );

        const description = clone.querySelector(
            "[data-suggestion-description]"
        );

        if (button) {
            button.dataset.featureId = feature.id;

            button.setAttribute(
                "aria-label",
                `Buka ${feature.title}`
            );
        }

        if (icon) {
            icon.textContent = feature.icon || "□";
        }

        if (title) {
            title.textContent = feature.title;
        }

        if (description) {
            description.textContent = feature.description;
            description.hidden = !feature.description;
        }

        fragment.append(clone);
    }

    container.replaceChildren(fragment);

    const suggestions = state.elements.searchSuggestions;

    if (suggestions) {
        const shouldShow =
            query.length >= CONFIG.search.minimumQueryLength;

        suggestions.hidden = !shouldShow;

        if (state.elements.suggestionsLabel) {
            state.elements.suggestionsLabel.hidden =
                features.length === 0;
        }

        if (state.elements.suggestionsEmpty) {
            state.elements.suggestionsEmpty.hidden =
                !shouldShow || features.length > 0;
        }

        state.elements.searchInput?.setAttribute(
            "aria-expanded",
            String(shouldShow)
        );
    }
}


export function clearDashboardSearch() {
    state.searchQuery = "";

    if (state.elements.searchInput) {
        state.elements.searchInput.value = "";
        state.elements.searchInput.setAttribute(
            "aria-expanded",
            "false"
        );
    }

    if (state.elements.searchClear) {
        state.elements.searchClear.hidden = true;
    }

    if (state.elements.searchSuggestions) {
        state.elements.searchSuggestions.hidden = true;
    }

    if (state.elements.suggestionsList) {
        state.elements.suggestionsList.replaceChildren();
    }

    state.elements.searchInput?.focus();
}


/* ============================================================
   23. NAVIGATION HISTORY
   ============================================================ */

function loadNavigationHistory() {
    const key = getStorageKey(
        CONFIG.persistence.keys.navigationHistory
    );

    const saved = readStorage(key, []);

    state.history = Array.isArray(saved)
        ? saved.filter((entry) => {
            return (
                isObject(entry) &&
                typeof entry.title === "string" &&
                Number.isFinite(entry.timestamp)
            );
        })
        : [];

    cleanupExpiredHistory();
    renderNavigationHistory();
}


function saveNavigationHistory() {
    const key = getStorageKey(
        CONFIG.persistence.keys.navigationHistory
    );

    return writeStorage(key, state.history);
}


function cleanupExpiredHistory() {
    const retentionMs =
        CONFIG.history.retentionDays * 24 * 60 * 60 * 1000;

    const cutoff = getCurrentTimestamp() - retentionMs;

    state.history = state.history.filter(
        (entry) => entry.timestamp >= cutoff
    );

    state.history = state.history.slice(
        0,
        state.maximumHistoryEntries
    );
}


export function recordDashboardHistory(
    input,
    options = {}
) {
    if (!CONFIG.history.enabled || !isObject(input)) {
        return null;
    }

    const title = normalizeString(input.title);

    if (!title) {
        return null;
    }

    const now = getCurrentTimestamp();

    const deduplicateMilliseconds =
        options.deduplicateMilliseconds ?? 0;

    const latest = state.history[0];

    if (
        latest &&
        latest.title === title &&
        now - latest.timestamp < deduplicateMilliseconds
    ) {
        return latest;
    }

    const entry = {
        id: createHistoryId(),

        type: normalizeString(input.type, "activity"),

        featureId: normalizeString(input.featureId),

        title,

        timestamp: now,
    };

    state.history.unshift(entry);

    cleanupExpiredHistory();
    saveNavigationHistory();
    renderNavigationHistory();

    dispatchDashboardEvent(
        HISTORY_EVENT_NAME,
        { entry }
    );

    return entry;
}


function createHistoryId() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    return [
        Date.now().toString(36),
        Math.random().toString(36).slice(2, 10),
    ].join("-");
}


function createHistoryItem(entry) {
    const template = state.elements.historyItemTemplate;

    if (!template?.content) {
        return null;
    }

    const clone = template.content.cloneNode(true);

    const item = clone.querySelector("[data-history-item]");

    const icon = clone.querySelector("[data-history-icon]");
    const title = clone.querySelector("[data-history-title]");
    const time = clone.querySelector("[data-history-time]");
    const removeButton = clone.querySelector(
        '[data-action="remove-history-item"]'
    );

    if (!item) {
        return null;
    }

    item.dataset.historyId = entry.id;

    if (icon) {
        icon.textContent = getHistoryIcon(entry.type);
    }

    if (title) {
        title.textContent = entry.title;
    }

    if (time) {
        const date = new Date(entry.timestamp);

        time.dateTime = date.toISOString();

        time.textContent = new Intl.DateTimeFormat(
            CONFIG.app.locale,
            {
                dateStyle: "medium",
                timeStyle: "short",
            }
        ).format(date);
    }

    if (removeButton) {
        removeButton.dataset.historyId = entry.id;
    }

    return clone;
}


function getHistoryIcon(type) {
    const icons = {
        "feature-open": "↗",
        search: "⌕",
        "feature-hub-open": "+",
        "dashboard-open": "⌂",
        "layout-edit": "▦",
    };

    return icons[type] ?? "•";
}


export function renderNavigationHistory() {
    const list = state.elements.historyList;

    if (!list) {
        return;
    }

    cleanupExpiredHistory();

    const fragment = document.createDocumentFragment();

    for (const entry of state.history) {
        const item = createHistoryItem(entry);

        if (item) {
            fragment.append(item);
        }
    }

    list.replaceChildren(fragment);

    if (state.elements.historyEmpty) {
        state.elements.historyEmpty.hidden =
            state.history.length > 0;
    }

    if (state.elements.historyButton) {
        state.elements.historyButton.setAttribute(
            "aria-expanded",
            String(
                state.elements.historyPanel?.hidden === false
            )
        );
    }
}


export function removeNavigationHistoryEntry(entryId) {
    const previousLength = state.history.length;

    state.history = state.history.filter(
        (entry) => entry.id !== entryId
    );

    if (state.history.length === previousLength) {
        return false;
    }

    saveNavigationHistory();
    renderNavigationHistory();

    announce("Aktivitas dihapus dari riwayat.");

    return true;
}


export function clearNavigationHistory() {
    state.history = [];

    saveNavigationHistory();
    renderNavigationHistory();

    announce("Riwayat aktivitas sudah dihapus.");
}


export function toggleNavigationHistory(force) {
    const panel = state.elements.historyPanel;

    if (!panel) {
        return false;
    }

    const shouldOpen = typeof force === "boolean"
        ? force
        : panel.hidden;

    panel.hidden = !shouldOpen;

    if (state.elements.historyButton) {
        state.elements.historyButton.setAttribute(
            "aria-expanded",
            String(shouldOpen)
        );
    }

    return shouldOpen;
}


/* ============================================================
   24. WEEKLY HISTORY CLEANUP
   ============================================================ */

/**
 * Pembersihan Minggu pukul 00.00 waktu lokal perangkat.
 *
 * Browser mungkin menghentikan timer saat halaman ditutup.
 * Karena itu, pembersihan juga diperiksa ketika dashboard
 * diinisialisasi kembali.
 */

function getLocalSundayKey(date = new Date()) {
    const sunday = new Date(date);

    sunday.setHours(0, 0, 0, 0);
    sunday.setDate(
        sunday.getDate() - sunday.getDay()
    );

    return [
        sunday.getFullYear(),
        String(sunday.getMonth() + 1).padStart(2, "0"),
        String(sunday.getDate()).padStart(2, "0"),
    ].join("-");
}


function runScheduledHistoryCleanup() {
    if (!CONFIG.history.automaticCleanup.enabled) {
        return;
    }

    const key = getStorageKey("history-cleanup-sunday");

    const now = new Date();

    const lastCleanup = readStorage(key, null);

    const currentSundayKey = getLocalSundayKey(now);

    if (
        now.getDay() ===
            CONFIG.history.automaticCleanup.weekday &&
        lastCleanup !== currentSundayKey
    ) {
        clearNavigationHistory();

        writeStorage(key, currentSundayKey);
    }
}


function scheduleNextSundayCleanup() {
    if (!CONFIG.history.automaticCleanup.enabled) {
        return;
    }

    if (state.historyCleanupTimer !== null) {
        clearTimeout(state.historyCleanupTimer);
    }

    const now = new Date();

    const nextSunday = new Date(now);

    nextSunday.setHours(0, 0, 0, 0);

    let daysUntilSunday = (7 - now.getDay()) % 7;

    if (
        daysUntilSunday === 0 &&
        now.getHours() === 0 &&
        now.getMinutes() === 0 &&
        now.getSeconds() === 0
    ) {
        daysUntilSunday = 0;
    } else if (daysUntilSunday === 0) {
        daysUntilSunday = 7;
    }

    nextSunday.setDate(
        now.getDate() + daysUntilSunday
    );

    const delay = Math.max(
        1000,
        nextSunday.getTime() - now.getTime()
    );

    state.historyCleanupTimer = setTimeout(() => {
        clearNavigationHistory();

        writeStorage(
            getStorageKey("history-cleanup-sunday"),
            getLocalSundayKey(new Date())
        );

        scheduleNextSundayCleanup();
    }, delay);
}


/* ============================================================
   25. THEME
   ============================================================ */

function loadThemePreference() {
    const key = getStorageKey(
        CONFIG.persistence.keys.preferences
    );

    // Tema kini diatur bersama untuk seluruh web (js/theme.js, area "dashboard").
    void key;
    state.theme = themeFor("dashboard");
    applyTheme("dashboard");
}

// Ikut berubah bila tema diganti dari halaman lain / pengaturan.
window.addEventListener("kantoong:theme-applied", (event) => {
    const theme = event.detail?.theme;

    if (event.detail?.area !== "dashboard" || !theme || theme === state.theme) {
        return;
    }

    state.theme = theme;

    if (state.root) {
        state.root.dataset.theme = theme;
    }

    bento?.refresh();
});


function saveThemePreference() {
    const key = getStorageKey(
        CONFIG.persistence.keys.preferences
    );

    const current = readStorage(key, {});

    const preferences = isObject(current)
        ? current
        : {};

    preferences.theme = state.theme;

    return writeStorage(key, preferences);
}


export function setDashboardTheme(theme) {
    if (!CONFIG.theme.supported.includes(theme)) {
        return false;
    }

    state.theme = theme;

    if (state.root) {
        state.root.dataset.theme = theme;
    }

    saveThemePreference();
    setChoice("dashboard", theme);

    dispatchDashboardEvent(
        THEME_EVENT_NAME,
        { theme }
    );

    announce(
        theme === "dark"
            ? "Tema gelap aktif."
            : "Tema terang aktif."
    );

    return true;
}


export function toggleDashboardTheme() {
    const nextTheme = state.theme === "dark"
        ? "light"
        : "dark";

    return setDashboardTheme(nextTheme);
}


/* ============================================================
   26. DASHBOARD BRAND CONFIGURATION
   ============================================================ */

/**
 * Fungsi untuk mengatur teks brand dari konfigurasi.
 *
 * Tampilan dan konfigurasi tenant dipisahkan dari logika inti.
 * Jangan meletakkan rahasia atau credential di konfigurasi ini.
 */

export function applyDashboardBrandConfig(config = {}) {
    if (!isObject(config)) {
        return;
    }

    if (
        typeof config.brandName === "string" &&
        state.elements.brandName
    ) {
        state.elements.brandName.textContent =
            config.brandName;
    }

    if (
        typeof config.brandSubtitle === "string" &&
        state.elements.brandSubtitle
    ) {
        state.elements.brandSubtitle.textContent =
            config.brandSubtitle;
    }

    if (
        typeof config.welcomeTitle === "string" &&
        state.elements.welcomeTitle
    ) {
        state.elements.welcomeTitle.textContent =
            config.welcomeTitle;
    }

    if (
        typeof config.welcomeMessage === "string" &&
        state.elements.welcomeMessage
    ) {
        state.elements.welcomeMessage.textContent =
            config.welcomeMessage;

        state.elements.welcomeMessage.hidden =
            !config.welcomeMessage;
    }

    if (
        typeof config.footerLabel === "string" &&
        state.elements.footerBrand
    ) {
        state.elements.footerBrand.textContent =
            config.footerLabel;
    }
}


/* ============================================================
   27. FEATURE AREA VISIBILITY
   ============================================================ */

export function setDashboardLoading(isLoading) {
    if (state.elements.featureLoading) {
        state.elements.featureLoading.hidden = !isLoading;
    }

    if (isLoading) {
        if (state.elements.featureEmpty) {
            state.elements.featureEmpty.hidden = true;
        }

        if (state.elements.featureError) {
            state.elements.featureError.hidden = true;
        }
    }
}


export function setDashboardError(message) {
    if (state.elements.featureErrorMessage) {
        state.elements.featureErrorMessage.textContent =
            normalizeString(
                message,
                "Coba muat ulang dashboard."
            );
    }

    if (state.elements.featureError) {
        state.elements.featureError.hidden = false;
    }

    if (state.elements.featureLoading) {
        state.elements.featureLoading.hidden = true;
    }
}


/* ============================================================
   28. DASHBOARD STATE API
   ============================================================ */

/**
 * Snapshot state untuk modul events/bootstrap.
 *
 * Objek hasil tidak memberikan akses langsung untuk mengubah
 * Set/Map internal dashboard.
 */

export function getDashboardState() {
    return {
        initialized: state.initialized,

        mode: state.mode,

        theme: state.theme,

        viewportWidth: state.viewportWidth,

        gridColumns: state.gridColumns,

        gridProfile: state.gridProfile,

        activeFeatureIds: [
            ...state.activeFeatureIds,
        ],

        layout: getCurrentLayout().map(
            (entry) => ({ ...entry })
        ),

        history: state.history.map(
            (entry) => ({ ...entry })
        ),

        searchQuery: state.searchQuery,
    };
}


/* ============================================================
   29. VIEWPORT CHANGE
   ============================================================ */

function handleViewportChange() {
    const previousProfile = state.gridProfile;

    updateViewportProfile();

    if (previousProfile !== state.gridProfile) {
        /**
         * Jangan langsung menimpa layout profile lain.
         * Setiap profil menyimpan tata letaknya sendiri.
         */
        ensureLayoutsContainActiveFeatures();

        renderDashboardFeatures();

        saveLayouts();
    } else {
        /**
         * Saat lebar viewport berubah dalam profil yang sama,
         * pastikan kolom dan ukuran kartu tetap valid.
         */
        const currentLayout = validateLayout(
            getCurrentLayout(),
            state.gridProfile
        );

        setCurrentLayout(currentLayout);

        renderDashboardFeatures();
    }
}


/* ============================================================
   30. INITIALIZATION
   ============================================================ */

/**
 * Fungsi utama inisialisasi.
 *
 * Urutan:
 * 1. Validasi DOM.
 * 2. Tentukan viewport.
 * 3. Muat tema.
 * 4. Muat layout.
 * 5. Muat pilihan fitur.
 * 6. Muat riwayat.
 * 7. Siapkan UI awal.
 *
 * Module feature loader nantinya memanggil
 * registerDashboardFeatures(...) setelah modul ditemukan.
 */

// Dari toko (halaman induk): buka fitur tertentu, mis. kembali ke Katalog Produk.
window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin || event.data?.type !== "kantoong:dashboard-open-feature") {
        return;
    }

    window.dispatchEvent(new CustomEvent("kantoong:bento-open", { detail: { id: String(event.data.id ?? "") } }));
});

window.addEventListener("kantoong:bento-open", async (event) => {
    const id = event.detail?.id;

    if (!id) {
        return;
    }

    await closeFeatureStage();

    if (!state.activeFeatureIds.has(id) && state.featureCatalog.get(id)?.status === "published") {
        addFeatureToDashboard(id);
    }

    openDashboardFeature(id);
});

export function initDashboardUser() {
    if (state.initialized) {
        return getDashboardState();
    }

    collectDashboardElements();

    featureHubController = initFeatureHub({
        hub: featureHub,
        getElements: () => state.elements,
    });

    observeGridSize();

    updateViewportProfile();

    loadThemePreference();

    state.root.dataset.theme = state.theme;
    state.root.dataset.layoutMode = state.mode;

    loadSavedLayouts();
    loadFeatureSelection();
    loadNavigationHistory();

    /**
     * Saat dashboard baru pertama kali dibuka,
     * grid belum muncul dan seluruh kontrol edit disembunyikan.
     */
    setDashboardLayoutMode(LAYOUT_MODE_VIEW);

    state.elements.searchSuggestions &&
        (state.elements.searchSuggestions.hidden = true);

    state.elements.historyPanel &&
        (state.elements.historyPanel.hidden = true);

    if (state.elements.featureLoading) {
        state.elements.featureLoading.hidden = true;
    }

    /**
     * Jika belum ada modul yang diregistrasikan, tampilkan
     * empty state yang sudah disediakan HTML.
     */
    renderDashboardFeatures();

    runScheduledHistoryCleanup();
    scheduleNextSundayCleanup();

    /**
     * Resize listener dikelola oleh AbortController agar
     * inisialisasi ulang tidak menggandakan listener.
     */
    state.abortController = new AbortController();

    window.addEventListener(
        "resize",
        handleViewportChange,
        {
            passive: true,
            signal: state.abortController.signal,
        }
    );

    document.addEventListener(
        "keydown",
        (event) => {
            if (event.key === "Escape" && activeStage) {
                closeFeatureStage();
            }
        },
        { signal: state.abortController.signal }
    );

    state.initialized = true;

    recordDashboardHistory({
        type: "dashboard-open",
        title: "Membuka Menu Personal",
    }, {
        deduplicateMilliseconds: 3000,
    });

    dispatchDashboardEvent(
        "kantoong:dashboard-initialized",
        getDashboardState()
    );

    return getDashboardState();
}


/* ============================================================
   31. CLEANUP
   ============================================================ */

/**
 * Dapat dipanggil jika modul dashboard perlu dibongkar,
 * misalnya saat full-screen menu ditutup permanen.
 */

export function destroyDashboardUser() {
    closeFeatureStage();

    featureHubController?.destroy();
    featureHubController = null;

    gridResizeObserver?.disconnect();
    gridResizeObserver = null;

    state.abortController?.abort();

    state.abortController = null;

    if (state.historyCleanupTimer !== null) {
        clearTimeout(state.historyCleanupTimer);

        state.historyCleanupTimer = null;
    }

    state.initialized = false;
}


/* ============================================================
   32. DEFAULT EXPORT
   ============================================================ */

export default {
    init: initDashboardUser,

    destroy: destroyDashboardUser,

    getState: getDashboardState,

    registerFeatures: registerDashboardFeatures,

    getFeatures: getDashboardFeatures,

    getActiveFeatures: getActiveDashboardFeatures,

    renderFeatures: renderDashboardFeatures,

    renderFeatureHub,

    setLayoutMode: setDashboardLayoutMode,

    beginLayoutEdit: beginDashboardLayoutEdit,

    finishLayoutEdit: finishDashboardLayoutEdit,

    cancelLayoutEdit: cancelDashboardLayoutEdit,

    moveCard: moveFeatureCard,

    resizeCard: resizeFeatureCard,

    resetLayout: resetDashboardLayout,

    openFeature: openDashboardFeature,

    addFeature: addFeatureToDashboard,

    archiveFeature: archiveFeatureFromDashboard,

    openFeatureHub,

    closeFeatureHub,

    search: searchDashboardFeatures,

    clearSearch: clearDashboardSearch,

    toggleHistory: toggleNavigationHistory,

    recordHistory: recordDashboardHistory,

    removeHistoryEntry: removeNavigationHistoryEntry,

    clearHistory: clearNavigationHistory,

    setTheme: setDashboardTheme,

    toggleTheme: toggleDashboardTheme,

    applyBrandConfig: applyDashboardBrandConfig,

    setLoading: setDashboardLoading,

    setError: setDashboardError,
};

/**
 * KANTOONG CORE
 * File: frontend/dashboard-user/core/brand-config.js
 *
 * Tanggung jawab:
 * - Menyediakan konfigurasi default brand.
 * - Memisahkan identitas brand dari logika aplikasi.
 * - Memvalidasi konfigurasi brand dan tampilan dashboard.
 * - Mendukung konfigurasi per tenant.
 * - Menyediakan API untuk membaca dan memperbarui konfigurasi.
 *
 * Prinsip arsitektur:
 * - Default config bersifat netral dan tidak terikat klien tertentu.
 * - Modul ini tidak menyimpan konfigurasi permanen sendiri.
 * - Penyimpanan permanen ditangani adapter storage/backend.
 * - Konfigurasi dari database harus divalidasi sebelum diterapkan.
 * - Konfigurasi brand bukan sumber otorisasi atau keamanan.
 */

const BRAND_CONFIG_VERSION = 1;

const DEFAULT_BRAND_CONFIG = Object.freeze({
    version: BRAND_CONFIG_VERSION,

    brand: Object.freeze({
        name: "KANTOONG",
        legalName: "",
        description: "",
        logoUrl: "",
        faviconUrl: "",
        websiteUrl: "",
        supportEmail: "",
        supportPhone: "",
    }),

    appearance: Object.freeze({
        theme: "system",

        colors: Object.freeze({
            primary: "#111111",
            secondary: "#666666",
            background: "#F6F6F4",
            surface: "#FFFFFF",
            text: "#171717",
            mutedText: "#737373",
            border: "#E5E5E5",
            accent: "#404040",
            danger: "#B42318",
            success: "#067647",
            warning: "#B54708",
        }),

        borderRadius: "medium",
        density: "comfortable",
        fontFamily: "system",
        reduceMotion: false,
    }),

    dashboard: Object.freeze({
        layout: "bento",
        cardColumns: {
            desktop: 4,
            tablet: 2,
            mobile: 1,
        },
        allowCustomization: true,
        showWelcome: true,
        showSearch: true,
        showRecentActivity: true,
    }),

    features: Object.freeze({
        allowUserFeatureCustomization: true,
        showDisabledFeatures: false,
    }),

    localization: Object.freeze({
        language: "id-ID",
        timezone: "Asia/Jakarta",
        currency: "IDR",
        dateFormat: "DD MMM YYYY",
        numberFormat: "id-ID",
    }),
});

const VALID_THEMES = new Set([
    "light",
    "dark",
    "system",
]);

const VALID_LAYOUTS = new Set([
    "bento",
    "grid",
    "list",
]);

const VALID_BORDER_RADIUS = new Set([
    "none",
    "small",
    "medium",
    "large",
]);

const VALID_DENSITIES = new Set([
    "compact",
    "comfortable",
    "spacious",
]);

const VALID_FONTS = new Set([
    "system",
    "sans",
    "serif",
    "mono",
]);

const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

const URL_FIELDS = new Set([
    "logoUrl",
    "faviconUrl",
    "websiteUrl",
]);

const BRAND_TEXT_LIMITS = Object.freeze({
    name: 100,
    legalName: 200,
    description: 500,
    supportEmail: 254,
    supportPhone: 40,
});

const tenantConfigs = new Map();
const configListeners = new Set();

/**
 * Membuat salinan object/array agar konfigurasi default
 * tidak dapat berubah akibat mutasi dari pemanggil.
 */
function cloneValue(value) {
    if (Array.isArray(value)) {
        return value.map(cloneValue);
    }

    if (
        value &&
        typeof value === "object"
    ) {
        const result = {};

        for (const [key, child] of Object.entries(value)) {
            result[key] = cloneValue(child);
        }

        return result;
    }

    return value;
}

/**
 * Deep freeze untuk konfigurasi default.
 */
function deepFreeze(value) {
    if (!value || typeof value !== "object") {
        return value;
    }

    Object.freeze(value);

    for (const child of Object.values(value)) {
        deepFreeze(child);
    }

    return value;
}

deepFreeze(DEFAULT_BRAND_CONFIG);

/**
 * Mengambil konfigurasi default.
 * Hasil berupa salinan yang dapat dimodifikasi pemanggil.
 */
export function getDefaultBrandConfig() {
    return cloneValue(DEFAULT_BRAND_CONFIG);
}

/**
 * Memastikan nilai adalah object biasa.
 */
function isPlainObject(value) {
    if (
        value === null ||
        typeof value !== "object" ||
        Array.isArray(value)
    ) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return (
        prototype === Object.prototype ||
        prototype === null
    );
}

/**
 * Menggabungkan konfigurasi secara rekursif.
 * Array dan nilai primitif diganti, bukan digabung.
 */
function mergeConfig(base, override) {
    const result = cloneValue(base);

    if (!isPlainObject(override)) {
        return result;
    }

    for (const [key, value] of Object.entries(override)) {
        if (
            isPlainObject(value) &&
            isPlainObject(result[key])
        ) {
            result[key] = mergeConfig(result[key], value);
        } else {
            result[key] = cloneValue(value);
        }
    }

    return result;
}

/**
 * Memvalidasi tenant ID.
 */
function normalizeTenantId(tenantId) {
    if (typeof tenantId !== "string") {
        throw new TypeError(
            "[KANTOONG BrandConfig] tenantId harus berupa string."
        );
    }

    const normalized = tenantId.trim();

    if (
        !normalized ||
        normalized.length > 128
    ) {
        throw new Error(
            "[KANTOONG BrandConfig] tenantId tidak valid."
        );
    }

    return normalized;
}

/**
 * Memastikan URL menggunakan HTTP atau HTTPS.
 * URL kosong diperbolehkan.
 */
function isSafeHttpUrl(value) {
    if (value === "") {
        return true;
    }

    if (typeof value !== "string") {
        return false;
    }

    try {
        const url = new URL(value);

        return (
            url.protocol === "https:" ||
            url.protocol === "http:"
        );
    } catch {
        return false;
    }
}

/**
 * Validasi konfigurasi brand.
 *
 * Mengembalikan:
 * { valid: boolean, errors: string[] }
 */
export function validateBrandConfig(config) {
    const errors = [];

    if (!isPlainObject(config)) {
        return {
            valid: false,
            errors: ["Konfigurasi harus berupa object."],
        };
    }

    if (
        config.version !== undefined &&
        config.version !== BRAND_CONFIG_VERSION
    ) {
        errors.push("Versi konfigurasi tidak didukung.");
    }

    const brand = config.brand;
    const appearance = config.appearance;
    const dashboard = config.dashboard;
    const localization = config.localization;

    if (!isPlainObject(brand)) {
        errors.push("Bagian brand harus berupa object.");
    } else {
        for (const [field, maxLength] of Object.entries(
            BRAND_TEXT_LIMITS
        )) {
            const value = brand[field];

            if (
                value !== undefined &&
                (
                    typeof value !== "string" ||
                    value.length > maxLength
                )
            ) {
                errors.push(
                    `brand.${field} harus berupa teks maksimal ${maxLength} karakter.`
                );
            }
        }

        if (
            typeof brand.name === "string" &&
            !brand.name.trim()
        ) {
            errors.push("Nama brand tidak boleh kosong.");
        }

        for (const field of URL_FIELDS) {
            if (
                brand[field] !== undefined &&
                !isSafeHttpUrl(brand[field])
            ) {
                errors.push(
                    `brand.${field} harus berupa URL HTTP atau HTTPS yang valid.`
                );
            }
        }

        if (
            typeof brand.supportEmail === "string" &&
            brand.supportEmail &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                brand.supportEmail
            )
        ) {
            errors.push("Format email dukungan tidak valid.");
        }
    }

    if (!isPlainObject(appearance)) {
        errors.push("Bagian appearance harus berupa object.");
    } else {
        if (
            appearance.theme !== undefined &&
            !VALID_THEMES.has(appearance.theme)
        ) {
            errors.push("Tema harus light, dark, atau system.");
        }

        if (
            appearance.borderRadius !== undefined &&
            !VALID_BORDER_RADIUS.has(
                appearance.borderRadius
            )
        ) {
            errors.push("Nilai borderRadius tidak valid.");
        }

        if (
            appearance.density !== undefined &&
            !VALID_DENSITIES.has(appearance.density)
        ) {
            errors.push("Nilai density tidak valid.");
        }

        if (
            appearance.fontFamily !== undefined &&
            !VALID_FONTS.has(appearance.fontFamily)
        ) {
            errors.push("Nilai fontFamily tidak valid.");
        }

        if (
            appearance.reduceMotion !== undefined &&
            typeof appearance.reduceMotion !== "boolean"
        ) {
            errors.push("reduceMotion harus berupa boolean.");
        }

        if (appearance.colors !== undefined) {
            if (!isPlainObject(appearance.colors)) {
                errors.push("appearance.colors harus berupa object.");
            } else {
                for (const [name, color] of Object.entries(
                    appearance.colors
                )) {
                    if (
                        typeof color !== "string" ||
                        !COLOR_PATTERN.test(color)
                    ) {
                        errors.push(
                            `Warna "${name}" harus memakai format hex #RRGGBB.`
                        );
                    }
                }
            }
        }
    }

    if (!isPlainObject(dashboard)) {
        errors.push("Bagian dashboard harus berupa object.");
    } else {
        if (
            dashboard.layout !== undefined &&
            !VALID_LAYOUTS.has(dashboard.layout)
        ) {
            errors.push("Layout harus bento, grid, atau list.");
        }

        if (dashboard.cardColumns !== undefined) {
            const columns = dashboard.cardColumns;

            if (!isPlainObject(columns)) {
                errors.push(
                    "dashboard.cardColumns harus berupa object."
                );
            } else {
                for (const device of [
                    "desktop",
                    "tablet",
                    "mobile",
                ]) {
                    const count = columns[device];

                    if (
                        count !== undefined &&
                        (
                            !Number.isInteger(count) ||
                            count < 1 ||
                            count > 12
                        )
                    ) {
                        errors.push(
                            `Jumlah kolom ${device} harus bilangan bulat 1–12.`
                        );
                    }
                }
            }
        }

        for (const field of [
            "allowCustomization",
            "showWelcome",
            "showSearch",
            "showRecentActivity",
        ]) {
            if (
                dashboard[field] !== undefined &&
                typeof dashboard[field] !== "boolean"
            ) {
                errors.push(
                    `dashboard.${field} harus berupa boolean.`
                );
            }
        }
    }

    if (
        config.features !== undefined &&
        !isPlainObject(config.features)
    ) {
        errors.push("Bagian features harus berupa object.");
    }

    if (
        config.features &&
        isPlainObject(config.features)
    ) {
        for (const field of [
            "allowUserFeatureCustomization",
            "showDisabledFeatures",
        ]) {
            if (
                config.features[field] !== undefined &&
                typeof config.features[field] !== "boolean"
            ) {
                errors.push(
                    `features.${field} harus berupa boolean.`
                );
            }
        }
    }

    if (!isPlainObject(localization)) {
        errors.push("Bagian localization harus berupa object.");
    } else {
        for (const field of [
            "language",
            "timezone",
            "currency",
            "dateFormat",
            "numberFormat",
        ]) {
            if (
                localization[field] !== undefined &&
                (
                    typeof localization[field] !== "string" ||
                    !localization[field].trim()
                )
            ) {
                errors.push(
                    `localization.${field} harus berupa teks yang valid.`
                );
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Mengambil konfigurasi brand untuk tenant.
 *
 * Jika tenant belum memiliki konfigurasi, gunakan default.
 */
export function getBrandConfig(tenantId) {
    const id = normalizeTenantId(tenantId);
    const tenantConfig = tenantConfigs.get(id);

    return tenantConfig
        ? cloneValue(tenantConfig)
        : getDefaultBrandConfig();
}

/**
 * Memvalidasi dan mengganti konfigurasi tenant.
 *
 * Fungsi ini hanya memperbarui memori runtime.
 * Penyimpanan permanen harus ditangani backend/adapter.
 */
export function setBrandConfig(tenantId, config) {
    const id = normalizeTenantId(tenantId);

    if (!isPlainObject(config)) {
        throw new TypeError(
            "[KANTOONG BrandConfig] Config harus berupa object."
        );
    }

    const merged = mergeConfig(
        DEFAULT_BRAND_CONFIG,
        config
    );

    const validation = validateBrandConfig(merged);

    if (!validation.valid) {
        const error = new Error(
            "Konfigurasi brand tidak valid."
        );

        error.name = "BrandConfigValidationError";
        error.validationErrors = validation.errors;

        throw error;
    }

    const frozenSnapshot = deepFreeze(cloneValue(merged));

    tenantConfigs.set(id, frozenSnapshot);

    const event = Object.freeze({
        tenantId: id,
        config: cloneValue(frozenSnapshot),
        timestamp: new Date().toISOString(),
    });

    for (const listener of [...configListeners]) {
        try {
            listener(event);
        } catch (error) {
            console.error(
                "[KANTOONG BrandConfig] Listener gagal.",
                error
            );
        }
    }

    return cloneValue(frozenSnapshot);
}

/**
 * Menggabungkan konfigurasi parsial dengan konfigurasi tenant saat ini.
 */
export function updateBrandConfig(tenantId, partialConfig) {
    const id = normalizeTenantId(tenantId);

    if (!isPlainObject(partialConfig)) {
        throw new TypeError(
            "[KANTOONG BrandConfig] Perubahan config harus berupa object."
        );
    }

    const current = getBrandConfig(id);
    const updated = mergeConfig(current, partialConfig);

    return setBrandConfig(id, updated);
}

/**
 * Menghapus konfigurasi tenant dari memori.
 * Tenant akan kembali menggunakan konfigurasi default.
 */
export function resetBrandConfig(tenantId) {
    const id = normalizeTenantId(tenantId);

    return tenantConfigs.delete(id);
}

/**
 * Memeriksa apakah tenant memiliki konfigurasi khusus.
 */
export function hasCustomBrandConfig(tenantId) {
    const id = normalizeTenantId(tenantId);

    return tenantConfigs.has(id);
}

/**
 * Mendengarkan perubahan konfigurasi brand.
 * Mengembalikan fungsi unsubscribe.
 */
export function onBrandConfigChange(listener) {
    if (typeof listener !== "function") {
        throw new TypeError(
            "[KANTOONG BrandConfig] Listener harus berupa function."
        );
    }

    configListeners.add(listener);

    return () => configListeners.delete(listener);
}

/**
 * Mengambil daftar tenant yang memiliki konfigurasi di memori.
 * Tidak mengambil data dari database.
 */
export function getConfiguredTenantIds() {
    return [...tenantConfigs.keys()];
}

/**
 * Membersihkan semua konfigurasi tenant dari memori.
 * Tidak menghapus data permanen di database.
 */
export function clearBrandConfigCache() {
    const removedCount = tenantConfigs.size;

    tenantConfigs.clear();

    return removedCount;
}

/**
 * API publik.
 */
const BrandConfig = Object.freeze({
    BRAND_CONFIG_VERSION,
    DEFAULT_BRAND_CONFIG,
    getDefaultBrandConfig,
    validateBrandConfig,
    getBrandConfig,
    setBrandConfig,
    updateBrandConfig,
    resetBrandConfig,
    hasCustomBrandConfig,
    onBrandConfigChange,
    getConfiguredTenantIds,
    clearBrandConfigCache,
});

export {
    BRAND_CONFIG_VERSION,
    DEFAULT_BRAND_CONFIG,
};

export default BrandConfig;

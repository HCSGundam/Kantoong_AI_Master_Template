
/**
 * KANTOONG CORE
 * Core Module: Feature Registry
 * File: frontend/dashboard-user/core/feature-registry.js
 *
 * Tanggung jawab:
 * 1. Menjadi pusat registrasi fitur Dashboard User.
 * 2. Menyimpan fitur berdasarkan ID unik.
 * 3. Memvalidasi struktur dasar fitur.
 * 4. Mencegah ID duplikat.
 * 5. Menyediakan API untuk mencari, membaca, dan menghapus fitur.
 * 6. Menyediakan snapshot dan ringkasan registry.
 *
 * Catatan:
 * Registry bukan sistem autentikasi atau authorization.
 * Hak akses wajib tetap diperiksa oleh backend.
 */

const registry = new Map();

const FEATURE_REGISTRY_VERSION = "1.0.0";

/**
 * Validasi struktur dasar fitur.
 */
function validateFeature(feature) {
    const errors = [];

    if (
        !feature ||
        typeof feature !== "object" ||
        Array.isArray(feature)
    ) {
        return {
            valid: false,
            errors: ["FEATURE_MUST_BE_OBJECT"],
        };
    }

    if (
        typeof feature.id !== "string" ||
        feature.id.trim() === ""
    ) {
        errors.push("INVALID_FEATURE_ID");
    }

    if (
        typeof feature.name !== "string" ||
        feature.name.trim() === ""
    ) {
        errors.push("INVALID_FEATURE_NAME");
    }

    if (
        feature.description !== undefined &&
        typeof feature.description !== "string"
    ) {
        errors.push("INVALID_FEATURE_DESCRIPTION");
    }

    if (
        feature.category !== undefined &&
        typeof feature.category !== "string"
    ) {
        errors.push("INVALID_FEATURE_CATEGORY");
    }

    if (
        feature.enabled !== undefined &&
        typeof feature.enabled !== "boolean"
    ) {
        errors.push("INVALID_FEATURE_ENABLED");
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Normalisasi ID fitur.
 */
function normalizeFeatureId(id) {
    if (typeof id !== "string") {
        return null;
    }

    const normalized = id.trim().toLowerCase();

    return normalized.length > 0 ? normalized : null;
}

/**
 * Mendaftarkan satu fitur.
 *
 * Return:
 * {
 *   success: boolean,
 *   feature?: object,
 *   error?: string
 * }
 */
export function registerFeature(feature, options = {}) {
    const validation = validateFeature(feature);

    if (!validation.valid) {
        return {
            success: false,
            error: "INVALID_FEATURE",
            details: validation.errors,
        };
    }

    const id = normalizeFeatureId(feature.id);

    if (!id) {
        return {
            success: false,
            error: "INVALID_FEATURE_ID",
        };
    }

    if (registry.has(id)) {
        if (options.replace !== true) {
            return {
                success: false,
                error: "DUPLICATE_FEATURE_ID",
                featureId: id,
            };
        }
    }

    const registeredFeature = Object.freeze({
        ...feature,
        id,
    });

    registry.set(id, registeredFeature);

    return {
        success: true,
        feature: registeredFeature,
    };
}

/**
 * Mendaftarkan banyak fitur sekaligus.
 *
 * Fitur yang gagal tidak menghentikan fitur lainnya.
 */
export function registerFeatures(features = [], options = {}) {
    if (!Array.isArray(features)) {
        return {
            success: false,
            error: "FEATURES_MUST_BE_ARRAY",
            registered: [],
            rejected: [],
        };
    }

    const registered = [];
    const rejected = [];

    for (const feature of features) {
        const result = registerFeature(feature, options);

        if (result.success) {
            registered.push(result.feature);
        } else {
            rejected.push({
                featureId: feature?.id ?? null,
                error: result.error,
                details: result.details ?? [],
            });
        }
    }

    return {
        success: rejected.length === 0,
        registered,
        rejected,
        totalRegistered: registered.length,
        totalRejected: rejected.length,
    };
}

/**
 * Mengambil satu fitur berdasarkan ID.
 */
export function getFeature(id) {
    const normalizedId = normalizeFeatureId(id);

    if (!normalizedId) {
        return null;
    }

    return registry.get(normalizedId) ?? null;
}

/**
 * Memeriksa apakah suatu fitur telah terdaftar.
 */
export function hasFeature(id) {
    const normalizedId = normalizeFeatureId(id);

    return normalizedId !== null && registry.has(normalizedId);
}

/**
 * Mengambil semua fitur terdaftar.
 */
export function getAllFeatures() {
    return Array.from(registry.values());
}

/**
 * Mengambil fitur yang diaktifkan.
 *
 * Jika properti enabled tidak diisi,
 * fitur dianggap aktif secara default.
 */
export function getEnabledFeatures() {
    return getAllFeatures().filter(
        (feature) => feature.enabled !== false
    );
}

/**
 * Mengambil fitur berdasarkan kategori.
 */
export function getFeaturesByCategory(category) {
    if (typeof category !== "string" || !category.trim()) {
        return [];
    }

    const normalizedCategory = category.trim().toLowerCase();

    return getAllFeatures().filter(
        (feature) =>
            typeof feature.category === "string" &&
            feature.category.trim().toLowerCase() === normalizedCategory
    );
}

/**
 * Menghapus fitur berdasarkan ID.
 */
export function unregisterFeature(id) {
    const normalizedId = normalizeFeatureId(id);

    if (!normalizedId) {
        return {
            success: false,
            error: "INVALID_FEATURE_ID",
        };
    }

    if (!registry.has(normalizedId)) {
        return {
            success: false,
            error: "FEATURE_NOT_FOUND",
            featureId: normalizedId,
        };
    }

    registry.delete(normalizedId);

    return {
        success: true,
        featureId: normalizedId,
    };
}

/**
 * Menghapus seluruh isi registry.
 *
 * Gunakan hanya untuk reset terkontrol atau pengujian.
 */
export function clearFeatureRegistry() {
    const previousSize = registry.size;

    registry.clear();

    return {
        success: true,
        removedCount: previousSize,
    };
}

/**
 * Membuat snapshot daftar fitur.
 *
 * Array hasil tidak mengubah registry internal.
 */
export function getFeatureRegistrySnapshot() {
    return getAllFeatures().map((feature) => ({
        ...feature,
    }));
}

/**
 * Mengambil ringkasan registry.
 */
export function getFeatureRegistrySummary() {
    const features = getAllFeatures();

    return {
        version: FEATURE_REGISTRY_VERSION,
        total: features.length,
        enabled: features.filter(
            (feature) => feature.enabled !== false
        ).length,
        disabled: features.filter(
            (feature) => feature.enabled === false
        ).length,
        ids: features.map((feature) => feature.id),
    };
}

/**
 * API default untuk modul yang memilih default import.
 */
const FeatureRegistry = Object.freeze({
    version: FEATURE_REGISTRY_VERSION,
    registerFeature,
    registerFeatures,
    getFeature,
    hasFeature,
    getAllFeatures,
    getEnabledFeatures,
    getFeaturesByCategory,
    unregisterFeature,
    clearFeatureRegistry,
    getFeatureRegistrySnapshot,
    getFeatureRegistrySummary,
});

export default FeatureRegistry;
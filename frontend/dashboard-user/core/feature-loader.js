
/**
 * KANTOONG CORE
 * Core Module: Feature Loader
 * File: frontend/dashboard-user/core/feature-loader.js
 *
 * Tanggung jawab:
 * 1. Mengorkestrasi discovery dan registrasi fitur.
 * 2. Menyediakan lifecycle pemuatan fitur.
 * 3. Mencegah proses bootstrap berjalan berulang tanpa sengaja.
 * 4. Menyediakan API untuk mengambil fitur yang berhasil dimuat.
 * 5. Mengisolasi error antarfitur.
 * 6. Menyediakan laporan proses loading.
 *
 * Catatan:
 * - Discovery menggunakan Vite import.meta.glob().
 * - Registry menjadi sumber data fitur terdaftar.
 * - Loader tidak menggantikan sistem permission backend.
 */

import { discoverFeatures } from "./feature-discovery.js";

import {
    registerFeatures,
    getAllFeatures,
    getEnabledFeatures,
    getFeature,
    hasFeature,
} from "./feature-registry.js";

const FEATURE_LOADER_VERSION = "1.0.0";

let loaderState = {
    status: "idle",
    initialized: false,
    loading: false,
    lastLoadedAt: null,
    lastResult: null,
};

let initializationPromise = null;

/**
 * Membuat timestamp ISO untuk laporan.
 */
function getTimestamp() {
    return new Date().toISOString();
}

/**
 * Membuat laporan error standar.
 */
function createError(code, message, details = null) {
    return {
        code,
        message,
        details,
        timestamp: getTimestamp(),
    };
}

/**
 * Mengubah state loader menjadi snapshot yang aman dibaca.
 */
export function getFeatureLoaderState() {
    return {
        ...loaderState,
        lastResult: loaderState.lastResult
            ? {
                ...loaderState.lastResult,
                errors: [...loaderState.lastResult.errors],
            }
            : null,
    };
}

/**
 * Menjalankan discovery dan registrasi fitur.
 *
 * Fungsi ini tidak merender UI.
 * Rendering ditangani dashboard-shell atau feature-controller.
 */
export async function loadFeatures(options = {}) {
    if (loaderState.loading && initializationPromise) {
        return initializationPromise;
    }

    if (loaderState.initialized && options.force !== true) {
        return loaderState.lastResult;
    }

    loaderState.loading = true;
    loaderState.status = "loading";

    initializationPromise = (async () => {
        const errors = [];
        let discoveryResult;
        let registrationResult;

        try {
            discoveryResult = discoverFeatures();

            if (
                !discoveryResult ||
                !Array.isArray(discoveryResult.features)
            ) {
                throw new Error(
                    "Discovery tidak menghasilkan daftar fitur yang valid."
                );
            }

            for (const error of discoveryResult.errors ?? []) {
                errors.push(
                    createError(
                        error.reason ?? "DISCOVERY_ERROR",
                        `Discovery gagal memproses ${error.filePath ?? "modul fitur"}.`,
                        error
                    )
                );
            }

            registrationResult = registerFeatures(
                discoveryResult.features,
                {
                    replace: options.replace === true,
                }
            );

            for (const rejected of registrationResult.rejected ?? []) {
                errors.push(
                    createError(
                        rejected.error ?? "REGISTRATION_ERROR",
                        `Fitur "${rejected.featureId ?? "unknown"}" gagal didaftarkan.`,
                        rejected
                    )
                );
            }

            const allFeatures = getAllFeatures();
            const enabledFeatures = getEnabledFeatures();

            const result = {
                success: errors.length === 0,
                version: FEATURE_LOADER_VERSION,
                status: "completed",
                startedAt: loaderState.lastLoadedAt,
                completedAt: getTimestamp(),
                totalDiscovered: discoveryResult.totalDiscovered,
                totalRegistered: registrationResult.totalRegistered,
                totalRejected: registrationResult.totalRejected,
                totalAvailable: allFeatures.length,
                totalEnabled: enabledFeatures.length,
                features: enabledFeatures,
                errors,
            };

            loaderState.status = errors.length > 0
                ? "completed_with_errors"
                : "ready";

            loaderState.initialized = true;
            loaderState.lastLoadedAt = result.completedAt;
            loaderState.lastResult = result;

            console.info(
                "[KANTOONG CORE] Feature loader selesai.",
                {
                    discovered: result.totalDiscovered,
                    registered: result.totalRegistered,
                    available: result.totalAvailable,
                    enabled: result.totalEnabled,
                    errors: result.errors.length,
                }
            );

            return result;
        } catch (error) {
            const loaderError = createError(
                "FEATURE_LOADER_FAILED",
                error instanceof Error
                    ? error.message
                    : String(error)
            );

            errors.push(loaderError);

            const result = {
                success: false,
                version: FEATURE_LOADER_VERSION,
                status: "failed",
                completedAt: getTimestamp(),
                totalDiscovered: discoveryResult?.totalDiscovered ?? 0,
                totalRegistered: registrationResult?.totalRegistered ?? 0,
                totalRejected: registrationResult?.totalRejected ?? 0,
                totalAvailable: getAllFeatures().length,
                totalEnabled: getEnabledFeatures().length,
                features: getEnabledFeatures(),
                errors,
            };

            loaderState.status = "error";
            loaderState.lastResult = result;

            console.error(
                "[KANTOONG CORE] Feature loader gagal:",
                error
            );

            return result;
        } finally {
            loaderState.loading = false;
            initializationPromise = null;
        }
    })();

    return initializationPromise;
}

/**
 * Memastikan loader sudah selesai sebelum fitur diambil.
 */
export async function ensureFeaturesLoaded() {
    if (loaderState.initialized) {
        return loaderState.lastResult;
    }

    return loadFeatures();
}

/**
 * Mengambil seluruh fitur yang aktif.
 */
export async function getLoadedFeatures() {
    await ensureFeaturesLoaded();

    return getEnabledFeatures();
}

/**
 * Mengambil satu fitur berdasarkan ID.
 */
export async function getLoadedFeature(featureId) {
    await ensureFeaturesLoaded();

    const feature = getFeature(featureId);

    if (!feature || feature.enabled === false) {
        return null;
    }

    return feature;
}

/**
 * Memeriksa apakah fitur aktif dan sudah terdaftar.
 */
export async function isFeatureLoaded(featureId) {
    await ensureFeaturesLoaded();

    const feature = getFeature(featureId);

    return Boolean(
        feature &&
        hasFeature(featureId) &&
        feature.enabled !== false
    );
}

/**
 * Memuat ulang daftar fitur secara eksplisit.
 *
 * replace: true memungkinkan modul dengan ID yang sama
 * menggantikan entri registry yang lama.
 */
export async function reloadFeatures(options = {}) {
    return loadFeatures({
        ...options,
        force: true,
        replace: options.replace === true,
    });
}

/**
 * Mengambil laporan terakhir.
 */
export function getFeatureLoadReport() {
    return loaderState.lastResult;
}

/**
 * Mengatur ulang state loader.
 *
 * Tidak menghapus registry karena kepemilikan registry
 * tetap berada pada feature-registry.js.
 */
export function resetFeatureLoaderState() {
    if (loaderState.loading) {
        return {
            success: false,
            error: "CANNOT_RESET_WHILE_LOADING",
        };
    }

    loaderState = {
        status: "idle",
        initialized: false,
        loading: false,
        lastLoadedAt: null,
        lastResult: null,
    };

    initializationPromise = null;

    return {
        success: true,
        status: loaderState.status,
    };
}

/**
 * API default.
 */
const FeatureLoader = Object.freeze({
    version: FEATURE_LOADER_VERSION,
    loadFeatures,
    ensureFeaturesLoaded,
    getLoadedFeatures,
    getLoadedFeature,
    isFeatureLoaded,
    reloadFeatures,
    getFeatureLoaderState,
    getFeatureLoadReport,
    resetFeatureLoaderState,
});

export default FeatureLoader;

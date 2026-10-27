
/**
 * KANTOONG CORE
 * File: frontend/dashboard-user/core/core-bootstrap.js
 *
 * Tanggung jawab:
 * 1. Menjadi entry point inisialisasi Core.
 * 2. Memuat dan mendaftarkan fitur secara otomatis.
 * 3. Menyiapkan Feature Controller.
 * 4. Menyiapkan Feature Router.
 * 5. Menginisialisasi Command Center.
 * 6. Menyediakan status bootstrap dan lifecycle aplikasi.
 * 7. Mencegah bootstrap berjalan berulang secara tidak sengaja.
 *
 * Urutan:
 * Bootstrap
 *   -> Feature Loader
 *   -> Feature Controller
 *   -> Feature Router
 *   -> Command Center
 *
 * Catatan:
 * - Tidak merender UI.
 * - Tidak membuka fitur secara otomatis.
 * - Tidak menggantikan autentikasi atau backend authorization.
 */

import {
    ensureFeaturesLoaded,
    getFeatureLoadReport,
} from "./feature-loader.js";

import {
    getAllFeatures,
} from "./feature-registry.js";

import {
    initializeFeatureController,
    setControllerContext,
    getControllerContext,
} from "./feature-controller.js";

import {
    initializeFeatureRouter,
} from "./feature-router.js";

import {
    initializeCommandCenter,
} from "./command-center.js";

import {
    handleError,
} from "./error-handler.js";

/* =========================================================
   01. CONSTANTS
   ========================================================= */

export const CORE_BOOTSTRAP_VERSION = "1.0.0";

export const CORE_BOOTSTRAP_STATUS = Object.freeze({
    IDLE: "idle",
    INITIALIZING: "initializing",
    READY: "ready",
    DEGRADED: "degraded",
    ERROR: "error",
});

const BOOTSTRAP_CONTEXT_KEY = "kantoongCoreBootstrap";

/* =========================================================
   02. INTERNAL STATE
   ========================================================= */

let bootstrapStatus = CORE_BOOTSTRAP_STATUS.IDLE;
let bootstrapPromise = null;
let lastBootstrapResult = null;
let lastBootstrapError = null;
let bootstrapStartedAt = null;
let bootstrapCompletedAt = null;

/* =========================================================
   03. UTILITIES
   ========================================================= */

function createTimestamp() {
    return new Date().toISOString();
}

function createBootstrapError(message, code) {
    const error = new Error(message);

    error.name = "KantoongBootstrapError";
    error.code = code;

    return error;
}

function createBootstrapResult({
    success,
    status,
    startedAt,
    completedAt,
    featureCount = 0,
    features = [],
    stages = [],
    error = null,
}) {
    return Object.freeze({
        success,
        version: CORE_BOOTSTRAP_VERSION,
        status,
        startedAt,
        completedAt,
        durationMs:
            startedAt && completedAt
                ? Math.max(
                    0,
                    new Date(completedAt).getTime() -
                    new Date(startedAt).getTime()
                )
                : null,
        featureCount,
        features,
        stages,
        error,
    });
}

/**
 * Merekam hasil setiap tahap bootstrap.
 */
function recordStage(stages, name, status, details = {}) {
    stages.push(
        Object.freeze({
            name,
            status,
            timestamp: createTimestamp(),
            ...details,
        })
    );
}

/**
 * Mengambil error message yang aman untuk status UI.
 */
function getSafeErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }

    return "Terjadi kesalahan saat menginisialisasi KANTOONG CORE.";
}

/* =========================================================
   04. BOOTSTRAP CONTEXT
   ========================================================= */

/**
 * Menyiapkan context untuk controller.
 *
 * Context ini bukan bukti autentikasi dan bukan sumber
 * otoritas permission. Identitas dan hak akses tetap harus
 * diverifikasi oleh sistem autentikasi dan backend.
 */
function prepareBootstrapContext(options = {}) {
    const existingContext =
        options.context ??
        getControllerContext?.() ??
        {};

    const tenantId =
        typeof options.tenantId === "string" &&
        options.tenantId.trim()
            ? options.tenantId.trim()
            : existingContext.tenantId ?? null;

    const context = {
        ...existingContext,
        tenantId,
        source: "core-bootstrap",
        bootstrapVersion: CORE_BOOTSTRAP_VERSION,
    };

    setControllerContext(context);

    return context;
}

/* =========================================================
   05. MAIN BOOTSTRAP
   ========================================================= */

/**
 * Menginisialisasi KANTOONG CORE.
 *
 * Pemanggilan kedua akan menggunakan promise yang sama
 * selama bootstrap pertama masih berjalan.
 *
 * @param {object} options
 * @param {string} [options.tenantId]
 * @param {object} [options.context]
 * @param {boolean} [options.force]
 * @returns {Promise<object>}
 */
export async function bootstrapCore(options = {}) {
    if (
        bootstrapPromise &&
        options.force !== true
    ) {
        return bootstrapPromise;
    }

    if (
        bootstrapStatus === CORE_BOOTSTRAP_STATUS.READY &&
        lastBootstrapResult &&
        options.force !== true
    ) {
        return lastBootstrapResult;
    }

    bootstrapStatus = CORE_BOOTSTRAP_STATUS.INITIALIZING;
    bootstrapStartedAt = createTimestamp();
    bootstrapCompletedAt = null;
    lastBootstrapError = null;

    const stages = [];

    const run = async () => {
        let features = [];

        try {
            /* ---------------------------------------------
               STAGE 1 — CONTEXT
               --------------------------------------------- */

            const context = prepareBootstrapContext(options);

            recordStage(
                stages,
                "prepare-context",
                "success",
                {
                    tenantConfigured: Boolean(context.tenantId),
                }
            );

            /* ---------------------------------------------
               STAGE 2 — FEATURE LOADER
               --------------------------------------------- */

            const loaderResult = await ensureFeaturesLoaded();

            features = getAllFeatures();

            recordStage(
                stages,
                "load-features",
                "success",
                {
                    featureCount: features.length,
                    loaderResultType: Array.isArray(loaderResult)
                        ? "array"
                        : typeof loaderResult,
                }
            );

            /* ---------------------------------------------
               STAGE 3 — FEATURE CONTROLLER
               --------------------------------------------- */

            await initializeFeatureController(context);

            recordStage(
                stages,
                "initialize-feature-controller",
                "success"
            );

            /* ---------------------------------------------
               STAGE 4 — FEATURE ROUTER
               --------------------------------------------- */

            await initializeFeatureRouter();

            recordStage(
                stages,
                "initialize-feature-router",
                "success"
            );

            /* ---------------------------------------------
               STAGE 5 — COMMAND CENTER
               --------------------------------------------- */

            const commandCenterResult =
                initializeCommandCenter({
                    source: "core-bootstrap",
                    tenantId: context.tenantId,
                });

            recordStage(
                stages,
                "initialize-command-center",
                "success",
                {
                    commandCenterReady:
                        commandCenterResult?.success === true,
                }
            );

            /* ---------------------------------------------
               STAGE 6 — FINAL REPORT
               --------------------------------------------- */

            let loadReport = null;

            try {
                loadReport = getFeatureLoadReport();
            } catch (reportError) {
                handleError(reportError, {
                    context: "core-bootstrap:load-report",
                });
            }

            bootstrapCompletedAt = createTimestamp();
            bootstrapStatus = CORE_BOOTSTRAP_STATUS.READY;

            const result = createBootstrapResult({
                success: true,
                status: bootstrapStatus,
                startedAt: bootstrapStartedAt,
                completedAt: bootstrapCompletedAt,
                featureCount: features.length,
                features: features.map((feature) => ({
                    id: feature.id,
                    name: feature.name,
                    enabled: feature.enabled !== false,
                    category: feature.category ?? null,
                })),
                stages,
            });

            lastBootstrapResult = Object.freeze({
                ...result,
                loadReport,
            });

            return lastBootstrapResult;
        } catch (error) {
            lastBootstrapError = error;
            bootstrapCompletedAt = createTimestamp();
            bootstrapStatus = CORE_BOOTSTRAP_STATUS.ERROR;

            const handled = handleError(error, {
                context: "core-bootstrap",
            });

            recordStage(
                stages,
                "bootstrap",
                "failed",
                {
                    code: error?.code ?? null,
                }
            );

            const result = createBootstrapResult({
                success: false,
                status: bootstrapStatus,
                startedAt: bootstrapStartedAt,
                completedAt: bootstrapCompletedAt,
                featureCount: features.length,
                features: features.map((feature) => ({
                    id: feature.id,
                    name: feature.name,
                })),
                stages,
                error: {
                    code: error?.code ?? "CORE_BOOTSTRAP_FAILED",
                    message:
                        handled?.userMessage ??
                        "KANTOONG CORE gagal diinisialisasi.",
                },
            });

            lastBootstrapResult = result;

            return result;
        }
    };

    bootstrapPromise = run();

    try {
        return await bootstrapPromise;
    } finally {
        bootstrapPromise = null;
    }
}

/* =========================================================
   06. STATUS & DIAGNOSTICS
   ========================================================= */

/**
 * Mengambil status bootstrap.
 */
export function getCoreBootstrapStatus() {
    return Object.freeze({
        version: CORE_BOOTSTRAP_VERSION,
        status: bootstrapStatus,
        initialized:
            bootstrapStatus === CORE_BOOTSTRAP_STATUS.READY,
        startedAt: bootstrapStartedAt,
        completedAt: bootstrapCompletedAt,
        hasError: Boolean(lastBootstrapError),
    });
}

/**
 * Mengambil hasil bootstrap terakhir.
 */
export function getCoreBootstrapResult() {
    return lastBootstrapResult;
}

/**
 * Mengambil laporan fitur.
 */
export function getCoreFeatureSummary() {
    const features = getAllFeatures();

    return Object.freeze({
        total: features.length,
        enabled: features.filter(
            (feature) => feature.enabled !== false
        ).length,
        disabled: features.filter(
            (feature) => feature.enabled === false
        ).length,
        features: features.map((feature) =>
            Object.freeze({
                id: feature.id,
                name: feature.name,
                category: feature.category ?? null,
                enabled: feature.enabled !== false,
            })
        ),
    });
}

/**
 * Memeriksa apakah Core siap digunakan.
 */
export function isCoreReady() {
    return bootstrapStatus === CORE_BOOTSTRAP_STATUS.READY;
}

/* =========================================================
   07. RESET
   ========================================================= */

/**
 * Mereset status bootstrap untuk pengujian atau
 * siklus inisialisasi yang dikelola aplikasi.
 *
 * Fungsi ini TIDAK menghapus registry fitur, tidak
 * membatalkan operasi yang sedang berjalan, dan tidak
 * mereset router/controller.
 */
export function resetCoreBootstrapState() {
    if (bootstrapPromise) {
        throw createBootstrapError(
            "Tidak dapat mereset bootstrap saat proses masih berjalan.",
            "BOOTSTRAP_IN_PROGRESS"
        );
    }

    bootstrapStatus = CORE_BOOTSTRAP_STATUS.IDLE;
    lastBootstrapResult = null;
    lastBootstrapError = null;
    bootstrapStartedAt = null;
    bootstrapCompletedAt = null;

    return getCoreBootstrapStatus();
}

/* =========================================================
   08. PUBLIC API
   ========================================================= */

const CoreBootstrap = Object.freeze({
    bootstrapCore,
    getCoreBootstrapStatus,
    getCoreBootstrapResult,
    getCoreFeatureSummary,
    isCoreReady,
    resetCoreBootstrapState,
});

export default CoreBootstrap;

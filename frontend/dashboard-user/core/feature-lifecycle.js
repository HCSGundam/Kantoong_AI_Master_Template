
/**
 * KANTOONG CORE
 * Core Module: Feature Lifecycle
 * File: frontend/dashboard-user/core/feature-lifecycle.js
 *
 * Tanggung jawab:
 * 1. Mengelola lifecycle setiap fitur.
 * 2. Menjalankan hook inisialisasi dan pemasangan fitur.
 * 3. Mengatur aktivasi dan deaktivasi fitur.
 * 4. Mencegah lifecycle fitur yang sama berjalan bersamaan.
 * 5. Menangani error tanpa menghentikan lifecycle fitur lain.
 * 6. Menyediakan status dan laporan lifecycle.
 *
 * Lifecycle:
 * registered -> initializing -> mounted -> active
 * active -> inactive -> unmounted
 *
 * Catatan:
 * Modul ini tidak melakukan discovery, registrasi,
 * rendering kartu dashboard, atau pemeriksaan izin backend.
 */

const LIFECYCLE_VERSION = "1.0.0";

const VALID_STATES = Object.freeze([
    "registered",
    "initializing",
    "initialized",
    "mounting",
    "mounted",
    "activating",
    "active",
    "deactivating",
    "inactive",
    "unmounting",
    "unmounted",
    "error",
]);

const lifecycleRecords = new Map();
const operationQueues = new Map();

/**
 * Membuat error dengan format konsisten.
 */
function createLifecycleError(code, message, featureId, cause = null) {
    return {
        code,
        message,
        featureId,
        cause:
            cause instanceof Error
                ? cause.message
                : cause == null
                    ? null
                    : String(cause),
        timestamp: new Date().toISOString(),
    };
}

/**
 * Mengambil ID fitur yang valid.
 */
function normalizeFeatureId(featureOrId) {
    const id =
        typeof featureOrId === "string"
            ? featureOrId
            : featureOrId?.id;

    if (typeof id !== "string" || !id.trim()) {
        throw new TypeError(
            "[KANTOONG CORE] Lifecycle membutuhkan ID fitur yang valid."
        );
    }

    return id.trim().toLowerCase();
}

/**
 * Memastikan definisi fitur tersedia.
 */
function validateFeature(feature) {
    if (
        !feature ||
        typeof feature !== "object" ||
        Array.isArray(feature)
    ) {
        throw new TypeError(
            "[KANTOONG CORE] Definisi fitur harus berupa object."
        );
    }

    normalizeFeatureId(feature);

    return feature;
}

/**
 * Membuat record lifecycle jika belum tersedia.
 */
function ensureRecord(feature) {
    validateFeature(feature);

    const id = normalizeFeatureId(feature);
    let record = lifecycleRecords.get(id);

    if (!record) {
        record = {
            id,
            feature,
            state: "registered",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            initialized: false,
            mounted: false,
            active: false,
            context: null,
            element: null,
            error: null,
            history: [],
        };

        lifecycleRecords.set(id, record);
    } else {
        record.feature = feature;
    }

    return record;
}

/**
 * Memperbarui status dan menyimpan riwayat.
 */
function setState(record, state, details = null) {
    if (!VALID_STATES.includes(state)) {
        throw new Error(
            `[KANTOONG CORE] Status lifecycle tidak valid: ${state}`
        );
    }

    record.state = state;
    record.updatedAt = new Date().toISOString();

    record.history.push({
        state,
        timestamp: record.updatedAt,
        details,
    });

    // Batasi riwayat agar tidak terus membesar.
    if (record.history.length > 50) {
        record.history.shift();
    }
}

/**
 * Menjalankan hook lifecycle bila tersedia.
 */
async function runHook(feature, hookName, context) {
    const hook = feature.lifecycle?.[hookName];

    if (hook === undefined) {
        return undefined;
    }

    if (typeof hook !== "function") {
        throw new TypeError(
            `Hook lifecycle "${hookName}" harus berupa function.`
        );
    }

    return hook(context);
}

/**
 * Menjalankan operasi lifecycle secara berurutan
 * untuk setiap fitur.
 */
function runExclusive(featureId, operation) {
    const previous = operationQueues.get(featureId) ??
        Promise.resolve();

    const current = previous
        .catch(() => undefined)
        .then(operation);

    operationQueues.set(featureId, current);

    return current.finally(() => {
        if (operationQueues.get(featureId) === current) {
            operationQueues.delete(featureId);
        }
    });
}

/**
 * Mendaftarkan fitur ke pengelola lifecycle.
 */
export function registerFeatureLifecycle(feature) {
    try {
        const record = ensureRecord(feature);

        return {
            success: true,
            featureId: record.id,
            state: record.state,
        };
    } catch (error) {
        return {
            success: false,
            error: createLifecycleError(
                "LIFECYCLE_REGISTER_FAILED",
                error.message,
                feature?.id ?? null,
                error
            ),
        };
    }
}


/**
 * Inisialisasi internal tanpa membuat antrean baru.
 * Dapat dipanggil oleh operasi yang sudah berada di antrean fitur.
 */
async function initializeFeatureInternal(feature, context = {}) {
    const record = ensureRecord(feature);

    if (record.initialized) {
        return {
            success: true,
            featureId: record.id,
            state: record.state,
            skipped: true,
        };
    }

    try {
        setState(record, "initializing");

        await runHook(feature, "onRegister", context);
        await runHook(feature, "onLoad", context);

        record.context = context;
        record.initialized = true;
        record.error = null;

        setState(record, "initialized");

        return {
            success: true,
            featureId: record.id,
            state: record.state,
        };
    } catch (error) {
        record.error = createLifecycleError(
            "FEATURE_INITIALIZATION_FAILED",
            error.message,
            record.id,
            error,
        );

        setState(record, "error", record.error);

        try {
            await runHook(feature, "onError", {
                feature,
                error: record.error,
                phase: "initialize",
            });
        } catch (hookError) {
            console.error(
                "[KANTOONG CORE] Hook onError gagal:",
                hookError,
            );
        }

        return {
            success: false,
            featureId: record.id,
            state: record.state,
            error: record.error,
        };
    }
}

/**
 * Inisialisasi fitur satu kali.
 * Operasi publik tetap menggunakan antrean per fitur.
 */
export async function initializeFeature(feature, context = {}) {
    return runExclusive(normalizeFeatureId(feature), () =>
        initializeFeatureInternal(feature, context),
    );
}


/**
 * Memasang fitur ke elemen UI.
 *
 * Hook onMount menerima context yang berisi element.
 */
export async function mountFeature(
    feature,
    element,
    context = {}
) {
    return runExclusive(normalizeFeatureId(feature), async () => {
        const record = ensureRecord(feature);

        if (!element || typeof element !== "object") {
            return {
                success: false,
                featureId: record.id,
                error: createLifecycleError(
                    "INVALID_MOUNT_ELEMENT",
                    "Elemen mount wajib disediakan.",
                    record.id
                ),
            };
        }

        if (record.mounted && record.element === element) {
            return {
                success: true,
                featureId: record.id,
                state: record.state,
                skipped: true,
            };
        }

        if (record.active) {
            return {
                success: false,
                featureId: record.id,
                error: createLifecycleError(
                    "FEATURE_MUST_BE_DEACTIVATED",
                    "Nonaktifkan fitur sebelum memasang ulang elemen.",
                    record.id
                ),
            };
        }

        if (record.mounted) {
            const previousUnmount = await unmountFeatureInternal(
                record,
                context
            );

            if (!previousUnmount.success) {
                return previousUnmount;
            }
        }

        if (!record.initialized) {
            const initialized = await initializeFeatureInternal(
                feature,
                context,
            );

            if (!initialized.success) {
                return initialized;
            }
        }

        try {
            setState(record, "mounting");

            const mountContext = {
                ...context,
                feature,
                element,
                previousElement: record.element,
            };

            if (typeof feature.mount === "function") {
                await feature.mount(mountContext);
            }

            record.element = element;
            record.context = mountContext;
            record.mounted = true;
            record.error = null;

            await runHook(feature, "onMount", mountContext);

            setState(record, "mounted");

            return {
                success: true,
                featureId: record.id,
                state: record.state,
            };
        } catch (error) {
            record.error = createLifecycleError(
                "FEATURE_MOUNT_FAILED",
                error.message,
                record.id,
                error
            );

            setState(record, "error", record.error);

            return {
                success: false,
                featureId: record.id,
                state: record.state,
                error: record.error,
            };
        }
    });
}

/**
 * Mengaktifkan fitur yang sudah dipasang.
 */
export async function activateFeature(feature, context = {}) {
    return runExclusive(normalizeFeatureId(feature), async () => {
        const record = ensureRecord(feature);

        if (!record.mounted) {
            return {
                success: false,
                featureId: record.id,
                error: createLifecycleError(
                    "FEATURE_NOT_MOUNTED",
                    "Fitur harus dipasang sebelum diaktifkan.",
                    record.id
                ),
            };
        }

        if (record.active) {
            return {
                success: true,
                featureId: record.id,
                state: record.state,
                skipped: true,
            };
        }

        try {
            setState(record, "activating");

            await runHook(feature, "onActivate", {
                ...record.context,
                ...context,
                feature,
                element: record.element,
            });

            record.active = true;
            record.error = null;

            setState(record, "active");

            return {
                success: true,
                featureId: record.id,
                state: record.state,
            };
        } catch (error) {
            record.error = createLifecycleError(
                "FEATURE_ACTIVATION_FAILED",
                error.message,
                record.id,
                error
            );

            setState(record, "error", record.error);

            return {
                success: false,
                featureId: record.id,
                state: record.state,
                error: record.error,
            };
        }
    });
}

/**
 * Deaktivasi internal.
 * Dipakai oleh deactivateFeature dan unmountFeature.
 */
async function deactivateFeatureInternal(record, context = {}) {
    if (!record.active) {
        return {
            success: true,
            featureId: record.id,
            state: record.state,
            skipped: true,
        };
    }

    try {
        setState(record, "deactivating");

        await runHook(record.feature, "onDeactivate", {
            ...record.context,
            ...context,
            feature: record.feature,
            element: record.element,
        });

        record.active = false;

        setState(record, "inactive");

        return {
            success: true,
            featureId: record.id,
            state: record.state,
        };
    } catch (error) {
        record.error = createLifecycleError(
            "FEATURE_DEACTIVATION_FAILED",
            error.message,
            record.id,
            error
        );

        setState(record, "error", record.error);

        return {
            success: false,
            featureId: record.id,
            state: record.state,
            error: record.error,
        };
    }
}

/**
 * Menonaktifkan fitur tanpa melepas elemen UI.
 */
export async function deactivateFeature(feature, context = {}) {
    return runExclusive(normalizeFeatureId(feature), async () => {
        const record = ensureRecord(feature);

        return deactivateFeatureInternal(record, context);
    });
}

/**
 * Melepas fitur dari elemen UI.
 */
async function unmountFeatureInternal(record, context = {}) {
    if (record.active) {
        const deactivation = await deactivateFeatureInternal(
            record,
            context
        );

        if (!deactivation.success) {
            return deactivation;
        }
    }

    if (!record.mounted) {
        return {
            success: true,
            featureId: record.id,
            state: record.state,
            skipped: true,
        };
    }

    try {
        setState(record, "unmounting");

        const unmountContext = {
            ...record.context,
            ...context,
            feature: record.feature,
            element: record.element,
        };

        await runHook(
            record.feature,
            "onUnmount",
            unmountContext
        );

        if (typeof record.feature.unmount === "function") {
            await record.feature.unmount(unmountContext);
        }

        record.mounted = false;
        record.active = false;
        record.element = null;
        record.context = null;

        setState(record, "unmounted");

        return {
            success: true,
            featureId: record.id,
            state: record.state,
        };
    } catch (error) {
        record.error = createLifecycleError(
            "FEATURE_UNMOUNT_FAILED",
            error.message,
            record.id,
            error
        );

        setState(record, "error", record.error);

        return {
            success: false,
            featureId: record.id,
            state: record.state,
            error: record.error,
        };
    }
}

/**
 * Public API untuk melepas fitur.
 */
export async function unmountFeature(feature, context = {}) {
    return runExclusive(normalizeFeatureId(feature), async () => {
        const record = ensureRecord(feature);

        return unmountFeatureInternal(record, context);
    });
}

/**
 * Mengambil status lifecycle sebuah fitur.
 */
export function getFeatureLifecycleState(featureOrId) {
    let id;

    try {
        id = normalizeFeatureId(featureOrId);
    } catch {
        return null;
    }

    const record = lifecycleRecords.get(id);

    if (!record) {
        return null;
    }

    return {
        id: record.id,
        state: record.state,
        initialized: record.initialized,
        mounted: record.mounted,
        active: record.active,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        error: record.error,
    };
}

/**
 * Mengambil riwayat lifecycle fitur.
 */
export function getFeatureLifecycleHistory(featureOrId) {
    let id;

    try {
        id = normalizeFeatureId(featureOrId);
    } catch {
        return [];
    }

    const record = lifecycleRecords.get(id);

    return record
        ? record.history.map((entry) => ({ ...entry }))
        : [];
}

/**
 * Mengambil ringkasan seluruh lifecycle.
 */
export function getFeatureLifecycleSummary() {
    const records = Array.from(lifecycleRecords.values());

    return {
        version: LIFECYCLE_VERSION,
        total: records.length,
        initialized: records.filter((item) => item.initialized).length,
        mounted: records.filter((item) => item.mounted).length,
        active: records.filter((item) => item.active).length,
        errors: records.filter((item) => item.error !== null).length,
        features: records.map((item) => ({
            id: item.id,
            state: item.state,
        })),
    };
}

/**
 * Menghapus record lifecycle yang sudah tidak diperlukan.
 *
 * Fitur yang masih mounted atau active tidak boleh dihapus.
 */
export function unregisterFeatureLifecycle(featureOrId) {
    let id;

    try {
        id = normalizeFeatureId(featureOrId);
    } catch (error) {
        return {
            success: false,
            error: createLifecycleError(
                "INVALID_FEATURE_ID",
                error.message,
                null,
                error
            ),
        };
    }

    const record = lifecycleRecords.get(id);

    if (!record) {
        return {
            success: false,
            error: createLifecycleError(
                "FEATURE_LIFECYCLE_NOT_FOUND",
                "Record lifecycle tidak ditemukan.",
                id
            ),
        };
    }

    if (record.mounted || record.active) {
        return {
            success: false,
            error: createLifecycleError(
                "FEATURE_STILL_IN_USE",
                "Unmount fitur sebelum menghapus record lifecycle.",
                id
            ),
        };
    }

    lifecycleRecords.delete(id);

    return {
        success: true,
        featureId: id,
    };
}

/**
 * API default.
 */
const FeatureLifecycle = Object.freeze({
    version: LIFECYCLE_VERSION,
    registerFeatureLifecycle,
    initializeFeature,
    mountFeature,
    activateFeature,
    deactivateFeature,
    unmountFeature,
    getFeatureLifecycleState,
    getFeatureLifecycleHistory,
    getFeatureLifecycleSummary,
    unregisterFeatureLifecycle,
});

export default FeatureLifecycle;

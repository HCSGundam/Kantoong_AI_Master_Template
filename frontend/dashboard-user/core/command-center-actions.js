
/**
 * KANTOONG CORE
 * File: frontend/dashboard-user/core/command-center-actions.js
 *
 * Tanggung jawab:
 * - Menjalankan tindakan yang diminta melalui Command Center.
 * - Menghubungkan pemilihan fitur dengan feature-controller.
 * - Mendukung registrasi action handler tambahan.
 * - Memvalidasi action dan payload.
 * - Menangani error tanpa membocorkan detail internal ke UI.
 *
 * Batas keamanan:
 * - Semua tindakan harus melewati controller dan permission layer.
 * - Frontend bukan batas keamanan utama.
 * - Operasi sensitif tetap harus divalidasi backend.
 * - Jangan menerima fungsi atau kode JavaScript dari input pengguna.
 */

import {
    getFeature,
} from "./feature-registry.js";

import {
    openFeature,
    executeFeatureAction,
} from "./feature-controller.js";

import {
    handleError,
    createAppError,
    ERROR_TYPES,
} from "./error-handler.js";

const ACTION_NAME_PATTERN = /^[a-z][a-z0-9:_-]{0,99}$/i;
const MAX_PAYLOAD_DEPTH = 8;
const MAX_ARRAY_LENGTH = 100;
const MAX_OBJECT_KEYS = 100;
const MAX_STRING_LENGTH = 5000;

const actionHandlers = new Map();
const actionStats = new Map();

let actionSequence = 0;

/**
 * Normalisasi nama action.
 */
function normalizeActionName(name) {
    if (typeof name !== "string") {
        throw new TypeError(
            "[KANTOONG CommandCenter] Nama action harus berupa string."
        );
    }

    const normalized = name.trim();

    if (!ACTION_NAME_PATTERN.test(normalized)) {
        throw new Error(
            "[KANTOONG CommandCenter] Nama action tidak valid."
        );
    }

    return normalized;
}

/**
 * Memastikan ID fitur valid.
 */
function normalizeFeatureId(featureId) {
    if (typeof featureId !== "string") {
        throw new TypeError(
            "[KANTOONG CommandCenter] featureId harus berupa string."
        );
    }

    const normalized = featureId.trim();

    if (!normalized || normalized.length > 128) {
        throw new Error(
            "[KANTOONG CommandCenter] featureId tidak valid."
        );
    }

    return normalized;
}

/**
 * Validasi payload sederhana agar tidak menerima object berbahaya,
 * struktur bersarang berlebihan, atau nilai yang tidak serializable.
 *
 * Payload hanya boleh berisi:
 * - null
 * - string
 * - number finite
 * - boolean
 * - array
 * - plain object
 */
function validatePayloadValue(value, depth = 0, seen = new WeakSet()) {
    if (depth > MAX_PAYLOAD_DEPTH) {
        throw new Error(
            "[KANTOONG CommandCenter] Payload terlalu dalam."
        );
    }

    if (
        value === null ||
        typeof value === "boolean"
    ) {
        return;
    }

    if (typeof value === "string") {
        if (value.length > MAX_STRING_LENGTH) {
            throw new Error(
                "[KANTOONG CommandCenter] Teks payload terlalu panjang."
            );
        }

        return;
    }

    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            throw new Error(
                "[KANTOONG CommandCenter] Angka payload tidak valid."
            );
        }

        return;
    }

    if (typeof value !== "object") {
        throw new Error(
            "[KANTOONG CommandCenter] Tipe data payload tidak diizinkan."
        );
    }

    if (seen.has(value)) {
        throw new Error(
            "[KANTOONG CommandCenter] Payload tidak boleh memiliki circular reference."
        );
    }

    seen.add(value);

    if (Array.isArray(value)) {
        if (value.length > MAX_ARRAY_LENGTH) {
            throw new Error(
                "[KANTOONG CommandCenter] Array payload terlalu besar."
            );
        }

        for (const item of value) {
            validatePayloadValue(item, depth + 1, seen);
        }

        seen.delete(value);
        return;
    }

    const prototype = Object.getPrototypeOf(value);

    if (
        prototype !== Object.prototype &&
        prototype !== null
    ) {
        throw new Error(
            "[KANTOONG CommandCenter] Payload harus berupa plain object."
        );
    }

    const entries = Object.entries(value);

    if (entries.length > MAX_OBJECT_KEYS) {
        throw new Error(
            "[KANTOONG CommandCenter] Object payload memiliki terlalu banyak properti."
        );
    }

    for (const [key, child] of entries) {
        if (
            key === "__proto__" ||
            key === "prototype" ||
            key === "constructor"
        ) {
            throw new Error(
                "[KANTOONG CommandCenter] Properti payload tidak diizinkan."
            );
        }

        validatePayloadValue(child, depth + 1, seen);
    }

    seen.delete(value);
}

/**
 * Membuat salinan payload setelah validasi.
 */
function normalizePayload(payload = {}) {
    validatePayloadValue(payload);

    if (
        payload === null ||
        typeof payload !== "object" ||
        Array.isArray(payload)
    ) {
        throw new TypeError(
            "[KANTOONG CommandCenter] Payload harus berupa object."
        );
    }

    return structuredClone(payload);
}

/**
 * Membuat statistik action jika belum tersedia.
 */
function ensureActionStats(actionName) {
    if (!actionStats.has(actionName)) {
        actionStats.set(actionName, {
            attempts: 0,
            successes: 0,
            failures: 0,
            lastExecutedAt: null,
        });
    }

    return actionStats.get(actionName);
}

/**
 * Membuat hasil eksekusi standar.
 */
function createActionResult({
    success,
    action,
    actionId,
    data = null,
    error = null,
}) {
    return Object.freeze({
        success,
        action,
        actionId,
        data,
        error,
        timestamp: new Date().toISOString(),
    });
}

/**
 * Menjalankan action handler yang sudah terdaftar.
 */
export function registerCommandAction(
    actionName,
    handler,
    options = {}
) {
    const name = normalizeActionName(actionName);

    if (typeof handler !== "function") {
        throw new TypeError(
            "[KANTOONG CommandCenter] Handler harus berupa function."
        );
    }

    if (actionHandlers.has(name) && options.replace !== true) {
        throw new Error(
            `[KANTOONG CommandCenter] Action "${name}" sudah terdaftar.`
        );
    }

    actionHandlers.set(name, Object.freeze({
        handler,
        description:
            typeof options.description === "string"
                ? options.description.slice(0, 300)
                : "",
    }));

    ensureActionStats(name);

    return () => {
        const current = actionHandlers.get(name);

        if (current?.handler !== handler) {
            return false;
        }

        actionHandlers.delete(name);
        return true;
    };
}

/**
 * Menghapus action handler.
 */
export function unregisterCommandAction(actionName) {
    const name = normalizeActionName(actionName);

    return actionHandlers.delete(name);
}

/**
 * Memeriksa apakah action telah terdaftar.
 */
export function hasCommandAction(actionName) {
    const name = normalizeActionName(actionName);

    return actionHandlers.has(name);
}

/**
 * Mengambil daftar action yang tersedia.
 * Fungsi handler tidak ikut diekspos.
 */
export function getRegisteredCommandActions() {
    return [...actionHandlers.entries()].map(([name, entry]) =>
        Object.freeze({
            name,
            description: entry.description,
        })
    );
}

/**
 * Menjalankan custom action yang sudah terdaftar.
 *
 * Handler menerima:
 * - payload
 * - context
 * - metadata eksekusi
 *
 * Jangan menerima kode executable dari payload.
 */
async function executeRegisteredAction(
    actionName,
    payload,
    context,
    metadata
) {
    const registration = actionHandlers.get(actionName);

    if (!registration) {
        throw createAppError({
            type: ERROR_TYPES.NOT_FOUND,
            message: `Command action "${actionName}" tidak ditemukan.`,
            userMessage: "Tindakan tersebut belum tersedia.",
            code: "COMMAND_ACTION_NOT_FOUND",
        });
    }

    return registration.handler(
        payload,
        context,
        metadata
    );
}

/**
 * Membuka fitur berdasarkan ID.
 */
export async function openCommandFeature(
    featureId,
    options = {}
) {
    const id = normalizeFeatureId(featureId);
    const actionId = `CCA-${Date.now()}-${++actionSequence}`;

    try {
        const feature = getFeature(id);

        if (!feature) {
            throw createAppError({
                type: ERROR_TYPES.NOT_FOUND,
                message: `Feature "${id}" tidak ditemukan.`,
                userMessage: "Fitur yang kamu pilih tidak ditemukan.",
                code: "FEATURE_NOT_FOUND",
            });
        }

        const result = await openFeature(id, {
            source: "command-center",
            ...options,
        });

        return createActionResult({
            success: true,
            action: "feature:open",
            actionId,
            data: result ?? {
                featureId: id,
                name: feature.name,
            },
        });
    } catch (error) {
        const handled = handleError(error, {
            context: "command-center:open-feature",
            logToConsole: true,
        });

        return createActionResult({
            success: false,
            action: "feature:open",
            actionId,
            error: {
                id: handled.id,
                type: handled.type,
                message: handled.userMessage,
            },
        });
    }
}

/**
 * Menjalankan action milik suatu fitur melalui controller.
 */
export async function executeCommandFeatureAction(
    featureId,
    actionName,
    payload = {},
    options = {}
) {
    const id = normalizeFeatureId(featureId);
    const action = normalizeActionName(actionName);
    const normalizedPayload = normalizePayload(payload);

    const actionId = `CCA-${Date.now()}-${++actionSequence}`;
    const stats = ensureActionStats(`feature:${id}:${action}`);

    stats.attempts += 1;
    stats.lastExecutedAt = new Date().toISOString();

    try {
        const feature = getFeature(id);

        if (!feature) {
            throw createAppError({
                type: ERROR_TYPES.NOT_FOUND,
                message: `Feature "${id}" tidak ditemukan.`,
                userMessage: "Fitur yang dipilih tidak ditemukan.",
                code: "FEATURE_NOT_FOUND",
            });
        }

        const result = await executeFeatureAction(
            id,
            action,
            normalizedPayload,
            options.context ?? options
        );

        stats.successes += 1;

        return createActionResult({
            success: true,
            action: `feature:${id}:${action}`,
            actionId,
            data: result ?? null,
        });
    } catch (error) {
        stats.failures += 1;

        const handled = handleError(error, {
            context: `command-center:feature:${id}`,
        });

        return createActionResult({
            success: false,
            action: `feature:${id}:${action}`,
            actionId,
            error: {
                id: handled.id,
                type: handled.type,
                message: handled.userMessage,
            },
        });
    }
}

/**
 * Menjalankan custom command action.
 */
export async function executeCommandAction(
    actionName,
    payload = {},
    options = {}
) {
    const name = normalizeActionName(actionName);
    const normalizedPayload = normalizePayload(payload);

    const actionId = `CCA-${Date.now()}-${++actionSequence}`;
    const stats = ensureActionStats(name);

    stats.attempts += 1;
    stats.lastExecutedAt = new Date().toISOString();

    try {
        const context = options.context ?? {};

        const result = await executeRegisteredAction(
            name,
            normalizedPayload,
            context,
            Object.freeze({
                actionId,
                actionName: name,
                source: options.source ?? "command-center",
                timestamp: new Date().toISOString(),
            })
        );

        stats.successes += 1;

        return createActionResult({
            success: true,
            action: name,
            actionId,
            data: result ?? null,
        });
    } catch (error) {
        stats.failures += 1;

        const handled = handleError(error, {
            context: `command-center:action:${name}`,
        });

        return createActionResult({
            success: false,
            action: name,
            actionId,
            error: {
                id: handled.id,
                type: handled.type,
                message: handled.userMessage,
            },
        });
    }
}

/**
 * Menjalankan intent terstruktur dari Command Center.
 *
 * Intent yang didukung:
 * - { type: "feature:open", featureId: "profile" }
 * - { type: "feature:action", featureId: "profile",
 *     action: "update", payload: {} }
 * - { type: "command:action", action: "nama-action",
 *     payload: {} }
 *
 * Intent hanya boleh berupa data terstruktur.
 * Jangan mengubah teks pengguna langsung menjadi kode executable.
 */
export async function dispatchCommandIntent(
    intent,
    options = {}
) {
    if (
        !intent ||
        typeof intent !== "object" ||
        Array.isArray(intent)
    ) {
        return createActionResult({
            success: false,
            action: "intent:dispatch",
            actionId: `CCA-${Date.now()}-${++actionSequence}`,
            error: {
                type: ERROR_TYPES.VALIDATION,
                message: "Perintah tidak valid.",
            },
        });
    }

    switch (intent.type) {
        case "feature:open":
            return openCommandFeature(
                intent.featureId,
                options
            );

        case "feature:action":
            return executeCommandFeatureAction(
                intent.featureId,
                intent.action,
                intent.payload ?? {},
                options
            );

        case "command:action":
            return executeCommandAction(
                intent.action,
                intent.payload ?? {},
                options
            );

        default:
            return createActionResult({
                success: false,
                action: "intent:dispatch",
                actionId: `CCA-${Date.now()}-${++actionSequence}`,
                error: {
                    type: ERROR_TYPES.VALIDATION,
                    message: "Jenis perintah belum didukung.",
                },
            });
    }
}

/**
 * Mengambil statistik eksekusi action.
 */
export function getCommandActionStats(actionName = null) {
    if (actionName !== null) {
        const name = normalizeActionName(actionName);
        const stats = actionStats.get(name);

        return stats
            ? Object.freeze({
                action: name,
                ...stats,
            })
            : null;
    }

    return [...actionStats.entries()].map(([name, stats]) =>
        Object.freeze({
            action: name,
            ...stats,
        })
    );
}

/**
 * Menghapus statistik action.
 * Tidak mengubah handler yang terdaftar.
 */
export function clearCommandActionStats() {
    const count = actionStats.size;

    actionStats.clear();

    return count;
}

/**
 * API utama.
 */
const CommandCenterActions = Object.freeze({
    registerCommandAction,
    unregisterCommandAction,
    hasCommandAction,
    getRegisteredCommandActions,
    openCommandFeature,
    executeCommandFeatureAction,
    executeCommandAction,
    dispatchCommandIntent,
    getCommandActionStats,
    clearCommandActionStats,
});

export default CommandCenterActions;

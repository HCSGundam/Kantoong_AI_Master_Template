
/**
 * KANTOONG CORE
 * File: frontend/dashboard-user/core/command-center.js
 *
 * Tanggung jawab:
 * - Menjadi pintu utama Command Center.
 * - Menggabungkan pencarian, saran, dan eksekusi tindakan.
 * - Menyediakan API terpadu untuk UI dashboard.
 * - Menyimpan state sesi Command Center.
 * - Menyediakan event subscription untuk integrasi UI.
 *
 * Arsitektur:
 * UI
 *  -> Command Center
 *      -> Search
 *      -> Suggestions
 *      -> Actions
 *          -> Feature Controller
 *
 * Catatan keamanan:
 * - Teks pengguna tidak pernah dieksekusi sebagai kode.
 * - Hasil pencarian bukan bukti bahwa pengguna memiliki izin.
 * - Pemeriksaan izin dan validasi backend tetap wajib.
 */

import {
    searchFeatures,
    findBestFeatureMatch,
} from "./command-center-search.js";

import {
    getFeatureSuggestions,
    getSearchSuggestions,
    getDiscoverSuggestions,
} from "./command-center-suggestions.js";

import {
    dispatchCommandIntent,
    openCommandFeature,
    executeCommandFeatureAction,
    executeCommandAction,
    getRegisteredCommandActions,
} from "./command-center-actions.js";

import {
    getAllFeatures,
} from "./feature-registry.js";

import {
    handleError,
} from "./error-handler.js";

/* =========================================================
   01. CONSTANTS
   ========================================================= */

export const COMMAND_CENTER_VERSION = "1.0.0";

export const COMMAND_CENTER_STATUS = Object.freeze({
    IDLE: "idle",
    SEARCHING: "searching",
    SUGGESTING: "suggesting",
    EXECUTING: "executing",
    READY: "ready",
    ERROR: "error",
});

const MAX_QUERY_LENGTH = 500;
const MAX_RECENT_QUERIES = 20;

const listeners = new Set();

let operationSequence = 0;

let commandCenterState = {
    initialized: false,
    status: COMMAND_CENTER_STATUS.IDLE,
    query: "",
    results: [],
    suggestions: [],
    recentQueries: [],
    lastAction: null,
    lastError: null,
    updatedAt: null,
};

/* =========================================================
   02. INTERNAL UTILITIES
   ========================================================= */

/**
 * Membuat salinan state agar pemanggil tidak dapat
 * mengubah state internal secara langsung.
 */
function cloneData(value) {
    if (typeof structuredClone === "function") {
        return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
}

/**
 * Memvalidasi teks pencarian.
 */
function normalizeQuery(query) {
    if (query === null || query === undefined) {
        return "";
    }

    if (typeof query !== "string") {
        throw new TypeError(
            "[KANTOONG CommandCenter] Query harus berupa string."
        );
    }

    return query
        .trim()
        .slice(0, MAX_QUERY_LENGTH);
}

/**
 * Membuat ID operasi.
 */
function createOperationId() {
    operationSequence += 1;

    return `CC-${Date.now()}-${operationSequence}`;
}

/**
 * Mengirim state terbaru kepada subscriber.
 *
 * Error dari subscriber tidak boleh menghentikan
 * subscriber lainnya.
 */
function notifyListeners(eventName, payload = {}) {
    const event = Object.freeze({
        event: eventName,
        payload: cloneData(payload),
        state: getCommandCenterState(),
        timestamp: new Date().toISOString(),
    });

    for (const listener of [...listeners]) {
        try {
            listener(event);
        } catch (error) {
            handleError(error, {
                context: "command-center:subscriber",
            });
        }
    }
}

/**
 * Memperbarui state internal.
 */
function updateState(patch, eventName = "state:updated") {
    commandCenterState = {
        ...commandCenterState,
        ...patch,
        updatedAt: new Date().toISOString(),
    };

    notifyListeners(eventName, patch);

    return getCommandCenterState();
}

/**
 * Menyimpan query yang benar-benar digunakan.
 */
function rememberQuery(query) {
    if (!query) {
        return;
    }

    const recentQueries = [
        query,
        ...commandCenterState.recentQueries.filter(
            (item) => item !== query
        ),
    ].slice(0, MAX_RECENT_QUERIES);

    commandCenterState = {
        ...commandCenterState,
        recentQueries,
    };
}

/**
 * Menangani error dan memperbarui state.
 */
function reportCommandError(error, context) {
    const handled = handleError(error, {
        context: `command-center:${context}`,
    });

    const safeError = {
        type: handled.type ?? "UNKNOWN",
        message:
            handled.userMessage ??
            "Terjadi kendala. Silakan coba lagi.",
    };

    updateState(
        {
            status: COMMAND_CENTER_STATUS.ERROR,
            lastError: safeError,
        },
        "command:error"
    );

    return safeError;
}

/**
 * Memeriksa apakah hasil pencarian berupa array.
 * Bila format modul pencarian berubah, UI tetap menerima
 * struktur yang konsisten.
 */
function normalizeArrayResult(result) {
    if (Array.isArray(result)) {
        return result;
    }

    if (Array.isArray(result?.results)) {
        return result.results;
    }

    if (Array.isArray(result?.features)) {
        return result.features;
    }

    return [];
}

/* =========================================================
   03. INITIALIZATION
   ========================================================= */

/**
 * Menginisialisasi Command Center.
 *
 * Tidak menjalankan fitur secara otomatis.
 */
export function initializeCommandCenter(options = {}) {
    const features = getAllFeatures();

    commandCenterState = {
        ...commandCenterState,
        initialized: true,
        status: COMMAND_CENTER_STATUS.READY,
        lastError: null,
        updatedAt: new Date().toISOString(),
    };

    notifyListeners("command-center:initialized", {
        featureCount: features.length,
        source: options.source ?? "dashboard-user",
    });

    return Object.freeze({
        success: true,
        version: COMMAND_CENTER_VERSION,
        featureCount: features.length,
        registeredActions: getRegisteredCommandActions().length,
        state: getCommandCenterState(),
    });
}

/**
 * Memeriksa status inisialisasi.
 */
export function isCommandCenterInitialized() {
    return commandCenterState.initialized;
}

/* =========================================================
   04. FEATURE SEARCH
   ========================================================= */

/**
 * Mencari fitur.
 *
 * Fungsi ini hanya menemukan fitur yang relevan.
 * Fungsi ini tidak membuka fitur dan tidak memberikan
 * izin akses.
 */
export function searchCommandCenter(query, options = {}) {
    const normalizedQuery = normalizeQuery(query);
    const operationId = createOperationId();

    if (!normalizedQuery) {
        updateState(
            {
                status: COMMAND_CENTER_STATUS.READY,
                query: "",
                results: [],
                lastError: null,
            },
            "search:cleared"
        );

        return {
            success: true,
            operationId,
            query: "",
            results: [],
        };
    }

    updateState(
        {
            status: COMMAND_CENTER_STATUS.SEARCHING,
            query: normalizedQuery,
            lastError: null,
        },
        "search:started"
    );

    try {
        const rawResults = searchFeatures(
            normalizedQuery,
            options
        );

        const results = normalizeArrayResult(rawResults);

        rememberQuery(normalizedQuery);

        updateState(
            {
                status: COMMAND_CENTER_STATUS.READY,
                query: normalizedQuery,
                results,
                lastError: null,
            },
            "search:completed"
        );

        return {
            success: true,
            operationId,
            query: normalizedQuery,
            results,
        };
    } catch (error) {
        const safeError = reportCommandError(
            error,
            "search"
        );

        return {
            success: false,
            operationId,
            query: normalizedQuery,
            results: [],
            error: safeError,
        };
    }
}

/**
 * Mendapatkan satu kandidat fitur terbaik.
 *
 * Kandidat ini hanya rekomendasi. Jangan langsung
 * menjalankan tindakan sensitif berdasarkan hasil ini.
 */
export function findCommandCenterMatch(query, options = {}) {
    const normalizedQuery = normalizeQuery(query);

    if (!normalizedQuery) {
        return null;
    }

    try {
        return findBestFeatureMatch(
            normalizedQuery,
            options
        );
    } catch (error) {
        reportCommandError(error, "find-match");
        return null;
    }
}

/* =========================================================
   05. FEATURE SUGGESTIONS
   ========================================================= */

/**
 * Mendapatkan saran berdasarkan konteks dashboard.
 */
export function suggestCommandCenter(options = {}) {
    updateState(
        {
            status: COMMAND_CENTER_STATUS.SUGGESTING,
            lastError: null,
        },
        "suggestions:started"
    );

    try {
        const suggestions = getFeatureSuggestions(options);
        const normalizedSuggestions =
            normalizeArrayResult(suggestions);

        updateState(
            {
                status: COMMAND_CENTER_STATUS.READY,
                suggestions: normalizedSuggestions,
            },
            "suggestions:completed"
        );

        return {
            success: true,
            suggestions: normalizedSuggestions,
        };
    } catch (error) {
        const safeError = reportCommandError(
            error,
            "suggestions"
        );

        return {
            success: false,
            suggestions: [],
            error: safeError,
        };
    }
}

/**
 * Mendapatkan saran ketika pengguna sedang mengetik.
 */
export function suggestCommandCenterSearch(
    query,
    options = {}
) {
    const normalizedQuery = normalizeQuery(query);

    if (!normalizedQuery) {
        return {
            success: true,
            suggestions: [],
        };
    }

    try {
        const suggestions = getSearchSuggestions(
            normalizedQuery,
            options
        );

        return {
            success: true,
            suggestions: normalizeArrayResult(suggestions),
        };
    } catch (error) {
        const safeError = reportCommandError(
            error,
            "search-suggestions"
        );

        return {
            success: false,
            suggestions: [],
            error: safeError,
        };
    }
}

/**
 * Menemukan fitur lain untuk dijelajahi pengguna.
 */
export function discoverCommandCenterFeatures(options = {}) {
    try {
        const suggestions = getDiscoverSuggestions(options);

        return {
            success: true,
            suggestions: normalizeArrayResult(suggestions),
        };
    } catch (error) {
        const safeError = reportCommandError(
            error,
            "discover"
        );

        return {
            success: false,
            suggestions: [],
            error: safeError,
        };
    }
}

/* =========================================================
   06. ACTION DISPATCH
   ========================================================= */

/**
 * Mengirim intent terstruktur ke action dispatcher.
 */
export async function executeCommandCenterIntent(
    intent,
    options = {}
) {
    const operationId = createOperationId();

    updateState(
        {
            status: COMMAND_CENTER_STATUS.EXECUTING,
            lastError: null,
        },
        "action:started"
    );

    try {
        const result = await dispatchCommandIntent(
            intent,
            options
        );

        const success = result?.success === true;

        updateState(
            {
                status: success
                    ? COMMAND_CENTER_STATUS.READY
                    : COMMAND_CENTER_STATUS.ERROR,
                lastAction: {
                    operationId,
                    type: intent?.type ?? "unknown",
                    success,
                    timestamp: new Date().toISOString(),
                },
                lastError: success
                    ? null
                    : result?.error ?? {
                        message: "Tindakan tidak berhasil.",
                    },
            },
            success
                ? "action:completed"
                : "action:failed"
        );

        return {
            ...result,
            operationId,
        };
    } catch (error) {
        const safeError = reportCommandError(
            error,
            "execute-intent"
        );

        return {
            success: false,
            operationId,
            error: safeError,
        };
    }
}

/**
 * Shortcut untuk membuka fitur.
 */
export async function openCommandCenterFeature(
    featureId,
    options = {}
) {
    const operationId = createOperationId();

    updateState(
        {
            status: COMMAND_CENTER_STATUS.EXECUTING,
            lastError: null,
        },
        "feature:open-started"
    );

    try {
        const result = await openCommandFeature(
            featureId,
            options
        );

        updateState(
            {
                status: result.success
                    ? COMMAND_CENTER_STATUS.READY
                    : COMMAND_CENTER_STATUS.ERROR,
                lastAction: {
                    operationId,
                    type: "feature:open",
                    featureId,
                    success: result.success,
                    timestamp: new Date().toISOString(),
                },
                lastError: result.success
                    ? null
                    : result.error,
            },
            result.success
                ? "feature:open-completed"
                : "feature:open-failed"
        );

        return {
            ...result,
            operationId,
        };
    } catch (error) {
        const safeError = reportCommandError(
            error,
            "open-feature"
        );

        return {
            success: false,
            operationId,
            error: safeError,
        };
    }
}

/**
 * Shortcut untuk menjalankan action pada fitur.
 */
export async function runCommandCenterFeatureAction(
    featureId,
    actionName,
    payload = {},
    options = {}
) {
    return executeCommandCenterIntent(
        {
            type: "feature:action",
            featureId,
            action: actionName,
            payload,
        },
        options
    );
}

/**
 * Shortcut untuk custom action yang terdaftar.
 */
export async function runRegisteredCommandCenterAction(
    actionName,
    payload = {},
    options = {}
) {
    return executeCommandAction(
        actionName,
        payload,
        options
    );
}

/* =========================================================
   07. UNIFIED INPUT HANDLER
   ========================================================= */

/**
 * Memproses input Command Center.
 *
 * Versi ini hanya melakukan pencarian.
 * AI Companion nantinya dapat menganalisis maksud pengguna,
 * lalu mengembalikan intent terstruktur yang tervalidasi.
 *
 * Teks biasa tidak otomatis mengeksekusi tindakan.
 */
export function handleCommandCenterInput(
    input,
    options = {}
) {
    const query = normalizeQuery(input);

    if (!query) {
        return {
            success: true,
            type: "empty",
            query: "",
            results: [],
            suggestions: [],
        };
    }

    const searchResult = searchCommandCenter(
        query,
        options
    );

    if (!searchResult.success) {
        return {
            success: false,
            type: "search",
            query,
            results: [],
            suggestions: [],
            error: searchResult.error,
        };
    }

    let suggestions = [];

    try {
        suggestions = normalizeArrayResult(
            getSearchSuggestions(query, options)
        );
    } catch (error) {
        // Pencarian tetap dapat digunakan jika saran gagal.
        handleError(error, {
            context: "command-center:input-suggestions",
        });
    }

    return {
        success: true,
        type: "search",
        query,
        results: searchResult.results,
        suggestions,
    };
}

/* =========================================================
   08. STATE & EVENTS
   ========================================================= */

/**
 * Mengambil snapshot state.
 */
export function getCommandCenterState() {
    return cloneData(commandCenterState);
}

/**
 * Berlangganan perubahan Command Center.
 *
 * Callback menerima object:
 * { event, payload, state, timestamp }
 */
export function subscribeCommandCenter(listener) {
    if (typeof listener !== "function") {
        throw new TypeError(
            "[KANTOONG CommandCenter] Listener harus berupa function."
        );
    }

    listeners.add(listener);

    return () => listeners.delete(listener);
}

/**
 * Menghapus seluruh subscriber.
 */
export function clearCommandCenterSubscribers() {
    const count = listeners.size;

    listeners.clear();

    return count;
}

/**
 * Menghapus query dari riwayat sesi.
 *
 * Riwayat ini hanya berada di memori.
 * Penyimpanan permanen harus ditangani oleh modul storage
 * atau backend dengan kebijakan privasi yang sesuai.
 */
export function clearCommandCenterRecentQueries() {
    updateState(
        {
            recentQueries: [],
        },
        "history:cleared"
    );
}

/**
 * Reset state Command Center.
 * Tidak menghapus registry fitur atau action handler.
 */
export function resetCommandCenterState() {
    commandCenterState = {
        initialized: false,
        status: COMMAND_CENTER_STATUS.IDLE,
        query: "",
        results: [],
        suggestions: [],
        recentQueries: [],
        lastAction: null,
        lastError: null,
        updatedAt: new Date().toISOString(),
    };

    notifyListeners("command-center:reset");

    return getCommandCenterState();
}

/* =========================================================
   09. PUBLIC API
   ========================================================= */

const CommandCenter = Object.freeze({
    initializeCommandCenter,
    isCommandCenterInitialized,

    searchCommandCenter,
    findCommandCenterMatch,

    suggestCommandCenter,
    suggestCommandCenterSearch,
    discoverCommandCenterFeatures,

    executeCommandCenterIntent,
    openCommandCenterFeature,
    runCommandCenterFeatureAction,
    runRegisteredCommandCenterAction,

    handleCommandCenterInput,

    getCommandCenterState,
    subscribeCommandCenter,
    clearCommandCenterSubscribers,
    clearCommandCenterRecentQueries,
    resetCommandCenterState,
});

export default CommandCenter;

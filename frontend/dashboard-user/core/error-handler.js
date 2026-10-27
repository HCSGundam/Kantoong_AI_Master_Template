
/**
 * KANTOONG CORE
 * File: frontend/dashboard-user/core/error-handler.js
 *
 * Tanggung jawab:
 * - Menstandarkan penanganan error frontend.
 * - Menyediakan pesan error yang aman untuk pengguna.
 * - Menyediakan error log untuk debugging.
 * - Mendukung callback pelaporan error.
 * - Mengisolasi kegagalan callback pelaporan.
 *
 * Batas keamanan:
 * - Modul ini bukan pengganti audit log backend.
 * - Jangan mengirim token, password, atau data sensitif ke logger.
 * - Error frontend tidak boleh menjadi sumber otorisasi.
 */

const ERROR_LOG_LIMIT = 100;

const errorLog = [];
const errorReporters = new Set();

let errorSequence = 0;

const ERROR_TYPES = Object.freeze({
    UNKNOWN: "UNKNOWN",
    VALIDATION: "VALIDATION",
    AUTHENTICATION: "AUTHENTICATION",
    AUTHORIZATION: "AUTHORIZATION",
    NOT_FOUND: "NOT_FOUND",
    NETWORK: "NETWORK",
    TIMEOUT: "TIMEOUT",
    CONFLICT: "CONFLICT",
    RATE_LIMIT: "RATE_LIMIT",
    STORAGE: "STORAGE",
    FEATURE: "FEATURE",
    INTERNAL: "INTERNAL",
});

const DEFAULT_MESSAGES = Object.freeze({
    [ERROR_TYPES.UNKNOWN]:
        "Terjadi kendala. Silakan coba kembali.",
    [ERROR_TYPES.VALIDATION]:
        "Data yang dimasukkan belum sesuai. Periksa kembali.",
    [ERROR_TYPES.AUTHENTICATION]:
        "Silakan masuk kembali untuk melanjutkan.",
    [ERROR_TYPES.AUTHORIZATION]:
        "Kamu tidak memiliki izin untuk melakukan tindakan ini.",
    [ERROR_TYPES.NOT_FOUND]:
        "Data yang diminta tidak ditemukan.",
    [ERROR_TYPES.NETWORK]:
        "Koneksi bermasalah. Periksa internet dan coba kembali.",
    [ERROR_TYPES.TIMEOUT]:
        "Permintaan memerlukan waktu terlalu lama. Coba kembali.",
    [ERROR_TYPES.CONFLICT]:
        "Data berubah atau bertentangan dengan kondisi terbaru.",
    [ERROR_TYPES.RATE_LIMIT]:
        "Terlalu banyak permintaan. Tunggu sebentar lalu coba kembali.",
    [ERROR_TYPES.STORAGE]:
        "Pengaturan belum dapat disimpan. Coba kembali.",
    [ERROR_TYPES.FEATURE]:
        "Fitur mengalami kendala dan belum dapat digunakan.",
    [ERROR_TYPES.INTERNAL]:
        "Terjadi kesalahan sistem. Silakan coba kembali.",
});

/**
 * Membuat ID error untuk pelacakan internal.
 */
function createErrorId() {
    errorSequence += 1;

    return `KC-ERR-${Date.now()}-${errorSequence}`;
}

/**
 * Memastikan nilai merupakan tipe error yang dikenal.
 */
function normalizeErrorType(type) {
    if (
        typeof type === "string" &&
        Object.values(ERROR_TYPES).includes(type.toUpperCase())
    ) {
        return type.toUpperCase();
    }

    return ERROR_TYPES.UNKNOWN;
}

/**
 * Membaca pesan teknis dari error.
 *
 * Pesan ini hanya untuk debugging internal.
 * Jangan langsung menampilkannya ke pengguna.
 */
function getTechnicalMessage(error) {
    if (error instanceof Error) {
        return error.message || "Unspecified error";
    }

    if (typeof error === "string") {
        return error;
    }

    return "Unknown error";
}

/**
 * Membuat error standar KANTOONG.
 */
export function createAppError({
    type = ERROR_TYPES.UNKNOWN,
    message = "",
    userMessage = "",
    code = "",
    cause = null,
    metadata = {},
} = {}) {
    const normalizedType = normalizeErrorType(type);

    const error = new Error(
        message || DEFAULT_MESSAGES[normalizedType]
    );

    error.name = "KantoongAppError";
    error.type = normalizedType;
    error.code = typeof code === "string" ? code : "";
    error.userMessage =
        typeof userMessage === "string" && userMessage.trim()
            ? userMessage.trim()
            : DEFAULT_MESSAGES[normalizedType];

    error.cause = cause instanceof Error ? cause : undefined;

    // Metadata hanya untuk konteks non-sensitif.
    error.metadata =
        metadata &&
        typeof metadata === "object" &&
        !Array.isArray(metadata)
            ? { ...metadata }
            : {};

    return error;
}

/**
 * Menyusun objek log yang tidak menyimpan payload request.
 */
function buildErrorRecord(error, options = {}) {
    const normalizedError =
        error instanceof Error ? error : new Error(String(error));

    const type = normalizeErrorType(
        normalizedError.type || options.type
    );

    const context =
        typeof options.context === "string"
            ? options.context.slice(0, 120)
            : "application";

    return Object.freeze({
        id: createErrorId(),
        timestamp: new Date().toISOString(),
        type,
        code:
            typeof normalizedError.code === "string"
                ? normalizedError.code.slice(0, 80)
                : "",
        context,
        message: getTechnicalMessage(normalizedError).slice(0, 500),
        userMessage:
            typeof normalizedError.userMessage === "string"
                ? normalizedError.userMessage
                : DEFAULT_MESSAGES[type],
    });
}

/**
 * Menyimpan error ke log memori.
 *
 * Catatan:
 * Log ini hilang ketika halaman dimuat ulang.
 * Log produksi perlu dikirim ke backend yang aman.
 */
function saveErrorRecord(record) {
    errorLog.push(record);

    if (errorLog.length > ERROR_LOG_LIMIT) {
        errorLog.shift();
    }
}

/**
 * Melaporkan error kepada semua reporter yang terdaftar.
 * Kegagalan reporter tidak boleh menimbulkan error berulang.
 */
function notifyReporters(record) {
    for (const reporter of errorReporters) {
        try {
            const result = reporter(record);

            if (result && typeof result.catch === "function") {
                result.catch((reportError) => {
                    console.error(
                        "[KANTOONG ErrorHandler] Reporter gagal.",
                        reportError
                    );
                });
            }
        } catch (reportError) {
            console.error(
                "[KANTOONG ErrorHandler] Reporter gagal.",
                reportError
            );
        }
    }
}

/**
 * Menangani error.
 *
 * Mengembalikan objek ringkasan error.
 * Secara default, tidak menampilkan detail teknis kepada pengguna.
 */
export function handleError(error, options = {}) {
    const normalizedError =
        error instanceof Error
            ? error
            : new Error(
                  typeof error === "string"
                      ? error
                      : "Unknown error"
              );

    const record = buildErrorRecord(normalizedError, options);

    saveErrorRecord(record);

    if (options.logToConsole !== false) {
        console.error(
            `[KANTOONG Error] ${record.id} (${record.type})`,
            normalizedError
        );
    }

    notifyReporters(record);

    const customUserMessage =
        typeof options.userMessage === "string" &&
        options.userMessage.trim()
            ? options.userMessage.trim()
            : "";

    return Object.freeze({
        id: record.id,
        type: record.type,
        code: record.code,
        context: record.context,
        userMessage:
            customUserMessage ||
            (typeof normalizedError.userMessage === "string"
                ? normalizedError.userMessage
                : DEFAULT_MESSAGES[record.type]),
        timestamp: record.timestamp,
    });
}

/**
 * Mengambil pesan aman untuk ditampilkan di UI.
 */
export function getUserErrorMessage(error, fallback = "") {
    if (
        error &&
        typeof error.userMessage === "string" &&
        error.userMessage.trim()
    ) {
        return error.userMessage.trim();
    }

    const type = normalizeErrorType(error?.type);

    if (fallback && typeof fallback === "string") {
        return fallback;
    }

    return DEFAULT_MESSAGES[type];
}

/**
 * Mendaftarkan reporter, misalnya integrasi dengan
 * sistem observability backend di masa depan.
 *
 * Reporter menerima ringkasan log, bukan payload request.
 */
export function registerErrorReporter(reporter) {
    if (typeof reporter !== "function") {
        throw new TypeError(
            "[KANTOONG ErrorHandler] Reporter harus berupa function."
        );
    }

    errorReporters.add(reporter);

    return function unregisterReporter() {
        return errorReporters.delete(reporter);
    };
}

/**
 * Mengambil salinan log error terbaru.
 */
export function getErrorLog({ limit = 20, type = null } = {}) {
    const safeLimit = Number.isFinite(limit)
        ? Math.max(0, Math.min(Math.floor(limit), ERROR_LOG_LIMIT))
        : 20;

    let records = [...errorLog];

    if (type !== null) {
        const normalizedType = normalizeErrorType(type);

        records = records.filter(
            (record) => record.type === normalizedType
        );
    }

    return records
        .slice(-safeLimit)
        .map((record) => Object.freeze({ ...record }));
}

/**
 * Menghapus log error dari memori.
 */
export function clearErrorLog() {
    const removedCount = errorLog.length;

    errorLog.length = 0;

    return removedCount;
}

/**
 * Menghapus seluruh reporter.
 */
export function clearErrorReporters() {
    const removedCount = errorReporters.size;

    errorReporters.clear();

    return removedCount;
}

/**
 * Ringkasan kondisi error handler.
 */
export function getErrorHandlerStatus() {
    return Object.freeze({
        logCount: errorLog.length,
        logLimit: ERROR_LOG_LIMIT,
        reporterCount: errorReporters.size,
        supportedTypes: Object.freeze([...Object.values(ERROR_TYPES)]),
    });
}

/**
 * Konstanta dan API publik.
 */
export { ERROR_TYPES, DEFAULT_MESSAGES };

const ErrorHandler = Object.freeze({
    ERROR_TYPES,
    DEFAULT_MESSAGES,
    createAppError,
    handleError,
    getUserErrorMessage,
    registerErrorReporter,
    getErrorLog,
    clearErrorLog,
    clearErrorReporters,
    getErrorHandlerStatus,
});

export default ErrorHandler;

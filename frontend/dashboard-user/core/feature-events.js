
/**
 * KANTOONG CORE
 * File: frontend/dashboard-user/core/feature-events.js
 *
 * Tanggung jawab:
 * - Menyediakan event bus internal untuk seluruh modul dashboard-user.
 * - Memisahkan komunikasi antarfitur agar tidak saling bergantung langsung.
 * - Mendukung subscribe, unsubscribe, once, dan publish.
 * - Mengisolasi error listener agar tidak menghentikan listener lainnya.
 * - Menyediakan ringkasan event untuk debugging.
 *
 * Catatan keamanan:
 * - Event bus ini hanya untuk komunikasi internal frontend.
 * - Bukan pengganti autentikasi, otorisasi, atau audit log backend.
 * - Jangan mengirim password, token, atau data sensitif melalui event.
 */

const eventListeners = new Map();
const eventStats = new Map();

let eventSequence = 0;

const MAX_EVENT_HISTORY = 100;
const eventHistory = [];

/**
 * Normalisasi nama event.
 */
function normalizeEventName(eventName) {
    if (typeof eventName !== "string") {
        throw new TypeError(
            "[KANTOONG Events] Nama event harus berupa string."
        );
    }

    const normalized = eventName.trim();

    if (!normalized) {
        throw new Error(
            "[KANTOONG Events] Nama event tidak boleh kosong."
        );
    }

    return normalized;
}

/**
 * Validasi callback listener.
 */
function validateListener(listener) {
    if (typeof listener !== "function") {
        throw new TypeError(
            "[KANTOONG Events] Listener harus berupa function."
        );
    }
}

/**
 * Membuat statistik event jika belum tersedia.
 */
function ensureEventStats(eventName) {
    if (!eventStats.has(eventName)) {
        eventStats.set(eventName, {
            published: 0,
            listenerErrors: 0,
            lastPublishedAt: null,
        });
    }

    return eventStats.get(eventName);
}

/**
 * Menambahkan catatan event untuk debugging.
 * Data payload tidak disimpan agar mengurangi risiko
 * menyimpan informasi sensitif secara tidak sengaja.
 */
function recordEvent(eventName, listenerCount) {
    eventSequence += 1;

    const record = Object.freeze({
        id: eventSequence,
        eventName,
        listenerCount,
        timestamp: new Date().toISOString(),
    });

    eventHistory.push(record);

    if (eventHistory.length > MAX_EVENT_HISTORY) {
        eventHistory.shift();
    }

    return record;
}

/**
 * Subscribe:
 * Mendengarkan event sampai unsubscribe dipanggil.
 *
 * Mengembalikan fungsi unsubscribe.
 */
export function on(eventName, listener) {
    const name = normalizeEventName(eventName);
    validateListener(listener);

    if (!eventListeners.has(name)) {
        eventListeners.set(name, new Set());
    }

    const listeners = eventListeners.get(name);

    listeners.add(listener);
    ensureEventStats(name);

    let subscribed = true;

    return function unsubscribe() {
        if (!subscribed) {
            return false;
        }

        subscribed = false;

        const currentListeners = eventListeners.get(name);

        if (!currentListeners) {
            return false;
        }

        const removed = currentListeners.delete(listener);

        if (currentListeners.size === 0) {
            eventListeners.delete(name);
        }

        return removed;
    };
}

/**
 * Alias agar kode lebih mudah dibaca.
 */
export const subscribe = on;

/**
 * Subscribe hanya untuk satu kali pemanggilan.
 */
export function once(eventName, listener) {
    const name = normalizeEventName(eventName);
    validateListener(listener);

    let unsubscribe = null;

    const wrappedListener = (payload, metadata) => {
        unsubscribe?.();
        return listener(payload, metadata);
    };

    unsubscribe = on(name, wrappedListener);

    return unsubscribe;
}

/**
 * Publish:
 * Mengirim event ke semua listener yang terdaftar.
 *
 * Listener dijalankan secara sinkron.
 * Error dari satu listener tidak menghentikan listener lain.
 *
 * Return value berisi ringkasan hasil publish.
 */
export function emit(eventName, payload = undefined) {
    const name = normalizeEventName(eventName);

    const listeners = eventListeners.has(name)
        ? [...eventListeners.get(name)]
        : [];

    const stats = ensureEventStats(name);

    stats.published += 1;
    stats.lastPublishedAt = new Date().toISOString();

    const eventRecord = recordEvent(name, listeners.length);

    const metadata = Object.freeze({
        id: eventRecord.id,
        eventName: name,
        timestamp: eventRecord.timestamp,
    });

    let delivered = 0;
    let errors = 0;

    for (const listener of listeners) {
        try {
            listener(payload, metadata);
            delivered += 1;
        } catch (error) {
            errors += 1;
            stats.listenerErrors += 1;

            console.error(
                `[KANTOONG Events] Listener error pada "${name}".`,
                error
            );
        }
    }

    return Object.freeze({
        eventName: name,
        eventId: eventRecord.id,
        listenerCount: listeners.length,
        delivered,
        errors,
    });
}

/**
 * Alias publish.
 */
export const publish = emit;

/**
 * Menghapus semua listener untuk event tertentu.
 */
export function clearEvent(eventName) {
    const name = normalizeEventName(eventName);
    const existed = eventListeners.has(name);

    eventListeners.delete(name);

    return existed;
}

/**
 * Menghapus semua listener.
 *
 * Statistik dan history tidak ikut dihapus,
 * kecuali opsi resetStats bernilai true.
 */
export function clearAllEvents({ resetStats = false } = {}) {
    const removedCount = [...eventListeners.values()]
        .reduce((total, listeners) => total + listeners.size, 0);

    eventListeners.clear();

    if (resetStats) {
        eventStats.clear();
        eventHistory.length = 0;
        eventSequence = 0;
    }

    return removedCount;
}

/**
 * Menghitung listener aktif.
 */
export function getListenerCount(eventName = null) {
    if (eventName !== null) {
        const name = normalizeEventName(eventName);
        return eventListeners.get(name)?.size ?? 0;
    }

    let total = 0;

    for (const listeners of eventListeners.values()) {
        total += listeners.size;
    }

    return total;
}

/**
 * Mengambil daftar nama event yang sedang memiliki listener.
 */
export function getActiveEventNames() {
    return [...eventListeners.keys()];
}

/**
 * Mengambil ringkasan statistik event.
 */
export function getEventStats(eventName = null) {
    if (eventName !== null) {
        const name = normalizeEventName(eventName);
        const stats = eventStats.get(name);

        return stats
            ? Object.freeze({ eventName: name, ...stats })
            : null;
    }

    return [...eventStats.entries()].map(([name, stats]) =>
        Object.freeze({
            eventName: name,
            ...stats,
        })
    );
}

/**
 * Mengambil history event terbaru.
 *
 * Payload sengaja tidak disimpan.
 */
export function getEventHistory({ limit = 20 } = {}) {
    const safeLimit = Number.isFinite(limit)
        ? Math.max(0, Math.min(Math.floor(limit), MAX_EVENT_HISTORY))
        : 20;

    return eventHistory
        .slice(-safeLimit)
        .map((record) => Object.freeze({ ...record }));
}

/**
 * Memeriksa apakah sebuah event memiliki listener aktif.
 */
export function hasListeners(eventName) {
    const name = normalizeEventName(eventName);
    return (eventListeners.get(name)?.size ?? 0) > 0;
}

/**
 * API utama FeatureEvents.
 */
const FeatureEvents = Object.freeze({
    on,
    subscribe,
    once,
    emit,
    publish,
    clearEvent,
    clearAllEvents,
    getListenerCount,
    getActiveEventNames,
    getEventStats,
    getEventHistory,
    hasListeners,
});

export default FeatureEvents;

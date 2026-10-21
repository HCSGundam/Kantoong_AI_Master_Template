
/**
 * KANTOONG CORE — Menu State
 * File: frontend/menu/menu-state.js
 *
 * Tanggung jawab:
 * - Menyimpan state bersama untuk modul menu.
 * - Menyediakan API untuk membaca dan memperbarui state.
 * - Memberi notifikasi ketika state berubah.
 * - Mencegah perubahan state melalui referensi objek internal.
 *
 * Catatan:
 * - Tidak merender HTML.
 * - Tidak mengakses DOM.
 * - Tidak menyimpan data ke database.
 * - Tidak menggantikan autentikasi atau otorisasi backend.
 */

(() => {
    'use strict';

    const MODULE = '[KANTOONG Menu State]';
    const EVENT_NAME = 'kantoong:menu-state-change';

    // Mencegah modul terpasang dua kali.
    if (window.KantoongMenuState) {
        console.warn(`${MODULE} Modul sudah terpasang.`);
        return;
    }

    const initialState = {
        activeFeature: null,
        drawerOpen: false,
        searchQuery: '',
        selectedTheme: 'default',
        loading: false
    };

    let state = { ...initialState };

    const listeners = new Set();

    const ALLOWED_KEYS = new Set(
        Object.keys(initialState)
    );

    function cloneState(value) {
        return { ...value };
    }

    function getState() {
        return Object.freeze(cloneState(state));
    }

    function get(key) {
        if (!ALLOWED_KEYS.has(key)) {
            return undefined;
        }

        return state[key];
    }

    function isValidValue(key, value) {
        switch (key) {
            case 'activeFeature':
                return value === null ||
                    (typeof value === 'string' && value.length > 0);

            case 'drawerOpen':
            case 'loading':
                return typeof value === 'boolean';

            case 'searchQuery':
            case 'selectedTheme':
                return typeof value === 'string';

            default:
                return false;
        }
    }

    function set(key, value) {
        if (!ALLOWED_KEYS.has(key)) {
            console.warn(`${MODULE} Key tidak dikenal:`, key);

            return {
                ok: false,
                code: 'UNKNOWN_KEY'
            };
        }

        if (!isValidValue(key, value)) {
            console.warn(`${MODULE} Nilai state tidak valid:`, key);

            return {
                ok: false,
                code: 'INVALID_VALUE'
            };
        }

        if (Object.is(state[key], value)) {
            return {
                ok: true,
                code: 'UNCHANGED',
                state: getState()
            };
        }

        const previousValue = state[key];

        state = {
            ...state,
            [key]: value
        };

        const change = Object.freeze({
            key,
            value,
            previousValue,
            state: getState()
        });

        notify(change);

        window.dispatchEvent(
            new CustomEvent(EVENT_NAME, {
                detail: change
            })
        );

        return {
            ok: true,
            code: 'UPDATED',
            state: getState()
        };
    }

    function update(updates) {
        if (
            !updates ||
            typeof updates !== 'object' ||
            Array.isArray(updates)
        ) {
            return {
                ok: false,
                code: 'INVALID_UPDATES'
            };
        }

        const entries = Object.entries(updates);

        // Validasi seluruh perubahan sebelum mengubah state.
        for (const [key, value] of entries) {
            if (!ALLOWED_KEYS.has(key)) {
                return {
                    ok: false,
                    code: 'UNKNOWN_KEY',
                    key
                };
            }

            if (!isValidValue(key, value)) {
                return {
                    ok: false,
                    code: 'INVALID_VALUE',
                    key
                };
            }
        }

        const changes = entries
            .filter(([key, value]) => !Object.is(state[key], value))
            .map(([key, value]) => ({
                key,
                value,
                previousValue: state[key]
            }));

        if (changes.length === 0) {
            return {
                ok: true,
                code: 'UNCHANGED',
                state: getState()
            };
        }

        const nextState = { ...state };

        for (const change of changes) {
            nextState[change.key] = change.value;
        }

        state = nextState;

        const result = getState();

        for (const change of changes) {
            const detail = Object.freeze({
                ...change,
                state: result
            });

            notify(detail);

            window.dispatchEvent(
                new CustomEvent(EVENT_NAME, {
                    detail
                })
            );
        }

        return {
            ok: true,
            code: 'UPDATED',
            state: getState()
        };
    }

    function notify(change) {
        for (const listener of listeners) {
            try {
                listener(change);
            } catch (error) {
                console.error(
                    `${MODULE} Listener gagal:`,
                    error
                );
            }
        }
    }

    function subscribe(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError(
                `${MODULE} subscribe membutuhkan fungsi callback.`
            );
        }

        listeners.add(callback);

        // Mengembalikan fungsi untuk berhenti berlangganan.
        return () => {
            listeners.delete(callback);
        };
    }

    function reset() {
        return update(initialState);
    }

    function getStatus() {
        return Object.freeze({
            initialized: true,
            stateKeys: ALLOWED_KEYS.size,
            activeListeners: listeners.size
        });
    }

    window.KantoongMenuState = Object.freeze({
        getState,
        get,
        set,
        update,
        subscribe,
        reset,
        getStatus
    });

    window.dispatchEvent(
        new CustomEvent('kantoong:menu-state-ready')
    );

    console.info(`${MODULE} Modul berhasil dimuat.`);
})();

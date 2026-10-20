
/**
 * KANTOONG CORE — Menu Controller
 * File: frontend/menu/menu-controller.js
 *
 * Tanggung jawab:
 * - Mengkoordinasikan aksi fitur menu.
 * - Menangani alur aksi sebelum diteruskan ke modul lain.
 * - Mempertahankan event integrasi KANTOONG yang sudah ada.
 * - Menyediakan API publik yang stabil untuk menu.js.
 *
 * Catatan:
 * - Tidak merender HTML.
 * - Tidak mengakses database secara langsung.
 * - Bukan pengganti autentikasi atau otorisasi backend.
 */
(() => {
    'use strict';

    const MODULE = '[KANTOONG Menu Controller]';

    if (window.KantoongMenuController) {
        console.warn(`${MODULE} Controller sudah terpasang.`);
        return;
    }

    const state = {
        initialized: false,
        dependencies: {
            getFeatures: () => [],
            closeMenu: () => {},
            showToast: () => {}
        }
    };

    const SUPPORTED_ACTIONS = new Set([
        'profile',
        'addresses',
        'tracking',
        'orders',
        'spending',
        'analytics',
        'history',
        'calendar',
        'catalog',
        'wishlist',
        'reviews',
        'promos',
        'ai-history',
        'support',
        'settings',
        'export',
        'store-map',
        'member'
    ]);

    function emit(name, detail = {}) {
        window.dispatchEvent(
            new CustomEvent(name, { detail })
        );
    }

    function configure(options = {}) {
        if (options.getFeatures !== undefined) {
            if (typeof options.getFeatures !== 'function') {
                throw new TypeError(
                    `${MODULE} getFeatures harus berupa fungsi.`
                );
            }

            state.dependencies.getFeatures = options.getFeatures;
        }

        if (options.closeMenu !== undefined) {
            if (typeof options.closeMenu !== 'function') {
                throw new TypeError(
                    `${MODULE} closeMenu harus berupa fungsi.`
                );
            }

            state.dependencies.closeMenu = options.closeMenu;
        }

        if (options.showToast !== undefined) {
            if (typeof options.showToast !== 'function') {
                throw new TypeError(
                    `${MODULE} showToast harus berupa fungsi.`
                );
            }

            state.dependencies.showToast = options.showToast;
        }

        state.initialized = true;

        return getStatus();
    }

    function getFeature(action) {
        if (typeof action !== 'string' || !action.trim()) {
            return null;
        }

        const features = state.dependencies.getFeatures();

        if (!Array.isArray(features)) {
            console.error(
                `${MODULE} getFeatures tidak mengembalikan array.`
            );

            return null;
        }

        return features.find(
            (feature) => feature.action === action
        ) || null;
    }

    function dispatch(action) {
        if (typeof action !== 'string' || !action.trim()) {
            return {
                ok: false,
                code: 'INVALID_ACTION'
            };
        }

        const normalizedAction = action.trim();

        if (!SUPPORTED_ACTIONS.has(normalizedAction)) {
            console.warn(
                `${MODULE} Aksi tidak dikenal:`,
                normalizedAction
            );

            return {
                ok: false,
                code: 'UNKNOWN_ACTION',
                action: normalizedAction
            };
        }

        const feature = getFeature(normalizedAction);

        if (!feature) {
            console.warn(
                `${MODULE} Fitur belum terdaftar:`,
                normalizedAction
            );

            return {
                ok: false,
                code: 'FEATURE_NOT_REGISTERED',
                action: normalizedAction
            };
        }

        try {
            if (normalizedAction === 'settings') {
                state.dependencies.showToast(
                    'Tema dan notifikasi bisa diubah langsung dari kartu Pengaturan Aplikasi.'
                );

                return {
                    ok: true,
                    code: 'INLINE_ACTION_HANDLED',
                    action: normalizedAction
                };
            }

            state.dependencies.closeMenu();

            if (normalizedAction === 'catalog') {
                emit('kantoong:show-catalog');

                return {
                    ok: true,
                    code: 'EVENT_DISPATCHED',
                    action: normalizedAction
                };
            }

            if (normalizedAction === 'ai-history') {
                emit('kantoong:ai-history-open');

                emit('kantoong:customer-feature-request', {
                    action: normalizedAction,
                    featureId: feature.id,
                    featureTitle: feature.title
                });

                return {
                    ok: true,
                    code: 'EVENT_DISPATCHED',
                    action: normalizedAction
                };
            }

            emit('kantoong:customer-feature-request', {
                action: normalizedAction,
                featureId: feature.id,
                featureTitle: feature.title
            });

            return {
                ok: true,
                code: 'EVENT_DISPATCHED',
                action: normalizedAction
            };
        } catch (error) {
            console.error(
                `${MODULE} Gagal memproses aksi:`,
                normalizedAction,
                error
            );

            return {
                ok: false,
                code: 'DISPATCH_FAILED',
                action: normalizedAction
            };
        }
    }

    function getStatus() {
        return Object.freeze({
            initialized: state.initialized,
            registeredActionCount: SUPPORTED_ACTIONS.size
        });
    }

    window.KantoongMenuController = Object.freeze({
        configure,
        dispatch,
        getFeature,
        getStatus
    });

    console.info(`${MODULE} modul berhasil dimuat.`);
})();


/* =========================================================
   KANTOONG CORE
   File: frontend/menu/menu-controller.js

   Tanggung jawab:
   1. Menerima aksi dari menu.js.
   2. Menormalisasi format aksi string maupun object.
   3. Menghubungkan aksi ke menu-router.js.
   4. Menyediakan registrasi handler fitur tambahan.
   5. Menjaga kompatibilitas dengan modul KANTOONG lainnya.

   Catatan:
   - Tidak merender UI.
   - Tidak mengubah menu.js.
   - Tidak membuat ulang lima fitur inti menu.
   ========================================================= */

(function (window, document) {
    "use strict";

    if (window.KantoongMenuController) {
        return;
    }

    const MODULE = "[KANTOONG Menu Controller]";

    const EVENTS = {
        dispatched: "kantoong:menu-action-dispatched",
        completed: "kantoong:menu-action-complete",
        error: "kantoong:menu-action-error",
        featureRequest: "kantoong:customer-feature-request"
    };

    /*
     * ID fitur bisnis yang didukung router pelanggan.
     * Lima fitur inti KANTOONG CORE ditangani menu.js.
     */
    const SUPPORTED_ACTIONS = [
        "profile",
        "addresses",
        "tracking",
        "orders",
        "spending",
        "analytics",
        "history",
        "calendar",
        "catalog",
        "wishlist",
        "reviews",
        "promos",
        "ai-history",
        "support",
        "settings",
        "export",
        "store-map",
        "member"
    ];

    const handlers = new Map();

    const state = {
        initialized: false,
        dispatchCount: 0,
        lastAction: null,
        lastStatus: "idle"
    };

    function emit(eventName, detail = {}) {
        window.dispatchEvent(
            new CustomEvent(eventName, {
                detail: detail
            })
        );
    }

    function normalizeRequest(request, extra = {}) {
        if (typeof request === "string") {
            return {
                ...extra,
                action: request
            };
        }

        if (
            request &&
            typeof request === "object" &&
            !Array.isArray(request)
        ) {
            return {
                ...request,
                ...extra,
                action:
                    extra.action ||
                    request.action ||
                    request.id ||
                    request.featureId ||
                    null
            };
        }

        return {
            ...extra,
            action: null
        };
    }

    function getRouter() {
        return window.KantoongMenuRouter || null;
    }

    function getMenu() {
        return (
            window.KantoongMenuApp ||
            window.KantoongCustomerMenu ||
            null
        );
    }

    function getFeature(action) {
        if (!action) {
            return null;
        }

        const menu = getMenu();

        if (menu && typeof menu.getFeatures === "function") {
            try {
                const features = menu.getFeatures();

                if (Array.isArray(features)) {
                    const found = features.find(function (feature) {
                        return (
                            feature &&
                            (
                                feature.action === action ||
                                feature.id === action
                            )
                        );
                    });

                    if (found) {
                        return found;
                    }
                }
            } catch (error) {
                console.warn(
                    MODULE + ": gagal membaca daftar fitur menu.",
                    error
                );
            }
        }

        const router = getRouter();

        if (router && typeof router.getRoutes === "function") {
            try {
                const routes = router.getRoutes();

                if (Array.isArray(routes)) {
                    return routes.find(function (route) {
                        return (
                            route &&
                            (
                                route.action === action ||
                                route.id === action
                            )
                        );
                    }) || null;
                }

                if (
                    routes &&
                    typeof routes === "object" &&
                    routes[action]
                ) {
                    return routes[action];
                }
            } catch (error) {
                console.warn(
                    MODULE + ": gagal membaca rute.",
                    error
                );
            }
        }

        return null;
    }

    function registerAction(action, handler) {
        if (
            typeof action !== "string" ||
            !action.trim()
        ) {
            throw new TypeError(
                MODULE + ": nama action wajib berupa string."
            );
        }

        if (typeof handler !== "function") {
            throw new TypeError(
                MODULE + ": handler wajib berupa function."
            );
        }

        handlers.set(action.trim(), handler);

        return true;
    }

    function unregisterAction(action) {
        return handlers.delete(action);
    }

    function dispatch(request, extra = {}) {
        const detail = normalizeRequest(request, extra);
        const action = detail.action;

        if (
            typeof action !== "string" ||
            !action.trim()
        ) {
            state.lastStatus = "invalid-action";

            emit(EVENTS.error, {
                reason: "invalid-action",
                request: request
            });

            console.warn(
                MODULE + ": action tidak valid.",
                request
            );

            return false;
        }

        detail.action = action.trim();
        state.dispatchCount += 1;
        state.lastAction = detail.action;

        /*
         * Handler khusus memiliki prioritas.
         */
        const customHandler = handlers.get(detail.action);

        if (customHandler) {
            try {
                const result = customHandler(detail);

                state.lastStatus = "custom-handler";

                emit(EVENTS.dispatched, {
                    ...detail,
                    handledBy: "custom-handler"
                });

                return result === undefined ? true : result;
            } catch (error) {
                state.lastStatus = "error";

                emit(EVENTS.error, {
                    ...detail,
                    message: error.message
                });

                console.error(
                    MODULE + ": handler khusus gagal.",
                    error
                );

                return false;
            }
        }

        /*
         * Lima fitur inti adalah tanggung jawab menu.js.
         * Jangan mengirimnya kembali ke router pelanggan.
         */
        const coreActions = [
            "command-center",
            "adaptive-menu",
            "semantic-search",
            "navigation-memory",
            "feature-hub"
        ];

        if (coreActions.includes(detail.action)) {
            state.lastStatus = "core-action";

            emit(EVENTS.dispatched, {
                ...detail,
                handledBy: "menu-core"
            });

            return true;
        }

        /*
         * Aksi bisnis diarahkan ke router dengan format
         * navigate(action, detail), bukan navigate(detail).
         *
         * menu.js versi saat ini juga mencoba memanggil router
         * dengan payload object sebelum memanggil controller.
         * Karena itu controller menormalisasi dan memastikan
         * rute yang benar dipanggil di sini.
         */
        const router = getRouter();

        if (
            router &&
            typeof router.navigate === "function"
        ) {
            try {
                const result = router.navigate(
                    detail.action,
                    detail
                );

                if (result === false) {
                    state.lastStatus = "route-rejected";

                    emit(EVENTS.error, {
                        ...detail,
                        reason: "route-rejected"
                    });

                    return false;
                }

                state.lastStatus = "routed";

                emit(EVENTS.dispatched, {
                    ...detail,
                    handledBy: "router"
                });

                emit(EVENTS.completed, {
                    ...detail,
                    status: "routed"
                });

                return true;
            } catch (error) {
                state.lastStatus = "route-error";

                emit(EVENTS.error, {
                    ...detail,
                    reason: "route-error",
                    message: error.message
                });

                console.error(
                    MODULE + ": navigasi gagal.",
                    error
                );

                return false;
            }
        }

        /*
         * Router belum tersedia: berikan permintaan melalui
         * event integrasi agar modul lain dapat menanganinya.
         */
        state.lastStatus = "event-request";

        emit(EVENTS.featureRequest, detail);

        emit(EVENTS.dispatched, {
            ...detail,
            handledBy: "event"
        });

        return true;
    }

    function configure(options = {}) {
        if (
            !options ||
            typeof options !== "object" ||
            Array.isArray(options)
        ) {
            return false;
        }

        if (options.handlers && typeof options.handlers === "object") {
            Object.keys(options.handlers).forEach(function (action) {
                if (typeof options.handlers[action] === "function") {
                    registerAction(
                        action,
                        options.handlers[action]
                    );
                }
            });
        }

        state.initialized = true;

        return true;
    }

    function getStatus() {
        return {
            initialized: state.initialized,
            dispatchCount: state.dispatchCount,
            lastAction: state.lastAction,
            lastStatus: state.lastStatus,
            registeredHandlers: Array.from(handlers.keys()),
            supportedActions: SUPPORTED_ACTIONS.slice()
        };
    }

    function getSupportedActions() {
        return SUPPORTED_ACTIONS.slice();
    }

    const publicAPI = {
        configure: configure,
        dispatch: dispatch,
        getFeature: getFeature,
        getStatus: getStatus,
        registerAction: registerAction,
        unregisterAction: unregisterAction,
        getSupportedActions: getSupportedActions
    };

    window.KantoongMenuController = Object.freeze(publicAPI);

    /*
     * Tandai siap tanpa memaksa menu.js atau router melakukan
     * inisialisasi ulang.
     */
    state.initialized = true;

    console.info(MODULE + " siap.");

})(window, document);

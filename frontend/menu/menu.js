
/* =========================================================
   KANTOONG CORE
   File: frontend/menu/menu.js

   Fungsi:
   1. Command Center
   2. Adaptive Menu
   3. Smart Semantic Search
   4. Navigation Memory
   5. Feature Hub

   Tugas file ini:
   - Mengatur shell/menu utama.
   - Mengatur tombol hamburger dan tombol tutup.
   - Menghubungkan fitur ke modul masing-masing.
   - Mengirim event integrasi antarmodul.
   - Tidak membuat dashboard pelanggan.
   - Tidak menggantikan implementasi fitur di folder features/.
   ========================================================= */

(function (window, document) {
    "use strict";

    if (window.KantoongMenuApp) {
        return;
    }

    const MODULE = "[KANTOONG Menu]";
    const ROOT_SELECTOR = "#sampleDrawer";
    const MENU_BUTTON_SELECTOR = "#showcaseMenuBtn";

    const EVENTS = {
        open: "kantoong:menu-open",
        close: "kantoong:menu-close",
        ready: "kantoong:menu-ready",
        navigate: "kantoong:menu-navigate",
        search: "kantoong:menu-search",
        customize: "kantoong:menu-customize",
        history: "kantoong:menu-history-open",
        featureHub: "kantoong:feature-hub-open",
        command: "kantoong:menu-command"
    };

    const $ = (selector, root = document) =>
        root.querySelector(selector);

    const $$ = (selector, root = document) =>
        Array.from(root.querySelectorAll(selector));

    const emit = (name, detail = {}) => {
        window.dispatchEvent(
            new CustomEvent(name, { detail })
        );
    };

    const escapeHTML = (value) =>
        String(value ?? "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);

    const state = {
        initialized: false,
        isOpen: false,
        activeView: "command-center",
        previousFocus: null,
        root: null
    };

    /*
     * Modul-modul ini memiliki tanggung jawab masing-masing.
     * menu.js hanya mencari API yang tersedia dan mengirim event
     * jika suatu modul belum menyediakan API publik.
     */
    const MODULES = {
        config: () => window.KantoongMenuConfig,
        state: () => window.KantoongMenuState,
        events: () => window.KantoongMenuEvents,
        registry: () => window.KantoongMenuRegistry,
        layout: () => window.KantoongMenuLayout,
        customizer: () => window.KantoongMenuCustomizer,
        history: () => window.KantoongMenuHistory,
        router: () => window.KantoongMenuRouter,
        search: () => window.KantoongMenuSearch,
        semanticSearch: () => window.KantoongMenuSemanticSearch,
        featureHub: () => window.KantoongMenuFeatureHub,
        storage: () => window.KantoongMenuStorage,
        voice: () => window.KantoongMenuVoice,
        controller: () => window.KantoongMenuController
    };

    function getModule(name) {
        try {
            return MODULES[name]?.() || null;
        } catch (error) {
            console.warn(
                `${MODULE}: gagal mengakses modul "${name}".`,
                error
            );

            return null;
        }
    }

    /*
     * Memanggil API publik modul jika tersedia.
     * Jika belum tersedia, event integrasi tetap dikirim.
     *
     * Ini mencegah menu.js menebak atau mengambil alih
     * implementasi internal modul lain.
     */
    function invokeModule(name, methods, payload = {}) {
        const module = getModule(name);

        if (module) {
            for (const methodName of methods) {
                if (typeof module[methodName] === "function") {
                    try {
                        return module[methodName](payload);
                    
                    } catch (error) {
                        console.error(
                            `${MODULE}: ${name}.${methodName} gagal.`,
                            error
                        );

                        continue;
                    }
                }
            }
        }

        emit(EVENTS.command, {
            module: name,
            methods,
            ...payload
        });

        return undefined;
    }

    /*
     * Inisialisasi modul yang sudah menyediakan init().
     * Modul tanpa init() tidak dipaksa memakai API tertentu.
     */
    function initializeModules() {
        const order = [
            "config",
            "state",
            "events",
            "registry",
            "storage",
            "layout",
            "router",
            "search",
            "semanticSearch",
            "history",
            "customizer",
            "featureHub",
            "voice"
        ];

        order.forEach((name) => {
            const module = getModule(name);

            if (
                module &&
                typeof module.init === "function" &&
                !module.__kantoongMenuInitialized
            ) {
                try {
                    module.init();
                    module.__kantoongMenuInitialized = true;
                } catch (error) {
                    console.error(
                        `${MODULE}: inisialisasi modul "${name}" gagal.`,
                        error
                    );
                }
            }
        });
    }

    /*
     * Lima fungsi inti yang ditampilkan sebagai akses sistem.
     * Daftar ini bukan daftar semua fitur bisnis pelanggan.
     */
    const CORE_FEATURES = [
        {
            id: "command-center",
            title: "Command Center",
            description: "Pusat akses dan kendali menu.",
            icon: "⌂",
            action: "command-center"
        },
        {
            id: "adaptive-menu",
            title: "Adaptive Menu",
            description: "Atur fitur, urutan, dan ukuran kartu.",
            icon: "▦",
            action: "adaptive-menu"
        },
        {
            id: "semantic-search",
            title: "Smart Semantic Search",
            description: "Cari fitur menggunakan bahasa sehari-hari.",
            icon: "⌕",
            action: "semantic-search"
        },
        {
            id: "navigation-memory",
            title: "Navigation Memory",
            description: "Lihat riwayat dan fitur terakhir dibuka.",
            icon: "◷",
            action: "navigation-memory"
        },
        {
            id: "feature-hub",
            title: "Feature Hub",
            description: "Temukan fitur dan tambahkan ke menu pribadi.",
            icon: "⊞",
            action: "feature-hub"
        }
    ];

    function installStyles() {
        if ($("#kantoong-menu-core-styles")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "kantoong-menu-core-styles";

        style.textContent = `
            #sampleDrawer.kantoong-core-menu {
                display: none;
                position: fixed;
                inset: 0;
                z-index: 1000;
                width: 100%;
                height: 100%;
                max-height: 100dvh;
                overflow: auto;
                box-sizing: border-box;
                flex-direction: column;
                background: #f6f5f1;
                color: #17202a;
                font-family: inherit;
                overscroll-behavior: contain;
                -webkit-overflow-scrolling: touch;
            }

            #sampleDrawer.kantoong-core-menu.is-open {
                display: flex;
            }

            #sampleDrawer.kantoong-core-menu *,
            #sampleDrawer.kantoong-core-menu *::before,
            #sampleDrawer.kantoong-core-menu *::after {
                box-sizing: border-box;
            }

            #sampleDrawer .kc-header {
                position: sticky;
                top: 0;
                z-index: 5;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 14px;
                padding: max(14px, env(safe-area-inset-top)) 18px 14px;
                border-bottom: 1px solid #e5e1d8;
                background: #f6f5f1;
            }

            #sampleDrawer .kc-brand {
                margin: 0;
                font-size: 15px;
                font-weight: 850;
                letter-spacing: -.04em;
            }

            #sampleDrawer .kc-caption {
                margin: 4px 0 0;
                color: #68717a;
                font-size: 11px;
            }

            #sampleDrawer .kc-close {
                display: grid;
                place-items: center;
                width: 42px;
                height: 42px;
                flex: none;
                border: 1px solid #e5e1d8;
                border-radius: 50%;
                background: #fffefa;
                color: #17202a;
                font-size: 23px;
                cursor: pointer;
            }

            #sampleDrawer .kc-content {
                width: 100%;
                max-width: 1000px;
                margin: 0 auto;
                padding: 24px 16px calc(36px + env(safe-area-inset-bottom));
            }

            #sampleDrawer .kc-eyebrow {
                margin: 0 0 8px;
                color: #8a7650;
                font-size: 10px;
                font-weight: 800;
                letter-spacing: .13em;
                text-transform: uppercase;
            }

            #sampleDrawer .kc-title {
                margin: 0;
                font-size: clamp(27px, 5vw, 38px);
                line-height: 1.08;
                letter-spacing: -.055em;
            }

            #sampleDrawer .kc-description {
                max-width: 600px;
                margin: 10px 0 22px;
                color: #68717a;
                font-size: 13px;
                line-height: 1.6;
            }

            #sampleDrawer .kc-search {
                display: flex;
                align-items: center;
                gap: 10px;
                min-height: 48px;
                margin-bottom: 22px;
                padding: 0 14px;
                border: 1px solid #e5e1d8;
                border-radius: 15px;
                background: #fffefa;
            }

            #sampleDrawer .kc-search input {
                width: 100%;
                min-width: 0;
                border: 0;
                outline: 0;
                background: transparent;
                color: inherit;
                font: inherit;
                font-size: 13px;
            }

            #sampleDrawer .kc-section-title {
                margin: 0 0 12px;
                font-size: 14px;
                font-weight: 850;
            }

            #sampleDrawer .kc-core-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 11px;
            }

            #sampleDrawer .kc-feature {
                display: flex;
                min-width: 0;
                min-height: 150px;
                flex-direction: column;
                align-items: flex-start;
                padding: 15px;
                border: 1px solid #e5e1d8;
                border-radius: 18px;
                background: #fffefa;
                color: #17202a;
                text-align: left;
                cursor: pointer;
                transition: border-color .18s ease,
                            transform .18s ease;
            }

            #sampleDrawer .kc-feature:hover {
                border-color: #c49b50;
                transform: translateY(-2px);
            }

            #sampleDrawer .kc-feature:focus-visible,
            #sampleDrawer .kc-close:focus-visible {
                outline: 2px solid #c49b50;
                outline-offset: 3px;
            }

            #sampleDrawer .kc-feature-icon {
                display: grid;
                place-items: center;
                width: 39px;
                height: 39px;
                margin-bottom: 16px;
                border-radius: 13px;
                background: #f0eee7;
                font-size: 23px;
            }

            #sampleDrawer .kc-feature-title {
                margin: 0;
                font-size: 13px;
                font-weight: 850;
                line-height: 1.35;
            }

            #sampleDrawer .kc-feature-description {
                margin: 6px 0 0;
                color: #68717a;
                font-size: 11px;
                line-height: 1.5;
            }

            #sampleDrawer .kc-view {
                margin-top: 22px;
                padding: 16px;
                border: 1px solid #e5e1d8;
                border-radius: 17px;
                background: #fffefa;
            }

            #sampleDrawer .kc-view[hidden],
            #sampleDrawer .kc-feature[hidden] {
                display: none !important;
            }

            #sampleDrawer .kc-view-title {
                margin: 0;
                font-size: 14px;
                font-weight: 850;
            }

            #sampleDrawer .kc-view-text {
                margin: 7px 0 0;
                color: #68717a;
                font-size: 12px;
                line-height: 1.6;
            }

            #sampleDrawer .kc-footer {
                margin-top: 24px;
                padding-top: 15px;
                border-top: 1px solid #e5e1d8;
                color: #68717a;
                font-size: 10px;
                line-height: 1.6;
            }

            @media (min-width: 620px) {
                #sampleDrawer .kc-content {
                    padding-right: 26px;
                    padding-left: 26px;
                }

                #sampleDrawer .kc-core-grid {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 14px;
                }

                #sampleDrawer .kc-feature:last-child {
                    grid-column: span 1;
                }
            }

            @media (prefers-reduced-motion: reduce) {
                #sampleDrawer .kc-feature {
                    transition: none;
                }
            }
        `;

        document.head.appendChild(style);
    }

    function renderShell() {
        if (!state.root) {
            return;
        }

        state.root.innerHTML = `
            <header class="kc-header">
                <div>
                    <p class="kc-brand">KANTOONG CORE</p>
                    <p class="kc-caption">
                        Personal Menu System
                    </p>
                </div>

                <button
                    class="kc-close"
                    type="button"
                    data-kc-close
                    aria-label="Tutup menu"
                >×</button>
            </header>

            <main class="kc-content">
                <section aria-labelledby="kcMainTitle">
                    <p class="kc-eyebrow">YOUR CONTROL CENTER</p>
                    <h1 class="kc-title" id="kcMainTitle">
                        Menu yang mengikuti caramu bekerja.
                    </h1>
                    <p class="kc-description">
                        Atur akses fitur, cari berdasarkan kebutuhan,
                        buka riwayat, dan temukan fitur baru dari satu tempat.
                    </p>
                </section>

                <label class="kc-search">
                    <span aria-hidden="true">⌕</span>
                    <input
                        type="search"
                        data-kc-search
                        placeholder="Cari fitur atau jelaskan kebutuhanmu..."
                        autocomplete="off"
                        aria-label="Cari fitur"
                    >
                </label>

                <section aria-labelledby="kcCoreHeading">
                    <h2 class="kc-section-title" id="kcCoreHeading">
                        Sistem menu
                    </h2>

                    <div class="kc-core-grid" data-kc-feature-list>
                        ${CORE_FEATURES.map((feature) => `
                            <button
                                type="button"
                                class="kc-feature"
                                data-kc-action="${escapeHTML(feature.action)}"
                                data-kc-searchable="${escapeHTML(
                                    `${feature.title} ${feature.description}`
                                )}"
                            >
                                <span class="kc-feature-icon" aria-hidden="true">
                                    ${escapeHTML(feature.icon)}
                                </span>

                                <span class="kc-feature-title">
                                    ${escapeHTML(feature.title)}
                                </span>

                                <span class="kc-feature-description">
                                    ${escapeHTML(feature.description)}
                                </span>
                            </button>
                        `).join("")}
                    </div>
                </section>

                <section class="kc-view" data-kc-view hidden>
                    <h2 class="kc-view-title" data-kc-view-title></h2>
                    <p class="kc-view-text" data-kc-view-text></p>
                </section>

                <footer class="kc-footer">
                    KANTOONG CORE · MODULAR MENU SYSTEM
                </footer>
            </main>
        `;

        bindRootEvents();
    }

    function setActiveView(viewId, title, description) {
        state.activeView = viewId;

        const panel = $("[data-kc-view]", state.root);
        const titleNode = $("[data-kc-view-title]", state.root);
        const descriptionNode = $("[data-kc-view-text]", state.root);

        if (panel) {
            panel.hidden = false;
        }

        if (titleNode) {
            titleNode.textContent = title;
        }

        if (descriptionNode) {
            descriptionNode.textContent = description;
        }

        emit(EVENTS.navigate, {
            view: viewId,
            title
        });
    }

    function openFeature(action) {
        switch (action) {
            case "command-center":
                setActiveView(
                    action,
                    "Command Center",
                    "Pusat akses sistem menu KANTOONG CORE."
                );

                invokeModule(
                    "layout",
                    ["showCommandCenter", "showHome", "render"],
                    { view: action }
                );
                break;

            case "adaptive-menu":
                setActiveView(
                    action,
                    "Adaptive Menu",
                    "Atur fitur yang tampil, tambahkan atau hapus kartu, " +
                    "ubah urutan, dan sesuaikan ukuran jika didukung layout."
                );

                emit(EVENTS.customize, { source: "menu" });

                invokeModule(
                    "customizer",
                    ["open", "show", "init"],
                    { source: "menu" }
                );
                break;

            case "semantic-search":
                setActiveView(
                    action,
                    "Smart Semantic Search",
                    "Tuliskan tujuanmu, misalnya: cari alamat pengiriman " +
                    "atau tampilkan riwayat transaksi."
                );

                invokeModule(
                    "semanticSearch",
                    ["open", "show"],
                    { source: "menu" }
                );

                $("[data-kc-search]", state.root)?.focus();
                break;

            case "navigation-memory":
                setActiveView(
                    action,
                    "Navigation Memory",
                    "Riwayat fitur dan fitur terakhir dibuka akan ditampilkan " +
                    "oleh modul riwayat navigasi."
                );

                emit(EVENTS.history, { source: "menu" });

                invokeModule(
                    "history",
                    ["open", "show", "render"],
                    { source: "menu" }
                );
                break;

            case "feature-hub":
                setActiveView(
                    action,
                    "Feature Hub",
                    "Jelajahi katalog fitur yang tersedia dan tambahkan " +
                    "fitur pilihanmu ke menu pribadi."
                );

                emit(EVENTS.featureHub, { source: "menu" });

                invokeModule(
                    "featureHub",
                    ["open", "show", "render"],
                    { source: "menu" }
                );
                break;

            default:
                
                invokeModule(
                    "controller",
                    ["dispatch", "open"],
                    { action, source: "menu" }
                );

                break;
        }
    }

    function filterCoreFeatures(query) {
        const normalized = query.trim().toLowerCase();
        let visibleCount = 0;

        $$(".kc-feature", state.root).forEach((button) => {
            const searchable = (
                button.dataset.kcSearchable || ""
            ).toLowerCase();

            const matches =
                !normalized || searchable.includes(normalized);

            button.hidden = !matches;

            if (matches) {
                visibleCount++;
            }
        });

        /*
         * Kirim query ke semantic search.
         * Pencarian semantik yang sesungguhnya tetap menjadi
         * tanggung jawab menu-semantic-search.js.
         */
        if (normalized) {
            emit(EVENTS.search, {
                query,
                source: "menu"
            });

            invokeModule(
                "semanticSearch",
                ["search", "query"],
                { query, source: "menu" }
            );
        }

        return visibleCount;
    }

    function bindRootEvents() {
        if (!state.root || state.root.dataset.kcBound === "true") {
            return;
        }

        state.root.dataset.kcBound = "true";

        state.root.addEventListener("click", (event) => {
            const closeButton = event.target.closest("[data-kc-close]");

            if (closeButton) {
                event.preventDefault();
                closeMenu();
                return;
            }

            const featureButton = event.target.closest("[data-kc-action]");

            if (!featureButton) {
                return;
            }

            event.preventDefault();
            openFeature(featureButton.dataset.kcAction);
        });

        const searchInput = $("[data-kc-search]", state.root);

        searchInput?.addEventListener("input", () => {
            filterCoreFeatures(searchInput.value);
        });
    }

    function openMenu() {
        if (!state.root) {
            console.error(
                `${MODULE}: elemen #sampleDrawer tidak ditemukan.`
            );
            return;
        }

        if (state.isOpen) {
            return;
        }

        state.previousFocus = document.activeElement;
        state.isOpen = true;

        state.root.classList.add("is-open");
        state.root.style.display = "flex";
        state.root.setAttribute("role", "dialog");
        state.root.setAttribute("aria-modal", "true");
        state.root.setAttribute("aria-label", "Menu KANTOONG CORE");

        document.body.style.overflow = "hidden";

        emit(EVENTS.open, {
            view: state.activeView
        });

        $("[data-kc-search]", state.root)?.focus({
            preventScroll: true
        });
    }

    function closeMenu() {
        if (!state.root || !state.isOpen) {
            return;
        }

        state.isOpen = false;

        state.root.classList.remove("is-open");
        state.root.style.display = "none";
        state.root.removeAttribute("role");
        state.root.removeAttribute("aria-modal");
        state.root.removeAttribute("aria-label");

        document.body.style.overflow = "";

        emit(EVENTS.close, {
            view: state.activeView
        });

        if (
            state.previousFocus instanceof HTMLElement &&
            document.contains(state.previousFocus)
        ) {
            state.previousFocus.focus({
                preventScroll: true
            });
        }
    }

    function bindGlobalEvents() {
        const menuButton = $(MENU_BUTTON_SELECTOR);

        if (menuButton && menuButton.dataset.kcBound !== "true") {
            menuButton.dataset.kcBound = "true";

            /*
             * Menangani hamburger sebelum handler lama.
             * Mencegah drawer lama dan menu baru terbuka bersamaan.
             */
            menuButton.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                openMenu();
            }, true);
        }

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && state.isOpen) {
                closeMenu();
            }
        });

        /*
         * Jika modul lain meminta menu ditutup, menu ini merespons.
         */
        window.addEventListener("kantoong:menu-request-close", closeMenu);
        window.addEventListener("kantoong:menu-request-open", openMenu);
    }

    function init() {
        if (state.initialized) {
            return;
        }

        state.root = $(ROOT_SELECTOR);

        if (!state.root) {
            console.error(
                `${MODULE}: #sampleDrawer tidak ditemukan. ` +
                `Pastikan elemen ini tetap tersedia di index.html.`
            );
            return;
        }

        installStyles();

        state.root.classList.add("kantoong-core-menu");

        initializeModules();
        renderShell();
        bindGlobalEvents();

        state.initialized = true;

        emit(EVENTS.ready, {
            features: CORE_FEATURES.map((feature) => feature.id)
        });

        console.info(
            `${MODULE} siap. Dashboard pelanggan tidak dirender oleh menu.js.`
        );
    }

    const publicAPI = {
        init,
        open: openMenu,
        close: closeMenu,
        navigate: openFeature,

        getState() {
            return {
                initialized: state.initialized,
                isOpen: state.isOpen,
                activeView: state.activeView
            };
        },

        getCoreFeatures() {
            return CORE_FEATURES.map((feature) => ({ ...feature }));
        }
    };

    window.KantoongMenuApp = Object.freeze(publicAPI);

    /*
     * Nama flag dipertahankan untuk kompatibilitas dengan handler
     * lama yang sebelumnya membuka drawer pelanggan.
     */
    window.KantoongBentoIntegrated = true;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, {
            once: true
        });
    } else {
        init();
    }

})(window, document);


/* =========================================================
   KANTOONG CORE
   File: frontend/menu/menu-router.js

   Tanggung jawab:
   1. Mengatur navigasi halaman fitur bisnis.
   2. Menampilkan halaman fitur dalam satu container.
   3. Menyediakan handler khusus untuk integrasi fitur.
   4. Mendukung tombol kembali dan tombol Escape.
   5. Menjaga kompatibilitas dengan event menu lama.

   Kompatibel dengan:
   - menu.js
   - menu-controller.js
   - Modul fitur melalui register()

   Catatan:
   Konten halaman di sini merupakan kerangka navigasi.
   Logika bisnis sesungguhnya tetap milik modul features/.
   ========================================================= */

(function (window, document) {
    "use strict";

    if (window.KantoongMenuRouter) {
        return;
    }

    const MODULE = "[KANTOONG Menu Router]";
    const PAGE_ID = "kantoongFeaturePage";
    const STYLE_ID = "kantoong-router-styles";

    const EVENTS = {
        navigate: "kantoong:menu-navigate",
        featureRequest: "kantoong:customer-feature-request",
        routeChange: "kantoong:route-change",
        routeBack: "kantoong:route-back",
        routeError: "kantoong:route-error"
    };

    const ROUTES = {
        profile: {
            title: "Profil Saya",
            description: "Kelola informasi profil dan akun.",
            icon: "◉",
            items: [
                "Informasi pribadi",
                "Informasi akun",
                "Preferensi pengguna"
            ]
        },

        addresses: {
            title: "Alamat Pengiriman",
            description: "Kelola alamat untuk pengiriman pesanan.",
            icon: "⌖",
            items: [
                "Daftar alamat tersimpan",
                "Alamat utama",
                "Tambah alamat baru"
            ]
        },

        tracking: {
            title: "Lacak Paket",
            description: "Pantau perjalanan paket dan status pengiriman.",
            icon: "➜",
            items: [
                "Status pengiriman",
                "Informasi kurir",
                "Detail perjalanan paket"
            ]
        },

        orders: {
            title: "Pesanan Saya",
            description: "Lihat dan kelola pesananmu.",
            icon: "▤",
            items: [
                "Menunggu pembayaran",
                "Sedang diproses",
                "Dalam pengiriman",
                "Pesanan selesai"
            ]
        },

        spending: {
            title: "Total Belanja",
            description: "Pantau nilai transaksi dan pengeluaran.",
            icon: "◈",
            items: [
                "Total nilai belanja",
                "Ringkasan transaksi",
                "Periode pengeluaran"
            ]
        },

        analytics: {
            title: "Analitik Belanja",
            description: "Pahami kebiasaan dan pola belanjamu.",
            icon: "▥",
            items: [
                "Tren pengeluaran",
                "Kategori favorit",
                "Ringkasan aktivitas"
            ]
        },

        history: {
            title: "Riwayat Transaksi",
            description: "Temukan kembali transaksi sebelumnya.",
            icon: "◷",
            items: [
                "Transaksi terbaru",
                "Riwayat pembayaran",
                "Detail transaksi"
            ]
        },

        calendar: {
            title: "Kalender",
            description: "Lihat agenda dan pengingat penting.",
            icon: "▦",
            items: [
                "Agenda mendatang",
                "Pengingat pesanan",
                "Jadwal aktivitas"
            ]
        },

        catalog: {
            title: "Katalog Produk",
            description: "Jelajahi produk yang tersedia.",
            icon: "▧",
            items: [
                "Semua produk",
                "Kategori produk",
                "Detail produk"
            ]
        },

        wishlist: {
            title: "Wishlist",
            description: "Simpan produk yang ingin kamu beli.",
            icon: "♡",
            items: [
                "Produk tersimpan",
                "Perubahan harga",
                "Pindahkan ke keranjang"
            ]
        },

        reviews: {
            title: "Ulasan Saya",
            description: "Kelola ulasan dan penilaian produk.",
            icon: "☆",
            items: [
                "Ulasan yang sudah dibuat",
                "Produk yang bisa diulas",
                "Riwayat penilaian"
            ]
        },

        promos: {
            title: "Voucher & Promo",
            description: "Temukan promo dan voucher yang tersedia.",
            icon: "％",
            items: [
                "Voucher tersedia",
                "Promo aktif",
                "Riwayat penggunaan voucher"
            ]
        },

        "ai-history": {
            title: "Riwayat Chat AI",
            description: "Temukan kembali percakapan dengan AI.",
            icon: "✧",
            items: [
                "Percakapan sebelumnya",
                "Cari riwayat percakapan",
                "Lanjutkan percakapan"
            ]
        },

        support: {
            title: "Bantuan & Customer Service",
            description: "Dapatkan bantuan untuk kebutuhanmu.",
            icon: "?",
            items: [
                "Pusat bantuan",
                "Hubungi customer service",
                "Status permintaan bantuan"
            ]
        },

        settings: {
            title: "Pengaturan Aplikasi",
            description: "Sesuaikan preferensi penggunaan aplikasi.",
            icon: "⚙",
            items: [
                "Preferensi tampilan",
                "Notifikasi",
                "Pengaturan akun"
            ]
        },

        export: {
            title: "Ekspor Data",
            description: "Kelola dan siapkan data untuk diekspor.",
            icon: "⇩",
            items: [
                "Pilih jenis data",
                "Tentukan periode",
                "Siapkan ekspor"
            ]
        },

        "store-map": {
            title: "Peta Toko",
            description: "Temukan lokasi toko dan titik layanan.",
            icon: "⌖",
            items: [
                "Lokasi toko",
                "Titik layanan",
                "Informasi lokasi"
            ]
        },

        member: {
            title: "Keanggotaan",
            description: "Lihat informasi dan manfaat keanggotaan.",
            icon: "♙",
            items: [
                "Status keanggotaan",
                "Manfaat member",
                "Riwayat keanggotaan"
            ]
        }
    };

    const state = {
        initialized: false,
        isOpen: false,
        activeAction: null,
        previousFocus: null,
        page: null,
        content: null,
        title: null,
        description: null,
        backButton: null
    };

    const handlers = new Map();

    function emit(eventName, detail = {}) {
        window.dispatchEvent(
            new CustomEvent(eventName, {
                detail: detail
            })
        );
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, function (char) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[char];
        });
    }

    /*
     * Mendukung:
     * navigate("orders", { source: "menu" })
     * navigate({ action: "orders", source: "menu" })
     */
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
                    request.featureId ||
                    request.id ||
                    null
            };
        }

        return {
            ...extra,
            action: null
        };
    }

    function getRoute(action) {
        if (!action) {
            return null;
        }

        return ROUTES[action] || null;
    }

    function getRouteList() {
        return Object.keys(ROUTES).map(function (action) {
            return {
                id: action,
                action: action,
                ...ROUTES[action]
            };
        });
    }

    function installStyles() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }

        const style = document.createElement("style");
        style.id = STYLE_ID;

        style.textContent = `
            #${PAGE_ID} {
                position: fixed;
                inset: 0;
                z-index: 1200;
                display: none;
                flex-direction: column;
                overflow: auto;
                width: 100%;
                height: 100%;
                height: 100dvh;
                background: #f6f5f1;
                color: #17202a;
                font-family: inherit;
                overscroll-behavior: contain;
                -webkit-overflow-scrolling: touch;
            }

            #${PAGE_ID}.is-open {
                display: flex;
            }

            #${PAGE_ID} *,
            #${PAGE_ID} *::before,
            #${PAGE_ID} *::after {
                box-sizing: border-box;
            }

            #${PAGE_ID} .kr-topbar {
                position: sticky;
                top: 0;
                z-index: 2;
                display: flex;
                align-items: center;
                gap: 12px;
                min-height: 66px;
                padding: max(12px, env(safe-area-inset-top)) 18px 12px;
                border-bottom: 1px solid #e5e1d8;
                background: #f6f5f1;
            }

            #${PAGE_ID} .kr-back {
                display: grid;
                place-items: center;
                width: 42px;
                height: 42px;
                flex: none;
                border: 1px solid #e5e1d8;
                border-radius: 50%;
                background: #fffefa;
                color: #17202a;
                font: inherit;
                font-size: 22px;
                cursor: pointer;
            }

            #${PAGE_ID} .kr-brand {
                min-width: 0;
                margin: 0;
                font-size: 12px;
                font-weight: 850;
                letter-spacing: .08em;
            }

            #${PAGE_ID} .kr-subbrand {
                margin: 4px 0 0;
                color: #68717a;
                font-size: 10px;
                font-weight: 400;
                letter-spacing: 0;
            }

            #${PAGE_ID} .kr-main {
                width: 100%;
                max-width: 900px;
                margin: 0 auto;
                padding: 26px 16px calc(36px + env(safe-area-inset-bottom));
            }

            #${PAGE_ID} .kr-eyebrow {
                margin: 0 0 9px;
                color: #8a7650;
                font-size: 10px;
                font-weight: 850;
                letter-spacing: .13em;
                text-transform: uppercase;
            }

            #${PAGE_ID} .kr-title {
                margin: 0;
                font-size: clamp(28px, 6vw, 38px);
                line-height: 1.12;
                letter-spacing: -.05em;
                overflow-wrap: anywhere;
            }

            #${PAGE_ID} .kr-description {
                max-width: 600px;
                margin: 12px 0 25px;
                color: #68717a;
                font-size: 13px;
                line-height: 1.7;
            }

            #${PAGE_ID} .kr-panel {
                padding: 17px;
                border: 1px solid #e5e1d8;
                border-radius: 19px;
                background: #fffefa;
            }

            #${PAGE_ID} .kr-panel-heading {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 15px;
            }

            #${PAGE_ID} .kr-icon {
                display: grid;
                place-items: center;
                width: 43px;
                height: 43px;
                flex: none;
                border-radius: 14px;
                background: #f0eee7;
                color: #8a7650;
                font-size: 23px;
            }

            #${PAGE_ID} .kr-panel-title {
                margin: 0;
                font-size: 14px;
                font-weight: 850;
            }

            #${PAGE_ID} .kr-panel-caption {
                margin: 5px 0 0;
                color: #68717a;
                font-size: 11px;
                line-height: 1.5;
            }

            #${PAGE_ID} .kr-items {
                display: grid;
                gap: 9px;
                margin: 0;
                padding: 0;
                list-style: none;
            }

            #${PAGE_ID} .kr-item {
                display: flex;
                align-items: center;
                gap: 10px;
                min-height: 48px;
                padding: 12px;
                border: 1px solid #eeeae2;
                border-radius: 13px;
                background: #fff;
                font-size: 12px;
                line-height: 1.5;
            }

            #${PAGE_ID} .kr-item-marker {
                color: #a4874d;
                font-size: 16px;
            }

            #${PAGE_ID} .kr-notice {
                margin-top: 15px;
                padding: 13px 14px;
                border-radius: 13px;
                background: #f0eee7;
                color: #5f625f;
                font-size: 11px;
                line-height: 1.65;
            }

            #${PAGE_ID} button:focus-visible {
                outline: 2px solid #c49b50;
                outline-offset: 3px;
            }

            @media (min-width: 620px) {
                #${PAGE_ID} .kr-main {
                    padding-right: 26px;
                    padding-left: 26px;
                }

                #${PAGE_ID} .kr-panel {
                    padding: 22px;
                }
            }
        `;

        document.head.appendChild(style);
    }

    function createPage() {
        let page = document.getElementById(PAGE_ID);

        if (page) {
            state.page = page;
            state.content = page.querySelector("[data-kr-content]");
            state.title = page.querySelector("[data-kr-title]");
            state.description = page.querySelector("[data-kr-description]");
            state.backButton = page.querySelector("[data-kr-back]");
            return;
        }

        page = document.createElement("section");
        page.id = PAGE_ID;
        page.setAttribute("aria-label", "Halaman fitur KANTOONG");
        page.setAttribute("aria-hidden", "true");

        page.innerHTML = `
            <header class="kr-topbar">
                <button
                    class="kr-back"
                    type="button"
                    data-kr-back
                    aria-label="Kembali ke menu"
                >←</button>

                <div>
                    <p class="kr-brand">KANTOONG AI</p>
                    <p class="kr-subbrand">Personal Commerce Hub</p>
                </div>
            </header>

            <main class="kr-main" data-kr-content>
                <p class="kr-eyebrow">RUANG FITUR</p>
                <h1 class="kr-title" data-kr-title></h1>
                <p class="kr-description" data-kr-description></p>
                <div data-kr-body></div>
            </main>
        `;

        document.body.appendChild(page);

        state.page = page;
        state.content = page.querySelector("[data-kr-content]");
        state.title = page.querySelector("[data-kr-title]");
        state.description = page.querySelector("[data-kr-description]");
        state.backButton = page.querySelector("[data-kr-back]");

        state.backButton.addEventListener("click", back);

        page.addEventListener("click", function (event) {
            if (event.target === page) {
                back();
            }
        });
    }

    function renderRoute(action, detail = {}) {
        const route = getRoute(action);

        if (!route || !state.page) {
            return false;
        }

        state.title.textContent = route.title;
        state.description.textContent = route.description;

        const body = state.page.querySelector("[data-kr-body]");

        if (!body) {
            return false;
        }

        /*
         * Handler fitur dapat mengambil alih isi halaman.
         * Return true berarti handler mengurus tampilannya.
         */
        const handler = handlers.get(action);

                if (handler) {
            const result = handler({
                ...detail,
                action: action,
                route: { ...route },
                container: body,
                page: state.page
            });

            if (result !== false) {
                return true;
            }
        }

        body.innerHTML = `
            <section class="kr-panel">
                <div class="kr-panel-heading">
                    <span class="kr-icon" aria-hidden="true">${escapeHTML(route.icon)}</span>
                    <div>
                        <h2 class="kr-panel-title">${escapeHTML(route.title)}</h2>
                        <p class="kr-panel-caption">
                            Ruang fitur KANTOONG CORE
                        </p>
                    </div>
                </div>

                <ul class="kr-items">
                    ${route.items.map(function (item) {
                        return `
                            <li class="kr-item">
                                <span class="kr-item-marker" aria-hidden="true">•</span>
                                <span>${escapeHTML(item)}</span>
                            </li>
                        `;
                    }).join("")}
                </ul>

                <div class="kr-notice">
                    Tampilan navigasi sudah tersedia. Data dan tindakan
                    sebenarnya akan dihubungkan ke modul fitur terkait.
                </div>
            </section>
        `;

        return true;
    }

    function navigate(request, extra = {}) {
        const detail = normalizeRequest(request, extra);
        const action = detail.action;

        if (
            typeof action !== "string" ||
            !action.trim()
        ) {
            emit(EVENTS.routeError, {
                reason: "invalid-action",
                request: request
            });

            return false;
        }

        const normalizedAction = action.trim();
        const route = getRoute(normalizedAction);

        if (!route) {
            emit(EVENTS.routeError, {
                action: normalizedAction,
                reason: "route-not-found"
            });

            console.warn(
                MODULE + ": rute tidak ditemukan:",
                normalizedAction
            );

            return false;
        }

        /*
         * Inisialisasi halaman jika belum tersedia.
         */
        init();

        if (!state.page) {
            emit(EVENTS.routeError, {
                action: normalizedAction,
                reason: "page-unavailable"
            });

            return false;
        }

        /*
         * Hindari render ulang apabila menu.js dan controller
         * mengirim action yang sama dalam satu alur klik.
         */
        if (
            state.isOpen &&
            state.activeAction === normalizedAction
        ) {
            return true;
        }

        state.previousFocus = document.activeElement;

        try {
            const rendered = renderRoute(
                normalizedAction,
                detail
            );

            if (!rendered) {
                emit(EVENTS.routeError, {
                    action: normalizedAction,
                    reason: "render-failed"
                });

                return false;
            }

            state.activeAction = normalizedAction;
            state.isOpen = true;

            state.page.classList.add("is-open");
            state.page.setAttribute("aria-hidden", "false");
            document.body.style.overflow = "hidden";

            state.backButton?.focus({
                preventScroll: true
            });

            emit(EVENTS.routeChange, {
                action: normalizedAction,
                title: route.title,
                source: detail.source || "router"
            });

            return true;
        } catch (error) {
            emit(EVENTS.routeError, {
                action: normalizedAction,
                reason: "render-error",
                message: error.message
            });

            console.error(
                MODULE + ": gagal membuka rute.",
                error
            );

            return false;
        }
    }

    function back() {
        if (!state.page || !state.isOpen) {
            return false;
        }

        const previousAction = state.activeAction;

        state.isOpen = false;
        state.activeAction = null;

        state.page.classList.remove("is-open");
        state.page.setAttribute("aria-hidden", "true");

        document.body.style.overflow = "";

        emit(EVENTS.routeBack, {
            previousAction: previousAction
        });

        /*
         * Kembalikan fokus ke elemen sebelumnya jika masih ada.
         * Tidak memaksa membuka menu utama lagi.
         */
        if (
            state.previousFocus instanceof HTMLElement &&
            document.contains(state.previousFocus) &&
            !state.page.contains(state.previousFocus)
        ) {
            state.previousFocus.focus({
                preventScroll: true
            });
        }

        return true;
    }

    function register(action, handler) {
        if (
            typeof action !== "string" ||
            !action.trim()
        ) {
            throw new TypeError(
                MODULE + ": action wajib berupa string."
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

    function unregister(action) {
        return handlers.delete(action);
    }

    function getStatus() {
        return {
            initialized: state.initialized,
            isOpen: state.isOpen,
            activeAction: state.activeAction,
            routeCount: Object.keys(ROUTES).length,
            registeredHandlers: Array.from(handlers.keys())
        };
    }

    /*
     * Kompatibilitas dengan event dari menu pelanggan versi lama.
     */
    function handleFeatureRequest(event) {
        const detail = event && event.detail
            ? event.detail
            : {};

        if (!detail.action) {
            return;
        }

        navigate(detail.action, {
            ...detail,
            source: detail.source || "customer-menu-event"
        });
    }

    /*
     * Terima event navigasi lama hanya jika berisi action
     * yang termasuk rute bisnis. Event inti tanpa action
     * tidak akan memicu perpindahan halaman.
     */
    function handleMenuNavigate(event) {
        const detail = event && event.detail
            ? event.detail
            : {};

        if (
            detail.action &&
            getRoute(detail.action)
        ) {
            navigate(detail.action, {
                ...detail,
                source: detail.source || "menu-event"
            });
        }
    }

    function handleKeydown(event) {
        if (
            event.key === "Escape" &&
            state.isOpen
        ) {
            event.preventDefault();
            back();
        }
    }

    function init() {
        if (state.initialized) {
            return true;
        }

        installStyles();
        createPage();

        window.addEventListener(
            EVENTS.featureRequest,
            handleFeatureRequest
        );

        window.addEventListener(
            EVENTS.navigate,
            handleMenuNavigate
        );

        document.addEventListener(
            "keydown",
            handleKeydown
        );

        state.initialized = true;

        return true;
    }

    const publicAPI = {
        init: init,
        navigate: navigate,
        back: back,
        register: register,
        unregister: unregister,
        getStatus: getStatus,
        getRoutes: getRouteList
    };

    window.KantoongMenuRouter = Object.freeze(publicAPI);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, {
            once: true
        });
    } else {
        init();
    }

    console.info(MODULE + " siap.");

})(window, document);

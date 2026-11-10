/**
 * ============================================================
 * KANTOONG CORE
 * FILE: frontend/dashboard-user/dashboard-user-config.js
 * ============================================================
 *
 * USER DASHBOARD CONFIGURATION
 *
 * Tanggung jawab:
 * 1. Konfigurasi dasar dashboard.
 * 2. Responsive grid: 4 kolom mobile dan 10 kolom desktop.
 * 3. Preset ukuran kartu dan batas resize.
 * 4. Pengaturan mode edit.
 * 5. Konfigurasi pencarian.
 * 6. Konfigurasi Navigation History.
 * 7. Konfigurasi Feature Hub.
 * 8. Konfigurasi tema dan aksesibilitas.
 * 9. Konfigurasi penyimpanan layout.
 *
 * Prinsip KANTOONG CORE:
 * - Konfigurasi dipisahkan dari logika.
 * - Tidak menyimpan API key atau kredensial.
 * - Tidak mengambil data pelanggan.
 * - Tidak mengakses DOM.
 * - Tidak memasang event listener.
 * - Tidak mengunci konfigurasi warna satu klien.
 *
 * File ini hanya mendefinisikan aturan.
 * Implementasi perilakunya dikerjakan modul lain.
 * ============================================================
 */


/* ============================================================
   01. HELPER: DEEP FREEZE
   ============================================================ */

/**
 * Membekukan object beserta object atau array turunannya.
 *
 * Tujuan:
 * Mencegah modul lain tidak sengaja mengubah konfigurasi
 * global saat aplikasi sedang berjalan.
 *
 * @param {object|Array} value
 * @returns {object|Array}
 */
function deepFreeze(value) {
    if (
        value === null ||
        typeof value !== "object" ||
        Object.isFrozen(value)
    ) {
        return value;
    }

    Object.freeze(value);

    for (const key of Object.keys(value)) {
        deepFreeze(value[key]);
    }

    return value;
}


/* ============================================================
   02. DASHBOARD USER CONFIGURATION
   ============================================================ */

export const DASHBOARD_USER_CONFIG = deepFreeze({

    /* --------------------------------------------------------
       A. IDENTITAS MODUL
       -------------------------------------------------------- */

    app: {
        id: "kantoong-dashboard-user",
        name: "KANTOONG User Dashboard",
        version: "1.0.0",
        locale: "id-ID",
        timezoneMode: "user-local",
    },


    /* --------------------------------------------------------
       B. DASHBOARD LAYOUT
       -------------------------------------------------------- */

    layout: {

        /**
         * Mode awal dashboard.
         *
         * view = dashboard normal.
         * edit = pengguna sedang mengatur kartu.
         */
        initialMode: "view",

        /**
         * Breakpoint untuk menentukan jumlah kolom.
         *
         * Sinkron dengan dashboard-user.css.
         */
        breakpoints: {
            mobileMaxWidth: 767,
            tabletMaxWidth: 900,
        },

        /**
         * Jumlah kolom grid.
         *
         * MOBILE:
         * 4 kolom.
         *
         * DESKTOP:
         * 10 kolom.
         *
         * Grid terus bertambah ke bawah.
         */
        columns: {
            mobile: 4,
            tablet: 10,
            desktop: 10,
        },

        /**
         * Grid menggunakan posisi yang dikelola secara eksplisit.
         *
         * autoDense sengaja false:
         * browser tidak boleh memindahkan kartu secara otomatis
         * untuk mengisi lubang kosong di bagian atas.
         *
         * Pengguna bebas meletakkan kartu di tengah, kanan,
         * maupun bagian bawah dashboard.
         */
        placement: {
            strategy: "explicit-grid",
            autoDense: false,
            preserveEmptyCells: true,
            preserveUserPosition: true,
            allowFreeVerticalPlacement: true,
            allowFreeHorizontalPlacement: true,
        },

        /**
         * Aturan perilaku ketika ukuran viewport berubah.
         */
        responsive: {
            enabled: true,

            /**
             * Ketika pindah ke layar yang lebih kecil,
             * kartu tidak boleh melampaui jumlah kolom.
             */
            preventColumnOverflow: true,

            /**
             * Posisi yang tidak cocok pada viewport baru harus
             * disesuaikan oleh layout engine dengan perubahan
             * sekecil mungkin.
             */
            preserveRelativePosition: true,

            /**
             * Jangan menimpa preferensi pengguna hanya karena
             * ukuran viewport berubah.
             */
            preserveSavedLayout: true,
        },

    },


    /* --------------------------------------------------------
       C. GRID CELL SETTINGS
       -------------------------------------------------------- */

    grid: {

        /**
         * Ukuran default sel mengikuti CSS.
         *
         * Angka ini dalam satuan CSS pixel.
         * Tinggi visual aktual dapat menyesuaikan breakpoint.
         */
        rowHeight: {
            mobile: 54,
            tablet: 50,
            desktop: 54,
            wideDesktop: 58,
        },

        gap: {
            mobile: 8,
            tablet: 10,
            desktop: 12,
            wideDesktop: 14,
        },

        /**
         * Wadah grid dapat bertambah tinggi.
         * Tidak ada jumlah baris maksimal secara default.
         */
        rows: {
            dynamic: true,
            minimum: 2,
            maximum: null,
        },

        guide: {
            enabled: true,

            /**
             * Grid guide hanya terlihat pada mode edit.
             */
            showInViewMode: false,
            showInEditMode: true,

            appearance: {
                style: "dashed",
                colorToken: "editGrid",
                handleShape: "square",
            },

            pointerEvents: "none",
        },

    },


    /* --------------------------------------------------------
       D. CARD SIZE CONFIGURATION
       -------------------------------------------------------- */

    cards: {

        /**
         * Kartu baru yang ditambahkan melalui Feature Hub
         * secara default berukuran 2 kolom x 2 baris.
         *
         * width  = jumlah kolom.
         * height = jumlah baris.
         */
        defaultSize: {
            width: 2,
            height: 2,
        },

        /**
         * Batas minimal dan maksimal ukuran kartu.
         *
         * Maksimal lebar mengikuti jumlah kolom viewport.
         * Maksimal tinggi menggunakan batas konfigurasi ini,
         * bukan berarti pengguna wajib membuat kartu setinggi
         * ukuran tersebut.
         */
        constraints: {
            minWidth: 1,
            minHeight: 1,

            maxWidth: {
                mobile: 4,
                tablet: 10,
                desktop: 10,
            },

            maxHeight: 12,

            integerGridUnits: true,
        },

        /**
         * Lima preset tampilan dasar.
         *
         * Preset adalah ukuran awal yang mudah dipilih.
         * Sistem resize tetap boleh menghasilkan ukuran lain
         * selama memenuhi constraints.
         *
         * Catatan:
         * 1 x 1 = tampilan ikon saja.
         */
        presets: [
            {
                id: "icon",
                label: "Ikon",
                width: 1,
                height: 1,
                description: "Kartu minimal untuk ikon fitur.",
            },

            {
                id: "compact",
                label: "Compact",
                width: 2,
                height: 2,
                description: "Kartu ringkas untuk akses fitur.",
            },

            {
                id: "wide",
                label: "Horizontal",
                width: 4,
                height: 2,
                description: "Kartu lebar dengan tinggi ringkas.",
            },

            {
                id: "tall",
                label: "Vertikal",
                width: 2,
                height: 4,
                description: "Kartu tinggi dengan lebar ringkas.",
            },

            {
                id: "large",
                label: "Besar",
                width: 4,
                height: 4,
                description: "Kartu dengan ruang konten lebih luas.",
            },
        ],

        /**
         * Pengaturan tampilan kartu berdasarkan ukuran.
         */
        appearance: {
            iconOnlyWhen: {
                width: 1,
                height: 1,
            },

            showDescription: true,
            showSummary: true,
            showArrow: true,

            /**
             * Modul kartu boleh mengatur kontennya sendiri.
             * Ukuran kartu tidak mengubah identitas fitur.
             */
            retainFeatureIdentityOnResize: true,
        },

        /**
         * Hindari pemindahan kartu lain secara diam-diam.
         */
        collision: {
            allowOverlap: false,

            /**
             * Ketika posisi bertabrakan, layout engine harus
             * menyelesaikannya secara terkontrol.
             */
            resolution: "nearest-valid-position",

            /**
             * Jangan memaksa kartu di bagian bawah berpindah
             * ke atas hanya untuk mengisi ruang kosong.
             */
            preserveUserPlacementPriority: true,
        },

    },


    /* --------------------------------------------------------
       E. EDIT MODE
       -------------------------------------------------------- */

    editMode: {

        enabled: true,

        /**
         * Durasi tekan lama sebelum mode edit dimulai.
         *
         * JavaScript nanti menerapkan durasi ini.
         */
        longPressDurationMs: 550,

        /**
         * Jarak gerak maksimum yang masih dianggap tekan lama.
         *
         * Jika pointer bergerak melampaui batas sebelum durasi
         * tercapai, gesture tidak boleh dianggap long press.
         */
        longPressMovementTolerancePx: 8,

        /**
         * Klik biasa pada mode normal tetap membuka fitur.
         */
        normalClickOpensFeature: true,

        /**
         * Mode edit menampilkan grid dan kontrol.
         */
        showGridGuide: true,
        showDragHandle: true,
        showResizeHandles: true,

        /**
         * Drag dan resize baru dimulai ketika gesture valid.
         */
        drag: {
            enabled: true,
            usePointerEvents: true,
            thresholdPx: 4,
            preserveCardContent: true,
        },

        resize: {
            enabled: true,
            usePointerEvents: true,

            /**
             * Pegangan berbentuk kotak sesuai revisi desain,
             * bukan bulatan hitam.
             */
            handleShape: "square",

            directions: [
                "n",
                "ne",
                "e",
                "se",
                "s",
                "sw",
                "w",
                "nw",
            ],

            snapToGrid: true,
            preserveFeatureIdentity: true,
        },

        /**
         * Perilaku saat keluar dari mode edit.
         */
        exit: {
            hideGridGuide: true,
            hideDragHandle: true,
            hideResizeHandles: true,
            persistLayout: true,
        },

    },


    /* --------------------------------------------------------
       F. LAYOUT PERSISTENCE
       -------------------------------------------------------- */

    persistence: {

        enabled: true,

        /**
         * Versi skema layout.
         *
         * Naikkan versi ketika struktur data layout berubah
         * secara tidak kompatibel.
         */
        schemaVersion: 1,

        /**
         * localStorage cocok sebagai penyimpanan awal untuk
         * preferensi layout di satu browser/perangkat.
         *
         * Sinkronisasi lintas perangkat membutuhkan backend.
         */
        provider: "localStorage",

        keyPrefix: "kantoong:dashboard-user",

        keys: {
            layout: "layout",
            preferences: "preferences",
            featureSelection: "feature-selection",
            navigationHistory: "navigation-history",
        },

        /**
         * Pada tahap implementasi storage, key harus dipisahkan
         * berdasarkan identitas tenant dan pengguna.
         *
         * Jangan menganggap nilai dari frontend sebagai bukti
         * otorisasi untuk mengakses data tenant.
         */
        partitionBy: [
            "tenantId",
            "userId",
        ],

        /**
         * Data layout yang perlu disimpan.
         */
        save: {
            cardId: true,
            width: true,
            height: true,
            x: true,
            y: true,
            order: true,
        },

        restoreOnInitialize: true,

        /**
         * Jika layout tersimpan tidak valid, lakukan validasi
         * dan pemulihan terkontrol daripada merusak dashboard.
         */
        recovery: {
            enabled: true,
            fallbackToDefaultLayout: true,
            preserveValidCards: true,
        },

    },


    /* --------------------------------------------------------
       G. COMMAND CENTER / SEARCH
       -------------------------------------------------------- */

    search: {

        enabled: true,

        placeholder: "Lagi butuh apa? Ketik aja…",

        minimumQueryLength: 1,

        debounceMs: 180,

        suggestions: {
            enabled: true,
            maximumResults: 8,
            showDescription: true,
            showIcon: true,
        },

        keyboard: {
            enabled: true,
            arrowNavigation: true,
            enterToOpen: true,
            escapeToClose: true,
        },

        /**
         * Pencarian semantik membutuhkan layanan pencarian
         * atau AI pada tahap implementasi selanjutnya.
         *
         * Konfigurasi ini menandai kemampuan yang diinginkan;
         * belum menyediakan model AI atau API.
         */
        semanticSearch: {
            enabled: true,
            provider: "adapter",
        },

        voice: {
            enabled: false,
            requiresBrowserSupport: true,
        },

        clearButton: {
            enabled: true,
            hideWhenEmpty: true,
        },

    },


    /* --------------------------------------------------------
       H. NAVIGATION HISTORY
       -------------------------------------------------------- */

    history: {

        enabled: true,

        maximumEntries: 100,

        retentionDays: 7,

        /**
         * Sesuai konsep Navigation Memory:
         * pembersihan berkala pada Minggu pukul 00.00
         * menurut waktu lokal perangkat pengguna.
         *
         * Scheduler pembersihan harus diimplementasikan
         * pada modul JavaScript terkait.
         */
        automaticCleanup: {
            enabled: true,
            weekday: 0,
            time: "00:00",
            timezone: "user-local",
        },

        actions: {
            recordFeatureOpen: true,
            recordSearch: true,
            recordDashboardOpen: true,
            recordLayoutEdit: true,
            recordWishlistAction: true,
        },

        controls: {
            allowRemoveSingleEntry: true,
            allowClearAll: true,
        },

        privacy: {
            showPrivacyNote: true,
            localFirst: true,

            /**
             * Jangan menyatakan data tidak dapat diakses admin
             * jika penyimpanan server belum dirancang untuk itu.
             */
            neverStoreCredentials: true,
            neverStoreSecrets: true,
        },

    },


    /* --------------------------------------------------------
       I. FEATURE HUB
       -------------------------------------------------------- */

    featureHub: {

        enabled: true,

        title: "Feature Hub",

        subtitle: "Pilih atau arsipkan fitur yang kamu inginkan.",

        search: {
            enabled: true,
            placeholder: "Cari fitur...",
        },

        /**
         * Kartu yang baru ditambahkan dimulai dengan ukuran
         * default kartu dashboard.
         */
        newFeatureSize: {
            width: 2,
            height: 2,
        },

        behavior: {
            hideActiveFeatures: true,
            restoreArchivedFeatures: true,
            allowAddFeature: true,
            allowArchiveFeature: true,
        },

        /**
         * Fitur coming soon tetap tidak dapat dipakai sampai
         * dinyatakan tersedia oleh konfigurasi modul.
         */
        publication: {
            respectFeatureAvailability: true,
            disableUnpublishedFeatures: true,
        },

    },


    /* --------------------------------------------------------
       J. THEME
       -------------------------------------------------------- */

    theme: {

        default: "light",

        supported: [
            "light",
            "dark",
        ],

        allowToggle: true,

        /**
         * Nilai di bawah adalah token netral core.
         * Skin klien dapat mengganti token melalui konfigurasi
         * tema terpisah tanpa mengubah logika dashboard.
         */
        tokens: {
            light: {
                background: "#faf9f7",
                surface: "#ffffff",
                text: "#161616",
                border: "#deddda",
            },

            dark: {
                background: "#111111",
                surface: "#1c1c1c",
                text: "#f5f5f5",
                border: "#3b3b3b",
            },
        },

    },


    /* --------------------------------------------------------
       K. ACCESSIBILITY
       -------------------------------------------------------- */

    accessibility: {

        keyboardNavigation: true,

        focusVisible: true,

        reducedMotion: true,

        ariaAnnouncements: true,

        /**
         * Drag-and-drop harus mempertimbangkan navigasi
         * keyboard pada tahap implementasi controller.
         */
        keyboardLayoutControls: true,

    },


    /* --------------------------------------------------------
       L. FEATURE DISCOVERY
       -------------------------------------------------------- */

    featureDiscovery: {

        enabled: true,

        /**
         * Konvensi penemuan modul:
         *
         * Modul fitur akan mengikuti struktur folder
         * yang kita tetapkan sebelum membangun feature-loader.
         *
         * Properti ini hanya konfigurasi deklaratif.
         * Pemindaian file dilakukan oleh modul JavaScript
         * terpisah menggunakan import.meta.glob().
         */
        strategy: "module-discovery",

        automaticRegistration: true,

        /**
         * Sebuah file baru wajib mengikuti kontrak modul.
         * Nama file saja tidak cukup untuk menentukan fungsi
         * atau otorisasi suatu fitur.
         */
        requireFeatureContract: true,

        skipInvalidModules: true,

    },


    /* --------------------------------------------------------
       M. ERROR HANDLING
       -------------------------------------------------------- */

    errors: {

        reportToConsoleInDevelopment: true,

        preventOneFeatureFromBreakingOthers: true,

        featureLoadFailure: {
            showErrorState: true,
            allowRetry: true,
        },

        persistenceFailure: {
            preserveCurrentSession: true,
            showNonBlockingWarning: true,
        },

    },

});


/* ============================================================
   03. HELPER: GRID COLUMN COUNT
   ============================================================ */

/**
 * Menentukan jumlah kolom berdasarkan lebar viewport.
 *
 * @param {number} viewportWidth
 * @returns {number}
 */
export function getDashboardGridColumns(viewportWidth) {
    const width = Number(viewportWidth);

    if (!Number.isFinite(width) || width <= 0) {
        return DASHBOARD_USER_CONFIG.layout.columns.desktop;
    }

    if (
        width <=
        DASHBOARD_USER_CONFIG.layout.breakpoints.mobileMaxWidth
    ) {
        return DASHBOARD_USER_CONFIG.layout.columns.mobile;
    }

    if (
        width <=
        DASHBOARD_USER_CONFIG.layout.breakpoints.tabletMaxWidth
    ) {
        return DASHBOARD_USER_CONFIG.layout.columns.tablet;
    }

    return DASHBOARD_USER_CONFIG.layout.columns.desktop;
}


/* ============================================================
   04. HELPER: GET CARD PRESET
   ============================================================ */

/**
 * Mencari preset ukuran kartu berdasarkan ID.
 *
 * @param {string} presetId
 * @returns {object|null}
 */
export function getDashboardCardPreset(presetId) {
    if (typeof presetId !== "string" || !presetId.trim()) {
        return null;
    }

    return (
        DASHBOARD_USER_CONFIG.cards.presets.find(
            (preset) => preset.id === presetId
        ) ?? null
    );
}


/* ============================================================
   05. HELPER: NORMALIZE CARD SIZE
   ============================================================ */

/**
 * Memastikan ukuran kartu berupa bilangan bulat yang valid,
 * tanpa melampaui batas kolom viewport dan batas tinggi.
 *
 * Fungsi ini memvalidasi ukuran saja.
 * Penentuan posisi, tabrakan antar-kartu, dan pemindahan
 * kartu ditangani oleh layout engine.
 *
 * @param {object} requestedSize
 * @param {number} viewportWidth
 * @returns {{width:number,height:number}}
 */
export function normalizeDashboardCardSize(
    requestedSize = {},
    viewportWidth = 1024
) {
    const columns = getDashboardGridColumns(viewportWidth);

    const constraints =
        DASHBOARD_USER_CONFIG.cards.constraints;

    const requestedWidth = Number(requestedSize.width);
    const requestedHeight = Number(requestedSize.height);

    const safeWidth = Number.isFinite(requestedWidth)
        ? Math.round(requestedWidth)
        : DASHBOARD_USER_CONFIG.cards.defaultSize.width;

    const safeHeight = Number.isFinite(requestedHeight)
        ? Math.round(requestedHeight)
        : DASHBOARD_USER_CONFIG.cards.defaultSize.height;

    const width = Math.min(
        columns,
        constraints.maxWidth[getColumnProfile(viewportWidth)],
        Math.max(constraints.minWidth, safeWidth)
    );

    const height = Math.min(
        constraints.maxHeight,
        Math.max(constraints.minHeight, safeHeight)
    );

    return {
        width,
        height,
    };
}


/**
 * Menentukan profil kolom yang digunakan.
 *
 * @param {number} viewportWidth
 * @returns {"mobile"|"tablet"|"desktop"}
 */
function getColumnProfile(viewportWidth) {
    const width = Number(viewportWidth);

    if (
        !Number.isFinite(width) ||
        width <=
            DASHBOARD_USER_CONFIG.layout.breakpoints.mobileMaxWidth
    ) {
        return "mobile";
    }

    if (
        width <=
        DASHBOARD_USER_CONFIG.layout.breakpoints.tabletMaxWidth
    ) {
        return "tablet";
    }

    return "desktop";
}


/* ============================================================
   06. DEFAULT EXPORT
   ============================================================ */

/**
 * Dapat diimpor dengan:
 *
 * import DASHBOARD_USER_CONFIG
 *     from "./dashboard-user-config.js";
 *
 * atau:
 *
 * import {
 *     DASHBOARD_USER_CONFIG,
 *     getDashboardGridColumns
 * } from "./dashboard-user-config.js";
 */

export default DASHBOARD_USER_CONFIG;


/* ============================================================
   END OF DASHBOARD USER CONFIG
   ============================================================ */
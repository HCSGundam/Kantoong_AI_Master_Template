/**
 * ============================================================
 * KANTOONG CORE
 * FILE: frontend/dashboard-user/dashboard-user-bootstrap.js
 * ============================================================
 *
 * DASHBOARD BOOTSTRAP / CENTRAL CONNECTION
 *
 * Tanggung jawab:
 * 1. Menjadi pintu masuk dashboard.
 * 2. Menginisialisasi controller dashboard.
 * 3. Menginisialisasi event controller.
 * 4. Menemukan modul fitur secara otomatis melalui Vite.
 * 5. Mendaftarkan fitur yang mengikuti kontrak.
 * 6. Menghubungkan konfigurasi brand.
 * 7. Menangani status loading dan error.
 * 8. Menyediakan API lifecycle dashboard.
 * 9. Menyediakan event bridge untuk situs utama.
 * 10. Membersihkan listener ketika modul dihentikan.
 *
 * ALUR:
 *
 * HTML
 *  |
 *  v
 * BOOTSTRAP
 *  |
 *  +--> CONFIG
 *  |
 *  +--> DASHBOARD CONTROLLER
 *  |
 *  +--> EVENT CONTROLLER
 *  |
 *  +--> FEATURE DISCOVERY
 *  |
 *  +--> FEATURE REGISTRATION
 *  |
 *  +--> DASHBOARD READY
 *
 * PENTING:
 * - Penemuan fitur menggunakan Vite import.meta.glob().
 * - Modul fitur mengikuti kontrak index.js.
 * - Tidak ada API key atau credential pada frontend.
 * - Tindakan sensitif tetap harus diotorisasi backend.
 * ============================================================
 */

import {
    DASHBOARD_USER_CONFIG,
} from "./dashboard-user-config.js";

import { mergeWithHubCatalog } from "./feature-hub/feature-hub-bootstrap.js";

import {
    initDashboardUser,
    destroyDashboardUser,

    registerDashboardFeatures,

    applyDashboardBrandConfig,

    setDashboardLoading,
    setDashboardError,

    renderDashboardFeatures,

    getDashboardState,
    recordDashboardHistory,
} from "./dashboard-user.js";

import {
    initDashboardUserEvents,
    destroyDashboardUserEvents,
} from "./dashboard-user-events.js";


/* ============================================================
   01. AUTOMATIC FEATURE DISCOVERY
   ============================================================ */

/**
 * Vite akan menemukan seluruh modul fitur dengan pola:
 *
 * frontend/dashboard-user/features/[nama-fitur]/index.js
 *
 * Contoh struktur:
 *
 * features/
 * ├── profile/
 * │   └── index.js
 * ├── addresses/
 * │   └── index.js
 * ├── orders/
 * │   └── index.js
 * └── wishlist/
 *     └── index.js
 *
 * Saat menambahkan fitur baru, bootstrap tidak perlu
 * diedit selama modul mengikuti kontrak yang ditentukan.
 *
 * import.meta.glob merupakan fitur Vite.
 * Jalankan aplikasi melalui Vite, bukan membuka HTML
 * langsung menggunakan protokol file.
 */

const FEATURE_MODULE_LOADERS = import.meta.glob(
    "./features/**/feature.js"
);


/* ============================================================
   02. BOOTSTRAP LIFECYCLE STATE
   ============================================================ */

const lifecycle = {
    status: "idle",

    promise: null,

    controller: null,

    root: null,

    abortController: null,

    hostCallback: null,

    previousBodyOverflow: null,

    bodyLocked: false,

    readyAt: null,
};


/* ============================================================
   03. GENERAL HELPERS
   ============================================================ */

function isObject(value) {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}


function normalizeString(value, fallback = "") {
    if (typeof value !== "string") {
        return fallback;
    }

    return value.trim();
}


function emitWindowEvent(name, detail = {}) {
    window.dispatchEvent(
        new CustomEvent(name, {
            detail,
        })
    );
}


function emitRootEvent(name, detail = {}) {
    lifecycle.root?.dispatchEvent(
        new CustomEvent(name, {
            bubbles: true,
            detail,
        })
    );
}


/**
 * Mengirim pesan dari Dashboard User ke homepage
 * melalui iframe pada origin yang sama.
 */
function postMessageToParent(payload) {
    if (window.parent === window) {
        return false;
    }

    try {
        window.parent.postMessage(
            payload,
            window.location.origin
        );

        return true;
    } catch (error) {
        logWarning(
            "Gagal mengirim pesan ke homepage.",
            error
        );

        return false;
    }
}

function logInfo(message, details = undefined) {
    if (!import.meta.env.DEV) {
        return;
    }

    if (details === undefined) {
        console.info(`[KANTOONG Bootstrap] ${message}`);
    } else {
        console.info(
            `[KANTOONG Bootstrap] ${message}`,
            details
        );
    }
}


function logWarning(message, details = undefined) {
    if (details === undefined) {
        console.warn(`[KANTOONG Bootstrap] ${message}`);
    } else {
        console.warn(
            `[KANTOONG Bootstrap] ${message}`,
            details
        );
    }
}


/* ============================================================
   04. ROOT VALIDATION
   ============================================================ */

function getDashboardRoot() {
    const root = document.querySelector(
        "[data-dashboard-user-root]"
    );

    if (!root) {
        throw new Error(
            "Elemen dashboard root tidak ditemukan. " +
            "Periksa dashboard-user.html."
        );
    }

    return root;
}


/* ============================================================
   05. HOST PAGE / OVERLAY CONNECTION
   ============================================================ */

/**
 * Mengunci scroll halaman induk saat dashboard berfungsi
 * sebagai overlay layar penuh.
 *
 * Ini hanya mengatur scroll, bukan autentikasi atau izin.
 */

function lockHostBodyScroll() {
    if (lifecycle.bodyLocked) {
        return;
    }

    lifecycle.previousBodyOverflow =
        document.body.style.overflow;

    document.body.style.overflow = "hidden";

    lifecycle.bodyLocked = true;
}


function unlockHostBodyScroll() {
    if (!lifecycle.bodyLocked) {
        return;
    }

    document.body.style.overflow =
        lifecycle.previousBodyOverflow ?? "";

    lifecycle.previousBodyOverflow = null;
    lifecycle.bodyLocked = false;
}


/**
 * Menampilkan dashboard.
 *
 * Event dari situs utama dapat memakai:
 *
 * window.dispatchEvent(
 *   new CustomEvent("kantoong:dashboard-open")
 * );
 */

export function openDashboardUser(options = {}) {
    const root = lifecycle.root;

    if (!root) {
        throw new Error(
            "Dashboard belum diinisialisasi."
        );
    }

    root.dataset.dashboardState = "open";
    root.setAttribute("aria-hidden", "false");

    lockHostBodyScroll();

    if (isObject(options.brand)) {
        applyDashboardBrandConfig(options.brand);
    }

    renderDashboardFeatures();

    recordDashboardHistory({
        type: "dashboard-open",
        title: "Membuka Menu Personal",
    }, {
        deduplicateMilliseconds: 2000,
    });

    emitRootEvent(
        "kantoong:dashboard-opened",
        {
            source: "bootstrap",
        }
    );

    return true;
}


/**
 * Menutup dashboard.
 *
 * Halaman induk dapat mendengarkan:
 *
 * window.addEventListener(
 *   "kantoong:dashboard-host-close-request",
 *   handler
 * );
 */

export function closeDashboardUser({
    notifyHost = true,
} = {}) {
    const root = lifecycle.root;

    if (!root) {
        return false;
    }

    root.dataset.dashboardState = "closed";
    root.setAttribute("aria-hidden", "true");

    unlockHostBodyScroll();

    if (notifyHost) {
        // Pesan ini diterima oleh engine.js pada homepage.
        postMessageToParent({
            type: "kantoong:dashboard-close-request",
            source: "dashboard-user-bootstrap",
        });

        emitWindowEvent(
            "kantoong:dashboard-host-close-request",
            {
                source: "dashboard-user-bootstrap",
            }
        );
    }

    emitRootEvent(
        "kantoong:dashboard-closed",
        {
            source: "bootstrap",
        }
    );

    return true;
}


export function toggleDashboardUser() {
    const root = lifecycle.root;

    if (!root) {
        return false;
    }

    if (root.dataset.dashboardState === "closed") {
        return openDashboardUser();
    }

    return closeDashboardUser();
}


/* ============================================================
   06. BRAND CONFIGURATION
   ============================================================ */

/**
 * Konfigurasi tampilan brand dapat disediakan oleh kode situs
 * utama sebelum dashboard dibuka.
 *
 * Contoh:
 *
 * window.KANTOONG_DASHBOARD_CONFIG = {
 *   brand: {
 *     brandName: "Toko Contoh",
 *     brandSubtitle: "Menu Personal",
 *     welcomeTitle: "Selamat datang",
 *     welcomeMessage: "Apa yang ingin kamu lakukan hari ini?",
 *     footerLabel: "Menu Personal"
 *   }
 * };
 *
 * Konfigurasi ini hanya untuk presentasi.
 * Jangan gunakan nilai dari frontend sebagai bukti identitas,
 * hak akses, atau izin tenant.
 */

function loadExternalBrandConfig() {
    const externalConfig =
        window.KANTOONG_DASHBOARD_CONFIG;

    if (!isObject(externalConfig)) {
        return;
    }

    const brand = isObject(externalConfig.brand)
        ? externalConfig.brand
        : externalConfig;

    applyDashboardBrandConfig(brand);
}


/* ============================================================
   07. FEATURE MODULE CONTRACT
   ============================================================ */

/**
 * Kontrak dasar satu file features/<nama>/index.js:
 *
 * export default {
 *   id: "profile",
 *   title: "Profil",
 *   description: "Kelola profil akunmu",
 *   category: "Akun dan Profil",
 *   icon: "P",
 *   keywords: ["akun", "pengguna"],
 *   defaultActive: true,
 *   available: true,
 *   status: "published",
 *   defaultSize: {
 *     width: 2,
 *     height: 2
 *   },
 *   onOpen: async () => {}
 * };
 *
 * defaultActive harus dinyatakan eksplisit.
 * Jika tidak dinyatakan true, modul tidak otomatis ditambahkan
 * sebagai kartu awal pada dashboard baru.
 *
 * Ini metadata/kontrak modul, bukan pengganti backend.
 */

function extractFeatureDescriptors(moduleNamespace) {
    if (!isObject(moduleNamespace)) {
        return [];
    }

    const collected = [];

    /**
     * Mendukung:
     *
     * export const feature = {...}
     * export const features = [...]
     * export default {...}
     * export default { feature: {...} }
     */

    if (isObject(moduleNamespace.feature)) {
        collected.push(moduleNamespace.feature);
    }

    if (Array.isArray(moduleNamespace.features)) {
        collected.push(...moduleNamespace.features);
    }

    const defaultExport = moduleNamespace.default;

    if (isObject(defaultExport)) {
        if (Array.isArray(defaultExport.features)) {
            collected.push(...defaultExport.features);
        } else if (isObject(defaultExport.feature)) {
            collected.push(defaultExport.feature);
        } else if (
            typeof defaultExport.id === "string"
        ) {
            collected.push(defaultExport);
        }
    }

    /**
     * Hilangkan duplikat lokal berdasarkan ID.
     */

    const unique = new Map();

    for (const descriptor of collected) {
        if (
            !isObject(descriptor) ||
            typeof descriptor.id !== "string"
        ) {
            continue;
        }

        const id = descriptor.id.trim();

        if (!id || unique.has(id)) {
            continue;
        }

        unique.set(id, {
            ...descriptor,

            /**
             * Jangan membuat semua fitur otomatis muncul.
             * Fitur awal harus menyatakan defaultActive: true.
             */
            defaultActive: descriptor.defaultActive === true,
        });
    }

    return [...unique.values()];
}


/* ============================================================
   08. FEATURE DISCOVERY ENGINE
   ============================================================ */

/**
 * Memuat modul fitur yang cocok dengan glob.
 *
 * Promise.allSettled memungkinkan fitur yang gagal dimuat
 * tidak serta-merta membatalkan seluruh proses penemuan modul.
 */

async function discoverFeatureModules() {
    const entries = Object.entries(
        FEATURE_MODULE_LOADERS
    );

    if (entries.length === 0) {
        logInfo(
            "Belum ada modul features/**/index.js."
        );

        return {
            features: [],
            failures: [],
            discoveredFiles: 0,
        };
    }

    const results = await Promise.allSettled(
        entries.map(async ([path, loader]) => {
            const moduleNamespace = await loader();

            return {
                path,
                descriptors: extractFeatureDescriptors(
                    moduleNamespace
                ),
            };
        })
    );

    const featuresById = new Map();
    const failures = [];

    for (let index = 0; index < results.length; index += 1) {
        const result = results[index];

        const [path] = entries[index];

        if (result.status === "rejected") {
            failures.push({
                path,
                error: result.reason,
            });

            logWarning(
                `Gagal memuat modul fitur: ${path}`,
                result.reason
            );

            continue;
        }

        for (const descriptor of result.value.descriptors) {
            if (featuresById.has(descriptor.id)) {
                logWarning(
                    `ID fitur duplikat diabaikan: ${descriptor.id}`,
                    { path }
                );

                continue;
            }

            featuresById.set(
                descriptor.id,
                descriptor
            );
        }

        if (result.value.descriptors.length === 0) {
            logWarning(
                `Modul tidak mengekspor descriptor fitur yang valid: ${path}`
            );
        }
    }

    return {
        features: [...featuresById.values()],
        failures,
        discoveredFiles: entries.length,
    };
}


/* ============================================================
   09. FEATURE REGISTRATION
   ============================================================ */

async function loadAndRegisterFeatures() {
    setDashboardLoading(true);

    const result = await discoverFeatureModules();

    /**
     * Jangan mendaftarkan array kosong.
     *
     * Ini mempertahankan layout mentah yang baru dibaca apabila
     * folder fitur memang belum berisi modul atau seluruh modul
     * gagal dimuat.
     */

    // Gabungkan fitur yang ditemukan dengan rencana katalog: fitur yang
    // belum dibuat otomatis menjadi "Coming soon" di Feature Hub.
    const registrable = mergeWithHubCatalog(result.features);

    if (registrable.length > 0) {
        registerDashboardFeatures(registrable);
    }

    setDashboardLoading(false);

    if (result.failures.length > 0) {
        const message =
            `${result.failures.length} modul fitur gagal dimuat. ` +
            "Fitur lain yang berhasil dimuat tetap dapat digunakan.";

        setDashboardError(message);
    }

    emitRootEvent(
        "kantoong:dashboard-features-discovered",
        {
            count: result.features.length,
            discoveredFiles: result.discoveredFiles,
            failedFiles: result.failures.map(
                (failure) => failure.path
            ),
        }
    );

    logInfo("Feature discovery selesai.", {
        discoveredFiles: result.discoveredFiles,
        registeredFeatures: result.features.length,
        failures: result.failures.length,
    });

    return result;
}


/* ============================================================
   10. HOST EVENT BRIDGE
   ============================================================ */

/**
 * Situs utama dapat membuka dashboard melalui:
 *
 * window.dispatchEvent(
 *   new CustomEvent("kantoong:dashboard-open")
 * );
 *
 * Menutup dashboard:
 *
 * window.dispatchEvent(
 *   new CustomEvent("kantoong:dashboard-close")
 * );
 *
 * Toggle:
 *
 * window.dispatchEvent(
 *   new CustomEvent("kantoong:dashboard-toggle")
 * );
 *
 * Integrasi ini mengirim event di halaman/browser context
 * yang sama. Jika dashboard menjadi halaman terpisah,
 * pembukaan tetap perlu dilakukan melalui navigasi/router.
 */

function setupHostEventBridge() {
    const { signal } = lifecycle.abortController;

    /*
     * A. Pesan dari homepage melalui iframe.
     *
     * Validasi origin dan source wajib dilakukan agar
     * pesan dari halaman lain tidak diterima sembarangan.
     */
    window.addEventListener(
        "message",
        (event) => {
            if (window.parent === window) {
                return;
            }

            if (event.origin !== window.location.origin) {
                return;
            }

            if (event.source !== window.parent) {
                return;
            }

            if (!isObject(event.data)) {
                return;
            }

            const { type, brand } = event.data;

            switch (type) {
                case "kantoong:dashboard-open": {
                    openDashboardUser({
                        brand: isObject(brand)
                            ? brand
                            : undefined,
                    });

                    break;
                }

                case "kantoong:dashboard-close": {
                    // Jangan meminta homepage menutup ulang.
                    closeDashboardUser({
                        notifyHost: false,
                    });

                    break;
                }

                case "kantoong:dashboard-toggle": {
                    toggleDashboardUser();
                    break;
                }

                default:
                    break;
            }
        },
        { signal }
    );


    /*
     * B. CustomEvent lokal.
     *
     * Tetap mendukung halaman yang menggunakan
     * komunikasi event dalam browsing context yang sama.
     */
    window.addEventListener(
        "kantoong:dashboard-open",
        (event) => {
            const detail = event.detail;

            openDashboardUser({
                brand: isObject(detail?.brand)
                    ? detail.brand
                    : undefined,
            });
        },
        { signal }
    );

    window.addEventListener(
        "kantoong:dashboard-close",
        () => {
            closeDashboardUser();
        },
        { signal }
    );

    window.addEventListener(
        "kantoong:dashboard-toggle",
        () => {
            toggleDashboardUser();
        },
        { signal }
    );


    /*
     * C. Tombol tutup di dalam dashboard.
     *
     * dashboard-user-events.js mengirim event ini melalui
     * root dashboard ketika pengguna menekan tombol tutup.
     */
    lifecycle.root.addEventListener(
        "kantoong:dashboard-close-request",
        (event) => {
            closeDashboardUser({
                notifyHost: true,
            });

            if (
                typeof lifecycle.hostCallback === "function"
            ) {
                lifecycle.hostCallback(
                    event.detail ?? {}
                );
            }
        },
        { signal }
    );
}


/* ============================================================
   11. BOOTSTRAP ERROR HANDLING
   ============================================================ */

function showBootstrapError(error) {
    console.error(
        "[KANTOONG Bootstrap] Dashboard initialization failed:",
        error
    );

    // Pemuat ditutup agar pesan error & tombol "Coba lagi" terlihat.
    document.documentElement.dataset.dashReady = "1";

    const root = document.querySelector(
        "[data-dashboard-user-root]"
    );

    /*
     * Tampilkan area dashboard agar pesan error bisa terlihat
     * apabila dokumen dashboard memang sedang ditampilkan.
     */
    if (root) {
        root.dataset.dashboardState = "open";

        root.setAttribute(
            "aria-hidden",
            "false"
        );
    }

    const errorPanel = root?.querySelector(
        "[data-feature-error]"
    );

    const errorMessage = root?.querySelector(
        "[data-feature-error-message]"
    );

    /*
     * Tampilkan pesan yang aman bagi pengguna.
     * Detail teknis tetap tersedia di Console browser.
     */
    if (errorMessage) {
        errorMessage.textContent =
            "Dashboard tidak berhasil diinisialisasi. " +
            "Silakan coba lagi atau periksa Console browser.";
    }

    if (errorPanel) {
        errorPanel.hidden = false;
    }

    /*
     * Beri tahu homepage bahwa bootstrap gagal.
     * Pesan dikirim melalui iframe apabila dashboard
     * sedang berjalan di dalam iframe.
     */
    postMessageToParent({
        type: "kantoong:dashboard-bootstrap-error",

        message: error instanceof Error
            ? error.message
            : "Unknown dashboard bootstrap error",
    });

    /*
     * Beri tahu listener lokal jika ada.
     */
    emitWindowEvent(
        "kantoong:dashboard-bootstrap-error",
        {
            message: error instanceof Error
                ? error.message
                : "Unknown dashboard bootstrap error",
        }
    );
}


/* ============================================================
   12. BOOTSTRAP MAIN
   ============================================================ */

async function runBootstrap(options = {}) {
    lifecycle.status = "initializing";

    try {
        /*
         * STEP 1
         * Pastikan DOM dashboard memang ada.
         */

        lifecycle.root = getDashboardRoot();

        lifecycle.abortController =
            new AbortController();

        /*
        * Jika halaman berjalan di dalam iframe homepage,
        * sembunyikan dashboard sampai menerima perintah open.
        *
        * Jika dibuka langsung sebagai halaman tersendiri,
        * dashboard tetap dapat ditampilkan.
        */
        if (window.parent !== window) {
            lifecycle.root.dataset.dashboardState = "closed";

            lifecycle.root.setAttribute(
                "aria-hidden",
                "true"
            );
        } else {
            lifecycle.root.dataset.dashboardState = "open";

            lifecycle.root.setAttribute(
                "aria-hidden",
                "false"
            );
        }

        lifecycle.hostCallback =
            typeof options.onClose === "function"
                ? options.onClose
                : null;


        /*
         * STEP 2
         * Inisialisasi controller terlebih dahulu.
         *
         * Controller mengumpulkan elemen DOM dan memuat
         * preferensi lokal.
         */

        lifecycle.controller = initDashboardUser();


        /*
         * STEP 3
         * Pasang event listener.
         *
         * Handler siap sebelum feature modules didaftarkan.
         */

        initDashboardUserEvents();


        /*
         * STEP 4
         * Terapkan konfigurasi brand jika tersedia.
         */

        loadExternalBrandConfig();


        /*
         * STEP 5
         * Hubungkan event dari situs utama.
         */

        setupHostEventBridge();


        /*
         * STEP 6
         * Temukan dan daftarkan fitur secara otomatis.
         */

        const discovery = await loadAndRegisterFeatures();


        /*
         * STEP 7
         * Render ulang agar katalog terbaru digunakan.
         */

        renderDashboardFeatures();
        document.documentElement.dataset.dashReady = "1";


        /*
         * STEP 8
         * Sinkronkan status awal dashboard.
         */

        const state = getDashboardState();

        const rootState =
            lifecycle.root.dataset.dashboardState;

        if (rootState === "closed") {
            lifecycle.root.setAttribute(
                "aria-hidden",
                "true"
            );

            unlockHostBodyScroll();
        } else {
            lifecycle.root.setAttribute(
                "aria-hidden",
                "false"
            );

            lockHostBodyScroll();
        }


        /*
         * STEP 9
         * Umumkan bahwa bootstrap selesai.
         */

        lifecycle.status = "ready";
        lifecycle.readyAt = new Date().toISOString();

        const result = {
            status: lifecycle.status,
            readyAt: lifecycle.readyAt,

            featureCount:
                discovery.features.length,

            failedFeatureModules:
                discovery.failures.length,

            dashboardState: state,
        };

        // Beri tahu homepage bahwa bootstrap dashboard selesai.
        postMessageToParent({
            type: "kantoong:dashboard-ready",
            readyAt: lifecycle.readyAt,
            featureCount: discovery.features.length,
            failedFeatureModules: discovery.failures.length,
        });

        emitRootEvent(
            "kantoong:dashboard-ready",
            result
        );

        emitWindowEvent(
            "kantoong:dashboard-ready",
            result
        );

        logInfo("Dashboard berhasil diinisialisasi.", result);

        return result;

    } catch (error) {
        lifecycle.status = "error";

        showBootstrapError(error);

        throw error;
    }
}


/* ============================================================
   13. PUBLIC BOOTSTRAP API
   ============================================================ */

/**
 * Dapat dipanggil secara manual jika diperlukan.
 *
 * Secara default file ini juga menjalankan bootstrap
 * otomatis ketika modul dimuat oleh HTML.
 */

export function bootstrapDashboardUser(options = {}) {
    if (lifecycle.status === "ready") {
        return Promise.resolve({
            status: lifecycle.status,
            readyAt: lifecycle.readyAt,
            dashboardState: getDashboardState(),
        });
    }

    if (lifecycle.promise) {
        return lifecycle.promise;
    }

    lifecycle.promise = runBootstrap(options)
        .catch((error) => {
            lifecycle.promise = null;

            throw error;
        });

    return lifecycle.promise;
}


/**
 * Status bootstrap untuk pemeriksaan atau debugging.
 */

export function getDashboardBootstrapStatus() {
    return {
        status: lifecycle.status,
        readyAt: lifecycle.readyAt,
        featureModuleCount:
            Object.keys(FEATURE_MODULE_LOADERS).length,
    };
}


/**
 * Menghentikan listener dan lifecycle dashboard.
 */

export function destroyDashboardBootstrap() {
    destroyDashboardUserEvents();
    destroyDashboardUser();

    lifecycle.abortController?.abort();
    lifecycle.abortController = null;

    unlockHostBodyScroll();

    lifecycle.status = "idle";
    lifecycle.promise = null;
    lifecycle.controller = null;
    lifecycle.root = null;
    lifecycle.hostCallback = null;
    lifecycle.readyAt = null;
}


/* ============================================================
   14. AUTOMATIC STARTUP
   ============================================================ */

/**
 * Karena HTML memuat file ini sebagai:
 *
 * <script type="module"
 *         src="./dashboard-user-bootstrap.js"></script>
 *
 * bootstrap dijalankan otomatis.
 */

function startAutomatically() {
    bootstrapDashboardUser().catch(() => {
        /*
         * Error sudah ditangani oleh showBootstrapError().
         * Promise tetap ditangkap agar tidak menjadi
         * unhandled rejection.
         */
    });
}


if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        startAutomatically,
        { once: true }
    );
} else {
    startAutomatically();
}


/* ============================================================
   15. VITE HOT MODULE REPLACEMENT
   ============================================================ */

/**
 * Saat mengembangkan aplikasi dengan Vite, perubahan modul
 * dapat memicu HMR.
 *
 * Bersihkan listener lama sebelum modul dilepas.
 */

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        destroyDashboardBootstrap();
    });
}


/* ============================================================
   END OF DASHBOARD USER BOOTSTRAP
   ============================================================ */
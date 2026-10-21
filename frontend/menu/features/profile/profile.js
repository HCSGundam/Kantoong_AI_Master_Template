
/* =========================================================
   KANTOONG CORE
   Feature : Profile & Account Center
   File    : profile.js
   Phase   : 1/3 — Core, State, Helpers & Profile Layout
   ========================================================= */

(function (window, document) {
    "use strict";

    // ---------------------------------------------------------
    // 1. Hindari inisialisasi global berulang
    // ---------------------------------------------------------

    if (window.KantoongProfile) {
        console.info("[Kantoong Profile] Modul sudah terdaftar.");
        return;
    }

    const MODULE_NAME = "KantoongProfile";
    const MODULE_VERSION = "1.0.0";

    const EVENTS = {
        OPEN: "kantoong:profile-open",
        CLOSE: "kantoong:profile-close",
        UPDATED: "kantoong:profile-updated",
        AUTH_CHANGED: "kantoong:profile-auth-changed",
        LOGIN_REQUEST: "kantoong:profile-login-request",
        LOGOUT_REQUEST: "kantoong:profile-logout-request",
        DELETE_REQUEST: "kantoong:profile-delete-request",
        ACTIVITY_OPEN: "kantoong:profile-activity-open"
    };

    const CONFIG = {
        appName: "KANTOONG",
        defaultInitial: "P",
        defaultName: "Pengguna Kantoong",
        defaultUsername: "@pengguna",
        mountSelector: "#dynamicComponentContainer",
        storagePrefix: "kantoong_profile_",

        // true hanya untuk mode UI lokal.
        // Tidak berarti pengguna sudah terautentikasi.
        demoMode: true,

        // Jangan menyimpan password atau token autentikasi
        // di localStorage melalui modul profil ini.
        enablePublicProfile: true,
        enableSocialStats: true,
        enableAccountDeletion: true,

        authProviders: [
            {
                id: "google",
                label: "Google",
                enabled: true
            },
            {
                id: "microsoft",
                label: "Microsoft",
                enabled: true
            },
            {
                id: "apple",
                label: "Apple",
                enabled: true
            }
        ]
    };

    // ---------------------------------------------------------
    // 2. Helper DOM, event, dan sanitasi
    // ---------------------------------------------------------

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

    const safeText = (value, fallback = "") => {
        const text = String(value ?? "").trim();
        return text || fallback;
    };

    const safeInitial = (value) => {
        const name = safeText(value, CONFIG.defaultInitial);
        return Array.from(name)[0].toUpperCase();
    };

    const formatNumber = (value) =>
        new Intl.NumberFormat("id-ID", {
            notation: "compact",
            maximumFractionDigits: 1
        }).format(Math.max(0, Number(value) || 0));

    const formatDate = (value) => {
        if (!value) return "Belum tersedia";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Belum tersedia";
        }

        return new Intl.DateTimeFormat("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric"
        }).format(date);
    };

    const readStorage = (key, fallback = null) => {
        try {
            const value = localStorage.getItem(
                CONFIG.storagePrefix + key
            );

            return value === null ? fallback : JSON.parse(value);
        } catch {
            return fallback;
        }
    };

    const writeStorage = (key, value) => {
        try {
            localStorage.setItem(
                CONFIG.storagePrefix + key,
                JSON.stringify(value)
            );
            return true;
        } catch {
            return false;
        }
    };

    const removeStorage = (key) => {
        try {
            localStorage.removeItem(
                CONFIG.storagePrefix + key
            );
            return true;
        } catch {
            return false;
        }
    };

    const icon = (name, size = 20) => {
        const paths = {
            user: '<circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
            edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/>',
            camera: '<path d="M14 4h-4L8 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-4Z"/><circle cx="12" cy="13" r="3"/>',
            heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
            video: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3Z"/>',
            star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
            settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.5 2.6-1.7-.6a8 8 0 0 1-1.6.9l-.3 1.9h-3l-.3-1.9a8 8 0 0 1-1.6-.9l-1.7.6-1.5-2.6 1.4-1.1a8 8 0 0 1 0-1.9L5.7 12l1.5-2.6 1.7.6a8 8 0 0 1 1.6-.9l.3-1.9h3l.3 1.9a8 8 0 0 1 1.6.9l1.7-.6 1.5 2.6-1.4 1.1a8 8 0 0 1-.1 1.9Z"/>',
            shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
            lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
            chevron: '<path d="m9 18 6-6-6-6"/>',
            logout: '<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/>',
            trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/>',
            mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
            globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z"/>',
            plus: '<path d="M12 5v14M5 12h14"/>'
        };

        const content = paths[name] || paths.user;

        return `
            <svg
                width="${size}"
                height="${size}"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                focusable="false"
            >${content}</svg>`;
    };

    // ---------------------------------------------------------
    // 3. State utama profil
    // ---------------------------------------------------------

    const defaultUser = {
        id: null,
        fullName: CONFIG.defaultName,
        username: CONFIG.defaultUsername,
        email: "",
        phone: "",
        bio: "Ceritakan sedikit tentang dirimu.",
        avatarUrl: "",
        initial: CONFIG.defaultInitial,
        joinedAt: null,
        location: "",
        website: "",
        isVerified: false,
        isPublic: true,

        stats: {
            followers: 0,
            following: 0,
            likes: 0,
            reviews: 0,
            videos: 0,
            views: 0
        },

        providers: {
            email: false,
            google: false,
            microsoft: false,
            apple: false
        }
    };

    const state = {
        mounted: false,
        root: null,
        activeTab: "overview",
        activeDialog: null,
        isEditing: false,
        isLoading: false,
        isAuthenticated: false,
        authProvider: null,
        user: { ...defaultUser },
        activities: [],
        savedItems: [],
        notifications: [],
        blockedUsers: [],
        lastError: null
    };

    // ---------------------------------------------------------
    // 4. Membaca data profil lokal untuk pratinjau
    // ---------------------------------------------------------

    function loadLocalProfile() {
        const saved = readStorage("public_profile", {});

        if (!saved || typeof saved !== "object") {
            state.user = { ...defaultUser };
            return state.user;
        }

        state.user = {
            ...defaultUser,
            ...saved,
            stats: {
                ...defaultUser.stats,
                ...(saved.stats || {})
            },
            providers: {
                ...defaultUser.providers,
                ...(saved.providers || {})
            }
        };

        state.user.initial = safeInitial(
            state.user.fullName
        );

        return state.user;
    }

    function saveLocalProfile(patch = {}) {
        const next = {
            ...state.user,
            ...patch,
            stats: {
                ...state.user.stats,
                ...(patch.stats || {})
            },
            providers: {
                ...state.user.providers,
                ...(patch.providers || {})
            }
        };

        next.initial = safeInitial(next.fullName);

        // Hanya untuk preferensi/profil UI lokal.
        // Bukan penyimpanan identitas autentikasi resmi.
        const ok = writeStorage("public_profile", next);

        if (ok) {
            state.user = next;

            emit(EVENTS.UPDATED, {
                user: { ...state.user }
            });
        }

        return ok;
    }

    // ---------------------------------------------------------
    // 5. Komponen avatar
    // ---------------------------------------------------------

    function renderAvatar(user = state.user, size = "large") {
        const name = safeText(
            user.fullName,
            CONFIG.defaultName
        );

        const initial = safeInitial(name);
        const avatar = safeText(user.avatarUrl, "");

        return `
            <div
                class="kp-avatar kp-avatar--${escapeHTML(size)}"
                data-profile-avatar
                aria-label="Foto profil ${escapeHTML(name)}"
                role="img"
            >
                ${
                    avatar
                        ? `<img
                            src="${escapeHTML(avatar)}"
                            alt=""
                            loading="lazy"
                            referrerpolicy="no-referrer"
                        >`
                        : `<span class="kp-avatar__initial">${escapeHTML(initial)}</span>`
                }
                <span class="kp-avatar__status" aria-hidden="true"></span>
            </div>`;
    }

    // ---------------------------------------------------------
    // 6. Statistik profil
    // ---------------------------------------------------------

    function renderStat(value, label, action) {
        return `
            <button
                class="kp-stat"
                type="button"
                data-profile-action="${escapeHTML(action)}"
            >
                <strong>${escapeHTML(formatNumber(value))}</strong>
                <span>${escapeHTML(label)}</span>
            </button>`;
    }

    function renderStats(user = state.user) {
        if (!CONFIG.enableSocialStats) return "";

        const stats = user.stats || defaultUser.stats;

        return `
            <div class="kp-stats" aria-label="Statistik profil">
                ${renderStat(stats.followers, "Pengikut", "followers")}
                ${renderStat(stats.following, "Mengikuti", "following")}
                ${renderStat(stats.likes, "Suka", "likes")}
                ${renderStat(stats.reviews, "Ulasan", "reviews")}
                ${renderStat(stats.videos, "Video", "videos")}
            </div>`;
    }

    // ---------------------------------------------------------
    // 7. Kartu navigasi profil
    // ---------------------------------------------------------

    function renderNavigationItem({
        iconName,
        title,
        description,
        action,
        badge = ""
    }) {
        return `
            <button
                class="kp-nav-item"
                type="button"
                data-profile-action="${escapeHTML(action)}"
            >
                <span class="kp-nav-item__icon">
                    ${icon(iconName, 20)}
                </span>

                <span class="kp-nav-item__copy">
                    <strong>${escapeHTML(title)}</strong>
                    <small>${escapeHTML(description)}</small>
                </span>

                ${
                    badge
                        ? `<span class="kp-nav-item__badge">${escapeHTML(badge)}</span>`
                        : ""
                }

                <span class="kp-nav-item__arrow">
                    ${icon("chevron", 18)}
                </span>
            </button>`;
    }

    // ---------------------------------------------------------
    // 8. Layout utama profil
    // ---------------------------------------------------------

    function renderProfileShell() {
        const user = state.user;
        const displayName = safeText(
            user.fullName,
            CONFIG.defaultName
        );

        return `
            <section
                class="kp-root"
                data-kantoong-profile
                aria-label="Pusat profil KANTOONG"
            >
                <header class="kp-header">
                    <div class="kp-header__brand">
                        <span class="kp-brand-mark">K</span>

                        <div>
                            <strong>KANTOONG</strong>
                            <small>Account Center</small>
                        </div>
                    </div>

                    <button
                        class="kp-icon-button"
                        type="button"
                        data-profile-action="close"
                        aria-label="Tutup profil"
                        title="Tutup"
                    >
                        <span aria-hidden="true">×</span>
                    </button>
                </header>

                <main class="kp-main">
                    <div class="kp-breadcrumb">
                        <span>Akun</span>
                        <span aria-hidden="true">/</span>
                        <strong>Profil saya</strong>
                    </div>

                    <section class="kp-profile-hero">
                        <div class="kp-profile-hero__top">
                            ${renderAvatar(user, "large")}

                            <button
                                class="kp-avatar-edit"
                                type="button"
                                data-profile-action="change-avatar"
                                aria-label="Ganti foto profil"
                                title="Ganti foto profil"
                            >
                                ${icon("camera", 17)}
                            </button>
                        </div>

                        <div class="kp-profile-identity">
                            <div class="kp-profile-name-row">
                                <h1>${escapeHTML(displayName)}</h1>

                                ${
                                    user.isVerified
                                        ? `<span class="kp-verified" title="Terverifikasi">✓</span>`
                                        : ""
                                }
                            </div>

                            <p class="kp-username">
                                ${escapeHTML(safeText(user.username, CONFIG.defaultUsername))}
                            </p>

                            <p class="kp-bio">
                                ${escapeHTML(safeText(user.bio, "Belum ada bio."))}
                            </p>

                            <div class="kp-profile-meta">
                                ${
                                    user.email
                                        ? `<span>${icon("mail", 15)} ${escapeHTML(user.email)}</span>`
                                        : ""
                                }

                                ${
                                    user.joinedAt
                                        ? `<span>${icon("user", 15)} Bergabung ${escapeHTML(formatDate(user.joinedAt))}</span>`
                                        : ""
                                }
                            </div>
                        </div>

                        <div class="kp-profile-actions">
                            <button
                                class="kp-button kp-button--primary"
                                type="button"
                                data-profile-action="edit-profile"
                            >
                                ${icon("edit", 17)}
                                Edit profil
                            </button>

                            <button
                                class="kp-button kp-button--secondary"
                                type="button"
                                data-profile-action="view-public"
                            >
                                ${icon("globe", 17)}
                                Lihat profil publik
                            </button>
                        </div>

                        ${renderStats(user)}
                    </section>

                    <div class="kp-content-grid">
                        <section class="kp-panel kp-panel--main">
                            <div class="kp-section-heading">
                                <div>
                                    <h2>Aktivitas saya</h2>
                                    <p>Semua aktivitas dan kontribusimu.</p>
                                </div>

                                <button
                                    class="kp-text-button"
                                    type="button"
                                    data-profile-action="all-activity"
                                >
                                    Lihat semua
                                </button>
                            </div>

                            <div class="kp-activity-tabs" role="tablist">
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected="true"
                                    class="is-active"
                                    data-profile-tab="overview"
                                >Ringkasan</button>

                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected="false"
                                    data-profile-tab="reviews"
                                >Ulasan</button>

                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected="false"
                                    data-profile-tab="videos"
                                >Video</button>

                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected="false"
                                    data-profile-tab="likes"
                                >Disukai</button>
                            </div>

                            <div
                                class="kp-activity-content"
                                data-profile-activity-content
                            >
                                <div class="kp-empty-state">
                                    <span class="kp-empty-state__icon">
                                        ${icon("star", 25)}
                                    </span>

                                    <h3>Aktivitasmu dimulai di sini</h3>

                                    <p>
                                        Ulasan, video, suka, dan kontribusimu
                                        akan tampil di bagian ini setelah
                                        fitur aktivitas terhubung.
                                    </p>
                                </div>
                            </div>
                        </section>

                        <aside class="kp-sidebar">
                            <section class="kp-panel">
                                <div class="kp-section-heading">
                                    <div>
                                        <h2>Akun saya</h2>
                                        <p>Kelola identitas dan preferensi.</p>
                                    </div>
                                </div>

                                <nav class="kp-nav-list" aria-label="Pengaturan akun">
                                    ${renderNavigationItem({
                                        iconName: "user",
                                        title: "Informasi pribadi",
                                        description: "Nama, bio, foto, dan kontak",
                                        action: "edit-profile"
                                    })}

                                    ${renderNavigationItem({
                                        iconName: "lock",
                                        title: "Login & keamanan",
                                        description: "Password dan metode login",
                                        action: "security"
                                    })}

                                    ${renderNavigationItem({
                                        iconName: "shield",
                                        title: "Privasi akun",
                                        description: "Profil publik dan visibilitas",
                                        action: "privacy"
                                    })}

                                    ${renderNavigationItem({
                                        iconName: "settings",
                                        title: "Preferensi",
                                        description: "Pengaturan pengalaman aplikasi",
                                        action: "preferences"
                                    })}
                                </nav>
                            </section>

                            <section class="kp-panel kp-account-status">
                                <span class="kp-account-status__icon">
                                    ${icon("shield", 22)}
                                </span>

                                <div>
                                    <h3>Status akun</h3>

                                    <p data-profile-auth-status>
                                        ${
                                            state.isAuthenticated
                                                ? "Terhubung dengan sesi akun."
                                                : "Pratinjau profil — belum login."
                                        }
                                    </p>

                                    <button
                                        type="button"
                                        class="kp-text-button"
                                        data-profile-action="login"
                                    >
                                        ${
                                            state.isAuthenticated
                                                ? "Kelola sesi"
                                                : "Login atau buat akun"
                                        }
                                        →
                                    </button>
                                </div>
                            </section>
                        </aside>
                    </div>

                    <footer class="kp-footer">
                        <span>KANTOONG Account Center</span>
                        <span>Versi ${MODULE_VERSION}</span>
                    </footer>
                </main>

                <div
                    class="kp-dialog-host"
                    data-profile-dialog-host
                ></div>

                <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    data-profile-avatar-input
                    aria-label="Pilih foto profil"
                >
            </section>`;
    }
 
    // ---------------------------------------------------------
    // 9. AUTHENTICATION — LOGIN, REGISTER & OAUTH
    // ---------------------------------------------------------

    const AUTH_CONFIG = {
        // Samakan dengan URL halaman utama aplikasimu.
        // Ganti jika proyek memakai halaman callback khusus.
        redirectTo: window.location.origin + window.location.pathname,

        // Email confirmation mengikuti konfigurasi Supabase.
        requireEmailConfirmation: true,

        // Batas panjang input agar form tetap terkendali.
        maxEmailLength: 254,
        maxPasswordLength: 128,
        minPasswordLength: 8
    };

    const authState = {
        mode: "login",
        busy: false,
        message: "",
        messageType: "info",
        pendingProvider: null
    };

    // Referensi client Supabase boleh disediakan oleh integrasi
    // aplikasi. Jika tidak tersedia, login menampilkan pesan
    // konfigurasi, bukan berpura-pura berhasil.
    function getSupabaseAuth() {
        const client =
            window.KantoongSupabase ||
            window.supabaseClient ||
            window.kantoongSupabaseClient;

        if (client && client.auth) {
            return client.auth;
        }

        return null;
    }

    function setAuthMessage(message, type = "info") {
        authState.message = message;
        authState.messageType = type;

        const box = $("[data-profile-auth-message]", state.root);
        if (!box) return;

        box.textContent = message;
        box.dataset.type = type;
        box.hidden = !message;
    }

    function setAuthBusy(busy) {
        authState.busy = Boolean(busy);

        const form = $("[data-profile-auth-form]", state.root);
        if (!form) return;

        form.querySelectorAll(
            "button[type='submit'], button[data-auth-provider]"
        ).forEach((button) => {
            button.disabled = authState.busy;
            button.setAttribute(
                "aria-busy",
                String(authState.busy)
            );
        });

        const submit = form.querySelector(
            "button[type='submit']"
        );

        if (submit) {
            submit.textContent = authState.busy
                ? "Memproses..."
                : (
                    authState.mode === "register"
                        ? "Buat akun"
                        : authState.mode === "reset"
                            ? "Kirim tautan pemulihan"
                            : "Masuk"
                );
        }
    }

    function validateEmail(email) {
        const value = String(email || "").trim();

        if (!value || value.length > AUTH_CONFIG.maxEmailLength) {
            return {
                valid: false,
                message: "Masukkan alamat email yang valid."
            };
        }

        const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!pattern.test(value)) {
            return {
                valid: false,
                message: "Format email belum benar."
            };
        }

        return {
            valid: true,
            value: value.toLowerCase()
        };
    }

    function validatePassword(password, mode = "login") {
        const value = String(password || "");

        if (value.length > AUTH_CONFIG.maxPasswordLength) {
            return {
                valid: false,
                message: "Password terlalu panjang."
            };
        }

        if (
            mode !== "login" &&
            value.length < AUTH_CONFIG.minPasswordLength
        ) {
            return {
                valid: false,
                message: "Gunakan password minimal 8 karakter."
            };
        }

        if (!value) {
            return {
                valid: false,
                message: "Password wajib diisi."
            };
        }

        return { valid: true, value };
    }

    function normalizeAuthError(error, mode) {
        const message = String(error?.message || "").toLowerCase();

        if (
            message.includes("invalid login credentials") ||
            message.includes("invalid credentials")
        ) {
            return "Email atau password tidak sesuai.";
        }

        if (
            message.includes("email not confirmed") ||
            message.includes("email_not_confirmed")
        ) {
            return "Email belum diverifikasi. Periksa kotak masuk emailmu.";
        }

        if (
            message.includes("user already registered") ||
            message.includes("already registered")
        ) {
            return "Email ini mungkin sudah terdaftar. Coba login.";
        }

        if (
            message.includes("password should be") ||
            message.includes("weak password")
        ) {
            return "Password belum memenuhi persyaratan keamanan.";
        }

        if (
            message.includes("rate limit") ||
            message.includes("too many requests")
        ) {
            return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
        }

        if (mode === "reset") {
            // Hindari membocorkan apakah suatu email terdaftar.
            return "Jika email tersebut terdaftar, instruksi pemulihan akan dikirim.";
        }

        return "Autentikasi belum berhasil. Periksa koneksi dan coba lagi.";
    }

    // ---------------------------------------------------------
    // 10. TAMPILAN LOGIN
    // ---------------------------------------------------------

    function renderAuthDialog(mode = "login") {
        authState.mode = mode;
        authState.message = "";
        authState.messageType = "info";

        const host = $("[data-profile-dialog-host]", state.root);
        if (!host) return;

        const isRegister = mode === "register";
        const isReset = mode === "reset";

        const title = isRegister
            ? "Buat akun KANTOONG"
            : isReset
                ? "Pulihkan akunmu"
                : "Selamat datang kembali";

        const subtitle = isRegister
            ? "Satu akun untuk seluruh pengalaman KANTOONG."
            : isReset
                ? "Kami akan membantumu mengatur ulang password."
                : "Masuk untuk melanjutkan pengalamanmu.";

        const providers = CONFIG.authProviders
            .filter((provider) => provider.enabled)
            .map((provider) => {
                const labels = {
                    google: "Lanjutkan dengan Google",
                    microsoft: "Lanjutkan dengan Microsoft",
                    apple: "Lanjutkan dengan Apple"
                };

                return `
                    <button
                        class="kp-auth-provider kp-auth-provider--${provider.id}"
                        type="button"
                        data-auth-provider="${provider.id}"
                    >
                        <span class="kp-auth-provider__mark" aria-hidden="true">
                            ${provider.id === "google" ? "G" :
                              provider.id === "microsoft" ? "⊞" : "●"}
                        </span>
                        ${labels[provider.id]}
                    </button>`;
            }).join("");

        host.innerHTML = `
            <div class="kp-dialog-backdrop" data-auth-backdrop>
                <section
                    class="kp-auth-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="kpAuthTitle"
                >
                    <button
                        type="button"
                        class="kp-icon-button kp-auth-close"
                        data-profile-action="close-dialog"
                        aria-label="Tutup dialog"
                    >×</button>

                    <div class="kp-auth-brand">
                        <span class="kp-brand-mark">K</span>
                        <span>KANTOONG</span>
                    </div>

                    <div class="kp-auth-heading">
                        <h2 id="kpAuthTitle">${escapeHTML(title)}</h2>
                        <p>${escapeHTML(subtitle)}</p>
                    </div>

                    <div
                        class="kp-auth-message"
                        data-profile-auth-message
                        role="status"
                        aria-live="polite"
                        hidden
                    ></div>

                    ${
                        !isReset
                            ? `
                                <div class="kp-auth-providers">
                                    ${providers}
                                </div>

                                <div class="kp-auth-divider">
                                    <span>atau gunakan email</span>
                                </div>`
                            : ""
                    }

                    <form
                        class="kp-auth-form"
                        data-profile-auth-form
                        novalidate
                    >
                        <label class="kp-field">
                            <span>Email</span>
                            <input
                                type="email"
                                name="email"
                                autocomplete="email"
                                placeholder="nama@email.com"
                                maxlength="${AUTH_CONFIG.maxEmailLength}"
                                required
                            >
                        </label>

                        ${
                            isReset
                                ? ""
                                : `
                                    <label class="kp-field">
                                        <span>Password</span>

                                        <input
                                            type="password"
                                            name="password"
                                            autocomplete="${isRegister ? "new-password" : "current-password"}"
                                            placeholder="${isRegister ? "Minimal 8 karakter" : "Masukkan password"}"
                                            maxlength="${AUTH_CONFIG.maxPasswordLength}"
                                            required
                                        >
                                    </label>`
                        }

                        ${
                            isRegister
                                ? `
                                    <label class="kp-field">
                                        <span>Konfirmasi password</span>

                                        <input
                                            type="password"
                                            name="confirmPassword"
                                            autocomplete="new-password"
                                            placeholder="Ulangi password"
                                            maxlength="${AUTH_CONFIG.maxPasswordLength}"
                                            required
                                        >
                                    </label>

                                    <p class="kp-auth-legal">
                                        Dengan membuat akun, kamu menyetujui
                                        ketentuan layanan dan kebijakan privasi
                                        KANTOONG.
                                    </p>`
                                : ""
                        }

                        ${
                            mode === "login"
                                ? `
                                    <button
                                        type="button"
                                        class="kp-text-button kp-auth-forgot"
                                        data-profile-action="forgot-password"
                                    >Lupa password?</button>`
                                : ""
                        }

                        <button
                            type="submit"
                            class="kp-button kp-button--primary kp-auth-submit"
                        >
                            ${isRegister ? "Buat akun" :
                              isReset ? "Kirim tautan pemulihan" : "Masuk"}
                        </button>
                    </form>

                    <div class="kp-auth-switch">
                        ${
                            isReset
                                ? `
                                    <span>Ingat passwordmu?</span>
                                    <button
                                        type="button"
                                        data-profile-action="show-login"
                                    >Kembali ke login</button>`
                                : isRegister
                                    ? `
                                        <span>Sudah punya akun?</span>
                                        <button
                                            type="button"
                                            data-profile-action="show-login"
                                        >Masuk</button>`
                                    : `
                                        <span>Belum punya akun?</span>
                                        <button
                                            type="button"
                                            data-profile-action="show-register"
                                        >Daftar gratis</button>`
                        }
                    </div>
                </section>
            </div>`;

        const emailInput = $('input[name="email"]', host);
        emailInput?.focus();
    }

    // ---------------------------------------------------------
    // 11. LOGIN DAN REGISTRASI EMAIL/PASSWORD
    // ---------------------------------------------------------

    async function submitEmailAuth(form) {
        if (authState.busy) return;

        const auth = getSupabaseAuth();

        if (!auth) {
            setAuthMessage(
                "Supabase Auth belum terhubung. Konfigurasikan client autentikasi sebelum login digunakan.",
                "error"
            );
            return;
        }

        const data = new FormData(form);
        const emailResult = validateEmail(data.get("email"));

        if (!emailResult.valid) {
            setAuthMessage(emailResult.message, "error");
            return;
        }

        const isReset = authState.mode === "reset";
        const isRegister = authState.mode === "register";

        if (isReset) {
            setAuthBusy(true);

            try {
                const { error } = await auth.resetPasswordForEmail(
                    emailResult.value,
                    {
                        redirectTo: AUTH_CONFIG.redirectTo
                    }
                );

                if (error) throw error;

                setAuthMessage(
                    "Jika email tersebut terdaftar, instruksi pemulihan akan dikirim.",
                    "success"
                );
            } catch (error) {
                setAuthMessage(
                    normalizeAuthError(error, "reset"),
                    "error"
                );
            } finally {
                setAuthBusy(false);
            }

            return;
        }

        const passwordResult = validatePassword(
            data.get("password"),
            isRegister ? "register" : "login"
        );

        if (!passwordResult.valid) {
            setAuthMessage(passwordResult.message, "error");
            return;
        }

        if (isRegister) {
            const confirmPassword = String(
                data.get("confirmPassword") || ""
            );

            if (confirmPassword !== passwordResult.value) {
                setAuthMessage(
                    "Konfirmasi password tidak sama.",
                    "error"
                );
                return;
            }
        }

        setAuthBusy(true);

        try {
            let result;

            if (isRegister) {
                result = await auth.signUp({
                    email: emailResult.value,
                    password: passwordResult.value,
                    options: {
                        emailRedirectTo: AUTH_CONFIG.redirectTo,
                        data: {
                            full_name: "",
                            username: ""
                        }
                    }
                });
            } else {
                result = await auth.signInWithPassword({
                    email: emailResult.value,
                    password: passwordResult.value
                });
            }

            if (result.error) throw result.error;

            if (isRegister) {
                const session = result.data?.session;

                if (!session) {
                    setAuthMessage(
                        "Akun berhasil didaftarkan jika data memenuhi persyaratan. Periksa email untuk menyelesaikan verifikasi.",
                        "success"
                    );
                    return;
                }
            }

            const user = result.data?.user;

            if (user) {
                applyAuthenticatedUser(user, "email");
            }

            setAuthMessage(
                isRegister
                    ? "Pendaftaran berhasil."
                    : "Login berhasil.",
                "success"
            );

            window.setTimeout(() => {
                closeAuthDialog();
                render();
            }, 500);

        } catch (error) {
            console.error("[Kantoong Profile] Auth error:", error);

            setAuthMessage(
                normalizeAuthError(error, authState.mode),
                "error"
            );
        } finally {
            setAuthBusy(false);
        }
    }

    // ---------------------------------------------------------
    // 12. LOGIN OAUTH: GOOGLE, MICROSOFT, APPLE
    // ---------------------------------------------------------

    async function signInWithProvider(provider) {
        if (authState.busy) return;

        const allowed = CONFIG.authProviders.some(
            (item) => item.id === provider && item.enabled
        );

        if (!allowed) {
            setAuthMessage(
                "Penyedia login ini belum diaktifkan.",
                "error"
            );
            return;
        }

        const auth = getSupabaseAuth();

        if (!auth) {
            setAuthMessage(
                "Supabase Auth belum terhubung. Login sosial belum dapat dijalankan.",
                "error"
            );
            return;
        }

        const providerMap = {
            google: "google",
            microsoft: "azure",
            apple: "apple"
        };

        setAuthBusy(true);
        authState.pendingProvider = provider;

        try {
            const options = {
                redirectTo: AUTH_CONFIG.redirectTo
            };

            // Supabase menggunakan provider "azure" untuk
            // integrasi Microsoft. Tenant dan izin harus
            // dikonfigurasi di dashboard penyedia.
            if (provider === "microsoft") {
                options.scopes = "email";
            }

            const { error } = await auth.signInWithOAuth({
                provider: providerMap[provider],
                options
            });

            if (error) throw error;

            // OAuth umumnya mengalihkan browser ke penyedia.
            // Jangan menandai login berhasil di sini.
        } catch (error) {
            console.error("[Kantoong Profile] OAuth error:", error);

            setAuthMessage(
                "Login " + provider + " belum berhasil. Periksa konfigurasi OAuth dan URL redirect.",
                "error"
            );

            setAuthBusy(false);
            authState.pendingProvider = null;
        }
    }

    // ---------------------------------------------------------
    // 13. SINKRONISASI USER DARI SUPABASE AUTH
    // ---------------------------------------------------------

    function applyAuthenticatedUser(authUser, provider = null) {
        if (!authUser || !authUser.id) return;

        const metadata = authUser.user_metadata || {};

        const currentUser = {
            ...state.user,
            id: authUser.id,
            email: authUser.email || "",
            fullName: safeText(
                metadata.full_name ||
                metadata.name ||
                metadata.fullName,
                authUser.email?.split("@")[0] ||
                CONFIG.defaultName
            ),
            username: safeText(
                metadata.username,
                "@" + (
                    authUser.email?.split("@")[0] ||
                    "pengguna"
                )
            ),
            avatarUrl: safeText(
                metadata.avatar_url ||
                metadata.picture,
                ""
            ),
            joinedAt: authUser.created_at || null,
            initial: "",
            providers: {
                ...state.user.providers,
                email: Boolean(authUser.email),
                google: provider === "google" || Boolean(
                    authUser.app_metadata?.provider === "google"
                ),
                microsoft: provider === "microsoft" || Boolean(
                    authUser.app_metadata?.provider === "azure"
                ),
                apple: provider === "apple" || Boolean(
                    authUser.app_metadata?.provider === "apple"
                )
            }
        };

        currentUser.initial = safeInitial(currentUser.fullName);

        state.user = currentUser;
        state.isAuthenticated = true;
        state.authProvider = provider ||
            authUser.app_metadata?.provider ||
            "email";

        // Jangan simpan session/token secara manual.
        // Pengelolaan session tetap menjadi tanggung jawab
        // Supabase Auth SDK.
        emit(EVENTS.AUTH_CHANGED, {
            authenticated: true,
            user: {
                id: currentUser.id,
                email: currentUser.email,
                fullName: currentUser.fullName,
                username: currentUser.username,
                provider: state.authProvider
            }
        });
    }

    function applySignedOut() {
        state.isAuthenticated = false;
        state.authProvider = null;
        state.user = { ...defaultUser };

        loadLocalProfile();

        emit(EVENTS.AUTH_CHANGED, {
            authenticated: false,
            user: null
        });
    }

    function closeAuthDialog() {
        const host = $("[data-profile-dialog-host]", state.root);

        if (host) {
            host.innerHTML = "";
        }

        authState.message = "";
        authState.busy = false;
        authState.pendingProvider = null;
    }

    // ---------------------------------------------------------
    // 14. PEMERIKSAAN SESSION & AUTH STATE
    // ---------------------------------------------------------

    let authSubscription = null;

    async function initializeAuth() {
        const auth = getSupabaseAuth();

        if (!auth) {
            state.isAuthenticated = false;
            return false;
        }

        try {
            const { data, error } = await auth.getSession();

            if (error) throw error;

            if (data?.session?.user) {
                applyAuthenticatedUser(
                    data.session.user,
                    data.session.user.app_metadata?.provider
                );
            } else {
                applySignedOut();
            }

            if (!authSubscription) {
                const result = auth.onAuthStateChange(
                    (event, session) => {
                        if (session?.user) {
                            applyAuthenticatedUser(
                                session.user,
                                session.user.app_metadata?.provider
                            );
                        } else if (event === "SIGNED_OUT") {
                            applySignedOut();
                        }

                        if (state.mounted) {
                            render();
                        }
                    }
                );

                authSubscription =
                    result.data?.subscription || null;
            }

            return true;
        } catch (error) {
            console.error(
                "[Kantoong Profile] Gagal memeriksa session:",
                error
            );

            state.lastError = error;
            return false;
        }
    }

    
    // ---------------------------------------------------------
    // 15. DIALOG EDIT PROFIL
    // ---------------------------------------------------------

    function renderEditProfileDialog() {
        const host = $("[data-profile-dialog-host]", state.root);
        if (!host) return;

        const user = state.user;

        host.innerHTML = `
            <div class="kp-dialog-backdrop" data-edit-backdrop>
                <section
                    class="kp-edit-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="kpEditTitle"
                >
                    <header class="kp-dialog-header">
                        <div>
                            <h2 id="kpEditTitle">Edit profil</h2>
                            <p>Atur bagaimana orang mengenalmu.</p>
                        </div>
                        <button
                            class="kp-icon-button"
                            type="button"
                            data-profile-action="close-dialog"
                            aria-label="Tutup"
                        >×</button>
                    </header>

                    <form data-profile-edit-form class="kp-edit-form">
                        <div class="kp-edit-avatar">
                            ${renderAvatar(user, "large")}
                            <button
                                type="button"
                                class="kp-button kp-button--secondary"
                                data-profile-action="change-avatar"
                            >${icon("camera", 16)} Ganti foto</button>
                            ${
                                user.avatarUrl
                                    ? `<button
                                        type="button"
                                        class="kp-text-button"
                                        data-profile-action="remove-avatar"
                                    >Hapus foto</button>`
                                    : ""
                            }
                        </div>

                        <label class="kp-field">
                            <span>Nama lengkap</span>
                            <input
                                name="fullName"
                                value="${escapeHTML(user.fullName)}"
                                maxlength="80"
                                required
                            >
                        </label>

                        <label class="kp-field">
                            <span>Username</span>
                            <input
                                name="username"
                                value="${escapeHTML(user.username.replace(/^@/, ""))}"
                                maxlength="30"
                                pattern="[A-Za-z0-9._]+"
                                required
                            >
                            <small>Gunakan huruf, angka, titik, atau garis bawah.</small>
                        </label>

                        <label class="kp-field">
                            <span>Bio</span>
                            <textarea
                                name="bio"
                                maxlength="240"
                                rows="3"
                                placeholder="Ceritakan tentang dirimu..."
                            >${escapeHTML(user.bio)}</textarea>
                        </label>

                        <label class="kp-field">
                            <span>Lokasi</span>
                            <input
                                name="location"
                                value="${escapeHTML(user.location)}"
                                maxlength="100"
                                placeholder="Contoh: Bandung, Indonesia"
                            >
                        </label>

                        <label class="kp-field">
                            <span>Website</span>
                            <input
                                name="website"
                                type="url"
                                value="${escapeHTML(user.website)}"
                                maxlength="300"
                                placeholder="https://websitekamu.com"
                            >
                        </label>

                        <label class="kp-privacy-toggle">
                            <span>
                                <strong>Profil publik</strong>
                                <small>Izinkan orang lain melihat profilmu.</small>
                            </span>
                            <input
                                type="checkbox"
                                name="isPublic"
                                ${user.isPublic ? "checked" : ""}
                            >
                        </label>

                        <div
                            class="kp-auth-message"
                            data-profile-edit-message
                            role="status"
                            hidden
                        ></div>

                        <div class="kp-dialog-actions">
                            <button
                                type="button"
                                class="kp-button kp-button--secondary"
                                data-profile-action="close-dialog"
                            >Batal</button>

                            <button
                                type="submit"
                                class="kp-button kp-button--primary"
                            >Simpan perubahan</button>
                        </div>
                    </form>
                </section>
            </div>`;
    }

    function submitEditProfile(form) {
        const data = new FormData(form);

        const fullName = safeText(data.get("fullName"));
        const username = safeText(data.get("username"))
            .replace(/^@/, "");
        const bio = String(data.get("bio") || "").trim();
        const location = String(data.get("location") || "").trim();
        const website = String(data.get("website") || "").trim();
        const isPublic = data.get("isPublic") === "on";

        if (!fullName || fullName.length > 80) {
            return showEditError("Nama wajib diisi dan maksimal 80 karakter.");
        }

        if (!/^[A-Za-z0-9._]{3,30}$/.test(username)) {
            return showEditError(
                "Username harus 3–30 karakter, hanya huruf, angka, titik, atau garis bawah."
            );
        }

        if (bio.length > 240) {
            return showEditError("Bio maksimal 240 karakter.");
        }

        if (location.length > 100) {
            return showEditError("Lokasi maksimal 100 karakter.");
        }

        if (website) {
            try {
                const url = new URL(website);

                if (!["http:", "https:"].includes(url.protocol)) {
                    throw new Error("Skema URL tidak diizinkan.");
                }
            } catch {
                return showEditError(
                    "Masukkan URL website yang valid dengan http:// atau https://."
                );
            }
        }

        const patch = {
            fullName,
            username: "@" + username,
            bio,
            location,
            website,
            isPublic
        };

        // Data lokal tidak boleh dianggap sebagai data server.
        // Bila user login, emit event agar integrasi database
        // dapat menyimpan profil melalui backend yang sesuai.
        if (state.isAuthenticated) {
            emit("kantoong:profile-save-request", {
                userId: state.user.id,
                patch
            });

            showEditError(
                "Perubahan disiapkan. Integrasi penyimpanan profil server perlu dikonfigurasi sebelum data dianggap tersimpan.",
                "info"
            );

            return;
        }

        const saved = saveLocalProfile(patch);

        if (!saved) {
            return showEditError(
                "Profil belum dapat disimpan di perangkat ini."
            );
        }

        closeAuthDialog();
        render();
    }

    function showEditError(message, type = "error") {
        const box = $("[data-profile-edit-message]", state.root);

        if (!box) {
            setAuthMessage(message, type);
            return;
        }

        box.textContent = message;
        box.dataset.type = type;
        box.hidden = false;
    }

    // ---------------------------------------------------------
    // 16. AVATAR: VALIDASI & PRATINJAU LOKAL
    // ---------------------------------------------------------

    let temporaryAvatarUrl = null;

    function openAvatarPicker() {
        const input = $("[data-profile-avatar-input]", state.root);
        input?.click();
    }

    function handleAvatarFile(file) {
        if (!file) return;

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        const maxSize = 5 * 1024 * 1024;

        if (!allowedTypes.includes(file.type)) {
            setAuthMessage(
                "Gunakan gambar JPG, PNG, atau WebP.",
                "error"
            );
            return;
        }

        if (file.size > maxSize) {
            setAuthMessage(
                "Ukuran foto maksimal 5 MB.",
                "error"
            );
            return;
        }

        if (temporaryAvatarUrl) {
            URL.revokeObjectURL(temporaryAvatarUrl);
            temporaryAvatarUrl = null;
        }

        temporaryAvatarUrl = URL.createObjectURL(file);

        // Ini hanya pratinjau selama sesi halaman.
        // Upload permanen ke Supabase Storage harus dilakukan
        // melalui integrasi penyimpanan yang dikonfigurasi.
        state.user = {
            ...state.user,
            avatarUrl: temporaryAvatarUrl
        };

        emit("kantoong:profile-avatar-upload-request", {
            userId: state.user.id,
            file,
            fileName: file.name,
            mimeType: file.type,
            size: file.size
        });

        render();

        setAuthMessage(
            "Foto tampil sebagai pratinjau lokal. Foto belum diunggah permanen.",
            "info"
        );
    }

    function removeAvatar() {
        const oldUrl = state.user.avatarUrl;

        if (oldUrl && oldUrl === temporaryAvatarUrl) {
            URL.revokeObjectURL(temporaryAvatarUrl);
            temporaryAvatarUrl = null;
        }

        state.user = {
            ...state.user,
            avatarUrl: ""
        };

        if (state.isAuthenticated) {
            emit("kantoong:profile-avatar-remove-request", {
                userId: state.user.id
            });
        } else {
            saveLocalProfile({ avatarUrl: "" });
        }

        render();
    }

    // ---------------------------------------------------------
    // 17. AKTIVITAS PENGGUNA
    // ---------------------------------------------------------

    const ACTIVITY_LABELS = {
        overview: "Ringkasan",
        reviews: "Ulasan",
        videos: "Video",
        likes: "Disukai",
        followers: "Pengikut",
        following: "Mengikuti"
    };

    function renderActivityContent(tab = state.activeTab) {
        state.activeTab = tab;

        const box = $(
            "[data-profile-activity-content]",
            state.root
        );

        if (!box) return;

        const tabButtons = $$(
            "[data-profile-tab]",
            state.root
        );

        tabButtons.forEach((button) => {
            const active = button.dataset.profileTab === tab;

            button.classList.toggle("is-active", active);
            button.setAttribute("aria-selected", String(active));
        });

        const records = state.activities.filter((item) => {
            if (tab === "overview") return true;
            if (tab === "reviews") return item.type === "review";
            if (tab === "videos") return item.type === "video";
            if (tab === "likes") return item.type === "like";
            if (tab === "followers") return item.type === "follower";
            if (tab === "following") return item.type === "following";

            return false;
        });

        if (!records.length) {
            const messages = {
                overview: "Ulasan, video, dan kontribusimu akan tampil di sini.",
                reviews: "Kamu belum memiliki ulasan yang tersedia.",
                videos: "Video yang kamu publikasikan akan tampil di sini.",
                likes: "Konten yang kamu sukai akan tampil di sini.",
                followers: "Daftar pengikut akan tampil di sini.",
                following: "Akun yang kamu ikuti akan tampil di sini."
            };

            box.innerHTML = `
                <div class="kp-empty-state">
                    <span class="kp-empty-state__icon">
                        ${icon(tab === "videos" ? "video" : "star", 25)}
                    </span>
                    <h3>${escapeHTML(ACTIVITY_LABELS[tab] || "Aktivitas")}</h3>
                    <p>${escapeHTML(messages[tab] || "Belum ada aktivitas.")}</p>
                </div>`;

            return;
        }

        box.innerHTML = `
            <div class="kp-activity-list">
                ${records.map((item) => `
                    <article class="kp-activity-card">
                        <div class="kp-activity-card__icon">
                            ${icon(
                                item.type === "video" ? "video" :
                                item.type === "like" ? "heart" : "star",
                                20
                            )}
                        </div>
                        <div class="kp-activity-card__body">
                            <strong>${escapeHTML(item.title || "Aktivitas")}</strong>
                            <p>${escapeHTML(item.description || "")}</p>
                            ${
                                item.createdAt
                                    ? `<small>${escapeHTML(formatDate(item.createdAt))}</small>`
                                    : ""
                            }
                        </div>
                    </article>
                `).join("")}
            </div>`;
    }

    function setActivities(records) {
        if (!Array.isArray(records)) return false;

        const allowedTypes = [
            "review", "video", "like", "follower", "following"
        ];

        state.activities = records
            .filter((item) => item && allowedTypes.includes(item.type))
            .map((item) => ({
                type: item.type,
                title: safeText(item.title, "Aktivitas"),
                description: safeText(item.description, ""),
                createdAt: item.createdAt || null
            }));

        renderActivityContent(state.activeTab);

        return true;
    }

    // ---------------------------------------------------------
    // 18. PRIVASI & KEAMANAN
    // ---------------------------------------------------------

    function renderSettingsDialog(type) {
        const host = $("[data-profile-dialog-host]", state.root);
        if (!host) return;

        const security = type === "security";

        host.innerHTML = `
            <div class="kp-dialog-backdrop">
                <section
                    class="kp-edit-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="kpSettingsTitle"
                >
                    <header class="kp-dialog-header">
                        <div>
                            <h2 id="kpSettingsTitle">
                                ${security ? "Login & keamanan" : "Privasi akun"}
                            </h2>
                            <p>
                                ${security
                                    ? "Kelola akses dan perlindungan akun."
                                    : "Atur bagaimana profilmu terlihat."}
                            </p>
                        </div>
                        <button
                            class="kp-icon-button"
                            type="button"
                            data-profile-action="close-dialog"
                            aria-label="Tutup"
                        >×</button>
                    </header>

                    <div class="kp-settings-list">
                        ${
                            security
                                ? `
                                    <div class="kp-settings-row">
                                        <div>
                                            <strong>Status autentikasi</strong>
                                            <p>
                                                ${state.isAuthenticated
                                                    ? "Terhubung ke sesi akun."
                                                    : "Kamu belum login."}
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        class="kp-nav-item"
                                        data-profile-action="forgot-password"
                                    >
                                        <span class="kp-nav-item__icon">
                                            ${icon("lock", 20)}
                                        </span>
                                        <span class="kp-nav-item__copy">
                                            <strong>Atur ulang password</strong>
                                            <small>Kirim instruksi ke email</small>
                                        </span>
                                        ${icon("chevron", 18)}
                                    </button>

                                    <div class="kp-settings-row">
                                        <div>
                                            <strong>Metode login</strong>
                                            <p>
                                                Email:
                                                ${state.user.providers.email ? "Terhubung" : "Belum terhubung"}
                                            </p>
                                            <p>
                                                Google:
                                                ${state.user.providers.google ? "Terhubung" : "Belum terhubung"}
                                            </p>
                                            <p>
                                                Microsoft:
                                                ${state.user.providers.microsoft ? "Terhubung" : "Belum terhubung"}
                                            </p>
                                            <p>
                                                Apple:
                                                ${state.user.providers.apple ? "Terhubung" : "Belum terhubung"}
                                            </p>
                                        </div>
                                    </div>
                                `
                                : `
                                    <label class="kp-privacy-toggle">
                                        <span>
                                            <strong>Profil publik</strong>
                                            <small>
                                                Izinkan orang lain melihat halaman profil.
                                            </small>
                                        </span>
                                        <input
                                            type="checkbox"
                                            data-profile-public-toggle
                                            ${state.user.isPublic ? "checked" : ""}
                                        >
                                    </label>

                                    <div class="kp-settings-row">
                                        <div>
                                            <strong>Data profil</strong>
                                            <p>
                                                Informasi publik hanya aman
                                                ditampilkan jika kebijakan
                                                akses database sudah dikonfigurasi.
                                            </p>
                                        </div>
                                    </div>

                                    <div class="kp-settings-row">
                                        <div>
                                            <strong>Pengguna yang diblokir</strong>
                                            <p>${state.blockedUsers.length} pengguna dalam daftar lokal.</p>
                                        </div>
                                    </div>
                                `
                        }

                        <div
                            class="kp-auth-message"
                            data-profile-settings-message
                            role="status"
                            hidden
                        ></div>
                    </div>

                    <div class="kp-dialog-actions">
                        <button
                            type="button"
                            class="kp-button kp-button--secondary"
                            data-profile-action="close-dialog"
                        >Tutup</button>
                    </div>
                </section>
            </div>`;
    }

    function updatePrivacy(value) {
        const isPublic = Boolean(value);

        if (state.isAuthenticated) {
            emit("kantoong:profile-privacy-save-request", {
                userId: state.user.id,
                isPublic
            });

            const box = $(
                "[data-profile-settings-message]",
                state.root
            );

            if (box) {
                box.hidden = false;
                box.textContent =
                    "Perubahan privasi dikirim untuk diproses oleh integrasi server.";
            }

            return;
        }

        if (saveLocalProfile({ isPublic })) {
            render();
        }
    }

    // ---------------------------------------------------------
    // 19. LOGOUT
    // ---------------------------------------------------------

    async function logout() {
        if (!state.isAuthenticated) {
            closeAuthDialog();
            renderAuthDialog("login");
            return;
        }

        const confirmed = window.confirm(
            "Yakin ingin keluar dari akun KANTOONG?"
        );

        if (!confirmed) return;

        const auth = getSupabaseAuth();

        if (!auth) {
            setAuthMessage(
                "Client autentikasi tidak tersedia. Sesi belum diubah.",
                "error"
            );
            return;
        }

        try {
            const { error } = await auth.signOut();

            if (error) throw error;

            // Auth state listener akan menyinkronkan state.
            closeAuthDialog();
            render();
        } catch (error) {
            console.error("[Kantoong Profile] Logout error:", error);

            setAuthMessage(
                "Logout gagal. Coba kembali.",
                "error"
            );
        }
    }

    // ---------------------------------------------------------
    // 20. PENGHAPUSAN AKUN
    // ---------------------------------------------------------

    function renderDeleteAccountDialog() {
        const host = $("[data-profile-dialog-host]", state.root);
        if (!host) return;

        host.innerHTML = `
            <div class="kp-dialog-backdrop">
                <section
                    class="kp-edit-dialog kp-danger-dialog"
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="kpDeleteTitle"
                >
                    <div class="kp-danger-icon">
                        ${icon("trash", 26)}
                    </div>

                    <h2 id="kpDeleteTitle">Hapus akun secara permanen?</h2>

                    <p>
                        Penghapusan akun dapat menghilangkan profil,
                        preferensi, dan data terkait sesuai kebijakan
                        layanan. Tindakan ini tidak dapat dibatalkan.
                    </p>

                    <p>
                        Untuk keamanan, penghapusan harus diverifikasi
                        oleh server menggunakan sesi yang sah.
                    </p>

                    <div
                        class="kp-auth-message"
                        data-profile-delete-message
                        role="status"
                        hidden
                    ></div>

                    <div class="kp-dialog-actions">
                        <button
                            type="button"
                            class="kp-button kp-button--secondary"
                            data-profile-action="close-dialog"
                        >Batalkan</button>

                        <button
                            type="button"
                            class="kp-button kp-button--danger"
                            data-profile-action="confirm-delete"
                        >Ajukan penghapusan</button>
                    </div>
                </section>
            </div>`;
    }

    function requestAccountDeletion() {
        const box = $(
            "[data-profile-delete-message]",
            state.root
        );

        if (!state.isAuthenticated || !state.user.id) {
            if (box) {
                box.hidden = false;
                box.textContent =
                    "Login terlebih dahulu untuk mengajukan penghapusan akun.";
            }
            return;
        }

        // Tidak menghapus user langsung dari browser.
        // Penghapusan Supabase Auth membutuhkan operasi tepercaya
        // di server/Edge Function dan pemeriksaan otorisasi.
        emit(EVENTS.DELETE_REQUEST, {
            userId: state.user.id,
            requestedAt: new Date().toISOString(),
            source: "profile-settings"
        });

        if (box) {
            box.hidden = false;
            box.textContent =
                "Permintaan penghapusan telah disiapkan. Endpoint server untuk memverifikasi dan menjalankan penghapusan akun masih harus diintegrasikan.";
        }
    }

    // ---------------------------------------------------------
    // 21. ROUTING AKSI PROFIL
    // ---------------------------------------------------------

    function handleAction(action) {
        switch (action) {
            case "close":
                emit(EVENTS.CLOSE, {});
                state.root.hidden = true;
                break;

            case "close-dialog":
                closeAuthDialog();
                break;

            case "login":
                renderAuthDialog("login");
                break;

            case "show-login":
                renderAuthDialog("login");
                break;

            case "show-register":
                renderAuthDialog("register");
                break;

            case "forgot-password":
                renderAuthDialog("reset");
                break;

            case "edit-profile":
                renderEditProfileDialog();
                break;

            case "change-avatar":
                openAvatarPicker();
                break;

            case "remove-avatar":
                removeAvatar();
                break;

            case "security":
                renderSettingsDialog("security");
                break;

            case "privacy":
                renderSettingsDialog("privacy");
                break;

            case "preferences":
                emit("kantoong:profile-preferences-open", {
                    userId: state.user.id
                });
                setAuthMessage(
                    "Pengaturan preferensi akan dihubungkan ke modul pengaturan aplikasi.",
                    "info"
                );
                break;

            case "view-public":
                if (!CONFIG.enablePublicProfile) return;

                emit("kantoong:profile-public-view", {
                    userId: state.user.id,
                    username: state.user.username
                });
                break;

            case "all-activity":
                emit(EVENTS.ACTIVITY_OPEN, {
                    userId: state.user.id
                });
                break;

            case "followers":
            case "following":
            case "likes":
            case "reviews":
            case "videos":
                state.activeTab = action;
                renderActivityContent(action);
                emit(EVENTS.ACTIVITY_OPEN, {
                    userId: state.user.id,
                    type: action
                });
                break;

            case "logout":
                logout();
                break;

            case "delete-account":
                renderDeleteAccountDialog();
                break;

            case "confirm-delete":
                requestAccountDeletion();
                break;

            default:
                emit("kantoong:profile-action", {
                    action,
                    userId: state.user.id
                });
        }
    }

    // ---------------------------------------------------------
    // 22. EVENT DELEGATION
    // ---------------------------------------------------------

    function bindEvents() {
        if (!state.root || state.root.dataset.eventsBound === "true") {
            return;
        }

        state.root.dataset.eventsBound = "true";

        state.root.addEventListener("click", (event) => {
            const actionButton = event.target.closest(
                "[data-profile-action]"
            );

            if (actionButton && state.root.contains(actionButton)) {
                handleAction(actionButton.dataset.profileAction);
                return;
            }

            const tabButton = event.target.closest(
                "[data-profile-tab]"
            );

            if (tabButton && state.root.contains(tabButton)) {
                renderActivityContent(tabButton.dataset.profileTab);
                return;
            }

            const providerButton = event.target.closest(
                "[data-auth-provider]"
            );

            if (providerButton && state.root.contains(providerButton)) {
                signInWithProvider(
                    providerButton.dataset.authProvider
                );
                return;
            }

            if (
                event.target.matches("[data-auth-backdrop]") ||
                event.target.matches("[data-edit-backdrop]")
            ) {
                closeAuthDialog();
            }
        });

        state.root.addEventListener("submit", (event) => {
            const authForm = event.target.closest(
                "[data-profile-auth-form]"
            );

            if (authForm) {
                event.preventDefault();
                submitEmailAuth(authForm);
                return;
            }

            const editForm = event.target.closest(
                "[data-profile-edit-form]"
            );

            if (editForm) {
                event.preventDefault();
                submitEditProfile(editForm);
            }
        });

        state.root.addEventListener("change", (event) => {
            const avatarInput = event.target.closest(
                "[data-profile-avatar-input]"
            );

            if (avatarInput) {
                handleAvatarFile(avatarInput.files?.[0]);
                avatarInput.value = "";
                return;
            }

            const privacyToggle = event.target.closest(
                "[data-profile-public-toggle]"
            );

            if (privacyToggle) {
                updatePrivacy(privacyToggle.checked);
            }
        });

        state.root.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;

            const host = $(
                "[data-profile-dialog-host]",
                state.root
            );

            if (host?.innerHTML.trim()) {
                closeAuthDialog();
            }
        });
    }

    // ---------------------------------------------------------
    // 23. RENDER & MOUNT
    // ---------------------------------------------------------

    function render() {
        if (!state.root) return;

        state.root.innerHTML = renderProfileShell();
        state.root.hidden = false;

        // Elemen dialog berada di dalam root sehingga perlu
        // disediakan kembali setelah render utama.
        bindEvents();
        renderActivityContent(state.activeTab);
    }

    function mount(target) {
        let container = target;

        if (typeof target === "string") {
            container = $(target);
        }

        if (!container) {
            container = $(CONFIG.mountSelector);
        }

        if (!container) {
            console.warn(
                "[Kantoong Profile] Container tidak ditemukan."
            );
            return false;
        }

        loadLocalProfile();

        const root = document.createElement("div");
        root.className = "kp-mount";
        root.dataset.profileMount = "true";

        container.appendChild(root);

        state.root = root;
        state.mounted = true;

        render();
        initializeAuth();

        emit(EVENTS.OPEN, {
            version: MODULE_VERSION
        });

        return true;
    }

    function unmount() {
        if (state.root) {
            state.root.remove();
        }

        state.root = null;
        state.mounted = false;

        if (authSubscription) {
            authSubscription.unsubscribe();
            authSubscription = null;
        }

        if (temporaryAvatarUrl) {
            URL.revokeObjectURL(temporaryAvatarUrl);
            temporaryAvatarUrl = null;
        }

        emit(EVENTS.CLOSE, {});
    }

    // ---------------------------------------------------------
    // 24. API PUBLIK KANTOONG PROFILE
    // ---------------------------------------------------------

    window.KantoongProfile = {
        version: MODULE_VERSION,
        config: CONFIG,
        events: EVENTS,

        mount,
        unmount,
        render,

        openLogin() {
            if (!state.mounted) {
                if (!mount()) return false;
            }

            renderAuthDialog("login");
            return true;
        },

        openRegister() {
            if (!state.mounted) {
                if (!mount()) return false;
            }

            renderAuthDialog("register");
            return true;
        },

        openProfileEditor() {
            if (!state.mounted) {
                if (!mount()) return false;
            }

            renderEditProfileDialog();
            return true;
        },

        openSecurity() {
            if (!state.mounted) {
                if (!mount()) return false;
            }

            renderSettingsDialog("security");
            return true;
        },

        openPrivacy() {
            if (!state.mounted) {
                if (!mount()) return false;
            }

            renderSettingsDialog("privacy");
            return true;
        },

        logout,

        getState() {
            return {
                mounted: state.mounted,
                isAuthenticated: state.isAuthenticated,
                authProvider: state.authProvider,
                activeTab: state.activeTab,
                user: { ...state.user }
            };
        },

        setProfile(patch) {
            if (!patch || typeof patch !== "object") {
                return false;
            }

            if (state.isAuthenticated) {
                emit("kantoong:profile-save-request", {
                    userId: state.user.id,
                    patch
                });

                return true;
            }

            const ok = saveLocalProfile(patch);

            if (ok && state.mounted) render();

            return ok;
        },

        setActivities,
        refreshAuth: initializeAuth
    };

    // ---------------------------------------------------------
    // 25. EVENT INTEGRASI ANTARMODUL
    // ---------------------------------------------------------

    window.addEventListener(
        "kantoong:profile-open",
        () => {
            if (!state.mounted) {
                mount();
            } else {
                state.root.hidden = false;
                render();
            }
        }
    );

    window.addEventListener(
        "kantoong:profile-set-activities",
        (event) => {
            setActivities(event.detail?.activities || []);
        }
    );

    window.addEventListener(
        "kantoong:profile-auth-refresh",
        () => {
            initializeAuth();
        }
    );

    // ---------------------------------------------------------
    // 26. SELESAI — KANTOONG PROFILE
    // ---------------------------------------------------------

    console.info(
        "[Kantoong Profile] Modul v" +
        MODULE_VERSION +
        " berhasil didaftarkan."
    );

})(window, document);


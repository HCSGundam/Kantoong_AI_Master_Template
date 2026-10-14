// ============================================================
// engine.js - Kantoong AI Master Template
// ============================================================

// Ubah ke false SEBELUM template dipakai klien / dijual.
// true  = browser ini otomatis dianggap admin (hanya untuk testing sendiri).
// false = admin hanya dikenali lewat login Google (One Tap).
const DEV_AUTO_ADMIN = true;

// Render HTML ke elemen DAN jalankan <script> di dalamnya.
// (innerHTML saja tidak mengeksekusi script, jadi script dibuat ulang.)
function injectHTML(el, html) {
    el.innerHTML = html;
    el.querySelectorAll('script').forEach(old => {
        const s = document.createElement('script');
        if (old.src) s.src = old.src;
        else s.textContent = old.textContent;
        old.replaceWith(s);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Terapkan konfigurasi dari client-config.js
    if (typeof KantoongConfig !== 'undefined') {
        const pageTitle = document.getElementById('pageTitle');
        const brandTitle = document.getElementById('brandTitle');
        if (pageTitle) pageTitle.textContent = KantoongConfig.app_name;
        if (brandTitle) brandTitle.textContent = KantoongConfig.app_name;
        if (KantoongConfig.theme_color_primary) {
            document.documentElement.style.setProperty('--primary-color', KantoongConfig.theme_color_primary);
        }
    }

    // 2. Buka-Tutup Laci Menu
    const menuBtn = document.getElementById('showcaseMenuBtn');
    const drawer = document.getElementById('sampleDrawer');
    const closeDrawer = document.getElementById('closeDrawer');
    const container = document.getElementById('dynamicComponentContainer');

    if (menuBtn && drawer) {
        menuBtn.addEventListener('click', () => { drawer.style.display = 'flex'; });
    }
    if (closeDrawer && drawer) {
        closeDrawer.addEventListener('click', () => { drawer.style.display = 'none'; });
    }

    // 3. Load Komponen Modular Biasa (tombol dengan atribut data-component)
    document.querySelectorAll('.sample-item-btn:not(.disabled):not(#drawerAdminBtn):not(#drawerCustomerLogoutBtn)').forEach(btn => {
        btn.addEventListener('click', () => {
            const compFile = btn.getAttribute('data-component');
            if (!compFile) return;
            if (drawer) drawer.style.display = 'none';

            fetch(`components/${compFile}`)
                .then(res => {
                    if (!res.ok) throw new Error("Gagal memuat komponen: components/" + compFile);
                    return res.text();
                })
                .then(html => {
                    if (!container) return;
                    injectHTML(container, html);
                    const closeCompBtn = container.querySelector('#closeGoldModal') || container.querySelector('.gp-close');
                    if (closeCompBtn) {
                        closeCompBtn.addEventListener('click', () => { container.innerHTML = ''; });
                    }
                })
                .catch(err => alert("Info: " + err.message));
        });
    });

    // ==========================================
    // 4. SISTEM ADMIN & GOOGLE ONE TAP
    // ==========================================

    const ADMIN_EMAILS = [
        "micken.jobmail@gmail.com" // Email whitelist admin
    ];

    const drawerAdminBtn = document.getElementById('drawerAdminBtn');
    const customerGoogleSignInDiv = document.getElementById('customerGoogleSignInDiv');
    const drawerCustomerLogoutBtn = document.getElementById('drawerCustomerLogoutBtn');

    // Mode testing: otomatis dianggap admin (lihat DEV_AUTO_ADMIN di atas).
    if (DEV_AUTO_ADMIN && !localStorage.getItem('kantong_admin_email')) {
        localStorage.setItem('kantong_admin_email', ADMIN_EMAILS[0]);
    }

    let savedAdminEmail = localStorage.getItem('kantong_admin_email');
    let savedCustomerEmail = localStorage.getItem('kantong_customer_email');

    // Decode JWT token Google OAuth
    function parseJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            return null;
        }
    }

    // Atur tampilan menu sesuai status login
    function updateMenuUI() {
        if (savedAdminEmail && ADMIN_EMAILS.includes(savedAdminEmail)) {
            // ADMIN
            if (drawerAdminBtn) drawerAdminBtn.style.display = 'block';
            if (customerGoogleSignInDiv) customerGoogleSignInDiv.parentElement.style.display = 'none';
            if (drawerCustomerLogoutBtn) {
                drawerCustomerLogoutBtn.style.display = 'block';
                drawerCustomerLogoutBtn.textContent = `🔐 Admin: ${savedAdminEmail.split('@')[0]} (Keluar)`;
            }
        } else if (savedCustomerEmail) {
            // CUSTOMER
            if (drawerAdminBtn) drawerAdminBtn.style.display = 'none';
            if (customerGoogleSignInDiv) customerGoogleSignInDiv.parentElement.style.display = 'none';
            if (drawerCustomerLogoutBtn) {
                drawerCustomerLogoutBtn.style.display = 'block';
                drawerCustomerLogoutBtn.textContent = `👤 Akun: ${savedCustomerEmail.split('@')[0]} (Keluar)`;
            }
        } else {
            // BELUM LOGIN
            if (drawerAdminBtn) drawerAdminBtn.style.display = 'none';
            if (drawerCustomerLogoutBtn) drawerCustomerLogoutBtn.style.display = 'none';
            if (customerGoogleSignInDiv) customerGoogleSignInDiv.parentElement.style.display = 'block';
        }
    }

    updateMenuUI();

    // Tombol Logout
    if (drawerCustomerLogoutBtn) {
        drawerCustomerLogoutBtn.addEventListener('click', () => {
            if (confirm("Apakah Anda ingin keluar dari sesi ini?")) {
                localStorage.removeItem('kantong_admin_email');
                localStorage.removeItem('kantong_customer_email');
                location.reload();
            }
        });
    }

    // Google One Tap / Auto-Login
    window.addEventListener('load', () => {
        if (!savedAdminEmail && !savedCustomerEmail && window.google && google.accounts && google.accounts.id) {
            const googleClientId = (typeof KantoongConfig !== 'undefined' && KantoongConfig.google_client_id)
                ? KantoongConfig.google_client_id
                : "153262298610-rrhi1e6mlqlg553vri7ig7k9po2buulm.apps.googleusercontent.com";

            google.accounts.id.initialize({
                client_id: googleClientId,
                callback: (response) => {
                    const payload = parseJwt(response.credential);
                    if (payload && payload.email) {
                        const userEmail = payload.email;
                        if (ADMIN_EMAILS.includes(userEmail)) {
                            localStorage.setItem('kantong_admin_email', userEmail);
                            savedAdminEmail = userEmail;
                        } else {
                            localStorage.setItem('kantong_customer_email', userEmail);
                            savedCustomerEmail = userEmail;
                        }
                        updateMenuUI();
                    }
                },
                auto_select: true,
                cancel_on_tap_outside: true
            });

            google.accounts.id.prompt((notification) => {
                // Jika One Tap tidak tampil, render tombol biasa sebagai cadangan
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    if (customerGoogleSignInDiv && customerGoogleSignInDiv.innerHTML.trim() === "") {
                        google.accounts.id.renderButton(
                            customerGoogleSignInDiv,
                            { theme: "outline", size: "large", width: "240px", text: "signin_with" }
                        );
                    }
                }
            });
        }
    });

    // 5. Tombol Admin: buka Dashboard Admin
    if (drawerAdminBtn) {
        drawerAdminBtn.addEventListener('click', () => {
            if (drawer) drawer.style.display = 'none';

            fetch('components/admin-dashboard.html')
                .then(res => {
                    if (!res.ok) throw new Error("File komponen admin tidak ditemukan: components/admin-dashboard.html");
                    return res.text();
                })
                .then(html => {
                    if (!container) return;
                    injectHTML(container, html);
                })
                .catch(err => alert("Info: " + err.message));
        });
    }
});
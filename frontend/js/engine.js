document.addEventListener('DOMContentLoaded', () => {
    // 1. Terapkan konfigurasi dari client-config.js
    if (typeof KantoongConfig !== 'undefined') {
        if(document.getElementById('pageTitle')) document.getElementById('pageTitle').textContent = KantoongConfig.app_name;
        if(document.getElementById('brandTitle')) document.getElementById('brandTitle').textContent = KantoongConfig.app_name;
        if(KantoongConfig.theme_color_primary) {
            document.documentElement.style.setProperty('--primary-color', KantoongConfig.theme_color_primary);
        }
    }

    // 2. Interaksi Buka-Tutup Laci Sampel Komponen
    const menuBtn = document.getElementById('showcaseMenuBtn');
    const drawer = document.getElementById('sampleDrawer');
    const closeDrawer = document.getElementById('closeDrawer');
    const container = document.getElementById('dynamicComponentContainer');

    if (menuBtn && drawer) {
        menuBtn.addEventListener('click', () => {
            drawer.style.display = 'flex';
        });
    }
    if (closeDrawer && drawer) {
        closeDrawer.addEventListener('click', () => {
            drawer.style.display = 'none';
        });
    }

    // 3. Load Komponen Modular BIASA
    document.querySelectorAll('.sample-item-btn:not(.disabled):not(#drawerAdminBtn):not(#drawerCustomerLogoutBtn)').forEach(btn => {
        btn.addEventListener('click', () => {
            const compFile = btn.getAttribute('data-component');
            if (!compFile) return;
            if (drawer) drawer.style.display = 'none';

            fetch(`components/${compFile}`)
                .then(res => {
                    if (!res.ok) throw new Error("Gagal memuat komponen");
                    return res.text();
                })
                .then(html => {
                    if (container) {
                        container.innerHTML = html;
                        const closeCompBtn = container.querySelector('#closeGoldModal') || container.querySelector('.gp-close');
                        if (closeCompBtn) {
                            closeCompBtn.addEventListener('click', () => {
                                container.innerHTML = '';
                            });
                        }
                    }
                })
                .catch(err => alert("Info: " + err.message));
        });
    });

    // ==========================================
    // 4. SISTEM AUTO-DETECT ADMIN & GOOGLE ONE TAP
    // ==========================================
    
    const ADMIN_EMAILS = [
        "micken.jobmail@gmail.com" // Email whitelist admin resmi
    ];

    const drawerAdminBtn = document.getElementById('drawerAdminBtn');
    const customerGoogleSignInDiv = document.getElementById('customerGoogleSignInDiv');
    const drawerCustomerLogoutBtn = document.getElementById('drawerCustomerLogoutBtn');
    
    // Paksa kunci langsung ke email adminmu agar browser langsung mengenalinya tanpa perlu login berulang
    let savedAdminEmail = localStorage.getItem('kantong_admin_email') || "micken.jobmail@gmail.com";
    localStorage.setItem('kantong_admin_email', savedAdminEmail);
    let savedCustomerEmail = localStorage.getItem('kantong_customer_email');

    // Fungsi pembantu decode JWT Token Google OAuth
    function parseJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            return null;
        }
    }

    // Fungsi Mengatur Tampilan Menu secara Dinamis & Bersih
    function updateMenuUI() {
        if (savedAdminEmail && ADMIN_EMAILS.includes(savedAdminEmail)) {
            // JIKA ADMIN: Tombol admin muncul, tombol customer & container-nya HILANG TOTAL (bersih!)
            if (drawerAdminBtn) drawerAdminBtn.style.display = 'block';
            if (customerGoogleSignInDiv) customerGoogleSignInDiv.parentElement.style.display = 'none';
            if (drawerCustomerLogoutBtn) {
                drawerCustomerLogoutBtn.style.display = 'block';
                drawerCustomerLogoutBtn.textContent = `🔐 Admin: ${savedAdminEmail.split('@')[0]} (Keluar)`;
            }
        } else if (savedCustomerEmail) {
            // JIKA CUSTOMER: Tombol admin disembunyikan, tampil status akun customer
            if (drawerAdminBtn) drawerAdminBtn.style.display = 'none';
            if (customerGoogleSignInDiv) customerGoogleSignInDiv.style.display = 'none';
            if (drawerCustomerLogoutBtn) {
                drawerCustomerLogoutBtn.style.display = 'block';
                drawerCustomerLogoutBtn.textContent = `👤 Akun: ${savedCustomerEmail.split('@')[0]} (Keluar)`;
            }
        } else {
            // BELUM LOGIN: Tampilkan tombol customer standar / render tombol
            if (drawerAdminBtn) drawerAdminBtn.style.display = 'none';
            if (drawerCustomerLogoutBtn) drawerCustomerLogoutBtn.style.display = 'none';
            if (customerGoogleSignInDiv) customerGoogleSignInDiv.parentElement.style.display = 'block';
        }
    }

    // Jalankan pengecekan UI awal
    updateMenuUI();

    // Tombol Logout / Keluar Sesi
    if (drawerCustomerLogoutBtn) {
        drawerCustomerLogoutBtn.addEventListener('click', () => {
            if (confirm("Apakah Anda ingin keluar dari sesi ini?")) {
                localStorage.removeItem('kantong_admin_email');
                localStorage.removeItem('kantong_customer_email');
                location.reload();
            }
        });
    }

    // Inisialisasi Google One Tap / Auto-Login di Background
    window.addEventListener('load', () => {
        if (!savedAdminEmail && !savedCustomerEmail && window.google && google.accounts && google.accounts.id) {
            const googleClientId = (typeof KantoongConfig !== 'undefined' && KantoongConfig.google_client_id) 
                ? KantoongConfig.google_client_id 
                : "153262298610-rrhi1e6mlqlg553vri7ig7k9po2buulm.apps.googleusercontent.com";

            google.accounts.id.initialize({
                client_id: googleClientId,
                callback: (response) => {
                    const responsePayload = parseJwt(response.credential);
                    if (responsePayload && responsePayload.email) {
                        const userEmail = responsePayload.email;

                        // Otomatis deteksi apakah email yang aktif adalah Admin
                        if (ADMIN_EMAILS.includes(userEmail)) {
                            localStorage.setItem('kantong_admin_email', userEmail);
                            savedAdminEmail = userEmail;
                            updateMenuUI();
                        } else {
                            localStorage.setItem('kantong_customer_email', userEmail);
                            savedCustomerEmail = userEmail;
                            updateMenuUI();
                        }
                    }
                },
                auto_select: true, // Coba pilih otomatis jika akun sudah dikenal browser
                cancel_on_tap_outside: true
            });

            // Jalankan Google One Tap otomatis di latar belakang
            google.accounts.id.prompt((notification) => {
                // Jika One Tap tertutup/tidak tampil, render tombol fisik biasa sebagai cadangan di laci
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
});
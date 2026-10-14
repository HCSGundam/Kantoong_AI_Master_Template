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
            // Inisialisasi ulang tombol Google saat laci dibuka agar selalu siap
            initGoogleAuthUI();
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
    // 4. SISTEM DUAL-AUTH ADAPTIF & RENDER BUTTON RESMI
    // ==========================================
    
    const ADMIN_EMAILS = [
        "micken.jobmail@gmail.com" // Email whitelist admin resmi
    ];

    const drawerAdminBtn = document.getElementById('drawerAdminBtn');
    const customerGoogleSignInDiv = document.getElementById('customerGoogleSignInDiv');
    const drawerCustomerLogoutBtn = document.getElementById('drawerCustomerLogoutBtn');
    
    const savedAdminEmail = localStorage.getItem('kantong_admin_email');
    const savedCustomerEmail = localStorage.getItem('kantong_customer_email');

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

    // Atur Tampilan Menu Berdasarkan Status Login (Admin vs Customer)
    if (savedAdminEmail && ADMIN_EMAILS.includes(savedAdminEmail)) {
        // Jika yang login adalah Admin
        if (drawerAdminBtn) drawerAdminBtn.style.display = 'block';
        if (customerGoogleSignInDiv) customerGoogleSignInDiv.style.display = 'none';
        if (drawerCustomerLogoutBtn) {
            drawerCustomerLogoutBtn.style.display = 'block';
            drawerCustomerLogoutBtn.textContent = `🔐 Admin: ${savedAdminEmail.split('@')[0]} (Keluar)`;
        }
    } else if (savedCustomerEmail) {
        // Jika yang login adalah Customer biasa
        if (drawerAdminBtn) drawerAdminBtn.style.display = 'none';
        if (customerGoogleSignInDiv) customerGoogleSignInDiv.style.display = 'none';
        if (drawerCustomerLogoutBtn) {
            drawerCustomerLogoutBtn.style.display = 'block';
            drawerCustomerLogoutBtn.textContent = `👤 Akun: ${savedCustomerEmail.split('@')[0]} (Keluar)`;
        }
    } else {
        // Belum login sama sekali
        if (drawerAdminBtn) drawerAdminBtn.style.display = 'none';
        if (customerGoogleSignInDiv) customerGoogleSignInDiv.style.display = 'block';
        if (drawerCustomerLogoutBtn) drawerCustomerLogoutBtn.style.display = 'none';
    }

    // Tombol Logout / Keluar Akun
    if (drawerCustomerLogoutBtn) {
        drawerCustomerLogoutBtn.addEventListener('click', () => {
            if (confirm("Apakah Anda ingin keluar dari sesi akun ini?")) {
                localStorage.removeItem('kantong_admin_email');
                localStorage.removeItem('kantong_customer_email');
                alert("Berhasil keluar.");
                location.reload();
            }
        });
    }

    // Inisialisasi Tombol Fisik Google Sign-In
    function initGoogleAuthUI() {
        if (!savedCustomerEmail && !savedAdminEmail && window.google && google.accounts && google.accounts.id) {
            const googleClientId = (typeof KantoongConfig !== 'undefined' && KantoongConfig.google_client_id) 
                ? KantoongConfig.google_client_id 
                : "153262298610-rrhi1e6mlqlg553vri7ig7k9po2buulm.apps.googleusercontent.com";

            google.accounts.id.initialize({
                client_id: googleClientId,
                callback: (response) => {
                    const responsePayload = parseJwt(response.credential);
                    if (responsePayload && responsePayload.email) {
                        const userEmail = responsePayload.email;

                        // Cek apakah email yang login adalah admin
                        if (ADMIN_EMAILS.includes(userEmail)) {
                            localStorage.setItem('kantong_admin_email', userEmail);
                            alert("Login Admin Berhasil! Selamat datang, " + responsePayload.name);
                            location.reload();
                        } else {
                            // Sesi customer tersimpan aman (Remember Me)
                            localStorage.setItem('kantong_customer_email', userEmail);
                            alert("Login Customer Berhasil! Selamat berbelanja, " + responsePayload.name);
                            location.reload();
                        }
                    }
                }
            });

            // Render tombol fisik resmi Google ke dalam elemen laci menu
            if (customerGoogleSignInDiv && customerGoogleSignInDiv.innerHTML.trim() === "") {
                google.accounts.id.renderButton(
                    customerGoogleSignInDiv,
                    { theme: "outline", size: "large", width: "240px", text: "signin_with" }
                );
            }
        }
    }

    // Jalankan inisialisasi saat halaman dimuat
    setTimeout(initGoogleAuthUI, 500);

    // Aksi Tombol Admin (Membuka Dashboard Admin)
    if (drawerAdminBtn) {
        drawerAdminBtn.addEventListener('click', () => {
            if (drawer) drawer.style.display = 'none';

            fetch('components/admin-dashboard.html')
                .then(res => {
                    if (!res.ok) throw new Error("File komponen admin tidak ditemukan");
                    return res.text();
                })
                .then(html => {
                    if (container) {
                        container.innerHTML = html;
                        
                        const closeAdminModal = container.querySelector('#closeAdminModal');
                        if (closeAdminModal) {
                            closeAdminModal.addEventListener('click', () => {
                                container.innerHTML = '';
                            });
                        }
                    }
                })
                .catch(err => alert("Info: " + err.message));
        });
    }
});
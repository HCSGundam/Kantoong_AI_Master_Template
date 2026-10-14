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
    document.querySelectorAll('.sample-item-btn:not(.disabled):not(#drawerAdminBtn):not(#drawerCustomerBtn)').forEach(btn => {
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
    // 4. SISTEM DUAL-AUTH ADAPTIF (CUSTOMER VS ADMIN)
    // ==========================================
    
    const ADMIN_EMAILS = [
        "micken.jobmail@gmail.com" // Email whitelist admin resmi
    ];

    const drawerAdminBtn = document.getElementById('drawerAdminBtn');
    const drawerCustomerBtn = document.getElementById('drawerCustomerBtn');
    
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

    // Logika Switch Tampilan Menu Berdasarkan Peran (Admin vs Customer)
    if (drawerAdminBtn && drawerCustomerBtn) {
        if (savedAdminEmail && ADMIN_EMAILS.includes(savedAdminEmail)) {
            // JIKA YANG LOGIN ADALAH ADMIN: Tampilkan tombol admin, sembunyikan tombol customer
            drawerAdminBtn.style.display = 'block';
            drawerCustomerBtn.style.display = 'none';
        } else {
            // JIKA YANG LOGIN CUSTOMER ATAU BELUM LOGIN: Tampilkan tombol customer, sembunyikan tombol admin
            drawerAdminBtn.style.display = 'none';
            drawerCustomerBtn.style.display = 'block';

            if (savedCustomerEmail) {
                drawerCustomerBtn.textContent = `👤 Akun: ${savedCustomerEmail.split('@')[0]} (Keluar)`;
            }
        }

        // Aksi Tombol Customer (Google OAuth Terbuka untuk Publik)
        drawerCustomerBtn.addEventListener('click', () => {
            if (savedCustomerEmail) {
                // Jika sudah login, klik untuk opsi logout/ganti akun
                if (confirm("Keluar dari akun customer " + savedCustomerEmail + "?")) {
                    localStorage.removeItem('kantong_customer_email');
                    alert("Berhasil keluar.");
                    location.reload();
                }
                return;
            }

            if (drawer) drawer.style.display = 'none';

            // Munculkan popup Google Sign-In publik untuk customer
            if (window.google && google.accounts && google.accounts.id) {
                const googleClientId = (typeof KantoongConfig !== 'undefined' && KantoongConfig.google_client_id) 
                    ? KantoongConfig.google_client_id 
                    : "153262298610-rrhi1e6mlqlg553vri7ig7k9po2buulm.apps.googleusercontent.com";

                google.accounts.id.initialize({
                    client_id: googleClientId,
                    callback: (response) => {
                        const responsePayload = parseJwt(response.credential);
                        if (responsePayload && responsePayload.email) {
                            const userEmail = responsePayload.email;

                            // Cek apakah email customer ini ternyata adalah email admin
                            if (ADMIN_EMAILS.includes(userEmail)) {
                                // Otomatis alihkan ke mode admin!
                                localStorage.setItem('kantong_admin_email', userEmail);
                                alert("Selamat datang Admin " + responsePayload.name + "! Mode dialihkan ke Dashboard Pengelola.");
                                location.reload();
                            } else {
                                // Simpan sesi customer (Remember Me via localStorage)
                                localStorage.setItem('kantong_customer_email', userEmail);
                                alert("Login Customer Berhasil! Selamat berbelanja, " + responsePayload.name);
                                location.reload();
                            }
                        }
                    }
                });

                // Prompt otomatis pop-up Google Sign-In untuk customer
                google.accounts.id.prompt((notification) => {
                    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                        // Fallback jika prompt diblokir browser, arahkan ke halaman/modal login
                        alert("Silakan aktifkan pop-up browser atau gunakan akun Google Anda untuk melanjutkan.");
                    }
                });
            } else {
                alert("Modul Google Sign-In sedang dimuat, coba sesaat lagi.");
            }
        });

        // Aksi Tombol Admin (Membuka Dashboard Admin)
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
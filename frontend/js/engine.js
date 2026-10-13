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

    // 3. Load Komponen Modular BIASA (Kecuali tombol admin)
    document.querySelectorAll('.sample-item-btn:not(.disabled):not(#drawerAdminBtn)').forEach(btn => {
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
    // 4. SISTEM MANDIRI CLIENT-SIDE ADMIN AUTH (TANPA LOCALHOST)
    // ==========================================
    
    // Daftar Whitelist Email Admin Resmi Kamu
    const ADMIN_EMAILS = [
        "micken.jobmail@gmail.com" // Ganti/tambah email admin lainnya di sini jika perlu
    ];

    const drawerAdminBtn = document.getElementById('drawerAdminBtn');
    const savedAdminEmail = localStorage.getItem('kantong_admin_email');

    // Fungsi pembantu untuk decode JWT Token dari Google OAuth
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

    // Cek apakah di sesi browser ini sudah tersimpan email admin yang sah
    if (drawerAdminBtn) {
        if (savedAdminEmail && ADMIN_EMAILS.includes(savedAdminEmail)) {
            // Jika sudah tervalidasi sebelumnya, langsung tampilkan tombol admin di menu
            drawerAdminBtn.style.display = 'block';
        } else {
            drawerAdminBtn.style.display = 'none';
            localStorage.removeItem('kantong_admin_email');
        }

        // Aksi saat tombol "Masuk ke Dashboard Admin" diklik
        drawerAdminBtn.addEventListener('click', () => {
            if (drawer) drawer.style.display = 'none';

            // Muat komponen admin-dashboard.html
            fetch('components/admin-dashboard.html')
                .then(res => {
                    if (!res.ok) throw new Error("File komponen admin tidak ditemukan");
                    return res.text();
                })
                .then(html => {
                    if (container) {
                        container.innerHTML = html;
                        
                        // Tombol tutup modal admin
                        const closeAdminModal = container.querySelector('#closeAdminModal');
                        if (closeAdminModal) {
                            closeAdminModal.addEventListener('click', () => {
                                container.innerHTML = '';
                            });
                        }

                        // Inisialisasi Google Sign-In (OAuth Popup) di dalam modal admin
                        if (window.google && google.accounts && google.accounts.id) {
                            // Ambil Client ID dari konfigurasi atau isi langsung
                            const googleClientId = (typeof KantoongConfig !== 'undefined' && KantoongConfig.google_client_id) 
                                ? KantoongConfig.google_client_id 
                                : "153262298610-iskanclientidanda.apps.googleusercontent.com"; // Pastikan Client ID sesuai

                            google.accounts.id.initialize({
                                client_id: googleClientId,
                                callback: (response) => {
                                    const responsePayload = parseJwt(response.credential);
                                    if (responsePayload && responsePayload.email) {
                                        const userEmail = responsePayload.email;

                                        // Validasi apakah email yang login masuk dalam whitelist ADMIN_EMAILS
                                        if (ADMIN_EMAILS.includes(userEmail)) {
                                            localStorage.setItem('kantong_admin_email', userEmail);
                                            alert("Login Admin Berhasil! Selamat datang, " + responsePayload.name);
                                            location.reload(); // Refresh halaman untuk mengunci sesi admin
                                        } else {
                                            alert("Akses Ditolak: Akun Google (" + userEmail + ") bukan admin resmi toko ini!");
                                        }
                                    }
                                }
                            });

                            // Render tombol Google Sign-In otomatis ke elemen ber-ID 'googleSignInDiv' di modal admin
                            const signInDiv = container.querySelector('#googleSignInDiv');
                            if (signInDiv) {
                                google.accounts.id.renderButton(
                                    signInDiv,
                                    { theme: "outline", size: "large", width: "100%" }
                                );
                            }
                        }
                    }
                })
                .catch(err => alert("Info: " + err.message));
        });
    }
});
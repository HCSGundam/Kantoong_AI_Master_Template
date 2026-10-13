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
            if (!compFile) return; // Lindungi dari nilai null
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

    // 4. Cek otomatis apakah perangkat ini milik Admin yang sah & Tangani Tombol Admin
    const savedAdminEmail = localStorage.getItem('kantong_admin_email');
    const drawerAdminBtn = document.getElementById('drawerAdminBtn');

    if (drawerAdminBtn) {
        if (savedAdminEmail) {
            fetch('http://localhost:5000/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: savedAdminEmail })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    drawerAdminBtn.style.display = 'block';
                } else {
                    drawerAdminBtn.style.display = 'none';
                    localStorage.removeItem('kantong_admin_email');
                }
            })
            .catch(err => {
                drawerAdminBtn.style.display = 'none';
            });
        } else {
            drawerAdminBtn.style.display = 'none';
        }

        // Aksi khusus saat tombol menu admin diklik
        drawerAdminBtn.addEventListener('click', () => {
            const drawer = document.getElementById('sampleDrawer');
            if (drawer) drawer.style.display = 'none';

            // Path yang benar dan bersih
            fetch('components/admin-dashboard.html')
                .then(res => {
                    if (!res.ok) throw new Error("File komponen admin tidak ditemukan");
                    return res.text();
                })
                .then(html => {
                    if (container) {
                        container.innerHTML = html;
                        // Aktifkan tombol tutup modal admin jika ada
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



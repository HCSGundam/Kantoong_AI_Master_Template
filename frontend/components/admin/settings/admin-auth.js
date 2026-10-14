/**
 * Module: Admin Authentication & Session Management (admin-auth.js)
 * Description: Menangani verifikasi sesi login admin, status whitelist, 
 * dan manajemen tombol keluar (logout) secara aman dan modular.
 */

(function initAdminAuth() {
    const ADMIN_WHITELIST = [
        'micken.jobmail@gmail.com' // Email pengelola utama yang diizinkan
    ];

    function verifySession() {
        const currentEmail = localStorage.getItem('kantong_admin_email');
        
        // Jika belum ada email sesi tersimpan, arahkan atau beri peringatan modular
        if (!currentEmail) {
            console.warn('[AdminAuth] Tidak ada sesi aktif yang terdeteksi di LocalStorage.');
            return false;
        }

        // Validasi whitelist
        if (!ADMIN_WHITELIST.includes(currentEmail)) {
            console.error('[AdminAuth] Akses ditolak: Email tidak terdaftar dalam whitelist.');
            return false;
        }

        return true;
    }

    // Fungsi global untuk proses keluar sesi (logout)
    window.handleAdminLogout = function() {
        if (confirm('Apakah Anda ingin mengakhiri sesi pengelola ini?')) {
            localStorage.removeItem('kantong_admin_email');
            alert('Sesi berhasil diakhiri.');
            window.location.reload();
        }
    };

    // Jalankan verifikasi awal saat skrip dimuat
    const isSessionValid = verifySession();
    if (!isSessionValid) {
        // Logika tambahan jika ingin mengunci panel atau menampilkan form login sandi
        console.info('[AdminAuth] Menunggu autentikasi kredensial pengguna.');
    }
})();
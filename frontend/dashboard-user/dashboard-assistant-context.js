/**
 * KANTOONG — KONTEKS ASISTEN AI DI DASHBOARD USER
 * File: frontend/dashboard-user/dashboard-assistant-context.js
 *
 * Asisten yang sama dengan toko & ERP, mulai sebagai orb bulat bermata.
 * `page` dibaca ulang setiap pesan dikirim, jadi AI langsung tahu fitur apa
 * yang sedang dibuka (Katalog, Pesanan, dll.) tanpa perlu diingatkan.
 * Asisten tidak menyapa duluan dengan pesan panjang: pengguna yang memulai.
 */
window.KantoongAssistantContext = {
    surface: "dashboard",
    // Desktop: melayang bebas + bisa menempel kiri/kanan atau belah layar (HP: tidak).
    free: true,
    dock: true,
    startMinimized: true,
    greetings: ["Ada yang bisa kubantu di ruang pribadimu?"],
    suggestions: [
        "Pesananku sudah sampai mana?",
        "Carikan produk yang cocok untukku",
        "Cara mengatur ulang menu dashboard?",
        "Bagaimana menghapus data saya?",
    ],
    page() {
        const stage = document.querySelector(".dashboard-feature-stage .dashboard-feature-stage__title");
        if (stage) return `fitur "${stage.textContent.trim()}" di dashboard pengguna`;
        if (document.querySelector(".bx-shelf.is-open")) return "lemari Tambah fitur di dashboard pengguna";
        if (document.querySelector('.bx-grid[data-editing="true"]')) return "mode atur tata letak menu dashboard";
        return "beranda dashboard pengguna (menu kartu fitur)";
    },
};

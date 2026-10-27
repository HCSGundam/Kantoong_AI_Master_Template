/**
 * KANTOONG CORE — FEATURE HUB: KATALOG
 * File: frontend/dashboard-user/feature-hub/feature-hub-catalog.js
 *
 * Daftar RENCANA fitur (31 fitur template) beserta kontrak klien.
 *
 * ATURAN MAIN:
 * - Fitur yang folder + feature.js-nya ADA   -> berstatus "published".
 * - Fitur di daftar ini yang folder-nya BELUM ada -> otomatis tampil
 *   sebagai "Coming soon" (gelap, tidak bisa diklik).
 * - Saat fitur selesai dibuat (features/<id>/feature.js), Coming soon
 *   berubah jadi rilis. Isi `publishedAt: "YYYY-MM-DD"` pada feature.js
 *   agar tag NEW tampil selama NEW_TAG_DAYS hari.
 *
 * Tidak perlu mengubah file lain untuk menambah fitur baru: cukup
 * tambahkan satu baris di HUB_FEATURES.
 */

/** Lama tag NEW tampil setelah fitur dirilis (hari). */
export const NEW_TAG_DAYS = 14;

/**
 * Kontrak klien — atur per brand.
 *
 * enabledIds     : null = semua fitur template; atau daftar ID yang
 *                  termasuk kontrak, mis. ["profile", "settings"].
 * hiddenIds      : ID yang disembunyikan sama sekali.
 * addonIds       : ID add-on berbayar yang sudah dibeli klien.
 * showAllForDemo : true = tampilkan juga add-on yang belum dibeli
 *                  (untuk demo/presentasi). Ubah ke false untuk klien nyata.
 */
export const CLIENT_CONTRACT = Object.freeze({
    enabledIds: null,
    hiddenIds: [],
    addonIds: [],
    showAllForDemo: true,
});

/** Kategori di halaman Feature Hub (urutan = urutan tampil). */
export const HUB_CATEGORIES = Object.freeze([
    {
        id: "account",
        label: "Akun dan Profil",
        description: "Identitas dan pengaturan pribadi pengguna.",
    },
    {
        id: "orders",
        label: "Pesanan dan Pengiriman",
        description: "Pantau pesanan, alamat, dan pembayaran.",
    },
    {
        id: "shopping",
        label: "Belanja",
        description: "Jelajahi produk dan simpan yang kamu suka.",
    },
    {
        id: "insights",
        label: "Ringkasan Aktivitas",
        description: "Riwayat dan gambaran belanjamu.",
    },
    {
        id: "engagement",
        label: "Promo dan Hadiah",
        description: "Voucher, poin, dan keuntungan anggota.",
    },
    {
        id: "support",
        label: "Bantuan dan Komunikasi",
        description: "Hubungi tim brand dan lihat percakapanmu.",
    },
    {
        id: "venue",
        label: "Lokasi dan Layanan Tempat",
        description: "Cabang, menu, denah, dan reservasi.",
    },
    {
        id: "settings",
        label: "Pengaturan dan Data",
        description: "Atur tampilan dan kelola datamu.",
    },
]);

/**
 * tier: "package" = termasuk paket industri (tanpa biaya tambahan).
 *       "addon"   = di luar paket (biaya tambahan sesuai kontrak).
 */
export const HUB_FEATURES = Object.freeze([
    // ---- Akun dan Profil
    { id: "profile", title: "Profil", icon: "\u{1F464}", category: "account", tier: "package",
      description: "Kelola informasi profil, identitas akun, dan preferensi pribadi.",
      keywords: ["profil", "profile", "akun", "identitas", "nama", "email", "pusat akun", "login"] },
    { id: "membership", title: "Keanggotaan", icon: "\u{1F451}", category: "account", tier: "package",
      description: "Lihat level anggota dan keuntungannya.",
      keywords: ["member", "anggota", "level", "vip", "keanggotaan"] },
    { id: "security", title: "Keamanan Akun", icon: "\u{1F512}", category: "account", tier: "package",
      description: "Atur kata sandi dan perangkat yang masuk.",
      keywords: ["password", "kata sandi", "keamanan", "perangkat", "login"] },

    // ---- Pesanan dan Pengiriman
    { id: "shipping-address", title: "Alamat Pengiriman", icon: "\u{1F4CD}", category: "orders", tier: "package",
      description: "Kelola alamat rumah dan tujuan kirim.",
      keywords: ["alamat", "kirim", "rumah", "ganti alamat", "tujuan"] },
    { id: "package-tracking", title: "Lacak Paket", icon: "\u{1F69A}", category: "orders", tier: "package",
      description: "Pantau perjalanan pesananmu.",
      keywords: ["resi", "kurir", "lacak", "paket", "pengiriman", "belum datang", "tracking", "ekspedisi"] },
    { id: "my-orders", title: "Pesanan Saya", icon: "\u{1F4E6}", category: "orders", tier: "package",
      description: "Status pesanan dan detail pembelian.",
      keywords: ["pesanan", "order", "status", "diproses", "dimasak", "antrean", "waiting list"] },
    { id: "returns", title: "Retur dan Refund", icon: "\u21A9\uFE0F", category: "orders", tier: "package",
      description: "Ajukan pengembalian barang dan dana.",
      keywords: ["retur", "refund", "kembalikan", "rusak", "salah kirim", "batal"] },
    { id: "payment-methods", title: "Metode Pembayaran", icon: "\u{1F4B3}", category: "orders", tier: "package",
      description: "Kelola cara bayar yang kamu pakai.",
      keywords: ["bayar", "pembayaran", "kartu", "ewallet", "transfer"] },

    // ---- Belanja
    { id: "product-catalog", title: "Katalog Produk Lengkap", icon: "\u{1F6CD}\uFE0F", category: "shopping", tier: "package",
      description: "Jelajahi produk, varian, dan harga dalam satu tempat.",
      keywords: ["katalog", "produk", "belanja", "toko", "cari barang"] },
    { id: "wishlist", title: "Wishlist Saya", icon: "\u{1F90D}", category: "shopping", tier: "package",
      description: "Simpan produk favoritmu.",
      keywords: ["wishlist", "favorit", "simpan", "suka"] },
    { id: "product-reviews", title: "Ulasan dan Selfie", icon: "\u2B50", category: "shopping", tier: "package",
      description: "Tulis ulasan dan bagikan fotomu.",
      keywords: ["ulasan", "review", "bintang", "foto", "selfie", "rating"] },
    { id: "reorder", title: "Pesan Ulang", icon: "\u{1F501}", category: "shopping", tier: "package",
      description: "Beli lagi barang yang pernah kamu pesan.",
      keywords: ["pesan ulang", "beli lagi", "langganan", "repeat"] },

    // ---- Ringkasan Aktivitas
    { id: "transaction-history", title: "Riwayat Transaksi", icon: "\u{1F9FE}", category: "insights", tier: "package",
      description: "Produk, harga, cabang, dan tanggal.",
      keywords: ["transaksi", "riwayat", "nota", "struk", "pembelian"] },
    { id: "total-spending", title: "Total Belanja", icon: "\u{1F4B0}", category: "insights", tier: "package",
      description: "Ringkasan pengeluaran di brand ini.",
      keywords: ["total", "pengeluaran", "belanja", "habis berapa"] },
    { id: "spending-analytics", title: "Analitik Belanja", icon: "\u{1F4CA}", category: "insights", tier: "package",
      description: "Pahami kategori dan pola belanjamu.",
      keywords: ["analitik", "grafik", "pola", "kategori", "statistik"] },
    { id: "calendar", title: "Kalender Aktivitas", icon: "\u{1F4C5}", category: "insights", tier: "package",
      description: "Jadwal promo dan aktivitas brand.",
      keywords: ["kalender", "jadwal", "event", "acara", "promo"] },

    // ---- Promo dan Hadiah
    { id: "vouchers-promos", title: "Voucher dan Promo", icon: "\u{1F39F}\uFE0F", category: "engagement", tier: "package",
      description: "Penawaran, kode, dan hadiah brand.",
      keywords: ["voucher", "promo", "diskon", "kupon", "kode", "potongan"] },
    { id: "loyalty-points", title: "Poin dan Tukar Hadiah", icon: "\u{1F381}", category: "engagement", tier: "package",
      description: "Kumpulkan poin dan tukar dengan hadiah.",
      keywords: ["poin", "tukar", "hadiah", "reward", "loyalty"] },
    { id: "referral", title: "Undang Teman", icon: "\u{1F91D}", category: "engagement", tier: "package",
      description: "Ajak temanmu dan dapatkan bonus.",
      keywords: ["undang", "teman", "referral", "bonus", "ajak"] },
    { id: "gift-cards", title: "Kartu Hadiah", icon: "\u{1F48C}", category: "engagement", tier: "addon",
      description: "Beli dan kirim kartu hadiah.",
      keywords: ["kartu hadiah", "gift", "kado", "hadiah"] },

    // ---- Bantuan dan Komunikasi
    { id: "ai-chat-history", title: "Riwayat Chat AI", icon: "\u{1F4AC}", category: "support", tier: "package",
      description: "Temukan percakapan sebelumnya.",
      keywords: ["chat", "konsultasi", "percakapan", "riwayat chat", "ai"] },
    { id: "customer-support", title: "Chat Customer Service", icon: "\u{1F3A7}", category: "support", tier: "package",
      description: "Hubungi tim bantuan brand.",
      keywords: ["cs", "customer service", "bantuan", "komplain", "hubungi", "keluhan"] },
    { id: "help-center", title: "Pusat Bantuan", icon: "\u2753", category: "support", tier: "package",
      description: "Jawaban untuk pertanyaan yang sering muncul.",
      keywords: ["faq", "bantuan", "pertanyaan", "cara", "panduan"] },
    { id: "notifications", title: "Notifikasi", icon: "\u{1F514}", category: "support", tier: "package",
      description: "Pemberitahuan pesanan dan promo untukmu.",
      keywords: ["notifikasi", "pemberitahuan", "pesan masuk", "info"] },

    // ---- Lokasi dan Layanan Tempat
    { id: "store-map", title: "Peta Toko", icon: "\u{1F5FA}\uFE0F", category: "venue", tier: "package",
      description: "Temukan lokasi toko dan jam buka.",
      keywords: ["peta", "lokasi", "toko", "maps", "jam buka", "alamat toko"] },
    { id: "digital-menu", title: "Menu Digital", icon: "\u{1F4D6}", category: "venue", tier: "package",
      description: "Lihat daftar menu lengkap dengan harga.",
      keywords: ["menu", "makanan", "minuman", "harga menu", "daftar menu"] },
    { id: "branch-selector", title: "Pilih Cabang", icon: "\u{1F3EC}", category: "venue", tier: "addon",
      description: "Pilih cabang terdekat dan lihat info tiap cabang.",
      keywords: ["cabang", "outlet", "terdekat", "lokasi lain"] },
    { id: "table-booking", title: "Booking Meja", icon: "\u{1F37D}\uFE0F", category: "venue", tier: "addon",
      description: "Pesan meja untuk makan bersama, dengan DP.",
      keywords: ["booking", "reservasi", "meja", "dp", "ulang tahun", "dinner", "pesan tempat"] },
    { id: "floor-plan", title: "Denah Lokasi", icon: "\u{1F9ED}", category: "venue", tier: "addon",
      description: "Lihat denah bangunan, meja, dan fasilitas.",
      keywords: ["denah", "wc", "toilet", "ruangan", "3d", "peta dalam", "musholla"] },

    // ---- Pengaturan dan Data
    { id: "settings", title: "Pengaturan Aplikasi", icon: "\u2699\uFE0F", category: "settings", tier: "package",
      description: "Tema, tata letak, dan privasi.",
      keywords: ["pengaturan", "setting", "tema", "gelap", "terang", "bahasa", "notifikasi"] },
    { id: "data-export", title: "Export Data", icon: "\u2B07\uFE0F", category: "settings", tier: "package",
      description: "Unduh salinan datamu.",
      keywords: ["export", "unduh", "download", "data saya", "salinan"] },
]);

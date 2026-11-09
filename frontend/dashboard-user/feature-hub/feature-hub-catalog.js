/**
 * KANTOONG CORE — FEATURE HUB: KATALOG
 * File: frontend/dashboard-user/feature-hub/feature-hub-catalog.js
 *
 * Daftar 31 fitur KANTOONG Core (Blueprint Vol.7 hal. 185-187) beserta
 * kontrak klien.
 *
 * ATURAN MAIN:
 * - Fitur yang folder + feature.js-nya ADA   -> berstatus "published".
 * - Fitur di daftar ini yang folder-nya BELUM ada -> otomatis tampil
 *   sebagai "Segera hadir" (tidak bisa ditambahkan).
 * - Saat fitur selesai dibuat (features/<id>/feature.js), "Segera hadir"
 *   berubah jadi rilis. Isi `publishedAt: "YYYY-MM-DD"` pada feature.js
 *   agar tag BARU tampil selama NEW_TAG_DAYS hari.
 */

/** Lama tag BARU tampil setelah fitur dirilis (hari). */
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

/** Kategori fitur (urutan = urutan tampil). */
export const HUB_CATEGORIES = Object.freeze([
    { id: "account", label: "Akun", description: "Identitas dan pengaturan pribadi." },
    { id: "orders", label: "Pesanan & Pengiriman", description: "Pantau pesanan, alamat, dan pembayaran." },
    { id: "shopping", label: "Belanja", description: "Jelajahi produk dan simpan yang kamu suka." },
    { id: "insights", label: "Ringkasan Aktivitas", description: "Riwayat dan gambaran belanjamu." },
    { id: "engagement", label: "Promo & Hadiah", description: "Voucher, poin, dan keuntungan anggota." },
    { id: "support", label: "Bantuan", description: "Hubungi tim brand dan lihat percakapanmu." },
    { id: "venue", label: "Tempat & Layanan", description: "Lokasi, reservasi, antrean, dan takeaway." },
    { id: "media", label: "Media & Hiburan", description: "Video, musik, unggahan, dan suara." },
    { id: "settings", label: "Pengaturan & Data", description: "Tampilan, bahasa, dan datamu." },
]);

/**
 * tier: "package" = termasuk paket industri (tanpa biaya tambahan).
 *       "addon"   = di luar paket (biaya tambahan sesuai kontrak).
 */
export const HUB_FEATURES = Object.freeze([
    { id: "profile", title: "Profil", category: "account", tier: "package",
      description: "Avatar, nama, dan sapaan personal.",
      keywords: ["profil", "akun", "identitas", "nama", "email", "login", "masuk"] },
    { id: "shipping-address", title: "Alamat Pengiriman", category: "orders", tier: "package",
      description: "Alamat utama dengan pin lokasi rumah/kantor.",
      keywords: ["alamat", "kirim", "rumah", "kantor", "tujuan"] },
    { id: "package-tracking", title: "Lacak Paket", category: "orders", tier: "package",
      description: "Posisi paketmu dalam sekali lihat.",
      keywords: ["resi", "kurir", "lacak", "paket", "pengiriman", "belum datang", "tracking"] },
    { id: "my-orders", title: "Pesanan Saya", category: "orders", tier: "package",
      description: "Pesanan aktif dan statusnya.",
      keywords: ["pesanan", "order", "status", "diproses"] },
    { id: "transaction-history", title: "Riwayat Transaksi", category: "insights", tier: "package",
      description: "Transaksi terbaru dan totalnya.",
      keywords: ["transaksi", "riwayat", "nota", "struk", "pembelian"] },
    { id: "product-catalog", title: "Katalog Produk", category: "shopping", tier: "package",
      description: "Semua produk brand, lengkap dengan filter dan pencarian.",
      keywords: ["katalog", "produk", "belanja", "toko", "cari barang", "filter", "semua produk"] },
    { id: "total-spending", title: "Total Belanja", category: "insights", tier: "package",
      description: "Pengeluaranmu di brand ini.",
      keywords: ["total", "pengeluaran", "belanja", "habis berapa"] },
    { id: "spending-analytics", title: "Analitik Belanja", category: "insights", tier: "package",
      description: "Pola belanjamu dalam grafik mini.",
      keywords: ["analitik", "grafik", "pola", "kategori", "statistik"] },
    { id: "calendar", title: "Kalender", category: "insights", tier: "package",
      description: "Tanggal penting dan agenda terdekat.",
      keywords: ["kalender", "jadwal", "event", "acara", "agenda"] },
    { id: "wishlist", title: "Wishlist", category: "shopping", tier: "package",
      description: "Produk favoritmu dalam gambar mini.",
      keywords: ["wishlist", "favorit", "simpan", "suka", "disukai"] },
    { id: "product-reviews", title: "Ulasan", category: "shopping", tier: "package",
      description: "Rating dan ulasan terbarumu.",
      keywords: ["ulasan", "review", "bintang", "rating", "selfie"] },
    { id: "vouchers-promos", title: "Voucher & Promo", category: "engagement", tier: "package",
      description: "Voucher unggulan dan potongannya.",
      keywords: ["voucher", "promo", "diskon", "kupon", "kode", "potongan"] },
    { id: "ai-chat-history", title: "Riwayat Chat AI", category: "support", tier: "package",
      description: "Percakapan terakhirmu dengan asisten.",
      keywords: ["chat", "konsultasi", "percakapan", "riwayat chat", "ai", "asisten"] },
    { id: "customer-support", title: "Customer Service", category: "support", tier: "package",
      description: "Hubungi tim bantuan brand.",
      keywords: ["cs", "customer service", "bantuan", "komplain", "hubungi", "keluhan", "whatsapp"] },
    { id: "settings", title: "Pengaturan", category: "settings", tier: "package",
      description: "Preferensi tampilan dan privasi.",
      keywords: ["pengaturan", "setting", "tema", "gelap", "terang", "privasi"] },
    { id: "data-export", title: "Ekspor Data", category: "settings", tier: "package",
      description: "Unduh salinan datamu.",
      keywords: ["export", "ekspor", "unduh", "download", "data saya"] },
    { id: "store-map", title: "Lokasi Toko", category: "venue", tier: "package",
      description: "Miniatur peta lokasi toko utama.",
      keywords: ["peta", "lokasi", "toko", "maps", "jam buka", "alamat toko", "cabang"] },
    { id: "membership", title: "Poin Member", category: "engagement", tier: "package",
      description: "Saldo poin dan hadiahmu.",
      keywords: ["poin", "member", "hadiah", "reward", "loyalty", "tukar"] },
    { id: "video-feed", title: "Video Feed", category: "media", tier: "addon",
      description: "Video produk terbaru yang relevan.",
      keywords: ["video", "reels", "tiktok", "tonton"] },
    { id: "cooperation-documents", title: "Dokumen Kerja Sama", category: "settings", tier: "addon",
      description: "Status dokumen kerja samamu.",
      keywords: ["dokumen", "kerja sama", "kontrak", "mou", "reseller"] },
    { id: "media-upload", title: "Unggah Media", category: "media", tier: "package",
      description: "Media terakhir dan status unggahannya.",
      keywords: ["unggah", "upload", "foto", "media"] },
    { id: "voice-interaction", title: "Interaksi Suara", category: "media", tier: "addon",
      description: "Bicara langsung dengan asisten.",
      keywords: ["suara", "voice", "bicara", "mic"] },
    { id: "banner-carousel", title: "Banner Promo", category: "engagement", tier: "package",
      description: "Banner promosi yang sedang tayang.",
      keywords: ["banner", "promo", "iklan", "penawaran"] },
    { id: "venue-booking", title: "Booking Tempat", category: "venue", tier: "addon",
      description: "Foto tempat dan jadwal reservasimu.",
      keywords: ["booking", "reservasi", "meja", "tempat", "ruangan"] },
    { id: "takeaway-ordering", title: "Takeaway", category: "venue", tier: "addon",
      description: "Pesanan siap bawa dan statusnya.",
      keywords: ["takeaway", "bawa pulang", "ambil", "pickup"] },
    { id: "queue-management", title: "Antrean", category: "venue", tier: "addon",
      description: "Nomor antreanmu dan perkiraan giliran.",
      keywords: ["antrean", "antri", "nomor", "giliran"] },
    { id: "clock", title: "Jam", category: "media", tier: "package",
      description: "Jam dan tanggal hari ini.",
      keywords: ["jam", "waktu", "tanggal", "clock"] },
    { id: "music-player", title: "Musik", category: "media", tier: "addon",
      description: "Lagu yang sedang diputar toko.",
      keywords: ["musik", "lagu", "playlist", "music"] },
    { id: "localization", title: "Bahasa & Wilayah", category: "settings", tier: "package",
      description: "Bahasa dan wilayah yang dipakai.",
      keywords: ["bahasa", "language", "wilayah", "mata uang", "english"] },
    { id: "point-of-sale", title: "Belanja di Toko", category: "orders", tier: "addon",
      description: "Struk belanja langsung di toko hari ini.",
      keywords: ["kasir", "pos", "struk", "toko fisik", "belanja offline"] },
    { id: "in-app-payment", title: "Pembayaran", category: "orders", tier: "addon",
      description: "Status pembayaran terakhir dan metodemu.",
      keywords: ["bayar", "pembayaran", "transfer", "ewallet", "metode"] },
]);

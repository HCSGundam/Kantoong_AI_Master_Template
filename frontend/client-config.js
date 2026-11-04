
/* ============================================================
   KANTOONG CORE — CLIENT CONFIGURATION
   File: frontend/client-config.js

   TUJUAN:
   1. Menyimpan konfigurasi dan konten bisnis.
   2. Menjadi titik penyesuaian skin per klien.
   3. Tidak menampung logika bisnis atau kredensial rahasia.
   4. Menyediakan konfigurasi untuk engine.js dan modul lain.

   CATATAN:
   - Pertahankan nama properti agar kompatibel dengan engine.
   - Keamanan data antar-klien wajib ditegakkan oleh backend
     dan kebijakan database, bukan konfigurasi frontend.
   ============================================================ */

const KantoongConfig = {

    // ========================================================
    // 1. IDENTITAS BISNIS
    // ========================================================
    business_id: "master_template_001",

    app_name: "Miloat",

    // Warna utama untuk skin bisnis.
    // Engine/CSS perlu menerapkan nilai ini ke tampilan.
    theme_color_primary: "#111111",


    // ========================================================
    // 2. PENGATURAN DATA
    // ========================================================

    /*
     * false = tidak meminta filter business_id melalui opsi ini.
     * true  = meminta engine memfilter berdasarkan business_id.
     *
     * PENTING:
     * Opsi frontend ini bukan mekanisme keamanan.
     * Query backend dan kebijakan database tetap wajib
     * membatasi data sesuai tenant yang terautentikasi.
     */
    filter_by_business_id: false,

    /*
     * true  = izinkan produk contoh saat data kosong.
     * false = jangan gunakan produk contoh sebagai fallback.
     *
     * Sebelum dipakai oleh klien sungguhan, tinjau kembali
     * apakah fallback demo sesuai dengan kebutuhan produk.
     */
    use_demo_when_empty: true,

    /*
     * MODE DEMO ERP (untuk presentasi ke bos / calon klien).
     * true  = panel "Coba mode demo" (data contoh, peran Owner/Sales/Kasir/dll)
     *         selalu tampil di halaman login ERP, plus tombol "Coba Demo ERP"
     *         di Profil.
     * false = demo HILANG total. WAJIB false untuk web klien sungguhan.
     * Data demo fiktif & hanya tersimpan di perangkat yang membukanya.
     */
    erp_demo: true,


    // ========================================================
    // 3. HERO / SLIDER UTAMA
    // ========================================================

    /*
     * type:
     * - "image"
     * - "video"
     * - "none"
     *
     * src dapat berupa path aset atau URL yang sesuai.
     * ai_prompt adalah pesan awal untuk konsultasi AI.
     */
    hero: {
        interval_seconds: 5,

        slides: [
            {
                type: "none",
                src: "",
                media_label: "Foto / video brand",
                caption: "Premium collection",
                title: "Nama produk unggulan",
                text: "Penjelasan singkat produk atau promo yang ingin ditonjolkan brand.",
                ai_prompt: ""
            },
            {
                type: "none",
                src: "",
                media_label: "Foto / video brand",
                caption: "Terbaru",
                title: "Koleksi terbaru kami",
                text: "Tanyakan ke asisten AI untuk dicarikan yang paling cocok.",
                ai_prompt: "Tolong bantu pilihkan produk terbaru yang cocok untuk saya"
            }
        ]
    },


    // ========================================================
    // 4. AREA INFORMASI BRAND
    // ========================================================

    /*
     * type:
     * - "marquee"    = pita berjalan kanan -> kiri tanpa henti (bawah hero)
     * - "highlights" = kotak keunggulan bisnis (diam)
     * - "text"       = menampilkan teks bebas
     * - "none"       = menyembunyikan area informasi
     *
     * Item "marquee" bisa berupa:
     * - keunggulan brand: { icon, title, sub }
     *   icon: "truck" | "box" | "badge" | "lock" | "chat" | "heart"
     * - logo/nama brand mitra: { logo: "url-logo.png", name: "Nama Brand" }
     *   (contoh: label "TOP BRANDS" lalu deretan logo brand)
     */
    brand_slot: {
        type: "marquee",

        // Label kecil di kiri pita (opsional), misalnya "TOP BRANDS".
        label: "",

        // Lama satu putaran penuh (detik). Makin besar = makin pelan.
        speed_seconds: 30,

        // Isi sesuai keunggulan ASLI brand ini.
        items: [
            { icon: "truck", title: "Pengiriman Cepat", sub: "Aman sampai tujuan" },
            { icon: "badge", title: "Kualitas Terjamin", sub: "Bahan pilihan terbaik" },
            { icon: "chat", title: "Konsultasi AI", sub: "Tanya kapan saja" },
            { icon: "lock", title: "Checkout Aman", sub: "Kamu yang bayar sendiri" }
        ],

        text: ""
    },


    // ========================================================
    // 5. ETALASE PRODUK UNGGULAN
    // ========================================================

    featured: {
        // Panel teks di kiri baris unggulan (sesuai sketsa)
        eyebrow: "Produk unggulan",
        title: "Pilihan Terbaik",
        description: "Produk andalan yang dipilih langsung oleh toko.",
        matched_title: "Pilihan AI untuk kamu",
        limit: 8,
        ask_label: "Konsultasi AI",

        // Tampilan awal baris unggulan: "3d" (kartu berputar) atau "2d" (geser datar).
        // Pembeli bisa mengganti lewat tombol 2D/3D di bawah baris.
        view: "3d"
    },

    /*
     * Default baris pengiriman di kartu produk ("±1-2 hari | Jakarta").
     * Dipakai bila produk belum diisi di dashboard admin.
     * Kosong = tampil "Cek ongkir" dan "Indonesia".
     */
    shipping: {
        estimate: "",
        from: ""
    },

    /*
     * Baris produk tambahan di bawah "Produk Unggulan".
     * Setiap baris digeser ke samping (bukan ke bawah).
     *
     * sort:
     * - "sales"    = paling laris (butuh data jumlah terjual)
     * - "wishlist" = paling banyak di-wishlist (butuh wishlist_count)
     * - "newest"   = produk terbaru (butuh tanggal dibuat)
     *
     * Baris yang datanya belum ada otomatis disembunyikan.
     * Hapus/ubah urutan baris sesuai kebutuhan brand.
     */
    rails: [
        {
            eyebrow: "Paling laris",
            title: "Best Seller",
            description: "Produk yang paling banyak dibeli pelanggan.",
            sort: "sales", limit: 10, min_items: 2
        },
        {
            eyebrow: "Favorit pembeli",
            title: "Paling Banyak Di-wishlist",
            description: "Produk yang paling sering disimpan pembeli.",
            sort: "wishlist", limit: 10, min_items: 2
        },
        {
            eyebrow: "Baru datang",
            title: "Produk Terbaru",
            description: "Koleksi terbaru yang baru masuk toko.",
            sort: "newest", limit: 10, min_items: 2
        }
    ],

    /*
     * Testimoni pembeli untuk bagian "Kata Mereka" di homepage.
     * Isi HANYA dengan ulasan asli dari pembeli brand ini.
     * Kosong = bagian testimoni disembunyikan.
     * Contoh: { name: "Rina", product: "Oatcookies", rating: 5, text: "Renyah dan nggak terlalu manis!" }
     */
    testimonials: [],


    // ========================================================
    // 6. KATEGORI PRODUK
    // ========================================================

    categories: {
        enabled: true,
        title: "Kategori lain"
    },


    // ========================================================
    // 7. ASISTEN AI
    // ========================================================

    ai_name: "Asisten",

    ai_title: "Halo Kak!",

    /*
     * Alamat backend AI (Gemini). Jika backend mati atau API key
     * belum diisi, chat otomatis memakai jawaban lokal sebagai cadangan.
     *
     * "/api/chat" = alamat relatif. Saat development, Vite meneruskannya
     * ke backend port 5000 (lihat vite.config.js -> proxy), sehingga
     * juga jalan saat dibuka dari HP. Saat online nanti, backend harus
     * melayani /api/chat di domain yang sama (atau isi URL lengkapnya).
     */
    ai_endpoint: "/api/chat",

    ai_greetings: [
        "Mau cari produk yang cocok untuk kebutuhanmu?",
        "Bingung memilih? Ceritakan kebutuhanmu, aku carikan."
    ],

    /*
     * Kumpulan saran pertanyaan untuk antarmuka chat.
     * Pengacakan, jumlah saran yang ditampilkan, dan reset harian
     * harus ditangani oleh modul AI/chat yang menggunakannya.
     */
    ai_suggestions: [
        "Bantu pilihkan sesuai kebutuhan saya",
        "Rekomendasi budget di bawah 500 ribu",
        "Apa produk yang paling banyak dipilih?",
        "Cari produk yang paling hemat",
        "Aku bingung mau pilih yang mana",
        "Ada produk baru apa saja?",
        "Bandingkan produk unggulan untukku",
        "Cari hadiah untuk orang tersayang"
    ],


    // ========================================================
    // 8. DATA PRODUK DEMO
    // ========================================================

    /*
     * Data ini hanya untuk mode demo.
     * Jangan gunakan data contoh sebagai data transaksi nyata.
     */
    demo_products: [
        {
            id: "demo-1",
            name: "Produk Contoh Satu",
            price: 1250000,
            category: "kategori a",
            sales_count: 40,
            image_url: ""
        },
        {
            id: "demo-2",
            name: "Produk Contoh Dua",
            price: 750000,
            category: "kategori a",
            sales_count: 32,
            image_url: ""
        },
        {
            id: "demo-3",
            name: "Produk Contoh Tiga",
            price: 450000,
            category: "kategori b",
            sales_count: 25,
            image_url: ""
        },
        {
            id: "demo-4",
            name: "Produk Contoh Empat",
            price: 2300000,
            category: "kategori b",
            sales_count: 18,
            image_url: ""
        },
        {
            id: "demo-5",
            name: "Produk Contoh Lima",
            price: 320000,
            category: "kategori a",
            sales_count: 9,
            image_url: ""
        },
        {
            id: "demo-6",
            name: "Produk Contoh Enam",
            price: 980000,
            category: "kategori b",
            sales_count: 4,
            image_url: ""
        }
    ]
};


// ============================================================
// 9. EKSPOR KONFIGURASI
// ============================================================

// Kompatibilitas dengan engine.js yang membaca window.KantoongConfig.
if (typeof window !== "undefined") {
    window.KantoongConfig = KantoongConfig;
}

// Memungkinkan modul ES lain mengimpor konfigurasi secara langsung.
export default KantoongConfig;

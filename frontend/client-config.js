
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
     * - "highlights" = menampilkan keunggulan bisnis
     * - "text"       = menampilkan teks bebas
     * - "none"       = menyembunyikan area informasi
     */
    brand_slot: {
        type: "highlights",

        items: [
            {
                title: "Kualitas",
                sub: "Terjamin"
            },
            {
                title: "Pengiriman",
                sub: "Cepat"
            },
            {
                title: "Layanan",
                sub: "Ramah"
            }
        ],

        text: ""
    },


    // ========================================================
    // 5. ETALASE PRODUK UNGGULAN
    // ========================================================

    featured: {
        title: "Produk Unggulan",
        matched_title: "Pilihan AI untuk kamu",
        limit: 8,
        ask_label: "Tanyakan produk ini"
    },


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
     */
    ai_endpoint: "http://127.0.0.1:5000/api/chat",

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

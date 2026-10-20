// ============================================================
// client-config.js - Kantoong AI Master Template
// SATU-SATUNYA file yang diedit per klien (selain foto/video).
// Tidak ada kode logika di sini, hanya isi dan pengaturan.
// ============================================================

const KantoongConfig = {

    // ---------- Identitas bisnis ----------
    business_id: "master_template_001",
    app_name: "NAMA BISNIS ANDA",
    theme_color_primary: "#111111", // dipakai sebagai --primary-color

    // ---------- Pengaturan data ----------
    // false = tampilkan semua produk di tabel (cocok selama satu toko).
    // true  = hanya produk yang kolom business_id-nya sama dengan business_id di atas.
    filter_by_business_id: false,
    // true = jika database kosong/belum terhubung, tampilkan demo_products di bawah.
    // Ubah ke false sebelum template diserahkan ke klien.
    use_demo_when_empty: true,

    // ---------- Hero (slider paling atas) ----------
    // type: "image" | "video" | "none"  (src diisi path/URL; kosongkan untuk placeholder)
    // ai_prompt: pesan otomatis yang dikirim saat tombol "Konsultasi AI" ditekan (boleh kosong)
    hero: {
        interval_seconds: 5, // geser otomatis tiap X detik; 0 = tidak geser otomatis
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

    // ---------- Area bebas pemilik brand ----------
    // type: "highlights" (3 keunggulan) | "text" (teks bebas: sponsor, iklan, spesifikasi) | "none"
    brand_slot: {
        type: "highlights",
        items: [
            { title: "Kualitas", sub: "Terjamin" },
            { title: "Pengiriman", sub: "Cepat" },
            { title: "Layanan", sub: "Ramah" }
        ],
        text: ""
    },

    // ---------- Etalase ----------
    featured: {
        title: "Produk Unggulan",           // etalase default (terlaris)
        matched_title: "Pilihan AI untuk kamu", // saat AI mencocokkan produk
        limit: 8,
        ask_label: "Tanyakan produk ini"
    },
    categories: {
        enabled: true,
        title: "Kategori lain"
    },

    // ---------- Asisten AI ----------
    ai_name: "Asisten",
    ai_title: "Halo Kak!",
    ai_greetings: [
        "Mau cari produk yang cocok untuk kebutuhanmu?",
        "Bingung memilih? Ceritakan kebutuhanmu, aku carikan."
    ],
    // Kolam saran chat. Tiap kunjungan diacak dan 3 ditampilkan; isi minimal 6 agar bervariasi.
    // Saran hanya tampil sebelum user mengirim pesan pertama hari itu, lalu reset pukul 00:00.
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

    // ---------- Data contoh (hanya tampil jika use_demo_when_empty = true) ----------
    demo_products: [
        { id: "demo-1", name: "Produk Contoh Satu", price: 1250000, category: "kategori a", sales_count: 40, image_url: "" },
        { id: "demo-2", name: "Produk Contoh Dua", price: 750000, category: "kategori a", sales_count: 32, image_url: "" },
        { id: "demo-3", name: "Produk Contoh Tiga", price: 450000, category: "kategori b", sales_count: 25, image_url: "" },
        { id: "demo-4", name: "Produk Contoh Empat", price: 2300000, category: "kategori b", sales_count: 18, image_url: "" },
        { id: "demo-5", name: "Produk Contoh Lima", price: 320000, category: "kategori a", sales_count: 9, image_url: "" },
        { id: "demo-6", name: "Produk Contoh Enam", price: 980000, category: "kategori b", sales_count: 4, image_url: "" }
    ]
};
/**
 * Konteks asisten AI untuk ERP & kasir (dulu skrip tertanam di erp.html).
 * Dipisah ke file agar Content-Security-Policy bisa melarang SEMUA skrip tertanam (anti XSS).
 */
window.KantoongAssistantContext = {
    surface: "erp",
    dock: false,
    startMinimized: true,
    greetings: ["Ada yang bisa kubantu di dashboard kerjamu?"],
    suggestions: [
        "Cara menambah karyawan baru?",
        "Bagaimana membuat purchase order?",
        "Cara mengatur target & komisi sales?",
        "Bagaimana proses retur pelanggan?",
        "Apa bedanya Tim & Target dengan Ruang Kerjaku?"
    ]
};

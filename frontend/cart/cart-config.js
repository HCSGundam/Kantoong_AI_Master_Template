// ============================================================
// cart/cart-config.js - Pengaturan keranjang & checkout
// Nilai bawaan ada di bawah. Per klien, cukup tambahkan blok `checkout`
// di client-config.js untuk menimpa sebagian atau seluruhnya, contoh:
//
//   const KantoongConfig = { ..., checkout: { service_fee: 1000, whatsapp_number: "628123456789" } };
//
// CATATAN: tarif kurir di bawah adalah TARIF TETAP buatan sendiri (bukan tarif
// asli kurir). Ganti sesuai kebijakan toko; tarif real-time butuh layanan
// seperti Biteship/RajaOngkir di tahap berikutnya.
// ============================================================

const base = (typeof KantoongConfig !== 'undefined') ? KantoongConfig : {};
const override = base.checkout || {};

const defaults = {
    business_id: base.business_id || 'master_template_001',
    order_prefix: 'ORD',          // awalan kode pesanan, mis. YG-240101-AB12C
    max_qty: 99,                  // maksimal jumlah per barang
    service_fee: 0,               // biaya layanan per pesanan (Rp); 0 = tidak ditampilkan
    free_shipping_min: 0,         // belanja minimal (Rp) untuk gratis ongkir; 0 = tidak ada
    whatsapp_number: '',          // format internasional tanpa +, mis. 6281234567890; kosong = tombol WA disembunyikan

    // Kurir & layanan. price = ongkir (Rp). Tambah/hapus bebas.
    couriers: [
        {
            code: 'jne', name: 'JNE',
            services: [
                { name: 'Reguler', eta: '2-3 hari', price: 15000 },
                { name: 'YES (Next Day)', eta: '1 hari', price: 32000 }
            ]
        },
        {
            code: 'jnt', name: 'J&T Express',
            services: [{ name: 'EZ', eta: '2-4 hari', price: 14000 }]
        },
        {
            code: 'sicepat', name: 'SiCepat',
            services: [
                { name: 'REG', eta: '2-3 hari', price: 13000 },
                { name: 'BEST', eta: '1 hari', price: 25000 }
            ]
        }
    ],

    // Metode pembayaran yang ditawarkan ke pembeli (pilihan saja; belum tersambung payment gateway).
    payment_methods: [
        { code: 'bca_va', label: 'BCA Virtual Account', group: 'Transfer bank' },
        { code: 'mandiri_va', label: 'Mandiri Virtual Account', group: 'Transfer bank' },
        { code: 'qris', label: 'QRIS', group: 'Dompet digital' },
        { code: 'minimarket', label: 'Alfamart / Indomaret', group: 'Gerai' },
        { code: 'cod', label: 'Bayar di tempat (COD)', group: 'Lainnya' }
    ],

    // Teks yang tampil di layar "Pesanan dibuat"
    payment_note: 'Pesananmu sudah kami terima dan menunggu pembayaran. Admin akan menghubungi nomor HP-mu untuk instruksi pembayaran.'
};

export const CartConfig = { ...defaults, ...override };
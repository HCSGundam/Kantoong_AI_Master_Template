/**
 * Module: Stats Cards Logic (stats-cards.js)
 * Description: Menghitung dan merender data statistik secara real-time dari LocalStorage
 * Non-hardcode & scalable untuk berbagai jenis klien (Retail, Gold, E-commerce).
 */

(function initStatsCards() {
    try {
        // 1. Ambil data produk tersimpan dari storage lokal
        const storedProducts = JSON.parse(localStorage.getItem('kantong_store_products') || '[]');
        
        // 2. Hitung total jenis produk (SKU/Item)
        const totalProducts = storedProducts.length;

        // 3. Hitung total estimasi nilai aset / omzet potensial (Harga x Stok)
        let totalAssetValue = 0;
        let totalStockUnits = 0;

        storedProducts.forEach(item => {
            const price = parseFloat(item.price || 0);
            const stock = parseInt(item.stock || 0);
            totalAssetValue += (price * (stock > 0 ? stock : 1));
            totalStockUnits += (stock > 0 ? stock : 0);
        });

        // 4. Update elemen DOM pada kartu statistik overview secara dinamis
        const elTotalProducts = document.getElementById('kpiTotalProducts');
        const elAssetValue = document.getElementById('kpiAssetValue');

        if (elTotalProducts) {
            elTotalProducts.textContent = totalProducts.toLocaleString('id-ID');
        }

        if (elAssetValue) {
            elAssetValue.textContent = 'Rp ' + totalAssetValue.toLocaleString('id-ID');
        }

        // 5. Cetak log debug modular untuk audit sistem
        console.info(`[StatsEngine] Berhasil memuat statistik: ${totalProducts} produk, Total Valuasi: Rp ${totalAssetValue.toLocaleString('id-ID')}`);

    } catch (error) {
        console.error("[StatsEngine Error] Gagal memproses kalkulasi statistik kartu:", error);
    }
})();
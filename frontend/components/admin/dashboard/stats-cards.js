/**
 * Module: Stats Cards Logic (stats-cards.js)
 * Description: Menghitung dan merender data statistik secara real-time dari LocalStorage
 */

(function initStatsCards() {
    try {
        const storedProducts = JSON.parse(localStorage.getItem('kantong_store_products') || '[]');
        const totalProducts = storedProducts.length;

        let totalAssetValue = 0;
        storedProducts.forEach(item => {
            const price = parseFloat(item.price || 0);
            const stock = parseInt(item.stock || 0);
            totalAssetValue += (price * (stock > 0 ? stock : 1));
        });

        const elTotalProducts = document.getElementById('kpiTotalProducts');
        const elAssetValue = document.getElementById('kpiAssetValue');

        if (elTotalProducts) elTotalProducts.textContent = totalProducts.toLocaleString('id-ID');
        if (elAssetValue) elAssetValue.textContent = 'Rp ' + totalAssetValue.toLocaleString('id-ID');

        console.info(`[StatsEngine] Berhasil memuat statistik: ${totalProducts} produk, Valuasi: Rp ${totalAssetValue.toLocaleString('id-ID')}`);
    } catch (error) {
        console.error("[StatsEngine Error] Gagal memproses kalkulasi statistik:", error);
    }
})();
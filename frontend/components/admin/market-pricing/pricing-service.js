/**
 * Module: Pricing & Commodity Service Logic (pricing-service.js)
 * Description: Menangani logika fetch data indeks pasar, kalkulasi konversi nilai, 
 * dan pembaruan parameter harga secara real-time secara agnostik/netral.
 */

(function initPricingService() {
    const buyPriceEl = document.getElementById('liveBuyPrice');
    const sellPriceEl = document.getElementById('liveSellPrice');
    const timestampEl = document.getElementById('priceTimestamp');
    const refreshBtn = document.getElementById('refreshPriceBtn');
    
    const weightInput = document.getElementById('calcWeight');
    const gradeSelect = document.getElementById('calcGrade');
    const resultEl = document.getElementById('calcResult');

    // Nilai acuan pasar dasar (bisa dikoneksikan ke API eksternal klien)
    let baseBuyRate = 1250000; 
    let baseSellRate = 1200000;

    function updateDisplay() {
        if (buyPriceEl) buyPriceEl.textContent = 'Rp ' + baseBuyRate.toLocaleString('id-ID');
        if (sellPriceEl) sellPriceEl.textContent = 'Rp ' + baseSellRate.toLocaleString('id-ID');
        if (timestampEl) timestampEl.textContent = new Date().toLocaleTimeString('id-ID');
        calculateTotal();
    }

    function calculateTotal() {
        if (!weightInput || !resultEl) return;
        const weight = parseFloat(weightInput.value || 0);
        const multiplier = parseFloat(gradeSelect ? gradeSelect.value : 1);
        const total = weight * baseBuyRate * multiplier;
        
        resultEl.textContent = 'Rp ' + Math.round(total).toLocaleString('id-ID');
    }

    // Inisialisasi tampilan awal
    updateDisplay();

    // Event listener untuk tombol pembaruan data real-time
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            // Simulasi fluktuasi pasar acak untuk keperluan demo
            const fluctuation = Math.floor(Math.random() * 6000) - 3000;
            baseBuyRate += fluctuation;
            baseSellRate += fluctuation;
            updateDisplay();
            console.info(`[PricingService] Indeks pasar diperbarui. Acuan baru: Rp ${baseBuyRate.toLocaleString('id-ID')}`);
        });
    }

    // Event listener untuk kalkulator interaktif
    if (weightInput) {
        weightInput.addEventListener('input', calculateTotal);
    }

    if (gradeSelect) {
        gradeSelect.addEventListener('change', calculateTotal);
    }
})();
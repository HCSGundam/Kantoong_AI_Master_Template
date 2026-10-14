/**
 * Module: Sales Controller Logic (sales-controller.js)
 * Description: Menangani pencatatan transaksi masuk, kalkulasi omzet, 
 * render tabel riwayat, dan manajemen penyimpanan lokal secara real-time.
 */

(function initSalesController() {
    const tableBody = document.getElementById('salesTableBody');
    const emptyState = document.getElementById('emptySalesState');
    const saveBtn = document.getElementById('saveNewSalesBtn');
    
    const totalRevenueEl = document.getElementById('totalSalesRevenue');
    const totalCountEl = document.getElementById('totalSalesCount');

    function renderSalesData() {
        const transactions = JSON.parse(localStorage.getItem('kantong_store_sales') || '[]');
        
        if (!tableBody) return;
        tableBody.innerHTML = '';

        if (transactions.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            if (totalRevenueEl) totalRevenueEl.textContent = 'Rp 0';
            if (totalCountEl) totalCountEl.textContent = '0 Transaksi';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        let cumulativeRevenue = 0;

        transactions.forEach((trx, index) => {
            const nominal = parseFloat(trx.nominal || 0);
            cumulativeRevenue += nominal;

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #e5e5ea';
            tr.innerHTML = `
                <td style="padding: 12px 16px; color: #1d1d1f; font-weight: 600;">
                    ${trx.id || ('TRX-' + (index + 1))}<br>
                    <span style="font-size: 11px; color: #6e6e73; font-weight: normal;">${trx.timestamp || '-'}</span>
                </td>
                <td style="padding: 12px 16px; color: #1d1d1f;">${trx.description || 'Transaksi Umum'}</td>
                <td style="padding: 12px 16px; color: #6e6e73;"><span style="background: #f5f5f7; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">${trx.method || 'Tunai'}</span></td>
                <td style="padding: 12px 16px; color: #1d1d1f; font-weight: 600;">Rp ${nominal.toLocaleString('id-ID')}</td>
                <td style="padding: 12px 16px; text-align: right;">
                    <button class="delete-trx-btn" data-index="${index}" style="background: #ffebee; color: #c62828; border: none; padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer;">Hapus</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // Update Ringkasan Metrik
        if (totalRevenueEl) totalRevenueEl.textContent = 'Rp ' + cumulativeRevenue.toLocaleString('id-ID');
        if (totalCountEl) totalCountEl.textContent = transactions.length + ' Transaksi';

        // Pasang event listener untuk tombol hapus transaksi
        document.querySelectorAll('.delete-trx-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-index');
                let currentTrx = JSON.parse(localStorage.getItem('kantong_store_sales') || '[]');
                currentTrx.splice(idx, 1);
                localStorage.setItem('kantong_store_sales', JSON.stringify(currentTrx));
                renderSalesData();
            });
        });
    }

    // Jalankan render awal saat modul dimuat
    renderSalesData();

    // Aksi Simpan Transaksi Baru
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const descInput = document.getElementById('inputSalesDesc');
            const methodInput = document.getElementById('inputSalesMethod');
            const nominalInput = document.getElementById('inputSalesNominal');

            if (!descInput || !nominalInput) return;

            const description = descInput.value.trim();
            const method = methodInput ? methodInput.value : 'Tunai / Cash';
            const nominal = nominalInput.value.trim();

            if (!description || !nominal) {
                alert('Keterangan transaksi dan total nominal wajib diisi!');
                return;
            }

            const now = new Date();
            const timeString = now.toLocaleDateString('id-ID') + ' ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

            let currentTrx = JSON.parse(localStorage.getItem('kantong_store_sales') || '[]');
            currentTrx.push({
                id: 'TRX-' + Math.floor(1000 + Math.random() * 9000),
                description,
                method,
                nominal: parseFloat(nominal),
                timestamp: timeString
            });

            localStorage.setItem('kantong_store_sales', JSON.stringify(currentTrx));

            // Reset form input
            descInput.value = '';
            nominalInput.value = '';

            renderSalesData();
            alert('Transaksi berhasil dicatat ke dalam sistem!');
        });
    }
})();
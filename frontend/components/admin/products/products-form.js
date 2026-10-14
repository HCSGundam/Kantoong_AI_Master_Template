/**
 * Module: Products Form & Table Logic (products-form.js)
 * Description: Menangani render tabel, validasi input, penyimpanan, dan hapus produk secara real-time.
 */

(function initProductsManager() {
    const tableBody = document.getElementById('productTableBody');
    const emptyState = document.getElementById('emptyProductState');
    const saveBtn = document.getElementById('saveNewProductBtn');

    function renderProducts() {
        const products = JSON.parse(localStorage.getItem('kantong_store_products') || '[]');
        
        if (!tableBody) return;
        tableBody.innerHTML = '';

        if (products.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        products.forEach((prod, index) => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #e5e5ea';
            tr.innerHTML = `
                <td style="padding: 12px 16px; font-weight: 600; color: #1d1d1f;">${prod.name || '-'}</td>
                <td style="padding: 12px 16px; color: #6e6e73;">${prod.category || 'Umum'}</td>
                <td style="padding: 12px 16px; color: #1d1d1f; font-weight: 600;">Rp ${parseInt(prod.price || 0).toLocaleString('id-ID')}</td>
                <td style="padding: 12px 16px; color: #1d1d1f;"><span style="background: #e8f5e9; color: #2e7d32; padding: 3px 8px; border-radius: 6px; font-weight: 600; font-size: 11px;">${prod.stock || 0} Unit</span></td>
                <td style="padding: 12px 16px; text-align: right;">
                    <button class="delete-prod-btn" data-index="${index}" style="background: #ffebee; color: #c62828; border: none; padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer;">Hapus</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // Event listener hapus produk
        document.querySelectorAll('.delete-prod-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-index');
                let currentProds = JSON.parse(localStorage.getItem('kantong_store_products') || '[]');
                currentProds.splice(idx, 1);
                localStorage.setItem('kantong_store_products', JSON.stringify(currentProds));
                renderProducts();
            });
        });
    }

    // Jalankan render awal
    renderProducts();

    // Aksi tombol simpan produk baru
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const nameInput = document.getElementById('inputProdName');
            const catInput = document.getElementById('inputProdCategory');
            const priceInput = document.getElementById('inputProdPrice');
            const stockInput = document.getElementById('inputProdStock');
            const descInput = document.getElementById('inputProdDesc');

            if (!nameInput || !priceInput) return;

            const name = nameInput.value.trim();
            const category = catInput ? catInput.value.trim() : '';
            const price = priceInput.value.trim();
            const stock = stockInput ? stockInput.value.trim() : '';
            const description = descInput ? descInput.value.trim() : '';

            if (!name || !price) {
                alert('Nama produk dan harga wajib diisi!');
                return;
            }

            let currentProds = JSON.parse(localStorage.getItem('kantong_store_products') || '[]');
            currentProds.push({
                id: 'prod_' + Date.now(),
                name,
                category: category || 'Emas & Perhiasan',
                price: parseFloat(price),
                stock: parseInt(stock || 1),
                description
            });

            localStorage.setItem('kantong_store_products', JSON.stringify(currentProds));
            
            // Reset form
            nameInput.value = '';
            if (catInput) catInput.value = '';
            priceInput.value = '';
            if (stockInput) stockInput.value = '';
            if (descInput) descInput.value = '';

            renderProducts();
            alert('Produk berhasil ditambahkan ke katalog!');
        });
    }
})();
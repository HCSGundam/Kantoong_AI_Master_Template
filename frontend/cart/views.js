// ============================================================
// cart/views.js - Tiga layar: Keranjang, Checkout, Pesanan dibuat
// Hanya menggambar tampilan dan menangani klik/ketik. Data ada di cart-store.js,
// pengiriman pesanan di order-api.js, kerangka halaman & perpindahan di cart.js.
//
// ctx (dari cart.js):
//   body, footer     elemen tempat isi digambar
//   header.set(judul, subjudul, langkah 1-3)
//   go(layar, data)  pindah layar: 'cart' | 'checkout' | 'success'
//   close()          tutup halaman keranjang
//   toast(teks)      pemberitahuan kecil
//   missing          Set id barang yang sudah tidak ada di katalog
// ============================================================

import { CartConfig as CFG } from './cart-config.js';
import * as Cart from './cart-store.js';
import { rupiah } from './cart-store.js';
import * as API from './order-api.js';

// ------------------------------------------------------------
// Helper & ikon
// ------------------------------------------------------------
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const svg = (paths, size = 18, extra = '') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${paths}</svg>`;

const ICON = {
    trash: svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>'),
    note: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', 14),
    bag: svg('<path d="M5 8h14l-1.2 12H6.2L5 8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>', 56, 'stroke-width="1.6"'),
    check: svg('<polyline points="20 6 9 17 4 12"/>', 34, 'stroke-width="3"')
};

const thumb = (it) => it.image_url
    ? `<img src="${esc(it.image_url)}" alt="${esc(it.name)}" loading="lazy">`
    : esc((it.name || '?').trim().charAt(0).toUpperCase());

const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

// ============================================================
// LAYAR 1: KERANJANG
// ============================================================
export function renderCartView(ctx) {
    const { body, footer } = ctx;
    let editingNote = null; // id barang yang kolom catatannya sedang dibuka

    const itemHtml = (it) => {
        const gone = ctx.missing.has(it.id);
        const showNote = Boolean(it.note) || editingNote === it.id;
        const id = esc(it.id);
        return `
        <div class="cart-item" data-id="${id}">
            <div class="cart-item-thumb">${thumb(it)}</div>
            <div class="cart-item-info">
                <div class="cart-item-name">${esc(it.name)}</div>
                <div class="cart-item-price">${rupiah(it.price)}</div>
                ${gone ? '<p class="field-error">Produk ini sudah tidak tersedia. Hapus dari keranjang.</p>' : ''}
                ${showNote ? '' : `<button class="cart-item-note-toggle" data-act="note" data-id="${id}">${ICON.note} Tulis catatan</button>`}
            </div>
            ${showNote ? `<textarea class="cart-item-note" data-id="${id}" rows="2" maxlength="300"
                placeholder="Contoh: warna hitam, tolong dibungkus rapi" aria-label="Catatan untuk ${esc(it.name)}">${esc(it.note)}</textarea>` : ''}
            <div class="cart-item-actions">
                <button class="cart-item-remove" data-act="remove" data-id="${id}" aria-label="Hapus ${esc(it.name)}">${ICON.trash}</button>
                <div class="qty">
                    <button class="qty-btn" data-act="dec" data-id="${id}" aria-label="Kurangi jumlah" ${it.qty <= 1 ? 'disabled' : ''}>−</button>
                    <span class="qty-value" aria-live="polite">${it.qty}</span>
                    <button class="qty-btn" data-act="inc" data-id="${id}" aria-label="Tambah jumlah" ${it.qty >= CFG.max_qty ? 'disabled' : ''}>+</button>
                </div>
            </div>
        </div>`;
    };

    const draw = () => {
        const items = Cart.getItems();
        ctx.header.set('Keranjang', items.length ? `${Cart.count()} barang` : '', 1);

        if (!items.length) {
            const last = API.getLastOrder();
            footer.hidden = true;
            body.innerHTML = `
                <section class="cart-section"><div class="cart-empty">
                    ${ICON.bag}
                    <h3>Keranjangmu masih kosong</h3>
                    <p>Tanyakan ke asisten AI untuk dicarikan produk yang cocok.</p>
                    <button class="cart-btn" data-act="consult" style="margin-top:14px">Mulai konsultasi</button>
                    ${last ? '<button class="cart-btn ghost" data-act="last-order" style="margin-top:8px">Lihat pesanan terakhir</button>' : ''}
                </div></section>`;
            return;
        }

        const gone = items.filter(it => ctx.missing.has(it.id));
        body.innerHTML = `
            ${gone.length ? '<div class="cart-alert">Ada barang yang sudah tidak tersedia. Hapus dulu untuk melanjutkan.</div>' : ''}
            <section class="cart-section">${items.map(itemHtml).join('')}</section>`;

        footer.hidden = false;
        footer.innerHTML = `
            <div class="cart-footer-total"><span>Subtotal (${Cart.count()} barang)</span><span class="cart-footer-amount">${rupiah(Cart.itemsTotal())}</span></div>
            <button class="cart-cta" data-act="checkout" ${gone.length ? 'disabled' : ''}>Lanjut ke checkout</button>`;
    };

    body.onclick = (e) => {
        const el = e.target.closest('[data-act]');
        if (!el) return;
        const id = el.dataset.id;
        switch (el.dataset.act) {
            case 'inc': Cart.increment(id); draw(); break;
            case 'dec': Cart.decrement(id); draw(); break;
            case 'remove': Cart.removeItem(id); ctx.missing.delete(id); draw(); break;
            case 'note':
                editingNote = id; draw();
                body.querySelector(`.cart-item-note[data-id="${CSS.escape(id)}"]`)?.focus();
                break;
            case 'consult': ctx.close(); emit('kantoong:consult', { text: '' }); break;
            case 'last-order': { const r = API.getLastOrder(); if (r) ctx.go('success', r); break; }
        }
    };

    // Catatan tersimpan sambil mengetik (tanpa menggambar ulang agar kursor tidak lompat)
    body.oninput = (e) => {
        if (e.target.matches('.cart-item-note')) Cart.setItemNote(e.target.dataset.id, e.target.value);
    };

    footer.onclick = (e) => {
        if (e.target.closest('[data-act="checkout"]')) ctx.go('checkout');
    };

    draw();
}

// ============================================================
// LAYAR 2: CHECKOUT
// ============================================================
export function renderCheckoutView(ctx) {
    const { body, footer } = ctx;
    if (!Cart.getItems().length) { ctx.go('cart'); return; }

    ctx.header.set('Checkout', 'Isi alamat dan pilih pengiriman', 2);
    const d = Cart.getDraft();
    const valueOf = (path) => path.split('.').reduce((o, k) => (o ? o[k] : ''), d) ?? '';

    const field = (path, label, opts = {}) => {
        const id = 'f-' + path.replace('.', '-');
        const common = `id="${id}" data-path="${path}" ${opts.auto ? `autocomplete="${opts.auto}"` : ''} ${opts.max ? `maxlength="${opts.max}"` : ''}`;
        const control = opts.textarea
            ? `<textarea ${common} rows="${opts.rows || 3}" placeholder="${esc(opts.placeholder || '')}">${esc(valueOf(path))}</textarea>`
            : `<input ${common} type="${opts.type || 'text'}" ${opts.mode ? `inputmode="${opts.mode}"` : ''} value="${esc(valueOf(path))}" placeholder="${esc(opts.placeholder || '')}">`;
        return `<div class="field" data-field="${path}"><label for="${id}">${label}</label>${control}${opts.hint ? `<p class="field-hint">${opts.hint}</p>` : ''}</div>`;
    };

    const items = Cart.getItems();
    const summaryItems = items.map(it => `
        <div class="summary-item">
            <div class="cart-item-thumb">${thumb(it)}</div>
            <div>
                <div class="summary-item-name">${esc(it.name)}</div>
                <div class="summary-item-meta">${it.qty} × ${rupiah(it.price)}</div>
                ${it.note ? `<div class="summary-item-note">${esc(it.note)}</div>` : ''}
            </div>
            <div class="summary-item-total">${rupiah(it.price * it.qty)}</div>
        </div>`).join('');

    body.innerHTML = `
        <div id="coAlert"></div>

        <section class="cart-section">
            <div class="cart-section-head"><h3 class="cart-section-title">Alamat tujuan</h3></div>
            <div class="form-grid">
                ${field('customer.name', 'Nama penerima', { auto: 'name', max: 80 })}
                ${field('customer.phone', 'Nomor HP', { type: 'tel', mode: 'tel', auto: 'tel', max: 20, placeholder: '08123456789' })}
                ${field('customer.email', 'Email (opsional)', { type: 'email', mode: 'email', auto: 'email', max: 120, hint: 'Untuk bukti pesanan jika kamu mau.' })}
                ${field('address.line', 'Alamat lengkap', { textarea: true, max: 300, auto: 'street-address', placeholder: 'Nama jalan, nomor rumah, RT/RW, patokan' })}
                <div class="field-row">
                    ${field('address.district', 'Kecamatan', { max: 80 })}
                    ${field('address.city', 'Kota/kabupaten', { max: 80, auto: 'address-level2' })}
                </div>
                <div class="field-row">
                    ${field('address.province', 'Provinsi', { max: 80, auto: 'address-level1' })}
                    ${field('address.postal_code', 'Kode pos', { mode: 'numeric', max: 5, auto: 'postal-code' })}
                </div>
            </div>
        </section>

        <section class="cart-section">
            <div class="cart-section-head"><h3 class="cart-section-title">Barang (${Cart.count()})</h3><button class="cart-section-link" data-act="edit-cart">Ubah</button></div>
            ${summaryItems}
        </section>

        <section class="cart-section">
            <div class="cart-section-head"><h3 class="cart-section-title">Catatan untuk penjual</h3></div>
            ${field('note', 'Opsional', { textarea: true, rows: 2, max: 500, placeholder: 'Contoh: tolong kemas rapi, kirim sebelum Jumat' })}
        </section>

        <section class="cart-section" id="coShipping"></section>
        <section class="cart-section" id="coPayment"></section>
        <section class="cart-section" id="coSummary"></section>
        <p class="cart-terms">Dengan membuat pesanan, kamu menyetujui syarat dan ketentuan toko serta kebijakan pengiriman.</p>`;

    // ---------- Bagian yang digambar ulang saat pilihan berubah ----------
    const drawShipping = () => {
        const min = Number(CFG.free_shipping_min) || 0;
        const free = min > 0 && Cart.itemsTotal() >= min;
        const sel = Cart.getSelectedShipping();
        const rows = CFG.couriers.flatMap(c => c.services.map(s => ({ c, s })));
        $('#coShipping').innerHTML = `
            <div class="cart-section-head"><h3 class="cart-section-title">Pengiriman</h3></div>
            ${min > 0 ? `<p class="field-hint" style="margin:-6px 0 10px">${free ? 'Gratis ongkir untuk pesanan ini.' : `Gratis ongkir untuk belanja minimal ${rupiah(min)}.`}</p>` : ''}
            <div class="option-list">${rows.map(({ c, s }) => {
                const on = sel && sel.courier_code === c.code && sel.service === s.name;
                const price = (free || !s.price) ? 'Gratis' : rupiah(s.price);
                return `<label class="option ${on ? 'is-selected' : ''}">
                    <input type="radio" name="shipping" value="${esc(c.code)}|${esc(s.name)}" ${on ? 'checked' : ''}>
                    <span class="option-mark"></span>
                    <span class="option-main"><div class="option-title">${esc(c.name)} ${esc(s.name)}</div>${s.eta ? `<div class="option-sub">Estimasi ${esc(s.eta)}</div>` : ''}</span>
                    <span class="option-price">${price}</span></label>`;
            }).join('')}</div>
            <p class="field-error" id="coShippingError" hidden></p>`;
    };

    const drawPayment = () => {
        const groups = new Map();
        CFG.payment_methods.forEach(m => { const g = m.group || ''; (groups.get(g) || groups.set(g, []).get(g)).push(m); });
        $('#coPayment').innerHTML = `
            <div class="cart-section-head"><h3 class="cart-section-title">Metode pembayaran</h3></div>
            ${[...groups].map(([g, list]) => `
                ${g ? `<p class="option-group-title">${esc(g)}</p>` : ''}
                <div class="option-list">${list.map(m => {
                    const on = Cart.getDraft().payment_method === m.code;
                    return `<label class="option ${on ? 'is-selected' : ''}">
                        <input type="radio" name="payment" value="${esc(m.code)}" ${on ? 'checked' : ''}>
                        <span class="option-mark"></span>
                        <span class="option-main"><div class="option-title">${esc(m.label)}</div></span></label>`;
                }).join('')}</div>`).join('')}
            <p class="field-error" id="coPaymentError" hidden></p>`;
    };

    const drawSummary = () => {
        const c = Cart.calculate();
        const ship = Cart.getSelectedShipping();
        const shipText = !ship ? '—' : c.freeShipping
            ? `<span class="strike">${rupiah(c.shippingOriginal)}</span>${rupiah(0)}`
            : rupiah(c.shippingCost);
        $('#coSummary').innerHTML = `
            <div class="cart-section-head"><h3 class="cart-section-title">Ringkasan transaksi</h3></div>
            <div class="summary-row"><span>Total harga (${c.count} barang)</span><strong>${rupiah(c.itemsTotal)}</strong></div>
            <div class="summary-row"><span>Ongkos kirim</span><strong>${shipText}</strong></div>
            ${c.serviceFee > 0 ? `<div class="summary-row"><span>Biaya layanan</span><strong>${rupiah(c.serviceFee)}</strong></div>` : ''}
            <div class="summary-row is-total"><span>Total tagihan</span><span>${rupiah(c.total)}</span></div>
            ${c.freeShipping ? `<div class="summary-saving">Kamu hemat ${rupiah(c.shippingOriginal)} dari gratis ongkir.</div>` : ''}`;
        const cta = footer.querySelector('.cart-cta');
        const loading = cta && cta.classList.contains('is-loading');
        footer.innerHTML = `
            <div class="cart-footer-total"><span>Total tagihan</span><span class="cart-footer-amount">${rupiah(c.total)}</span></div>
            <button class="cart-cta ${loading ? 'is-loading' : ''}" data-act="submit">Buat pesanan<span class="cart-cta-sub">${c.count} barang</span></button>`;
    };

    const $ = (sel) => body.querySelector(sel);
    footer.hidden = false;
    drawShipping(); drawPayment(); drawSummary();

    // ---------- Pesan & error ----------
    const showAlert = (text, info = false) => {
        $('#coAlert').innerHTML = text ? `<div class="cart-alert ${info ? 'is-info' : ''}">${esc(text)}</div>` : '';
    };

    const clearFieldError = (fieldEl) => {
        if (!fieldEl) return;
        fieldEl.classList.remove('has-error');
        fieldEl.querySelector('.field-error')?.remove();
    };

    const showErrors = (errors) => {
        Object.entries(errors).forEach(([key, msg]) => {
            if (key === 'shipping' || key === 'payment') {
                const el = $(key === 'shipping' ? '#coShippingError' : '#coPaymentError');
                if (el) { el.textContent = msg; el.hidden = false; }
            } else if (key !== 'items') {
                const f = body.querySelector(`.field[data-field="${key}"]`);
                if (f) {
                    f.classList.add('has-error');
                    f.insertAdjacentHTML('beforeend', `<p class="field-error">${esc(msg)}</p>`);
                }
            }
        });
        showAlert(errors.items || 'Lengkapi isian yang ditandai merah.');
        const first = body.querySelector('.has-error, .field-error:not([hidden])');
        (first || $('#coAlert')).scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const clearAllErrors = () => {
        showAlert('');
        body.querySelectorAll('.field.has-error').forEach(clearFieldError);
        body.querySelectorAll('#coShippingError, #coPaymentError').forEach(el => { el.hidden = true; });
    };

    // ---------- Interaksi ----------
    body.oninput = (e) => {
        const path = e.target.dataset?.path;
        if (!path) return;
        const [a, b] = path.split('.');
        Cart.updateDraft(b ? { [a]: { [b]: e.target.value } } : { [a]: e.target.value });
        clearFieldError(e.target.closest('.field'));
    };

    body.onchange = (e) => {
        if (e.target.name === 'shipping') {
            const v = e.target.value, i = v.indexOf('|');
            Cart.updateDraft({ courier_code: v.slice(0, i), service: v.slice(i + 1) });
            drawShipping(); drawSummary();
        } else if (e.target.name === 'payment') {
            Cart.updateDraft({ payment_method: e.target.value });
            drawPayment();
        }
    };

    body.onclick = (e) => {
        if (e.target.closest('[data-act="edit-cart"]')) ctx.go('cart');
    };

    const submit = async () => {
        const cta = footer.querySelector('.cart-cta');
        if (!cta || cta.classList.contains('is-loading')) return;
        clearAllErrors();

        if (Cart.getItems().some(it => ctx.missing.has(it.id))) {
            showAlert('Ada barang yang sudah tidak tersedia. Kembali ke keranjang untuk menghapusnya.');
            $('#coAlert').scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        cta.classList.add('is-loading');
        const res = await API.submitOrder();
        if (res.ok) { ctx.go('success', res.receipt); return; }

        footer.querySelector('.cart-cta')?.classList.remove('is-loading');
        if (res.reason === 'validation') showErrors(res.errors);
        else { showAlert(res.message); $('#coAlert').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    };

    footer.onclick = (e) => {
        if (e.target.closest('[data-act="submit"]')) submit();
    };
}

// ============================================================
// LAYAR 3: PESANAN DIBUAT
// ============================================================
export function renderSuccessView(ctx, receipt) {
    const { body, footer } = ctx;
    ctx.header.set('Pesanan dibuat', '', 3);
    footer.hidden = true;

    const wa = API.buildWhatsAppLink(receipt);
    const t = receipt.totals;
    const a = receipt.address;
    const addressText = [a.line, a.district, a.city, a.province, a.postal_code].filter(Boolean).join(', ');

    body.innerHTML = `
        <section class="cart-section">
            <div class="order-success">
                <div class="order-check">${ICON.check}</div>
                <h3>${receipt.simulated ? 'Simulasi pesanan berhasil' : 'Pesanan diterima'}</h3>
                <p>${esc(receipt.simulated
                    ? 'Ini hanya simulasi memakai produk contoh, jadi pesanan tidak disimpan di database.'
                    : CFG.payment_note)}</p>
                <div class="order-code">${esc(receipt.order_code)}</div>
                <span class="order-badge">Menunggu pembayaran</span>
                <div class="order-actions">
                    ${wa ? `<a class="cart-btn block" href="${esc(wa)}" target="_blank" rel="noopener">Konfirmasi lewat WhatsApp</a>` : ''}
                    <button class="cart-btn ghost block" data-act="copy">Salin kode pesanan</button>
                    <button class="cart-btn ghost block" data-act="done">Kembali berbelanja</button>
                </div>
            </div>
        </section>
        ${receipt.price_changed ? '<div class="cart-alert is-info">Total disesuaikan dengan harga terbaru di toko.</div>' : ''}

        <section class="cart-section">
            <div class="cart-section-head"><h3 class="cart-section-title">Rincian pesanan</h3></div>
            ${receipt.items.map(it => `
                <div class="summary-item">
                    <div class="cart-item-thumb">${esc((it.name || '?').charAt(0).toUpperCase())}</div>
                    <div>
                        <div class="summary-item-name">${esc(it.name)}</div>
                        <div class="summary-item-meta">${it.qty} × ${rupiah(it.unit_price)}</div>
                        ${it.note ? `<div class="summary-item-note">${esc(it.note)}</div>` : ''}
                    </div>
                    <div class="summary-item-total">${rupiah(it.subtotal)}</div>
                </div>`).join('')}
            <div style="margin-top:12px">
                <div class="summary-row"><span>Total harga</span><strong>${rupiah(t.items_total)}</strong></div>
                <div class="summary-row"><span>Ongkos kirim${receipt.shipping ? ` (${esc(receipt.shipping.courier_name)} ${esc(receipt.shipping.service)})` : ''}</span><strong>${rupiah(t.shipping_cost)}</strong></div>
                ${t.service_fee > 0 ? `<div class="summary-row"><span>Biaya layanan</span><strong>${rupiah(t.service_fee)}</strong></div>` : ''}
                <div class="summary-row is-total"><span>Total tagihan</span><span>${rupiah(t.total)}</span></div>
            </div>
        </section>

        <section class="cart-section">
            <div class="cart-section-head"><h3 class="cart-section-title">Pengiriman &amp; pembayaran</h3></div>
            <div class="summary-item-name">${esc(receipt.customer.name)} · ${esc(receipt.customer.phone)}</div>
            <div class="summary-item-meta" style="margin-top:4px;line-height:1.5">${esc(addressText)}</div>
            ${receipt.shipping?.eta ? `<div class="summary-item-meta" style="margin-top:8px">Estimasi tiba: ${esc(receipt.shipping.eta)}</div>` : ''}
            <div class="summary-item-meta" style="margin-top:8px">Pembayaran: ${esc(receipt.payment_label)}</div>
            ${receipt.note ? `<div class="summary-item-note" style="margin-top:8px">Catatan: ${esc(receipt.note)}</div>` : ''}
        </section>`;

    body.oninput = null;
    body.onchange = null;
    footer.onclick = null;
    body.onclick = async (e) => {
        const el = e.target.closest('[data-act]');
        if (!el) return;
        if (el.dataset.act === 'done') ctx.close();
        if (el.dataset.act === 'copy') {
            try {
                await navigator.clipboard.writeText(receipt.order_code);
                ctx.toast('Kode pesanan disalin');
            } catch {
                ctx.toast('Salin manual: ' + receipt.order_code);
            }
        }
    };
}
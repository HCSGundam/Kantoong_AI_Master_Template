// ============================================================
// cart/cart-store.js - Isi keranjang, draf checkout, hitung total, validasi
// Murni data: tidak menyentuh tampilan (views.js) dan tidak memanggil Supabase
// (order-api.js). Data disimpan di browser pengunjung.
//
// EVENT KELUAR
//   kantoong:cart-changed  {count, itemsTotal, items}   tiap keranjang berubah
//                          (dipakai engine.js untuk lencana di ikon keranjang)
// ============================================================

import { CartConfig as CFG } from './cart-config.js';
import { voucherDiscount } from '../erp/core/marketing.js';

const CART_KEY = `kantoong:cart:v2:${CFG.business_id}`;
const DRAFT_KEY = `kantoong:checkout:${CFG.business_id}`;

// ------------------------------------------------------------
// Penyimpanan aman (tetap jalan di memori jika localStorage diblokir)
// ------------------------------------------------------------
const mem = {};
const storage = {
    read(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (raw != null) return JSON.parse(raw);
        } catch { /* diblokir atau rusak */ }
        return key in mem ? mem[key] : fallback;
    },
    write(key, value) {
        mem[key] = value;
        try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage penuh/diblokir */ }
    }
};

export const rupiah = (n) => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0
}).format(Number(n) || 0);

const clampQty = (q) => Math.max(1, Math.min(CFG.max_qty, Math.floor(Number(q)) || 1));
const str = (v, max) => String(v ?? '').slice(0, max);
const digits = (v) => String(v ?? '').replace(/\D/g, '');

// ------------------------------------------------------------
// State: keranjang & draf checkout
// ------------------------------------------------------------
function sanitizeItems(list) {
    if (!Array.isArray(list)) return [];
    return list
        .filter(it => it && it.id != null && Number.isFinite(Number(it.price)) && Number(it.price) >= 0)
        .map(it => ({
            id: String(it.id),
            name: str(it.name || 'Produk', 120),
            price: Number(it.price),
            image_url: str(it.image_url, 500),
            category: str(it.category, 80),
            qty: clampQty(it.qty),
            note: str(it.note, 300)
        }));
}

const emptyDraft = () => ({
    customer: { name: '', phone: '', email: '' },
    address: { line: '', district: '', city: '', province: '', postal_code: '' },
    courier_code: '',
    service: '',
    payment_method: '',
    note: '',
    voucher: null
});

// Voucher yang sudah dicek server: {code, title, kind, value, max_discount, min_purchase}.
// Potongan dihitung ulang dari subtotal terbaru; server memeriksa lagi saat pesanan dibuat.
function sanitizeVoucher(v) {
    if (!v || typeof v !== 'object' || !/^[A-Z0-9]{3,20}$/.test(String(v.code || ''))) return null;
    const kind = v.kind === 'persen' ? 'persen' : 'nominal';
    const num = (x) => Math.max(0, Number(x) || 0);
    return {
        code: String(v.code), title: str(v.title, 80), kind, value: num(v.value),
        max_discount: v.max_discount ? num(v.max_discount) : null, min_purchase: num(v.min_purchase)
    };
}

function sanitizeDraft(d) {
    const base = emptyDraft();
    if (!d || typeof d !== 'object') return base;
    const c = d.customer || {}, a = d.address || {};
    return {
        customer: { name: str(c.name, 80), phone: str(c.phone, 20), email: str(c.email, 120) },
        address: {
            line: str(a.line, 300), district: str(a.district, 80), city: str(a.city, 80),
            province: str(a.province, 80), postal_code: str(a.postal_code, 10)
        },
        courier_code: str(d.courier_code, 30),
        service: str(d.service, 60),
        payment_method: str(d.payment_method, 40),
        note: str(d.note, 500),
        voucher: sanitizeVoucher(d.voucher)
    };
}

let items = sanitizeItems(storage.read(CART_KEY, []));
let draft = sanitizeDraft(storage.read(DRAFT_KEY, {}));
const listeners = new Set();

// ------------------------------------------------------------
// Notifikasi perubahan
// ------------------------------------------------------------
function snapshot() {
    return { count: count(), itemsTotal: itemsTotal(), items: getItems() };
}

function notify() {
    const snap = snapshot();
    listeners.forEach(fn => { try { fn(snap); } catch (e) { console.error('[Cart] listener error', e); } });
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kantoong:cart-changed', { detail: snap }));
    }
}

function commitItems() { storage.write(CART_KEY, items); notify(); }
function commitDraft() { storage.write(DRAFT_KEY, draft); notify(); }

export function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

// Sinkron antar tab: keranjang yang diubah di tab lain ikut diperbarui
if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
        if (e.key === CART_KEY) { items = sanitizeItems(storage.read(CART_KEY, [])); notify(); }
        if (e.key === DRAFT_KEY) { draft = sanitizeDraft(storage.read(DRAFT_KEY, {})); notify(); }
    });
}

// ------------------------------------------------------------
// Barang di keranjang
// ------------------------------------------------------------
export const getItems = () => items.map(it => ({ ...it }));
export const count = () => items.reduce((n, it) => n + it.qty, 0);
export const itemsTotal = () => items.reduce((sum, it) => sum + it.price * it.qty, 0);
export const isDemoItem = (it) => String(it.id).startsWith('demo-');

// Simpan salinan nama/harga/foto saat ditambahkan, agar keranjang berdiri sendiri.
// (Harga final tetap dihitung ulang server dari tabel products saat pesanan dibuat.)
export function addItem(product, qty = 1) {
    if (!product || product.id == null) return null;
    const price = Number(product.price);
    if (!Number.isFinite(price) || price < 0) return null;

    const id = String(product.id);
    let it = items.find(i => i.id === id);
    if (it) {
        it.qty = clampQty(it.qty + qty);
        it.name = str(product.name || it.name, 120);
        it.price = price;
    } else {
        it = {
            id,
            name: str(product.name || 'Produk', 120),
            price,
            image_url: str(product.image_url, 500),
            category: str(product.category, 80),
            qty: clampQty(qty),
            note: ''
        };
        items.push(it);
    }
    commitItems();
    return { ...it };
}

export function setQty(id, qty) {
    const n = Math.floor(Number(qty));
    if (!(n >= 1)) return removeItem(id);
    const it = items.find(i => i.id === String(id));
    if (!it) return;
    it.qty = clampQty(n);
    commitItems();
}

export const increment = (id) => { const it = items.find(i => i.id === String(id)); if (it) setQty(id, it.qty + 1); };
export const decrement = (id) => { const it = items.find(i => i.id === String(id)); if (it) setQty(id, it.qty - 1); };

export function removeItem(id) {
    items = items.filter(i => i.id !== String(id));
    commitItems();
}

export function setItemNote(id, note) {
    const it = items.find(i => i.id === String(id));
    if (!it) return;
    it.note = str(note, 300);
    commitItems();
}

export function clear() {
    items = [];
    commitItems();
}

// Samakan nama/harga/foto dengan katalog terbaru. missing = produk yang sudah tidak ada.
export function syncWithCatalog(products) {
    const map = new Map((products || []).map(p => [String(p.id), p]));
    const changed = [], missing = [];
    items.forEach(it => {
        const p = map.get(it.id);
        if (!p) { missing.push(it.id); return; }
        const price = Number(p.price);
        if (Number.isFinite(price) && (price !== it.price || p.name !== it.name)) {
            it.price = price; it.name = str(p.name, 120); changed.push(it.id);
        }
        if (p.image_url !== undefined) it.image_url = str(p.image_url, 500);
    });
    if (changed.length) commitItems();
    return { changed, missing };
}

// ------------------------------------------------------------
// Draf checkout (alamat, kurir, pembayaran, catatan pesanan)
// ------------------------------------------------------------
export const getDraft = () => JSON.parse(JSON.stringify(draft));

// patch contoh: {customer:{name:'Budi'}}, {address:{city:'Bandung'}}, {payment_method:'qris'}
export function updateDraft(patch = {}) {
    const next = JSON.parse(JSON.stringify(draft));
    if (patch.customer) Object.assign(next.customer, patch.customer);
    if (patch.address) Object.assign(next.address, patch.address);
    ['courier_code', 'service', 'payment_method', 'note', 'voucher'].forEach(k => { if (k in patch) next[k] = patch[k]; });
    draft = sanitizeDraft(next);
    commitDraft();
}

// ------------------------------------------------------------
// Kurir, ongkir, dan total
// ------------------------------------------------------------
export function getSelectedShipping() {
    const courier = CFG.couriers.find(c => c.code === draft.courier_code);
    const service = courier?.services.find(s => s.name === draft.service);
    if (!courier || !service) return null;
    return {
        courier_code: courier.code, courier_name: courier.name,
        service: service.name, eta: service.eta || '', cost: Number(service.price) || 0
    };
}

export function calculate() {
    const subtotal = itemsTotal();
    const ship = getSelectedShipping();
    const shippingOriginal = ship ? ship.cost : 0;
    const min = Number(CFG.free_shipping_min) || 0;
    const freeShipping = shippingOriginal > 0 && min > 0 && subtotal >= min;
    const shippingCost = freeShipping ? 0 : shippingOriginal;
    const serviceFee = items.length ? (Number(CFG.service_fee) || 0) : 0;
    const voucher = draft.voucher;
    const voucherOk = Boolean(voucher) && subtotal >= (voucher.min_purchase || 0);
    const discount = voucherOk ? voucherDiscount(voucher, subtotal) : 0;

    return {
        count: count(),
        itemsTotal: subtotal,
        shippingOriginal,
        shippingCost,
        freeShipping,
        serviceFee,
        voucher,
        voucherOk,
        voucherDiscount: discount,
        total: subtotal - discount + shippingCost + serviceFee
    };
}

// ------------------------------------------------------------
// Validasi sebelum pesanan dikirim (aturannya sama dengan create_order di server)
// ------------------------------------------------------------
export function validateCheckout() {
    const errors = {};
    const { customer: c, address: a } = draft;

    if (!items.length) errors.items = 'Keranjang masih kosong.';
    // Barang demo (id "demo-...") tidak diblokir di sini: order-api.js mensimulasikan pesanannya tanpa menyimpan.

    if (c.name.trim().length < 2) errors['customer.name'] = 'Nama penerima wajib diisi.';
    const phone = digits(c.phone);
    if (phone.length < 9 || phone.length > 15) errors['customer.phone'] = 'Nomor HP tidak valid (9-15 angka).';
    if (c.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email.trim())) errors['customer.email'] = 'Format email tidak valid.';

    if (a.line.trim().length < 10) errors['address.line'] = 'Alamat lengkap minimal 10 karakter (jalan, nomor, RT/RW).';
    if (a.city.trim().length < 2) errors['address.city'] = 'Kota/kabupaten wajib diisi.';
    if (a.postal_code.trim() && !/^\d{5}$/.test(a.postal_code.trim())) errors['address.postal_code'] = 'Kode pos harus 5 angka.';

    if (!getSelectedShipping()) errors.shipping = 'Pilih kurir dan layanan pengiriman.';
    if (!CFG.payment_methods.some(m => m.code === draft.payment_method)) errors.payment = 'Pilih metode pembayaran.';

    return { ok: Object.keys(errors).length === 0, errors };
}

// ------------------------------------------------------------
// Pesanan berhasil: kosongkan keranjang dan catatan, simpan data penerima
// untuk memudahkan belanja berikutnya.
// ------------------------------------------------------------
export function completeOrder() {
    items = [];
    draft.note = '';
    draft.payment_method = '';
    draft.voucher = null;
    storage.write(CART_KEY, items);
    commitDraft();
}

// Hapus data pribadi yang tersimpan di perangkat ini (alamat, nomor HP, dll.)
export function clearPersonalData() {
    const keep = { courier_code: draft.courier_code, service: draft.service };
    draft = { ...emptyDraft(), ...keep };
    commitDraft();
}
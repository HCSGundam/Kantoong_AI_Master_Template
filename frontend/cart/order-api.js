// ============================================================
// cart/order-api.js - Mengirim pesanan ke Supabase
// Satu-satunya file keranjang yang bicara dengan database. Memanggil fungsi
// create_order() dari order.sql, yang menghitung ulang harga dari tabel products.
//
// Hasil submitOrder():
//   {ok: true,  simulated: bool, receipt}                  pesanan dibuat
//   {ok: false, reason: 'validation', errors}              isian belum lengkap
//   {ok: false, reason: 'busy' | 'server' | 'network', message}
// ============================================================

import { supabase } from '../js/supabase-client.js';
import { CartConfig as CFG } from './cart-config.js';
import * as Cart from './cart-store.js';
import { getSalesRef } from '../js/sales-store.js';

const RECEIPT_KEY = `kantoong:last-order:${CFG.business_id}`;
const RECEIPT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // struk terakhir disimpan 7 hari di perangkat ini
const TIMEOUT_MS = 20000;

let inFlight = false;

const digits = (v) => String(v ?? '').replace(/\D/g, '');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export const isDemoCart = () => Cart.getItems().some(Cart.isDemoItem);
export const paymentLabel = (code) => CFG.payment_methods.find(m => m.code === code)?.label || code;

// ------------------------------------------------------------
// Data yang dikirim ke create_order() (format sama dengan komentar di order.sql)
// ------------------------------------------------------------
export function buildOrderPayload() {
    const d = Cart.getDraft();
    const calc = Cart.calculate();
    const ship = Cart.getSelectedShipping();
    const t = (v) => String(v ?? '').trim();

    return {
        business_id: CFG.business_id,
        prefix: CFG.order_prefix,
        customer: { name: t(d.customer.name), phone: t(d.customer.phone), email: t(d.customer.email) },
        address: {
            line: t(d.address.line), district: t(d.address.district), city: t(d.address.city),
            province: t(d.address.province), postal_code: t(d.address.postal_code)
        },
        shipping: ship && {
            courier_code: ship.courier_code, courier_name: ship.courier_name,
            service: ship.service, eta: ship.eta, cost: calc.shippingCost
        },
        payment_method: d.payment_method,
        note: t(d.note),
        service_fee: calc.serviceFee,
        // Toko sales perujuk (30 hari): pesanan tercatat atas nama sales tsb.
        sales_slug: getSalesRef(),
        // Voucher diperiksa ulang & dipotong di server (create_order_v2).
        voucher_code: calc.voucherOk ? d.voucher.code : '',
        items: Cart.getItems().map(it => ({ product_id: it.id, qty: it.qty, note: it.note }))
    };
}

// ------------------------------------------------------------
// Cek voucher (fungsi erp_check_voucher di erp-phase3.sql)
// ------------------------------------------------------------
export async function checkVoucher(code) {
    const clean = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{3,20}$/.test(clean)) return { valid: false, message: 'Kode voucher tidak valid.' };
    try {
        const { data, error } = await supabase.rpc('erp_check_voucher', { p_code: clean, p_subtotal: Cart.calculate().itemsTotal });
        if (error) {
            return { valid: false, message: error.code === 'PGRST202' ? 'Voucher belum aktif di toko ini.' : 'Gagal memeriksa voucher. Coba lagi.' };
        }
        return data || { valid: false, message: 'Kode voucher tidak ditemukan.' };
    } catch {
        return { valid: false, message: 'Tidak bisa terhubung ke server.' };
    }
}

// ------------------------------------------------------------
// Pesan error yang ramah (pesan RAISE EXCEPTION dari SQL sudah berbahasa Indonesia)
// ------------------------------------------------------------
function friendlyError(error) {
    const msg = String(error?.message || '');
    if (error?.code === 'P0001') return { reason: 'server', message: msg };
    if (error?.code === 'PGRST202' || error?.code === '42883') {
        return { reason: 'server', message: 'Sistem pesanan belum aktif di database. Admin perlu menjalankan order.sql di Supabase.' };
    }
    if (error?.code === '42501') {
        return { reason: 'server', message: 'Akses ditolak oleh database. Periksa pengaturan keamanan (grant/RLS) di Supabase.' };
    }
    if (/abort|failed to fetch|network|timeout/i.test(msg)) {
        return { reason: 'network', message: 'Tidak bisa terhubung ke server. Periksa internetmu lalu coba lagi.' };
    }
    console.error('[Order API] error tak dikenal:', error);
    return { reason: 'server', message: 'Pesanan gagal dibuat. Coba lagi sebentar lagi.' };
}

// ------------------------------------------------------------
// Struk: salinan data pesanan untuk layar "Pesanan dibuat"
// ------------------------------------------------------------
function makeReceipt({ orderCode, simulated, totals }) {
    const d = Cart.getDraft();
    const ship = Cart.getSelectedShipping();
    return {
        order_code: orderCode,
        status: 'menunggu_pembayaran',
        simulated,
        created_at: new Date().toISOString(),
        items: Cart.getItems().map(it => ({
            name: it.name, qty: it.qty, unit_price: it.price, subtotal: it.price * it.qty, note: it.note
        })),
        customer: { ...d.customer },
        address: { ...d.address },
        shipping: ship ? { courier_name: ship.courier_name, service: ship.service, eta: ship.eta, cost: totals.shipping_cost } : null,
        payment_method: d.payment_method,
        payment_label: paymentLabel(d.payment_method),
        note: d.note,
        totals
    };
}

function saveReceipt(receipt) {
    try { localStorage.setItem(RECEIPT_KEY, JSON.stringify({ t: Date.now(), receipt })); } catch { /* diblokir */ }
}

export function getLastOrder() {
    try {
        const saved = JSON.parse(localStorage.getItem(RECEIPT_KEY));
        if (saved && Date.now() - saved.t < RECEIPT_TTL_MS) return saved.receipt;
    } catch { /* kosong atau rusak */ }
    return null;
}

export function clearLastOrder() {
    try { localStorage.removeItem(RECEIPT_KEY); } catch { /* diblokir */ }
}

// Tautan WhatsApp untuk konfirmasi pembayaran (kosong jika nomor admin belum diisi)
export function buildWhatsAppLink(receipt) {
    const number = digits(CFG.whatsapp_number);
    if (!number || !receipt || receipt.simulated) return '';
    const text = `Halo, saya ingin konfirmasi pesanan ${receipt.order_code} atas nama ${receipt.customer.name}. ` +
        `Total ${Cart.rupiah(receipt.totals.total)}, metode bayar ${receipt.payment_label}.`;
    return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

// ------------------------------------------------------------
// Kirim pesanan
// ------------------------------------------------------------
export async function submitOrder() {
    if (inFlight) return { ok: false, reason: 'busy', message: 'Pesanan sedang diproses, mohon tunggu.' };

    const check = Cart.validateCheckout();
    if (!check.ok) return { ok: false, reason: 'validation', errors: check.errors };

    inFlight = true;
    try {
        // Mode demo: barang contoh tidak ada di database, jadi pesanan hanya disimulasikan
        if (isDemoCart()) {
            await sleep(700);
            const c = Cart.calculate();
            const receipt = makeReceipt({
                orderCode: 'DEMO-' + Math.random().toString(36).slice(2, 7).toUpperCase(),
                simulated: true,
                totals: { items_total: c.itemsTotal, shipping_cost: c.shippingCost, service_fee: c.serviceFee, voucher_code: c.voucherOk ? c.voucher.code : '', voucher_discount: c.voucherDiscount, total: c.total }
            });
            saveReceipt(receipt);
            Cart.completeOrder();
            return { ok: true, simulated: true, receipt };
        }

        const payload = buildOrderPayload();
        const localTotal = Cart.calculate().total;

        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
        let data, error;
        try {
            // create_order_v2 = create_order + atribusi sales (db/erp-foundation.sql).
            // Bila database ERP belum dipasang, jatuh ke create_order biasa.
            ({ data, error } = await supabase.rpc('create_order_v2', { p: payload }).abortSignal(ctl.signal));
            if (error && (error.code === 'PGRST202' || error.code === '42883')) {
                ({ data, error } = await supabase.rpc('create_order', { p: payload }).abortSignal(ctl.signal));
            }
        } catch (e) {
            error = e;
        } finally {
            clearTimeout(timer);
        }

        if (error || !data?.order_code) {
            return { ok: false, ...friendlyError(error || { message: 'respons kosong' }) };
        }

        const totals = {
            items_total: Number(data.items_total), shipping_cost: Number(data.shipping_cost),
            service_fee: Number(data.service_fee), total: Number(data.total),
            voucher_code: data.voucher_code || '', voucher_discount: Number(data.voucher_discount) || 0
        };
        const receipt = makeReceipt({ orderCode: data.order_code, simulated: false, totals });
        receipt.price_changed = Math.abs(totals.total - localTotal) > 0.5; // harga di server berbeda dari yang terlihat di keranjang
        saveReceipt(receipt);
        Cart.completeOrder();
        return { ok: true, simulated: false, receipt };
    } finally {
        inFlight = false;
    }
}
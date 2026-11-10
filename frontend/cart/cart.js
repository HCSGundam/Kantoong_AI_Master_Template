// ============================================================
// cart/cart.js - Pintu masuk modul keranjang & checkout
// Dimuat satu baris dari index.html. Tugasnya: memasang CSS dan kerangka halaman,
// memindah layar (keranjang -> checkout -> pesanan dibuat), mengurus tombol
// kembali HP, dan menjaga lencana jumlah di ikon keranjang.
//
// EVENT MASUK
//   kantoong:cart-add     {product, qty}   tambah barang (dikirim engine.js dari tombol "+")
//   kantoong:cart-open                     buka halaman keranjang
//   supabase-data-ready   products[]       samakan harga/nama barang dengan katalog terbaru
// EVENT KELUAR
//   kantoong:consult {text:''}             tombol "Mulai konsultasi" di keranjang kosong
// ============================================================

import * as Cart from './cart-store.js';
import * as Views from './views.js';
import { shouldNudge, upcomingReminder } from './cart-reason.js';

const host = document.querySelector('.mobile-container') || document.body;

// ------------------------------------------------------------
// CSS (disisipkan otomatis, jadi index.html tidak perlu tag <link>)
// ------------------------------------------------------------
const cssHref = new URL('./cart.css', import.meta.url).href;
const page = document.createElement('div');
page.className = 'cart-page';
page.id = 'cartPage';
page.setAttribute('role', 'dialog');
page.setAttribute('aria-modal', 'true');
page.setAttribute('aria-label', 'Keranjang belanja');
page.setAttribute('aria-hidden', 'true');

if (![...document.styleSheets].some(s => s.href === cssHref)) {
    page.style.display = 'none'; // sembunyikan sampai CSS siap agar tidak berkedip tanpa gaya
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssHref;
    link.onload = link.onerror = () => { page.style.display = ''; };
    document.head.appendChild(link);
}

// ------------------------------------------------------------
// Kerangka halaman
// ------------------------------------------------------------
page.innerHTML = `
    <header class="cart-header">
        <button class="cart-back" id="cartBack" aria-label="Kembali">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <div class="cart-title"><h2 id="cartTitle">Keranjang</h2><p class="cart-subtitle" id="cartSubtitle"></p></div>
        <div class="cart-steps" aria-hidden="true"><span class="step"></span><span class="step"></span><span class="step"></span></div>
    </header>
    <div class="cart-body" id="cartBody"></div>
    <footer class="cart-footer" id="cartFooter" hidden></footer>`;
host.appendChild(page);

const body = page.querySelector('#cartBody');
const footer = page.querySelector('#cartFooter');
const titleEl = page.querySelector('#cartTitle');
const subtitleEl = page.querySelector('#cartSubtitle');
const steps = [...page.querySelectorAll('.cart-steps .step')];

// ------------------------------------------------------------
// Pemberitahuan kecil (tampil di atas panel chat maupun bar bawah keranjang)
// ------------------------------------------------------------
let toastEl = null;
function toast(text) {
    toastEl?.remove();
    toastEl = document.createElement('div');
    toastEl.className = 'cart-toast';
    toastEl.setAttribute('role', 'status');
    toastEl.textContent = text;
    toastEl.style.zIndex = '70';
    toastEl.style.bottom = 'calc(140px + var(--safe-bottom, 0px))';
    host.appendChild(toastEl);
    const mine = toastEl;
    mine.addEventListener('animationend', () => mine.remove());
}

// ------------------------------------------------------------
// Konteks untuk views.js
// ------------------------------------------------------------
let view = 'cart';
const missing = new Set(); // id barang yang sudah tidak ada di katalog

const ctx = {
    body, footer, missing, toast,
    header: {
        set(title, subtitle = '', step = 1) {
            titleEl.textContent = title;
            subtitleEl.textContent = subtitle;
            subtitleEl.hidden = !subtitle;
            steps.forEach((s, i) => { s.className = 'step' + (i < step - 1 ? ' is-done' : i === step - 1 ? ' is-active' : ''); });
        }
    },
    go,
    close: () => close()
};

function go(next, data) {
    view = next;
    body.onclick = body.oninput = body.onchange = footer.onclick = null; // bersihkan pendengar layar sebelumnya
    footer.innerHTML = '';
    body.scrollTop = 0;
    if (next === 'checkout') Views.renderCheckoutView(ctx);
    else if (next === 'success') Views.renderSuccessView(ctx, data);
    else Views.renderCartView(ctx);
}

// ------------------------------------------------------------
// Buka / tutup (+ tombol kembali bawaan HP)
// ------------------------------------------------------------
const isOpen = () => page.classList.contains('is-open');
let pushed = false;

function open(startView = 'cart', data) {
    page.classList.add('is-open');
    page.setAttribute('aria-hidden', 'false');
    // Asisten AI mengecil jadi orb agar tidak menutupi tombol "Buat pesanan".
    window.dispatchEvent(new CustomEvent('kantoong:overlay', { detail: { name: 'cart', open: true } }));
    go(startView, data);
    if (!pushed) {
        try { history.pushState({ kantoongCart: 1 }, ''); pushed = true; } catch { /* diblokir */ }
    }
    setTimeout(() => page.querySelector('#cartBack')?.focus({ preventScroll: true }), 360);
}

function close({ fromPop = false } = {}) {
    if (!isOpen()) return;
    page.classList.remove('is-open');
    page.setAttribute('aria-hidden', 'true');
    window.dispatchEvent(new CustomEvent('kantoong:overlay', { detail: { name: 'cart', open: false } }));
    if (pushed && !fromPop) { pushed = false; try { history.back(); } catch { /* abaikan */ } }
    else pushed = false;
    document.getElementById('btnCart')?.focus({ preventScroll: true });
}

function back() {
    if (view === 'checkout') go('cart');
    else close();
}

// Tombol kembali HP: dari checkout kembali ke keranjang, dari keranjang menutup halaman
window.addEventListener('popstate', () => {
    if (!isOpen()) return;
    pushed = false;
    if (view === 'checkout') {
        go('cart');
        try { history.pushState({ kantoongCart: 1 }, ''); pushed = true; } catch { /* abaikan */ }
    } else {
        close({ fromPop: true });
    }
});

page.querySelector('#cartBack').addEventListener('click', back);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) back(); });

// ------------------------------------------------------------
// Lencana jumlah di ikon keranjang (header)
// ------------------------------------------------------------
function updateBadge() {
    const badge = document.getElementById('cartCount');
    if (!badge) return;
    const n = Cart.count();
    badge.hidden = n === 0;
    badge.textContent = n > 99 ? '99+' : String(n);
}

window.addEventListener('kantoong:cart-changed', updateBadge);
document.getElementById('btnCart')?.addEventListener('click', () => open('cart'));
updateBadge();

// ------------------------------------------------------------
// Event dari modul lain
// ------------------------------------------------------------
window.addEventListener('kantoong:cart-add', (e) => {
    const qty = e.detail?.qty || 1;
    const item = Cart.addItem(e.detail?.product, qty);
    if (!item) return;
    // Barang baru tanpa alasan: tawarkan "Ingat alasannya" (opsional, tidak memaksa).
    if (item.qty === qty && !item.reason) {
        actionToast(`${item.name} udah di keranjang ✓`, 'Ingat alasannya', () => { ctx.reasonFor = item.id; open('cart'); });
    } else {
        toast(`${item.name} udah di keranjang ✓`);
    }
});

// ------------------------------------------------------------
// Pemberitahuan dengan satu tombol (hilang sendiri setelah 6 detik)
// ------------------------------------------------------------
let actionEl = null;
function actionToast(text, label, onClick) {
    toastEl?.remove();
    actionEl?.remove();
    const box = document.createElement('div');
    box.className = 'cart-action-toast';
    box.setAttribute('role', 'status');
    const span = document.createElement('span');
    span.textContent = text;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.addEventListener('click', () => { box.remove(); onClick(); });
    box.append(span, btn);
    host.appendChild(box);
    actionEl = box;
    setTimeout(() => box.classList.add('is-leaving'), 6000);
    setTimeout(() => box.remove(), 6400);
}

// Pengingat lembut di dalam web (maks 1x sehari): barang beralasan bertanggal <= 3 hari lagi.
const NUDGE_KEY = 'kantoong:cart-reason-nudge';
setTimeout(() => {
    try {
        const soon = upcomingReminder(Cart.getItems(), Date.now(), { within: 3 });
        if (!soon || !shouldNudge(localStorage.getItem(NUDGE_KEY))) return;
        localStorage.setItem(NUDGE_KEY, new Date().toDateString());
        actionToast(soon.message, 'Lihat keranjang', () => open('cart'));
    } catch { /* penyimpanan diblokir */ }
}, 2500);

window.addEventListener('kantoong:cart-open', () => open('cart'));

// Katalog terbaru datang: samakan harga & tandai barang yang sudah hilang
window.addEventListener('supabase-data-ready', (e) => {
    const { missing: gone } = Cart.syncWithCatalog(e.detail || []);
    missing.clear();
    gone.forEach(id => missing.add(id));
    if (isOpen() && view === 'cart') go('cart');
});

// Untuk debugging di console: KantoongCart.open()
window.KantoongCart = { open, close, count: Cart.count };
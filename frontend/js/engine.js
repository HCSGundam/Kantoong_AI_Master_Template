// ============================================================
// engine.js - Kantoong AI Master Template (Core Engine)
// Tugas: terapkan config, ambil data Supabase, render etalase
// (hero, area bebas, produk unggulan, kategori), keranjang,
// laci menu, dan login. Chat ada di ai-brain.js, gestur panel
// ada di panel.js. Antar-modul berkomunikasi lewat event window.
//
// EVENT KELUAR (engine -> modul lain)
//   kantoong:consult        {text, productId?}  buka chat (+ kirim pesan jika text ada)
//   supabase-data-ready     products[]          data produk siap
//   kantoong-ai-ready       KantoongState       data siap (nama lama, tetap dipertahankan)
//   kantoong:catalog-reset  -                   user menekan "Kembali ke awal"
// EVENT MASUK (modul lain -> engine)
//   kantoong:matched        {ids: []}           AI mencocokkan produk -> etalase berganti
//   kantoong:show-catalog   -                   gulir halaman ke etalase
// ============================================================

import { supabase } from './supabase-client.js';

// Ubah ke false SEBELUM template dipakai klien / dijual.
const DEV_AUTO_ADMIN = true;

const CFG = (typeof KantoongConfig !== 'undefined') ? KantoongConfig : {};

// State Global untuk Kantoong Core + AI Agent Context
export const KantoongState = {
    products: [],
    featured: [],
    matched: null,       // array produk hasil pencocokan AI, atau null = etalase default
    cart: [],
    isLoading: false,
    usingDemo: false,
    activeTenant: CFG.business_id || 'yanti-gold-default',
    agentStatus: 'ready'
};
const S = KantoongState;

// ------------------------------------------------------------
// Helper kecil
// ------------------------------------------------------------
const $ = (sel, root = document) => root.querySelector(sel);
const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const rupiah = (n) => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0
}).format(Number(n) || 0);

const store = {
    get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage penuh/diblokir */ } }
};

// Render HTML ke elemen DAN jalankan <script> di dalamnya.
function injectHTML(el, html) {
    el.innerHTML = html;
    el.querySelectorAll('script').forEach(old => {
        const s = document.createElement('script');
        if (old.src) s.src = old.src;
        else s.textContent = old.textContent;
        old.replaceWith(s);
    });
}

// ------------------------------------------------------------
// 1. Terapkan konfigurasi (judul, warna, sapaan AI)
// ------------------------------------------------------------
function applyConfig() {
    if (CFG.app_name) {
        document.title = CFG.app_name;
        const pageTitle = $('#pageTitle');
        const brandTitle = $('#brandTitle');
        if (pageTitle) pageTitle.textContent = CFG.app_name;
        if (brandTitle) brandTitle.textContent = CFG.app_name;
    }
    if (CFG.theme_color_primary) {
        document.documentElement.style.setProperty('--primary-color', CFG.theme_color_primary);
    }
    const peekTitle = $('#peekTitle');
    const peekGreeting = $('#peekGreeting');
    if (peekTitle && CFG.ai_title) peekTitle.textContent = CFG.ai_title;
    if (peekGreeting && CFG.ai_greetings?.length) {
        peekGreeting.textContent = CFG.ai_greetings[Math.floor(Math.random() * CFG.ai_greetings.length)];
    }
}

// ------------------------------------------------------------
// 2. Hero: slider yang geser otomatis tiap X detik
// ------------------------------------------------------------
function slideMedia(s) {
    if (s.type === 'video' && s.src) {
        return `<video src="${esc(s.src)}" muted loop playsinline autoplay preload="metadata"></video>`;
    }
    if (s.type === 'image' && s.src) {
        return `<img src="${esc(s.src)}" alt="${esc(s.title)}" loading="lazy">`;
    }
    return `<span class="hero-media-label">${esc(s.media_label || 'Foto / video brand')}</span>`;
}

function renderHero() {
    const section = $('#heroSection');
    const track = $('#heroTrack');
    const dotsBox = $('#heroDots');
    const slides = CFG.hero?.slides || [];
    if (!section || !track) return;
    if (!slides.length) { section.hidden = true; return; }

    track.innerHTML = slides.map((s, i) => `
        <article class="hero-slide${i === 0 ? ' is-active' : ''}">
            <div class="hero-media">${slideMedia(s)}</div>
            <p class="hero-eyebrow">${esc(s.caption)}</p>
            <h2 class="hero-title">${esc(s.title)}</h2>
            <p class="hero-text">${esc(s.text)}</p>
            <div class="hero-cta">
                <button class="btn-primary" data-action="scroll-featured">Lihat produk →</button>
                <button class="btn-outline" data-action="consult" data-prompt="${esc(s.ai_prompt || '')}">✦ Konsultasi AI</button>
            </div>
        </article>`).join('');

    const n = slides.length;
    if (n < 2) return; // satu slide: tanpa titik dan tanpa geser otomatis

    dotsBox.innerHTML = slides.map((_, i) => `<span class="dot${i === 0 ? ' active' : ''}"></span>`).join('');
    const dots = [...dotsBox.children];
    const items = [...track.children];
    let current = 0;

    const setActive = (i) => {
        current = i;
        dots.forEach((d, k) => d.classList.toggle('active', k === i));
        items.forEach((s, k) => s.classList.toggle('is-active', k === i));
    };
    const goTo = (i) => track.scrollTo({ left: ((i + n) % n) * track.clientWidth, behavior: 'smooth' });

    // Sinkronkan titik dengan posisi geser (baik otomatis maupun digeser jari)
    let ticking = false;
    track.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            const i = Math.round(track.scrollLeft / track.clientWidth);
            if (i !== current && i >= 0 && i < n) setActive(i);
            ticking = false;
        });
    }, { passive: true });

    // Geser otomatis; berhenti saat disentuh, tab tersembunyi, atau user memilih "reduce motion"
    const seconds = Number(CFG.hero?.interval_seconds) || 0;
    if (!seconds || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let paused = false;
    let timer = setInterval(tick, seconds * 1000);
    function tick() { if (!paused && !document.hidden) goTo(current + 1); }
    const restart = () => { clearInterval(timer); timer = setInterval(tick, seconds * 1000); };

    track.addEventListener('pointerdown', () => { paused = true; });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
        track.addEventListener(ev, () => { paused = false; restart(); }));
}

// ------------------------------------------------------------
// 3. Area bebas pemilik brand
// ------------------------------------------------------------
function renderBrandSlot() {
    const box = $('#brandSlot');
    const cfg = CFG.brand_slot || {};
    if (!box) return;
    box.innerHTML = '';
    if (cfg.type === 'highlights' && cfg.items?.length) {
        box.innerHTML = `<div class="brand-highlights">${cfg.items.map(it =>
            `<div class="brand-highlight"><strong>${esc(it.title)}</strong><span>${esc(it.sub)}</span></div>`).join('')}</div>`;
    } else if (cfg.type === 'text' && cfg.text) {
        box.innerHTML = `<div class="brand-slot-box">${esc(cfg.text).replace(/\n/g, '<br>')}</div>`;
    }
}

// ------------------------------------------------------------
// 4. Kartu produk, etalase unggulan, dan kategori
// ------------------------------------------------------------
function productCard(p, i = 0) {
    const initial = esc((p.name || '?').trim().charAt(0).toUpperCase());
    const thumb = p.image_url
        ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">`
        : initial;
    return `
        <article class="product-card" style="--i:${i}" data-id="${esc(p.id)}">
            <div class="product-thumb">${thumb}</div>
            <h3 class="product-name">${esc(p.name)}</h3>
            <p class="product-price">${rupiah(p.price)}</p>
            <div class="product-actions">
                <button class="product-ask" data-action="ask-product" data-id="${esc(p.id)}">${esc(CFG.featured?.ask_label || 'Tanyakan produk ini')}</button>
                <button class="product-cart" data-action="add-cart" data-id="${esc(p.id)}" aria-label="Tambah ke keranjang">+</button>
            </div>
        </article>`;
}

function renderSkeleton() {
    const rail = $('#featuredRail');
    if (!rail) return;
    rail.innerHTML = Array.from({ length: 3 }, () => `
        <article class="product-card is-loading">
            <div class="product-thumb"></div>
            <h3 class="product-name">&nbsp;</h3>
            <p class="product-price">Rp 000.000</p>
            <div class="product-actions"><button class="product-ask" disabled>&nbsp;</button><button class="product-cart" disabled></button></div>
        </article>`).join('');
}

function renderFeatured() {
    const rail = $('#featuredRail');
    const title = $('#featuredTitle');
    const reset = $('#resetCatalogBtn');
    if (!rail) return;

    const list = S.matched || S.featured;
    const newTitle = S.matched
        ? (CFG.featured?.matched_title || 'Pilihan AI untuk kamu')
        : (CFG.featured?.title || 'Produk Unggulan');

    if (title && title.textContent !== newTitle) {
        title.textContent = newTitle;
        title.classList.remove('title-swap'); void title.offsetWidth; title.classList.add('title-swap');
    }
    if (reset) reset.hidden = !S.matched;

    rail.innerHTML = list.length
        ? list.map(productCard).join('')
        : '<p class="empty-state">Belum ada produk. Tambahkan lewat dashboard admin.</p>';
    rail.scrollTo({ left: 0 });

    // Efek kartu muncul berurutan hanya saat hasil dari AI
    rail.classList.remove('rail-flash');
    if (S.matched) { void rail.offsetWidth; rail.classList.add('rail-flash'); }
}

function renderCategories() {
    const section = $('#categorySection');
    const box = $('#categoryList');
    if (!section || !box) return;
    if (CFG.categories?.enabled === false) { section.hidden = true; return; }

    const groups = {};
    S.products.forEach(p => {
        const name = String(p.category || '').trim();
        if (name) (groups[name] ||= []).push(p);
    });
    const names = Object.keys(groups);
    section.hidden = !names.length;
    box.innerHTML = names.length
        ? `<div class="section-head"><h2>${esc(CFG.categories?.title || 'Kategori lain')}</h2></div>` +
          names.map(n => `
            <div class="category-block">
                <h3 class="category-title">${esc(n)}</h3>
                <div class="rail scroll-x">${groups[n].map(productCard).join('')}</div>
            </div>`).join('')
        : '';
}

function scrollToFeatured() {
    const page = $('#pageScroll');
    const section = $('#featuredSection');
    const header = $('.app-header');
    if (!page || !section) return;
    const y = section.getBoundingClientRect().top - page.getBoundingClientRect().top + page.scrollTop;
    page.scrollTo({ top: Math.max(0, y - (header?.offsetHeight || 72) - 16), behavior: 'smooth' });
}

// ------------------------------------------------------------
// 5. Data Supabase + AI Agent Event Bus
// ------------------------------------------------------------
async function initSupabaseDataBridge() {
    console.info('⚙️ [Kantoong Engine] Menghubungkan etalase ke Supabase Cloud...');
    S.isLoading = true;
    renderSkeleton();

    let rows = [];
    try {
        const { data, error } = await supabase.from('products').select('*');
        if (error) throw error;
        rows = data || [];
    } catch (err) {
        console.warn('⚠️ [Supabase] Gagal mengambil produk, memakai data contoh jika diizinkan:', err.message);
    }

    rows = rows.filter(p => p.is_published !== false);
    if (CFG.filter_by_business_id) rows = rows.filter(p => p.business_id === CFG.business_id);

    // Terlaris dulu; jika sama, yang terbaru dulu
    rows.sort((a, b) =>
        (Number(b.sales_count) || 0) - (Number(a.sales_count) || 0) ||
        String(b.created_at || '').localeCompare(String(a.created_at || '')));

    S.usingDemo = false;
    if (!rows.length && CFG.use_demo_when_empty !== false) {
        rows = (CFG.demo_products || []).slice();
        S.usingDemo = true;
    }

    S.products = rows;
    S.featured = rows.slice(0, CFG.featured?.limit || 8);
    S.isLoading = false;
    renderFeatured();
    renderCategories();
    console.log(`📦 [Kantoong Core] ${rows.length} produk siap${S.usingDemo ? ' (data contoh)' : ''}.`);

    emit('supabase-data-ready', S.products);
    emit('kantoong-ai-ready', S);
}

// AI mencocokkan produk -> etalase berganti otomatis
window.addEventListener('kantoong:matched', (e) => {
    const ids = (e.detail?.ids || []).map(String);
    const list = ids.map(id => S.products.find(p => String(p.id) === id)).filter(Boolean);
    if (!list.length) return;
    S.matched = list;
    renderFeatured();
    scrollToFeatured();
});

window.addEventListener('kantoong:show-catalog', scrollToFeatured);

// ------------------------------------------------------------
// 6. Keranjang (diurus modul cart/cart.js; engine hanya mengirim event)
// ------------------------------------------------------------
function addToCart(id) {
    const product = S.products.find(p => String(p.id) === String(id));
    if (product) emit('kantoong:cart-add', { product, qty: 1 });
}

// ------------------------------------------------------------
// 7. Klik di seluruh halaman (satu pendengar untuk semua tombol)
// ------------------------------------------------------------
document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id, prompt } = el.dataset;

    if (action === 'scroll-featured') scrollToFeatured();
    else if (action === 'consult') emit('kantoong:consult', { text: prompt || '' });
    else if (action === 'ask-product') {
        const p = S.products.find(x => String(x.id) === String(id));
        if (p) emit('kantoong:consult', { text: `Ceritakan tentang ${p.name}`, productId: p.id });
    }
    else if (action === 'add-cart') addToCart(id);
});

document.addEventListener('DOMContentLoaded', () => {
    $('#btnSearch')?.addEventListener('click', () => emit('kantoong:consult', { text: '' }));

    $('#resetCatalogBtn')?.addEventListener('click', () => {
        S.matched = null;
        renderFeatured();
        emit('kantoong:catalog-reset');
    });
});

// ------------------------------------------------------------
// 8. Laci menu, komponen modular, admin & Google One Tap
//    (logika lama dipertahankan; akan diganti Supabase Auth
//    di tahap dashboard admin)
// ------------------------------------------------------------
function initMenuAndAuth() {
    const menuBtn = $('#showcaseMenuBtn');
    const drawer = $('#sampleDrawer');
    const closeDrawer = $('#closeDrawer');
    const container = $('#dynamicComponentContainer');

    if (menuBtn && drawer) menuBtn.addEventListener('click', () => { drawer.style.display = 'flex'; });
    if (closeDrawer && drawer) closeDrawer.addEventListener('click', () => { drawer.style.display = 'none'; });

    // Tombol "Katalog Produk Toko": tutup laci lalu gulir ke etalase
    $('#btnOpenCatalog')?.addEventListener('click', () => {
        if (drawer) drawer.style.display = 'none';
        scrollToFeatured();
    });

    // Komponen modular (tombol dengan atribut data-component)
    document.querySelectorAll('.sample-item-btn[data-component]').forEach(btn => {
        btn.addEventListener('click', () => {
            const compFile = btn.getAttribute('data-component');
            if (!compFile) return;
            if (drawer) drawer.style.display = 'none';

            fetch(`components/${compFile}`)
                .then(res => {
                    if (!res.ok) throw new Error('Gagal memuat komponen: components/' + compFile);
                    return res.text();
                })
                .then(html => {
                    if (!container) return;
                    injectHTML(container, html);
                    const closeCompBtn = container.querySelector('#closeGoldModal') || container.querySelector('.gp-close');
                    if (closeCompBtn) closeCompBtn.addEventListener('click', () => { container.innerHTML = ''; });
                })
                .catch(err => alert('Info: ' + err.message));
        });
    });

    // ---------- Sistem Admin & Google One Tap ----------
    const ADMIN_EMAILS = [
        'micken.jobmail@gmail.com' // Email whitelist admin
    ];

    const drawerAdminBtn = $('#drawerAdminBtn');
    const customerGoogleSignInDiv = $('#customerGoogleSignInDiv');
    const drawerCustomerLogoutBtn = $('#drawerCustomerLogoutBtn');

    // Mode testing: otomatis dianggap admin
    if (DEV_AUTO_ADMIN && !localStorage.getItem('kantong_admin_email')) {
        localStorage.setItem('kantong_admin_email', ADMIN_EMAILS[0]);
    }

    let savedAdminEmail = localStorage.getItem('kantong_admin_email');
    let savedCustomerEmail = localStorage.getItem('kantong_customer_email');

    function parseJwt(token) {
        try {
            const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
                '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            return null;
        }
    }

    function updateMenuUI() {
        if (savedAdminEmail && ADMIN_EMAILS.includes(savedAdminEmail)) {
            if (drawerAdminBtn) drawerAdminBtn.style.display = 'block';
            if (customerGoogleSignInDiv) customerGoogleSignInDiv.parentElement.style.display = 'none';
            if (drawerCustomerLogoutBtn) {
                drawerCustomerLogoutBtn.style.display = 'block';
                drawerCustomerLogoutBtn.textContent = `Admin: ${savedAdminEmail.split('@')[0]} (Keluar)`;
            }
        } else if (savedCustomerEmail) {
            if (drawerAdminBtn) drawerAdminBtn.style.display = 'none';
            if (customerGoogleSignInDiv) customerGoogleSignInDiv.parentElement.style.display = 'none';
            if (drawerCustomerLogoutBtn) {
                drawerCustomerLogoutBtn.style.display = 'block';
                drawerCustomerLogoutBtn.textContent = `Akun: ${savedCustomerEmail.split('@')[0]} (Keluar)`;
            }
        } else {
            if (drawerAdminBtn) drawerAdminBtn.style.display = 'none';
            if (drawerCustomerLogoutBtn) drawerCustomerLogoutBtn.style.display = 'none';
            if (customerGoogleSignInDiv) customerGoogleSignInDiv.parentElement.style.display = 'block';
        }
    }
    updateMenuUI();

    if (drawerCustomerLogoutBtn) {
        drawerCustomerLogoutBtn.addEventListener('click', () => {
            if (confirm('Apakah Anda ingin keluar dari sesi ini?')) {
                localStorage.removeItem('kantong_admin_email');
                localStorage.removeItem('kantong_customer_email');
                location.reload();
            }
        });
    }

    // Google One Tap / Auto-Login
    window.addEventListener('load', () => {
        if (!savedAdminEmail && !savedCustomerEmail && window.google && google.accounts && google.accounts.id) {
            const googleClientId = CFG.google_client_id
                || '153262298610-rrhi1e6mlqlg553vri7ig7k9po2buulm.apps.googleusercontent.com';

            google.accounts.id.initialize({
                client_id: googleClientId,
                callback: (response) => {
                    const payload = parseJwt(response.credential);
                    if (payload && payload.email) {
                        const userEmail = payload.email;
                        if (ADMIN_EMAILS.includes(userEmail)) {
                            localStorage.setItem('kantong_admin_email', userEmail);
                            savedAdminEmail = userEmail;
                        } else {
                            localStorage.setItem('kantong_customer_email', userEmail);
                            savedCustomerEmail = userEmail;
                        }
                        updateMenuUI();
                    }
                },
                auto_select: true,
                cancel_on_tap_outside: true
            });

            google.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    if (customerGoogleSignInDiv && customerGoogleSignInDiv.innerHTML.trim() === '') {
                        google.accounts.id.renderButton(customerGoogleSignInDiv,
                            { theme: 'outline', size: 'large', width: '240px', text: 'signin_with' });
                    }
                }
            });
        }
    });

    // Tombol Admin: buka Dashboard Admin
    if (drawerAdminBtn) {
        drawerAdminBtn.addEventListener('click', () => {
            if (drawer) drawer.style.display = 'none';
            fetch('components/admin-dashboard.html')
                .then(res => {
                    if (!res.ok) throw new Error('File komponen admin tidak ditemukan: components/admin-dashboard.html');
                    return res.text();
                })
                .then(html => { if (container) injectHTML(container, html); })
                .catch(err => alert('Info: ' + err.message));
        });
    }
}

// ------------------------------------------------------------
// Mulai (module script berjalan setelah HTML selesai dibaca)
// ------------------------------------------------------------
applyConfig();
renderHero();
renderBrandSlot();
initMenuAndAuth();
initSupabaseDataBridge();
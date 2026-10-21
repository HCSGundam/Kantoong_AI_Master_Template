
/* ============================================================
   KANTOONG AI
   File: js/engine.js
   Core Engine · Storefront · Supabase · AI Events · Menu
   Dashboard Bento · Auth · Dynamic Components
   ============================================================ */

import { supabase } from './supabase-client.js';

// Ubah menjadi false sebelum template digunakan di produksi.
const DEV_AUTO_ADMIN = true;

const CFG = typeof KantoongConfig !== 'undefined'
    ? KantoongConfig
    : {};

// ============================================================
// 1. GLOBAL STATE
// ============================================================

export const KantoongState = {
    products: [],
    featured: [],
    matched: null,
    cart: [],
    isLoading: false,
    usingDemo: false,
    activeTenant: CFG.business_id || 'yanti-gold-default',
    agentStatus: 'ready'
};

const S = KantoongState;

// ============================================================
// 2. HELPERS
// ============================================================

const $ = (selector, root = document) =>
    root.querySelector(selector);

const emit = (name, detail = {}) => {
    window.dispatchEvent(new CustomEvent(name, { detail }));
};

const esc = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);

const rupiah = (value) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(Number(value) || 0);

const store = {
    get(key, fallback) {
        try {
            return JSON.parse(localStorage.getItem(key)) ?? fallback;
        } catch {
            return fallback;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // Penyimpanan bisa penuh atau dinonaktifkan browser.
        }
    }
};

// Memasukkan HTML komponen dan menjalankan script di dalamnya.
function injectHTML(element, html) {
    if (!element) return;

    element.innerHTML = html;

    element.querySelectorAll('script').forEach((oldScript) => {
        const script = document.createElement('script');

        [...oldScript.attributes].forEach((attribute) => {
            script.setAttribute(attribute.name, attribute.value);
        });

        script.textContent = oldScript.textContent;
        oldScript.replaceWith(script);
    });
}

// ============================================================
// 3. DRAWER HELPERS
// Konsisten dengan atribut hidden di index.html.
// ============================================================

function openDrawer() {
    const drawer = $('#sampleDrawer');
    const menuButton = $('#showcaseMenuBtn');

    if (!drawer) return;

    drawer.hidden = false;
    drawer.style.display = 'flex';
    drawer.setAttribute('aria-hidden', 'false');

    if (menuButton) {
        menuButton.setAttribute('aria-expanded', 'true');
    }
}

function closeDrawer() {
    const drawer = $('#sampleDrawer');
    const menuButton = $('#showcaseMenuBtn');

    if (drawer) {
        drawer.hidden = true;
        drawer.style.display = '';
        drawer.setAttribute('aria-hidden', 'true');
    }

    if (menuButton) {
        menuButton.setAttribute('aria-expanded', 'false');
    }
}

// ============================================================
// 4. DASHBOARD BENTO BRIDGE
// Hamburger membuka dashboard Bento.
// Dashboard ditampilkan sebagai pengganti storefront.
// ============================================================

let dashboardLoadPromise = null;
let dashboardInitialized = false;

async function openKantoongBentoDashboard() {
    const host = $('#kantoongDashboardHost');
    const page = $('#pageScroll');

    if (!host || !page) {
        console.warn(
            '[Kantoong Dashboard] Host dashboard atau pageScroll tidak ditemukan.'
        );
        openDrawer();
        return;
    }

    closeDrawer();

    try {
        if (!dashboardLoadPromise) {
            dashboardLoadPromise = fetch('menu/dashboard/dashboard.html')
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(
                            'Gagal memuat menu/dashboard/dashboard.html'
                        );
                    }

                    return response.text();
                })
                .then((html) => {
                    host.innerHTML = html;
                    return true;
                })
                .catch((error) => {
                    dashboardLoadPromise = null;
                    throw error;
                });
        }

        await dashboardLoadPromise;

        if (
            !dashboardInitialized &&
            window.KantoongDashboard &&
            typeof window.KantoongDashboard.init === 'function'
        ) {
            window.KantoongDashboard.init();
            dashboardInitialized = true;
        }

        host.hidden = false;
        page.hidden = true;

        host.setAttribute('aria-hidden', 'false');
        page.setAttribute('aria-hidden', 'true');

        emit('kantoong:dashboard-loaded');
        emit('kantoong:dashboard-visibility', { visible: true });
    } catch (error) {
        console.error('[Kantoong Dashboard]', error);

        host.hidden = true;
        page.hidden = false;

        openDrawer();

        alert(
            'Dashboard Bento belum bisa dibuka. Periksa file ' +
            'menu/dashboard/dashboard.html dan dashboard.js.'
        );
    }
}

function closeKantoongBentoDashboard() {
    const host = $('#kantoongDashboardHost');
    const page = $('#pageScroll');

    if (host) {
        host.hidden = true;
        host.setAttribute('aria-hidden', 'true');
    }

    if (page) {
        page.hidden = false;
        page.setAttribute('aria-hidden', 'false');
    }

    emit('kantoong:dashboard-visibility', { visible: false });
}

// Fungsi global untuk modul dashboard atau modul lain.
window.openKantoongBentoDashboard = openKantoongBentoDashboard;
window.closeKantoongBentoDashboard = closeKantoongBentoDashboard;
window.KantoongBentoIntegrated = true;

// ============================================================
// 5. APPLY CONFIG
// ============================================================

function applyConfig() {
    if (CFG.app_name) {
        document.title = CFG.app_name;

        const pageTitle = $('#pageTitle');
        const brandTitle = $('#brandTitle');

        if (pageTitle) pageTitle.textContent = CFG.app_name;
        if (brandTitle) brandTitle.textContent = CFG.app_name;
    }

    if (CFG.theme_color_primary) {
        document.documentElement.style.setProperty(
            '--primary-color',
            CFG.theme_color_primary
        );
    }

    const peekTitle = $('#peekTitle');
    const peekGreeting = $('#peekGreeting');

    if (peekTitle && CFG.ai_title) {
        peekTitle.textContent = CFG.ai_title;
    }

    if (peekGreeting && CFG.ai_greetings?.length) {
        const index = Math.floor(
            Math.random() * CFG.ai_greetings.length
        );

        peekGreeting.textContent = CFG.ai_greetings[index];
    }
}

// ============================================================
// 6. HERO SLIDER
// ============================================================

function slideMedia(slide) {
    if (slide.type === 'video' && slide.src) {
        return `
            <video
                src="${esc(slide.src)}"
                muted
                loop
                playsinline
                autoplay
                preload="metadata"
            ></video>
        `;
    }

    if (slide.type === 'image' && slide.src) {
        return `
            <img
                src="${esc(slide.src)}"
                alt="${esc(slide.title)}"
                loading="lazy"
            >
        `;
    }

    return `
        <span class="hero-media-label">
            ${esc(slide.media_label || 'Foto / video brand')}
        </span>
    `;
}

function renderHero() {
    const section = $('#heroSection');
    const track = $('#heroTrack');
    const dotsBox = $('#heroDots');
    const slides = CFG.hero?.slides || [];

    if (!section || !track) return;

    if (!slides.length) {
        section.hidden = true;
        return;
    }

    section.hidden = false;

    track.innerHTML = slides.map((slide, index) => `
        <article class="hero-slide${index === 0 ? ' is-active' : ''}">
            <div class="hero-media">
                ${slideMedia(slide)}
            </div>

            <p class="hero-eyebrow">${esc(slide.caption)}</p>
            <h2 class="hero-title">${esc(slide.title)}</h2>
            <p class="hero-text">${esc(slide.text)}</p>

            <div class="hero-cta">
                <button
                    class="btn-primary"
                    type="button"
                    data-action="scroll-featured"
                >
                    Lihat produk →
                </button>

                <button
                    class="btn-outline"
                    type="button"
                    data-action="consult"
                    data-prompt="${esc(slide.ai_prompt || '')}"
                >
                    ✦ Konsultasi AI
                </button>
            </div>
        </article>
    `).join('');

    if (!dotsBox) return;

    const count = slides.length;

    if (count < 2) {
        dotsBox.innerHTML = '';
        return;
    }

    dotsBox.innerHTML = slides.map((_, index) => `
        <span class="dot${index === 0 ? ' active' : ''}"></span>
    `).join('');

    const dots = [...dotsBox.children];
    const items = [...track.children];
    let current = 0;
    let ticking = false;

    function setActive(index) {
        current = index;

        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });

        items.forEach((item, i) => {
            item.classList.toggle('is-active', i === index);
        });
    }

    function goTo(index) {
        track.scrollTo({
            left: ((index + count) % count) * track.clientWidth,
            behavior: 'smooth'
        });
    }

    track.addEventListener('scroll', () => {
        if (ticking) return;

        ticking = true;

        requestAnimationFrame(() => {
            if (track.clientWidth > 0) {
                const index = Math.round(
                    track.scrollLeft / track.clientWidth
                );

                if (
                    index !== current &&
                    index >= 0 &&
                    index < count
                ) {
                    setActive(index);
                }
            }

            ticking = false;
        });
    }, { passive: true });

    const seconds = Number(CFG.hero?.interval_seconds) || 0;

    if (
        !seconds ||
        matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
        return;
    }

    let paused = false;
    let timer = setInterval(tick, seconds * 1000);

    function tick() {
        if (!paused && !document.hidden) {
            goTo(current + 1);
        }
    }

    function restart() {
        clearInterval(timer);
        timer = setInterval(tick, seconds * 1000);
    }

    track.addEventListener('pointerdown', () => {
        paused = true;
    });

    ['pointerup', 'pointercancel', 'pointerleave'].forEach((eventName) => {
        track.addEventListener(eventName, () => {
            paused = false;
            restart();
        });
    });
}

// ============================================================
// 7. BRAND SLOT
// ============================================================

function renderBrandSlot() {
    const box = $('#brandSlot');
    const config = CFG.brand_slot || {};

    if (!box) return;

    box.innerHTML = '';

    if (config.type === 'highlights' && config.items?.length) {
        box.innerHTML = `
            <div class="brand-highlights">
                ${config.items.map((item) => `
                    <div class="brand-highlight">
                        <strong>${esc(item.title)}</strong>
                        <span>${esc(item.sub)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (config.type === 'text' && config.text) {
        box.innerHTML = `
            <div class="brand-slot-box">
                ${esc(config.text).replace(/\n/g, '<br>')}
            </div>
        `;
    }
}

// ============================================================
// 8. PRODUCT CARDS
// ============================================================

function productCard(product, index = 0) {
    const initial = esc(
        (product.name || '?').trim().charAt(0).toUpperCase()
    );

    const thumbnail = product.image_url
        ? `
            <img
                src="${esc(product.image_url)}"
                alt="${esc(product.name)}"
                loading="lazy"
            >
        `
        : initial;

    return `
        <article
            class="product-card"
            style="--i:${index}"
            data-id="${esc(product.id)}"
        >
            <div class="product-thumb">
                ${thumbnail}
            </div>

            <h3 class="product-name">
                ${esc(product.name)}
            </h3>

            <p class="product-price">
                ${rupiah(product.price)}
            </p>

            <div class="product-actions">
                <button
                    class="product-ask"
                    type="button"
                    data-action="ask-product"
                    data-id="${esc(product.id)}"
                >
                    ${esc(
                        CFG.featured?.ask_label ||
                        'Tanyakan produk ini'
                    )}
                </button>

                <button
                    class="product-cart"
                    type="button"
                    data-action="add-cart"
                    data-id="${esc(product.id)}"
                    aria-label="Tambah ke keranjang"
                >
                    +
                </button>
            </div>
        </article>
    `;
}

function renderSkeleton() {
    const rail = $('#featuredRail');
    if (!rail) return;

    rail.innerHTML = Array.from({ length: 3 }, () => `
        <article class="product-card is-loading">
            <div class="product-thumb"></div>
            <h3 class="product-name">&nbsp;</h3>
            <p class="product-price">Rp 000.000</p>

            <div class="product-actions">
                <button class="product-ask" disabled>&nbsp;</button>
                <button class="product-cart" disabled></button>
            </div>
        </article>
    `).join('');
}

function renderFeatured() {
    const rail = $('#featuredRail');
    const title = $('#featuredTitle');
    const resetButton = $('#resetCatalogBtn');

    if (!rail) return;

    const list = S.matched || S.featured;

    const newTitle = S.matched
        ? (CFG.featured?.matched_title || 'Pilihan AI untuk kamu')
        : (CFG.featured?.title || 'Produk Unggulan');

    if (title && title.textContent !== newTitle) {
        title.textContent = newTitle;
        title.classList.remove('title-swap');
        void title.offsetWidth;
        title.classList.add('title-swap');
    }

    if (resetButton) {
        resetButton.hidden = !S.matched;
    }

    rail.innerHTML = list.length
        ? list.map(productCard).join('')
        : `
            <p class="empty-state">
                Belum ada produk. Tambahkan lewat dashboard admin.
            </p>
        `;

    rail.scrollTo({ left: 0 });

    rail.classList.remove('rail-flash');

    if (S.matched) {
        void rail.offsetWidth;
        rail.classList.add('rail-flash');
    }
}

// ============================================================
// 9. PRODUCT CATEGORIES
// ============================================================

function renderCategories() {
    const section = $('#categorySection');
    const box = $('#categoryList');

    if (!section || !box) return;

    if (CFG.categories?.enabled === false) {
        section.hidden = true;
        return;
    }

    const groups = {};

    S.products.forEach((product) => {
        const category = String(product.category || '').trim();

        if (category) {
            (groups[category] ||= []).push(product);
        }
    });

    const names = Object.keys(groups);

    section.hidden = names.length === 0;

    box.innerHTML = names.length
        ? `
            <div class="section-head">
                <h2>${esc(
                    CFG.categories?.title || 'Kategori lain'
                )}</h2>
            </div>
        ` + names.map((name) => `
            <div class="category-block">
                <h3 class="category-title">${esc(name)}</h3>

                <div class="rail scroll-x">
                    ${groups[name].map(productCard).join('')}
                </div>
            </div>
        `).join('')
        : '';
}

// ============================================================
// 10. SCROLL TO FEATURED
// ============================================================

function scrollToFeatured() {
    const page = $('#pageScroll');
    const section = $('#featuredSection');
    const header = $('.app-header');

    if (!page || !section) return;

    const y =
        section.getBoundingClientRect().top -
        page.getBoundingClientRect().top +
        page.scrollTop;

    page.scrollTo({
        top: Math.max(
            0,
            y - (header?.offsetHeight || 72) - 16
        ),
        behavior: 'smooth'
    });
}

// ============================================================
// 11. SUPABASE DATA BRIDGE
// ============================================================

async function initSupabaseDataBridge() {
    console.info(
        '[Kantoong Engine] Menghubungkan etalase ke Supabase Cloud...'
    );

    S.isLoading = true;
    renderSkeleton();

    let rows = [];

    try {
        const { data, error } = await supabase
            .from('products')
            .select('*');

        if (error) throw error;

        rows = data || [];
    } catch (error) {
        console.warn(
            '[Supabase] Gagal mengambil produk. ' +
            'Data contoh akan digunakan jika diizinkan:',
            error.message
        );
    }

    rows = rows.filter((product) => {
        return product.is_published !== false;
    });

    if (CFG.filter_by_business_id) {
        rows = rows.filter((product) => {
            return product.business_id === CFG.business_id;
        });
    }

    // Produk terlaris lebih dahulu, lalu yang terbaru.
    rows.sort((a, b) =>
        (Number(b.sales_count) || 0) -
        (Number(a.sales_count) || 0) ||
        String(b.created_at || '').localeCompare(
            String(a.created_at || '')
        )
    );

    S.usingDemo = false;

    if (
        !rows.length &&
        CFG.use_demo_when_empty !== false
    ) {
        rows = (CFG.demo_products || []).slice();
        S.usingDemo = true;
    }

    S.products = rows;
    S.featured = rows.slice(
        0,
        Number(CFG.featured?.limit) || 8
    );

    S.isLoading = false;

    renderFeatured();
    renderCategories();

    console.info(
        `[Kantoong Core] ${rows.length} produk siap` +
        `${S.usingDemo ? ' (data contoh)' : ''}.`
    );

    emit('supabase-data-ready', S.products);
    emit('kantoong-ai-ready', S);
}

// ============================================================
// 12. AI PRODUCT MATCHING EVENTS
// ============================================================

window.addEventListener('kantoong:matched', (event) => {
    const ids = (event.detail?.ids || []).map(String);

    const list = ids
        .map((id) => {
            return S.products.find(
                (product) => String(product.id) === id
            );
        })
        .filter(Boolean);

    if (!list.length) return;

    S.matched = list;

    renderFeatured();
    scrollToFeatured();
});

window.addEventListener(
    'kantoong:show-catalog',
    scrollToFeatured
);

// ============================================================
// 13. CART EVENT BRIDGE
// Detail keranjang ditangani oleh cart/cart.js.
// ============================================================

function addToCart(id) {
    const product = S.products.find(
        (item) => String(item.id) === String(id)
    );

    if (!product) return;

    emit('kantoong:cart-add', {
        product,
        qty: 1
    });
}

// ============================================================
// 14. DELEGATED ACTIONS
// ============================================================

document.addEventListener('click', (event) => {
    const element = event.target.closest('[data-action]');
    if (!element) return;

    const { action, id, prompt } = element.dataset;

    if (action === 'scroll-featured') {
        scrollToFeatured();
        return;
    }

    if (action === 'consult') {
        emit('kantoong:consult', {
            text: prompt || ''
        });
        return;
    }

    if (action === 'ask-product') {
        const product = S.products.find(
            (item) => String(item.id) === String(id)
        );

        if (product) {
            emit('kantoong:consult', {
                text: `Ceritakan tentang ${product.name}`,
                productId: product.id
            });
        }

        return;
    }

    if (action === 'add-cart') {
        addToCart(id);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    $('#btnSearch')?.addEventListener('click', () => {
        emit('kantoong:consult', { text: '' });
    });

    $('#resetCatalogBtn')?.addEventListener('click', () => {
        S.matched = null;
        renderFeatured();
        emit('kantoong:catalog-reset');
    });
});

// ============================================================
// 15. MENU, DRAWER, AND DYNAMIC COMPONENTS
// ============================================================

function initMenuAndAuth() {
    const menuButton = $('#showcaseMenuBtn');
    const drawer = $('#sampleDrawer');
    const closeButton = $('#closeDrawer');
    const container = $('#dynamicComponentContainer');

    // Hamburger: buka dashboard Bento.
    // Jika host dashboard tidak tersedia, fungsi akan fallback
    // ke drawer menu.
    menuButton?.addEventListener('click', () => {
        if (window.KantoongBentoIntegrated) {
            openKantoongBentoDashboard();
        } else {
            openDrawer();
        }
    });

    closeButton?.addEventListener('click', closeDrawer);

    // Tutup dashboard melalui tombol yang ditandai di HTML.
    document.addEventListener('click', (event) => {
        const closeDashboard = event.target.closest(
            '[data-kd-close-dashboard]'
        );

        if (closeDashboard) {
            closeKantoongBentoDashboard();
        }
    });

    // Tombol katalog: tutup drawer, tampilkan storefront.
    $('#btnOpenCatalog')?.addEventListener('click', () => {
        closeDrawer();
        closeKantoongBentoDashboard();
        scrollToFeatured();
    });

    // Komponen modular dengan atribut data-component.
    document
        .querySelectorAll('.sample-item-btn[data-component]')
        .forEach((button) => {
            button.addEventListener('click', async () => {
                const componentFile = button.getAttribute(
                    'data-component'
                );

                if (!componentFile) return;

                closeDrawer();

                try {
                    const response = await fetch(
                        `components/${componentFile}`
                    );

                    if (!response.ok) {
                        throw new Error(
                            `Gagal memuat components/${componentFile}`
                        );
                    }

                    const html = await response.text();

                    if (!container) return;

                    injectHTML(container, html);

                    const closeComponentButton =
                        container.querySelector('#closeGoldModal') ||
                        container.querySelector('.gp-close');

                    if (closeComponentButton) {
                        closeComponentButton.addEventListener(
                            'click',
                            () => {
                                container.innerHTML = '';
                            }
                        );
                    }
                } catch (error) {
                    console.error(
                        '[Kantoong Component]',
                        error
                    );

                    alert(`Info: ${error.message}`);
                }
            });
        });

    // ========================================================
    // 16. ADMIN AND CUSTOMER AUTH UI
    // ========================================================

    const ADMIN_EMAILS = [
        'micken.jobmail@gmail.com'
    ];

    const adminButton = $('#drawerAdminBtn');
    const googleSignInDiv = $('#customerGoogleSignInDiv');
    const customerLogoutButton = $('#drawerCustomerLogoutBtn');

    // Mode testing: otomatis dianggap admin.
    if (
        DEV_AUTO_ADMIN &&
        !localStorage.getItem('kantong_admin_email')
    ) {
        localStorage.setItem(
            'kantong_admin_email',
            ADMIN_EMAILS[0]
        );
    }

    let savedAdminEmail = localStorage.getItem(
        'kantong_admin_email'
    );

    let savedCustomerEmail = localStorage.getItem(
        'kantong_customer_email'
    );

    function parseJwt(token) {
        try {
            const base64 = token
                .split('.')[1]
                .replace(/-/g, '+')
                .replace(/_/g, '/');

            const jsonPayload = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map((character) => {
                        return '%' +
                            ('00' +
                            character.charCodeAt(0).toString(16))
                            .slice(-2);
                    })
                    .join('')
            );

            return JSON.parse(jsonPayload);
        } catch {
            return null;
        }
    }

    function updateMenuUI() {
        const isAdmin = Boolean(
            savedAdminEmail &&
            ADMIN_EMAILS.includes(savedAdminEmail)
        );

        const isCustomer = Boolean(
            !isAdmin && savedCustomerEmail
        );

        if (adminButton) {
            adminButton.hidden = !isAdmin;
            adminButton.style.display = isAdmin ? 'block' : 'none';
        }

        if (customerLogoutButton) {
            customerLogoutButton.hidden = !(isAdmin || isCustomer);
            customerLogoutButton.style.display =
                isAdmin || isCustomer ? 'block' : 'none';

            if (isAdmin) {
                customerLogoutButton.textContent =
                    `Admin: ${savedAdminEmail.split('@')[0]} (Keluar)`;
            } else if (isCustomer) {
                customerLogoutButton.textContent =
                    `Akun: ${savedCustomerEmail.split('@')[0]} (Keluar)`;
            }
        }

        // Tombol Google berada di dalam #customerAuthContainer.
        const googleContainer = googleSignInDiv?.parentElement;

        if (googleContainer) {
            googleContainer.style.display =
                isAdmin || isCustomer ? 'none' : 'block';
        }
    }

    updateMenuUI();

    customerLogoutButton?.addEventListener('click', () => {
        if (!confirm('Apakah Anda ingin keluar dari sesi ini?')) {
            return;
        }

        localStorage.removeItem('kantong_admin_email');
        localStorage.removeItem('kantong_customer_email');

        location.reload();
    });

    // ========================================================
    // 17. GOOGLE ONE TAP / AUTO-LOGIN
    // ========================================================

    window.addEventListener('load', () => {
        if (
            savedAdminEmail ||
            savedCustomerEmail ||
            !window.google?.accounts?.id
        ) {
            return;
        }

        const googleClientId =
            CFG.google_client_id ||
            '153262298610-rrhi1e6mlqlg553vri7ig7k9po2buulm.apps.googleusercontent.com';

        google.accounts.id.initialize({
            client_id: googleClientId,

            callback: (response) => {
                const payload = parseJwt(response.credential);
                if (!payload?.email) return;

                const userEmail = payload.email;

                if (ADMIN_EMAILS.includes(userEmail)) {
                    localStorage.setItem(
                        'kantong_admin_email',
                        userEmail
                    );

                    savedAdminEmail = userEmail;
                } else {
                    localStorage.setItem(
                        'kantong_customer_email',
                        userEmail
                    );

                    savedCustomerEmail = userEmail;
                }

                updateMenuUI();
            },

            auto_select: true,
            cancel_on_tap_outside: true
        });

        google.accounts.id.prompt((notification) => {
            const shouldRenderButton =
                notification.isNotDisplayed() ||
                notification.isSkippedMoment();

            if (
                shouldRenderButton &&
                googleSignInDiv &&
                googleSignInDiv.innerHTML.trim() === ''
            ) {
                google.accounts.id.renderButton(
                    googleSignInDiv,
                    {
                        theme: 'outline',
                        size: 'large',
                        width: '240px',
                        text: 'signin_with'
                    }
                );
            }
        });
    });

    // ========================================================
    // 18. ADMIN DASHBOARD COMPONENT
    // Mempertahankan komponen admin lama.
    // ========================================================

    adminButton?.addEventListener('click', async () => {
        closeDrawer();

        try {
            const response = await fetch(
                'components/admin-dashboard.html'
            );

            if (!response.ok) {
                throw new Error(
                    'File components/admin-dashboard.html tidak ditemukan.'
                );
            }

            const html = await response.text();

            if (container) {
                injectHTML(container, html);
            }
        } catch (error) {
            console.error('[Kantoong Admin]', error);
            alert(`Info: ${error.message}`);
        }
    });
}

// ============================================================
// 19. INITIALIZATION
// ============================================================

// Pulihkan data keranjang lokal agar state inti tetap tersedia.
S.cart = store.get('kantoong:cart', []);

applyConfig();
renderHero();
renderBrandSlot();
initMenuAndAuth();
initSupabaseDataBridge();

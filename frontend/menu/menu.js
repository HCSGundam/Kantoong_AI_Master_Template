/**
 * KANTOONG CORE — Customer Bento Dashboard
 * File: frontend/menu/menu.js
 *
 * Redesain dashboard pelanggan:
 * - Bento grid dengan ukuran kartu small / wide / tall / large.
 * - Ringkasan fitur langsung terlihat pada kartu.
 * - Toggle tema inline, mini chart, kalender, order progress, dan status paket.
 * - Tetap mempertahankan event integrasi menu lama.
 *
 * PENTING:
 * Data ringkasan yang belum tersambung ke backend ditandai sebagai DEMO.
 * Ganti sumber data demo dengan data Supabase/API sebelum digunakan produksi.
 */
(() => {
    'use strict';

    const MODULE = '[KANTOONG Menu]';
    const STORAGE_THEME = 'kantoong:customer-theme';
    const $ = (selector, root = document) => root.querySelector(selector);
    const emit = (name, detail = {}) =>
        window.dispatchEvent(new CustomEvent(name, { detail }));

    const escapeHTML = (value) =>
        String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);

    const ICONS = {
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        package: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v9l9 5 9-5V8"/><path d="M12 13v9"/>',
        map: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
        receipt: '<path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
        chart: '<path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/><path d="M2 21h21"/>',
        crown: '<path d="m2 8 5 4 5-8 5 8 5-4-2 12H4L2 8Z"/>',
        heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
        ticket: '<path d="M3 8V5h18v3a3 3 0 0 0 0 6v5H3v-5a3 3 0 0 0 0-6Z"/><path d="M13 8v2m0 4v2"/>',
        message: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/>',
        settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4L7.3 15a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 2Z"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
        close: '<path d="m18 6-12 12M6 6l12 12"/>',
        arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
        spark: '<path d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3Z"/>',
        bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
        pin: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/>',
        globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
        download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
        calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
        truck: '<path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z"/><circle cx="7.5" cy="18.5" r="1.5"/><circle cx="17.5" cy="18.5" r="1.5"/>'
    };

    function icon(name, size = 20) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.spark}</svg>`;
    }

    const FEATURES = [
        { id:'profile', title:'Profil & Akun', description:'Identitas, keamanan, dan akses akun.', icon:'user', group:'Akun', size:'small', action:'profile', kind:'profile' },
        { id:'addresses', title:'Alamat Pengiriman', description:'Alamat utama dan tujuan kirim.', icon:'map', group:'Akun', size:'small', action:'addresses', kind:'address' },
        { id:'tracking', title:'Lacak Paket', description:'Pantau perjalanan pesananmu.', icon:'truck', group:'Pesanan', size:'wide', action:'tracking', kind:'tracking' },
        { id:'orders', title:'Pesanan Saya', description:'Status dan detail pembelian.', icon:'package', group:'Pesanan', size:'wide', action:'orders', kind:'orders' },
        { id:'spending', title:'Total Belanja', description:'Ringkasan pengeluaranmu.', icon:'chart', group:'Analitik', size:'large', action:'spending', kind:'spending' },
        { id:'analytics', title:'Analitik Belanja', description:'Kategori produk yang paling sering dibeli.', icon:'crown', group:'Analitik', size:'tall', action:'analytics', kind:'analytics' },
        { id:'history', title:'Riwayat Transaksi', description:'Pembelian terbaru, harga, dan tanggal.', icon:'receipt', group:'Pesanan', size:'wide', action:'history', kind:'history' },
        { id:'calendar', title:'Kalender Aktivitas', description:'Promo dan aktivitas brand.', icon:'calendar', group:'Brand', size:'tall', action:'calendar', kind:'calendar' },
        { id:'catalog', title:'Katalog Produk Lengkap', description:'Produk, varian, dan harga.', icon:'package', group:'Belanja', size:'wide', action:'catalog', kind:'catalog' },
        { id:'wishlist', title:'Wishlist Saya', description:'Produk yang ingin kamu beli nanti.', icon:'heart', group:'Belanja', size:'normal', action:'wishlist', kind:'wishlist' },
        { id:'reviews', title:'Ulasan & Selfie', description:'Bagikan pengalaman dan dapatkan reward.', icon:'spark', group:'Brand', size:'normal', action:'reviews', kind:'reviews' },
        { id:'promos', title:'Voucher & Promo', description:'Penawaran, kode, dan hadiah brand.', icon:'ticket', group:'Brand', size:'normal', action:'promos', kind:'promos' },
        { id:'ai-history', title:'Riwayat Chat AI', description:'Percakapan sebelumnya tersimpan 30 hari.', icon:'message', group:'Bantuan', size:'normal', action:'ai-history', kind:'ai-history' },
        { id:'support', title:'Chat Customer Service', description:'Hubungi tim bantuan brand.', icon:'message', group:'Bantuan', size:'normal', action:'support', kind:'support' },
        { id:'settings', title:'Pengaturan Aplikasi', description:'Tema, bahasa, privasi, dan notifikasi.', icon:'settings', group:'Preferensi', size:'wide', action:'settings', kind:'settings' },
        { id:'export', title:'Export Data', description:'Unduh ringkasan belanja saat data tersedia.', icon:'download', group:'Analitik', size:'normal', action:'export', kind:'export' },
        { id:'store-map', title:'Lokasi Toko', description:'Temukan cabang terdekat.', icon:'pin', group:'Brand', size:'normal', action:'store-map', kind:'store-map' },
        { id:'member', title:'Poin & Member', description:'Poin loyalitas dan benefit member.', icon:'crown', group:'Brand', size:'normal', action:'member', kind:'member' }
    ];

    let initialized = false;
    let drawer = null;
    let searchInput = null;
    let promoIndex = 0;
    let previousFocus = null;
    let toastTimer = null;
    let calendarDate = new Date();
    let selectedTheme = 'light';

    function installStyles() {
        if ($('#kantoong-menu-runtime-styles')) return;
        const style = document.createElement('style');
        style.id = 'kantoong-menu-runtime-styles';
        style.textContent = `
            #sampleDrawer.kantoong-menu-drawer{display:none;position:fixed;inset:0;z-index:1000;width:100%;height:100%;max-height:100dvh;overflow:auto;box-sizing:border-box;flex-direction:column;align-items:stretch;gap:0;padding:0;margin:0;border:0;border-radius:0;background:var(--km-bg,#f6f5f1);color:var(--km-text,#17191b);font-family:inherit;text-align:left;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
            #sampleDrawer.kantoong-menu-drawer.is-open{display:flex;animation:km-enter .2s ease both}
            #sampleDrawer{--km-bg:#f6f5f1;--km-card:#fffefa;--km-soft:#f0eee7;--km-text:#17202a;--km-muted:#68717a;--km-line:#e5e1d8;--km-accent:#c49b50;--km-green:#267c67}
            #sampleDrawer.km-dark{--km-bg:#111315;--km-card:#1b1e20;--km-soft:#262a2c;--km-text:#f5f4ef;--km-muted:#adb3b6;--km-line:#34393b;--km-accent:#d8b56d;--km-green:#7dc8ae}
            #sampleDrawer *{box-sizing:border-box}
            #sampleDrawer button,#sampleDrawer input{font:inherit}
            #sampleDrawer button{touch-action:manipulation}
            #sampleDrawer .km-topbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:max(12px,env(safe-area-inset-top)) clamp(16px,3vw,34px) 12px;background:var(--km-bg);border-bottom:1px solid var(--km-line)}
            #sampleDrawer .km-brand{display:flex;align-items:center;gap:10px;min-width:0}
            #sampleDrawer .km-brand-mark{display:grid;place-items:center;width:40px;height:40px;flex:none;border-radius:14px;background:var(--km-text);color:var(--km-bg)}
            #sampleDrawer .km-brand-name{margin:0;font-size:16px;font-weight:850;letter-spacing:-.05em}
            #sampleDrawer .km-brand-sub{margin:3px 0 0;color:var(--km-muted);font-size:11px}
            #sampleDrawer .km-icon-btn{display:grid;place-items:center;width:42px;height:42px;flex:none;border:1px solid var(--km-line);border-radius:50%;background:var(--km-card);color:var(--km-text);cursor:pointer}
            #sampleDrawer .km-content{width:100%;max-width:1500px;margin:0 auto;padding:clamp(16px,2.5vw,34px) clamp(14px,2.6vw,38px) calc(40px + env(safe-area-inset-bottom))}
            #sampleDrawer .km-welcome{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin:4px 0 18px}
            #sampleDrawer .km-eyebrow{margin:0 0 7px;color:var(--km-muted);font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
            #sampleDrawer .km-title{margin:0;font-size:clamp(26px,4vw,42px);font-weight:850;line-height:1.04;letter-spacing:-.065em}
            #sampleDrawer .km-subtitle{max-width:540px;margin:8px 0 0;color:var(--km-muted);font-size:13px;line-height:1.55}
            #sampleDrawer .km-search{display:flex;align-items:center;gap:10px;min-height:47px;margin:18px 0;padding:0 14px;border:1px solid var(--km-line);border-radius:15px;background:var(--km-card);color:var(--km-muted)}
            #sampleDrawer .km-search input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:var(--km-text);font-size:13px}
            #sampleDrawer .km-promo{position:relative;display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:155px;margin-bottom:25px;padding:clamp(20px,3vw,32px);overflow:hidden;border-radius:24px;background:#172522;color:#fff;isolation:isolate}
            #sampleDrawer .km-promo:after{content:"";position:absolute;z-index:-1;width:230px;height:230px;right:-55px;top:-105px;border:1px solid #ffffff38;border-radius:50%;box-shadow:0 0 0 22px #ffffff0c,0 0 0 48px #ffffff08}
            #sampleDrawer .km-promo-copy{max-width:620px}
            #sampleDrawer .km-promo-kicker{margin:0 0 9px;color:#d7c59f;font-size:10px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}
            #sampleDrawer .km-promo-title{margin:0;font-size:clamp(22px,3vw,34px);line-height:1.12;letter-spacing:-.05em}
            #sampleDrawer .km-promo-text{margin:8px 0 0;color:#e0e5e0;font-size:12px;line-height:1.55}
            #sampleDrawer .km-promo-controls{display:flex;align-items:center;gap:8px;margin-top:15px}
            #sampleDrawer .km-promo-controls button{display:grid;place-items:center;width:31px;height:31px;border:1px solid #ffffff55;border-radius:50%;background:transparent;color:white;cursor:pointer}
            #sampleDrawer .km-promo-count{font-size:10px;color:#e1e1dc;font-variant-numeric:tabular-nums}
            #sampleDrawer .km-promo-symbol{display:grid;place-items:center;width:68px;height:68px;flex:none;border:1px solid #ffffff55;border-radius:22px;transform:rotate(7deg)}
            #sampleDrawer .km-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:26px 0 13px}
            #sampleDrawer .km-section-title{margin:0;font-size:17px;font-weight:850;letter-spacing:-.04em}
            #sampleDrawer .km-section-note{color:var(--km-muted);font-size:11px}
            #sampleDrawer .km-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-flow:dense;grid-auto-rows:minmax(82px,auto);gap:11px}
            #sampleDrawer .km-card{position:relative;display:flex;min-width:0;min-height:142px;flex-direction:column;align-items:stretch;gap:0;padding:15px;overflow:hidden;border:1px solid var(--km-line);border-radius:19px;background:var(--km-card);color:var(--km-text);text-align:left;cursor:pointer;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
            #sampleDrawer .km-card:hover{border-color:#b9ad91;box-shadow:0 10px 28px #0000000b;transform:translateY(-2px)}
            #sampleDrawer .km-card:active{transform:scale(.99)}
            #sampleDrawer .km-card:focus-visible,#sampleDrawer .km-icon-btn:focus-visible,#sampleDrawer .km-promo-controls button:focus-visible{outline:2px solid var(--km-accent);outline-offset:3px}
            #sampleDrawer .km-card.is-small{min-height:125px}
            #sampleDrawer .km-card.is-normal{min-height:155px}
            #sampleDrawer .km-card.is-wide{grid-column:span 2;min-height:180px}
            #sampleDrawer .km-card.is-tall{grid-row:span 2;min-height:300px}
            #sampleDrawer .km-card.is-large{grid-column:span 2;grid-row:span 2;min-height:300px}
            #sampleDrawer .km-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
            #sampleDrawer .km-card-icon{display:grid;place-items:center;width:37px;height:37px;flex:none;border:1px solid var(--km-line);border-radius:13px;background:var(--km-soft);color:var(--km-text)}
            #sampleDrawer .km-card-arrow{color:var(--km-muted);opacity:.8}
            #sampleDrawer .km-card-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:13px}
            #sampleDrawer .km-card-title{margin:0;font-size:13px;font-weight:850;letter-spacing:-.025em;line-height:1.3}
            #sampleDrawer .km-card-description{margin:5px 0 0;color:var(--km-muted);font-size:10.5px;line-height:1.5}
            #sampleDrawer .km-card-body{min-width:0;flex:1}
            #sampleDrawer .km-kpi{margin:10px 0 0;font-size:clamp(23px,3vw,34px);font-weight:850;line-height:1.05;letter-spacing:-.055em;font-variant-numeric:tabular-nums}
            #sampleDrawer .km-kpi-caption{margin:7px 0 0;color:var(--km-muted);font-size:10px;line-height:1.45}
            #sampleDrawer .km-pill{display:inline-flex;align-items:center;gap:5px;width:max-content;max-width:100%;padding:5px 8px;border-radius:999px;background:color-mix(in srgb,var(--km-green) 13%,transparent);color:var(--km-green);font-size:10px;font-weight:750}
            #sampleDrawer .km-chart{display:flex;align-items:flex-end;gap:clamp(5px,1vw,12px);height:72px;margin-top:15px;padding:0 2px 18px;border-bottom:1px solid var(--km-line)}
            #sampleDrawer .km-chart-bar{position:relative;flex:1;min-width:5px;height:var(--bar);border-radius:5px 5px 2px 2px;background:linear-gradient(180deg,#c8a45c,#e7d6b2)}
            #sampleDrawer .km-chart-bar.is-current{background:linear-gradient(180deg,#267c67,#83c4ae)}
            #sampleDrawer .km-chart-bar span{position:absolute;left:50%;bottom:-16px;transform:translateX(-50%);font-size:8px;color:var(--km-muted)}
            #sampleDrawer .km-chart-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:9px;color:var(--km-muted);font-size:10px}
            #sampleDrawer .km-donut-row{display:flex;align-items:center;gap:14px;margin-top:17px}
            #sampleDrawer .km-donut{display:grid;place-items:center;width:clamp(82px,8vw,112px);aspect-ratio:1;flex:none;border-radius:50%;background:conic-gradient(#c49b50 0 37%,#267c67 37% 62%,#8fa7b0 62% 81%,#d9d0bd 81% 100%);position:relative}
            #sampleDrawer .km-donut:after{content:"";position:absolute;inset:22%;border-radius:50%;background:var(--km-card)}
            #sampleDrawer .km-donut-label{position:relative;z-index:1;text-align:center;font-size:10px;font-weight:800}
            #sampleDrawer .km-legend{display:grid;gap:8px;flex:1;min-width:0}
            #sampleDrawer .km-legend-row{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:10px}
            #sampleDrawer .km-legend-name{display:flex;align-items:center;gap:6px;min-width:0;color:var(--km-muted)}
            #sampleDrawer .km-dot{width:7px;height:7px;flex:none;border-radius:50%;background:var(--dot,#c49b50)}
            #sampleDrawer .km-progress{display:flex;align-items:center;gap:0;margin-top:16px}
            #sampleDrawer .km-progress-step{position:relative;display:flex;flex:1;flex-direction:column;align-items:center;gap:7px;color:var(--km-muted);font-size:9px;text-align:center}
            #sampleDrawer .km-progress-step:not(:last-child):before{content:"";position:absolute;top:5px;left:50%;width:100%;height:2px;background:var(--km-line)}
            #sampleDrawer .km-progress-step.is-done:not(:last-child):before{background:var(--km-green)}
            #sampleDrawer .km-progress-dot{position:relative;z-index:1;width:11px;height:11px;border:2px solid var(--km-line);border-radius:50%;background:var(--km-card)}
            #sampleDrawer .km-progress-step.is-done .km-progress-dot{border-color:var(--km-green);background:var(--km-green)}
            #sampleDrawer .km-status-line{display:flex;align-items:flex-start;gap:10px;margin-top:13px;padding:10px;border-radius:12px;background:var(--km-soft)}
            #sampleDrawer .km-status-icon{display:grid;place-items:center;width:30px;height:30px;flex:none;border-radius:10px;background:var(--km-card)}
            #sampleDrawer .km-status-line strong{display:block;font-size:11px}
            #sampleDrawer .km-status-line small{display:block;margin-top:4px;color:var(--km-muted);font-size:10px;line-height:1.4}
            #sampleDrawer .km-mini-list{display:grid;gap:0;margin-top:10px}
            #sampleDrawer .km-list-row{display:flex;align-items:center;gap:9px;min-width:0;padding:9px 0;border-top:1px solid var(--km-line)}
            #sampleDrawer .km-list-thumb{display:grid;place-items:center;width:33px;height:33px;flex:none;border-radius:10px;background:var(--km-soft);color:var(--km-muted)}
            #sampleDrawer .km-list-main{min-width:0;flex:1}
            #sampleDrawer .km-list-main strong{display:block;overflow:hidden;font-size:10.5px;text-overflow:ellipsis;white-space:nowrap}
            #sampleDrawer .km-list-main small{display:block;margin-top:3px;color:var(--km-muted);font-size:9px}
            #sampleDrawer .km-list-price{font-size:10px;font-weight:800;white-space:nowrap}
            #sampleDrawer .km-calendar-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:16px}
            #sampleDrawer .km-calendar-head strong{font-size:11px}
            #sampleDrawer .km-calendar-nav{display:flex;gap:5px}
            #sampleDrawer .km-calendar-nav button{display:grid;place-items:center;width:27px;height:27px;border:1px solid var(--km-line);border-radius:9px;background:var(--km-card);color:var(--km-text);cursor:pointer}
            #sampleDrawer .km-calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px;margin-top:10px}
            #sampleDrawer .km-cal-dayname,#sampleDrawer .km-cal-day{display:grid;place-items:center;min-width:0;aspect-ratio:1;border-radius:8px;font-size:9px}
            #sampleDrawer .km-cal-dayname{color:var(--km-muted);font-size:8px}
            #sampleDrawer .km-cal-day{position:relative;color:var(--km-text)}
            #sampleDrawer .km-cal-day.is-muted{color:var(--km-muted);opacity:.45}
            #sampleDrawer .km-cal-day.is-today{background:var(--km-text);color:var(--km-bg);font-weight:800}
            #sampleDrawer .km-cal-day.has-event:after{content:"";position:absolute;bottom:3px;width:3px;height:3px;border-radius:50%;background:var(--km-accent)}
            #sampleDrawer .km-card-action{display:inline-flex;align-items:center;gap:7px;margin-top:12px;padding:8px 11px;border:1px solid var(--km-line);border-radius:999px;background:var(--km-card);color:var(--km-text);font-size:10px;font-weight:750}
            #sampleDrawer .km-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:13px;padding-top:11px;border-top:1px solid var(--km-line)}
            #sampleDrawer .km-toggle-label{font-size:11px;font-weight:750}
            #sampleDrawer .km-switch{position:relative;display:inline-flex;width:45px;height:26px;flex:none;padding:3px;border:0;border-radius:999px;background:#b8b9b7;cursor:pointer;transition:background .2s}
            #sampleDrawer .km-switch:before{content:"";display:block;width:20px;height:20px;border-radius:50%;background:white;box-shadow:0 1px 4px #0002;transition:transform .2s}
            #sampleDrawer .km-switch[aria-checked="true"]{background:var(--km-green)}
            #sampleDrawer .km-switch[aria-checked="true"]:before{transform:translateX(19px)}
            #sampleDrawer .km-account-slot{margin-top:22px;padding:15px;border:1px solid var(--km-line);border-radius:18px;background:var(--km-card)}
            #sampleDrawer .km-account-slot:empty{display:none}
            #sampleDrawer .km-account-slot .sample-item-btn{width:100%;box-sizing:border-box;margin:5px 0;padding:12px 14px;border-radius:12px;font:inherit;cursor:pointer}
            #sampleDrawer .km-empty{grid-column:1/-1;padding:28px 15px;border:1px dashed var(--km-line);border-radius:16px;color:var(--km-muted);font-size:13px;text-align:center}
            #sampleDrawer .km-footer{display:flex;justify-content:space-between;gap:10px;margin-top:25px;padding-top:16px;border-top:1px solid var(--km-line);color:var(--km-muted);font-size:10px;line-height:1.6}
            #sampleDrawer .km-footer button{display:flex;align-items:center;gap:6px;padding:0;border:0;background:none;color:var(--km-text);font:inherit;cursor:pointer}
            #sampleDrawer .km-hidden{display:none!important}
            #sampleDrawer .km-legacy-admin{display:block;width:100%;margin:0 0 10px}
            #sampleDrawer .km-toast{position:fixed;z-index:1200;left:50%;bottom:calc(22px + env(safe-area-inset-bottom));width:max-content;max-width:calc(100% - 36px);padding:12px 16px;border-radius:14px;background:var(--km-text);color:var(--km-bg);font-size:12px;line-height:1.5;box-shadow:0 12px 35px #0002;transform:translateX(-50%);animation:km-toast-in .2s ease both}
            #sampleDrawer .km-demo-note{display:inline-flex;align-items:center;gap:5px;margin-top:8px;color:var(--km-muted);font-size:9px}
            @keyframes km-enter{from{opacity:0}to{opacity:1}}
            @keyframes km-toast-in{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}
            @media(min-width:600px){#sampleDrawer .km-grid{grid-template-columns:repeat(6,minmax(0,1fr));gap:13px}#sampleDrawer .km-card.is-small{grid-column:span 2}#sampleDrawer .km-card.is-normal{grid-column:span 3}#sampleDrawer .km-card.is-wide{grid-column:span 6}#sampleDrawer .km-card.is-tall{grid-column:span 3;grid-row:span 2}#sampleDrawer .km-card.is-large{grid-column:span 4;grid-row:span 2}#sampleDrawer .km-promo{min-height:180px}}
            @media(min-width:900px){#sampleDrawer .km-grid{grid-template-columns:repeat(12,minmax(0,1fr));gap:14px}#sampleDrawer .km-card.is-small{grid-column:span 3;min-height:145px}#sampleDrawer .km-card.is-normal{grid-column:span 4;min-height:165px}#sampleDrawer .km-card.is-wide{grid-column:span 6;min-height:190px}#sampleDrawer .km-card.is-tall{grid-column:span 4;grid-row:span 2;min-height:340px}#sampleDrawer .km-card.is-large{grid-column:span 8;grid-row:span 2;min-height:340px}}
            @media(min-width:1350px){#sampleDrawer .km-card.is-small{grid-column:span 2}#sampleDrawer .km-card.is-normal{grid-column:span 3}#sampleDrawer .km-card.is-wide{grid-column:span 6}#sampleDrawer .km-card.is-tall{grid-column:span 3;grid-row:span 2}#sampleDrawer .km-card.is-large{grid-column:span 6;grid-row:span 2}}
            @media(max-width:420px){#sampleDrawer .km-grid{gap:8px}#sampleDrawer .km-card{padding:12px;border-radius:16px}#sampleDrawer .km-card.is-tall{min-height:280px}#sampleDrawer .km-card.is-large{min-height:285px}#sampleDrawer .km-promo{padding:19px;border-radius:19px}#sampleDrawer .km-promo-symbol{width:44px;height:44px}#sampleDrawer .km-kpi{font-size:24px}}
            @media(prefers-reduced-motion:reduce){#sampleDrawer *,#sampleDrawer *:before,#sampleDrawer *:after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.01ms!important}}
        `;
        document.head.appendChild(style);
    }

    function getPromos() {
        const configured = window.KantoongConfig?.customer_menu?.promos;
        if (Array.isArray(configured) && configured.length) {
            return configured.map((p) => ({
                eyebrow: p.eyebrow || 'KANTOONG HIGHLIGHT',
                title: p.title || 'Temukan pengalaman baru',
                description: p.description || 'Jelajahi layanan dari brand ini.',
                action: p.action || 'promos'
            }));
        }
        return [
            { eyebrow:'YOUR SHOPPING SPACE', title:'Semua aktivitas belanja, satu tempat.', description:'Pesanan, alamat, wishlist, dan preferensimu.', action:'orders' },
            { eyebrow:'YOUR PERSONAL INSIGHTS', title:'Kenali pola belanjamu.', description:'Lihat ringkasan aktivitas dan kebiasaan belanja.', action:'analytics' },
            { eyebrow:'YOUR MEMBER BENEFITS', title:'Jangan lewatkan benefit brand.', description:'Jelajahi promo, voucher, dan loyalty.', action:'promos' }
        ];
    }

    function renderSpending() {
        const bars = [
            ['Jan', 42], ['Feb', 58], ['Mar', 48], ['Apr', 68], ['Mei', 57], ['Jun', 88]
        ];
        return `<div class="km-card-body">
            <div class="km-card-heading"><h3 class="km-card-title">Total Belanja</h3><span class="km-pill">DEMO DATA</span></div>
            <div class="km-kpi">Rp 3.450.000</div>
            <p class="km-kpi-caption">Contoh ringkasan pengeluaran · data belum terhubung</p>
            <div class="km-chart" aria-label="Contoh grafik belanja 6 bulan">${bars.map(([m,v],i)=>`<div class="km-chart-bar${i===5?' is-current':''}" style="--bar:${v}%"><span>${m}</span></div>`).join('')}</div>
            <div class="km-chart-row"><span>Periode contoh: Jan–Jun</span><strong>Ringkasan bulanan</strong></div>
        </div>`;
    }

    function renderAnalytics() {
        return `<div class="km-card-body">
            <div class="km-card-heading"><h3 class="km-card-title">Analitik Belanja</h3>${icon('chart',18)}</div>
            <p class="km-card-description">Contoh komposisi kategori belanja.</p>
            <div class="km-donut-row"><div class="km-donut"><span class="km-donut-label">Kategori<br>DEMO</span></div>
            <div class="km-legend">
                <div class="km-legend-row"><span class="km-legend-name"><i class="km-dot" style="--dot:#c49b50"></i>Kopi</span><b>37%</b></div>
                <div class="km-legend-row"><span class="km-legend-name"><i class="km-dot" style="--dot:#267c67"></i>Makanan</span><b>25%</b></div>
                <div class="km-legend-row"><span class="km-legend-name"><i class="km-dot" style="--dot:#8fa7b0"></i>Dessert</span><b>19%</b></div>
                <div class="km-legend-row"><span class="km-legend-name"><i class="km-dot" style="--dot:#d9d0bd"></i>Lainnya</span><b>19%</b></div>
            </div></div><span class="km-demo-note">ⓘ Ilustrasi, bukan data akun</span>
        </div>`;
    }

    function renderTracking() {
        return `<div class="km-card-body">
            <div class="km-card-heading"><h3 class="km-card-title">Lacak Paket</h3><span class="km-pill">CONTOH</span></div>
            <p class="km-card-description">Status pengiriman terbaru ditampilkan di sini.</p>
            <div class="km-status-line"><span class="km-status-icon">${icon('truck',18)}</span><div><strong>Menunggu data kurir</strong><small>Hubungkan penyedia logistik untuk melihat transit, lokasi, dan estimasi tiba.</small></div></div>
            <div class="km-progress">
                <div class="km-progress-step is-done"><i class="km-progress-dot"></i><span>Pesanan</span></div>
                <div class="km-progress-step"><i class="km-progress-dot"></i><span>Diproses</span></div>
                <div class="km-progress-step"><i class="km-progress-dot"></i><span>Dikirim</span></div>
                <div class="km-progress-step"><i class="km-progress-dot"></i><span>Tiba</span></div>
            </div>
            <span class="km-demo-note">Status di atas adalah tampilan contoh</span>
        </div>`;
    }

    function renderOrders() {
        return `<div class="km-card-body">
            <div class="km-card-heading"><h3 class="km-card-title">Pesanan Saya</h3><span class="km-pill">RINGKASAN</span></div>
            <p class="km-card-description">Pantau tahap pesanan dari satu tempat.</p>
            <div class="km-progress">
                <div class="km-progress-step is-done"><i class="km-progress-dot"></i><span>Diproses</span></div>
                <div class="km-progress-step"><i class="km-progress-dot"></i><span>Dikirim</span></div>
                <div class="km-progress-step"><i class="km-progress-dot"></i><span>Diantar</span></div>
                <div class="km-progress-step"><i class="km-progress-dot"></i><span>Selesai</span></div>
            </div>
            <div class="km-status-line"><span class="km-status-icon">${icon('package',17)}</span><div><strong>Pesanan terbaru</strong><small>Detail nomor pesanan dan status muncul setelah integrasi data.</small></div></div>
            <span class="km-demo-note">ⓘ Belum terhubung ke data pesanan</span>
        </div>`;
    }

    function renderHistory() {
        const rows = [
            ['Pesanan terbaru','Tanggal dan cabang muncul setelah terhubung','—'],
            ['Transaksi sebelumnya','Detail produk dan harga','—']
        ];
        return `<div class="km-card-body">
            <div class="km-card-heading"><h3 class="km-card-title">Riwayat Transaksi</h3>${icon('receipt',18)}</div>
            <div class="km-mini-list">${rows.map(([title,sub,price])=>`<div class="km-list-row"><span class="km-list-thumb">${icon('receipt',16)}</span><span class="km-list-main"><strong>${title}</strong><small>${sub}</small></span><b class="km-list-price">${price}</b></div>`).join('')}</div>
            <span class="km-demo-note">Data transaksi akan tampil setelah integrasi</span>
        </div>`;
    }

        function renderCalendar() {
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();
        const monthName = calendarDate.toLocaleDateString('id-ID', { month:'long', year:'numeric' });
        const first = new Date(year, month, 1).getDay();
        const offset = (first + 6) % 7;
        const days = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        let cells = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(d=>`<span class="km-cal-dayname">${d}</span>`).join('');
        for (let i=0; i<offset; i++) cells += `<span class="km-cal-day is-muted"></span>`;
        for (let d=1; d<=days; d++) {
            const isToday = d===today.getDate() && month===today.getMonth() && year===today.getFullYear();
            cells += `<span class="km-cal-day${isToday?' is-today':''}${[5,12,21,25].includes(d)?' has-event':''}">${d}</span>`;
        }
        return `<div class="km-card-body">
            <div class="km-card-heading"><h3 class="km-card-title">Kalender Aktivitas</h3>${icon('calendar',18)}</div>
            <p class="km-card-description">Kalender interaktif; titik acara adalah contoh.</p>
            <div class="km-calendar-head"><strong>${escapeHTML(monthName)}</strong><span class="km-calendar-nav"><button type="button" data-calendar-prev aria-label="Bulan sebelumnya">‹</button><button type="button" data-calendar-next aria-label="Bulan berikutnya">›</button></span></div>
            <div class="km-calendar">${cells}</div>
            <div class="km-chart-row"><span><i class="km-dot" style="--dot:var(--km-accent);display:inline-block"></i> Contoh promo / aktivitas</span></div>
        </div>`;
    }

    function renderSettings() {
        return `<div class="km-card-body">
            <div class="km-card-heading"><h3 class="km-card-title">Pengaturan Aplikasi</h3>${icon('settings',18)}</div>
            <p class="km-card-description">Ubah tampilan tanpa membuka popup.</p>
            <div class="km-toggle-row"><span class="km-toggle-label">Mode gelap</span><button class="km-switch" type="button" role="switch" data-theme-toggle aria-label="Aktifkan mode gelap" aria-checked="${selectedTheme==='dark'}"></button></div>
            <div class="km-chart-row"><span data-theme-caption>${selectedTheme==='dark'?'Tema gelap aktif':'Tema terang aktif'}</span><span>langsung</span></div>
            <div class="km-toggle-row"><span class="km-toggle-label">Notifikasi</span><button class="km-switch" type="button" role="switch" data-notification-toggle aria-label="Aktifkan notifikasi" aria-checked="false"></button></div>
            <span class="km-demo-note">Tema tersimpan di perangkat ini</span>
        </div>`;
    }

    function renderProfile() {
        return `<div class="km-card-body"><div class="km-card-heading"><h3 class="km-card-title">Profil & Akun</h3>${icon('user',18)}</div><p class="km-card-description">Kelola identitas, keamanan, dan akses akun.</p><div class="km-status-line"><span class="km-status-icon">${icon('user',17)}</span><div><strong>Akun pelanggan</strong><small>Informasi profil mengikuti sesi login yang terhubung.</small></div></div></div>`;
    }

    function renderAddress() {
        return `<div class="km-card-body"><div class="km-card-heading"><h3 class="km-card-title">Alamat Pengiriman</h3>${icon('map',18)}</div><p class="km-card-description">Alamat utama dan tujuan kirim.</p><div class="km-status-line"><span class="km-status-icon">${icon('pin',17)}</span><div><strong>Alamat utama</strong><small>Alamat tersimpan muncul setelah integrasi data pelanggan.</small></div></div></div>`;
    }

    function renderCatalog() {
        return `<div class="km-card-body"><div class="km-card-heading"><h3 class="km-card-title">Katalog Produk Lengkap</h3>${icon('package',18)}</div><p class="km-card-description">Jelajahi produk, varian, dan harga dalam satu tempat.</p><div class="km-status-line"><span class="km-status-icon">${icon('package',17)}</span><div><strong>Katalog brand</strong><small>Buka katalog yang sudah ada melalui tombol di bawah.</small></div></div><span class="km-card-action">Lihat katalog ${icon('arrow',13)}</span></div>`;
    }

    function renderWishlist() {
        return `<div class="km-card-body"><div class="km-card-heading"><h3 class="km-card-title">Wishlist Saya</h3>${icon('heart',18)}</div><p class="km-card-description">Produk yang ingin kamu beli nanti.</p><div class="km-kpi">♡</div><p class="km-kpi-caption">Produk favoritmu akan tampil di sini setelah wishlist terhubung.</p></div>`;
    }

    function renderReviews() {
        return `<div class="km-card-body"><div class="km-card-heading"><h3 class="km-card-title">Ulasan & Selfie</h3>${icon('spark',18)}</div><p class="km-card-description">Bagikan pengalaman dan dapatkan reward.</p><div class="km-status-line"><span class="km-status-icon">${icon('spark',17)}</span><div><strong>Bagikan pengalamanmu</strong><small>Riwayat ulasan dan reward ditampilkan setelah integrasi.</small></div></div></div>`;
    }

    function renderPromos() {
        return `<div class="km-card-body"><div class="km-card-heading"><h3 class="km-card-title">Voucher & Promo</h3>${icon('ticket',18)}</div><p class="km-card-description">Penawaran, kode, dan hadiah brand.</p><div class="km-status-line"><span class="km-status-icon">${icon('ticket',17)}</span><div><strong>Promo tersedia</strong><small>Voucher aktif dan klaim hadiah akan ditampilkan dari data brand.</small></div></div></div>`;
    }

    function renderAIHistory() {
        return `<div class="km-card-body"><div class="km-card-heading"><h3 class="km-card-title">Riwayat Chat AI</h3>${icon('message',18)}</div><p class="km-card-description">Temukan percakapan sebelumnya.</p><div class="km-status-line"><span class="km-status-icon">${icon('spark',17)}</span><div><strong>Riwayat percakapan</strong><small>Target retensi 30 hari; perlu koneksi penyimpanan chat.</small></div></div></div>`;
    }

    function renderSupport() {
        return `<div class="km-card-body"><div class="km-card-heading"><h3 class="km-card-title">Chat Customer Service</h3>${icon('message',18)}</div><p class="km-card-description">Hubungi tim bantuan brand.</p><div class="km-status-line"><span class="km-status-icon">${icon('message',17)}</span><div><strong>Butuh bantuan?</strong><small>Modul chat layanan pelanggan akan dibuka melalui integrasi.</small></div></div></div>`;
    }

    function renderExport() {
        return `<div class="km-card-body"><div class="km-card-heading"><h3 class="km-card-title">Export Data</h3>${icon('download',18)}</div><p class="km-card-description">Unduh laporan belanja ke Excel atau PDF.</p><div class="km-status-line"><span class="km-status-icon">${icon('download',17)}</span><div><strong>Laporan pelanggan</strong><small>Ekspor aktif setelah data transaksi tersedia.</small></div></div></div>`;
    }

    function renderStoreMap() {
        return `<div class="km-card-body"><div class="km-card-heading"><h3 class="km-card-title">Lokasi Toko</h3>${icon('pin',18)}</div><p class="km-card-description">Temukan cabang terdekat.</p><div class="km-status-line"><span class="km-status-icon">${icon('globe',17)}</span><div><strong>Peta cabang</strong><small>Google Maps memerlukan lokasi cabang dan konfigurasi API.</small></div></div></div>`;
    }

    function renderMember() {
        return `<div class="km-card-body"><div class="km-card-heading"><h3 class="km-card-title">Poin & Member</h3>${icon('crown',18)}</div><p class="km-card-description">Poin loyalitas dan benefit member.</p><div class="km-kpi">★</div><p class="km-kpi-caption">Saldo poin akan tampil setelah sistem loyalty terhubung.</p></div>`;
    }

    const RENDERERS = {
        spending:renderSpending, analytics:renderAnalytics, tracking:renderTracking,
        orders:renderOrders, history:renderHistory, calendar:renderCalendar,
        settings:renderSettings, profile:renderProfile, address:renderAddress,
        catalog:renderCatalog, wishlist:renderWishlist, reviews:renderReviews,
        promos:renderPromos, 'ai-history':renderAIHistory, support:renderSupport,
        export:renderExport, 'store-map':renderStoreMap, member:renderMember
    };

    function cardMarkup(feature) {
        const size = ['small','normal','wide','tall','large'].includes(feature.size) ? feature.size : 'normal';
        const renderer = RENDERERS[feature.kind];
        const content = renderer ? renderer() : `<div class="km-card-body"><h3 class="km-card-title">${escapeHTML(feature.title)}</h3><p class="km-card-description">${escapeHTML(feature.description)}</p></div>`;
        const searchable = `${feature.title} ${feature.description} ${feature.group}`.toLowerCase();
        return `<article class="km-card is-${size}" data-menu-card="${escapeHTML(feature.id)}" data-card-open="${escapeHTML(feature.action)}" role="group" data-menu-search="${escapeHTML(searchable)}">
            <div class="km-card-top"><span class="km-card-icon">${icon(feature.icon,19)}</span><button class="km-card-arrow" type="button" data-card-open="${escapeHTML(feature.action)}" aria-label="Buka ${escapeHTML(feature.title)}" style="border:0;background:none;color:inherit;cursor:pointer;padding:2px">${icon('arrow',15)}</button></div>
            ${content}
        </article>`;
    }

    function createMarkup() {
        return `<header class="km-topbar">
            <div class="km-brand"><span class="km-brand-mark">${icon('spark',22)}</span><div><p class="km-brand-name">KANTOONG AI</p><p class="km-brand-sub">Personal Commerce Hub</p></div></div>
            <button class="km-icon-btn" type="button" data-menu-close aria-label="Tutup menu">${icon('close',21)}</button>
        </header>
        <main class="km-content">
            <section class="km-welcome"><div><p class="km-eyebrow">YOUR PERSONAL SPACE</p><h2 class="km-title">Semua kebutuhanmu,<br>di satu tempat.</h2><p class="km-subtitle">Ringkasan belanja, pesanan, aktivitas, dan pengaturan tampil langsung di sini.</p></div></section>
            <label class="km-search">${icon('search',19)}<input type="search" id="kantoongMenuSearch" placeholder="Cari fitur yang kamu butuhkan..." autocomplete="off" aria-label="Cari fitur menu"></label>
            <section class="km-promo" aria-label="Sorotan KANTOONG"><div class="km-promo-copy"><p class="km-promo-kicker" id="kmPromoEyebrow"></p><h2 class="km-promo-title" id="kmPromoTitle"></h2><p class="km-promo-text" id="kmPromoDescription"></p><div class="km-promo-controls"><button type="button" data-promo-prev aria-label="Promo sebelumnya">←</button><span class="km-promo-count" id="kmPromoCount"></span><button type="button" data-promo-next aria-label="Promo berikutnya">→</button></div></div><span class="km-promo-symbol">${icon('spark',32)}</span></section>
            <section aria-labelledby="kmCoreTitle"><div class="km-section-head"><h2 class="km-section-title" id="kmCoreTitle">Ringkasan & semua fitur</h2><span class="km-section-note" id="kmFeatureCount"></span></div><div class="km-grid" id="kmFeatureGrid">${FEATURES.map(cardMarkup).join('')}</div></section>
            <section class="km-account-slot" id="kmAccountSlot"><p class="km-eyebrow">ACCOUNT ACCESS</p><p class="km-subtitle">Login dan akses akun.</p></section>
            <footer class="km-footer"><span>KANTOONG CORE · CUSTOMER EXPERIENCE</span><button type="button" data-menu-action="settings">Preferensi ${icon('settings',12)}</button></footer>
        </main>`;
    }

    function showToast(message) {
        if (!drawer) return;
        drawer.querySelector('.km-toast')?.remove();
        clearTimeout(toastTimer);
        const toast = document.createElement('div');
        toast.className = 'km-toast';
        toast.setAttribute('role','status');
        toast.textContent = message;
        drawer.appendChild(toast);
        toastTimer = setTimeout(() => toast.remove(), 3000);
    }

    function updatePromo(index) {
        const promos = getPromos();
        if (!promos.length) return;
        promoIndex = (index + promos.length) % promos.length;
        const promo = promos[promoIndex];
        $('#kmPromoEyebrow',drawer).textContent = promo.eyebrow;
        $('#kmPromoTitle',drawer).textContent = promo.title;
        $('#kmPromoDescription',drawer).textContent = promo.description;
        $('#kmPromoCount',drawer).textContent = `${promoIndex+1} / ${promos.length}`;
        $('#kmPromoTitle',drawer).dataset.action = promo.action;
    }

    function filterFeatures(query) {
        const normalized = query.trim().toLowerCase();
        let visible = 0;
        drawer.querySelectorAll('[data-menu-search]').forEach((card) => {
            const match = !normalized || card.dataset.menuSearch.includes(normalized);
            card.classList.toggle('km-hidden',!match);
            if (match) visible++;
        });
        $('#kmFeatureCount',drawer).textContent = normalized ? `${visible} fitur ditemukan` : `${FEATURES.length} fitur`;
        let empty = $('#kmSearchEmpty',drawer);
        if (!visible && !empty) {
            empty = document.createElement('div');
            empty.id = 'kmSearchEmpty';
            empty.className = 'km-empty';
            empty.textContent = 'Fitur tidak ditemukan. Coba kata kunci lain.';
            $('#kmFeatureGrid',drawer).appendChild(empty);
        } else if (visible && empty) empty.remove();
    }

        function applyTheme(theme) {
        selectedTheme = ['light','dark','system'].includes(theme) ? theme : 'light';
        let dark = selectedTheme === 'dark';
        if (selectedTheme === 'system') {
            dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;
        }
        if (drawer) {
            drawer.classList.toggle('km-dark',dark);
            drawer.dataset.theme = selectedTheme;
            drawer.querySelectorAll('[data-theme-toggle]').forEach((button) => {
                button.setAttribute('aria-checked',String(dark));
                button.setAttribute('aria-label',dark?'Nonaktifkan mode gelap':'Aktifkan mode gelap');
            });
            drawer.querySelectorAll('[data-theme-caption]').forEach((el) => {
                el.textContent = dark ? 'Tema gelap aktif' : 'Tema terang aktif';
            });
        }
        try { localStorage.setItem(STORAGE_THEME,selectedTheme); } catch {}
        emit('kantoong:menu-theme-change',{theme:selectedTheme});
    }

    function loadTheme() {
        let theme = 'light';
        try { theme = localStorage.getItem(STORAGE_THEME) || 'light'; } catch {}
        applyTheme(theme);
    }

    function moveLegacyControls() {
        const slot = $('#kmAccountSlot',drawer);
        if (!slot) return;
        const legacyAdmin = $('#drawerAdminBtn');
        const legacyAuth = $('#customerAuthContainer');
        const legacyLogout = $('#drawerCustomerLogoutBtn');
        if (legacyAdmin) { legacyAdmin.classList.add('km-legacy-admin'); slot.appendChild(legacyAdmin); }
        if (legacyAuth) slot.appendChild(legacyAuth);
        if (legacyLogout && !slot.contains(legacyLogout)) slot.appendChild(legacyLogout);
        const legacyCatalog = $('#btnOpenCatalog');
        if (legacyCatalog) { legacyCatalog.classList.add('km-hidden'); legacyCatalog.setAttribute('aria-hidden','true'); }
        const oldComponent = $('[data-component]',drawer);
        if (oldComponent) { oldComponent.classList.add('km-hidden'); oldComponent.setAttribute('aria-hidden','true'); }
    }

    function openMenu() {
        if (!drawer) return;
        previousFocus = document.activeElement;
        drawer.classList.add('is-open');
        drawer.style.display = 'flex';
        drawer.setAttribute('aria-modal','true');
        drawer.setAttribute('role','dialog');
        drawer.setAttribute('aria-label','Pusat menu pelanggan');
        document.body.style.overflow = 'hidden';
        loadTheme();
        requestAnimationFrame(() => searchInput?.focus({preventScroll:true}));
        emit('kantoong:menu-open');
    }

    function closeMenu() {
        if (!drawer) return;
        drawer.classList.remove('is-open');
        drawer.style.display = 'none';
        drawer.removeAttribute('aria-modal');
        document.body.style.overflow = '';
        if (previousFocus instanceof HTMLElement) previousFocus.focus({preventScroll:true});
        emit('kantoong:menu-close');
    }

    function handleFeature(action) {
        const controller = window.KantoongMenuController;

        if (!controller) {
            console.error(
                `${MODULE} Menu controller tidak tersedia.`
            );
            showToast('Sistem menu belum siap. Coba muat ulang halaman.');
            return;
        }

        const result = controller.dispatch(action);

        if (!result.ok) {
            showToast('Fitur belum dapat dibuka. Silakan coba lagi.');
        }
    }


    function openSettings() {
        const theme = selectedTheme === 'dark' ? 'Gelap' : selectedTheme === 'system' ? 'Ikuti sistem' : 'Terang';
        showToast(`Tema saat ini: ${theme}. Gunakan toggle Mode gelap pada kartu Pengaturan Aplikasi.`);
    }

    function bindEvents() {
        const menuButton = $('#showcaseMenuBtn');
        if (menuButton) {
            menuButton.addEventListener('click',(event)=>{
                event.preventDefault();
                event.stopImmediatePropagation();
                openMenu();
            },true);
        }

        drawer.addEventListener('click',(event)=>{
            const close = event.target.closest('[data-menu-close]');
            if (close) { event.preventDefault(); closeMenu(); return; }

            const prev = event.target.closest('[data-promo-prev]');
            if (prev) { updatePromo(promoIndex-1); return; }
            const next = event.target.closest('[data-promo-next]');
            if (next) { updatePromo(promoIndex+1); return; }

            const themeToggle = event.target.closest('[data-theme-toggle]');
            if (themeToggle) {
                const nextTheme = themeToggle.getAttribute('aria-checked') === 'true' ? 'light' : 'dark';
                applyTheme(nextTheme);
                return;
            }

            const notificationToggle = event.target.closest('[data-notification-toggle]');
            if (notificationToggle) {
                const enabled = notificationToggle.getAttribute('aria-checked') !== 'true';
                notificationToggle.setAttribute('aria-checked',String(enabled));
                showToast(enabled ? 'Preferensi notifikasi dipilih. Integrasi notifikasi belum tersambung.' : 'Notifikasi dinonaktifkan pada tampilan ini.');
                return;
            }

            const calPrev = event.target.closest('[data-calendar-prev]');
            if (calPrev) {
                calendarDate = new Date(calendarDate.getFullYear(),calendarDate.getMonth()-1,1);
                refreshCalendar();
                return;
            }

            const calNext = event.target.closest('[data-calendar-next]');
            if (calNext) {
                calendarDate = new Date(calendarDate.getFullYear(),calendarDate.getMonth()+1,1);
                refreshCalendar();
                return;
            }

            const cardOpen = event.target.closest('[data-card-open]');
            if (cardOpen) {
                event.preventDefault();
                handleFeature(cardOpen.dataset.cardOpen);
                return;
            }

            const footerAction = event.target.closest('[data-menu-action]');
            if (footerAction) {
                event.preventDefault();
                handleFeature(footerAction.dataset.menuAction);
            }
        });

        searchInput = $('#kantoongMenuSearch',drawer);
        searchInput?.addEventListener('input',()=>filterFeatures(searchInput.value));

        document.addEventListener('keydown',(event)=>{
            if (event.key==='Escape' && drawer.classList.contains('is-open')) closeMenu();
            if (event.key!=='Tab' || !drawer.classList.contains('is-open')) return;
            const focusable = [...drawer.querySelectorAll('button:not(:disabled),input:not(:disabled)')]
                .filter((el)=>el.getClientRects().length>0);
            if (!focusable.length) return;
            if (event.shiftKey && document.activeElement===focusable[0]) {
                event.preventDefault();
                focusable.at(-1).focus();
            } else if (!event.shiftKey && document.activeElement===focusable.at(-1)) {
                event.preventDefault();
                focusable[0].focus();
            }
        });

        window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{
            if (selectedTheme==='system') applyTheme('system');
        });
    }

    function refreshCalendar() {
        const card = $('[data-menu-card="calendar"]',drawer);
        if (!card) return;
        const content = $('.km-card-body',card);
        if (content) content.outerHTML = renderCalendar();
    }

    function init() {
        if (initialized) return;
        drawer = $('#sampleDrawer');
        if (!drawer) {
            console.error(`${MODULE} #sampleDrawer tidak ditemukan. Pastikan index.html memuat markup drawer.`);
            return;
        }
        initialized = true;
        
        installStyles();
        drawer.classList.add('kantoong-menu-drawer');
        drawer.innerHTML = createMarkup();

        window.KantoongMenuController.configure({
            getFeatures: () => FEATURES,
            closeMenu,
            showToast
        });

        moveLegacyControls();
        bindEvents();
        updatePromo(0);
        filterFeatures('');
        loadTheme();
        console.info(`${MODULE} dashboard pelanggan siap.`);
    }

    if (document.readyState==='loading') {
        document.addEventListener('DOMContentLoaded',init,{once:true});
    } else {
        init();
    }

    window.KantoongCustomerMenu = Object.freeze({
        open:openMenu,
        close:closeMenu,
        applyTheme,
        getFeatures:()=>FEATURES.map((item)=>({...item}))
    });
})();
/**
 * KANTOONG — HALAMAN DETAIL FITUR (Lapisan 2, Blueprint Vol.7)
 * File: frontend/dashboard-user/home/details.js
 *
 * Kartu = ringkasan. Di sini (setelah kartu ditekan) baru tampil
 * informasi lengkap, riwayat, dan tindakan fitur tersebut.
 */

import { el, icon } from "./home-icons.js";
import {
    ORDER_LABEL,
    ORDER_STEPS,
    brandInfo,
    getChatSessions,
    getRecentIds,
    getWishlistIds,
    loadMyOrders,
    loadProducts,
    monthlySpending,
    productImage,
    rupiah,
    shortRupiah,
    STORE_URL,
} from "./home-data.js";
import { productTile as baseTile, renderCatalog } from "./catalog-view.js";
import { PRICE_BANDS, SORTS } from "./catalog-search.js";
import { catalogToParams, paramsToCatalog } from "../../js/catalog-url.js";
import { getStorefront, onStorefrontChange, startStorefrontSync } from "../../js/storefront-settings.js";

/* ---------- Jembatan ke toko (halaman induk) ---------- */

function toParent(message) {
    if (window.parent && window.parent !== window) {
        window.parent.postMessage(message, window.location.origin);
        return true;
    }
    return false;
}

export function openProduct(id, from = "") {
    if (!toParent({ type: "kantoong:open-product", id: String(id), from })) {
        window.location.href = `${STORE_URL}#produk/${encodeURIComponent(id)}`;
    }
}

function openAssistant() {
    if (!toParent({ type: "kantoong:open-assistant" })) window.location.href = STORE_URL;
}

function openFeature(id) {
    window.dispatchEvent(new CustomEvent("kantoong:bento-open", { detail: { id } }));
}

const page = (...children) => el("div", "bx-detail", ...children);

function empty(iconName, title, text, action) {
    return el("div", "bx-empty", el("span", "bx-empty__icon", icon(iconName, "bx-icon bx-icon--xl")), el("h3", "", title), el("p", "", text), action ?? null);
}

function button(label, onClick, className = "bx-btn") {
    const b = el("button", className, label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
}

function productTile(p, { onRemove } = {}) {
    const tile = baseTile(p, { onOpen: (prod) => openProduct(prod.id, "wishlist") });
    if (onRemove) {
        const x = el("button", "bx-tile__remove", icon("close"));
        x.type = "button";
        x.setAttribute("aria-label", `Hapus ${p.name} dari wishlist`);
        x.addEventListener("click", () => onRemove(p, tile));
        tile.append(x);
    }
    return tile;
}

/* ============================================================
   KATALOG PRODUK LENGKAP (per kategori, diatur admin di ERP)
   ============================================================ */

const CATALOG_STATE_KEY = "kantoong:catalog-state";

export async function mountCatalog(root) {
    let saved = null;
    try {
        saved = JSON.parse(sessionStorage.getItem(CATALOG_STATE_KEY) || "null");
        const pending = sessionStorage.getItem("kantoong:catalog-query");
        if (pending) {
            saved = { ...(saved ?? {}), query: pending };
            sessionStorage.removeItem("kantoong:catalog-query");
        }
        // Dibuka dari link toko (?katalog=1&cari=…): saringan dari link menang.
        const fromLink = sessionStorage.getItem("kantoong:catalog-url");
        if (fromLink) {
            sessionStorage.removeItem("kantoong:catalog-url");
            const parsed = paramsToCatalog(fromLink, { sorts: SORTS.map((x) => x.id), bands: PRICE_BANDS.map((x) => x.id) });
            if (parsed) saved = parsed;
        }
    } catch {
        saved = null;
    }

    const view = renderCatalog(root, {
        products: [],
        settings: getStorefront(),
        sheetHost: root.closest(".dashboard-user") ?? document.body,
        state: saved?.global ? { query: saved.query ?? "", global: saved.global, perCat: saved.perCat ?? {} } : undefined,
        onOpenProduct: (p) => {
            remember();
            openProduct(p.id, "product-catalog");
        },
        // Alamat toko ikut berubah sesuai saringan (bisa di-bookmark / dibagikan).
        onStateChange: (st) => toParent({ type: "kantoong:catalog-state", params: catalogToParams(st).toString() }),
        shareLink: (st) => `${STORE_URL.split("#")[0].split("?")[0]}?${catalogToParams(st).toString()}`,
    });

    function remember() {
        try {
            sessionStorage.setItem(CATALOG_STATE_KEY, JSON.stringify(view.state));
        } catch {
            /* abaikan */
        }
    }

    // Susunan katalog berubah realtime saat admin mengubahnya di ERP.
    const stop = onStorefrontChange((settings) => {
        if (root.isConnected) view.update(settings);
        else stop();
    });
    startStorefrontSync();

    view.update(getStorefront(), await loadProducts());
    root.addEventListener("click", remember);
}

/* ============================================================
   WISHLIST
   ============================================================ */

export async function mountWishlist(root) {
    root.replaceChildren(page(el("div", "bx-results", el("div", "bx-tile bx-tile--ghost", el("span", "bx-shimmer")))));
    const products = await loadProducts();
    const byId = new Map(products.map((p) => [String(p.id), p]));

    const draw = () => {
        const items = getWishlistIds().map((id) => byId.get(id)).filter(Boolean);
        if (!items.length) {
            root.replaceChildren(page(empty("wishlist", "Wishlist masih kosong", "Ketuk ikon ♡ di produk yang kamu suka. Semuanya akan terkumpul di sini.",
                button("Lihat katalog", () => openFeature("product-catalog")))));
            return;
        }
        const grid = el("div", "bx-results", items.map((p) => productTile(p, {
            onRemove: (prod, tile) => {
                const next = getWishlistIds().filter((id) => id !== String(prod.id));
                try {
                    localStorage.setItem("kantoong_wishlist", JSON.stringify(next));
                } catch {
                    /* abaikan */
                }
                tile.classList.add("is-leaving");
                setTimeout(draw, 200);
            },
        })));
        root.replaceChildren(page(el("p", "bx-cat__summary", el("strong", "", `${items.length} favorit`), " · tersimpan di perangkat ini"), grid));
    };
    draw();
}

/* ============================================================
   PESANAN, LACAK PAKET, TOTAL BELANJA
   ============================================================ */

function signInPrompt(text) {
    return empty("profile", "Masuk dulu, ya", text, button("Masuk ke akun", () => openFeature("profile")));
}

function steps(status) {
    const at = ORDER_STEPS.indexOf(status);
    return el("ol", "bx-timeline", ORDER_STEPS.map((s, i) => el("li", i < at ? "is-done" : i === at ? "is-now" : "", el("span", "bx-timeline__dot"), el("span", "", ORDER_LABEL[s]))));
}

export function orderCard(o, { detail = false } = {}) {
    const date = new Date(o.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
    const card = el("article", `bx-order bx-order--${o.status}`,
        el("header", "bx-order__head",
            el("div", "", el("strong", "", o.order_code), el("span", "", date)),
            el("span", "bx-pill", ORDER_LABEL[o.status] ?? o.status)),
        el("p", "bx-order__total", rupiah(o.total)));
    if (o.status !== "dibatalkan") card.append(steps(o.status));
    if (detail || o.tracking_number) {
        const info = [o.courier_name, o.service_name].filter(Boolean).join(" · ");
        if (info || o.tracking_number) {
            const row = el("div", "bx-order__ship", icon("package-tracking"), el("span", "", info || "Kurir"));
            if (o.tracking_number) {
                const copy = button(`Resi ${o.tracking_number}`, async () => {
                    try {
                        await navigator.clipboard.writeText(o.tracking_number);
                        copy.textContent = "Resi disalin ✓";
                    } catch {
                        /* abaikan */
                    }
                }, "bx-btn bx-btn--ghost bx-btn--sm");
                row.append(copy);
            }
            card.append(row);
        }
    }
    return card;
}

export async function mountOrders(root) {
    root.replaceChildren(page(el("div", "bx-shimmer bx-shimmer--block")));
    const { signedIn, orders } = await loadMyOrders({ refresh: true });
    if (!signedIn) return root.replaceChildren(page(signInPrompt("Pesanan yang kamu buat saat masuk akan tersimpan rapi di sini.")));
    if (!orders.length) return root.replaceChildren(page(empty("my-orders", "Belum ada pesanan", "Pesanan pertamamu akan muncul di sini lengkap dengan statusnya.", button("Mulai belanja", () => openFeature("product-catalog")))));
    const active = orders.filter((o) => !["selesai", "dibatalkan"].includes(o.status));
    const done = orders.filter((o) => ["selesai", "dibatalkan"].includes(o.status));
    root.replaceChildren(page(
        active.length ? el("h3", "bx-h", `Aktif (${active.length})`) : null,
        ...active.map((o) => orderCard(o)),
        done.length ? el("h3", "bx-h", `Selesai (${done.length})`) : null,
        ...done.map((o) => orderCard(o)),
    ));
}

export async function mountTracking(root) {
    root.replaceChildren(page(el("div", "bx-shimmer bx-shimmer--block")));
    const { signedIn, orders } = await loadMyOrders({ refresh: true });
    if (!signedIn) return root.replaceChildren(page(signInPrompt("Masuk untuk melihat posisi paketmu.")));
    const shipping = orders.filter((o) => ["dibayar", "diproses", "dikirim"].includes(o.status));
    if (!shipping.length) return root.replaceChildren(page(empty("package-tracking", "Tidak ada paket di jalan", "Begitu pesananmu dikirim, nomor resi dan perjalanannya tampil di sini.")));
    root.replaceChildren(page(...shipping.map((o) => orderCard(o, { detail: true }))));
}

export async function mountSpending(root) {
    root.replaceChildren(page(el("div", "bx-shimmer bx-shimmer--block")));
    const { signedIn, orders } = await loadMyOrders({ refresh: true });
    if (!signedIn) return root.replaceChildren(page(signInPrompt("Total belanjamu dihitung dari pesanan di akunmu.")));
    const valid = orders.filter((o) => !["dibatalkan", "menunggu_pembayaran"].includes(o.status));
    const total = valid.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const months = monthlySpending(orders);
    const max = Math.max(1, ...months.map((m) => m.total));
    const chart = el("div", "bx-chart", months.map((m, i) => {
        const col = el("div", `bx-chart__col${i === months.length - 1 ? " is-now" : ""}`,
            el("span", "bx-chart__val", m.total ? shortRupiah(m.total) : ""),
            el("span", "bx-chart__bar"),
            el("span", "bx-chart__lbl", m.label));
        col.style.setProperty("--h", `${Math.max(3, (m.total / max) * 100)}%`);
        return col;
    }));
    root.replaceChildren(page(
        el("section", "bx-hero-stat",
            el("p", "bx-eyebrow", "Total belanja sepanjang waktu"),
            el("p", "bx-hero-stat__value", rupiah(total)),
            el("p", "bx-muted", `${valid.length} pesanan · rata-rata ${rupiah(valid.length ? total / valid.length : 0)}`)),
        el("h3", "bx-h", "6 bulan terakhir"),
        chart,
    ));
}

/* ============================================================
   RIWAYAT CHAT, JAM, LOKASI, BANTUAN
   ============================================================ */

export function mountChats(root) {
    const sessions = getChatSessions();
    if (!sessions.length) {
        root.replaceChildren(page(empty("ai-chat-history", "Belum ada percakapan", "Ngobrol dengan asisten soal ukuran, kecocokan, atau rekomendasi. Riwayatnya tersimpan 30 hari di perangkat ini.", button("Buka asisten", openAssistant))));
        return;
    }
    root.replaceChildren(page(
        el("p", "bx-cat__summary", el("strong", "", `${sessions.length} percakapan`), " · tersimpan 30 hari di perangkat ini"),
        el("ul", "bx-list", sessions.map((s) => el("li", "bx-list__item",
            el("span", "bx-list__icon", icon("ai-chat-history")),
            el("div", "", el("strong", "", s.title), el("span", "", `${s.count} pesan${s.at ? ` · ${s.at.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}` : ""}${s.live ? " · sedang berjalan" : ""}`))))),
        button("Lanjutkan di asisten", openAssistant),
    ));
}

export function mountClock(root) {
    const zones = [
        ["WIB", "Asia/Jakarta"],
        ["WITA", "Asia/Makassar"],
        ["WIT", "Asia/Jayapura"],
    ];
    const big = el("p", "bx-bigclock");
    const date = el("p", "bx-muted");
    const list = el("div", "bx-zones");
    const tick = () => {
        if (!root.isConnected) return clearInterval(timer);
        const now = new Date();
        big.textContent = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        date.textContent = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        list.replaceChildren(...zones.map(([label, tz]) => el("div", "bx-zone", el("span", "", label), el("strong", "", now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: tz })))));
    };
    const timer = setInterval(tick, 1000);
    root.replaceChildren(page(el("section", "bx-hero-stat bx-hero-stat--ink", big, date), list));
    tick();
}

export function mountStore(root) {
    const info = brandInfo();
    const q = encodeURIComponent([info.name, info.address].filter(Boolean).join(" "));
    const maps = info.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${q}`;
    root.replaceChildren(page(
        el("div", "bx-map bx-map--big", el("span", "bx-map__pin", icon("shipping-address", "bx-icon"))),
        el("h3", "bx-h", info.name),
        info.address ? el("p", "", info.address) : el("p", "bx-muted", "Alamat toko akan tampil di sini setelah diisi pemilik toko."),
        info.hours ? el("p", "bx-muted", `Jam buka: ${info.hours}`) : null,
        el("div", "bx-actions",
            el("a", "bx-btn", "Buka di Google Maps"),
            info.whatsapp ? el("a", "bx-btn bx-btn--ghost", "Chat WhatsApp") : null),
    ));
    const [mapsLink, waLink] = root.querySelectorAll(".bx-actions a");
    mapsLink.href = maps;
    mapsLink.target = "_blank";
    mapsLink.rel = "noopener";
    if (waLink) {
        waLink.href = `https://wa.me/${String(info.whatsapp).replace(/\D/g, "")}`;
        waLink.target = "_blank";
        waLink.rel = "noopener";
    }
}

export function mountSupport(root) {
    const info = brandInfo();
    const faqs = [
        ["Berapa lama pengiriman?", "Estimasi tampil di setiap produk dan saat checkout, tergantung kurir dan kotamu."],
        ["Bagaimana cara tukar atau retur?", "Hubungi kami dengan nomor pesanan dan foto produk. Kami bantu prosesnya."],
        ["Apakah asisten bisa membayar untukku?", "Tidak. Pembayaran selalu kamu lakukan sendiri — asisten hanya membantu memilih."],
        ["Bagaimana menghapus data saya?", "Buka menu asisten › Hapus memori, atau minta lewat chat. Kamu bisa memilih per brand atau semuanya."],
    ];
    const actions = el("div", "bx-actions", button("Tanya asisten sekarang", openAssistant));
    if (info.whatsapp) {
        const wa = el("a", "bx-btn bx-btn--ghost", "Chat WhatsApp");
        wa.href = `https://wa.me/${String(info.whatsapp).replace(/\D/g, "")}`;
        wa.target = "_blank";
        wa.rel = "noopener";
        actions.append(wa);
    }
    root.replaceChildren(page(
        el("section", "bx-hero-stat", el("p", "bx-eyebrow", "Customer Service"), el("p", "bx-hero-stat__value bx-hero-stat__value--sm", "Ada yang bisa kami bantu?"), el("p", "bx-muted", "Asisten menjawab langsung, 24 jam. Untuk urusan pesanan, tim kami siap membantu.")),
        actions,
        el("h3", "bx-h", "Pertanyaan yang sering muncul"),
        el("div", "bx-faq", faqs.map(([q, a]) => {
            const d = document.createElement("details");
            d.append(el("summary", "", q), el("p", "", a));
            return d;
        })),
    ));
}

export { getRecentIds };

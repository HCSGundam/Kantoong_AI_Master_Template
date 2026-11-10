/**
 * KANTOONG — KARTU SAMBUTAN DASHBOARD USER
 * File: frontend/dashboard-user/home/welcome.js
 *
 * Sapaan personal sesuai waktu + tiga angka penting yang langsung
 * terbaca (keranjang, favorit, pesanan aktif). Data asli saja.
 */

import { el, icon } from "./home-icons.js";
import { brandInfo, getCart, getWishlistIds, isActiveOrder, loadMyOrders, shortRupiah } from "./home-data.js";
import { supabase } from "../../js/supabase-client.js";
import { getPlan } from "../../js/plan.js";
import { renderSignals } from "./signals.js";

function greeting(hour) {
    if (hour < 4) return "Selamat malam";
    if (hour < 11) return "Selamat pagi";
    if (hour < 15) return "Selamat siang";
    if (hour < 19) return "Selamat sore";
    return "Selamat malam";
}

function stat(iconName, value, label, onClick) {
    const b = el("button", "bx-hero__stat", el("span", "bx-hero__stat-icon", icon(iconName)), el("span", "bx-hero__stat-text", el("strong", "", value), el("small", "", label)));
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
}

const openFeature = (id) => window.dispatchEvent(new CustomEvent("kantoong:bento-open", { detail: { id } }));

function openCart() {
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "kantoong:open-cart" }, window.location.origin);
    }
}

let drawing = 0;

export async function renderWelcome(section) {
    if (!section) return;
    const ticket = ++drawing;
    section.classList.add("bx-hero");

    const now = new Date();
    const brand = brandInfo().name;
    const cart = getCart();
    const favorites = getWishlistIds().length;

    let user = null;
    try {
        user = (await supabase.auth.getUser())?.data?.user ?? null;
    } catch {
        /* offline */
    }
    const { orders } = user ? await loadMyOrders() : { orders: [] };
    if (ticket !== drawing) return;

    const meta = user?.user_metadata ?? {};
    const first = String(meta.full_name || meta.name || "").trim().split(/\s+/)[0];
    const active = orders.filter(isActiveOrder).length;

    const content = el("div", "bx-hero__content",
        el("p", "bx-hero__date", now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })),
        el("h1", "bx-hero__title", `${greeting(now.getHours())}, ${first || "Kak"}`),
        el("p", "bx-hero__lead", user ? `Ruang pribadimu di ${brand}.` : `Ruang pribadimu di ${brand}. Masuk agar pesanan & poinmu tersimpan.`),
        el("div", "bx-hero__stats",
            getPlan().commerce
                ? stat("product-catalog", cart.count ? `${cart.count} barang` : "Kosong", cart.count ? `Keranjang · ${shortRupiah(cart.total)}` : "Keranjang", openCart)
                : stat("product-catalog", "Katalog", "Lihat semua produk", () => openFeature("product-catalog")),
            stat("wishlist", String(favorites), "Favorit", () => openFeature("wishlist")),
            getPlan().commerce
                ? stat("my-orders", user ? String(active) : "—", user ? "Pesanan aktif" : "Masuk untuk lihat", () => openFeature(user ? "my-orders" : "profile"))
                : stat("store-map", "Lokasi", "Kunjungi toko", () => openFeature("store-map")),
        ),
    );

    // Pertahankan elemen judul lama (dipakai sistem lain) tapi sembunyikan.
    const legacy = section.querySelector(".dashboard-welcome__content");
    if (legacy) legacy.hidden = true;
    section.querySelector(".bx-hero__content")?.remove();
    section.querySelector(".bx-hero__glow") ?? section.append(el("span", "bx-hero__glow"));
    section.append(content);
    // Sinyal "Mungkin kamu butuh ini" (hanya bila pengguna mengizinkan).
    renderSignals(content);
}

if (typeof window !== "undefined") {
    const redraw = () => {
        const host = document.querySelector(".bx-hero__content");
        if (host) renderSignals(host);
    };
    window.addEventListener("kantoong:ai-consent", redraw);
    window.addEventListener("kantoong:me-changed", () => setTimeout(redraw, 200));
}

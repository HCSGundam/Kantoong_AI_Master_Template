/**
 * KANTOONG — PEMBANTU BERSAMA UNTUK RUANG FITUR
 * File: frontend/dashboard-user/home/rooms/shared.js
 */

import CFG from "../../../client-config.js";
import { getStorefront, whatsappLink } from "../../../js/storefront-settings.js";
import { ORDER_LABEL, getCart, getWishlistIds, loadMyOrders, loadProducts, productImage, rupiah, shortRupiah } from "../home-data.js";
import { readMe, writeMe } from "../me-store.js";
import { el, icon } from "../home-icons.js";

export { el, icon, rupiah, shortRupiah, ORDER_LABEL, productImage };

export const BID = CFG?.business_id ?? "master_template_001";

export const fmtDate = (v, opts = { day: "numeric", month: "short", year: "numeric" }) => {
    const d = v instanceof Date ? v : new Date(v);
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString("id-ID", opts) : "";
};
export const fmtTime = (ms) => new Date(ms).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

export async function orders() {
    return loadMyOrders();
}

export async function products() {
    return loadProducts();
}

export function cartItems() {
    try {
        const raw = JSON.parse(localStorage.getItem(`kantoong:cart:v2:${BID}`) || "[]");
        return Array.isArray(raw) ? raw : [];
    } catch {
        return [];
    }
}

export { getCart, getWishlistIds };

export function storeContact() {
    const s = getStorefront();
    return { name: s.brand?.name || CFG?.app_name || "Toko", ...(s.brand?.contact ?? {}) };
}

export const waLink = (text) => whatsappLink(getStorefront(), text);

/** Kupon dari homepage (diatur admin) + yang sudah diklaim pengguna. */
export function coupons() {
    const blocks = getStorefront().home?.blocks ?? [];
    const all = blocks.filter((b) => b.type === "coupons" && b.enabled !== false).flatMap((b) => b.items ?? []).filter((c) => c.code);
    let claimed = [];
    try {
        claimed = JSON.parse(localStorage.getItem("kantoong:claimed-coupons") || "[]");
    } catch {
        claimed = [];
    }
    return all.map((c) => {
        const min = Number(String(c.text ?? "").match(/min[^0-9]*([\d.]+)/i)?.[1]?.replace(/\./g, "")) || 0;
        return { ...c, min_purchase: min, ends_at: c.expires || "", claimed: claimed.includes(c.code) };
    });
}

/** Harga saat produk pertama kali di-wishlist (untuk alarm harga turun). */
export async function wishlistWithPrices() {
    const list = await loadProducts();
    const byId = new Map(list.map((p) => [String(p.id), p]));
    const then = readMe("wish-prices", {});
    let changed = false;
    const items = getWishlistIds().map((id) => {
        const p = byId.get(id);
        if (!p) return null;
        if (!then[id]) {
            then[id] = Number(p.price) || 0;
            changed = true;
        }
        return { id, name: p.name, price: Number(p.price) || 0, priceThen: then[id], stock: p.stock, image: productImage(p), category: p.category };
    }).filter(Boolean);
    if (changed) writeMe("wish-prices", then);
    return items;
}

export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

export function download(name, content, type = "text/plain") {
    const blob = new Blob([content], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const signInNote = "Masuk ke akunmu agar data ini tersimpan & tersinkron.";

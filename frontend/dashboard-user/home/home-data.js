/**
 * KANTOONG — SUMBER DATA KARTU DASHBOARD USER
 * File: frontend/dashboard-user/home/home-data.js
 *
 * Semua angka di kartu berasal dari sini: data asli di perangkat
 * (keranjang, wishlist, terakhir dilihat, riwayat chat) dan data
 * Supabase (produk publik, pesanan milik user yang login — dibatasi RLS).
 * Tidak ada angka karangan. Bila kosong, kartu menampilkan ajakan ramah.
 */

import CFG from "../../client-config.js";
import { supabase } from "../../js/supabase-client.js";
import { PRODUCT_PUBLIC_COLUMNS } from "../../js/product-columns.js";
import { getPlan } from "../../js/plan.js";
import { enrichProducts } from "../../js/industry.js";
import { loadAttributes } from "../../js/product-attributes.js";
import { getStorefront } from "../../js/storefront-settings.js";

const BID = CFG?.business_id ?? "master_template_001";

const readJson = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
};

export const rupiah = (n) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })
        .format(Number(n) || 0)
        .replace(/\s/g, " ");

/** Rp 3,45 jt / Rp 850 rb — angka ringkas untuk kartu. */
export function shortRupiah(n) {
    const v = Number(n) || 0;
    if (v >= 1e9) return `Rp ${(v / 1e9).toFixed(1).replace(".", ",")} M`;
    if (v >= 1e6) return `Rp ${(v / 1e6).toFixed(v >= 1e7 ? 1 : 2).replace(".", ",")} jt`;
    if (v >= 1e3) return `Rp ${Math.round(v / 1e3)} rb`;
    return rupiah(v);
}

/* ---------- Produk (kolom publik saja, tanpa harga modal) ---------- */

let productsPromise = null;

export function loadProducts() {
    if (!productsPromise) {
        productsPromise = (async () => {
            try {
                let q = supabase.from("products").select(PRODUCT_PUBLIC_COLUMNS);
                if (CFG?.filter_by_business_id === true) q = q.eq("business_id", BID);
                const { data, error } = await q.order("created_at", { ascending: false });
                if (error) throw error;
                const list = (data ?? []).filter((p) => p.is_published !== false);
                // Paket industri: spesifikasi properti/emas + harga emas hari ini.
                const { industry } = getPlan();
                return industry === "umum" ? list : enrichProducts(list, await loadAttributes(), { industry, gold: getStorefront().catalog.gold });
            } catch (error) {
                console.warn("[KANTOONG Dashboard] Produk gagal dimuat:", error?.message || error);
                return [];
            }
        })();
    }
    return productsPromise;
}

export const productImage = (p) => String(p?.image_url ?? p?.hero_image_url ?? "");

/* ---------- Data di perangkat ---------- */

export function getCart() {
    const items = readJson(`kantoong:cart:v2:${BID}`, []);
    const list = Array.isArray(items) ? items : [];
    return {
        items: list,
        count: list.reduce((n, it) => n + (Number(it.qty) || 0), 0),
        total: list.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0),
    };
}

export function getWishlistIds() {
    const ids = readJson("kantoong_wishlist", []);
    return Array.isArray(ids) ? ids.map(String) : [];
}

export function getRecentIds() {
    const ids = readJson("kantoong:recently-viewed", []);
    return Array.isArray(ids) ? ids.map(String) : [];
}

export function getLastReceipt() {
    const saved = readJson(`kantoong:last-order:${BID}`, null);
    return saved?.receipt ?? null;
}

/** Percakapan AI: sesi aktif + arsip "Chat baru". */
export function getChatSessions() {
    const sessions = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key?.startsWith("kantoong:chat:")) continue;
            const value = readJson(key, null);
            if (key.endsWith(":archive") && Array.isArray(value)) {
                value.forEach((s) => sessions.push({ messages: s.messages ?? [], at: s.endedAt }));
            } else if (Array.isArray(value)) {
                sessions.push({ messages: value, at: value[value.length - 1]?.timestamp, live: true });
            } else if (Array.isArray(value?.messages)) {
                sessions.push({ messages: value.messages, at: value.updatedAt, live: true });
            }
        }
    } catch {
        /* storage diblokir */
    }
    return sessions
        .filter((s) => s.messages.some((m) => m?.who === "user" || m?.role === "user"))
        .map((s) => {
            const firstUser = s.messages.find((m) => m?.who === "user" || m?.role === "user");
            return {
                title: String(firstUser?.text ?? firstUser?.content ?? "Percakapan").slice(0, 80),
                count: s.messages.length,
                at: s.at ? new Date(s.at) : null,
                live: Boolean(s.live),
            };
        })
        .sort((a, b) => (b.at?.getTime?.() ?? 0) - (a.at?.getTime?.() ?? 0));
}

/* ---------- Pesanan milik user login (RLS: hanya miliknya) ---------- */

let ordersPromise = null;

// Salinan pesanan TERAKHIR di perangkat pemiliknya (untuk saat sinyal hilang).
// Dihapus otomatis saat keluar akun & lewat "Hapus data saya".
const ORDERS_CACHE = `kantoong:me:${BID}:orders-cache`;
const readCache = () => {
    try {
        const v = JSON.parse(localStorage.getItem(ORDERS_CACHE) || "null");
        return v && Array.isArray(v.orders) ? v : null;
    } catch {
        return null;
    }
};
const writeCache = (orders) => {
    try {
        if (orders) localStorage.setItem(ORDERS_CACHE, JSON.stringify({ at: Date.now(), orders: orders.slice(0, 60) }));
        else localStorage.removeItem(ORDERS_CACHE);
    } catch {
        /* penyimpanan penuh / diblokir */
    }
};

export function loadMyOrders({ refresh = false } = {}) {
    if (!ordersPromise || refresh) {
        ordersPromise = (async () => {
            // Sinyal hilang: tampilkan data terakhir yang tersimpan, jujur ditandai offline.
            if (navigator.onLine === false) {
                const cached = readCache();
                return cached ? { signedIn: true, orders: cached.orders, offline: true, cachedAt: cached.at } : { signedIn: false, orders: [], offline: true };
            }
            try {
                const { data: auth } = await supabase.auth.getUser();
                if (!auth?.user) {
                    writeCache(null);
                    return { signedIn: false, orders: [] };
                }
                const { data, error } = await supabase
                    .from("orders")
                    .select("id, order_code, status, total, created_at, courier_name, service_name, shipping_eta, tracking_number, city")
                    .eq("user_id", auth.user.id)
                    .order("created_at", { ascending: false })
                    .limit(60);
                if (error) throw error;
                writeCache(data ?? []);
                return { signedIn: true, orders: data ?? [] };
            } catch (error) {
                console.warn("[KANTOONG Dashboard] Pesanan gagal dimuat:", error?.message || error);
                const cached = readCache();
                if (cached) return { signedIn: true, orders: cached.orders, offline: true, cachedAt: cached.at };
                return { signedIn: false, orders: [], error: true };
            }
        })();
    }
    return ordersPromise;
}

export const ORDER_STEPS = ["menunggu_pembayaran", "dibayar", "diproses", "dikirim", "selesai"];

export const ORDER_LABEL = {
    menunggu_pembayaran: "Menunggu pembayaran",
    dibayar: "Dibayar",
    diproses: "Sedang dikemas",
    dikirim: "Sedang dikirim",
    selesai: "Sudah sampai",
    dibatalkan: "Dibatalkan",
};

export const isActiveOrder = (o) => !["selesai", "dibatalkan"].includes(o?.status);

/** Belanja per bulan (6 bulan terakhir) dari pesanan yang tidak batal. */
export function monthlySpending(orders, now = new Date()) {
    const months = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("id-ID", { month: "short" }), total: 0 });
    }
    const byKey = new Map(months.map((m) => [m.key, m]));
    (orders ?? []).forEach((o) => {
        if (o.status === "dibatalkan" || o.status === "menunggu_pembayaran") return;
        const d = new Date(o.created_at);
        const m = byKey.get(`${d.getFullYear()}-${d.getMonth()}`);
        if (m) m.total += Number(o.total) || 0;
    });
    return months;
}

export function brandInfo() {
    return {
        name: CFG?.app_name || "Kantoong",
        address: CFG?.store?.address || CFG?.contact?.address || "",
        whatsapp: CFG?.contact?.whatsapp || CFG?.store?.whatsapp || "",
        hours: CFG?.store?.hours || "",
        mapsUrl: CFG?.store?.maps_url || "",
    };
}

export const STORE_URL = new URL("../index.html", import.meta.url).href;

/**
 * KANTOONG — PENGATURAN ETALASE BERSAMA (nama brand + katalog)
 * File: frontend/js/storefront-settings.js
 *
 * Satu sumber untuk toko, Dashboard User, dan ERP:
 *   brand   : { name, tagline }                  — hanya OWNER yang boleh ubah
 *   catalog : { categories, chips, chipLimit }   — admin/sales/marketing
 *   home    : { blocks }  zona promosi homepage    — admin/sales/marketing
 *
 * Disimpan di Supabase (tabel storefront_settings, baca publik, tulis lewat
 * fungsi storefront_save yang memeriksa jabatan). Salinan di perangkat
 * (localStorage) membuat nama brand langsung tampil tanpa menunggu internet.
 * Perubahan menyebar REALTIME: tab lain (storage + BroadcastChannel) dan
 * perangkat lain (Supabase Realtime).
 */

import CFG from "../client-config.js";

const BID = CFG?.business_id ?? "master_template_001";
export const STOREFRONT_KEY = `kantoong:storefront:${BID}`;
const CHANNEL = "kantoong-storefront";

/** Saran filter yang bisa dipilih admin per kategori. */
export const CHIP_KINDS = Object.freeze([
    { kind: "terlaris", label: "Terlaris" },
    { kind: "terbaru", label: "Terbaru" },
    { kind: "promo", label: "Promo" },
    { kind: "termurah", label: "Termurah" },
    { kind: "rating", label: "Rating 4+" },
    { kind: "ready", label: "Ready stok" },
    { kind: "under", label: "Di bawah", needsValue: "price" },
    { kind: "keyword", label: "Kata kunci", needsValue: "text" },
]);

export const DEFAULT_CHIPS = Object.freeze(["terlaris", "terbaru", "promo", "termurah", "rating"]);

const str = (v, max = 80) => String(v ?? "").trim().slice(0, max);

/* ---------- Homepage = zona promosi (diatur di ERP › Etalase & Brand) ---------- */

/** Jenis blok homepage. Semua opsional: admin bebas menyalakan / mematikan / mengurutkan. */
export const HOME_BLOCKS = Object.freeze([
    { type: "banner", label: "Banner promo", hint: "Iklan lebar dengan tombol ajakan" },
    { type: "coupons", label: "Kupon & voucher", hint: "Kode yang bisa diklaim pelanggan" },
    { type: "jackpot", label: "Kotak hadiah misteri", hint: "Hadiah tak terduga, 1× sehari per pelanggan" },
    { type: "posters", label: "Poster", hint: "Kartu gambar untuk event / pengumuman" },
    { type: "pinned", label: "Produk pilihan admin", hint: "Produk yang disematkan admin" },
]);

/** Contoh isi (template kosong) supaya pemilik bisa melihat hasilnya dulu. */
export function sampleHome() {
    return {
        blocks: [
            {
                type: "banner", enabled: true, sample: true, title: "",
                items: [
                    { title: "Promo akhir pekan", text: "Diskon spesial untuk menu favoritmu. Berlaku Sabtu–Minggu.", image: "", cta: "Lihat produk", action: "catalog" },
                    { title: "Bingung pilih?", text: "Ceritakan seleramu, asisten kami carikan yang paling pas.", image: "", cta: "Tanya asisten", action: "chat" },
                ],
            },
            {
                type: "coupons", enabled: true, sample: true, title: "Kupon untukmu",
                items: [
                    { code: "HEMAT10", title: "Diskon 10%", text: "Min. belanja Rp 50.000", expires: "" },
                    { code: "ONGKIR", title: "Gratis ongkir", text: "Untuk pesanan pertama", expires: "" },
                ],
            },
            {
                type: "jackpot", enabled: true, sample: true, title: "Kotak hadiah misteri",
                text: "Buka 1× sehari. Hadiahnya acak dari daftar hadiah toko.",
                rewards: [
                    { label: "Diskon 5%", code: "MISTERI5", weight: 40 },
                    { label: "Gratis topping", code: "TOPPING", weight: 25 },
                    { label: "Diskon 15%", code: "JACKPOT15", weight: 5 },
                    { label: "Belum beruntung — coba lagi besok", code: "", weight: 30 },
                ],
            },
            {
                type: "posters", enabled: true, sample: true, title: "Info & event",
                items: [
                    { title: "Menu baru setiap bulan", text: "Ikuti terus kejutannya.", image: "" },
                    { title: "Kemitraan reseller", text: "Hubungi kami lewat asisten.", image: "" },
                ],
            },
            { type: "pinned", enabled: false, sample: true, title: "Pilihan kami", productIds: [] },
        ],
    };
}

const cleanUrl = (v) => {
    const url = str(v, 500);
    return /^https:\/\//i.test(url) ? url : "";
};
const cleanCode = (v) => str(v, 20).toUpperCase().replace(/[^A-Z0-9_-]/g, "");

function cleanBlock(raw) {
    const meta = HOME_BLOCKS.find((b) => b.type === raw?.type);
    if (!meta) return null;
    const block = { type: meta.type, enabled: raw.enabled !== false, sample: raw.sample === true, title: str(raw.title, 60) };
    const items = Array.isArray(raw.items) ? raw.items.slice(0, 8) : [];
    if (meta.type === "banner") {
        block.items = items.map((it) => ({
            title: str(it?.title, 60), text: str(it?.text, 160), image: cleanUrl(it?.image),
            cta: str(it?.cta, 30), action: ["catalog", "chat", "none"].includes(it?.action) ? it.action : "catalog",
        })).filter((it) => it.title);
    } else if (meta.type === "coupons") {
        block.items = items.map((it) => ({
            code: cleanCode(it?.code), title: str(it?.title, 40), text: str(it?.text, 100), expires: str(it?.expires, 10),
        })).filter((it) => it.code && it.title);
    } else if (meta.type === "posters") {
        block.items = items.map((it) => ({ title: str(it?.title, 60), text: str(it?.text, 120), image: cleanUrl(it?.image) }))
            .filter((it) => it.title);
    } else if (meta.type === "jackpot") {
        block.text = str(raw.text, 160);
        block.rewards = (Array.isArray(raw.rewards) ? raw.rewards.slice(0, 10) : [])
            .map((r) => ({ label: str(r?.label, 50), code: cleanCode(r?.code), weight: Math.min(100, Math.max(1, Math.round(Number(r?.weight) || 1))) }))
            .filter((r) => r.label);
    } else if (meta.type === "pinned") {
        block.productIds = (Array.isArray(raw.productIds) ? raw.productIds : []).map((id) => str(id, 60)).filter(Boolean).slice(0, 20);
    }
    return block;
}

export function sanitizeHome(raw) {
    const source = Array.isArray(raw?.blocks) ? raw : sampleHome();
    const seen = new Set();
    const blocks = source.blocks.map(cleanBlock).filter((b) => b && !seen.has(b.type) && seen.add(b.type));
    // Jenis blok yang belum ada ditambahkan (mati) agar admin bisa menyalakannya.
    HOME_BLOCKS.forEach((meta) => {
        if (!seen.has(meta.type)) blocks.push({ ...cleanBlock({ type: meta.type, enabled: false }), enabled: false });
    });
    return { blocks };
}

/** Undian kotak misteri berbobot (rand 0..1 bisa disuntik saat tes). */
export function drawReward(rewards, rand = Math.random()) {
    const list = (rewards ?? []).filter((r) => r.weight > 0);
    const total = list.reduce((s, r) => s + r.weight, 0);
    if (!total) return null;
    let pick = rand * total;
    for (const r of list) {
        pick -= r.weight;
        if (pick < 0) return r;
    }
    return list[list.length - 1];
}

/** Logo: URL https (Supabase Storage) atau data:image kecil (mode demo). */
function cleanLogo(v) {
    const value = String(v ?? "").trim();
    if (/^https:\/\//i.test(value) && value.length <= 600) return value;
    if (/^data:image\/(png|webp|jpeg);base64,[a-z0-9+/=]+$/i.test(value) && value.length <= 350000) return value;
    return "";
}

export function defaultStorefront() {
    return {
        brand: { name: str(CFG?.app_name) || "Toko", tagline: "", logo: "" },
        catalog: { categories: {}, chips: {}, chipLimit: 6 },
        home: sampleHome(),
    };
}

function cleanChip(chip) {
    const kind = CHIP_KINDS.find((k) => k.kind === chip?.kind);
    if (!kind) return null;
    const out = { kind: kind.kind, label: str(chip.label, 30) || kind.label };
    if (kind.needsValue === "price") {
        const value = Math.max(0, Math.round(Number(chip.value) || 0));
        if (!value) return null;
        out.value = value;
    }
    if (kind.needsValue === "text") {
        const value = str(chip.value, 40);
        if (!value) return null;
        out.value = value;
    }
    return out;
}

/** Bersihkan data dari database/perangkat (murni, dites). */
export function sanitizeStorefront(raw) {
    const base = defaultStorefront();
    const brand = raw?.brand ?? {};
    const catalog = raw?.catalog ?? {};
    const categories = {};
    Object.entries(catalog.categories ?? {}).forEach(([key, value]) => {
        const k = str(key, 60);
        if (!k) return;
        categories[k] = {
            label: str(value?.label, 40),
            order: Number.isFinite(Number(value?.order)) ? Number(value.order) : 999,
            hidden: value?.hidden === true,
        };
    });
    const chips = {};
    Object.entries(catalog.chips ?? {}).forEach(([key, list]) => {
        if (!Array.isArray(list)) return;
        chips[str(key, 60)] = list.map(cleanChip).filter(Boolean).slice(0, 20);
    });
    return {
        brand: { name: str(brand.name, 60) || base.brand.name, tagline: str(brand.tagline, 120), logo: cleanLogo(brand.logo) },
        catalog: {
            categories,
            chips,
            chipLimit: Math.min(20, Math.max(1, Math.round(Number(catalog.chipLimit) || base.catalog.chipLimit))),
        },
        home: sanitizeHome(raw?.home),
    };
}

/* ---------- Bantuan katalog (murni) ---------- */

export function categoryLabel(settings, raw) {
    const entry = settings?.catalog?.categories?.[raw];
    return entry?.label || raw || "Lainnya";
}

/** Kategori yang tampil, urut sesuai admin (yang tidak diatur: urutan abjad di belakang). */
export function orderedCategories(products, settings) {
    const names = [...new Set((products ?? []).map((p) => str(p.category, 60) || "Lainnya"))];
    const cfg = settings?.catalog?.categories ?? {};
    return names
        .filter((name) => cfg[name]?.hidden !== true)
        .sort((a, b) => (cfg[a]?.order ?? 999) - (cfg[b]?.order ?? 999) || a.localeCompare(b, "id"))
        .map((name) => ({ key: name, label: categoryLabel(settings, name) }));
}

/** Saran filter untuk satu kategori (pakai bawaan bila admin belum mengatur). */
export function chipsFor(settings, category) {
    const own = settings?.catalog?.chips?.[category];
    const list = Array.isArray(own) && own.length
        ? own
        : (settings?.catalog?.chips?.["*"] ?? DEFAULT_CHIPS.map((kind) => ({ kind, label: CHIP_KINDS.find((k) => k.kind === kind).label })));
    return list.slice(0, settings?.catalog?.chipLimit ?? 6);
}

const priceOf = (p) => Number(p?.price) || 0;

/** Terapkan satu saran filter ke daftar produk. */
export function applyChip(products, chip) {
    const list = (products ?? []).slice();
    if (!chip) return list;
    switch (chip.kind) {
        case "terlaris": return list.sort((a, b) => (Number(b.sales_count) || 0) - (Number(a.sales_count) || 0));
        case "terbaru": return list.sort((a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0));
        case "promo": return list.filter((p) => Number(p.compare_at_price) > priceOf(p));
        case "termurah": return list.sort((a, b) => priceOf(a) - priceOf(b));
        case "rating": return list.filter((p) => Number(p.rating_avg) >= 4);
        case "ready": return list.filter((p) => p.stock === null || p.stock === undefined || Number(p.stock) > 0);
        case "under": return list.filter((p) => priceOf(p) <= Number(chip.value));
        case "keyword": {
            const q = String(chip.value).toLowerCase();
            return list.filter((p) => [p.name, p.caption, p.description].join(" ").toLowerCase().includes(q));
        }
        default: return list;
    }
}

export function chipLabel(chip) {
    if (chip.kind === "under" && chip.value) {
        const v = Number(chip.value);
        return `${chip.label || "Di bawah"} ${v >= 1000 ? `${Math.round(v / 1000)}rb` : v}`;
    }
    if (chip.kind === "keyword" && chip.label === "Kata kunci") return chip.value;
    return chip.label;
}

/* ---------- Muat, simpan, dengarkan ---------- */

function readCache() {
    try {
        return sanitizeStorefront(JSON.parse(localStorage.getItem(STOREFRONT_KEY) || "null"));
    } catch {
        return defaultStorefront();
    }
}

function writeCache(settings) {
    try {
        localStorage.setItem(STOREFRONT_KEY, JSON.stringify(settings));
    } catch {
        /* diblokir */
    }
}

let current = readCache();
// Nama brand langsung dipakai sejak halaman dibuka.
if (CFG && current.brand.name) CFG.app_name = current.brand.name;

const listeners = new Set();
let channel = null;
try {
    channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;
} catch {
    channel = null;
}

function publish(next, { broadcast = true } = {}) {
    current = sanitizeStorefront(next);
    if (CFG) CFG.app_name = current.brand.name;
    writeCache(current);
    if (broadcast) channel?.postMessage(current);
    listeners.forEach((fn) => {
        try {
            fn(current);
        } catch (error) {
            console.warn("[KANTOONG] Pendengar etalase gagal:", error);
        }
    });
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("kantoong:storefront-changed", { detail: current }));
    }
}

export function getStorefront() {
    return current;
}

let supabasePromise = null;
function client() {
    if (!supabasePromise) supabasePromise = import("./supabase-client.js").then((m) => m.supabase).catch(() => null);
    return supabasePromise;
}

/** Ambil versi terbaru dari database (bila ada), lalu sebarkan. */
export async function loadStorefront() {
    try {
        const supabase = await client();
        if (!supabase) return current;
        const { data, error } = await supabase
            .from("storefront_settings")
            .select("settings")
            .eq("business_id", BID)
            .maybeSingle();
        if (error) throw error;
        if (data?.settings) publish(data.settings);
    } catch (error) {
        // Tabel belum dibuat (SQL belum dijalankan) / offline: pakai salinan perangkat.
        console.info("[KANTOONG] Pengaturan etalase memakai salinan lokal:", error?.message || error);
    }
    return current;
}

/**
 * Simpan satu bagian ("brand" atau "catalog").
 * demo = true: hanya di perangkat (mode demo ERP).
 */
export async function saveStorefront(section, value, { demo = false } = {}) {
    if (!["brand", "catalog", "home"].includes(section)) throw new Error("Bagian tidak dikenal.");
    const next = sanitizeStorefront({ ...current, [section]: value });
    if (!demo) {
        const supabase = await client();
        if (!supabase) throw new Error("Tidak tersambung ke server.");
        const { data, error } = await supabase.rpc("storefront_save", {
            p_business_id: BID,
            p_section: section,
            p_value: next[section],
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
    }
    publish(next);
    return current;
}

/** Dengarkan perubahan (tab ini, tab lain, perangkat lain). */
export function onStorefrontChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

let realtimeStarted = false;
export async function startStorefrontSync() {
    if (realtimeStarted) return;
    realtimeStarted = true;
    channel?.addEventListener("message", (event) => publish(event.data, { broadcast: false }));
    window.addEventListener("storage", (event) => {
        if (event.key === STOREFRONT_KEY) publish(readCache(), { broadcast: false });
    });
    await loadStorefront();
    try {
        const supabase = await client();
        supabase
            ?.channel(`storefront:${BID}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "storefront_settings", filter: `business_id=eq.${BID}` }, (payload) => {
                if (payload.new?.settings) publish(payload.new.settings);
            })
            .subscribe();
    } catch {
        /* realtime opsional */
    }
}

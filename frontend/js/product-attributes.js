/**
 * KANTOONG — SPESIFIKASI PRODUK PER INDUSTRI (simpan & muat)
 * File: frontend/js/product-attributes.js
 *
 * Tabel product_attributes (db/industry.sql): baca publik, tulis staf.
 * Mode demo ERP: disimpan di perangkat (localStorage).
 * Tabel belum dibuat = toko tetap jalan, hanya spesifikasi tidak tampil.
 */

import CFG from "../client-config.js";

const BID = CFG?.business_id ?? "master_template_001";
const DEMO_KEY = `kantoong:demo-attributes:${BID}`;

function readDemo() {
    try {
        return JSON.parse(localStorage.getItem(DEMO_KEY) || "{}") || {};
    } catch {
        return {};
    }
}

let client = null;
async function supabaseClient() {
    if (!client) client = import("./supabase-client.js").then((m) => m.supabase).catch(() => null);
    return client;
}

/** Map id produk -> spesifikasi. Gabungan database + simpanan demo di perangkat. */
export async function loadAttributes() {
    const map = new Map();
    try {
        const supabase = await supabaseClient();
        if (supabase) {
            const { data, error } = await supabase.from("product_attributes").select("product_id, attributes").eq("business_id", BID);
            if (error) throw error;
            (data ?? []).forEach((row) => map.set(String(row.product_id), row.attributes ?? {}));
        }
    } catch (error) {
        console.info("[KANTOONG] Spesifikasi produk belum tersedia di database:", error?.message || error);
    }
    Object.entries(readDemo()).forEach(([id, attrs]) => {
        if (!map.has(id)) map.set(id, attrs);
    });
    return map;
}

export async function saveAttributes(productId, attributes, { demo = false } = {}) {
    const id = String(productId);
    if (demo) {
        const all = readDemo();
        all[id] = attributes;
        localStorage.setItem(DEMO_KEY, JSON.stringify(all));
        return;
    }
    const supabase = await supabaseClient();
    if (!supabase) throw new Error("Tidak tersambung ke server.");
    const { error } = await supabase.from("product_attributes").upsert({
        product_id: id,
        business_id: BID,
        attributes,
        updated_at: new Date().toISOString(),
    });
    if (error) {
        if (error.code === "42P01" || /product_attributes/.test(error.message)) {
            throw new Error("Tabel spesifikasi belum ada: jalankan db/industry.sql di Supabase.");
        }
        throw error;
    }
}

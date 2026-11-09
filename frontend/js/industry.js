/**
 * KANTOONG — PAKET INDUSTRI (umum · properti · emas) — murni, dites
 * File: frontend/js/industry.js
 *
 * Tiap industri punya kolom spesifikasi sendiri per produk (disimpan di tabel
 * product_attributes, lihat db/industry.sql), tampilan kartu & halaman produk
 * yang sesuai, dan — khusus emas — harga dihitung dari harga emas hari ini:
 *     harga = berat (gram) × harga per gram kadar itu + ongkos bikin
 */

export const INDUSTRIES = Object.freeze({
    umum: { label: "Umum (retail, F&B, fashion)", fields: [] },
    properti: {
        label: "Properti (agen / developer)",
        fields: [
            { key: "listing", label: "Status", type: "select", options: ["Dijual", "Disewakan"] },
            { key: "lokasi", label: "Lokasi", type: "text", placeholder: "Contoh: Bintaro Sektor 9, Tangerang Selatan" },
            { key: "lt", label: "Luas tanah (m²)", type: "number" },
            { key: "lb", label: "Luas bangunan (m²)", type: "number" },
            { key: "kt", label: "Kamar tidur", type: "number" },
            { key: "km", label: "Kamar mandi", type: "number" },
            { key: "lantai", label: "Jumlah lantai", type: "number" },
            { key: "sertifikat", label: "Sertifikat", type: "select", options: ["SHM", "HGB", "SHGB", "Strata Title", "AJB", "Girik", "Lainnya"] },
            { key: "maps", label: "Link Google Maps (https)", type: "url", placeholder: "https://maps.app.goo.gl/…" },
        ],
    },
    emas: {
        label: "Toko emas & perhiasan",
        fields: [
            { key: "jenis", label: "Jenis", type: "select", options: ["Cincin", "Kalung", "Gelang", "Anting", "Liontin", "Logam mulia", "Lainnya"] },
            { key: "kadar", label: "Kadar", type: "select", options: ["24K", "23K", "22K", "18K", "17K", "16K", "9K"] },
            { key: "berat", label: "Berat (gram)", type: "number", step: "0.01" },
            { key: "ongkos", label: "Ongkos bikin (Rp)", type: "number" },
            { key: "sertifikat", label: "Sertifikat / merek", type: "text", placeholder: "Contoh: Antam, UBS, surat toko" },
        ],
    },
});

export const industryOf = (name) => (INDUSTRIES[name] ? name : "umum");

const num = (v) => {
    const n = Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Bersihkan isian spesifikasi sesuai industrinya. */
export function cleanAttributes(industry, raw) {
    const out = {};
    (INDUSTRIES[industryOf(industry)].fields).forEach((f) => {
        const v = raw?.[f.key];
        if (v == null || v === "") return;
        if (f.type === "number") {
            const n = num(v);
            if (n) out[f.key] = Math.round(n * 100) / 100;
        } else if (f.type === "select") {
            if (f.options.includes(String(v))) out[f.key] = String(v);
        } else if (f.type === "url") {
            if (/^https:\/\//i.test(String(v))) out[f.key] = String(v).slice(0, 500);
        } else {
            out[f.key] = String(v).trim().slice(0, 160);
        }
    });
    return out;
}

const fmt = (n) => Number(n).toLocaleString("id-ID");

/** Baris spesifikasi untuk halaman produk. */
export function specRows(industry, attrs = {}) {
    const ind = industryOf(industry);
    if (ind === "properti") {
        return [
            ["Status", attrs.listing],
            ["Lokasi", attrs.lokasi],
            ["Luas tanah", attrs.lt && `${fmt(attrs.lt)} m²`],
            ["Luas bangunan", attrs.lb && `${fmt(attrs.lb)} m²`],
            ["Kamar tidur", attrs.kt],
            ["Kamar mandi", attrs.km],
            ["Lantai", attrs.lantai],
            ["Sertifikat", attrs.sertifikat],
        ].filter(([, v]) => v !== undefined && v !== "" && v !== 0).map(([label, value]) => ({ label, value: String(value) }));
    }
    if (ind === "emas") {
        return [
            ["Jenis", attrs.jenis],
            ["Kadar", attrs.kadar],
            ["Berat", attrs.berat && `${fmt(attrs.berat)} gram`],
            ["Ongkos bikin", attrs.ongkos && `Rp ${fmt(attrs.ongkos)}`],
            ["Sertifikat", attrs.sertifikat],
        ].filter(([, v]) => v).map(([label, value]) => ({ label, value: String(value) }));
    }
    return [];
}

/** Satu baris ringkas di kartu produk. */
export function cardLine(industry, attrs = {}) {
    const ind = industryOf(industry);
    if (ind === "properti") {
        return [attrs.lt && `LT ${fmt(attrs.lt)}`, attrs.lb && `LB ${fmt(attrs.lb)}`, attrs.kt && `${attrs.kt} KT`, attrs.km && `${attrs.km} KM`, attrs.lokasi]
            .filter(Boolean).join(" · ");
    }
    if (ind === "emas") {
        return [attrs.kadar, attrs.berat && `${fmt(attrs.berat)} gr`, attrs.jenis].filter(Boolean).join(" · ");
    }
    return "";
}

/** Harga emas = berat × harga per gram (kadar) + ongkos. null bila data belum lengkap. */
export function goldPrice(attrs = {}, gold = {}) {
    const perGram = num(gold?.prices?.[attrs.kadar]);
    const weight = num(attrs.berat);
    if (!perGram || !weight) return null;
    return Math.round(weight * perGram + num(attrs.ongkos));
}

/** Rp 1,25 M / Rp 850 jt — harga besar (properti) agar mudah dibaca. */
export function bigPrice(value) {
    const v = Number(value) || 0;
    if (v >= 1e9) return `Rp ${(v / 1e9).toFixed(v >= 1e10 ? 1 : 2).replace(/\.?0+$/, "").replace(".", ",")} M`;
    if (v >= 1e6) return `Rp ${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1).replace(/\.0$/, "").replace(".", ",")} jt`;
    return `Rp ${fmt(v)}`;
}

/**
 * Gabungkan spesifikasi ke produk:
 * - product.attributes = isian industri
 * - emas: product.price = harga hari ini (bila lengkap), product.price_note
 * - properti: caption kosong diisi ringkasan spesifikasi
 */
export function enrichProducts(products, attrsById, { industry = "umum", gold = null } = {}) {
    const ind = industryOf(industry);
    const attrsOf = (p) => attrsById?.get?.(String(p.id)) ?? attrsById?.[String(p.id)] ?? {};
    if (ind === "umum") {
        // Industri umum: hanya cerita produk (Cocok/Kurang Cocok, Jejak Asal) bila ada.
        if (!attrsById || (attrsById instanceof Map ? !attrsById.size : !Object.keys(attrsById).length)) return products;
        return (products ?? []).map((p) => (attrsOf(p).story ? { ...p, story: attrsOf(p).story } : p));
    }
    return (products ?? []).map((p) => {
        const attrs = attrsOf(p);
        const next = { ...p, attributes: attrs, spec_line: cardLine(ind, attrs), story: attrs.story ?? null };
        if (ind === "emas") {
            const price = goldPrice(attrs, gold);
            if (price) {
                next.base_price = p.price;
                next.price = price;
                next.price_note = gold?.updatedAt ? `Harga emas hari ini · ${gold.updatedAt}` : "Harga emas hari ini";
            }
        }
        if (!next.caption && next.spec_line) next.caption = next.spec_line;
        return next;
    });
}

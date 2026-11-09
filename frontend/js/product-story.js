/**
 * KANTOONG — CERITA PRODUK: COCOK / KURANG COCOK + JEJAK ASAL (murni, dites)
 * File: frontend/js/product-story.js
 *
 * Disimpan di product_attributes.attributes.story (db/industry.sql),
 * diisi staf di ERP › Katalog Master › edit produk. Jejak Asal bisa
 * diambil dari data supplier ERP (nama + kota saja, kontak tidak ikut).
 *
 * story = {
 *   fit:    ["Kulit kering", "Acara formal"]      (maks 4)
 *   notFit: ["Kulit berminyak"]                    (maks 4)
 *   origin: { material, place, maker, supplier, note }
 * }
 */

export const STORY_LIMIT = 4;
export const ORIGIN_FIELDS = Object.freeze([
    { key: "material", label: "Bahan utama", placeholder: "Contoh: Katun combed 30s" },
    { key: "place", label: "Asal bahan / daerah", placeholder: "Contoh: Pekalongan, Jawa Tengah" },
    { key: "maker", label: "Dibuat oleh", placeholder: "Contoh: Penjahit rumahan, Bandung" },
    { key: "supplier", label: "Pemasok", placeholder: "Diisi otomatis bila memilih pemasok ERP" },
    { key: "note", label: "Cerita singkat", placeholder: "Contoh: Dijahit tangan, 1 orang 6 potong per hari", long: true },
]);

const text = (v, max) => String(v ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);

/** Terima teks (satu per baris / dipisah koma) atau array. */
export function cleanList(value) {
    const raw = Array.isArray(value) ? value : String(value ?? "").split(/[\n,]/);
    return [...new Set(raw.map((v) => text(v, 60)).filter(Boolean))].slice(0, STORY_LIMIT);
}

export function cleanStory(raw) {
    const origin = {};
    ORIGIN_FIELDS.forEach((f) => {
        const v = text(raw?.origin?.[f.key], f.long ? 240 : 80);
        if (v) origin[f.key] = v;
    });
    const story = {};
    const fit = cleanList(raw?.fit);
    const notFit = cleanList(raw?.notFit);
    if (fit.length) story.fit = fit;
    if (notFit.length) story.notFit = notFit;
    if (Object.keys(origin).length) story.origin = origin;
    return story;
}

export const hasStory = (story) => Boolean(story && (story.fit?.length || story.notFit?.length || story.origin));

/** Ringkasan pemasok ERP yang aman tampil publik: nama + kota (tanpa kontak). */
export function supplierOrigin(supplier) {
    if (!supplier) return "";
    const city = String(supplier.address ?? "").split(",").map((s) => s.trim()).filter(Boolean).pop() ?? "";
    return text(city && !String(supplier.name).includes(city) ? `${supplier.name}, ${city}` : supplier.name, 80);
}

/**
 * KANTOONG CORE — PRODUCT SERVICE
 * File: frontend/dashboard-admin/services/product-detail-service.js
 *
 * CRUD produk ke Supabase. Hak menulis dijaga oleh RLS (owner saja).
 */

import { supabase } from "../../js/supabase-client.js";
import { ADMIN_CONFIG } from "../dashboard-admin-config.js";

const TABLE = ADMIN_CONFIG.tables.products;

function text(value) {
    return String(value ?? "").trim();
}

/**
 * Kolom tambahan kartu produk (db/product-card.sql). Hanya dikirim bila
 * diisi atau kolomnya sudah ada, agar admin tetap jalan sebelum SQL dijalankan.
 */
function buildCardPatch(input) {
    const known = new Set(input.existing_keys ?? []);
    const compareAt = Number(input.compare_at_price);
    const values = {
        compare_at_price:
            text(input.compare_at_price) && Number.isFinite(compareAt) && compareAt > 0
                ? compareAt
                : null,
        ship_estimate: text(input.ship_estimate) || null,
        ship_from: text(input.ship_from) || null,
    };

    return Object.fromEntries(
        Object.entries(values).filter(([key, value]) => value !== null || known.has(key))
    );
}

function buildPayload(input) {
    const price = Number(input.price);
    const stock = Number.parseInt(input.stock, 10);

    // Kolom hero_image_url hanya dikirim bila dipakai, agar admin tetap bisa
    // menyimpan produk walau kolomnya belum ditambahkan di database.
    const heroImage = text(input.hero_image_url);
    const heroImagePatch = heroImage || input.had_hero_image
        ? { hero_image_url: heroImage || null }
        : {};

    return {
        ...heroImagePatch,
        ...buildCardPatch(input),
        name: text(input.name),
        category: text(input.category) || "Umum",
        price: Number.isFinite(price) && price >= 0 ? price : 0,
        stock: Number.isFinite(stock) && stock >= 0 ? stock : 0,
        description: text(input.description),
        image_url: text(input.image_url),
        is_featured: input.is_featured === true,
        is_hero: input.is_hero === true,
        hero_caption: text(input.hero_caption),
        hero_text: text(input.hero_text),
    };
}

export function validateProductInput(input) {
    if (!text(input.name)) {
        return "Nama produk wajib diisi.";
    }

    const price = Number(input.price);

    if (!Number.isFinite(price) || price < 0) {
        return "Harga harus berupa angka 0 atau lebih.";
    }

    const compareAt = Number(input.compare_at_price);

    if (text(input.compare_at_price) && (!Number.isFinite(compareAt) || compareAt < 0)) {
        return "Harga coret harus berupa angka 0 atau lebih.";
    }

    return "";
}

export async function listProducts() {
    const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        throw error;
    }

    return Array.isArray(data) ? data : [];
}

export async function createProduct(input) {
    const payload = {
        ...buildPayload(input),
        business_id: ADMIN_CONFIG.businessId,
    };

    const { data, error } = await supabase
        .from(TABLE)
        .insert([payload])
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
}

export async function updateProduct(id, input) {
    const { data, error } = await supabase
        .from(TABLE)
        .update(buildPayload(input))
        .eq("id", id)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
}

export async function deleteProduct(id) {
    const { error } = await supabase
        .from(TABLE)
        .delete()
        .eq("id", id);

    if (error) {
        throw error;
    }
}

export async function uploadProductImage(file) {
    const { bucket, maxFileBytes, allowedTypes } = ADMIN_CONFIG.storage;

    if (!allowedTypes.includes(file.type)) {
        throw new Error("Format foto harus JPG, PNG, atau WebP.");
    }

    if (file.size > maxFileBytes) {
        throw new Error("Ukuran foto maksimal 3 MB.");
    }

    const extension = file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
            ? "webp"
            : "jpg";

    const random = Math.random().toString(36).slice(2, 10);
    const path = `products/${Date.now()}-${random}.${extension}`;

    const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
        });

    if (error) {
        throw error;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);

    return data.publicUrl;
}

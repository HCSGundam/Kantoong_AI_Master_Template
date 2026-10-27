/**
 * KANTOONG CORE — PUBLISHED STOREFRONT SERVICE
 * File: frontend/dashboard-admin/services/published-storefront-service.js
 *
 * Mengatur produk mana yang tampil di homepage:
 * - is_featured = kartu "Produk Unggulan"
 * - is_hero     = hero slider
 */

import { supabase } from "../../js/supabase-client.js";
import { ADMIN_CONFIG } from "../dashboard-admin-config.js";

const TABLE = ADMIN_CONFIG.tables.products;

export async function setPublication(productId, changes) {
    const patch = {};

    if (typeof changes.is_featured === "boolean") {
        patch.is_featured = changes.is_featured;
    }

    if (typeof changes.is_hero === "boolean") {
        patch.is_hero = changes.is_hero;
    }

    if (Object.keys(patch).length === 0) {
        return null;
    }

    const { data, error } = await supabase
        .from(TABLE)
        .update(patch)
        .eq("id", productId)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
}

export function summarizePublication(products) {
    return {
        total: products.length,
        featured: products.filter((p) => p.is_featured === true).length,
        hero: products.filter((p) => p.is_hero === true).length,
    };
}

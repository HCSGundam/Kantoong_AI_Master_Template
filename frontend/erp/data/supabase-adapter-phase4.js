/**
 * KANTOONG ERP — SUMBER DATA SUPABASE FASE 4 (AI Research & Second Brain)
 * File: frontend/erp/data/supabase-adapter-phase4.js
 *
 * Membaca ai_events (erp-phase4.sql). RLS hanya mengizinkan OWNER;
 * peran lain otomatis mendapat daftar kosong.
 */

import CFG from "../../client-config.js";
import { supabase } from "../../js/supabase-client.js";

export function phase4SupabaseMethods() {
    return {
        async listAiEvents({ days = 30 } = {}) {
            const since = new Date(Date.now() - days * 86400000).toISOString();
            const { data, error } = await supabase
                .from("ai_events")
                .select("at, business_id, session_key, kind, product_id, product_name, keywords, surface")
                .gte("at", since)
                .order("at", { ascending: false })
                .limit(5000);

            // Tabel belum dibuat (erp-phase4.sql belum dijalankan): tampil kosong.
            if (error) {
                if (error.code === "42P01" || error.code === "PGRST205") return [];
                throw error;
            }
            return data || [];
        },

        /** Add-on aktif untuk brand ini (tabel brand_addons, db/analysis.sql; diisi PUSAT, bukan dari web). */
        async listAddons() {
            const today = new Date().toISOString().slice(0, 10);
            const { data, error } = await supabase.from("brand_addons").select("addon, until").eq("business_id", CFG.business_id).eq("active", true);
            if (error) return [];
            return (data || []).filter((row) => !row.until || row.until >= today).map((row) => row.addon);
        },

        /** Kuota add-on berjumlah (kolom quota di brand_addons, db/erp-docs.sql). */
        async addonQuota(addon) {
            const { data, error } = await supabase.from("brand_addons").select("quota").eq("business_id", CFG.business_id).eq("addon", addon).eq("active", true).maybeSingle();
            if (error || !data) return 0;
            return Number(data.quota) || 0;
        },

        /** Data Anachronos Analysis. RLS (db/analysis.sql) menyaring siapa yang boleh membaca. */
        async analysisData({ days = 30 } = {}) {
            const since = new Date(Date.now() - days * 86400000).toISOString();
            const safe = async (query) => {
                const { data, error } = await query;
                return error ? [] : data || [];
            };
            const [events, lost] = await Promise.all([
                safe(supabase.from("ai_events").select("at, business_id, session_key, kind, product_id, product_name, keywords, surface").gte("at", since).order("at", { ascending: false }).limit(5000)),
                safe(supabase.from("pos_lost_sales").select("reason, qty, value, created_at").gte("created_at", since).limit(5000)),
            ]);
            let orders = [];
            try {
                orders = (await this.listOrders?.({ since })) ?? [];
            } catch {
                orders = [];
            }
            return { events, lost, orders };
        },

        async researchBrands() {
            return [{ id: CFG.business_id, name: CFG.app_name || "Toko" }];
        },
    };
}
